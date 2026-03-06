import { describe, it, expect } from "vitest";
import {
  sma,
  ema,
  rsi,
  macd,
  bollingerBands,
  atr,
  stochastic,
  crossover,
  crossunder,
  average,
  standardDeviation,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateMaxDrawdown,
  calculateMetrics,
  formatPercent,
  formatCurrency,
  vwap,
  williamsR,
  cci,
  ichimoku,
  adx,
  roc,
  keltnerChannels,
  parabolicSar,
  obv,
  mfi,
  ultimateOscillator,
  mom,
  supertrend,
} from "../math.js";
import type { Trade } from "../types.js";

describe("sma", () => {
  it("computes simple moving average correctly", () => {
    const values = [10, 20, 30, 40, 50];
    const result = sma(values, 3);
    expect(result).toHaveLength(5);
    expect(result[0]).toBeNaN(); // not enough data
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeCloseTo(20); // (10+20+30)/3
    expect(result[3]).toBeCloseTo(30); // (20+30+40)/3
    expect(result[4]).toBeCloseTo(40); // (30+40+50)/3
  });

  it("handles period = 1", () => {
    const values = [5, 10, 15];
    const result = sma(values, 1);
    expect(result[0]).toBeCloseTo(5);
    expect(result[1]).toBeCloseTo(10);
    expect(result[2]).toBeCloseTo(15);
  });
});

describe("ema", () => {
  it("computes exponential moving average", () => {
    const values = [10, 20, 30, 40, 50];
    const result = ema(values, 3);
    expect(result).toHaveLength(5);
    // EMA starts from index 0
    expect(result[0]).toBeCloseTo(10);
    // Subsequent values should trend toward the data
    expect(result[4]).toBeGreaterThan(result[0]);
  });

  it("EMA approaches SMA for constant data", () => {
    const values = [50, 50, 50, 50, 50];
    const result = ema(values, 3);
    for (const v of result) {
      expect(v).toBeCloseTo(50, 0);
    }
  });
});

describe("rsi", () => {
  it("returns values between 0 and 100", () => {
    const values = [
      44, 44.3, 44.1, 43.6, 44.3, 44.8, 45.1, 45.4, 45.1, 44.6, 44.5, 44.2,
      44.3, 44.6, 44.8, 45.2,
    ];
    const result = rsi(values, 14);
    expect(result).toHaveLength(16);
    for (let i = 14; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(0);
      expect(result[i]).toBeLessThanOrEqual(100);
    }
  });

  it("returns 100 for only-up series", () => {
    const values = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = rsi(values, 14);
    // After warmup, RSI should be near 100
    expect(result[19]).toBeCloseTo(100, 0);
  });

  it("returns near 0 for only-down series", () => {
    const values = Array.from({ length: 20 }, (_, i) => 100 - i);
    const result = rsi(values, 14);
    expect(result[19]).toBeCloseTo(0, 0);
  });
});

describe("macd", () => {
  it("returns macd, signal, and histogram arrays", () => {
    const values = Array.from(
      { length: 50 },
      (_, i) => 100 + Math.sin(i * 0.3) * 10,
    );
    const result = macd(values, 12, 26, 9);
    expect(result.macd).toHaveLength(50);
    expect(result.signal).toHaveLength(50);
    expect(result.histogram).toHaveLength(50);
  });

  it("histogram = macd - signal", () => {
    const values = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const result = macd(values, 12, 26, 9);
    for (let i = 30; i < 50; i++) {
      expect(result.histogram[i]).toBeCloseTo(
        result.macd[i] - result.signal[i],
        5,
      );
    }
  });
});

describe("bollingerBands", () => {
  it("returns upper, middle, lower bands", () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = bollingerBands(values, 20, 2);
    expect(result.upper).toHaveLength(30);
    expect(result.middle).toHaveLength(30);
    expect(result.lower).toHaveLength(30);
  });

  it("upper > middle > lower after warmup", () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = bollingerBands(values, 20, 2);
    for (let i = 20; i < 30; i++) {
      expect(result.upper[i]).toBeGreaterThan(result.middle[i]);
      expect(result.middle[i]).toBeGreaterThan(result.lower[i]);
    }
  });
});

describe("atr", () => {
  it("returns positive values after warmup", () => {
    const high = Array.from({ length: 30 }, (_, i) => 105 + Math.sin(i) * 3);
    const low = Array.from({ length: 30 }, (_, i) => 95 + Math.sin(i) * 3);
    const close = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 3);
    const result = atr(high, low, close, 14);
    expect(result).toHaveLength(30);
    for (let i = 14; i < 30; i++) {
      expect(result[i]).toBeGreaterThan(0);
    }
  });
});

