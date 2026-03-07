# backtester

Core backtesting engine. Takes signals from pine-runtime and simulates trades with slippage, commission, and optional risk management.

## Structure

```
src/
├── engine.ts       # BacktestEngine class (521 lines) + PositionTracker + quickBacktest helper.
├── index.ts        # Re-exports: BacktestEngine, quickBacktest, DEFAULT_CONFIG, BacktestConfig.
└── __tests__/
    ├── engine.test.ts
    └── paper-trade.test.ts
```

## Key classes

**`PositionTracker`** (private): Manages open positions and closed trades.

- `openPosition(symbol, direction, price, size, commission, slippage, timestamp)` — applies slippage to entry price, deducts commission.
- `closePosition(symbol, price, commission, slippage, timestamp)` — calculates PnL including commission/slippage.
- Tracks by symbol key in a `Map<string, Position>`.

**`BacktestEngine`**: Orchestrates the full backtest loop.

- Iterates signals chronologically against OHLCV data.
- Handles `buy`/`sell`/`close` signal actions.
- Builds equity curve (`EquityPoint[]`) bar-by-bar.
- Integrates `RiskManager` when `config.riskManagement` is set — checks stop-loss, take-profit, trailing stop on every bar.
- Calls `calculateMetrics()` from `@pinescript-utils/core` for final `PerformanceMetrics`.

**`quickBacktest(script, data, config?)`**: Convenience wrapper — runs pine-runtime + BacktestEngine in one call.

## Config defaults (`DEFAULT_CONFIG`)

- `initialCapital: 10000`
- `positionSize: 0.95` (95% of capital per trade)
- `commission: 0.001` (0.1%)
- `slippage: 0.0005` (0.05%)
- `allowShorts: false`

## Gotchas

- Slippage is applied as a percentage of price at entry and exit (not fixed amount).
- Risk manager exits (stop-loss, trailing stop) are checked every bar BEFORE signal processing — a risk exit can close a position before a signal would.
- `quickBacktest` imports `pineRuntime` from pine-runtime — changes to pine-runtime exports affect this path.
- Position sizing uses `config.positionSize * currentCapital` — not initial capital.
- This is the most-depended-upon analysis package. Optimizer, ranker, walk-forward, portfolio, and llm-arena all consume its output.
