<div align="center">
  <h1>PineScript Utils</h1>
  <p>
    Backtest, rank, optimize, and generate TradingView strategies locally.<br/>
    Powered by Venice AI.
  </p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js_14-000000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white" alt="Turborepo" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/TradingView_Charts-131722?logo=tradingview&logoColor=white" alt="TradingView Lightweight Charts" />
  <img src="https://img.shields.io/badge/PineScript-131722?logo=tradingview&logoColor=white" alt="PineScript" />
  <img src="https://img.shields.io/badge/Venice_AI-000000?logoColor=white" alt="Venice AI" />
  <img src="https://img.shields.io/badge/License-AGPL--3.0-blue" alt="License" />
</p>

---

<p align="center">
  <img src="e2e/screenshots/dashboard.png" alt="PineScript Utils Dashboard" width="800" />
</p>

## What is this?

A full-stack TypeScript monorepo for researching PineScript trading strategies. Write a strategy in PineScript, backtest it against historical or mock data, optimize its parameters, validate with walk-forward analysis, compare it against other strategies, stress-test with Monte Carlo simulation, and export clean PineScript v5 for TradingView — all from a single tool.

The **LLM Arena** feature pits AI models against each other in strategy-generation tournaments with Elo scoring, powered by the Venice API.

## Features

| Feature | Description | Interface |
|---------|-------------|-----------|
| **Backtest** | Run strategies against OHLCV data with slippage, commission, and risk management | Web + CLI |
| **Compare** | Side-by-side strategy comparison with overlaid equity charts | Web |
| **Rank** | Score and rank multiple strategies head-to-head | Web + CLI |
| **Optimize** | Grid search over `input()` parameters with sensitivity heatmap | Web + CLI |
| **Walk-Forward** | Rolling train/test window validation for out-of-sample robustness | Web + CLI |
| **Monte Carlo** | Randomized trade-sequence simulation for drawdown/return distributions | CLI + API |
| **Portfolio** | Multi-asset backtesting with correlation matrix and per-asset breakdown | Web |
| **LLM Arena** | Multi-model tournaments: LLMs generate strategies, backtest scores determine Elo | Web + CLI |
| **Export** | Generate valid PineScript v5 from templates for direct use on TradingView | Web |
| **Risk Manager** | Stop-loss, take-profit, trailing stop, and position sizing | Integrated |

## Screenshots

<details>
<summary>Click to expand screenshots</summary>

### Optimizer — Parameter Heatmap
<img src="e2e/screenshots/optimize-heatmap.png" alt="Parameter Optimizer with heatmap" width="700" />

### LLM Arena — Tournament Setup
<img src="e2e/screenshots/arena-tournament.png" alt="LLM Arena tournament" width="700" />

### Portfolio — Multi-Asset Backtest
<img src="e2e/screenshots/portfolio-results.png" alt="Portfolio backtest results" width="700" />

### Rank — Strategy Comparison
<img src="e2e/screenshots/rank-charts.png" alt="Strategy ranking charts" width="700" />

</details>

## Architecture

### Pipeline State Machine

Every analysis workflow in the system follows the same core pipeline. Higher-level tools (optimizer, ranker, walk-forward, arena, portfolio) are compositions that invoke this pipeline one or more times.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STRATEGY PIPELINE                               │
│                                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌────────────┐    ┌────────────┐  │
│  │ PineScript│───>│ pine-runtime │───>│  Backtester │───>│  Metrics   │  │
│  │  Script   │    │              │    │             │    │  & Equity  │  │
│  └──────────┘    │ preprocess   │    │ signals     │    │            │  │
│                  │ transpile    │    │ + OHLCV     │    │ Sharpe,    │  │
│                  │ execute      │    │ + config    │    │ return,    │  │
│                  │   ↓          │    │   ↓         │    │ drawdown,  │  │
│                  │ Signal[]     │    │ trades,     │    │ win rate   │  │
│                  └──────────────┘    │ equity curve│    └─────┬──────┘  │
│                                      └────────────┘          │         │
│         ┌────────────────────────────────────────────────────┘         │
│         ↓                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Reporter   │  │   Ranker     │  │  Optimizer   │  │ Monte Carlo│ │
│  │  (HTML/CSV)  │  │  (compare)   │  │ (grid search)│  │ (simulate) │ │
│  └─────────────┘  └──────────────┘  └──────┬───────┘  └────────────┘ │
│                                             │                         │
│                                      ┌──────┴───────┐                 │
│                                      │ Walk-Forward  │                 │
│                                      │ (train/test)  │                 │
│                                      └───────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘

  DATA SOURCES                          LLM ARENA
  ┌────────────┐                        ┌──────────────────────┐
  │ Mock Data  │ ──┐                    │ Venice API           │
  │ Yahoo Fin. │ ──┼── OHLCV[] ──>     │   ↓                  │
  │ Binance    │ ──┘   (data-feed)     │ Model generates Pine │
  └────────────┘                        │   ↓                  │
                                        │ Pipeline executes    │
                                        │   ↓                  │
                                        │ Elo rating updated   │
                                        └──────────────────────┘
