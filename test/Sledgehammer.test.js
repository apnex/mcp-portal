import { expect } from 'chai';
import { MarkdownCompiler } from '../src/sdk/MarkdownCompiler.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_ROOT = path.resolve(__dirname, '../../../org');

describe('L3 Gatekeeper: The Sledgehammer', function() {
  let compiler;
  let mockGraph;
  let testUid = "KMS-REWRITE-TEST-001";
  let targetFile = path.join(REGISTRY_ROOT, 'gov/KMS-REWRITE-TEST-001.md');

  before(function() {
    compiler = new MarkdownCompiler(REGISTRY_ROOT);
    mockGraph = new Map();
    mockGraph.set('KMS-GOV-ROOT', { path: path.join(REGISTRY_ROOT, 'gov/KMS-GOV-ROOT.md') });
    
    // Seed a physical file for testing
    const initialMarkdown = `# Initial Title\n\n---\nartifact-uid: ${testUid}\ntags:\n  - test\n---\n\n## 1. Old Prose\nThis is old.\n\n---\n🛡️ **[DLR_AUD_ARTIFACT]** Initial Seal.`;
    fs.writeFileSync(targetFile, initialMarkdown, 'utf8');
    
    mockGraph.set(testUid, { path: targetFile });
  });

  after(function() {
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
  });

  it('must perfectly replace the prose body while shielding the YAML and the Seal', async function() {
    const rawMarkdownBody = `## 1. New Overview\nThis is completely brand new text.\n\n### 1.1 Deep Thoughts\nIt is freeform.\n`;
    
    const result = await compiler.rewriteArtifactBody(testUid, rawMarkdownBody, mockGraph);
    expect(result.status).to.equal('BODY_REWRITTEN');

    const fileContent = fs.readFileSync(targetFile, 'utf8');
    
    // 1. Verify the Title Block survived
    expect(fileContent).to.include('# Initial Title\n\n');
    
    // 2. Verify the YAML Shield worked
    expect(fileContent).to.include('---\nartifact-uid: KMS-REWRITE-TEST-001\ntags:\n  - test\n---\n\n');
    
    // 3. Verify the new body was injected
    expect(fileContent).to.include('## 1. New Overview\nThis is completely brand new text.');
    
    // 4. Verify the old body is completely gone
    expect(fileContent).to.not.include('This is old.');
    
    // 5. Verify the Security Seal survived at the absolute bottom
    expect(fileContent).to.include('\n---\n🛡️ **[DLR_AUD_ARTIFACT]** Initial Seal.');
  });
});
