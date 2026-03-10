import { describe, it, expect } from "vitest";
import {
  generateHTMLReport,
  DEFAULT_REPORT_OPTIONS,
} from "../html-reporter.js";
import type {
  BacktestResult,
  OHLCV,
  PerformanceMetrics,
} from "@pinescript-utils/core";

function makeMetrics(
  overrides: Partial<PerformanceMetrics> = {},
): PerformanceMetrics {
  return {
    totalReturn: 0.15,
    annualizedReturn: 0.12,
    totalTrades: 20,
    sharpeRatio: 1.5,
    sortinoRatio: 2.0,
    maxDrawdown: 0.08,
    volatility: 0.15,
    winRate: 0.6,
    profitFactor: 1.8,
    averageWin: 250,
    averageLoss: 150,
    expectancy: 50,
    averageTrade: 75,
    averageTradeDuration: 86400000,
    maxTradeDuration: 259200000,
    minTradeDuration: 3600000,
    ...overrides,
  };
}

function makeEquityCurve(count: number) {
  const start = new Date("2024-01-02T00:00:00Z").getTime();
  const day = 86400000;
  return Array.from({ length: count }, (_, i) => ({
    timestamp: start + i * day,
    equity: 10000 + i * 50,
    drawdown: i > 5 ? -0.02 * (i - 5) : 0,
  }));
}

function makeTrades() {
  return [
    {
      id: "t1",
      timestamp: new Date("2024-01-05T00:00:00Z").getTime(),
      direction: "long" as const,
      action: "buy" as const,
      price: 150,
      quantity: 10,
      symbol: "AAPL",
    },
    {
      id: "t2",
      timestamp: new Date("2024-01-10T00:00:00Z").getTime(),
      direction: "long" as const,
      action: "sell" as const,
      price: 160,
      quantity: 10,
      symbol: "AAPL",
      pnl: 100,
    },
    {
      id: "t3",
      timestamp: new Date("2024-01-15T00:00:00Z").getTime(),
      direction: "long" as const,
      action: "buy" as const,
      price: 155,
      quantity: 10,
      symbol: "AAPL",
    },
    {
      id: "t4",
      timestamp: new Date("2024-02-01T00:00:00Z").getTime(),
      direction: "long" as const,
      action: "sell" as const,
      price: 145,
      quantity: 10,
      symbol: "AAPL",
      pnl: -100,
    },
  ];
}

function makeResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    trades: makeTrades(),
    equityCurve: makeEquityCurve(30),
    metrics: makeMetrics(),
    startTime: new Date("2024-01-01T00:00:00Z").getTime(),
    endTime: new Date("2024-02-01T00:00:00Z").getTime(),
    initialCapital: 10000,
    finalCapital: 11500,
    ...overrides,
  };
}

function makeOHLCV(count: number): OHLCV[] {
  const start = new Date("2024-01-01T00:00:00Z").getTime();
  const day = 86400000;
  return Array.from({ length: count }, (_, i) => ({
    timestamp: start + i * day,
    open: 100 + i,
    high: 102 + i,
    low: 98 + i,
    close: 101 + i,
    volume: 1000000,
  }));
}

