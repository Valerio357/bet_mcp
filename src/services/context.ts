import { FootballDataClient } from "../clients/footballData.js";
import { OddsApiClient } from "../clients/oddsApi.js";

export const footballData = new FootballDataClient();
export const oddsApi = new OddsApiClient();
