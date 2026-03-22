import { BitsetCodec } from './BitsetCodec.js';
import yaml from 'yaml';

/**
 * The high-scale graph traversal engine.
 * Implements the Sovereign Anchor Protocol (v2.1) for adaptive, deterministic, and convergent ingestion.
 */
export class MetabolismEngine {
    constructor(graphEngine, anchorManager, pathingEngine) {
        this.engine = graphEngine;
        this.anchorManager = anchorManager;
        this.pather = pathingEngine;
        this.SAFE_BYTE_LIMIT = 35000; // Optimized for bit-perfect delivery
    }

    /**
     * Executes a single adaptive pulse.
     * @param {Object|string} queryOrAnchorId - Initial query object or 8-char Anchor ID.
     * @returns {Object} - { nodes: Array<Node>, next_anchor: string, status: string }
     */
    pulse(queryOrAnchorId) {
        const globalIndex = this.engine.getGlobalIndex();
        const merkleRoot = this.engine.getMerkleRoot();
        let query;

        // 1. Resolve State (Initial vs Resume)
        if (typeof queryOrAnchorId === 'string') {
            query = this.anchorManager.getAnchor(queryOrAnchorId);
            if (!query) throw new Error(`Anchor ${queryOrAnchorId} not found or expired.`);
        } else {
            query = queryOrAnchorId;
            const type = query.metadata?.type || (query.spec.dst_uid ? "ROUTE" : (query.spec.frustum ? "SPATIAL" : "SCAN"));
            if (!query.metadata) query.metadata = { version: "2.1.0", status: "ACTIVE", type };
            if (!query.state) {
                query.metadata.graph_id = merkleRoot;
                query.state = {
                    queue: [{ uid: query.spec.src_uid, depth: 0, cost: 0 }],
                    visited_uids: [query.spec.src_uid],
                    current_depth: 0,
                    yield_count: 0
                };
            }
        }

        // 2. Declarative Convergence (Merkle Shift Re-routing)
        if (query.metadata.graph_id !== merkleRoot) {
            // MERKLE DRIFT DETECTED: Perform Metabolic Convergence (Re-Route)
            if (query.state.visited_uids) {
                query.state.visited_uids = query.state.visited_uids.filter(uid => this.engine.nodes.has(uid));
            } else {
                // Fallback for transitionary v2.0 anchors
                query.metadata.status = "STALE";
                throw new Error(`State Desynchronization: Merkle root mismatch. Anchor does not contain UID memory for re-alignment.`);
            }

            if (query.metadata.type === "ROUTE") {
                const target = query.spec.dst_uid;
                if (!this.engine.nodes.has(target)) {
                    query.metadata.status = "BLOCKED";
                    return { nodes: [], next_anchor: null, status: "BLOCKED" };
                }
                const lastUid = query.state.last_uid || query.spec.src_uid;
                const newPath = this.pather.findPath(lastUid, target, query.spec.planes);
                const visitedSet = new Set(query.state.visited_uids);
                query.state.queue = newPath.filter(p => !visitedSet.has(p.uid));
            }
            
            query.metadata.graph_id = merkleRoot;
        }

        const visitedUids = new Set(query.state.visited_uids);
        let queue = query.state.queue;
        const maxDepth = query.spec.depth || 99;
        const planes = query.spec.planes || { h_down: true, h_up: true, t_out: true, s_zone: true };
        const lod = query.spec.lod !== undefined ? query.spec.lod : (query.spec.hydrate ? 2 : 0);
        const rawText = !!query.spec.raw_text;
        
        let limit;
        if (query.spec.limit !== undefined) {
            limit = query.spec.limit === -1 ? Infinity : query.spec.limit;
        } else {
            limit = lod === 0 ? Infinity : 50;
        }

        // Increase Safe Limit for PERSONA queries (Single-Shot Hydration)
        const activeByteLimit = query.metadata.type === "PERSONA" ? 500000 : this.SAFE_BYTE_LIMIT;

        const yieldedNodes = [];
        let currentPayloadSize = 0;

        // 3. Spatial Slice (Frustum Mode)
        if (query.metadata.type === "SPATIAL" && !query.state.is_spatial_complete) {
            const allUids = this.engine.getGlobalIndex();
            const frustum = query.spec.frustum;
            const filteredUids = allUids.filter(uid => {
                const [x, y, z] = this.engine.resolveSCS(uid);
                if (frustum.y !== undefined && y !== frustum.y) return false;
                if (frustum.z !== undefined && z !== frustum.z) return false;
                if (frustum.x_range && (x < frustum.x_range[0] || x > frustum.x_range[1])) return false;
                if (frustum.y_range && (y < frustum.y_range[0] || y > frustum.y_range[1])) return false;
                return true;
            });

            if (query.state.yield_count === 0) {
                queue = filteredUids.map(uid => ({ uid, depth: 0, cost: 0 }));
            }
        }

        // 4. Adaptive Traversal Loop (Byte-Aware with Real YAML Counting)
        while (queue.length > 0 && yieldedNodes.length < limit) {
            const { uid, depth, cost } = queue[0];
            
            if (query.metadata.type !== "SPATIAL" && query.metadata.type !== "PERSONA" && depth > maxDepth) {
                queue.shift();
                continue;
            }

            const node = this.engine.getNode(uid);
            if (node) {
                // Construct result entry for this node based on LOD
                const resultNode = { uid: node.uid, scs: this.engine.resolveSCS(node.uid) };
                if (lod >= 1) resultNode.metadata = node.metadata;
                if (lod >= 2) {
                    if (rawText) resultNode.rawBody = node.rawBody;
                    else resultNode.content = node.content;
                }

                // Estimate size using YAML stringification
                const nodeSize = yaml.stringify(resultNode).length;

                // Stop if this node would push us over the safe limit
                if (yieldedNodes.length > 0 && (currentPayloadSize + nodeSize) > activeByteLimit) {
                    break;
                }

                // Node accepted
                queue.shift();
                yieldedNodes.push(resultNode);
                currentPayloadSize += nodeSize;
                query.state.yield_count++;
                query.state.current_depth = depth;
                query.state.last_uid = node.uid;

                // Only expand neighbors if in SCAN mode
                if (query.metadata.type === "SCAN") {
                    const neighbors = this.pather._getWeightedEdges(uid, planes);
                    for (const neighbor of neighbors) {
                        if (!visitedUids.has(neighbor.uid)) {
                            visitedUids.add(neighbor.uid);
                            queue.push({ uid: neighbor.uid, depth: depth + 1, cost: (cost || 0) + neighbor.cost });
                        }
                    }
                }
            } else {
                queue.shift();
            }
        }

        // 5. Yield & Anchor
        query.state.queue = queue;
        query.state.visited_uids = Array.from(visitedUids);
        if (query.metadata.type === "SPATIAL") query.state.is_spatial_complete = (queue.length === 0);

        let next_anchor = null;
        if (queue.length === 0) {
            query.metadata.status = "COMPLETED";
        } else {
            next_anchor = this.anchorManager.saveAnchor(query);
        }

        return {
            nodes: yieldedNodes,
            next_anchor,
            status: query.metadata.status
        };
    }
}
