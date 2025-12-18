import { footballData } from "./context.js";
import { MatchSnapshot, TeamSnapshot } from "../types.js";

export const buildMatchSnapshot = async (matchId: number): Promise<MatchSnapshot> => {
  const fixture = await footballData.getFixture(matchId);
  if (!fixture) {
    throw new Error(`Fixture ${matchId} not found on Football-Data.org`);
  }

  const standings = await footballData.getStandingsMap();
  const [homeStats, awayStats] = await Promise.all([
    footballData.getTeamStatistics(fixture.homeTeam.id),
    footballData.getTeamStatistics(fixture.awayTeam.id),
  ]);

  const [homeResults, awayResults] = await Promise.all([
    footballData.getRecentMatches(fixture.homeTeam.id),
    footballData.getRecentMatches(fixture.awayTeam.id),
  ]);

  const homeSnapshot = enrichTeamSnapshot(fixture.homeTeam.id, standings, homeStats, homeResults);
  const awaySnapshot = enrichTeamSnapshot(fixture.awayTeam.id, standings, awayStats, awayResults);

  return {
    match: fixture,
    home: {
      ...homeSnapshot,
      team: fixture.homeTeam,
    },
    away: {
      ...awaySnapshot,
      team: fixture.awayTeam,
    },
  };
};

const enrichTeamSnapshot = (
  teamId: number,
  standings: Map<number, { position: number; points: number }>,
  stats: { avgGoalsFor: number; avgGoalsAgainst: number } | undefined,
  recentResults: TeamSnapshot["recentResults"],
): Omit<TeamSnapshot, "team"> => {
  const standing = standings.get(teamId);
  return {
    leaguePosition: standing?.position,
    points: standing?.points,
    form: deriveForm(recentResults),
    avgGoalsFor: stats?.avgGoalsFor,
    avgGoalsAgainst: stats?.avgGoalsAgainst,
    recentResults,
  };
};

const deriveForm = (recentResults: TeamSnapshot["recentResults"]): string | undefined => {
  if (!recentResults.length) return undefined;
  return recentResults
    .slice(0, 5)
    .map((match) => match.result[0])
    .join("");
};
