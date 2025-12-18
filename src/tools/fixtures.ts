import { z } from "zod";
import { FastMCP } from "fastmcp";
import { footballData } from "../services/context.js";

export const registerFixturesTool = (server: FastMCP) => {
  server.addTool({
    name: "fixtures_list",
      description: "Ritorna i prossimi match (Football-Data.org) entro X giorni (id, squadre, kickoff, venue).",
    parameters: z.object({
      days: z.number().int().min(1).max(10).default(3).describe("Numero di giorni in avanti da scandire"),
    }),
        execute: async (args) => {
          const fixtures = await footballData.getUpcomingFixtures(args.days ?? 3);
      return JSON.stringify(
        {
          window_days: args.days ?? 3,
          fixtures,
        },
        null,
        2,
      );
    },
  });
};
