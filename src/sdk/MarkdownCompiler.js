import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

export class MarkdownCompiler {
  constructor(registryRoot) {
    this.registryRoot = registryRoot;
  }

  _resolveDynamicTargetPath(upstreamUid, parserGraph, fallbackDir) {
      if (upstreamUid && parserGraph.has(upstreamUid)) {
          const parentNode = parserGraph.get(upstreamUid);
          return path.dirname(parentNode.path);
      }
      return path.join(this.registryRoot, fallbackDir);
  }

  // ... existing tools ...
  async compileAndWriteAxiom(payload, parserGraph) {
    const { title, mandate, mechanics, rationale, system_consequences } = payload;
    const upstreamContext = 'KMS-GOV-AXIOM-CHARTER';
    
    const existingAxioms = Array.from(parserGraph.values()).filter(n => n.metadata.tags && n.metadata.tags.includes('axioms'));
    const nextNum = (existingAxioms.length * 10) + 10;
    const paddedNum = nextNum.toString().padStart(3, '0');
    
    const slug = title.replace(/^The\s+/i, '').replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 20).replace(/-+$/, '');
    const uid = `KMS-META-${paddedNum}-${slug}`;

    const targetDir = this._resolveDynamicTargetPath(upstreamContext, parserGraph, 'gov/axioms');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const filePath = path.join(targetDir, `${uid}.md`);

    const frontmatter = { 'artifact-uid': uid, 'schema-version': '1.0.0', 'ka-gate-auth': 'ROLE-KA-ROOT', 'status': 'ACTIVE', 'org-root': 'org', 'h-plane-up': upstreamContext, 'tags': ['axioms', 'Internal'] };

    let markdown = `# Axiom: ${title} (${uid})\n\n---\n${yaml.stringify(frontmatter)}---\n\n`;
    markdown += `## 1. The Mandate\n**"${mandate}"**\n\n## 2. Mechanics\n`;
    mechanics.forEach(m => { markdown += `*   ${m}\n`; });
    markdown += `\n## 3. Rationale\n${rationale}\n\n## 4. System Consequences\n`;
    system_consequences.forEach(sc => { markdown += `*   ${sc}\n`; });
    markdown += `\n---\n🛡️ **[DLR_AUD_ARTIFACT]** ${uid} compiled via MCP Gatekeeper.`;

