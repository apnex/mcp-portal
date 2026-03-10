import { expect } from 'chai';
import { MarkdownCompiler } from '../../ois-sdk/src/MarkdownCompiler.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_ROOT = path.resolve(__dirname, '../../../org');

describe('L3 Gatekeeper: Native Documentation Upgrades', function() {
  let compiler;
  let mockGraph;
  let testUid = "KMS-GENERIC-TEST-001";
  let targetFile = path.join(REGISTRY_ROOT, 'gov/KMS-GENERIC-TEST-001.md');

  before(function() {
    compiler = new MarkdownCompiler(REGISTRY_ROOT);
    mockGraph = new Map();
    mockGraph.set('KMS-GOV-ROOT', { path: path.join(REGISTRY_ROOT, 'gov/KMS-GOV-ROOT.md') });
  });

  after(function() {
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
  });

  it('must compile generic structural artifacts dynamically', async function() {
    const payload = {
        uid: testUid,
        title: "Test Generic Artifact",
        h_plane_up: "KMS-GOV-ROOT",
        tags: ["test", "generic"],
        sections: [
            { heading: "1. Overview", body: "This is a test." },
            { heading: "2. List", body: ["Item A", "Item B"] }
        ]
    };

    const result = await compiler.compileAndWriteGenericArtifact(payload, mockGraph);
    expect(result.status).to.equal('SUCCESS');

    const fileContent = fs.readFileSync(targetFile, 'utf8');
    
    // Verify YAML
    expect(fileContent).to.include('artifact-uid: KMS-GENERIC-TEST-001');
    expect(fileContent).to.include('tags:\n  - test\n  - generic');
    
    // Verify Content
    expect(fileContent).to.include('## 1. Overview\nThis is a test.');
    expect(fileContent).to.include('## 2. List\n- Item A\n- Item B');
  });

  it('must non-destructively append new sections to existing artifacts', async function() {
      // Create a mock node representing the file we just built
      mockGraph.set(testUid, { path: targetFile });

      const result = await compiler.appendArtifactSection(testUid, '3. New Section', 'Appended body.', mockGraph);
      expect(result.status).to.equal('APPENDED');

      const fileContent = fs.readFileSync(targetFile, 'utf8');
      
      // Ensure the boundary was preserved and text was injected ABOVE it
      expect(fileContent).to.include('## 3. New Section\nAppended body.\n\n---\n🛡️ **[DLR_AUD_ARTIFACT]**');
  });

  it('must safely mutate YAML metadata without touching the body', async function() {
      const result = await compiler.updateArtifactMetadata(testUid, { h_plane_up: 'KMS-ROOT', status: 'DEPRECATED' }, mockGraph);
      expect(result.status).to.equal('METADATA_UPDATED');

      const fileContent = fs.readFileSync(targetFile, 'utf8');
      
      // Verify YAML changed
      expect(fileContent).to.include('h-plane-up: KMS-ROOT');
      expect(fileContent).to.include('status: DEPRECATED');
      
      // Verify the old tag survived because it wasn't overwritten
      expect(fileContent).to.include('tags:\n  - test\n  - generic');
      
      // Verify body survived
      expect(fileContent).to.include('## 1. Overview');
  });
});
