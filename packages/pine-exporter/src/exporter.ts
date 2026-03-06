import type { StrategyConfig, IndicatorConfig } from "@pinescript-utils/core";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ExportOptions {
  /** PineScript version. Default: 5 */
  version?: number;
  /** Include overlay setting. Default: true */
  overlay?: boolean;
  /** Include default quantity. Default: "100%" */
  defaultQty?: string;
  /** Include initial capital. Default: 10000 */
  initialCapital?: number;
  /** Include commission. Default: undefined (omit) */
  commission?: number;
  /** Generate plot statements for indicators. Default: true */
  plotIndicators?: boolean;
  /** Add comments. Default: true */
  addComments?: boolean;
}

/** A higher-level strategy definition for export */
export interface ExportableStrategy {
  name: string;
  description?: string;
  /** Parameters: name → { default, title?, min?, max?, step? } */
  parameters?: Record<string, {
    default: number;
    title?: string;
    min?: number;
    max?: number;
    step?: number;
  }>;
  /** Indicator definitions */
  indicators: ExportableIndicator[];
  /** Entry conditions — PineScript condition expressions */
  entryConditions: string[];
  /** Exit conditions */
  exitConditions: string[];
  /** Entry ID */
  entryId?: string;
  /** Exit ID */
  exitId?: string;
}

export interface ExportableIndicator {
  /** Variable name */
  name: string;
  /** Indicator function: sma, ema, rsi, macd, bb, atr, stoch */
  type: string;
  /** Source (e.g., "close") */
  source?: string;
  /** Parameters — either literal numbers or parameter variable names */
  params: (number | string)[];
  /** For multi-output indicators (MACD, BB): variable names for each output */
  outputs?: string[];
  /** Plot color */
  color?: string;
}

// ──────────────────────────────────────────────
// Color palette for plots
// ──────────────────────────────────────────────

const COLORS = [
  "color.blue",
  "color.red",
  "color.green",
  "color.orange",
  "color.purple",
  "color.yellow",
  "color.aqua",
  "color.fuchsia",
];

// ──────────────────────────────────────────────
// Exporter
// ──────────────────────────────────────────────

