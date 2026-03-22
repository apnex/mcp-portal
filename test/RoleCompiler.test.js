import { expect } from 'chai';
import { MarkdownCompiler } from '../src/sdk/MarkdownCompiler.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_ROOT = path.resolve(__dirname, '../../../org');

describe('L3 Gatekeeper: Role Spec Compiler', function() {
  let compiler;
  let testPayload;

  before(function() {
    compiler = new MarkdownCompiler(REGISTRY_ROOT);
    testPayload = {
      id: "ROLE-ENG-TEST-EXPERT",
      title: "Test Expert",
      entity_class: "TE",
      hierarchy_level: "Specialist",
      tags: ["test"],
      clearance: "Level 1",
      mission: "To execute tests.",
      pillars: ["Pillar 1", "Pillar 2"],
      technical_duties: ["Duty A", "Duty B"],
      constraints: ["Constraint 1"],
      h_plane_up: "KMS-ENG-ROOT"
    };
  });

  after(function() {
    const targetFile = path.join(REGISTRY_ROOT, 'eng/roles/ROLE-ENG-TEST-EXPERT.md');
    if (fs.existsSync(targetFile)) {
       fs.unlinkSync(targetFile);
    }
  });

  it('must strictly enforce OIS Role Spec Markdown formatting geometry', async function() {
    const mockGraph = new Map();
    mockGraph.set('KMS-ENG-ROOT', { path: path.join(REGISTRY_ROOT, 'eng/roles/KMS-ENG-ROOT.md') });
    
    const result = await compiler.compileAndWriteRoleSpec(testPayload, mockGraph);
    expect(result.uid).to.equal('ROLE-ENG-TEST-EXPERT');
    expect(result.path).to.equal(path.join(REGISTRY_ROOT, 'eng/roles/ROLE-ENG-TEST-EXPERT.md'));

    const fileContent = fs.readFileSync(result.path, 'utf8');

    expect(fileContent).to.include('# Entity Role Spec: Test Expert (ROLE-ENG-TEST-EXPERT)');
    expect(fileContent).to.include('## 1. Metadata (Role Identity)');
    expect(fileContent).to.include('- **[D-01]** Duty A');
    
    // Verify NEW YAML format
    expect(fileContent).to.include('tags:\n  - test');
    expect(fileContent).to.include("h-plane-up: KMS-ENG-ROOT");
  });
});
