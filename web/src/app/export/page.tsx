"use client";

import { useState, useMemo } from "react";

// Since pine-exporter runs in the browser (no Node deps), we can inline the logic
// rather than importing the package which may have module resolution issues in Next.js.

type StrategyTemplate = "crossover" | "rsi" | "macd" | "bb";

interface ParameterDef {
  key: string;
  label: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

const TEMPLATES: Record<
  StrategyTemplate,
  {
    label: string;
    description: string;
    parameters: ParameterDef[];
  }
> = {
  crossover: {
    label: "EMA/SMA Crossover",
    description:
      "Buy when the fast moving average crosses above the slow, sell on the opposite cross.",
    parameters: [
      { key: "fastLen", label: "Fast Period", default: 10, min: 2, max: 200, step: 1 },
      { key: "slowLen", label: "Slow Period", default: 30, min: 5, max: 500, step: 1 },
    ],
  },
  rsi: {
    label: "RSI Overbought/Oversold",
    description:
      "Buy when RSI drops below the oversold level, sell when it rises above the overbought level.",
    parameters: [
      { key: "rsiPeriod", label: "RSI Period", default: 14, min: 2, max: 50, step: 1 },
      { key: "overbought", label: "Overbought Level", default: 70, min: 50, max: 95, step: 1 },
      { key: "oversold", label: "Oversold Level", default: 30, min: 5, max: 50, step: 1 },
    ],
  },
  macd: {
    label: "MACD Crossover",
    description:
      "Buy when MACD line crosses above the signal line, sell on the opposite cross.",
    parameters: [
      { key: "fastLen", label: "Fast Length", default: 12, min: 2, max: 50, step: 1 },
      { key: "slowLen", label: "Slow Length", default: 26, min: 10, max: 100, step: 1 },
      { key: "signalLen", label: "Signal Length", default: 9, min: 2, max: 30, step: 1 },
    ],
  },
  bb: {
    label: "Bollinger Bands Mean Reversion",
    description:
      "Buy when price touches the lower band, sell when it touches the upper band.",
    parameters: [
      { key: "bbPeriod", label: "BB Period", default: 20, min: 5, max: 100, step: 1 },
      { key: "bbStdDev", label: "Std Deviation", default: 2, min: 1, max: 4, step: 0.5 },
    ],
  },
};

function generatePineScript(
  template: StrategyTemplate,
  maType: "ema" | "sma",
  params: Record<string, number>,
  options: {
    commission: number;
    capital: number;
    comments: boolean;
    plots: boolean;
  }
): string {
  const lines: string[] = [];
  const { commission, capital, comments, plots } = options;

  lines.push(`//@version=5`);

  switch (template) {
    case "crossover": {
      const fn = maType.toUpperCase();
      const stratArgs = [`"${fn} Crossover ${params.fastLen}/${params.slowLen}"`, `overlay=true`, `initial_capital=${capital}`, `default_qty_type=strategy.percent_of_equity`, `default_qty_value=100`];
      if (commission > 0) {
        stratArgs.push(`commission_type=strategy.commission.percent`, `commission_value=${commission}`);
      }
      lines.push(`strategy(${stratArgs.join(", ")})`);
      lines.push("");
      if (comments) lines.push("// -- Parameters --");
      lines.push(`fastLen = input.int(${params.fastLen}, title="Fast ${fn} Length", minval=1, maxval=200)`);
      lines.push(`slowLen = input.int(${params.slowLen}, title="Slow ${fn} Length", minval=1, maxval=500)`);
      lines.push("");
      if (comments) lines.push("// -- Indicators --");
      lines.push(`fast = ta.${maType}(close, fastLen)`);
      lines.push(`slow = ta.${maType}(close, slowLen)`);
      lines.push("");
      if (plots) {
        if (comments) lines.push("// -- Plots --");
        lines.push(`plot(fast, title="Fast", color=color.blue)`);
        lines.push(`plot(slow, title="Slow", color=color.red)`);
        lines.push("");
      }
      if (comments) lines.push("// -- Entry Logic --");
      lines.push(`if (ta.crossover(fast, slow))`);
      lines.push(`    strategy.entry("Long", strategy.long)`);
      lines.push("");
      if (comments) lines.push("// -- Exit Logic --");
      lines.push(`if (ta.crossunder(fast, slow))`);
      lines.push(`    strategy.close("Long")`);
      break;
    }
    case "rsi": {
      const stratArgs = [`"RSI Strategy ${params.rsiPeriod}"`, `overlay=false`, `initial_capital=${capital}`, `default_qty_type=strategy.percent_of_equity`, `default_qty_value=100`];
      if (commission > 0) {
        stratArgs.push(`commission_type=strategy.commission.percent`, `commission_value=${commission}`);
      }
      lines.push(`strategy(${stratArgs.join(", ")})`);
      lines.push("");
      if (comments) lines.push("// -- Parameters --");
      lines.push(`rsiPeriod = input.int(${params.rsiPeriod}, title="RSI Period", minval=2, maxval=50)`);
      lines.push(`overbought = input.int(${params.overbought}, title="Overbought Level", minval=50, maxval=95)`);
      lines.push(`oversold = input.int(${params.oversold}, title="Oversold Level", minval=5, maxval=50)`);
      lines.push("");
      if (comments) lines.push("// -- Indicators --");
      lines.push(`rsiVal = ta.rsi(close, rsiPeriod)`);
      lines.push("");
      if (plots) {
        if (comments) lines.push("// -- Plots --");
        lines.push(`plot(rsiVal, title="RSI", color=color.blue)`);
        lines.push(`hline(overbought, "Overbought", color=color.red)`);
        lines.push(`hline(oversold, "Oversold", color=color.green)`);
        lines.push("");
      }
      if (comments) lines.push("// -- Entry Logic --");
      lines.push(`if (rsiVal < oversold)`);
      lines.push(`    strategy.entry("Long", strategy.long)`);
      lines.push("");
      if (comments) lines.push("// -- Exit Logic --");
      lines.push(`if (rsiVal > overbought)`);
      lines.push(`    strategy.close("Long")`);
      break;
    }
    case "macd": {
      const stratArgs = [`"MACD Strategy"`, `overlay=false`, `initial_capital=${capital}`, `default_qty_type=strategy.percent_of_equity`, `default_qty_value=100`];
      if (commission > 0) {
        stratArgs.push(`commission_type=strategy.commission.percent`, `commission_value=${commission}`);
      }
      lines.push(`strategy(${stratArgs.join(", ")})`);
      lines.push("");
      if (comments) lines.push("// -- Parameters --");
      lines.push(`fastLen = input.int(${params.fastLen}, title="Fast Length", minval=2, maxval=50)`);
      lines.push(`slowLen = input.int(${params.slowLen}, title="Slow Length", minval=10, maxval=100)`);
      lines.push(`signalLen = input.int(${params.signalLen}, title="Signal Length", minval=2, maxval=30)`);
      lines.push("");
      if (comments) lines.push("// -- Indicators --");
      lines.push(`[macdLine, signalLine, histLine] = ta.macd(close, fastLen, slowLen, signalLen)`);
      lines.push("");
      if (plots) {
        if (comments) lines.push("// -- Plots --");
        lines.push(`plot(macdLine, title="MACD", color=color.blue)`);
        lines.push(`plot(signalLine, title="Signal", color=color.red)`);
        lines.push(`plot(histLine, title="Histogram", color=color.green, style=plot.style_histogram)`);
        lines.push("");
      }
      if (comments) lines.push("// -- Entry Logic --");
      lines.push(`if (ta.crossover(macdLine, signalLine))`);
      lines.push(`    strategy.entry("Long", strategy.long)`);
      lines.push("");
      if (comments) lines.push("// -- Exit Logic --");
      lines.push(`if (ta.crossunder(macdLine, signalLine))`);
      lines.push(`    strategy.close("Long")`);
      break;
    }
    case "bb": {
      const stratArgs = [`"Bollinger Bands Mean Reversion"`, `overlay=true`, `initial_capital=${capital}`, `default_qty_type=strategy.percent_of_equity`, `default_qty_value=100`];
      if (commission > 0) {
        stratArgs.push(`commission_type=strategy.commission.percent`, `commission_value=${commission}`);
      }
      lines.push(`strategy(${stratArgs.join(", ")})`);
      lines.push("");
      if (comments) lines.push("// -- Parameters --");
      lines.push(`bbPeriod = input.int(${params.bbPeriod}, title="BB Period", minval=5, maxval=100)`);
      lines.push(`bbStdDev = input.int(${params.bbStdDev}, title="BB Std Dev", minval=1, maxval=4)`);
      lines.push("");
      if (comments) lines.push("// -- Indicators --");
      lines.push(`[bbUpper, bbMiddle, bbLower] = ta.bb(close, bbPeriod, bbStdDev)`);
      lines.push("");
      if (plots) {
        if (comments) lines.push("// -- Plots --");
        lines.push(`plot(bbUpper, title="Upper", color=color.red)`);
        lines.push(`plot(bbMiddle, title="Middle", color=color.blue)`);
        lines.push(`plot(bbLower, title="Lower", color=color.green)`);
        lines.push("");
      }
      if (comments) lines.push("// -- Entry Logic --");
      lines.push(`if (close < bbLower)`);
      lines.push(`    strategy.entry("Long", strategy.long)`);
      lines.push("");
      if (comments) lines.push("// -- Exit Logic --");
      lines.push(`if (close > bbUpper)`);
      lines.push(`    strategy.close("Long")`);
      break;
    }
  }

  return lines.join("\n") + "\n";
}

export default function ExportPage() {
  const [template, setTemplate] = useState<StrategyTemplate>("crossover");
  const [maType, setMaType] = useState<"ema" | "sma">("ema");
  const [params, setParams] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const p of TEMPLATES.crossover.parameters) {
      initial[p.key] = p.default;
    }
    return initial;
  });
  const [commission, setCommission] = useState(0.1);
  const [capital, setCapital] = useState(10000);
  const [comments, setComments] = useState(true);
  const [plots, setPlots] = useState(true);
  const [copied, setCopied] = useState(false);

  const tmpl = TEMPLATES[template];

  const handleTemplateChange = (t: StrategyTemplate) => {
    setTemplate(t);
    const newParams: Record<string, number> = {};
    for (const p of TEMPLATES[t].parameters) {
      newParams[p.key] = p.default;
    }
    setParams(newParams);
  };

  const handleParamChange = (key: string, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const code = useMemo(
    () => generatePineScript(template, maType, params, { commission, capital, comments, plots }),
    [template, maType, params, commission, capital, comments, plots]
  );

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Pine Exporter</h1>
      <p className="text-zinc-400">
        Build a strategy from templates and export valid PineScript v5 code for
        TradingView.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Builder */}
        <div className="space-y-4">
          {/* Template selector */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Strategy Template</h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TEMPLATES) as StrategyTemplate[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTemplateChange(t)}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    template === t
                      ? "bg-blue-600/30 border border-blue-500 text-blue-300"
                      : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
                  }`}
                >
                  {TEMPLATES[t].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">{tmpl.description}</p>
          </div>

          {/* Parameters */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Parameters</h2>

            {template === "crossover" && (
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Moving Average Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMaType("ema")}
                    className={`px-3 py-1.5 rounded text-sm ${
                      maType === "ema"
                        ? "bg-blue-600/30 text-blue-300 border border-blue-500"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}
                  >
                    EMA
                  </button>
                  <button
                    onClick={() => setMaType("sma")}
                    className={`px-3 py-1.5 rounded text-sm ${
                      maType === "sma"
                        ? "bg-blue-600/30 text-blue-300 border border-blue-500"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}
                  >
                    SMA
                  </button>
                </div>
              </div>
            )}

            {tmpl.parameters.map((p) => (
              <div key={p.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-zinc-400">{p.label}</label>
                  <span className="text-sm font-mono text-white">
                    {params[p.key] ?? p.default}
                  </span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={params[p.key] ?? p.default}
                  onChange={(e) =>
                    handleParamChange(p.key, parseFloat(e.target.value))
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>{p.min}</span>
                  <span>{p.max}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Options */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Options</h2>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Initial Capital
              </label>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(parseInt(e.target.value) || 10000)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Commission (%)
              </label>
              <input
                type="number"
                value={commission}
                onChange={(e) => setCommission(parseFloat(e.target.value) || 0)}
                step="0.01"
                className="w-full"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={comments}
                onChange={(e) => setComments(e.target.checked)}
                className="rounded"
              />
              Include comments
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={plots}
                onChange={(e) => setPlots(e.target.checked)}
                className="rounded"
              />
              Include plot statements
            </label>
          </div>
        </div>

        {/* Generated code */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Generated PineScript v5</h2>
              <button
                onClick={copyToClipboard}
                className="btn btn-ghost text-xs"
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
            <pre className="bg-zinc-950 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto max-h-[600px] overflow-y-auto font-mono leading-relaxed">
              {code}
            </pre>
          </div>

          <div className="card">
            <h2 className="font-semibold text-white mb-3">How to Use</h2>
            <ol className="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
              <li>
                Adjust the template, parameters, and options on the left
              </li>
              <li>Click &ldquo;Copy to Clipboard&rdquo; to copy the generated code</li>
              <li>
                Open TradingView, go to Pine Editor, paste the code, and click
                &ldquo;Add to Chart&rdquo;
              </li>
              <li>
                Or paste it into the Backtest or Optimize pages in this app to
                test it first
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
