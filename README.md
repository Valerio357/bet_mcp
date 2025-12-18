# bet-mcp

MCP server (FastMCP + TypeScript) that focuses on Serie A pre-match analysis:

- `fixtures.list` – next fixtures in a configurable window
- `match.snapshot` – last 5 results, standings, GF/GA averages
- `odds.prematch` – normalized odds for 1X2 / OU 2.5 / BTTS across bookmakers
- `fair.compute` – Poisson-lite probabilities + fair odds
- `value.detect` – top value picks by comparing best odds vs fair model

## Getting started

1. Install dependencies (Node 20+ recommended):

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and provide your keys:

   ```bash
   cp .env.example .env
   # edit the file with OPENLIGADB_* (optional) and ODDS_API_KEY
   ```

3. Run locally:

   ```bash
   # stdio (Claude Desktop / terminal)
   npm run dev

   # or HTTP transport for remote testing
   MCP_TRANSPORT=http PORT=8080 npm run dev
   ```

4. Build for production:

   ```bash
   npm run build
   npm start
   ```

5. Deploy on [glama.ai](https://glama.ai):

Glama uses the included `glama.yaml`/`glama.json` files to run `npm install && npm run build`, then starts the server with `MCP_TRANSPORT=http` on port `8080`. Configure `ODDS_API_KEY` (required) and, if needed, override the default OpenLigaDB league/season values in the Glama dashboard so inspections and tool detection can succeed.

## Implementation notes

- **Stack** – FastMCP + Axios + Zod, TypeScript strict mode.
- **API clients** – OpenLigaDB for fixtures/stats; The Odds API for consolidated odds.
- **Modeling** – Poisson using GF/GA averages + configurable home advantage, derived OU/BTTS probs.
- **Caching** – In-memory TTL cache to reduce API calls (configurable via `CACHE_TTL_SECONDS`).
- **Value picks** – Filters by `edge >= 5%` and `odds >= 1.50`, returns rationale referencing λ/form.

## Environment variables

| key | description |
| --- | --- |
| `OPENLIGADB_BASE_URL` | Defaults to `https://api.openligadb.de` |
| `OPENLIGADB_LEAGUE_SHORTCUT` | Defaults to `seria` |
| `OPENLIGADB_SEASON` | Defaults to current year |
| `ODDS_API_KEY` | The Odds API key |
| `ODDS_API_REGION` | Regions filter (default `eu`) |
| `ODDS_API_MARKETS` | Markets request list (default `h2h,totals,btts`) |
| `ODDS_API_SPORT` | Sport key (`soccer_italy_serie_a`) |
| `HOME_ADVANTAGE_FACTOR` | Poisson λ multiplier for home team |
| `CACHE_TTL_SECONDS` | Cache TTL (default 120) |
| `MCP_TRANSPORT` | `stdio` (default) or `http` |
| `PORT` | HTTP port when `MCP_TRANSPORT=http` |

## Testing

Use `npx fastmcp dev src/index.ts` or `npx fastmcp inspect src/index.ts` after installing dependencies to interactively test the tools.
