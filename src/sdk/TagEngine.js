import fs from 'fs';
import path from 'path';

/**
 * The S-Plane Lexicon Engine
 * Parses and mutates the official Tag Ledger, mathematically enforcing the syntax rules
 * and dynamically alphabetizing the markdown list.
 */
export class TagEngine {
    constructor(registryRoot) {
        this.ledgerPath = path.join(registryRoot, 'gov/registry/KMS-REG-TAG-LEDGER.md');
        // Simple regex: lowercase letters, numbers, and underscores only.
        this.snakeCaseRegex = /^[a-z0-9_]+$/; 
    }

    /**
     * Reads the Ledger and returns a structured array of active tags and their definitions.
     */
    listTags() {
        if (!fs.existsSync(this.ledgerPath)) throw new Error("Tag Ledger not found at " + this.ledgerPath);
        
        const content = fs.readFileSync(this.ledgerPath, 'utf8');
        
        // Find the Lexicon section
        const lexiconRegex = /## 3\. The Active Lexicon\n([\s\S]*?)\n---/m;
        const match = content.match(lexiconRegex);
        if (!match) return [];

        const tags = [];
        const lines = match[1].split('\n').filter(l => l.trim().startsWith('*'));
        
        for (const line of lines) {
            // Match format: * **tag_name**: The definition
            const tagMatch = line.match(/^\*\s+\*\*(.*?)\*\*:\s+(.*)/);
            if (tagMatch) {
                tags.push({ tag: tagMatch[1], definition: tagMatch[2] });
            }
        }
        
        return tags;
    }

    /**
     * Proposes a new tag. Enforces syntax, injects it alphabetically, and saves the file.
     */
    proposeTag(tag, definition) {
        if (!this.snakeCaseRegex.test(tag)) {
            throw new Error(`Syntax Error: Tag '${tag}' violates snake_case constraints. Only lowercase letters, numbers, and underscores are permitted.`);
        }

        const existingTags = this.listTags();
        if (existingTags.find(t => t.tag === tag)) {
            return { status: 'DUPLICATE', message: `Tag '${tag}' already exists in the Ledger.` };
        }

        const content = fs.readFileSync(this.ledgerPath, 'utf8');
        const lexiconRegex = /(## 3\. The Active Lexicon\n)([\s\S]*?)(\n---)/m;
        const match = content.match(lexiconRegex);
        if (!match) throw new Error("Could not locate the Lexicon section in the Ledger.");

        // Add the new tag to the parsed list
        existingTags.push({ tag, definition });
        
        // Mathematically sort the list alphabetically
        existingTags.sort((a, b) => a.tag.localeCompare(b.tag));

        // Rebuild the markdown block
        let newBlock = '';
        for (const t of existingTags) {
            newBlock += `*   **${t.tag}**: ${t.definition}\n`;
        }

        // Surgical replacement
        const newContent = content.replace(lexiconRegex, `$1${newBlock}$3`);
        fs.writeFileSync(this.ledgerPath, newContent, 'utf8');

        return { status: 'SUCCESS', tag: tag, definition: definition };
    }
}