```

### Monorepo Structure

```
pinescript-leaderboard/
├── packages/
│   ├── core/              # Shared types (OHLCV, Signal, BacktestResult) + indicators (RSI, MACD, BB, etc.)
│   ├── pine-runtime/      # PineTS adapter — executes PineScript, extracts params, caches transpilation
│   ├── backtester/        # Backtesting engine — slippage, commission, risk management integration
│   ├── data-feed/         # Market data providers (Yahoo, Binance, Mock) + mock data generation
│   ├── optimizer/         # Grid-search over input() parameters
│   ├── walk-forward/      # Rolling window train/test validation
│   ├── ranker/            # Multi-strategy comparison and scoring
│   ├── llm-arena/         # LLM tournament engine with Elo ratings
│   ├── monte-carlo/       # Monte Carlo trade-sequence simulation
│   ├── risk-manager/      # Stop-loss, take-profit, trailing stop, position sizing
│   ├── portfolio/         # Multi-asset portfolio backtesting + correlation matrix
│   ├── venice/            # Venice API client (OpenAI-compatible)
│   ├── reporter/          # HTML report generation
│   └── pine-exporter/     # PineScript v5 code generation from templates
├── web/                   # Next.js 14 App Router — UI + API routes
├── cli/                   # Commander CLI tool
├── strategies/            # Bundled .pine strategy files (RSI, MACD, BB, SMA, EMA)
├── e2e/                   # Playwright E2E tests + screenshots
└── scripts/               # Helper scripts (port finder, CLI test runner)
```

### Package Dependency Graph

```
core
  ├── pine-runtime
  ├── data-feed
  ├── risk-manager
  ├── reporter
  ├── pine-exporter
  ├── monte-carlo
  ├── venice
  │
  ├── backtester (+ risk-manager)
  │     │
  │     ├── ranker
  │     ├── optimizer (+ pine-runtime)
  │     │     │
  │     │     └── walk-forward (+ pine-runtime)
  │     │
  │     ├── portfolio (+ pine-runtime)
  │     │
  │     └── llm-arena (+ pine-runtime, venice)
  │
  └── web / cli (consume all packages)
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Install & Run

```bash
# Clone
git clone https://github.com/wulfmeister/pinescript-leaderboard.git
cd pinescript-leaderboard

# Install dependencies
npm install

# Build all packages
npm run build

# Start the web UI
npm run dev
```

The web app will start on `http://localhost:3000` (or next available port).

### Quick Start Workflow

1. Go to **Backtest** to run a strategy against market data
2. Go to **Optimize** to find the best parameters
3. Go to **Walk-Forward** to validate on unseen data
4. Go to **Export** to generate PineScript v5 for TradingView

### Enable AI Features

Set your Venice API key to enable the LLM Arena:

```bash
echo "VENICE_API_KEY=your-key-here" >> web/.env.local
```

## Usage

### Web UI

```bash
npm run dev        # Build packages + start Next.js dev server
npm run web        # Start web dev server only (packages must be pre-built)
```

### CLI

```bash
# Backtest a strategy
npx pinescript-utils backtest -s strategies/rsi_strategy.pine --asset AAPL --mock

# Backtest with Monte Carlo simulation
npx pinescript-utils backtest -s strategies/macd_strategy.pine --asset AAPL --mock --monte-carlo

# Rank multiple strategies
npx pinescript-utils rank -d strategies/ --asset AAPL --mock

# Optimize parameters
npx pinescript-utils optimize -s strategies/sma_crossover.pine --asset AAPL --mock

# Walk-forward validation
npx pinescript-utils walk-forward -s strategies/sma_crossover.pine --asset AAPL --mock

# Run LLM arena tournament
npx pinescript-utils arena-tournament --rounds 3 --mock

# Fetch real market data
npx pinescript-utils fetch-data --asset BTCUSDT --provider binance
```

