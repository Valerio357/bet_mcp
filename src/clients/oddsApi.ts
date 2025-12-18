import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";
import { FixtureSummary, MarketKey, MarketOdds, SelectionKey } from "../types.js";
import { MemoryCache } from "../utils/cache.js";
import { normalizeTeamName } from "../utils/strings.js";

const BASE_URL = "https://api.the-odds-api.com/v4";

interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export class OddsApiClient {
  private readonly http: AxiosInstance;
  private readonly cache = new MemoryCache<OddsEvent[]>(config.cache.ttlSeconds);

  constructor() {
    this.http = axios.create({
      baseURL: BASE_URL,
    });
  }

  public async getMarketOddsForFixture(fixture: FixtureSummary): Promise<MarketOdds[]> {
    const events = await this.getOddsSnapshot();
    const event = this.matchEvent(fixture, events);
    if (!event) return [];

    const selections: { market: MarketKey; selection: SelectionKey; line?: number; bookmakers: any[] }[] = [];
    const aggregator: Record<string, { market: MarketKey; selection: SelectionKey; line?: number; bookmakers: any[] }> = {};

    const claim = (market: MarketKey, selection: SelectionKey, line?: number) => {
      const key = `${market}:${selection}`;
      if (!aggregator[key]) {
        aggregator[key] = { market, selection, line, bookmakers: [] };
        selections.push(aggregator[key]);
      }
      return aggregator[key];
    };

    event.bookmakers.forEach((book) => {
      const addOutcome = (
        marketKey: MarketKey,
        selectionKey: SelectionKey,
        outcome?: OddsOutcome,
        line?: number,
      ) => {
        if (!outcome) return;
        if (!outcome.price) return;
        claim(marketKey, selectionKey, line).bookmakers.push({
          book: book.title,
          oddsDecimal: outcome.price,
          timestamp: book.last_update,
        });
      };

      const h2h = book.markets.find((m) => m.key === "h2h");
      if (h2h) {
        const home = h2h.outcomes.find((o) => normalize(o.name) === normalize(fixture.homeTeam.name));
        const away = h2h.outcomes.find((o) => normalize(o.name) === normalize(fixture.awayTeam.name));
        const draw = h2h.outcomes.find((o) => normalize(o.name) === "draw");
        addOutcome("1X2", "HOME", home);
        addOutcome("1X2", "DRAW", draw);
        addOutcome("1X2", "AWAY", away);
      }

      const totals = book.markets.find((m) => m.key === "totals");
      if (totals) {
        const over = totals.outcomes.find((o) => Number(o.point) === 2.5 && normalize(o.name) === "over");
        const under = totals.outcomes.find((o) => Number(o.point) === 2.5 && normalize(o.name) === "under");
        addOutcome("OU_2_5", "OVER_2_5", over, 2.5);
        addOutcome("OU_2_5", "UNDER_2_5", under, 2.5);
      }

      const btts = book.markets.find((m) => m.key === "btts" || m.key === "both_teams_to_score");
      if (btts) {
        const yes = btts.outcomes.find((o) => normalize(o.name) === "yes");
        const no = btts.outcomes.find((o) => normalize(o.name) === "no");
        addOutcome("BTTS", "BTTS_YES", yes);
        addOutcome("BTTS", "BTTS_NO", no);
      }
    });

    return selections
      .filter((item) => item.bookmakers.length > 0)
      .map((item) => ({
        market: item.market,
        selection: item.selection,
        line: item.line,
        bookmakers: item.bookmakers,
      }));
  }

  private async getOddsSnapshot(): Promise<OddsEvent[]> {
    const cached = this.cache.get("odds");
    if (cached) return cached;

    const params = {
      apiKey: config.oddsApi.key,
      regions: config.oddsApi.region,
      markets: config.oddsApi.markets,
      oddsFormat: "decimal",
      dateFormat: "iso",
    };

    try {
      const res = await this.http.get<OddsEvent[]>(
        `/sports/${config.oddsApi.sport}/odds`,
        { params },
      );
      this.cache.set("odds", res.data);
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`The Odds API failed: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }

  private matchEvent(fixture: FixtureSummary, events: OddsEvent[]): OddsEvent | undefined {
    const fixtureDate = new Date(fixture.kickoffUtc).getTime();
    const targetHome = normalize(fixture.homeTeam.name);
    const targetAway = normalize(fixture.awayTeam.name);

    return events.find((event) => {
      const kickoff = new Date(event.commence_time).getTime();
      const withinWindow = Math.abs(kickoff - fixtureDate) <= 4 * 60 * 60 * 1000;
      const sameHome = normalize(event.home_team) === targetHome;
      const sameAway = normalize(event.away_team) === targetAway;
      return withinWindow && sameHome && sameAway;
    });
  }
}

const normalize = (value: string): string => normalizeTeamName(value);
