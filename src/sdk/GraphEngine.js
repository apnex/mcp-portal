import { Node } from './Node.js';
import crypto from 'crypto';

export class GraphEngine {
    constructor() {
        this.nodes = new Map();

        // The Routing Tables
        this.hRouter = new Map(); // uid -> Set of Child UIDs (Containment/Ownership)
        this.hRouterUp = new Map(); // uid -> Parent UID (Fast upward lookup)
        
        this.tRouter = new Map(); // uid -> Map of dstUid -> { tags: [] } (First-Class Semantic Links)
        
        this.sRouterZones = new Map(); // zone_name -> Set of UIDs (Physical/Logical Territories)
        this.sRouterGroups = new Map(); // group_name -> Set of UIDs (Tag-based Memberships)
    }

    // --- GLOBAL INDEXING (For Stateless Bitsets) ---
    getGlobalIndex() {
        return Array.from(this.nodes.keys()).sort();
    }

    getUIDIndexMap() {
        const uids = this.getGlobalIndex();
        const map = new Map();
        uids.forEach((uid, index) => map.set(uid, index));
        return map;
    }

    getMerkleRoot() {
        const uids = this.getGlobalIndex();
        const hash = crypto.createHash('sha256');
        for (const uid of uids) {
            const node = this.nodes.get(uid);
            hash.update(uid);
            hash.update(node.rawBody || "");
        }
        return hash.digest('hex');
    }

    // --- SOVEREIGN COORDINATE SYSTEM (SCS) ---
    /**
     * Resolves the [X, Y, Z] coordinate for a node.
     * Y: Hierarchical Depth (0=KMS-ROOT)
     * X: Alphabetical Sibling Index
     * Z: Sector Index (0:Core, 1:Gov, 2:Eng, 3:Projects)
     */
    resolveSCS(uid) {
        const node = this.nodes.get(uid);
        if (!node) return [0, 0, 0];

        // Y: Depth
        let y = 0;
        let current = uid;
        while (this.getParent(current)) {
            y++;
            current = this.getParent(current);
        }

        // Z: Sector
        let z = 0;
        if (node.path.includes('/gov/')) z = 1;
        else if (node.path.includes('/eng/')) z = 2;
        else if (node.path.includes('/projects/')) z = 3;

        // X: Sibling Index
        const parent = this.getParent(uid);
        let x = 0;
        if (parent) {
            const siblings = this.getChildren(parent).sort();
            x = siblings.indexOf(uid);
        }

        return [x, y, z];
    }

    // --- NODE REGISTRATION ---
    registerNode(node) {
        if (!(node instanceof Node)) throw new Error("Must register a valid Node object");
        this.nodes.set(node.uid, node);
        
        if (!this.hRouter.has(node.uid)) this.hRouter.set(node.uid, new Set());
        if (!this.tRouter.has(node.uid)) this.tRouter.set(node.uid, new Map());
    }

    getNode(uid) {
        return this.nodes.get(uid);
    }

    // --- H-PLANE (Hierarchy) ---
    setParent(childUid, parentUid) {
        this.hRouterUp.set(childUid, parentUid);
        if (!this.hRouter.has(parentUid)) this.hRouter.set(parentUid, new Set());
        this.hRouter.get(parentUid).add(childUid);
    }

    getParent(childUid) {
        return this.hRouterUp.get(childUid) || null;
    }

    getChildren(parentUid) {
        return Array.from(this.hRouter.get(parentUid) || []);
    }

    // --- T-PLANE (Topology/Wires) ---
    addWire(srcUid, dstUid, tags = []) {
        if (!this.tRouter.has(srcUid)) this.tRouter.set(srcUid, new Map());
        
        const edges = this.tRouter.get(srcUid);
        if (edges.has(dstUid)) {
            const existingTags = edges.get(dstUid).tags || [];
            edges.set(dstUid, { tags: [...new Set([...existingTags, ...tags])] });
        } else {
            edges.set(dstUid, { tags: [...new Set(tags)] });
        }
    }

    getWires(srcUid) {
        return Array.from(this.tRouter.get(srcUid)?.keys() || []);
    }

    getSemanticWire(srcUid, dstUid) {
        return this.tRouter.get(srcUid)?.get(dstUid) || null;
    }

    // --- S-PLANE (Semantics/Zones) ---
    addToZone(uid, zoneName) {
        if (!this.sRouterZones.has(zoneName)) this.sRouterZones.set(zoneName, new Set());
        this.sRouterZones.get(zoneName).add(uid);
    }

    getZoneMembers(zoneName) {
        return Array.from(this.sRouterZones.get(zoneName) || []);
    }

    addToGroup(uid, groupTag) {
        if (!this.sRouterGroups.has(groupTag)) this.sRouterGroups.set(groupTag, new Set());
        this.sRouterGroups.get(groupTag).add(uid);
    }

    getGroupMembers(groupTag) {
        return Array.from(this.sRouterGroups.get(groupTag) || []);
    }
}