describe("generateHTMLReport", () => {
  const result = makeResult();
  const data = makeOHLCV(30);

  describe("HTML structure", () => {
    it("returns valid HTML document", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain('<html lang="en">');
      expect(html).toContain("</html>");
    });

    it("includes report title", () => {
      const html = generateHTMLReport(result, data, {
        title: "My Custom Report",
      });
      expect(html).toContain("<title>My Custom Report</title>");
      expect(html).toContain("My Custom Report");
    });

    it("uses default title when none provided", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain(`<title>${DEFAULT_REPORT_OPTIONS.title}</title>`);
    });

    it("includes strategy name and symbol in subtitle", () => {
      const html = generateHTMLReport(result, data, {
        strategyName: "SMA Cross",
        symbol: "AAPL",
        timeframe: "1d",
      });
      expect(html).toContain("SMA Cross");
      expect(html).toContain("AAPL");
      expect(html).toContain("1d");
    });
  });

  describe("Lightweight Charts integration", () => {
    it("includes Lightweight Charts CDN script (pinned version)", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain(
        "https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js",
      );
    });

    it("does NOT include Chart.js CDN", () => {
      const html = generateHTMLReport(result, data);
      expect(html).not.toContain("chart.js");
      expect(html).not.toContain("Chart.js");
      expect(html).not.toContain("cdn.jsdelivr.net/npm/chart.js");
    });

    it("uses div containers instead of canvas elements for charts", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain('<div id="equityChart"');
      expect(html).toContain('<div id="drawdownChart"');
      expect(html).toContain('<div id="monthlyReturnsChart"');
      expect(html).not.toContain('<canvas id="equityChart"');
      expect(html).not.toContain('<canvas id="drawdownChart"');
    });

    it("uses LightweightCharts.createChart() in scripts", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("LightweightCharts.createChart");
    });

    it("uses LightweightCharts.LineSeries for equity chart", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("LightweightCharts.LineSeries");
    });

    it("uses LightweightCharts.AreaSeries for drawdown chart", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("LightweightCharts.AreaSeries");
    });

    it("uses LightweightCharts.HistogramSeries for monthly returns", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("LightweightCharts.HistogramSeries");
    });

    it("includes invertScale for drawdown chart", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("invertScale: true");
    });

    it("calls fitContent on all charts", () => {
      const html = generateHTMLReport(result, data);
      const matches = html.match(/fitContent\(\)/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(3);
    });

    it('includes subscribeCrosshairMove for tooltips', () => {
      const html = generateHTMLReport(result, data);
      const count = (html.match(/subscribeCrosshairMove/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('includes Reset Zoom buttons', () => {
      const html = generateHTMLReport(result, data);
      const count = (html.match(/Reset Zoom/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('includes tooltip div', () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain('id="tooltip"');
    });
  });

  describe("chart data", () => {
    it("serializes equity data with date strings as time", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain('"time":"2024-01-02"');
    });

    it("deduplicates data by date (strictly increasing timestamps)", () => {
      const duplicateEquity = [
        {
          timestamp: new Date("2024-01-02T09:00:00Z").getTime(),
          equity: 10000,
          drawdown: 0,
        },
        {
          timestamp: new Date("2024-01-02T16:00:00Z").getTime(),
          equity: 10050,
          drawdown: 0,
        },
        {
          timestamp: new Date("2024-01-03T09:00:00Z").getTime(),
          equity: 10100,
          drawdown: 0,
        },
      ];
      const dupResult = makeResult({ equityCurve: duplicateEquity });
      const html = generateHTMLReport(dupResult, data);

      const equityDataMatch = html.match(/equitySeries\.setData\((\[.*?\])\)/s);
      expect(equityDataMatch).not.toBeNull();
      const equityParsed = JSON.parse(equityDataMatch![1]);
      const jan2Entries = equityParsed.filter(
        (d: { time: string }) => d.time === "2024-01-02",
      );
      expect(jan2Entries).toHaveLength(1);
      expect(jan2Entries[0].value).toBe(10050);
    });

    it("monthly returns have per-bar colors (green/red)", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain('"color":"#27ae60"');
    });
  });

  describe("theme support", () => {
    it("dark theme uses dark chart background and text colors", () => {
      const html = generateHTMLReport(result, data, { theme: "dark" });
      expect(html).toContain("#18181b");
      expect(html).toContain("#a1a1aa");
    });

    it("light theme uses light chart background and text colors", () => {
      const html = generateHTMLReport(result, data, { theme: "light" });
      expect(html).toContain("#ffffff");
      expect(html).toContain("#2c3e50");
    });

    it("dark theme body has dark background", () => {
      const html = generateHTMLReport(result, data, { theme: "dark" });
      expect(html).toContain("background: #1a1a1a");
    });

    it("light theme body has light background", () => {
      const html = generateHTMLReport(result, data, { theme: "light" });
      expect(html).toContain("background: #f5f5f5");
    });
  });

  describe("metric cards", () => {
    it("includes all key metrics", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("Total Return");
      expect(html).toContain("Annualized Return");
      expect(html).toContain("Win Rate");
      expect(html).toContain("Sharpe Ratio");
      expect(html).toContain("Sortino Ratio");
      expect(html).toContain("Max Drawdown");
      expect(html).toContain("Profit Factor");
      expect(html).toContain("Volatility");
      expect(html).toContain("Initial Capital");
      expect(html).toContain("Final Capital");
      expect(html).toContain("Expectancy");
    });

    it("formats percentage metrics correctly (0.15 → 15.00%)", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("15.00%");
    });

    it("formats currency metrics correctly ($10,000)", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("$10,000.00");
    });
  });

  describe("trade list", () => {
    it("includes trade history section when enabled", () => {
      const html = generateHTMLReport(result, data, { includeTradeList: true });
      expect(html).toContain("Trade History");
      expect(html).toContain("<table>");
    });

    it("excludes trade history section when disabled", () => {
      const html = generateHTMLReport(result, data, {
        includeTradeList: false,
      });
      expect(html).not.toContain("Trade History");
    });

    it("only shows closing trades (those with pnl)", () => {
      const html = generateHTMLReport(result, data, { includeTradeList: true });
      const trRows = html.match(/<tr>\s*<td>/g);
      expect(trRows).not.toBeNull();
      expect(trRows!.length).toBe(2);
    });

    it("shows positive pnl with positive class", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain('class="positive"');
    });

    it("shows negative pnl with negative class", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain('class="negative"');
    });
  });

  describe("charts toggle", () => {
    it("includes charts when enabled", () => {
      const html = generateHTMLReport(result, data, { includeCharts: true });
      expect(html).toContain("Equity Curve");
      expect(html).toContain("Drawdown");
      expect(html).toContain("Monthly Returns");
      expect(html).toContain("LightweightCharts.createChart");
    });

    it("excludes charts when disabled", () => {
      const html = generateHTMLReport(result, data, { includeCharts: false });
      expect(html).not.toContain('<div id="equityChart"');
      expect(html).not.toContain("LightweightCharts.createChart");
    });
  });

  describe("advanced analytics section", () => {
    it("includes risk/reward ratio", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("Risk/Reward Ratio");
    });

    it("includes win/loss streak analysis", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("Max Win Streak");
      expect(html).toContain("Max Loss Streak");
    });

    it("includes recovery factor", () => {
      const html = generateHTMLReport(result, data);
      expect(html).toContain("Recovery Factor");
    });
  });

  describe("edge cases", () => {
    it("handles empty equity curve", () => {
      const emptyResult = makeResult({ equityCurve: [] });
      const html = generateHTMLReport(emptyResult, data);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });

    it("handles empty trades", () => {
      const noTradesResult = makeResult({ trades: [] });
      const html = generateHTMLReport(noTradesResult, data);
      expect(html).toContain("No completed trades");
    });

    it("handles single equity point", () => {
      const singlePoint = makeResult({
        equityCurve: [{ timestamp: Date.now(), equity: 10000, drawdown: 0 }],
      });
      const html = generateHTMLReport(singlePoint, data);
      expect(html).toContain("<!DOCTYPE html>");
    });
  });
});

describe("DEFAULT_REPORT_OPTIONS", () => {
  it("has expected defaults", () => {
    expect(DEFAULT_REPORT_OPTIONS.title).toBe("Backtest Report");
    expect(DEFAULT_REPORT_OPTIONS.theme).toBe("light");
    expect(DEFAULT_REPORT_OPTIONS.includeCharts).toBe(true);
    expect(DEFAULT_REPORT_OPTIONS.includeTradeList).toBe(true);
  });
});
