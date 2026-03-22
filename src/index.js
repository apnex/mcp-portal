import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from 'express';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import yaml from 'yaml';
import path from 'path';
import { fileURLToPath } from 'url';

import { GraphEngine } from './sdk/GraphEngine.js';
import { OisLoader } from './sdk/OisLoader.js';
import { PathingEngine } from './sdk/PathingEngine.js';
import { TopologyEngine } from './sdk/TopologyEngine.js';
import { MarkdownCompiler } from './sdk/MarkdownCompiler.js';
import { TagEngine } from "./sdk/TagEngine.js";
import { MetabolismEngine } from "./sdk/MetabolismEngine.js";
import { AnchorManager } from "./sdk/AnchorManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_ROOT = process.env.OIS_ROOT_PATH || path.resolve(__dirname, '../../../org');
const STORAGE_ROOT = process.env.OIS_STORAGE_PATH || path.resolve(__dirname, '../storage/anchors');

async function main() {
  const engine = new GraphEngine();
  const loader = new OisLoader(REGISTRY_ROOT, engine);
  await loader.hydrateEngine();
  
  const pather = new PathingEngine(engine);
  const topologyEngine = new TopologyEngine(engine, pather);
  const anchorManager = new AnchorManager(STORAGE_ROOT);
  const metabolismEngine = new MetabolismEngine(engine, anchorManager, pather);
  const compiler = new MarkdownCompiler(REGISTRY_ROOT);
  const tagEngine = new TagEngine(REGISTRY_ROOT);

  // Periodic Cleanup
  setInterval(() => anchorManager.prune(), 60 * 60 * 1000); // Every hour

  const server = new Server(
    { name: "ois-gateway", version: "7.0.0" },
    { capabilities: { resources: {}, tools: {} }, }
  );

  // --- DECLARATIVE FILTERS ---
  const collectionFilters = {
    nodes:      (n) => true,
    roles:      (n) => n.uid.startsWith('ROLE-'),
    axioms:     (n) => n.metadata?.tags?.includes('axiom'),
    protocols:  (n) => n.metadata?.tags?.includes('protocol'),
    charters:   (n) => n.uid.includes('-CHARTER'),
    blueprints: (n) => n.uid.startsWith('KMS-BP-'),
    skills:     (n) => n.uid.startsWith('SKL-'),
    missions:   (n) => n.uid.startsWith('MSN-') || n.uid.startsWith('KMS-MSN-')
  };

  // --- RESOURCES ---
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = [];
    const primitives = ['nodes', 'roles', 'axioms', 'protocols', 'charters', 'blueprints', 'skills', 'missions', 'health'];
    for (const p of primitives) {
        resources.push({ uri: `ois://network/${p}`, name: `Collection: ${p}`, mimeType: "application/x-yaml", description: `Returns all ${p}.` });
    }
    resources.push({ uri: `ois://node/KMS-ROOT`, name: `OIS Root Node`, mimeType: "application/x-yaml" });
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    if (uri.startsWith('ois://network/')) {
        const parts = uri.replace('ois://network/', '').split('/');
        const collectionType = parts[0];
        const statusFilter = parts[1] || 'active';
        let nodes = Array.from(engine.nodes.values());

        if (statusFilter !== 'all') {
            nodes = nodes.filter(n => n.metadata.status && n.metadata.status.toUpperCase() === statusFilter.toUpperCase());
        }

        const filterFn = collectionFilters[collectionType];
        if (!filterFn) throw new Error(`Unknown collection: ${collectionType}`);

        const uids = nodes.filter(filterFn).map(n => n.uid);
        return { contents: [{ uri, mimeType: "application/x-yaml", text: "```yaml\n" + yaml.stringify({ [collectionType]: uids }) + "\n```" }] };
    }
    if (uri.startsWith('ois://node/')) {
      const uid = uri.replace('ois://node/', '').split('/')[0];
      const node = engine.getNode(uid);
      if (!node) throw new Error(`Node not found: ${uid}`);
      return { contents: [{ uri, mimeType: "application/x-yaml", text: "```yaml\n" + yaml.stringify({ metadata: node.metadata, content: node.content }) + "\n```" }] };
    }
    throw new Error(`URI not recognized: ${uri}`);
  });

  // --- TOOLS ---
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "query_graph",
          description: "The universal world-unfolding metabolism engine. Supports Sovereign Anchors, Information Biomes, and Frustum Slicing.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "The 8-character Anchor ID from a previous pulse. If provided, all other parameters are ignored." },
              src_uid: { type: "string", description: "The UID to start unfolding from (Topological Walk)." },
              frustum: {
                  type: "object",
                  description: "Spatial slice parameters (Bypasses links).",
                  properties: {
                      y: { type: "integer", description: "Filter by Hierarchical Depth." },
                      z: { type: "integer", description: "Filter by Sector (0:Core, 1:Gov, 2:Eng, 3:Projects)." },
                      y_range: { type: "array", items: { type: "integer" }, minItems: 2, maxItems: 2 },
                      x_range: { type: "array", items: { type: "integer" }, minItems: 2, maxItems: 2 }
                  }
              },
              lod: { type: "integer", enum: [0, 1, 2], description: "Level of Detail. 0: Discovery (UID:Vector), 1: Outline (Metadata), 2: Mastery (Full Content). Defaults to 0 or 2 based on hydrate flag." },
              depth: { type: "integer", description: "Maximum hops from origin. Defaults to 99." },
              limit: { type: "integer", description: "Maximum nodes to yield per pulse. Defaults to 50 for LOD 1/2. If LOD is 0, defaults to -1 (Infinite) to allow full structural sweeps in one pulse." },
              planes: { type: "object", description: "Boolean matrix for plane traversal (h_up, h_down, t_out, s_zone)." },              hydrate: { type: "boolean", description: "Legacy trigger for LOD 2. Use 'lod' for finer control." },
              raw_text: { type: "boolean", description: "If true, returns raw Markdown in LOD 2." },
              stream: { type: "boolean", description: "If true, returns results as a single flat string to bypass platform object limits." }
            }
          }
        },
        { name: "inspect_socket_topology", description: "Returns the hydrated list of UIDs for a Role.", inputSchema: { type: "object", properties: { role_id: { type: "string" } }, required: ["role_id"] } },
        { name: "socket_persona", description: "Sockets the agent into a Role Persona, returning full context.", inputSchema: { type: "object", properties: { role_id: { type: "string" } }, required: ["role_id"] } },
        { name: "submit_axiom", description: "Propose a new Axiom.", inputSchema: { type: "object", properties: { title: { type: "string" }, mandate: { type: "string" }, mechanics: { type: "array", items: { type: "string" } }, rationale: { type: "string" }, system_consequences: { type: "array", items: { type: "string" } } }, required: ["title", "mandate", "mechanics", "rationale", "system_consequences"] } },
        { name: "submit_role_spec", description: "Define a new Role Spec.", inputSchema: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, entity_class: { type: "string" }, hierarchy_level: { type: "string" }, tags: { type: "array", items: { type: "string" } }, clearance: { type: "string" }, mission: { type: "string" }, pillars: { type: "array", items: { type: "string" } }, technical_duties: { type: "array", items: { type: "string" } }, constraints: { type: "array", items: { type: "string" } }, h_plane_up: { type: "string" } }, required: ["id", "title", "entity_class", "hierarchy_level", "tags", "clearance", "mission", "pillars", "technical_duties", "constraints", "h_plane_up"] } },
        { name: "submit_protocol", description: "Define a new Protocol.", inputSchema: { type: "object", properties: { title: { type: "string" }, steps: { type: "array", items: { type: "object", properties: { action: { type: "string" }, description: { type: "string" } }, required: ["action", "description"] } } }, required: ["title", "steps"] } },
        { name: "submit_generic_artifact", description: "Define a new generic artifact.", inputSchema: { type: "object", properties: { uid: { type: "string" }, title: { type: "string" }, tags: { type: "array", items: { type: "string" } }, h_plane_up: { type: "string" }, sections: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, body: { type: "string" } }, required: ["heading", "body"] } } }, required: ["uid", "title", "tags", "h_plane_up", "sections"] } },
        { name: "update_artifact_field", description: "Surgically overwrite a Markdown section.", inputSchema: { type: "object", properties: { uid: { type: "string" }, field: { type: "string" }, new_content: { type: "array", items: { type: "string" } } }, required: ["uid", "field", "new_content"] } },
        { name: "append_artifact_section", description: "Inject new blocks into an artifact.", inputSchema: { type: "object", properties: { uid: { type: "string" }, heading: { type: "string" }, body: { type: "string" } }, required: ["uid", "heading", "body"] } },
        { name: "update_artifact_metadata", description: "Alter topological graph routing.", inputSchema: { type: "object", properties: { uid: { type: "string" }, h_plane_up: { type: "string" }, tags: { type: "array", items: { type: "string" } }, status: { type: "string" } }, required: ["uid"] } },
        { name: "rewrite_artifact_body", description: "Overwrites the prose body of a document.", inputSchema: { type: "object", properties: { uid: { type: "string" }, raw_markdown_body: { type: "string" } }, required: ["uid", "raw_markdown_body"] } },
        { name: "list_resources", description: "Discovery beacon.", inputSchema: { type: "object", properties: { collection_type: { type: "string", enum: ["nodes", "roles", "axioms", "protocols", "charters", "blueprints", "skills", "missions", "health"] }, status_filter: { type: "string" } }, required: ["collection_type"] } },
        { name: "tag_manager", description: "S-Plane Lexicon Manager.", inputSchema: { type: "object", properties: { action: { type: "string", enum: ["list", "propose"] }, tag: { type: "string" }, definition: { type: "string" } }, required: ["action"] } }
      ]
    };
  });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "query_graph") {
        const { src_uid, dst_uid, depth, planes, hydrate, raw_text, token, frustum, lod, stream, limit } = request.params.arguments;
        let queryIntent;

        // 1. Resolve State (Initial vs Resume)
        if (token) {
            queryIntent = anchorManager.getAnchor(token);
            if (!queryIntent) throw new Error(`Anchor ${token} not found or expired.`);
        } else {
            if (!src_uid && !frustum) throw new Error("src_uid or frustum required for initial query_graph");
            
            const type = dst_uid ? "ROUTE" : (frustum ? "SPATIAL" : "SCAN");
            
            queryIntent = {
                kind: "query",
                metadata: { version: "2.1.0", status: "ACTIVE", type },
                spec: {
                    src_uid,
                    dst_uid,
                    frustum,
                    lod: lod !== undefined ? lod : (hydrate ? 2 : 0),
                    depth: depth || 99,
                    limit: limit,
                    planes: planes || { h_down: true, h_up: true, t_out: true, s_zone: true },
                    hydrate: !!hydrate,
                    raw_text: !!raw_text
                }
            };

            // For ROUTE mode, we pre-calculate the path
            if (type === "ROUTE") {
                const pathNodes = pather.findPath(src_uid, dst_uid, queryIntent.spec.planes);
                if (pathNodes.length === 0) {
                    return { content: [{ type: "text", text: "```yaml\nstatus: BLOCKED\n```" }] };
                }
                queryIntent.state = {
                    queue: pathNodes, // pathNodes are already {uid, depth, cost}
                    visited_uids: [],
                    yield_count: 0
                };
            }
        }

        const { nodes, next_anchor, status } = metabolismEngine.pulse(queryIntent);
        
        // Return stream format
        if (stream) {
            let output = `STATUS: ${status}\n`;
            if (next_anchor) output += `NEXT_TOKEN: ${next_anchor}\n`;
            output += "========================================\n";
            for (const node of nodes) {
                const scs = engine.resolveSCS(node.uid);
                const content = queryIntent.spec.raw_text ? node.rawBody : (queryIntent.spec.lod === 1 ? node.metadata : node.content);
                output += `[[UID: ${node.uid}]] SCS: [${scs.join(',')}]\n${typeof content === 'string' ? content : JSON.stringify(content, null, 2)}\n`;
                output += "========================================\n";
            }
            return { content: [{ type: "text", text: output }] };
        }

        // Standard Additive Response
        const response = {
            status,
            next_token: next_anchor,
            result: {}
        };

        for (const node of nodes) {
            const scs = engine.resolveSCS(node.uid);
            if (queryIntent.spec.lod === 0) {
                response.result[node.uid] = scs;
            } else {
                const entry = { scs };
                if (queryIntent.spec.lod >= 1) entry.metadata = node.metadata;
                if (queryIntent.spec.lod >= 2) {
                    if (queryIntent.spec.raw_text) entry.rawBody = node.rawBody;
                    else entry.content = node.content;
                }
                response.result[node.uid] = entry;
            }
        }

        return { content: [{ type: "text", text: "```yaml\n" + yaml.stringify(response) + "\n```" }] };
    }

    if (request.params.name === "inspect_socket_topology") {
        const queryIntent = topologyEngine.computePersonaTopology(request.params.arguments.role_id);
        return { content: [{ type: "text", text: "```yaml\n" + yaml.stringify(queryIntent) + "\n```" }] };
    }

    if (request.params.name === "socket_persona") {
        const queryIntent = topologyEngine.computePersonaTopology(request.params.arguments.role_id);
        const { nodes, next_anchor, status } = metabolismEngine.pulse(queryIntent);
        
        const response = {
            status,
            next_token: next_anchor,
            result: {}
        };

        for (const node of nodes) {
            const scs = engine.resolveSCS(node.uid);
            const entry = { scs };
            if (queryIntent.spec.lod >= 1) entry.metadata = node.metadata;
            if (queryIntent.spec.lod >= 2) {
                if (queryIntent.spec.raw_text) entry.rawBody = node.rawBody;
                else entry.content = node.content;
            }
            response.result[node.uid] = entry;
        }

        return { content: [{ type: "text", text: "```yaml\n" + yaml.stringify(response) + "\n```" }] };
    }
    
    if (request.params.name === "submit_axiom") {
        const result = await compiler.compileAndWriteAxiom(request.params.arguments, engine.nodes);
        await loader.hydrateEngine(); 
        return { content: [{ type: "text", text: "Successfully compiled.\n\n```yaml\n" + yaml.stringify(result) + "\n```" }] };
    }
    if (request.params.name === "submit_role_spec") {
        const result = await compiler.compileAndWriteRoleSpec(request.params.arguments, engine.nodes);
        await loader.hydrateEngine(); 
        return { content: [{ type: "text", text: "Successfully compiled Role Spec.\n\n```yaml\n" + yaml.stringify(result) + "\n```" }] };
    }
    if (request.params.name === "submit_protocol") {
        const result = await compiler.compileAndWriteProtocol(request.params.arguments, engine.nodes);
        await loader.hydrateEngine(); 
        return { content: [{ type: "text", text: "Successfully compiled Protocol.\n\n```yaml\n" + yaml.stringify(result) + "\n```" }] };
    }
    if (request.params.name === "submit_generic_artifact") {
        const result = await compiler.compileAndWriteGenericArtifact(request.params.arguments, engine.nodes);
        await loader.hydrateEngine(); 
        return { content: [{ type: "text", text: "Successfully compiled.\n\n```yaml\n" + yaml.stringify(result) + "\n```" }] };
    }
    if (request.params.name === "update_artifact_field") {
        const result = await compiler.updateArtifactField(request.params.arguments.uid, request.params.arguments.field, request.params.arguments.new_content, engine.nodes);
        await loader.hydrateEngine(); 
        return { content: [{ type: "text", text: "Successfully updated.\n\n```yaml\n" + yaml.stringify(result) + "\n```" }] };
    }
    if (request.params.name === "append_artifact_section") {
        const result = await compiler.appendArtifactSection(request.params.arguments.uid, request.params.arguments.heading, request.params.arguments.body, engine.nodes);
        await loader.hydrateEngine(); 
        return { content: [{ type: "text", text: "Successfully appended.\n\n```yaml\n" + yaml.stringify(result) + "\n```" }] };
    }
    if (request.params.name === "update_artifact_metadata") {
        const result = await compiler.updateArtifactMetadata(request.params.arguments.uid, request.params.arguments, engine.nodes);
        await loader.hydrateEngine(); 
        return { content: [{ type: "text", text: "Successfully updated metadata.\n\n```yaml\n" + yaml.stringify(result) + "\n```" }] };
    }
    if (request.params.name === "rewrite_artifact_body") {
        const result = await compiler.rewriteArtifactBody(request.params.arguments.uid, request.params.arguments.raw_markdown_body, engine.nodes);
        await loader.hydrateEngine(); 
        return { content: [{ type: "text", text: "Successfully rewritten body.\n\n```yaml\n" + yaml.stringify(result) + "\n```" }] };
    }

    if (request.params.name === "list_resources") {
        const { collection_type, status_filter } = request.params.arguments;
        const status = status_filter || "active";
        let nodes = Array.from(engine.nodes.values());
        if (status !== "all") nodes = nodes.filter(n => n.metadata.status && n.metadata.status.toUpperCase() === status.toUpperCase());

        const filterFn = collectionFilters[collection_type];
        if (!filterFn) throw new Error(`Unknown collection: ${collection_type}`);

        const uids = nodes.filter(filterFn).map(n => n.uid);
        return { content: [{ type: "text", text: "```yaml\n" + yaml.stringify({ [collection_type]: uids }) + "\n```" }] };
    }

    if (request.params.name === "tag_manager") {
        const { action, tag, definition } = request.params.arguments;
        if (action === "list") return { content: [{ type: "text", text: "```yaml\n" + yaml.stringify({ tags: tagEngine.listTags() }) + "\n```" }] };
        else if (action === "propose") {
            const result = tagEngine.proposeTag(tag, definition);
            return { content: [{ type: "text", text: "Successfully mutated the Tag Ledger.\n\n```yaml\n" + yaml.stringify(result) + "\n```" }] };
        }
    }

    throw new Error("Tool not found");
  });

  const app = express();
  let transport;

  app.get("/mcp/sse", async (req, res) => {
    if (transport) {
      try { await server.close(); } catch (e) {}
    }
    transport = new SSEServerTransport("/mcp/message", res);
    await server.connect(transport);
  });

  app.post("/mcp/message", async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(503).send("SSE connection not established");
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OIS Gateway] Daemon active. Listening on port ${PORT}`);
    console.log(`[OIS Gateway] SSE Endpoint: http://localhost:${PORT}/mcp/sse`);
  });
}

main().catch(console.error);