export class PineExporter {
  /**
   * Generate PineScript v5 code from a strategy definition.
   */
  exportStrategy(
    strategy: ExportableStrategy,
    options: ExportOptions = {}
  ): string {
    const opts: Required<ExportOptions> = {
      version: options.version ?? 5,
      overlay: options.overlay ?? true,
      defaultQty: options.defaultQty ?? "100",
      initialCapital: options.initialCapital ?? 10000,
      commission: options.commission ?? 0,
      plotIndicators: options.plotIndicators ?? true,
      addComments: options.addComments ?? true,
    };

    const lines: string[] = [];

    // Version
    lines.push(`//@version=${opts.version}`);

    // Strategy declaration
    const stratArgs = [`"${strategy.name}"`];
    stratArgs.push(`overlay=${opts.overlay}`);
    stratArgs.push(`initial_capital=${opts.initialCapital}`);
    stratArgs.push(`default_qty_type=strategy.percent_of_equity`);
    stratArgs.push(`default_qty_value=${opts.defaultQty}`);
    if (opts.commission > 0) {
      stratArgs.push(`commission_type=strategy.commission.percent`);
      stratArgs.push(`commission_value=${opts.commission}`);
    }
    lines.push(`strategy(${stratArgs.join(", ")})`);
    lines.push("");

    // Parameters (inputs)
    if (strategy.parameters && Object.keys(strategy.parameters).length > 0) {
      if (opts.addComments) lines.push("// ── Parameters ──");
      for (const [name, p] of Object.entries(strategy.parameters)) {
        const args: string[] = [`${p.default}`];
        if (p.title) args.push(`title="${p.title}"`);
        if (p.min !== undefined) args.push(`minval=${p.min}`);
        if (p.max !== undefined) args.push(`maxval=${p.max}`);
        if (p.step !== undefined) args.push(`step=${p.step}`);
        lines.push(`${name} = input.int(${args.join(", ")})`);
      }
      lines.push("");
    }

    // Indicators
    if (strategy.indicators.length > 0) {
      if (opts.addComments) lines.push("// ── Indicators ──");
      for (const ind of strategy.indicators) {
        lines.push(this.generateIndicatorLine(ind));
      }
      lines.push("");
    }

    // Plot indicators
    if (opts.plotIndicators) {
      const plotLines = this.generatePlotLines(strategy.indicators);
      if (plotLines.length > 0) {
        if (opts.addComments) lines.push("// ── Plots ──");
        lines.push(...plotLines);
        lines.push("");
      }
    }

    // Entry conditions
    const entryId = strategy.entryId ?? "Long";
    if (strategy.entryConditions.length > 0) {
      if (opts.addComments) lines.push("// ── Entry Logic ──");
      const condStr = strategy.entryConditions.join(" and ");
      lines.push(`if (${condStr})`);
      lines.push(`    strategy.entry("${entryId}", strategy.long)`);
      lines.push("");
    }

    // Exit conditions
    if (strategy.exitConditions.length > 0) {
      if (opts.addComments) lines.push("// ── Exit Logic ──");
      const condStr = strategy.exitConditions.join(" and ");
      lines.push(`if (${condStr})`);
      lines.push(`    strategy.close("${entryId}")`);
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Generate PineScript v5 from the core StrategyConfig type.
   */
  exportFromConfig(
    config: StrategyConfig,
    options: ExportOptions = {}
  ): string {
    const indicators: ExportableIndicator[] = config.indicators.map(
      (ind, i) => this.configIndicatorToExportable(ind, i)
    );

    const strategy: ExportableStrategy = {
      name: config.name,
      indicators,
      entryConditions: config.entryRules,
      exitConditions: config.exitRules,
    };

    return this.exportStrategy(strategy, options);
  }

  /**
   * Quick export: generate a simple EMA/SMA crossover strategy.
   */
  exportCrossover(
    type: "ema" | "sma",
    fastPeriod: number,
    slowPeriod: number,
    options: ExportOptions = {}
  ): string {
    const fn = type.toUpperCase();
    const strategy: ExportableStrategy = {
      name: `${fn} Crossover ${fastPeriod}/${slowPeriod}`,
      parameters: {
        fastLen: { default: fastPeriod, title: `Fast ${fn} Length`, min: 1, max: 200 },
        slowLen: { default: slowPeriod, title: `Slow ${fn} Length`, min: 1, max: 500 },
      },
      indicators: [
        { name: "fast", type, source: "close", params: ["fastLen"], color: "color.blue" },
        { name: "slow", type, source: "close", params: ["slowLen"], color: "color.red" },
      ],
      entryConditions: [`ta.crossover(fast, slow)`],
      exitConditions: [`ta.crossunder(fast, slow)`],
    };
    return this.exportStrategy(strategy, options);
  }

  /**
   * Quick export: generate an RSI overbought/oversold strategy.
   */
  exportRSI(
    period: number = 14,
    overbought: number = 70,
    oversold: number = 30,
    options: ExportOptions = {}
  ): string {
    const strategy: ExportableStrategy = {
      name: `RSI Strategy ${period}`,
      parameters: {
        rsiPeriod: { default: period, title: "RSI Period", min: 2, max: 50 },
        overbought: { default: overbought, title: "Overbought Level", min: 50, max: 95 },
        oversold: { default: oversold, title: "Oversold Level", min: 5, max: 50 },
      },
      indicators: [
        { name: "rsiVal", type: "rsi", source: "close", params: ["rsiPeriod"] },
      ],
      entryConditions: [`rsiVal < oversold`],
      exitConditions: [`rsiVal > overbought`],
    };
    return this.exportStrategy(strategy, { ...options, overlay: false });
  }

  /**
   * Quick export: generate a MACD crossover strategy.
   */
  exportMACD(
    fast: number = 12,
    slow: number = 26,
    signal: number = 9,
    options: ExportOptions = {}
  ): string {
    const strategy: ExportableStrategy = {
      name: `MACD Strategy`,
      parameters: {
        fastLen: { default: fast, title: "Fast Length", min: 2, max: 50 },
        slowLen: { default: slow, title: "Slow Length", min: 10, max: 100 },
        signalLen: { default: signal, title: "Signal Length", min: 2, max: 30 },
      },
      indicators: [
        {
          name: "macd",
          type: "macd",
          source: "close",
          params: ["fastLen", "slowLen", "signalLen"],
          outputs: ["macdLine", "signalLine", "histLine"],
        },
      ],
      entryConditions: [`ta.crossover(macdLine, signalLine)`],
      exitConditions: [`ta.crossunder(macdLine, signalLine)`],
    };
    return this.exportStrategy(strategy, { ...options, overlay: false });
  }

  /**
   * Quick export: Bollinger Bands mean reversion.
   */
  exportBollingerBands(
    period: number = 20,
    stdDev: number = 2,
    options: ExportOptions = {}
  ): string {
    const strategy: ExportableStrategy = {
      name: `Bollinger Bands Mean Reversion`,
      parameters: {
        bbPeriod: { default: period, title: "BB Period", min: 5, max: 100 },
        bbStdDev: { default: stdDev, title: "BB Std Dev", min: 1, max: 4 },
      },
      indicators: [
        {
          name: "bb",
          type: "bb",
          source: "close",
          params: ["bbPeriod", "bbStdDev"],
          outputs: ["bbUpper", "bbMiddle", "bbLower"],
        },
      ],
      entryConditions: [`close < bbLower`],
      exitConditions: [`close > bbUpper`],
    };
    return this.exportStrategy(strategy, options);
  }

  // ── Private helpers ──────────────────────────

  private generateIndicatorLine(ind: ExportableIndicator): string {
    const src = ind.source ?? "close";
    const paramStr = ind.params.join(", ");

    switch (ind.type) {
      case "sma":
        return `${ind.name} = ta.sma(${src}, ${paramStr})`;
      case "ema":
        return `${ind.name} = ta.ema(${src}, ${paramStr})`;
      case "rsi":
        return `${ind.name} = ta.rsi(${src}, ${paramStr})`;
      case "macd": {
        const outputs = ind.outputs ?? ["macdLine", "signalLine", "histLine"];
        return `[${outputs.join(", ")}] = ta.macd(${src}, ${paramStr})`;
      }
      case "bb": {
        const outputs = ind.outputs ?? ["bbUpper", "bbMiddle", "bbLower"];
        return `[${outputs.join(", ")}] = ta.bb(${src}, ${paramStr})`;
      }
      case "atr":
        return `${ind.name} = ta.atr(${paramStr})`;
      case "stoch": {
        const outputs = ind.outputs ?? ["stochK", "stochD"];
        return `[${outputs.join(", ")}] = ta.stoch(${src}, high, low, ${paramStr})`;
      }
      default:
        return `${ind.name} = ta.${ind.type}(${src}, ${paramStr})`;
    }
  }

  private generatePlotLines(indicators: ExportableIndicator[]): string[] {
    const lines: string[] = [];
    let colorIdx = 0;

    for (const ind of indicators) {
      if (ind.type === "macd" || ind.type === "bb" || ind.type === "stoch") {
        // Multi-output: plot each output
        const outputs = ind.outputs ?? [];
        for (const out of outputs) {
          const color = COLORS[colorIdx++ % COLORS.length];
          lines.push(`plot(${out}, title="${out}", color=${color})`);
        }
      } else {
        const color = ind.color ?? COLORS[colorIdx++ % COLORS.length];
        lines.push(`plot(${ind.name}, title="${ind.name}", color=${color})`);
      }
    }

    return lines;
  }

  private configIndicatorToExportable(
    ind: IndicatorConfig,
    index: number
  ): ExportableIndicator {
    const name = ind.name || `ind_${index}`;
    const params = Object.values(ind.params);
    return {
      name,
      type: name.toLowerCase(),
      source: "close",
      params,
    };
  }
}
