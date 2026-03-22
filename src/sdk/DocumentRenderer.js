/**
 * The Sovereign Document Renderer.
 * Responsible for delivering the final markdown payload for an artifact.
 * In the current 'Document Master' model, it serves the raw node content.
 */
export class DocumentRenderer {
    constructor(graphEngine) {
        this.engine = graphEngine;
    }

    /**
     * Renders the requested document.
     * @param {string} uid - The unique ID of the artifact to render.
     * @returns {string} - The raw markdown content.
     */
    render(uid) {
        const node = this.engine.getNode(uid);
        if (!node) {
            throw new Error(`Artifact ${uid} not found in the Sovereign Graph.`);
        }

        // Return the rawBody which includes the YAML frontmatter and prose.
        return node.rawBody;
    }
}
