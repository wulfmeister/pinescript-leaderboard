import { describe, it, expect } from "vitest";
import { PineExporter } from "../exporter.js";

describe("PineExporter", () => {
  const exporter = new PineExporter();

  describe("exportCrossover", () => {
    it("generates valid EMA crossover PineScript", () => {
      const code = exporter.exportCrossover("ema", 10, 30);
      expect(code).toContain("//@version=5");
      expect(code).toContain('strategy("EMA Crossover 10/30"');
      expect(code).toContain("ta.ema(close, fastLen)");
      expect(code).toContain("ta.ema(close, slowLen)");
      expect(code).toContain("ta.crossover(fast, slow)");
      expect(code).toContain('strategy.entry("Long"');
      expect(code).toContain("ta.crossunder(fast, slow)");
      expect(code).toContain('strategy.close("Long"');
      expect(code).toContain("input.int(10");
      expect(code).toContain("input.int(30");
    });

    it("generates SMA crossover", () => {
      const code = exporter.exportCrossover("sma", 5, 20);
      expect(code).toContain("ta.sma(close, fastLen)");
      expect(code).toContain('SMA Crossover 5/20"');
    });
  });

  describe("exportRSI", () => {
    it("generates valid RSI strategy", () => {
      const code = exporter.exportRSI(14, 70, 30);
      expect(code).toContain("ta.rsi(close, rsiPeriod)");
      expect(code).toContain("rsiVal < oversold");
      expect(code).toContain("rsiVal > overbought");
      expect(code).toContain("input.int(14");
      expect(code).toContain("input.int(70");
      expect(code).toContain("input.int(30");
      expect(code).toContain("overlay=false");
    });
  });

  describe("exportMACD", () => {
    it("generates valid MACD strategy", () => {
      const code = exporter.exportMACD(12, 26, 9);
      expect(code).toContain("[macdLine, signalLine, histLine] = ta.macd");
      expect(code).toContain("ta.crossover(macdLine, signalLine)");
      expect(code).toContain("ta.crossunder(macdLine, signalLine)");
    });
  });

  describe("exportBollingerBands", () => {
    it("generates valid BB strategy", () => {
      const code = exporter.exportBollingerBands(20, 2);
      expect(code).toContain("[bbUpper, bbMiddle, bbLower] = ta.bb");
      expect(code).toContain("close < bbLower");
      expect(code).toContain("close > bbUpper");
    });
  });

  describe("exportStrategy", () => {
    it("includes comments when enabled", () => {
      const code = exporter.exportCrossover("ema", 10, 30, { addComments: true });
      expect(code).toContain("// ──");
    });

    it("excludes comments when disabled", () => {
      const code = exporter.exportCrossover("ema", 10, 30, { addComments: false });
      expect(code).not.toContain("// ──");
    });

    it("includes commission when specified", () => {
      const code = exporter.exportCrossover("ema", 10, 30, { commission: 0.1 });
      expect(code).toContain("commission_type=strategy.commission.percent");
      expect(code).toContain("commission_value=0.1");
    });

    it("respects custom version", () => {
      const code = exporter.exportCrossover("ema", 10, 30, { version: 6 });
      expect(code).toContain("//@version=6");
    });
  });
});
