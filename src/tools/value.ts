import { z } from "zod";
import { FastMCP } from "fastmcp";
import { detectValue } from "../services/valueDetector.js";

export const registerValueTool = (server: FastMCP) => {
  server.addTool({
    name: "value_detect",
    description: "Confronta quote mercato vs fair per trovare fino a 3 value pick (edge >= 5%).",
      parameters: z.object({
        match_id: z.number().describe("Fixture id (Football-Data.org)"),
      }),
    execute: async (args) => {
      const payload = await detectValue(args.match_id);
      return JSON.stringify(payload, null, 2);
    },
  });
};
