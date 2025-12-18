import { z } from "zod";
import { FastMCP } from "fastmcp";
import { footballData, oddsApi } from "../services/context.js";

export const registerOddsTool = (server: FastMCP) => {
  server.addTool({
    name: "odds_prematch",
      description: "Quote pre-match (1X2, Over/Under 2.5, BTTS) normalizzate con lista bookmaker.",
      parameters: z.object({
        match_id: z.number().describe("Fixture id di Football-Data.org"),
      }),
        execute: async (args) => {
          const fixture = await footballData.getFixture(args.match_id);
          if (!fixture) {
            throw new Error(`Fixture ${args.match_id} non trovata su Football-Data.org`);
          }
      const odds = await oddsApi.getMarketOddsForFixture(fixture);
      return JSON.stringify(
        {
          match: fixture,
          markets: odds,
        },
        null,
        2,
      );
    },
  });
};
