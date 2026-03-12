# AGENTS.md

This document is for AI coding agents working in `pinescript-leaderboard`.

## Project purpose and scope

`pinescript-leaderboard` is a TypeScript Turborepo for building, testing, comparing, and exporting PineScript trading strategies.

Core use cases:

- Execute PineScript strategies on OHLCV data via a custom runtime built on PineTS/OpenPineScript (`pinets`).
- Backtest and analyze performance metrics.
- Rank, optimize, walk-forward validate, and stress test strategies.
- Run multi-model Venice LLM tournaments for strategy generation.
- Run multi-asset portfolio backtests.
- Expose workflows through both a Next.js web UI and a CLI.

Primary pipeline:

`PineScript script -> pine-runtime -> signals -> backtester -> metrics/equity/trades -> UI/CLI/reporting`

## Monorepo layout

Top-level (relevant):

- `packages/*`: shared domain packages.
- `web/`: Next.js 14 app (App Router) with API routes and UI pages.
- `cli/`: Commander-based CLI tool (`pinescript-utils`).
- `strategies/`: bundled `.pine` strategy files (RSI, MACD, BB, SMA crossover, EMA variants). Used as defaults/examples by CLI and web.
- `e2e/`: Playwright tests and screenshots.
- `scripts/`: helper scripts (`find-port.mjs`, `test-cli.mjs`).
- `turbo.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`: build/test orchestration.

Do not include or depend on `.sisyphus/` internals for implementation decisions.

## Package dependency graph

Dependency flows top-down. Packages only depend on packages above them:

```
core (zero internal deps)
  ├── pine-runtime (core)
  ├── data-feed (core)
  ├── risk-manager (core)
  ├── reporter (core)
  ├── pine-exporter (core)
  ├── monte-carlo (core)
  ├── venice (core)
  ├── backtester (core, risk-manager)
  ├── ranker (core, backtester)
  ├── optimizer (core, backtester, pine-runtime)
  ├── walk-forward (core, backtester, optimizer, pine-runtime)
  ├── portfolio (core, backtester, pine-runtime)
  └── llm-arena (core, backtester, pine-runtime, venice)
```

## Tech stack

- Language: TypeScript (ES modules).
- Monorepo/build: Turborepo + npm workspaces.
- Web: Next.js 14 (App Router), React 18, Tailwind CSS.
- Charts: `lightweight-charts` (TradingView Lightweight Charts v5).
- Unit tests: Vitest.
- E2E tests: Playwright.
- Pine runtime engine: PineTS/OpenPineScript (`pinets`).
- LLM provider integration: Venice API (OpenAI-compatible endpoint).

## Workspace packages and key exports

Each package typically builds with `tsc` from `src` to `dist`, exports from `src/index.ts`, and is consumed via `@pinescript-utils/*`.

### `@pinescript-utils/core`

- Purpose: shared domain types and math/indicator utilities.
- Key exports: `OHLCV`, `Signal`, `BacktestResult`, `PerformanceMetrics`, `RiskManagementConfig`, indicator/math helpers (`rsi`, `macd`, `bollingerBands`, etc.).

### `@pinescript-utils/backtester`

- Purpose: backtesting engine.
- Key exports: `BacktestEngine`, `quickBacktest`, `DEFAULT_CONFIG`, `BacktestConfig`.
- Notes: supports slippage/commission/position sizing and optional risk-manager-driven exits.

### `@pinescript-utils/pine-runtime`

- Purpose: PineTS adapter and PineScript validation/parameter extraction.
- Key exports: `PineTSAdapter`, `SimplePineRuntime` alias, `pineRuntime`, param mapping/transpile cache/validation utilities.
- Notes: preprocesses v2-style scripts and injects a strategy namespace before execution.

### `@pinescript-utils/data-feed`

- Purpose: market data access and mock data generation.
- Key exports: `DataFeed`, providers (`YahooFinanceProvider`, `BinanceDataProvider`, `MockDataProvider`), singleton `dataFeed`.

### `@pinescript-utils/optimizer`

- Purpose: grid-search optimization over Pine `input()` parameters.
- Key exports: `StrategyOptimizer`, `DEFAULT_OPTIMIZER_CONFIG`, optimizer/result types.

### `@pinescript-utils/walk-forward`

- Purpose: walk-forward train/test analysis using optimizer + backtester.
- Key exports: `WalkForwardAnalyzer`, `DEFAULT_WF_CONFIG`, result types.

