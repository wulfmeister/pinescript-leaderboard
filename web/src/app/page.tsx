import Link from "next/link";
import {
  Play,
  Trophy,
  SlidersHorizontal,
  ArrowRightLeft,
  Sparkles,
  Download,
  type LucideIcon,
} from "lucide-react";
import { LeaderboardSection } from "./components/leaderboard-section";
import { AIQuickGenerate } from "./components/ai-quick-generate";
import { LEADERBOARD_STRATEGIES, LEADERBOARD_CONFIG } from "./leaderboard-strategies";

const FEATURES: { title: string; description: string; href: string; color: string; icon: LucideIcon }[] = [
  {
    title: "Backtest",
    description: "Run PineScript strategies against historical data with full performance metrics",
    href: "/backtest",
    color: "border-blue-800/50 hover:border-blue-600",
    icon: Play,
  },
  {
    title: "Rank Strategies",
    description: "Compare multiple strategies head-to-head and see which performs best",
    href: "/rank",
    color: "border-purple-800/50 hover:border-purple-600",
    icon: Trophy,
  },
  {
    title: "Optimize",
    description: "Grid search over strategy parameters to find the optimal configuration",
    href: "/optimize",
    color: "border-green-800/50 hover:border-green-600",
    icon: SlidersHorizontal,
  },
  {
    title: "Walk-Forward",
    description: "Validate optimized parameters on out-of-sample data with rolling windows",
    href: "/walk-forward",
    color: "border-yellow-800/50 hover:border-yellow-600",
    icon: ArrowRightLeft,
  },
  {
    title: "LLM Arena",
    description: "Generate strategies with Venice AI, or run multi-model tournaments",
    href: "/arena",
    color: "border-red-800/50 hover:border-red-600",
    icon: Sparkles,
  },
  {
    title: "Export",
    description: "Build strategies from templates and export valid PineScript v5 for TradingView",
    href: "/export",
    color: "border-cyan-800/50 hover:border-cyan-600",
    icon: Download,
  },
];

const STATS = [
  { label: "Strategies", value: String(LEADERBOARD_STRATEGIES.length) },
  { label: "Asset", value: LEADERBOARD_CONFIG.asset },
  { label: "Timeframe", value: LEADERBOARD_CONFIG.timeframe },
  { label: "Lookback", value: `${LEADERBOARD_CONFIG.lookbackDays}d` },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="text-center py-12">
        <h1 className="text-5xl font-bold tracking-tight text-white mb-4">
          PineScript Utils
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
          Backtest, rank, optimize, and generate TradingView strategies locally.
          Powered by Venice AI.
        </p>
        <div className="flex justify-center gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <AIQuickGenerate />

      <LeaderboardSection compact />

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href}>
            <div className={`card ${f.color} transition-colors cursor-pointer h-full`}>
              <f.icon className="w-5 h-5 text-zinc-500 mb-2" />
              <h2 className="text-lg font-semibold text-white mb-2">
                {f.title}
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          </Link>
        ))}
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Start</h2>
        <div className="space-y-3 text-sm text-zinc-400">
          <p>
            <span className="text-zinc-200 font-medium">1.</span>{" "}
            Go to <Link href="/backtest" className="text-blue-400 hover:underline">Backtest</Link> to run a strategy against market data
          </p>
          <p>
            <span className="text-zinc-200 font-medium">2.</span>{" "}
            Go to <Link href="/optimize" className="text-blue-400 hover:underline">Optimize</Link> to find the best parameters
          </p>
          <p>
            <span className="text-zinc-200 font-medium">3.</span>{" "}
            Go to <Link href="/walk-forward" className="text-blue-400 hover:underline">Walk-Forward</Link> to validate on unseen data
          </p>
          <p>
            <span className="text-zinc-200 font-medium">4.</span>{" "}
            Go to <Link href="/export" className="text-blue-400 hover:underline">Export</Link> to generate PineScript v5 for TradingView
          </p>
          <p className="pt-2 text-zinc-500">
            Set <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded">VENICE_API_KEY</code> in{" "}
            <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded">web/.env.local</code> to enable AI features.
          </p>
        </div>
      </section>
    </div>
  );
}
