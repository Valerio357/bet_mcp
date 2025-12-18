import dotenv from "dotenv";

dotenv.config();

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  apiFootball: {
    key: requireEnv("APIFOOTBALL_KEY"),
    leagueId: Number(process.env.APIFOOTBALL_LEAGUE_ID ?? 135),
    season: Number(process.env.APIFOOTBALL_SEASON ?? new Date().getFullYear()),
  },
  oddsApi: {
    key: requireEnv("ODDS_API_KEY"),
    region: process.env.ODDS_API_REGION ?? "eu",
    sport: process.env.ODDS_API_SPORT ?? "soccer_italy_serie_a",
    markets: process.env.ODDS_API_MARKETS ?? "h2h,totals,btts",
  },
  modeling: {
    homeAdvantage: Number(process.env.HOME_ADVANTAGE_FACTOR ?? 1.08),
  },
  cache: {
    ttlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 120),
  },
};
