import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";
import { FixtureSummary, RecentMatchSummary, TeamSummary } from "../types.js";
import { MemoryCache } from "../utils/cache.js";

const BASE_URL = "https://v3.football.api-sports.io";

interface ApiResponse<T> {
  response: T;
  errors?: Record<string, string>;
}

type FixtureResponse = ApiResponse<FixturePayload[]>;
type StandingsResponse = ApiResponse<StandingsPayload[]>;
type TeamStatsResponse = ApiResponse<TeamStatsPayload>;

type FixturePayload = {
  fixture: {
    id: number;
    date: string;
    venue?: { name?: string | null } | null;
  };
  league: { id: number; season: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

type StandingsPayload = {
  league: {
    standings: Array<
      Array<{
        team: { id: number; name: string };
        rank: number;
        points: number;
        form?: string;
      }>
    >;
  };
};

type TeamStatsPayload = {
  team: { id: number; name: string };
  league: { fixtures: { played: { total: number } } };
  goals: {
    for: { average: { total: string } };
    against: { average: { total: string } };
  };
};

export interface TeamStatistics {
  avgGoalsFor: number;
  avgGoalsAgainst: number;
}

export class ApiFootballClient {
  private readonly http: AxiosInstance;
  private readonly cache = new MemoryCache<any>(config.cache.ttlSeconds);

  constructor() {
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: {
        "x-apisports-key": config.apiFootball.key,
      },
    });
  }

  public async getUpcomingFixtures(days: number): Promise<FixtureSummary[]> {
    const now = new Date();
    const from = toIsoDate(now);
    const to = new Date(now);
    to.setDate(now.getDate() + days);

    const params = {
      league: config.apiFootball.leagueId,
      season: config.apiFootball.season,
      from: from,
      to: toIsoDate(to),
    };

    const data = await this.get<FixtureResponse>("/fixtures", params);
    return data.response.map(mapFixtureSummary);
  }

  public async getFixture(matchId: number): Promise<FixtureSummary | undefined> {
    const data = await this.get<FixtureResponse>("/fixtures", { id: matchId });
    const fixture = data.response.at(0);
    return fixture ? mapFixtureSummary(fixture) : undefined;
  }

  public async getStandingsMap(): Promise<Map<number, { position: number; points: number; form?: string }>> {
    const cached = this.cache.get("standings");
    if (cached) return cached;

    const data = await this.get<StandingsResponse>("/standings", {
      league: config.apiFootball.leagueId,
      season: config.apiFootball.season,
    });

    const table = new Map<number, { position: number; points: number; form?: string }>();
    const group = data.response.at(0)?.league.standings.at(0) ?? [];
    group.forEach((entry) => {
      table.set(entry.team.id, {
        position: entry.rank,
        points: entry.points,
        form: entry.form ?? undefined,
      });
    });

    this.cache.set("standings", table);
    return table;
  }

  public async getTeamStatistics(teamId: number): Promise<TeamStatistics | undefined> {
    const cacheKey = `stats:${teamId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const params = {
      team: teamId,
      league: config.apiFootball.leagueId,
      season: config.apiFootball.season,
    };

    const data = await this.get<TeamStatsResponse>("/teams/statistics", params);
    const payload = data.response;
    if (!payload) return undefined;

    const stats = {
      avgGoalsFor: Number(payload.goals.for.average.total ?? 0),
      avgGoalsAgainst: Number(payload.goals.against.average.total ?? 0),
    };

    this.cache.set(cacheKey, stats);
    return stats;
  }

  public async getRecentMatches(teamId: number, limit = 5): Promise<RecentMatchSummary[]> {
    const data = await this.get<FixtureResponse>("/fixtures", {
      team: teamId,
      season: config.apiFootball.season,
      last: limit,
    });

    return data.response.map((fixture) => {
      const home = fixture.teams.home.name;
      const away = fixture.teams.away.name;
      const homeScore = fixture.goals.home ?? 0;
      const awayScore = fixture.goals.away ?? 0;
      const isHome = fixture.teams.home.id === teamId;
      const result = homeScore === awayScore ? "DRAW" : (isHome ? (homeScore > awayScore ? "WIN" : "LOSS") : (awayScore > homeScore ? "WIN" : "LOSS"));

      const score = `${homeScore}-${awayScore}`;
      return {
        id: fixture.fixture.id,
        dateUtc: fixture.fixture.date,
        home,
        away,
        score,
        result,
      };
    });
  }

  private async get<T>(path: string, params: Record<string, any>): Promise<T> {
    try {
      const res = await this.http.get<T>(path, { params });
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API-Football request failed: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }
}

const mapFixtureSummary = (fixture: FixturePayload): FixtureSummary => ({
  matchId: fixture.fixture.id,
  leagueId: fixture.league.id,
  season: fixture.league.season,
  kickoffUtc: fixture.fixture.date,
  venue: fixture.fixture.venue?.name ?? null,
  homeTeam: mapTeam(fixture.teams.home),
  awayTeam: mapTeam(fixture.teams.away),
});

const mapTeam = (team: { id: number; name: string }): TeamSummary => ({
  id: team.id,
  name: team.name,
});

const toIsoDate = (date: Date): string => date.toISOString().split("T")[0];
