import { expect } from 'chai';
import { GraphEngine } from '../../ois-sdk/src/GraphEngine.js';
import { OisLoader } from '../../ois-sdk/src/OisLoader.js';
import { PathingEngine } from '../../ois-sdk/src/PathingEngine.js';
import { TopologyEngine } from '../../ois-sdk/src/TopologyEngine.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_ROOT = path.resolve(__dirname, '../../../org');

describe('L2 Routing Engine: The Managed Switch (SDK Adapter)', function() {
  let engine;
  let pather;
  let topologyEngine;

  before(async function() {
    engine = new GraphEngine();
    const loader = new OisLoader(REGISTRY_ROOT, engine);
    await loader.hydrateEngine();
    pather = new PathingEngine(engine);
    topologyEngine = new TopologyEngine(engine, pather);
  });

  it('must compute the Persona Topology using the new TopologyEngine', function() {
    const roleId = 'ROLE-GOV-KA-ROOT';
    const topology = topologyEngine.computePersonaTopology(roleId);
    
    expect(topology.system_topology.ancestry_trace[0]).to.equal('KMS-ROOT'); 
    expect(topology.system_topology.ancestry_trace[2]).to.equal('ROLE-GOV-KA-ROOT'); 

    expect(topology.cultural_context_uids).to.include('KMS-ROOT-HD'); 
    expect(topology.actionable_context_uids).to.include('KMS-GOV-PROTOCOL-INGESTION');
  });

  it('must expose inspect_socket_topology natively', async function() {
      const fs = await import('fs').then(m => m.default);
      const indexCode = fs.readFileSync(path.resolve(__dirname, '../src/index.js'), 'utf8');
      expect(indexCode).to.include('name: "inspect_socket_topology"');
  });
});
