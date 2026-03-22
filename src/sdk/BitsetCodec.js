/**
 * Utility for encoding and decoding high-density bitsets for stateless graph traversal.
 */
export class BitsetCodec {
    /**
     * Encodes a Set of UIDs into a Base64 bitset.
     * @param {Set<string>|Array<string>} visitedSet - The UIDs already visited.
     * @param {Array<string>} globalIndex - The deterministic alphabetized list of all UIDs.
     * @returns {string} - Base64 encoded bitset.
     */
    static encode(visitedSet, globalIndex) {
        const visited = visitedSet instanceof Set ? visitedSet : new Set(visitedSet);
        const byteLength = Math.ceil(globalIndex.length / 8);
        const bytes = new Uint8Array(byteLength);

        for (let i = 0; i < globalIndex.length; i++) {
            if (visited.has(globalIndex[i])) {
                const byteIndex = Math.floor(i / 8);
                const bitIndex = i % 8;
                bytes[byteIndex] |= (1 << bitIndex);
            }
        }

        return Buffer.from(bytes).toString('base64');
    }

    /**
     * Decodes a Base64 bitset into a Set of UIDs.
     * @param {string} base64 - The encoded bitset.
     * @param {Array<string>} globalIndex - The deterministic alphabetized list of all UIDs.
     * @returns {Set<string>} - The reconstructed Visited Set.
     */
    static decode(base64, globalIndex) {
        const bytes = Buffer.from(base64, 'base64');
        const visited = new Set();

        for (let i = 0; i < globalIndex.length; i++) {
            const byteIndex = Math.floor(i / 8);
            const bitIndex = i % 8;
            if (byteIndex < bytes.length && (bytes[byteIndex] & (1 << bitIndex))) {
                visited.add(globalIndex[i]);
            }
        }

        return visited;
    }
}