    fs.writeFileSync(filePath, markdown, 'utf8');
    return { uid, path: filePath, status: 'SUCCESS' };
  }

  async compileAndWriteRoleSpec(payload, parserGraph) {
    const { id, title, entity_class, hierarchy_level, tags, clearance, mission, pillars, technical_duties, constraints, h_plane_up } = payload;
    
    let cleanUpstream = h_plane_up.replace(/\[\[/g, '').replace(/\]\]/g, '');
    cleanUpstream = path.basename(cleanUpstream).replace(/\.md$/i, '').trim();

    const targetDir = this._resolveDynamicTargetPath(cleanUpstream, parserGraph, 'eng/roles'); 
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const filePath = path.join(targetDir, `${id}.md`);

    const frontmatter = { 'artifact-uid': id, 'schema-version': '1.0.0', 'ka-gate-auth': 'ROLE-KA-ROOT', 'status': 'ACTIVE', 'org-root': 'org', 'h-plane-up': h_plane_up, 'tags': tags };

    let markdown = `# Entity Role Spec: ${title} (${id})\n\n---\n${yaml.stringify(frontmatter)}---\n\n`;
    markdown += `## 1. Metadata (Role Identity)\n- **ID:** \`${id}\`\n- **Entity Class:** \`${entity_class}\`\n- **Hierarchy Level:** ${hierarchy_level}\n- **Tags:** ${tags.join(', ')}\n- **Clearance:** ${clearance}\n\n`;
    markdown += `## 2. Mission\n${mission}\n\n## 3. Pillars\n`;
    pillars.forEach(p => { markdown += `- ${p}\n`; });
    markdown += `\n## 4. Specific Technical Duties\n`;
    technical_duties.forEach((d, i) => { markdown += `- **[D-${(i+1).toString().padStart(2, '0')}]** ${d}\n`; });
    markdown += `\n## 5. Constraints & Boundary Conditions (The Voids)\n`;
    constraints.forEach(c => { markdown += `- ${c}\n`; });
    markdown += `\n---\n🛡️ **[DLR_AUD_ARTIFACT]** ${id} compiled via MCP Gatekeeper.`;

    fs.writeFileSync(filePath, markdown, 'utf8');
    return { uid: id, path: filePath, status: 'SUCCESS' };
  }

  async compileAndWriteProtocol(payload, parserGraph) {
    const { title, steps, tags, h_plane_up } = payload;
    
    const existingProcs = Array.from(parserGraph.values()).filter(n => n.metadata.tags && n.metadata.tags.includes('protocols'));
    const nextNum = (existingProcs.length * 10) + 10;
    const slug = title.replace(/^The\s+/i, '').replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 20).replace(/-+$/, '');
    const uid = `KMS-PROC-${nextNum.toString().padStart(3, '0')}-${slug}`;

    const finalUpstream = h_plane_up || 'KMS-GOV-PROC-CHARTER';
    let cleanUpstream = finalUpstream.replace(/\[\[/g, '').replace(/\]\]/g, '');
    cleanUpstream = path.basename(cleanUpstream).replace(/\.md$/i, '').trim();

    const targetDir = this._resolveDynamicTargetPath(cleanUpstream, parserGraph, 'gov/protocols');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const filePath = path.join(targetDir, `${uid}.md`);

    const frontmatter = { 'artifact-uid': uid, 'schema-version': '1.0.0', 'ka-gate-auth': 'ROLE-KA-ROOT', 'status': 'ACTIVE', 'org-root': 'org', 'h-plane-up': finalUpstream, 'tags': tags || ['protocols', 'Internal'] };

    let markdown = `# Protocol: ${title} (${uid})\n\n---\n${yaml.stringify(frontmatter)}---\n\n`;
    markdown += `## 1. Execution Steps\n`;
    steps.forEach((step, i) => { markdown += `${i + 1}. **${step.action}**: ${step.description}\n`; });
    markdown += `\n---\n🛡️ **[DLR_AUD_ARTIFACT]** ${uid} compiled via MCP Gatekeeper.`;

    fs.writeFileSync(filePath, markdown, 'utf8');
    return { uid, path: filePath, status: 'SUCCESS' };
  }

  async updateArtifactField(uid, field, newContent, parserGraph) {
      const node = parserGraph.get(uid);
      if (!node) throw new Error(`Cannot update: Node ${uid} not found.`);

      const content = fs.readFileSync(node.path, 'utf8');
      const fieldRegex = new RegExp(`(#{2,3}\\s*(?:\\d+\\.\\s*)?${field}\\s*\\n)([\\s\\S]*?)(?=\\n#{2,3}|\\n---)`, 'i');
      
      let newMarkdownBlock = '';
      if (Array.isArray(newContent)) {
          newContent.forEach(item => { newMarkdownBlock += `- ${item}\n`; });
      } else {
          newMarkdownBlock = `${newContent}\n`;
      }

      const updatedContent = content.replace(fieldRegex, `$1${newMarkdownBlock}`);
      if (updatedContent === content) throw new Error(`Field ${field} not found or could not be cleanly replaced in markdown.`);

      fs.writeFileSync(node.path, updatedContent, 'utf8');
      return { uid, path: node.path, status: 'UPDATED' };
  }

  async compileAndWriteGenericArtifact(payload, parserGraph) {
      const { uid, title, h_plane_up, tags, sections } = payload;
      if (!uid) throw new Error("A specific UID must be provided for generic artifacts.");

      let cleanUpstream = h_plane_up.replace(/\[\[/g, '').replace(/\]\]/g, '');
      cleanUpstream = path.basename(cleanUpstream).replace(/\.md$/i, '').trim();

      const targetDir = this._resolveDynamicTargetPath(cleanUpstream, parserGraph, 'knowledge'); 
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const filePath = path.join(targetDir, `${uid}.md`);

      const frontmatter = { 'artifact-uid': uid, 'schema-version': '1.0.0', 'ka-gate-auth': 'ROLE-KA-ROOT', 'status': 'ACTIVE', 'org-root': 'org', 'h-plane-up': cleanUpstream, 'tags': tags };

      let markdown = `# ${title} (${uid})\n\n---\n${yaml.stringify(frontmatter)}---\n\n`;
      sections.forEach(section => {
          markdown += `## ${section.heading}\n`;
          if (Array.isArray(section.body)) {
              section.body.forEach(item => { markdown += `- ${item}\n`; });
          } else {
              markdown += `${section.body}\n`;
          }
          markdown += `\n`;
      });
      markdown += `---\n🛡️ **[DLR_AUD_ARTIFACT]** ${uid} compiled via MCP Gatekeeper.`;

      fs.writeFileSync(filePath, markdown, 'utf8');
      return { uid, path: filePath, status: 'SUCCESS' };
  }

  async appendArtifactSection(uid, heading, body, parserGraph) {
      const node = parserGraph.get(uid);
      if (!node) throw new Error(`Cannot append: Node ${uid} not found.`);

      const content = fs.readFileSync(node.path, 'utf8');
      const boundaryRegex = /(---\s*\n🛡️ \*\*\[DLR_AUD_ARTIFACT\]\*\*.*)/;
      
      let newMarkdownBlock = `## ${heading}\n`;
      if (Array.isArray(body)) {
          body.forEach(item => { newMarkdownBlock += `- ${item}\n`; });
      } else {
          newMarkdownBlock += `${body}\n`;
      }
      newMarkdownBlock += `\n`;

      const match = content.match(boundaryRegex);
      if (!match) throw new Error(`Could not find valid security boundary in ${uid} to safely append before.`);

      const updatedContent = content.replace(boundaryRegex, `${newMarkdownBlock}$1`);
      fs.writeFileSync(node.path, updatedContent, 'utf8');
      return { uid, path: node.path, status: 'APPENDED' };
  }

  async updateArtifactMetadata(uid, newMetadata, parserGraph) {
      const node = parserGraph.get(uid);
      if (!node) throw new Error(`Cannot modify metadata: Node ${uid} not found.`);

      const content = fs.readFileSync(node.path, 'utf8');
      const frontmatterRegex = /---\n([\s\S]*?)\n---/;
      const match = content.match(frontmatterRegex);
      if (!match) throw new Error(`Node ${uid} is missing standard YAML frontmatter.`);

      let parsedYaml = yaml.parse(match[1]);
      if (newMetadata.h_plane_up) parsedYaml['h-plane-up'] = newMetadata.h_plane_up;
      if (newMetadata.tags) parsedYaml['tags'] = newMetadata.tags;
      if (newMetadata.status) parsedYaml['status'] = newMetadata.status;

      const newYamlStr = yaml.stringify(parsedYaml);
      const updatedContent = content.replace(frontmatterRegex, `---\n${newYamlStr}---`);

      fs.writeFileSync(node.path, updatedContent, 'utf8');
      return { uid, path: node.path, status: 'METADATA_UPDATED' };
  }

  /**
   * NEW TOOL: The Sledgehammer.
   * Completely overwrites the prose body of a document while mathematically protecting the YAML frontmatter.
   */
  async rewriteArtifactBody(uid, rawMarkdownBody, parserGraph) {
      const node = parserGraph.get(uid);
      if (!node) throw new Error(`Cannot rewrite: Node ${uid} not found.`);

      const content = fs.readFileSync(node.path, 'utf8');
      
      // 1. Extract the Title block (e.g. # Artifact Title (UID))
      const titleMatch = content.match(/^(#.*?\n+)/);
      const titleBlock = titleMatch ? titleMatch[1] : '';

      // 2. Extract the protected YAML block
      const frontmatterRegex = /---\n([\s\S]*?)\n---/;
      const yamlMatch = content.match(frontmatterRegex);
      if (!yamlMatch) throw new Error(`Node ${uid} is missing standard YAML frontmatter.`);
      const yamlBlock = `---\n${yamlMatch[1]}\n---\n\n`;

      // 3. Extract the protected Security Boundary
      let boundaryBlock = `\n---\n🛡️ **[DLR_AUD_ARTIFACT]** ${uid} compiled via MCP Gatekeeper.`;
      const boundaryRegex = /(---\s*\n🛡️ \*\*\[DLR_AUD_ARTIFACT\]\*\*.*)/;
      const boundaryMatch = content.match(boundaryRegex);
      if (boundaryMatch) {
          boundaryBlock = `\n${boundaryMatch[1]}`;
      }

      // 4. Sandwich the new body
      const newContent = `${titleBlock}${yamlBlock}${rawMarkdownBody}${boundaryBlock}`;

      // 5. Write to disk
      fs.writeFileSync(node.path, newContent, 'utf8');
      return { uid, path: node.path, status: 'BODY_REWRITTEN' };
  }
}
