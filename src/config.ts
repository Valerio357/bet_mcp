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
  footballData: {
    token: requireEnv("FOOTBALL_DATA_TOKEN"),
    baseUrl: process.env.FOOTBALL_DATA_BASE_URL ?? "https://api.football-data.org/v4",
    competition: process.env.FOOTBALL_DATA_COMPETITION ?? "SA",
    season: process.env.FOOTBALL_DATA_SEASON ?? String(new Date().getFullYear()),
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
