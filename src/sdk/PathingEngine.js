import path from 'path';

/**
 * The Sovereign Pathing Engine.
 * Implements Dijkstra's SPF algorithm with weighted topological planes.
 */
export class PathingEngine {
    constructor(graphEngine) {
        this.engine = graphEngine;
        this.PLANE_COSTS = { h_up: 1, h_down: 1, t_out: 2, s_zone: 3 };
    }

    /**
     * Helper to grab edges with their associated traversal costs.
     */
    _getWeightedEdges(nodeUid, planes) {
        let edges = [];
        
        if (planes.h_up) {
            const parent = this.engine.getParent(nodeUid);
            if (parent) edges.push({ uid: parent, cost: this.PLANE_COSTS.h_up });
        }
        if (planes.h_down) {
            this.engine.getChildren(nodeUid).forEach(c => {
                edges.push({ uid: c, cost: this.PLANE_COSTS.h_down });
            });
        }
        if (planes.t_out) {
            this.engine.getWires(nodeUid).forEach(w => {
                edges.push({ uid: w, cost: this.PLANE_COSTS.t_out });
            });
        }
        if (planes.s_zone) {
            const node = this.engine.getNode(nodeUid);
            if (node && node.path) {
                const zone = node.path.split('/').slice(0, -1).join('/');
                this.engine.getZoneMembers(zone).forEach(p => { 
                    if (p !== nodeUid) edges.push({ uid: p, cost: this.PLANE_COSTS.s_zone }); 
                });
            }
        }
        
        return edges;
    }

    /**
     * Targeted Pathfinding (Dijkstra SPF)
     * Finds the most 'logical' shortest path between two nodes based on plane weights.
     */
    findPath(srcUid, dstUid, planes = { h_up: true, h_down: true, t_out: true, s_zone: true }) {
        if (srcUid === dstUid) return [{ uid: srcUid, cost: 0, depth: 0 }];
        if (!this.engine.nodes.has(srcUid) || !this.engine.nodes.has(dstUid)) return [];

        const distances = new Map();
        const previous = new Map();
        const depths = new Map();
        const priorityQueue = [];

        for (const node of this.engine.nodes.keys()) {
            distances.set(node, Infinity);
            depths.set(node, Infinity);
        }

        distances.set(srcUid, 0);
        depths.set(srcUid, 0);
        priorityQueue.push({ uid: srcUid, cost: 0 });

        while (priorityQueue.length > 0) {
            // Sort by cost (Naive Dijkstra implementation for small-to-medium scale)
            priorityQueue.sort((a, b) => a.cost - b.cost);
            const { uid: current } = priorityQueue.shift();

            if (current === dstUid) break;

            for (const edge of this._getWeightedEdges(current, planes)) {
                const alt = distances.get(current) + edge.cost;
                if (alt < distances.get(edge.uid)) {
                    distances.set(edge.uid, alt);
                    depths.set(edge.uid, depths.get(current) + 1);
                    previous.set(edge.uid, current);
                    priorityQueue.push({ uid: edge.uid, cost: alt });
                }
            }
        }

        if (distances.get(dstUid) === Infinity) return [];

        const path = [];
        let curr = dstUid;
        while (curr) {
            path.unshift({ uid: curr, cost: distances.get(curr), depth: depths.get(curr) });
            curr = previous.get(curr);
        }
        return path;
    }

    /**
     * Radial Scan (Legacy compatibility wrapper for BFS)
     */
    scanSubnet(srcUid, maxDepth = 1, planes = { h_down: true, t_out: true, s_zone: true }) {
        if (!this.engine.nodes.has(srcUid)) return [];
        let visited = new Set([srcUid]);
        let queue = [{ uid: srcUid, depth: 0 }];
        let results = [];

        while (queue.length > 0) {
            const { uid, depth } = queue.shift();
            if (depth > maxDepth) continue;
            results.push(uid);

            const neighbors = this._getWeightedEdges(uid, planes);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.uid)) {
                    visited.add(neighbor.uid);
                    queue.push({ uid: neighbor.uid, depth: depth + 1 });
                }
            }
        }
        return results;
    }
}
