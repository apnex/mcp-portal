import path from 'path';

/**
 * The Sovereign Topology Engine.
 * Responsible for calculating and hydrating Role-specific context according to the 
 * Recursive Ingestion Protocol (RIP).
 */
export class TopologyEngine {
    constructor(graphEngine, pathingEngine) {
        this.engine = graphEngine;
        this.pather = pathingEngine;
    }

    /**
     * Calculates the required node sequence for a role and returns a Query Intent.
     * @param {string} roleUid - The target Role UID.
     * @returns {Object} - A First-Class Query Intent of type 'PERSONA'.
     */
    computePersonaTopology(roleUid) {
        if (!this.engine.getNode(roleUid)) {
            throw new Error(`Cannot compute topology: Anchor node ${roleUid} not found.`);
        }

        // 1. Calculate the Spine (V-ASC -> Reverse for Root-to-Leaf)
        const trace = this.pather.findPath(roleUid, 'KMS-ROOT', { h_up: true }).map(p => p.uid).reverse();
        
        const cultural_context_uids = new Set();
        const actionable_context_uids = new Set();
        
        for (const uid of trace) {
            const node = this.engine.getNode(uid);
            if (node) {
                // 2. Cultural Context (S-SAT peers)
                const zonePeers = this.engine.getZoneMembers(path.dirname(node.path));
                zonePeers.forEach(p => { if (p !== uid) cultural_context_uids.add(p); });

                // 3. Actionable Context (T-SAT wires)
                const wires = this.engine.getWires(uid);
                wires.forEach(w => actionable_context_uids.add(w));
            }
        }

        // 4. Assemble the Metabolic Queue (Ordered RIP sequence) with Deduplication
        const ripQueue = [];
        const seenInQueue = new Set();

        const addToQueue = (uid, depth) => {
            if (!seenInQueue.has(uid)) {
                ripQueue.push({ uid, depth, cost: 0 });
                seenInQueue.add(uid);
            }
        };

        trace.forEach(uid => addToQueue(uid, 0));
        cultural_context_uids.forEach(uid => addToQueue(uid, 1));
        actionable_context_uids.forEach(uid => addToQueue(uid, 2));

        return {
            kind: "query",
            metadata: { 
                version: "2.1.0",
                status: "ACTIVE",
                type: "PERSONA"
            },
            spec: {
                src_uid: roleUid,
                lod: 2,
                limit: -1,
                hydrate: true,
                planes: { h_down: true, h_up: true, t_out: true, s_zone: true }
            },
            state: {
                queue: ripQueue,
                visited_uids: Array.from(seenInQueue),
                yield_count: 0
            }
        };
    }

    /**
     * Legacy support for full hydration in one go.
     */
    hydrateTopology(topology) {
        // ... maintaining this for backward compatibility if needed, 
        // but the new way is to use the query intent above.
        const hydratedPayload = {
            system_topology: { 
                active_socket: topology.spec.src_uid, 
                ancestry_trace: topology.state.queue.filter(q => q.depth === 0).map(q => q.uid) 
            },
            hydrated_nodes: {},
            cultural_context: {}, 
            actionable_context: {} 
        };

        topology.state.queue.forEach(q => {
            const node = this.engine.getNode(q.uid);
            if (node) {
                if (q.depth === 0) hydratedPayload.hydrated_nodes[q.uid] = node.content;
                else if (q.depth === 1) hydratedPayload.cultural_context[q.uid] = node.content;
                else hydratedPayload.actionable_context[q.uid] = node.content;
            }
        });
        
        return hydratedPayload;
    }
}
