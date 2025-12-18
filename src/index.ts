import "./config.js";
import { FastMCP } from "fastmcp";
import { registerFixturesTool } from "./tools/fixtures.js";
import { registerMatchSnapshotTool } from "./tools/matchSnapshot.js";
import { registerOddsTool } from "./tools/odds.js";
import { registerFairTool } from "./tools/fair.js";
import { registerValueTool } from "./tools/value.js";

const server = new FastMCP({
  name: "bet-mcp",
  version: "0.1.0",
  instructions:
    "Serie A pre-match toolkit: cerca fixtures, analizza forma/statistiche, normalizza quote multi-book e trova value pick basate su Poisson semplice.",
});

registerFixturesTool(server);
registerMatchSnapshotTool(server);
registerOddsTool(server);
registerFairTool(server);
registerValueTool(server);

const transport = process.env.MCP_TRANSPORT ?? "stdio";
const port = Number(process.env.PORT ?? 3333);

server
  .start(
    transport === "http"
      ? {
          transportType: "httpStream",
          httpStream: { port },
        }
      : { transportType: "stdio" },
  )
  .then(() => {
    console.log(`bet-mcp server ready via ${transport === "http" ? `http:${port}` : "stdio"}`);
  });
