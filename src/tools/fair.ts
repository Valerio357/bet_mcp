import { z } from "zod";
import { FastMCP } from "fastmcp";
import { buildMatchSnapshot } from "../services/matchSnapshot.js";
import { computeFairOddsFromSnapshot } from "../services/fairOddsEngine.js";

export const registerFairTool = (server: FastMCP) => {
  server.addTool({
    name: "fair.compute",
    description: "Calcola probabilità e quote fair (Poisson semplice) per 1X2 / OU 2.5 / BTTS.",
      parameters: z.object({
        match_id: z.number().describe("Fixture id da OpenLigaDB"),
      }),
    execute: async (args) => {
      const snapshot = await buildMatchSnapshot(args.match_id);
      const fair = computeFairOddsFromSnapshot(snapshot);
      return JSON.stringify({ snapshot, fair }, null, 2);
    },
  });
};
