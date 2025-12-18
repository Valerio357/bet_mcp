import { OpenLigaDBClient } from "../clients/openLigaDB.js";
import { OddsApiClient } from "../clients/oddsApi.js";

export const openLiga = new OpenLigaDBClient();
export const oddsApi = new OddsApiClient();
