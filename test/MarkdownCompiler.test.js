import { expect } from 'chai';
import { MarkdownCompiler } from '../src/sdk/MarkdownCompiler.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_ROOT = path.resolve(__dirname, '../../../org');

describe('L3 Gatekeeper: Markdown Compiler', function() {
  let compiler;
  let testPayload;
  let mockGraph;

  before(function() {
    compiler = new MarkdownCompiler(REGISTRY_ROOT);
    mockGraph = new Map();
    // Simulate 3 existing axioms to test UID generation padding. The new compiler filters on tags: ['axioms']
    mockGraph.set('KMS-META-010', { metadata: { tags: ['axioms'] }});
    mockGraph.set('KMS-META-020', { metadata: { tags: ['axioms'] }});
    mockGraph.set('KMS-META-030', { metadata: { tags: ['axioms'] }});

    testPayload = {
      title: "Test Axiom",
      mandate: "This is a test mandate.",
      mechanics: ["Mech A", "Mech B"],
      rationale: "Rationale test.",
      system_consequences: ["Fault A"]
    };
  });

  after(function() {
    const targetFile = path.join(REGISTRY_ROOT, 'gov/axioms/KMS-META-040-TEST-AXIOM.md');
    if (fs.existsSync(targetFile)) {
       fs.unlinkSync(targetFile);
    }
  });

  it('must deterministically generate valid KMS-META-XXX UIDs', async function() {
    const result = await compiler.compileAndWriteAxiom(testPayload, mockGraph);
    expect(result.uid).to.equal('KMS-META-040-TEST-AXIOM'); 
    expect(result.status).to.equal('SUCCESS');
  });

  it('must strictly enforce OIS Markdown formatting geometry', async function() {
    const targetFile = path.join(REGISTRY_ROOT, 'gov/axioms/KMS-META-040-TEST-AXIOM.md');
    expect(fs.existsSync(targetFile)).to.be.true;

    const fileContent = fs.readFileSync(targetFile, 'utf8');

    expect(fileContent).to.include('## 1. The Mandate');
    expect(fileContent).to.include('*   Mech A\n*   Mech B');
    expect(fileContent).to.include('---\nartifact-uid: KMS-META-040-TEST-AXIOM');
    
    // Verify NEW YAML format
    expect(fileContent).to.include('tags:\n  - axioms\n  - Internal');
    expect(fileContent).to.include("h-plane-up: KMS-GOV-AXIOM-CHARTER");
    
    expect(fileContent).to.include('🛡️ **[DLR_AUD_ARTIFACT]** KMS-META-040-TEST-AXIOM compiled via MCP Gatekeeper.');
  });
});