### `@pinescript-utils/ranker`

- Purpose: compare and rank strategy backtest outcomes.
- Key exports: `StrategyRanker`, `rankStrategies`, `DEFAULT_RANKING_CONFIG`, ranking types.

### `@pinescript-utils/llm-arena`

- Purpose: run LLM model tournaments with Elo scoring.
- Key exports: `ArenaEngine`, `EloRating`, `DEFAULT_ARENA_CONFIG`, `ARENA_PROMPTS`, arena result/event types.

### `@pinescript-utils/monte-carlo`

- Purpose: Monte Carlo robustness simulation from trade PnL sequences.
- Key exports: `runMonteCarloSimulation`, `MonteCarloSimulator`, statistical helpers (`percentile`, `buildDistribution`, `seededShuffle`, etc.).

### `@pinescript-utils/risk-manager`

- Purpose: stop-loss/take-profit/trailing stop/position sizing logic.
- Key exports: `RiskManager` plus stop/take-profit/trailing/position-sizing helpers and types.

### `@pinescript-utils/venice`

- Purpose: Venice API client wrapper.
- Key exports: `VeniceClient`, `createVeniceClient`, `VENICE_MODELS`, chat/completion types.

### `@pinescript-utils/reporter`

- Purpose: HTML report generation from backtest results.
- Key exports: `generateHTMLReport`, `saveHTMLReport`, `DEFAULT_REPORT_OPTIONS`, `ReportOptions`.

### `@pinescript-utils/pine-exporter`

- Purpose: generate PineScript v5 code from structured strategy definitions.
- Key exports: `PineExporter`, exporter option/strategy indicator types.

### `@pinescript-utils/portfolio`

- Purpose: multi-asset portfolio backtesting with equal-weight capital allocation.
- Key exports: `runPortfolioBacktest`, `alignEquityCurves`, `calculateCorrelationMatrix`, portfolio result/config types.

## Web app architecture (`web/`)

UI pages under `web/src/app`:

- `/backtest`: full strategy editor + run flow + charts + overlays + export.
- `/compare`: side-by-side strategy comparison with overlaid equity charts.
- `/optimize`: parameter optimization, range editor, heatmap and run inspection.
- `/rank`: multi-strategy comparison and visual ranking.
- `/walk-forward`: out-of-sample window analysis and efficiency metrics.
- `/arena`: Venice generate/chat and tournament tabs.
- `/portfolio`: multi-asset portfolio backtest with correlation and per-asset breakdown.
- `/export`: template-based PineScript code generation UI.
- Monte Carlo has no dedicated page; it is surfaced via API and CLI, and via optional CLI backtest flag (`--monte-carlo`).

Shared UI patterns:

- `DataSettings` component (`web/src/app/components/data-settings.tsx`) is the canonical mock/real data selector.
- `formatDataSourceBadge(...)` should be used where results are shown to keep data provenance labels consistent.
- Data source behavior is uniform across backtest/rank/optimize/walk-forward/portfolio.

API routes under `web/src/app/api/*/route.ts`:

- `backtest`, `rank`, `optimize`, `walk-forward`, `monte-carlo`, `portfolio`, `arena`, `llm`, `data`, `strategies`.
- Route pattern: parse JSON, validate required fields and date/mock ranges, fetch data (real or mock), invoke package API, return normalized JSON.

Chart conventions:

- Lightweight Charts (TradingView) for all charting. Zoom/pan is built-in (no plugin). Charts use `createChart()` with `autoSize: true` and dark theme defaults. Tooltip via `subscribeCrosshairMove()`. Shared `useLightweightChart` hook in `web/src/app/hooks/useLightweightChart.ts` for React components. HTML reporter uses standalone CDN build.
- Reset Zoom button resets both time scale (`chart.timeScale().resetTimeScale()`) and price scale (`chart.priceScale('right').applyOptions({ autoScale: true })`).

## CLI architecture (`cli/`)

Entry point: `cli/src/index.ts`.

Command groups:

- `backtest`
- `rank`
- `fetch-data`
- `optimize`
- `walk-forward`
- `arena-tournament`
- `monte-carlo`

CLI flow mirrors web flow:

- parse command options -> data fetch/mock generation -> `pineRuntime.executeStrategy(...)` -> package analyzers/backtester -> formatted terminal output.

## E2E testing structure (`e2e/`)

Main specs:

