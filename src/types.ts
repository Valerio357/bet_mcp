export type MarketKey = "1X2" | "OU_2_5" | "BTTS";

export type SelectionKey =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_2_5"
  | "UNDER_2_5"
  | "BTTS_YES"
  | "BTTS_NO";

export interface FixtureSummary {
  matchId: number;
  leagueId: number;
  season: number;
  kickoffUtc: string;
  venue: string | null;
  homeTeam: TeamSummary;
  awayTeam: TeamSummary;
}

export interface TeamSummary {
  id: number;
  name: string;
  shortName?: string | null;
}

export interface BookmakerOdds {
  book: string;
  oddsDecimal: number;
  timestamp: string;
}

export interface MarketOdds {
  market: MarketKey;
  selection: SelectionKey;
  line?: number;
  bookmakers: BookmakerOdds[];
}

export interface FairLine {
  selection: SelectionKey;
  probability: number;
  fairOdds: number;
}

export interface FairOddsPayload {
  matchId: number;
  lambdaHome: number;
  lambdaAway: number;
  probabilities: Record<SelectionKey, number>;
  fairOdds: Record<SelectionKey, number>;
}

export interface RecentMatchSummary {
  id: number;
  dateUtc: string;
  home: string;
  away: string;
  score: string;
  result: "WIN" | "DRAW" | "LOSS";
}

export interface TeamSnapshot {
  team: TeamSummary;
  leaguePosition?: number;
  points?: number;
  form?: string;
  avgGoalsFor?: number;
  avgGoalsAgainst?: number;
  recentResults: RecentMatchSummary[];
}

export interface MatchSnapshot {
  match: FixtureSummary;
  home: TeamSnapshot;
  away: TeamSnapshot;
}

export interface ValuePick {
  market: MarketKey;
  selection: SelectionKey;
  bookmaker: string;
  offeredOdds: number;
  fairOdds: number;
  edge: number;
  rationale: string;
}

export interface ValueDetectionResult {
  matchId: number;
  picks: ValuePick[];
  fair: FairOddsPayload;
  odds: MarketOdds[];
}