### Programmatic API

Each package is independently importable:

```typescript
import { pineRuntime } from "@pinescript-utils/pine-runtime";
import { BacktestEngine } from "@pinescript-utils/backtester";
import { StrategyOptimizer } from "@pinescript-utils/optimizer";
import { MonteCarloSimulator } from "@pinescript-utils/monte-carlo";

// Execute a PineScript strategy
const signals = await pineRuntime.executeStrategy(script, ohlcvData, 10000);

// Backtest the signals
const engine = new BacktestEngine({ initialCapital: 10000 });
const result = await engine.run(signals, ohlcvData, "AAPL");
```

## Bundled Strategies

The `strategies/` directory includes ready-to-use PineScript files:

| Strategy | File | Description |
|----------|------|-------------|
| RSI | `rsi_strategy.pine` | RSI(14) — enter below 30 oversold, exit above 70 overbought |
| MACD | `macd_strategy.pine` | MACD(12,26,9) — enter on MACD/signal line crossover |
| Bollinger Bands | `bb_strategy.pine` | BB(20,2) mean reversion — enter at lower band, exit at upper band |
| SMA Crossover | `sma_crossover.pine` | SMA(10) / SMA(30) crossover entry and exit |
| EMA Simple | `ema_simple.pine` | Parameterized EMA(10) / EMA(30) — value comparison entry/exit |
| EMA Hardcoded | `ema_hardcoded.pine` | Fixed EMA(10) / EMA(30) — same logic as EMA Simple, no inputs |
| Fast EMA | `fast_ema.pine` | EMA(5) / EMA(20) — shorter periods for faster signals |
| Slow EMA | `slow_ema.pine` | EMA(20) / EMA(50) — longer periods for trend filtering |

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages (excluding web) |
| `npm run build:all` | Build everything including web |
| `npm run dev` | Build + start web dev server |
| `npm run test` | Run all unit tests (Vitest) |
| `npm run lint` | Lint all workspaces |
| `npm run format` | Format with Prettier |
| `npx playwright test` | Run E2E tests |

### Testing

**Unit tests** (Vitest) — colocated under `src/__tests__/` in each package:

```bash
npm run test                          # All packages
npx vitest run --filter backtester    # Single package
```

**E2E tests** (Playwright) — route-level smoke tests + interaction tests:

```bash
npx playwright test                   # All specs
npx playwright test e2e/portfolio.spec.ts  # Single spec
```

### Adding a New Package

1. Create `packages/my-package/` with `src/index.ts`, `tsconfig.json`, `package.json`
2. Name it `@pinescript-utils/my-package`
3. Add as dependency in `web/package.json` and/or `cli/package.json`
4. Add to `transpilePackages` in `web/next.config.mjs`
5. Turbo handles build ordering via `dependsOn: ["^build"]`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (ES modules, strict mode) |
| Monorepo | Turborepo + npm workspaces |
| Web Framework | Next.js 14 (App Router) |
| UI | React 18 + Tailwind CSS 3.4 |
| Charts | TradingView Lightweight Charts v5 |
| Pine Runtime | PineTS / OpenPineScript (`pinets`) |
| Unit Tests | Vitest |
| E2E Tests | Playwright (Chromium) |
| LLM Integration | Venice API (OpenAI-compatible) |
| CLI | Commander.js |

## API Routes

All routes accept POST with JSON body and return JSON:

| Route | Description |
|-------|-------------|
| `/api/backtest` | Run a backtest |
| `/api/rank` | Rank multiple strategies |
| `/api/optimize` | Grid-search optimization |
| `/api/walk-forward` | Walk-forward analysis |
| `/api/monte-carlo` | Monte Carlo simulation |
| `/api/portfolio` | Multi-asset portfolio backtest |
| `/api/arena` | LLM arena tournament |
| `/api/llm` | Direct LLM chat/generation |
| `/api/data` | Fetch market data |
| `/api/strategies` | List bundled strategies |

## License

[AGPL-3.0](LICENSE)