- `pages.spec.ts`: page load and navigation/screenshot sanity.
- `data-settings.spec.ts`: DataSettings behavior, toggling, validation, and badge behavior.
- `optimize-heatmap.spec.ts`: heatmap rendering/toggling/selection behavior.
- `portfolio.spec.ts`: portfolio page form, run flow, validations, and results rendering.

Playwright config:

- `playwright.config.ts` uses `testDir: ./e2e`, output in `e2e/test-results`, Chromium project, and auto-starts web app via `npm run web`.

## Build/test/dev commands

Root commands (`package.json`):

- `npm run build`: turbo build for all workspaces except web (`--filter=!@pinescript-utils/web`).
- `npm run build:all`: turbo build including web.
- `npm run test`: turbo run test.
- `npm run lint`: turbo run lint.
- `npm run dev`: root build then start web dev (`npm run web`).
- `npm run web`: workspace web dev server; uses `scripts/find-port.mjs` for dynamic port selection.

Web commands (`web/package.json`):

- `npm run --workspace=web dev`
- `npm run --workspace=web build`
- `npm run --workspace=web start`

CLI/package commands:

- Most packages: `build` (`tsc`), `dev` (`tsc --watch`), `test` (`vitest run`), `clean`.

E2E command:

- `npx playwright test` (reads root `playwright.config.ts`).

## Code conventions and patterns

TypeScript and modules:

- Strict TypeScript is enabled at root (`strict: true`) and packages extend root config.
- Package source imports often use `.js` extension in TS source for ESM-compatible emit.
- Workspaces build to `dist` and export typed `import`/`types` paths.

Web conventions:

- App Router with mostly client components for interactive pages (`"use client"`).
- Result pages follow `loading/error/result` state shape using React hooks.
- API payload fields are consistent: `script`, `asset(s)`, `capital`, timeframe/date, `mock/mockType/mockBars`.
- Validation pattern repeats across pages/routes (date order and mock bar bounds).

Data conventions:

- Mock-data-first UX defaults are common (`useMock: true`, bars around 252; walk-forward defaults to 500).
- Prefer the shared `DataSettings` component over duplicating mock/real controls.
- Prefer `formatDataSourceBadge` for displaying source context after runs.

Chart conventions:

- Disable heavy chart animation for responsiveness (`animation: false` in key charts).
- Keep zoom/pan interactions uniform and include explicit reset controls.

## Testing conventions

Unit tests (Vitest):

- Package tests colocated under `src/__tests__`.
- Web API/component tests under `web/src/app/**/__tests__`.
- Heavy use of deterministic mock data helpers and explicit metric assertions.
- API route tests mock package dependencies (`vi.mock(...)`) and focus on validation + response shapes.

E2E tests (Playwright):

- Route-level smoke coverage for all major pages.
- Behavior checks for key interaction-heavy components (DataSettings, optimizer heatmap, portfolio results).
- Screenshot artifacts are written under `e2e/screenshots/`.

## Key architectural decisions

- Monorepo domain split: strategy logic lives in reusable packages; web and CLI are thin orchestration shells.
- Unified runtime path: PineScript execution goes through `@pinescript-utils/pine-runtime` before all analysis modules.
- Shared data-source contract: all major flows accept mock/real data via same schema and validation semantics.
- Backtester-centric analytics: optimizer, ranker, walk-forward, arena, and portfolio all derive final scoring from backtest outputs.
- Portfolio design: equal allocation per asset, aligned equity curves, and correlation matrix from daily return series.
- LLM arena design: model-vs-model tournament with Elo updates, default prompts, and optional test strategy mode.

## Known issues and implementation notes for agents

- **Active bug**: `DrawdownChart.tsx` throws "Value is undefined" at `chart.removeSeries(series)` — visible in E2E screenshots (`backtest-results.png`, `backtest-charts-lw.png`). The chart ref or series is null on cleanup. Needs a guard check before calling `removeSeries`.
- Historical LSP note: `pineRuntime` export resolution has surfaced in editor diagnostics in parts of the workspace; verify current package export paths before refactors.
- Historical chart typing note: duplicate `interaction` option declarations in chart configs previously caused type diagnostics; this has already been fixed in current chart code.
- Venice model IDs used in UI/CLI should match current Venice docs (`docs.venice.ai`). Current hardcoded tournament model set is:
  - `kimi-k2-thinking`
  - `zai-org-glm-4.7`
  - `grok-41-fast`

When changing model lists, keep `web/src/app/arena/page.tsx`, `cli/src/index.ts`, and `packages/venice/src/client.ts` aligned.