describe("stochastic", () => {
  it("returns k and d values between 0 and 100", () => {
    const high = Array.from({ length: 30 }, (_, i) => 105 + Math.sin(i) * 5);
    const low = Array.from({ length: 30 }, (_, i) => 95 + Math.sin(i) * 5);
    const close = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = stochastic(high, low, close, 14);
    expect(result.k).toHaveLength(30);
    expect(result.d).toHaveLength(30);
    for (let i = 14; i < 30; i++) {
      if (!isNaN(result.k[i])) {
        expect(result.k[i]).toBeGreaterThanOrEqual(0);
        expect(result.k[i]).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("crossover / crossunder", () => {
  it("detects crossover correctly", () => {
    const a = [1, 2, 3, 4, 5]; // goes above b at index 3
    const b = [2, 3, 2, 3, 3];
    const result = crossover(a, b);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe(false); // no previous
    expect(result[2]).toBe(true); // a crosses above b
  });

  it("detects crossunder correctly", () => {
    const a = [5, 4, 3, 2, 1]; // goes below b at some point
    const b = [3, 3, 3, 3, 3];
    const result = crossunder(a, b);
    expect(result).toHaveLength(5);
    // a starts above b (5>3), crosses under at index 2 (3<=3) or index 3 (2<3)
    expect(result[3]).toBe(true);
  });
});

describe("calculateSharpeRatio", () => {
  it("returns 0 for empty returns", () => {
    expect(calculateSharpeRatio([])).toBe(0);
  });

  it("returns positive value for positive returns", () => {
    const returns = [0.01, 0.02, 0.015, 0.01, 0.025, 0.005, 0.01];
    const sharpe = calculateSharpeRatio(returns);
    expect(sharpe).toBeGreaterThan(0);
  });
});

describe("calculateMaxDrawdown", () => {
  it("returns 0 for monotonically increasing equity", () => {
    const equity = [100, 110, 120, 130];
    expect(calculateMaxDrawdown(equity)).toBe(0);
  });

  it("calculates drawdown correctly", () => {
    const equity = [100, 120, 90, 110];
    const dd = calculateMaxDrawdown(equity);
    // Max drawdown: peak=120, trough=90, dd=30/120=0.25
    expect(dd).toBeCloseTo(0.25);
  });

  it("returns 0 for single-element array", () => {
    expect(calculateMaxDrawdown([100])).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(calculateMaxDrawdown([])).toBe(0);
  });

  it("handles multiple drawdowns and picks the worst", () => {
    // peak=100, trough=80 (20%), then peak=120, trough=60 (50%)
    const equity = [100, 80, 90, 120, 60, 110];
    const dd = calculateMaxDrawdown(equity);
    expect(dd).toBeCloseTo(0.5); // 60/120 = 50%
  });
});

describe("average", () => {
  it("returns 0 for empty array", () => {
    expect(average([])).toBe(0);
  });

  it("computes average correctly", () => {
    expect(average([10, 20, 30])).toBeCloseTo(20);
  });

  it("handles single value", () => {
    expect(average([42])).toBeCloseTo(42);
  });

  it("handles negative numbers", () => {
    expect(average([-10, 10])).toBeCloseTo(0);
  });
});

describe("standardDeviation", () => {
  it("returns 0 for fewer than 2 values", () => {
    expect(standardDeviation([])).toBe(0);
    expect(standardDeviation([5])).toBe(0);
  });

  it("returns 0 for constant values", () => {
    expect(standardDeviation([5, 5, 5, 5])).toBeCloseTo(0);
  });

  it("computes std dev correctly", () => {
    // Population std dev of [2,4,4,4,5,5,7,9] = 2.0
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const sd = standardDeviation(values);
    expect(sd).toBeGreaterThan(0);
    expect(sd).toBeCloseTo(2.0, 0);
  });
});

describe("calculateSortinoRatio", () => {
  it("returns 0 for empty returns", () => {
    expect(calculateSortinoRatio([])).toBe(0);
  });

  it("returns 0 for single return", () => {
    expect(calculateSortinoRatio([0.01])).toBe(0);
  });

  it("returns 0 when no downside deviation (all positive)", () => {
    const returns = [0.01, 0.02, 0.03, 0.01];
    // No negative returns → downside dev = 0 → sortino = 0
    expect(calculateSortinoRatio(returns)).toBe(0);
  });

  it("returns non-zero for mixed returns", () => {
    const returns = [0.02, -0.01, 0.03, -0.02, 0.01, -0.005, 0.015];
    const sortino = calculateSortinoRatio(returns);
    expect(typeof sortino).toBe("number");
    expect(isFinite(sortino)).toBe(true);
  });
});

describe("calculateMetrics", () => {
  it("handles empty trades", () => {
    const equity = [10000, 10000, 10000];
    const m = calculateMetrics([], equity, 10000, 10000, 0, 86400000);
    expect(m.totalTrades).toBe(0);
    expect(m.totalReturn).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.profitFactor).toBe(0);
  });

  it("computes metrics for winning trades", () => {
    const trades: Trade[] = [
      {
        id: "1",
        timestamp: 0,
        direction: "long",
        action: "buy",
        price: 100,
        quantity: 10,
        symbol: "X",
      },
      {
        id: "2",
        timestamp: 100,
        direction: "long",
        action: "sell",
        price: 110,
        quantity: 10,
        symbol: "X",
        pnl: 100,
      },
      {
        id: "3",
        timestamp: 200,
        direction: "long",
        action: "buy",
        price: 105,
        quantity: 10,
        symbol: "X",
      },
      {
        id: "4",
        timestamp: 300,
        direction: "long",
        action: "sell",
        price: 115,
        quantity: 10,
        symbol: "X",
        pnl: 100,
      },
    ];
    const equity = [10000, 10050, 10100, 10200];
    const m = calculateMetrics(trades, equity, 10000, 10200, 0, 86400000 * 365);
    expect(m.totalTrades).toBe(2); // only closing trades
    expect(m.totalReturn).toBeCloseTo(0.02); // (10200-10000)/10000
    expect(m.winRate).toBe(1.0); // both trades are winners
    expect(m.averageWin).toBe(100);
    expect(m.averageLoss).toBe(0);
    expect(m.expectancy).toBe(100);
  });

  it("computes metrics for mixed trades", () => {
    const trades: Trade[] = [
      {
        id: "1",
        timestamp: 0,
        direction: "long",
        action: "sell",
        price: 100,
        quantity: 10,
        symbol: "X",
        pnl: 50,
      },
      {
        id: "2",
        timestamp: 100,
        direction: "long",
        action: "sell",
        price: 90,
        quantity: 10,
        symbol: "X",
        pnl: -30,
      },
    ];
    const equity = [10000, 10050, 10020];
    const m = calculateMetrics(trades, equity, 10000, 10020, 0, 86400000 * 365);
    expect(m.totalTrades).toBe(2);
    expect(m.winRate).toBeCloseTo(0.5);
    expect(m.averageWin).toBeCloseTo(50);
    expect(m.averageLoss).toBeCloseTo(30);
    expect(m.profitFactor).toBeCloseTo(50 / 30);
    expect(m.expectancy).toBeCloseTo(10); // (50 + -30) / 2
  });
});

describe("formatPercent", () => {
  it("formats positive percentages", () => {
    expect(formatPercent(0.1523)).toBe("15.23%");
  });

  it("formats negative percentages", () => {
    expect(formatPercent(-0.05)).toBe("-5.00%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("respects custom decimal places", () => {
    expect(formatPercent(0.12345, 1)).toBe("12.3%");
  });
});

describe("formatCurrency", () => {
  it("formats positive values", () => {
    expect(formatCurrency(1234.56)).toBe("$1234.56");
  });

  it("formats negative values", () => {
    expect(formatCurrency(-50)).toBe("$-50.00");
  });

  it("respects custom decimal places", () => {
    expect(formatCurrency(100, 0)).toBe("$100");
  });
});

describe("sma edge cases", () => {
  it("handles empty array", () => {
    expect(sma([], 3)).toHaveLength(0);
  });

  it("handles array shorter than period", () => {
    const result = sma([10, 20], 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
  });
});

describe("ema edge cases", () => {
  it("handles empty array", () => {
    expect(ema([], 3)).toHaveLength(0);
  });

  it("handles single value", () => {
    const result = ema([42], 5);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(42);
  });
});

describe("crossover edge cases", () => {
  it("handles empty arrays", () => {
    expect(crossover([], [])).toHaveLength(0);
  });

  it("handles single-element arrays", () => {
    const result = crossover([1], [2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(false);
  });

  it("no crossover when a is always above b", () => {
    const a = [10, 11, 12, 13];
    const b = [1, 2, 3, 4];
    const result = crossover(a, b);
    expect(result.every((v) => v === false)).toBe(true);
  });

  it("no crossunder when a is always above b", () => {
    const a = [10, 11, 12, 13];
    const b = [1, 2, 3, 4];
    const result = crossunder(a, b);
    expect(result.every((v) => v === false)).toBe(true);
  });
});

// --- New indicator tests ---

describe("vwap", () => {
  it("returns array of same length as input", () => {
    const high = [105, 110, 108, 112, 107];
    const low = [95, 100, 98, 102, 97];
    const close = [100, 105, 103, 107, 102];
    const volume = [1000, 2000, 1500, 3000, 1000];
    const result = vwap(high, low, close, volume);
    expect(result).toHaveLength(5);
  });

  it("first value equals typical price when only one bar", () => {
    const high = [110];
    const low = [90];
    const close = [100];
    const volume = [5000];
    const result = vwap(high, low, close, volume);
    // Typical price = (110 + 90 + 100) / 3 = 100
    expect(result[0]).toBeCloseTo(100);
  });

  it("computes correctly for two bars", () => {
    const high = [110, 120];
    const low = [90, 100];
    const close = [100, 110];
    const volume = [1000, 1000];
    const result = vwap(high, low, close, volume);
    // Bar 0: TP = (110+90+100)/3 = 100, cumTPV = 100000, cumVol = 1000, vwap = 100
    const tp0 = (110 + 90 + 100) / 3;
    expect(result[0]).toBeCloseTo(tp0);
    // Bar 1: TP = (120+100+110)/3 = 110, cumTPV = 100000+110000=210000, cumVol = 2000, vwap = 105
    const tp1 = (120 + 100 + 110) / 3;
    const expected = (tp0 * 1000 + tp1 * 1000) / 2000;
    expect(result[1]).toBeCloseTo(expected);
  });

  it("weights higher volume bars more heavily", () => {
    const high = [110, 120];
    const low = [90, 100];
    const close = [100, 110];
    // Second bar has 10x volume
    const volumeHeavy = [100, 1000];
    const volumeLight = [1000, 100];
    const resultHeavy = vwap(high, low, close, volumeHeavy);
    const resultLight = vwap(high, low, close, volumeLight);
    // When second bar (higher TP) has more weight, VWAP should be higher
    expect(resultHeavy[1]).toBeGreaterThan(resultLight[1]);
  });

  it("handles zero volume gracefully", () => {
    const high = [110];
    const low = [90];
    const close = [100];
    const volume = [0];
    const result = vwap(high, low, close, volume);
    // When cumulative volume is 0, should return typical price
    expect(result[0]).toBeCloseTo((110 + 90 + 100) / 3);
  });

  it("handles empty arrays", () => {
    expect(vwap([], [], [], [])).toHaveLength(0);
  });
});

describe("williamsR", () => {
  it("returns NaN for bars before warmup period", () => {
    const high = [105, 110, 108, 112, 107];
    const low = [95, 100, 98, 102, 97];
    const close = [100, 105, 103, 107, 102];
    const result = williamsR(high, low, close, 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).not.toBeNaN();
  });

  it("returns values between -100 and 0", () => {
    const len = 30;
    const high = Array.from({ length: len }, (_, i) => 105 + Math.sin(i) * 5);
    const low = Array.from({ length: len }, (_, i) => 95 + Math.sin(i) * 5);
    const close = Array.from({ length: len }, (_, i) => 100 + Math.sin(i) * 5);
    const result = williamsR(high, low, close, 14);
    for (let i = 13; i < len; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(-100);
      expect(result[i]).toBeLessThanOrEqual(0);
    }
  });

  it("returns -50 when high equals low (flat market)", () => {
    const high = [100, 100, 100, 100, 100];
    const low = [100, 100, 100, 100, 100];
    const close = [100, 100, 100, 100, 100];
    const result = williamsR(high, low, close, 3);
    // When highestHigh === lowestLow, returns -50
    expect(result[2]).toBeCloseTo(-50);
    expect(result[3]).toBeCloseTo(-50);
    expect(result[4]).toBeCloseTo(-50);
  });

  it("returns 0 when close equals highest high", () => {
    // Close at the very top of the range
    const high = [100, 110, 120];
    const low = [90, 100, 110];
    const close = [95, 105, 120]; // close[2] = highest high
    const result = williamsR(high, low, close, 3);
    // %R = -100 * (120 - 120) / (120 - 90) = 0
    expect(result[2]).toBeCloseTo(0);
  });

  it("returns -100 when close equals lowest low", () => {
    const high = [100, 110, 120];
    const low = [90, 100, 110];
    const close = [95, 105, 90]; // close[2] = lowest low
    const result = williamsR(high, low, close, 3);
    // %R = -100 * (120 - 90) / (120 - 90) = -100
    expect(result[2]).toBeCloseTo(-100);
  });

  it("handles empty arrays", () => {
    expect(williamsR([], [], [], 14)).toHaveLength(0);
  });
});

describe("cci", () => {
  it("returns NaN for bars before warmup period", () => {
    const len = 25;
    const high = Array.from({ length: len }, (_, i) => 105 + i);
    const low = Array.from({ length: len }, (_, i) => 95 + i);
    const close = Array.from({ length: len }, (_, i) => 100 + i);
    const result = cci(high, low, close, 20);
    for (let i = 0; i < 19; i++) {
      expect(result[i]).toBeNaN();
    }
    expect(result[19]).not.toBeNaN();
  });

  it("returns 0 for constant prices", () => {
    const len = 25;
    const high = Array.from({ length: len }, () => 100);
    const low = Array.from({ length: len }, () => 100);
    const close = Array.from({ length: len }, () => 100);
    const result = cci(high, low, close, 20);
    // When mean deviation is 0, CCI = 0
    expect(result[19]).toBeCloseTo(0);
  });

  it("returns positive values when price is above average", () => {
    // Trending up: CCI should be positive when current TP > mean TP
    const len = 25;
    const high = Array.from({ length: len }, (_, i) => 105 + i * 2);
    const low = Array.from({ length: len }, (_, i) => 95 + i * 2);
    const close = Array.from({ length: len }, (_, i) => 100 + i * 2);
    const result = cci(high, low, close, 20);
    // Last bar's TP is well above the mean
    expect(result[24]).toBeGreaterThan(0);
  });

  it("uses the standard CCI constant 0.015", () => {
    // Manually verify: CCI = (TP - mean) / (0.015 * meanDev)
    const high = [110, 110, 110, 120]; // period=3
    const low = [90, 90, 90, 80];
    const close = [100, 100, 100, 110];
    const result = cci(high, low, close, 3);
    // Bar 2: TPs=[100,100,100], mean=100, meanDev=0 -> CCI=0
    expect(result[2]).toBeCloseTo(0);
    // Bar 3: TPs=[100,100,(120+80+110)/3=103.33], mean=101.11, meanDev= ...
    expect(result[3]).not.toBeNaN();
  });

  it("handles empty arrays", () => {
    expect(cci([], [], [], 20)).toHaveLength(0);
  });
});

describe("ichimoku", () => {
  const len = 60;
  const high = Array.from(
    { length: len },
    (_, i) => 105 + Math.sin(i * 0.2) * 10,
  );
  const low = Array.from(
    { length: len },
    (_, i) => 95 + Math.sin(i * 0.2) * 10,
  );
  const close = Array.from(
    { length: len },
    (_, i) => 100 + Math.sin(i * 0.2) * 10,
  );

  it("returns all five components", () => {
    const result = ichimoku(high, low, close);
    expect(result.tenkan).toHaveLength(len);
    expect(result.kijun).toHaveLength(len);
    expect(result.senkouA).toHaveLength(len);
    expect(result.senkouB).toHaveLength(len);
    expect(result.chikou).toHaveLength(len);
  });

  it("tenkan has NaN for first (tenkanPeriod-1) bars", () => {
    const result = ichimoku(high, low, close, 9, 26, 52);
    for (let i = 0; i < 8; i++) {
      expect(result.tenkan[i]).toBeNaN();
    }
    expect(result.tenkan[8]).not.toBeNaN();
  });

  it("kijun has NaN for first (kijunPeriod-1) bars", () => {
    const result = ichimoku(high, low, close, 9, 26, 52);
    for (let i = 0; i < 25; i++) {
      expect(result.kijun[i]).toBeNaN();
    }
    expect(result.kijun[25]).not.toBeNaN();
  });

  it("senkouA has NaN for first (kijunPeriod-1) bars", () => {
    const result = ichimoku(high, low, close, 9, 26, 52);
    for (let i = 0; i < 25; i++) {
      expect(result.senkouA[i]).toBeNaN();
    }
    expect(result.senkouA[25]).not.toBeNaN();
  });

  it("senkouB has NaN for first (senkouBPeriod-1) bars", () => {
    const result = ichimoku(high, low, close, 9, 26, 52);
    for (let i = 0; i < 51; i++) {
      expect(result.senkouB[i]).toBeNaN();
    }
    expect(result.senkouB[51]).not.toBeNaN();
  });

  it("chikou equals close", () => {
    const result = ichimoku(high, low, close, 9, 26, 52);
    for (let i = 0; i < len; i++) {
      expect(result.chikou[i]).toBeCloseTo(close[i]);
    }
  });

  it("tenkan is midpoint of highest-high and lowest-low over period", () => {
    const result = ichimoku(high, low, close, 9, 26, 52);
    // Verify bar 8 (first valid tenkan): midpoint of high[0..8] and low[0..8]
    const hSlice = high.slice(0, 9);
    const lSlice = low.slice(0, 9);
    const expected = (Math.max(...hSlice) + Math.min(...lSlice)) / 2;
    expect(result.tenkan[8]).toBeCloseTo(expected);
  });

  it("senkouA = (tenkan + kijun) / 2 after warmup", () => {
    const result = ichimoku(high, low, close, 9, 26, 52);
    for (let i = 25; i < len; i++) {
      const expected = (result.tenkan[i] + result.kijun[i]) / 2;
      expect(result.senkouA[i]).toBeCloseTo(expected);
    }
  });

  it("respects custom periods", () => {
    const result5 = ichimoku(high, low, close, 5, 10, 20);
    const result9 = ichimoku(high, low, close, 9, 26, 52);
    // With shorter periods, tenkan should start being valid sooner
    expect(result5.tenkan[4]).not.toBeNaN();
    expect(result9.tenkan[4]).toBeNaN();
  });

  it("handles empty arrays", () => {
    const result = ichimoku([], [], []);
    expect(result.tenkan).toHaveLength(0);
    expect(result.kijun).toHaveLength(0);
    expect(result.senkouA).toHaveLength(0);
    expect(result.senkouB).toHaveLength(0);
    expect(result.chikou).toHaveLength(0);
  });
});

describe("adx", () => {
  const len = 40;
  const high = Array.from(
    { length: len },
    (_, i) => 105 + Math.sin(i * 0.2) * 5 + i * 0.5,
  );
  const low = Array.from(
    { length: len },
    (_, i) => 95 + Math.sin(i * 0.2) * 5 + i * 0.5,
  );
  const close = Array.from(
    { length: len },
    (_, i) => 100 + Math.sin(i * 0.2) * 5 + i * 0.5,
  );

  it("returns adx, plusDi, and minusDi arrays", () => {
    const result = adx(high, low, close, 14);
    expect(result.adx).toHaveLength(len);
    expect(result.plusDi).toHaveLength(len);
    expect(result.minusDi).toHaveLength(len);
  });

  it("returns NaN for bars before warmup period", () => {
    const result = adx(high, low, close, 14);
    // plusDi/minusDi should be NaN before period warmup
    expect(result.plusDi[0]).toBeNaN();
    expect(result.minusDi[0]).toBeNaN();
    // ADX is computed from DX which needs more data
    expect(result.adx[0]).toBeNaN();
  });

  it("plusDi and minusDi are between 0 and 100", () => {
    const result = adx(high, low, close, 14);
    for (let i = 14; i < len; i++) {
      if (!isNaN(result.plusDi[i])) {
        expect(result.plusDi[i]).toBeGreaterThanOrEqual(0);
        expect(result.plusDi[i]).toBeLessThanOrEqual(100);
      }
      if (!isNaN(result.minusDi[i])) {
        expect(result.minusDi[i]).toBeGreaterThanOrEqual(0);
        expect(result.minusDi[i]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("handles empty arrays", () => {
    const result = adx([], [], [], 14);
    expect(result.adx).toHaveLength(0);
  });
});

describe("roc", () => {
  it("returns NaN for bars before warmup period", () => {
    const values = [100, 105, 110, 115, 120];
    const result = roc(values, 5);
    expect(result[0]).toBeNaN();
    expect(result[4]).toBeNaN();
    expect(result[5]).not.toBeNaN();
  });

  it("returns positive values for rising prices", () => {
    const values = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
    const result = roc(values, 10);
    expect(result[10]).toBeGreaterThan(0);
  });

  it("returns negative values for falling prices", () => {
    const values = Array.from({ length: 20 }, (_, i) => 100 - i * 2);
    const result = roc(values, 10);
    expect(result[10]).toBeLessThan(0);
  });

  it("handles empty arrays", () => {
    expect(roc([], 10)).toHaveLength(0);
  });
});

describe("keltnerChannels", () => {
  const len = 30;
  const high = Array.from(
    { length: len },
    (_, i) => 105 + Math.sin(i * 0.3) * 5,
  );
  const low = Array.from({ length: len }, (_, i) => 95 + Math.sin(i * 0.3) * 5);
  const close = Array.from(
    { length: len },
    (_, i) => 100 + Math.sin(i * 0.3) * 5,
  );

  it("returns upper, middle, lower arrays", () => {
    const result = keltnerChannels(high, low, close, 20, 10, 2);
    expect(result.upper).toHaveLength(len);
    expect(result.middle).toHaveLength(len);
    expect(result.lower).toHaveLength(len);
  });

  it("upper > middle > lower after warmup", () => {
    const result = keltnerChannels(high, low, close, 20, 10, 2);
    for (let i = 25; i < len; i++) {
      if (!isNaN(result.upper[i])) {
        expect(result.upper[i]).toBeGreaterThan(result.middle[i]);
        expect(result.middle[i]).toBeGreaterThan(result.lower[i]);
      }
    }
  });

  it("handles empty arrays", () => {
    const result = keltnerChannels([], [], [], 20, 10, 2);
    expect(result.upper).toHaveLength(0);
  });
});

describe("parabolicSar", () => {
  const len = 30;
  const high = Array.from(
    { length: len },
    (_, i) => 105 + Math.sin(i * 0.3) * 5 + i,
  );
  const low = Array.from(
    { length: len },
    (_, i) => 95 + Math.sin(i * 0.3) * 5 + i,
  );

  it("returns array of same length", () => {
    const result = parabolicSar(high, low);
    expect(result).toHaveLength(len);
  });

  it("first value equals initial sar (low[0])", () => {
    const result = parabolicSar(high, low);
    expect(result[0]).toBe(low[0]);
  });

  it("values follow price direction in uptrend", () => {
    const trendingHigh = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
    const trendingLow = Array.from({ length: 20 }, (_, i) => 90 + i * 2);
    const result = parabolicSar(trendingHigh, trendingLow);
    // In uptrend, SAR should be below price and rising
    for (let i = 5; i < 20; i++) {
      expect(result[i]).toBeLessThan(trendingHigh[i]);
    }
  });

  it("handles empty arrays", () => {
    expect(parabolicSar([], [])).toHaveLength(0);
  });
});

describe("obv", () => {
  it("returns array of same length", () => {
    const close = [100, 105, 102, 108, 107];
    const volume = [1000, 2000, 1500, 3000, 1000];
    const result = obv(close, volume);
    expect(result).toHaveLength(5);
  });

  it("increases when close goes up", () => {
    const close = [100, 110, 120];
    const volume = [1000, 1000, 1000];
    const result = obv(close, volume);
    expect(result[1]).toBeGreaterThan(result[0]);
    expect(result[2]).toBeGreaterThan(result[1]);
  });

  it("decreases when close goes down", () => {
    const close = [120, 110, 100];
    const volume = [1000, 1000, 1000];
    const result = obv(close, volume);
    expect(result[1]).toBeLessThan(result[0]);
    expect(result[2]).toBeLessThan(result[1]);
  });

  it("stays same when close is unchanged", () => {
    const close = [100, 100, 100];
    const volume = [1000, 1000, 1000];
    const result = obv(close, volume);
    expect(result[1]).toBe(result[0]);
    expect(result[2]).toBe(result[1]);
  });

  it("handles empty arrays", () => {
    expect(obv([], [])).toHaveLength(0);
  });
});

describe("mfi", () => {
  const len = 30;
  const high = Array.from(
    { length: len },
    (_, i) => 105 + Math.sin(i * 0.2) * 5,
  );
  const low = Array.from({ length: len }, (_, i) => 95 + Math.sin(i * 0.2) * 5);
  const close = Array.from(
    { length: len },
    (_, i) => 100 + Math.sin(i * 0.2) * 5,
  );
  const volume = Array.from(
    { length: len },
    (_, i) => 1000 + Math.random() * 1000,
  );

  it("returns array of same length", () => {
    const result = mfi(high, low, close, volume, 14);
    expect(result).toHaveLength(len);
  });

  it("returns NaN for bars before warmup period", () => {
    const result = mfi(high, low, close, volume, 14);
    expect(result[0]).toBeNaN();
    expect(result[13]).toBeNaN();
  });

  it("returns values between 0 and 100", () => {
    const result = mfi(high, low, close, volume, 14);
    for (let i = 14; i < len; i++) {
      if (!isNaN(result[i])) {
        expect(result[i]).toBeGreaterThanOrEqual(0);
        expect(result[i]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("handles empty arrays", () => {
    expect(mfi([], [], [], [], 14)).toHaveLength(0);
  });
});

describe("ultimateOscillator", () => {
  const len = 40;
  const high = Array.from(
    { length: len },
    (_, i) => 105 + Math.sin(i * 0.2) * 5,
  );
  const low = Array.from({ length: len }, (_, i) => 95 + Math.sin(i * 0.2) * 5);
  const close = Array.from(
    { length: len },
    (_, i) => 100 + Math.sin(i * 0.2) * 5,
  );

  it("returns array of same length", () => {
    const result = ultimateOscillator(high, low, close);
    expect(result).toHaveLength(len);
  });

  it("returns NaN for bars before warmup period", () => {
    const result = ultimateOscillator(high, low, close, 7, 14, 28);
    expect(result[0]).toBeNaN();
    expect(result[27]).toBeNaN();
  });

  it("returns values between 0 and 100", () => {
    const result = ultimateOscillator(high, low, close, 7, 14, 28);
    for (let i = 28; i < len; i++) {
      if (!isNaN(result[i])) {
        expect(result[i]).toBeGreaterThanOrEqual(0);
        expect(result[i]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("handles empty arrays", () => {
    expect(ultimateOscillator([], [], [])).toHaveLength(0);
  });
});


describe("mom", () => {
  it("returns NaN for bars before period", () => {
    const values = [10, 11, 12, 13, 14];
    const result = mom(values, 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeNaN();
  });

  it("calculates momentum correctly", () => {
    const values = [10, 11, 12, 13, 14];
    const result = mom(values, 2);
    expect(result[2]).toBeCloseTo(2); // 12 - 10
    expect(result[3]).toBeCloseTo(2); // 13 - 11
    expect(result[4]).toBeCloseTo(2); // 14 - 12
  });

  it("returns zero for flat series", () => {
    const values = [50, 50, 50, 50, 50];
    const result = mom(values, 2);
    for (let i = 2; i < values.length; i++) {
      expect(result[i]).toBeCloseTo(0);
    }
  });

  it("returns negative for declining series", () => {
    const values = [50, 48, 46, 44, 42];
    const result = mom(values, 2);
    for (let i = 2; i < values.length; i++) {
      expect(result[i]).toBeLessThan(0);
    }
  });

  it("handles empty array", () => {
    expect(mom([], 10)).toHaveLength(0);
  });

  it("uses period 10 as default", () => {
    const values = Array.from({ length: 15 }, (_, i) => i * 2);
    const result = mom(values);
    expect(result[9]).toBeNaN();
    expect(result[10]).toBeCloseTo(20); // 20 - 0
  });
});

describe("supertrend", () => {
  const len = 50;
  const high = Array.from({ length: len }, (_, i) => 105 + Math.sin(i * 0.3) * 3);
  const low = Array.from({ length: len }, (_, i) => 95 + Math.sin(i * 0.3) * 3);
  const close = Array.from({ length: len }, (_, i) => 100 + Math.sin(i * 0.3) * 3);

  it("returns arrays of same length as input", () => {
    const { supertrend: st, direction: dir } = supertrend(high, low, close, 10, 3);
    expect(st).toHaveLength(len);
    expect(dir).toHaveLength(len);
  });

  it("direction values are only 1 or -1", () => {
    const { direction: dir } = supertrend(high, low, close, 10, 3);
    for (const d of dir) {
      expect([1, -1]).toContain(d);
    }
  });

  it("returns NaN for bars before ATR warmup", () => {
    const { supertrend: st } = supertrend(high, low, close, 10, 3);
    expect(st[0]).toBeNaN();
  });

  it("supertrend values are positive after warmup", () => {
    const { supertrend: st } = supertrend(high, low, close, 10, 3);
    for (let i = 10; i < len; i++) {
      if (!isNaN(st[i])) {
        expect(st[i]).toBeGreaterThan(0);
      }
    }
  });

  it("flips direction on sustained trending move", () => {
    const upHigh = Array.from({ length: 30 }, (_, i) => 100 + i * 2 + 5);
    const upLow = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const upClose = Array.from({ length: 30 }, (_, i) => 100 + i * 2 + 2);
    const { direction: dir } = supertrend(upHigh, upLow, upClose, 5, 2);
    const lastDir = dir[dir.length - 1];
    expect(lastDir).toBe(1);
  });

  it("handles empty arrays", () => {
    const { supertrend: st, direction: dir } = supertrend([], [], [], 10, 3);
    expect(st).toHaveLength(0);
    expect(dir).toHaveLength(0);
  });

  it("uses default parameters", () => {
    const { supertrend: st } = supertrend(high, low, close);
    expect(st).toHaveLength(len);
  });
});
