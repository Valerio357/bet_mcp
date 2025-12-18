import { oddsApi } from "./context.js";
import { buildMatchSnapshot } from "./matchSnapshot.js";
import { computeFairOddsFromSnapshot } from "./fairOddsEngine.js";
import { ValueDetectionResult, ValuePick } from "../types.js";

const EDGE_THRESHOLD = 0.05;
const MIN_ODDS = 1.5;

export const detectValue = async (matchId: number): Promise<ValueDetectionResult> => {
  const snapshot = await buildMatchSnapshot(matchId);
  const fair = computeFairOddsFromSnapshot(snapshot);
  const odds = await oddsApi.getMarketOddsForFixture(snapshot.match);

  const picks: ValuePick[] = odds
    .map((market) => {
      if (!market.bookmakers.length) return undefined;
      const bestBook = market.bookmakers.reduce((best, current) =>
        current.oddsDecimal > best.oddsDecimal ? current : best,
      );
      const fairOdds = fair.fairOdds[market.selection];
      const edge = bestBook.oddsDecimal / fairOdds - 1;
      if (edge < EDGE_THRESHOLD || bestBook.oddsDecimal < MIN_ODDS) return undefined;
      return {
        market: market.market,
        selection: market.selection,
        bookmaker: bestBook.book,
        offeredOdds: Number(bestBook.oddsDecimal.toFixed(3)),
        fairOdds,
        edge: Number(edge.toFixed(3)),
        rationale: buildRationale(snapshot.home.form, snapshot.away.form, fair.lambdaHome, fair.lambdaAway, market.selection),
      } satisfies ValuePick;
    })
    .filter(Boolean)
    .sort((a, b) => (b!.edge - a!.edge))
    .slice(0, 3) as ValuePick[];

  return {
    matchId,
    picks,
    fair,
    odds,
  };
};

const buildRationale = (
  homeForm: string | undefined,
  awayForm: string | undefined,
  lambdaHome: number,
  lambdaAway: number,
  selection: ValuePick["selection"],
): string => {
  const lambdaNote = `λ_home=${lambdaHome.toFixed(2)} λ_away=${lambdaAway.toFixed(2)}`;
  const homeNote = homeForm ? `home form ${homeForm}` : undefined;
  const awayNote = awayForm ? `away form ${awayForm}` : undefined;
  const formSnippet = [homeNote, awayNote].filter(Boolean).join(", ");
  return `${selection} boosted by ${lambdaNote}${formSnippet ? ` (${formSnippet})` : ""}`;
};
