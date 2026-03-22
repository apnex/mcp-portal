import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Manages Content-Addressable Storage (CAS) for OIS Traversal Anchors.
 */
export class AnchorManager {
    constructor(storageDir) {
        this.storageDir = storageDir;
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    /**
     * Saves an anchor state and returns its 8-character shorthash.
     * @param {Object} state - The traversal state object.
     * @returns {string} - The anchor ID.
     */
    saveAnchor(state) {
        const payload = JSON.stringify(state);
        const hash = crypto.createHash('sha256').update(payload).digest('hex');
        const id = hash.slice(0, 8);
        const filePath = path.join(this.storageDir, `${id}.json`);
        
        fs.writeFileSync(filePath, payload);
        return id;
    }

    /**
     * Retrieves an anchor state by its ID.
     * @param {string} id - The 8-character anchor ID.
     * @returns {Object|null} - The state object or null if not found.
     */
    getAnchor(id) {
        const filePath = path.join(this.storageDir, `${id}.json`);
        if (!fs.existsSync(filePath)) return null;
        
        const payload = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(payload);
    }

    /**
     * Prunes anchors older than the specified TTL.
     * @param {number} ttlMs - Time to live in milliseconds.
     */
    prune(ttlMs = 4 * 60 * 60 * 1000) { // Default 4 hours
        const files = fs.readdirSync(this.storageDir);
        const now = Date.now();

        for (const file of files) {
            const filePath = path.join(this.storageDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > ttlMs) {
                fs.unlinkSync(filePath);
            }
        }
    }

    /**
     * Clear all anchors. Useful for graph shifts (Merkle Lock).
     */
    clearAll() {
        const files = fs.readdirSync(this.storageDir);
        for (const file of files) {
            fs.unlinkSync(path.join(this.storageDir, file));
        }
    }
}
