import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";
import { FixtureSummary, RecentMatchSummary, TeamSummary } from "../types.js";
import { MemoryCache } from "../utils/cache.js";

interface MatchesResponse {
  matches: FootballMatch[];
  competition: {
    code: string;
    id: number;
    name: string;
  };
}

interface FootballMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number;
  venue?: string | null;
  homeTeam: FootballTeam;
  awayTeam: FootballTeam;
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
}

interface FootballTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
}

interface StandingsResponse {
  standings: Array<{
    table: Array<{
      team: FootballTeam;
      position: number;
      points: number;
      form?: string;
    }>;
  }>;
}

interface TeamMatchesResponse {
  matches: FootballMatch[];
}

export interface TeamStatistics {
  avgGoalsFor: number;
  avgGoalsAgainst: number;
}

export class FootballDataClient {
  private readonly http: AxiosInstance;
  private readonly cache = new MemoryCache<any>(config.cache.ttlSeconds);

  constructor() {
    this.http = axios.create({
      baseURL: config.footballData.baseUrl,
      headers: {
        "X-Auth-Token": config.footballData.token,
      },
    });
  }

  public async getUpcomingFixtures(days: number): Promise<FixtureSummary[]> {
    const matches = await this.fetchSeasonMatches();
    const now = Date.now();
    const horizon = now + days * 24 * 60 * 60 * 1000;

    return matches
      .filter((match) => match.utcDate)
      .filter((match) => {
        const kickoff = Date.parse(match.utcDate);
        return kickoff >= now && kickoff <= horizon && match.status !== "FINISHED";
      })
      .sort((a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate))
      .map(mapFixtureSummary);
  }

  public async getFixture(matchId: number): Promise<FixtureSummary | undefined> {
    const matches = await this.fetchSeasonMatches();
    const match = matches.find((item) => item.id === matchId);
    return match ? mapFixtureSummary(match) : undefined;
  }

  public async getStandingsMap(): Promise<Map<number, { position: number; points: number; form?: string }>> {
    const cacheKey = this.getCacheKey("standings");
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const res = await this.http.get<StandingsResponse>(
      `/competitions/${config.footballData.competition}/standings`,
      {
        params: {
          season: config.footballData.season,
        },
      },
    );

    const tableMap = new Map<number, { position: number; points: number; form?: string }>();
    const table = res.data.standings.find((standing) => standing.table.length)?.table ?? [];
    table.forEach((row) => {
      tableMap.set(row.team.id, {
        position: row.position,
        points: row.points,
        form: row.form,
      });
    });

    this.cache.set(cacheKey, tableMap);
    return tableMap;
  }

  public async getTeamStatistics(teamId: number): Promise<TeamStatistics | undefined> {
    const cacheKey = this.getCacheKey(`stats:${teamId}`);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const matches = await this.fetchTeamMatches(teamId);
    let played = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    matches.forEach((match) => {
      if (match.status !== "FINISHED") return;
      played += 1;
      const homeScore = match.score.fullTime.home ?? 0;
      const awayScore = match.score.fullTime.away ?? 0;
      if (match.homeTeam.id === teamId) {
        goalsFor += homeScore;
        goalsAgainst += awayScore;
      } else {
        goalsFor += awayScore;
        goalsAgainst += homeScore;
      }
    });

    if (!played) return undefined;
    const stats = {
      avgGoalsFor: goalsFor / played,
      avgGoalsAgainst: goalsAgainst / played,
    } satisfies TeamStatistics;

    this.cache.set(cacheKey, stats);
    return stats;
  }

  public async getRecentMatches(teamId: number, limit = 5): Promise<RecentMatchSummary[]> {
    const matches = await this.fetchTeamMatches(teamId);
    return matches
      .filter((match) => match.status === "FINISHED")
      .sort((a, b) => Date.parse(b.utcDate) - Date.parse(a.utcDate))
      .slice(0, limit)
      .map((match) => {
        const homeScore = match.score.fullTime.home ?? 0;
        const awayScore = match.score.fullTime.away ?? 0;
        const isHome = match.homeTeam.id === teamId;
        const result: RecentMatchSummary["result"] =
          homeScore === awayScore
            ? "DRAW"
            : isHome
              ? homeScore > awayScore
                ? "WIN"
                : "LOSS"
              : awayScore > homeScore
                ? "WIN"
                : "LOSS";
        return {
          id: match.id,
          dateUtc: match.utcDate,
          home: match.homeTeam.name,
          away: match.awayTeam.name,
          score: `${homeScore}-${awayScore}`,
          result,
        } satisfies RecentMatchSummary;
      });
  }

  private async fetchSeasonMatches(): Promise<FootballMatch[]> {
    const cacheKey = this.getCacheKey("season_matches");
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const res = await this.http.get<MatchesResponse>(
      `/competitions/${config.footballData.competition}/matches`,
      {
        params: {
          season: config.footballData.season,
        },
      },
    );

    this.cache.set(cacheKey, res.data.matches);
    return res.data.matches;
  }

  private async fetchTeamMatches(teamId: number): Promise<FootballMatch[]> {
    const cacheKey = this.getCacheKey(`team:${teamId}`);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const res = await this.http.get<TeamMatchesResponse>(
      `/teams/${teamId}/matches`,
      {
        params: {
          season: config.footballData.season,
          competitions: config.footballData.competition,
        },
      },
    );

    this.cache.set(cacheKey, res.data.matches);
    return res.data.matches;
  }

  private getCacheKey(suffix: string): string {
    return `${suffix}:${config.footballData.competition}:${config.footballData.season}`;
  }
}

const mapFixtureSummary = (match: FootballMatch): FixtureSummary => ({
  matchId: match.id,
  leagueId: 0,
  season: Number(config.footballData.season),
  kickoffUtc: match.utcDate,
  venue: match.venue ?? null,
  homeTeam: mapTeam(match.homeTeam),
  awayTeam: mapTeam(match.awayTeam),
});

const mapTeam = (team: FootballTeam): TeamSummary => ({
  id: team.id,
  name: team.name,
  shortName: team.shortName ?? team.tla ?? undefined,
});
