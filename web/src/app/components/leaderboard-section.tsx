"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { LEADERBOARD_STRATEGIES, LEADERBOARD_CONFIG } from "../leaderboard-strategies";
import { RankedResult, pct } from "./ranked-result";
import { ScoreComparisonChart } from "./score-comparison-chart";
import { RankingsTable } from "./rankings-table";
import { EquityCurvesChart } from "./equity-curves-chart";

type Status = "loading" | "error" | "success";

export function LeaderboardSection({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>("loading");
  const [results, setResults] = useState<RankedResult[]>([]);
  const [error, setError] = useState("");
  const [isMock, setIsMock] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runBacktest = useCallback(async (useMock: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError("");
    setResults([]);
    if (!useMock) setFallbackReason(null);

    const now = new Date();
    const from = new Date(now.getTime() - LEADERBOARD_CONFIG.lookbackDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);

    try {
      const res = await fetch("/api/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategies: LEADERBOARD_STRATEGIES.map((s) => ({
            name: s.name,
            script: s.script,
          })),
          asset: LEADERBOARD_CONFIG.asset,
          capital: LEADERBOARD_CONFIG.capital,
          timeframe: LEADERBOARD_CONFIG.timeframe,
          from,
          to,
          mock: useMock,
          mockBars: useMock ? 500 : undefined,
          minTrades: 1,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResults(data.rankings);
      setIsMock(useMock);
      setLastUpdated(new Date());
      setStatus("success");
    } catch (e: any) {
      if (e.name === "AbortError") return;

      // If real data failed, retry with mock
      if (!useMock) {
        setFallbackReason(e.message || "Yahoo Finance request failed");
        runBacktest(true);
        return;
      }

      setError(e.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    runBacktest(LEADERBOARD_CONFIG.mock);
    return () => {
      abortRef.current?.abort();
    };
  }, [runBacktest]);

  if (status === "loading") {
    return (
      <section className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-800 rounded w-64" />
          <div className="text-sm text-zinc-400">
            Backtesting {LEADERBOARD_STRATEGIES.length} strategies on {LEADERBOARD_CONFIG.asset}...
          </div>
          <div className="space-y-3">
            {LEADERBOARD_STRATEGIES.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-24 h-4 bg-zinc-800 rounded" />
                <div className="flex-1 h-8 bg-zinc-800 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="card border-red-800 bg-red-950/50">
        <h2 className="font-semibold text-red-300 mb-2">Leaderboard Error</h2>
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <div className="flex gap-3">
          <button onClick={() => runBacktest(false)} className="btn btn-primary text-sm">
            Retry
          </button>
          <button onClick={() => runBacktest(true)} className="btn btn-ghost text-sm">
            Try with mock data
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">Live Leaderboard</h2>
          <span
            className={`px-2 py-1 rounded text-xs ${
              isMock
                ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700"
                : "bg-blue-900/30 text-blue-400 border border-blue-700"
            }`}
            data-testid="data-source-badge"
          >
            {isMock ? "MOCK DATA" : "YAHOO FINANCE"}
          </span>
          <span className="text-xs text-zinc-500">
            {LEADERBOARD_CONFIG.asset} &middot; {LEADERBOARD_CONFIG.timeframe} &middot; Last {LEADERBOARD_CONFIG.lookbackDays} days
          </span>
          {lastUpdated && (
            <span className="text-xs text-zinc-500">
              &middot; Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button onClick={() => runBacktest(isMock)} className="btn btn-ghost text-sm">
          Refresh
        </button>
      </div>

      {fallbackReason && isMock && (
        <div className="flex items-center justify-between bg-yellow-900/20 border border-yellow-800/50 rounded-lg px-4 py-3 text-sm">
          <span className="text-yellow-400">
            Yahoo Finance unavailable — showing simulated data
          </span>
          <button
            onClick={() => { setFallbackReason(null); runBacktest(false); }}
            className="text-yellow-300 hover:text-white text-xs underline underline-offset-2"
          >
            Try live data
          </button>
        </div>
      )}

      <ScoreComparisonChart results={results} />

      {compact ? (
        results[0] && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-800/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-yellow-400 font-bold">#1</span>
              <span className="text-white font-medium">{results[0].name}</span>
              <span className={results[0].metrics.totalReturn >= 0 ? "text-green-400" : "text-red-400"}>
                {pct(results[0].metrics.totalReturn)}
              </span>
              <span className="text-zinc-500">{results[0].metrics.totalTrades} trades</span>
              <span className="text-zinc-400">Score: {results[0].score.toFixed(3)}</span>
            </div>
            <Link href="/rank" className="text-brand-500 hover:text-brand-400 text-sm font-medium">
              View full rankings &rarr;
            </Link>
          </div>
        )
      ) : (
        <>
          <RankingsTable results={results} />
          <EquityCurvesChart results={results} capital={LEADERBOARD_CONFIG.capital} />
        </>
      )}
    </section>
  );
}
