/**
 * The pure mathematical primitive.
 * Contains no relationship mapping. Represents an isolated artifact in the ether.
 */
export class Node {
    constructor(uid, path = null) {
        this.uid = uid;
        this.path = path;
        this.metadata = {}; // YAML frontmatter
        this.content = {};  // Structured content body
        this.rawBody = "";  // Unstructured prose
    }

    hydrate(metadata, content, rawBody) {
        this.metadata = metadata;
        this.content = content;
        this.rawBody = rawBody;
    }
}
