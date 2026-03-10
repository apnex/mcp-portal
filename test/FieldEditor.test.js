import { expect } from 'chai';
import { MarkdownCompiler } from '../../ois-sdk/src/MarkdownCompiler.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_ROOT = path.resolve(__dirname, '../../../org');

describe('L3 Gatekeeper: Surgical Field Editor', function() {
  let compiler;
  let mockGraph;
  const testFileDir = path.join(REGISTRY_ROOT, 'gov/axioms');
  const testFilePath = path.join(testFileDir, 'KMS-META-099-TEST-EDIT.md');
  const testUid = 'KMS-META-099-TEST-EDIT';

  before(function() {
    compiler = new MarkdownCompiler(REGISTRY_ROOT);
    mockGraph = new Map();
    
    // Create a physical test file to edit
    const initialMarkdown = `# Axiom: Test Edit\n\n---\nartifact-uid: ${testUid}\n---\n\n## 1. The Mandate\n**"Original Mandate"**\n\n## 2. Mechanics\n* Mech 1\n\n---`;
    fs.writeFileSync(testFilePath, initialMarkdown, 'utf8');

    mockGraph.set(testUid, { path: testFilePath });
  });

  after(function() {
    if (fs.existsSync(testFilePath)) {
       fs.unlinkSync(testFilePath);
    }
  });

  it('must surgically replace an array under a specific markdown heading', async function() {
    const newMechanics = ["New Mech 1", "New Mech 2"];
    const result = await compiler.updateArtifactField(testUid, 'Mechanics', newMechanics, mockGraph);
    
    expect(result.status).to.equal('UPDATED');

    const updatedContent = fs.readFileSync(testFilePath, 'utf8');
    
    // Check that the mechanics were replaced
    expect(updatedContent).to.include('- New Mech 1\n- New Mech 2');
    expect(updatedContent).to.not.include('* Mech 1');
    
    // Check that the rest of the file was NOT touched
    expect(updatedContent).to.include('**"Original Mandate"**');
  });
});
