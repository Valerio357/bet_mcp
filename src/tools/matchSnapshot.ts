import { z } from "zod";
import { FastMCP } from "fastmcp";
import { buildMatchSnapshot } from "../services/matchSnapshot.js";

export const registerMatchSnapshotTool = (server: FastMCP) => {
  server.addTool({
    name: "match_snapshot",
      description: "Restituisce forma, classifica, gol fatti/subiti e ultimi risultati per il match richiesto.",
      parameters: z.object({
        match_id: z.number().int().describe("match_id fornito da OpenLigaDB"),
      }),
    execute: async (args) => {
      const snapshot = await buildMatchSnapshot(args.match_id);
      return JSON.stringify(snapshot, null, 2);
    },
  });
};
