import { config } from "../config.js";
import { FairOddsPayload, MatchSnapshot, SelectionKey } from "../types.js";
import { clampProbability, poissonProbability } from "../utils/math.js";

const MAX_GOALS = 8;

export const computeFairOddsFromSnapshot = (snapshot: MatchSnapshot): FairOddsPayload => {
  const lambdaHome = deriveLambda(
    snapshot.home.avgGoalsFor,
    snapshot.away.avgGoalsAgainst,
    config.modeling.homeAdvantage,
  );
  const lambdaAway = deriveLambda(snapshot.away.avgGoalsFor, snapshot.home.avgGoalsAgainst, 1);

  const { homeWin, awayWin, draw, over25, bttsYes } = integrateDistributions(lambdaHome, lambdaAway);

  const probs = {
    HOME: clampProbability(homeWin),
    DRAW: clampProbability(draw),
    AWAY: clampProbability(awayWin),
    OVER_2_5: clampProbability(over25),
    UNDER_2_5: clampProbability(1 - over25),
    BTTS_YES: clampProbability(bttsYes),
    BTTS_NO: clampProbability(1 - bttsYes),
  } satisfies Record<SelectionKey, number>;

  const fairOdds = Object.fromEntries(
    Object.entries(probs).map(([key, value]) => [key, Number((1 / value).toFixed(3))]),
  ) as Record<SelectionKey, number>;

  return {
    matchId: snapshot.match.matchId,
    lambdaHome: Number(lambdaHome.toFixed(3)),
    lambdaAway: Number(lambdaAway.toFixed(3)),
    probabilities: probs,
    fairOdds,
  };
};

const deriveLambda = (
  goalsFor = 1.2,
  goalsAgainst = 1.2,
  adjustment = 1,
): number => {
  const baseline = (goalsFor + goalsAgainst) / 2;
  return Math.max(0.4, baseline * adjustment);
};

const integrateDistributions = (lambdaHome: number, lambdaAway: number) => {
  const homeDist = buildDistribution(lambdaHome);
  const awayDist = buildDistribution(lambdaAway);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let bttsYes = 0;

  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      const prob = homeDist[h] * awayDist[a];
      if (h > a) homeWin += prob;
      else if (a > h) awayWin += prob;
      else draw += prob;
      if (h + a >= 3) over25 += prob;
      if (h > 0 && a > 0) bttsYes += prob;
    }
  }

  const total = homeWin + awayWin + draw;
  if (total > 0) {
    homeWin /= total;
    awayWin /= total;
    draw /= total;
  }

  return { homeWin, awayWin, draw, over25, bttsYes };
};

const buildDistribution = (lambda: number): number[] => {
  const dist: number[] = [];
  for (let goals = 0; goals <= MAX_GOALS; goals += 1) {
    dist[goals] = poissonProbability(lambda, goals);
  }
  return dist;
};
