"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { getDefaultDataSettings } from "./data-settings";
import { INPUT_CLASS } from "../lib/styles";

const EXAMPLE_PROMPTS = [
  "RSI mean reversion with 14-period RSI",
  "MACD trend following with signal crossover",
  "Bollinger Bands breakout strategy",
  "EMA crossover with volume confirmation",
];

export function AIQuickGenerate() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setGeneratedCode("");
    try {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", description: prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedCode(data.code);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleBacktestNow = async () => {
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: generatedCode,
          asset: "AAPL",
          capital: 10000,
          dataSettings: getDefaultDataSettings(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = `/backtest?s=${data.id}`;
    } catch {
      setError("Failed to create share link");
    }
  };

  return (
    <section className="card">
      <div className="text-center mb-6">
        <Sparkles className="w-6 h-6 text-brand-500 mx-auto mb-2" />
        <h2 className="text-lg font-semibold text-white">Quick Generate</h2>
        <p className="text-sm text-zinc-400">
          Describe a strategy in plain English and let AI write the PineScript
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => setPrompt(p)}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex gap-2 max-w-2xl mx-auto">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          placeholder="Describe your strategy..."
          className={`flex-1 ${INPUT_CLASS}`}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="btn btn-primary text-sm"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center mt-3">{error}</p>
      )}

      {generatedCode && (
        <div className="mt-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Generated Strategy</span>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn btn-ghost text-xs">
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleBacktestNow}
                className="btn btn-primary text-xs"
              >
                Backtest Now
              </button>
            </div>
          </div>
          <pre className="bg-zinc-950 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto max-h-60 overflow-y-auto">
            {generatedCode}
          </pre>
        </div>
      )}
    </section>
  );
}
