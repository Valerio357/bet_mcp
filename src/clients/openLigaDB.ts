import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";
import { FixtureSummary, RecentMatchSummary, TeamSummary } from "../types.js";
import { MemoryCache } from "../utils/cache.js";

type MatchPayload = {
  MatchID: number;
  MatchDateTime: string;
  MatchDateTimeUTC?: string;
  MatchIsFinished: boolean;
  LeagueId?: number;
  LeagueSeason?: string;
  Location?: { LocationStadium?: string | null } | null;
  Team1: TeamPayload;
  Team2: TeamPayload;
  MatchResults?: MatchResultPayload[];
  Goals?: GoalPayload[];
};

type TeamPayload = {
  TeamId: number;
  TeamName: string;
  ShortName?: string | null;
};

type MatchResultPayload = {
  ResultName?: string | null;
  ResultOrderID?: number;
  PointsTeam1?: number | null;
  PointsTeam2?: number | null;
};

type GoalPayload = {
  ScoreTeam1?: number | null;
  ScoreTeam2?: number | null;
};

type TableEntry = {
  TeamInfoId: number;
  Points: number;
  Rank: number;
};

type StandingsRow = {
  position: number;
  points: number;
};

export interface TeamStatistics {
  avgGoalsFor: number;
  avgGoalsAgainst: number;
}

export class OpenLigaDBClient {
  private readonly http: AxiosInstance;
  private readonly matchesCache = new MemoryCache<MatchPayload[]>(config.cache.ttlSeconds);
  private readonly standingsCache = new MemoryCache<Map<number, StandingsRow>>(config.cache.ttlSeconds);

  constructor() {
    this.http = axios.create({
      baseURL: config.openLiga.baseUrl,
    });
  }

  public async getUpcomingFixtures(days: number): Promise<FixtureSummary[]> {
    const matches = await this.getSeasonMatches();
    const now = Date.now();
    const horizon = now + days * 24 * 60 * 60 * 1000;

    return matches
      .filter((match) => {
        const kickoff = parseDate(match.MatchDateTimeUTC ?? match.MatchDateTime);
        if (!kickoff) return false;
        return kickoff >= now && kickoff <= horizon;
      })
      .sort((a, b) => {
        const ka = parseDate(a.MatchDateTimeUTC ?? a.MatchDateTime) ?? 0;
        const kb = parseDate(b.MatchDateTimeUTC ?? b.MatchDateTime) ?? 0;
        return ka - kb;
      })
      .map(mapFixtureSummary);
  }

  public async getFixture(matchId: number): Promise<FixtureSummary | undefined> {
    const match = (await this.getSeasonMatches()).find((item) => item.MatchID === matchId);
    return match ? mapFixtureSummary(match) : undefined;
  }

  public async getStandingsMap(): Promise<Map<number, StandingsRow>> {
    const cacheKey = this.getLeagueKey("table");
    const cached = this.standingsCache.get(cacheKey);
    if (cached) return cached;

    const res = await this.http.get<TableEntry[]>(
      `/gettable/${config.openLiga.leagueShortcut}/${config.openLiga.season}`,
    );
    const table = new Map<number, StandingsRow>();
    res.data.forEach((entry) => {
      table.set(entry.TeamInfoId, {
        position: entry.Rank,
        points: entry.Points,
      });
    });
    this.standingsCache.set(cacheKey, table);
    return table;
  }

  public async getTeamStatistics(teamId: number): Promise<TeamStatistics | undefined> {
    const matches = await this.getSeasonMatches();
    let played = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    matches.forEach((match) => {
      if (!match.MatchIsFinished) return;
      if (match.Team1.TeamId !== teamId && match.Team2.TeamId !== teamId) return;
      const score = extractFinalScore(match);
      if (!score) return;
      played += 1;
      if (match.Team1.TeamId === teamId) {
        goalsFor += score.home;
        goalsAgainst += score.away;
      } else {
        goalsFor += score.away;
        goalsAgainst += score.home;
      }
    });

    if (!played) return undefined;
    return {
      avgGoalsFor: goalsFor / played,
      avgGoalsAgainst: goalsAgainst / played,
    };
  }

