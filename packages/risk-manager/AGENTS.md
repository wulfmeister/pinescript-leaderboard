# risk-manager

Multi-component risk management: stop-loss, take-profit, trailing stop, and position sizing. Each component is a separate file with pure functions. `RiskManager` orchestrates them.

## Structure

```
src/
├── stop-loss.ts       # calculateStopLossPrice(), checkStopLoss()
├── take-profit.ts     # calculateTakeProfitPrice(), checkTakeProfit()
├── trailing-stop.ts   # TrailingStopState, initTrailingStop(), updateTrailingStop(), checkTrailingStop()
├── position-sizing.ts # calculatePositionSize() — risk-based and fixed-fraction modes.
├── risk-manager.ts    # RiskManager class — combines all components, per-position state tracking.
├── index.ts           # Re-exports everything from all component files.
└── __tests__/
    ├── risk-manager.test.ts
    ├── stop-loss.test.ts
    ├── take-profit.test.ts
    ├── trailing-stop.test.ts
    └── position-sizing.test.ts
```

## Key patterns

**Trailing stop ratcheting**: The trailing stop only tightens, never loosens.

- Long: `newStop = price * (1 - trailPercent)`. Only updates if `newStop > currentStop`.
- Short: `newStop = price * (1 + trailPercent)`. Only updates if `newStop < currentStop`.
- State is mutable (`TrailingStopState`) — caller must persist between bars.

**RiskManager integration**: `BacktestEngine` creates a `RiskManager` instance when `config.riskManagement` is set. On each bar:

1. `riskManager.checkExits(position, currentPrice)` — returns exit signals for stop-loss, take-profit, or trailing stop hits.
2. Exit signals are processed BEFORE regular strategy signals for that bar.

**Position sizing modes**:

- Fixed fraction: `capital * fraction`.
- Risk-based: `(capital * riskPercent) / (entryPrice - stopPrice)` — sizes position so max loss equals risk budget.

## Gotchas

- All price functions are direction-aware (long vs short). Stop-loss is BELOW entry for longs, ABOVE for shorts.
- Trailing stop state must be initialized per-position via `initTrailingStop()` and updated every bar via `updateTrailingStop()`.
- The `RiskManager` class manages a `Map<string, PositionRiskState>` keyed by position ID.
- Pure functions (`calculateStopLossPrice`, etc.) are stateless and can be used independently of `RiskManager`.
