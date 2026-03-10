import { expect } from 'chai';
import { GraphEngine } from '../../ois-sdk/src/GraphEngine.js';
import { OisLoader } from '../../ois-sdk/src/OisLoader.js';
import { PathingEngine } from '../../ois-sdk/src/PathingEngine.js';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_ROOT = path.resolve(__dirname, '../../../org');

describe('L1 Core: MCP Universal query_graph Tool (SDK Adapter)', function() {
  let engine;
  let pather;

  before(async function() {
    engine = new GraphEngine();
    const loader = new OisLoader(REGISTRY_ROOT, engine);
    await loader.hydrateEngine();
    pather = new PathingEngine(engine);
  });

  it('must handle boolean combinatorics via the new SDK architecture', async function() {
      const args = {
          src_uid: 'ROLE-GOV-KA-ROOT',
          dst_uid: 'KMS-ROOT',
          hydrate: true,
          reverse_delivery: true,
          planes: { h_up: true }
      };
      
      let pathNodes = pather.findPath(args.src_uid, args.dst_uid, args.planes);
      if (args.reverse_delivery) pathNodes.reverse();
      
      let hydratedData = {};
      for (const uid of pathNodes) {
          const node = engine.getNode(uid);
          hydratedData[uid] = node ? node.content : "Not Found";
      }
      
      const mcpResponseText = `\`\`\`yaml\n${yaml.stringify({ result: hydratedData })}\n\`\`\``;
      
      const rootIndex = mcpResponseText.indexOf('KMS-ROOT:');
      const roleIndex = mcpResponseText.indexOf('ROLE-GOV-KA-ROOT:');
      
      expect(rootIndex).to.be.lessThan(roleIndex);
      expect(mcpResponseText).to.include('mission:');
  });


});
