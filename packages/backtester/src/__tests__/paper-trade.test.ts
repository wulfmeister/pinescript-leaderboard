import { describe, it, expect, vi } from "vitest";
import { PaperTradeEngine } from "../paper-trade.js";
import type { OHLCV, Signal, Trade } from "@pinescript-utils/core";

describe("PaperTradeEngine", () => {
  const mockCandle: OHLCV = {
    timestamp: 1000,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
  };

  it("should process updates and update state correctly", async () => {
    const engine = new PaperTradeEngine({
      initialCapital: 10000,
      positionSize: 1.0, // use 100%
      commission: 0,
      slippage: 0,
    });

    const stateUpdateMock = vi.fn();
    const tradeMock = vi.fn();

    engine.onStateUpdate = stateUpdateMock;
    engine.onTrade = tradeMock;

    // Tick 1: No signals, price goes to 105
    await engine.processUpdate(mockCandle, [], "AAPL");

    expect(stateUpdateMock).toHaveBeenCalledTimes(1);
    const state1 = engine.getState();
    expect(state1.cash).toBe(10000);
    expect(state1.equity).toBe(10000);
    expect(state1.positions.length).toBe(0);
    expect(tradeMock).not.toHaveBeenCalled();

    // Tick 2: Buy signal at price 105
    const buySignal: Signal = {
      timestamp: 2000,
      action: "buy",
      price: 105,
    };

    const candle2: OHLCV = {
      ...mockCandle,
      timestamp: 2000,
      close: 105,
    };

    await engine.processUpdate(candle2, [buySignal], "AAPL");

    expect(stateUpdateMock).toHaveBeenCalledTimes(2);
    expect(tradeMock).toHaveBeenCalledTimes(1);

    const state2 = engine.getState();
    expect(state2.positions.length).toBe(1);
    expect(state2.positions[0].symbol).toBe("AAPL");
    expect(state2.positions[0].entryPrice).toBe(105);

    // We used 100% of 10000 at price 105 -> ~95.238 shares
    const expectedQuantity = 10000 / 105;
    expect(state2.positions[0].quantity).toBeCloseTo(expectedQuantity);

    // Cash should be 0 since we used 100%
    expect(state2.cash).toBeCloseTo(0);

    // Equity is still 10000 since price hasn't moved
    expect(state2.equity).toBeCloseTo(10000);

    // Tick 3: Price increases to 110 (unrealized PnL increases)
    const candle3: OHLCV = {
      ...mockCandle,
      timestamp: 3000,
      close: 110,
    };

    await engine.processUpdate(candle3, [], "AAPL");

    const state3 = engine.getState();
    // New equity = shares * 110
    const expectedEquity = expectedQuantity * 110;
    expect(state3.equity).toBeCloseTo(expectedEquity);
    expect(state3.unrealizedPnl).toBeCloseTo(expectedEquity - 10000);

    // Tick 4: Sell signal at price 110
    const sellSignal: Signal = {
      timestamp: 4000,
      action: "sell",
      price: 110,
    };

    const candle4: OHLCV = {
      ...mockCandle,
      timestamp: 4000,
      close: 110,
    };

    await engine.processUpdate(candle4, [sellSignal], "AAPL");

    expect(tradeMock).toHaveBeenCalledTimes(2);
    const state4 = engine.getState();

    // Position should be closed
    expect(state4.positions.length).toBe(0);

    // Cash should now reflect the full equity (10000 + profit)
    expect(state4.cash).toBeCloseTo(expectedEquity);
    expect(state4.equity).toBeCloseTo(expectedEquity);
    expect(state4.trades.length).toBe(2);
  });
});
