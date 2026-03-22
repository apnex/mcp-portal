import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Node } from './Node.js';

export class OisLoader {
    constructor(registryRoot, graphEngine) {
        this.registryRoot = registryRoot;
        this.engine = graphEngine;
    }

    async hydrateEngine() {
        const files = this._walkSync(this.registryRoot);
        for (const file of files) {
            if (file.endsWith('.md')) {
                this._parseAndRegisterFile(file);
            }
        }
        for (const [uid, node] of this.engine.nodes.entries()) {
            this._populateRouters(node);
        }
    }

    _walkSync(dir, filelist = []) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const dirFile = path.join(dir, file);
            const dirent = fs.statSync(dirFile);
            if (dirent.isDirectory()) filelist = this._walkSync(dirFile, filelist);
            else filelist.push(dirFile);
        }
        return filelist;
    }

    _parseAndRegisterFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const frontmatterRegex = /---\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);
        if (!match) return; 
        try {
            const metadata = yaml.parse(match[1].trim());
            if (!metadata || !metadata['artifact-uid']) return; 
            const uid = metadata['artifact-uid'];
            const bodyText = content.replace(frontmatterRegex, '').trim();
            const structure = this._parseMarkdownBody(bodyText);
            const node = new Node(uid, filePath);
            node.hydrate(metadata, structure, bodyText);
            this.engine.registerNode(node);
        } catch (e) {
            console.error(`[OisLoader] Failed to parse YAML in ${filePath}:`, e.message);
        }
    }

    _parseMarkdownBody(body) {
        const lines = body.split('\n');
        const result = {};
        let currentKey = 'summary';
        let currentBlock = [];
        for (const line of lines) {
            const headerMatch = line.match(/^##\s*(?:\d+\.\s*)?(.+)$/);
            if (headerMatch) {
                if (currentBlock.length > 0) result[currentKey] = currentBlock.join('\n').trim();
                currentKey = headerMatch[1].trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                currentBlock = [];
            } else {
                currentBlock.push(line);
            }
        }
        if (currentBlock.length > 0) result[currentKey] = currentBlock.join('\n').trim();
        return result;
    }

    _populateRouters(node) {
        // 1. Populate H-Plane (Hierarchy via h-plane-up)
        const upstream = node.metadata['h-plane-up'];
        if (upstream) {
            if (this.engine.nodes.has(upstream)) {
                this.engine.setParent(node.uid, upstream);
            }
        }

        // 2. Populate Semantic T-Plane (Explicit YAML Dictionary)
        const explicitTPlane = node.metadata['t-plane-out'];
        if (explicitTPlane && typeof explicitTPlane === 'object' && !Array.isArray(explicitTPlane)) {
            for (const [targetUid, tagData] of Object.entries(explicitTPlane)) {
                if (this.engine.nodes.has(targetUid)) {
                    let tags = [];
                    if (Array.isArray(tagData)) {
                        tags = tagData;
                    } else if (typeof tagData === 'string') {
                        tags = [tagData];
                    }
                    this.engine.addWire(node.uid, targetUid, tags);
                }
            }
        }

        // 3. Populate S-Plane (Zones via physical directory)
        const zoneName = path.dirname(node.path);
        this.engine.addToZone(node.uid, zoneName);

        // 4. Populate S-Plane (Groups via tags)
        const tags = node.metadata['tags'];
        if (Array.isArray(tags)) {
            for (const tag of tags) {
                this.engine.addToGroup(node.uid, tag);
            }
        }
    }
}