  public async getRecentMatches(teamId: number, limit = 5): Promise<RecentMatchSummary[]> {
    const matches = await this.getSeasonMatches();
    return matches
      .filter((match) => match.MatchIsFinished && (match.Team1.TeamId === teamId || match.Team2.TeamId === teamId))
      .map((match) => {
        const score = extractFinalScore(match);
        const homeScore = score?.home ?? 0;
        const awayScore = score?.away ?? 0;
        const isHome = match.Team1.TeamId === teamId;
        const result =
          homeScore === awayScore ? "DRAW" : isHome ? (homeScore > awayScore ? "WIN" : "LOSS") : awayScore > homeScore ? "WIN" : "LOSS";
        return {
          id: match.MatchID,
          dateUtc: (match.MatchDateTimeUTC ?? new Date(match.MatchDateTime).toISOString()),
          home: match.Team1.TeamName,
          away: match.Team2.TeamName,
          score: `${homeScore}-${awayScore}`,
          result,
        };
      })
      .sort((a, b) => new Date(b.dateUtc).getTime() - new Date(a.dateUtc).getTime())
      .slice(0, limit);
  }

  private async getSeasonMatches(): Promise<MatchPayload[]> {
    const cacheKey = this.getLeagueKey("matches");
    const cached = this.matchesCache.get(cacheKey);
    if (cached) return cached;

    try {
      const res = await this.http.get<MatchPayload[]>(
        `/getmatchdata/${config.openLiga.leagueShortcut}/${config.openLiga.season}`,
      );
      this.matchesCache.set(cacheKey, res.data);
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `OpenLigaDB request failed: ${error.response?.status ?? ""} ${error.response?.statusText ?? ""}`.trim(),
        );
      }
      throw error;
    }
  }

  private getLeagueKey(prefix: string): string {
    return `${prefix}:${config.openLiga.leagueShortcut}:${config.openLiga.season}`;
  }
}

const mapFixtureSummary = (match: MatchPayload): FixtureSummary => ({
  matchId: match.MatchID,
  leagueId: match.LeagueId ?? 0,
  season: Number(match.LeagueSeason ?? config.openLiga.season),
  kickoffUtc: match.MatchDateTimeUTC ?? new Date(match.MatchDateTime).toISOString(),
  venue: match.Location?.LocationStadium ?? null,
  homeTeam: mapTeam(match.Team1),
  awayTeam: mapTeam(match.Team2),
});

const mapTeam = (team: TeamPayload): TeamSummary => ({
  id: team.TeamId,
  name: team.TeamName,
  shortName: team.ShortName ?? undefined,
});

const extractFinalScore = (
  match: MatchPayload,
): { home: number; away: number } | undefined => {
  const preferred = match.MatchResults?.find((result) => result.ResultName === "Endergebnis")
    ?? match.MatchResults?.sort((a, b) => (b.ResultOrderID ?? 0) - (a.ResultOrderID ?? 0)).at(0);
  if (
    preferred &&
    typeof preferred.PointsTeam1 === "number" &&
    typeof preferred.PointsTeam2 === "number"
  ) {
    return { home: preferred.PointsTeam1, away: preferred.PointsTeam2 };
  }

  const lastGoal = match.Goals && match.Goals.length ? match.Goals[match.Goals.length - 1] : undefined;
  if (
    lastGoal &&
    typeof lastGoal.ScoreTeam1 === "number" &&
    typeof lastGoal.ScoreTeam2 === "number"
  ) {
    return { home: lastGoal.ScoreTeam1, away: lastGoal.ScoreTeam2 };
  }
  return undefined;
};

const parseDate = (value?: string | null): number | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
};
