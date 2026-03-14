"use client";

import { useState } from "react";
import Link from "next/link";
import { INPUT_CLASS, SELECT_CLASS } from "../lib/styles";
import {
  GALLERY_STRATEGIES,
  CATEGORIES,
  type Category,
  type Difficulty,
  type GalleryStrategy,
} from "./strategies";

const CATEGORY_COLORS: Record<Category, string> = {
  "Trend Following": "bg-green-900/30 text-green-400 border border-green-700",
  "Mean Reversion": "bg-purple-900/30 text-purple-400 border border-purple-700",
  Momentum: "bg-blue-900/30 text-blue-400 border border-blue-700",
  Volatility: "bg-yellow-900/30 text-yellow-400 border border-yellow-700",
  Breakout: "bg-red-900/30 text-red-400 border border-red-700",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: "bg-green-900/30 text-green-400",
  intermediate: "bg-yellow-900/30 text-yellow-400",
  advanced: "bg-red-900/30 text-red-400",
};

function StrategyCard({ strategy }: { strategy: GalleryStrategy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(strategy.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="card space-y-3 h-full flex flex-col">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[strategy.category]}`}
        >
          {strategy.category}
        </span>
        <span
          className={`px-2 py-0.5 rounded text-xs ${DIFFICULTY_COLORS[strategy.difficulty]}`}
        >
          {strategy.difficulty}
        </span>
      </div>
      <h3 className="font-semibold text-white">{strategy.name}</h3>
      <p className="text-zinc-400 text-sm flex-1">{strategy.description}</p>
      <div className="flex flex-wrap gap-1">
        {strategy.tags.map((t) => (
          <span
            key={t}
            className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <Link
          href={`/backtest?gallery=${strategy.id}`}
          className="btn btn-primary text-sm flex-1 text-center"
        >
          Backtest This
        </Link>
        <button onClick={handleCopy} className="btn btn-ghost text-sm">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">(
    "All",
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    Difficulty | "All"
  >("All");

  const filtered = GALLERY_STRATEGIES.filter((s) => {
    if (selectedCategory !== "All" && s.category !== selectedCategory)
      return false;
    if (selectedDifficulty !== "All" && s.difficulty !== selectedDifficulty)
      return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.description.toLowerCase().includes(q) &&
        !s.tags.some((t) => t.toLowerCase().includes(q))
      )
        return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Strategy Gallery</h1>
        <p className="text-zinc-400 mt-2">
          Browse {GALLERY_STRATEGIES.length} curated PineScript strategies.
          Filter by category or difficulty, then backtest with one click.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search strategies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT_CLASS} w-64`}
        />
        <select
          value={selectedCategory}
          onChange={(e) =>
            setSelectedCategory(e.target.value as Category | "All")
          }
          className={SELECT_CLASS}
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={selectedDifficulty}
          onChange={(e) =>
            setSelectedDifficulty(e.target.value as Difficulty | "All")
          }
          className={SELECT_CLASS}
        >
          <option value="All">All Difficulties</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <span className="text-sm text-zinc-500">
          {filtered.length} strateg{filtered.length === 1 ? "y" : "ies"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-zinc-400">
            No strategies match your filters. Try broadening your search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <StrategyCard key={s.id} strategy={s} />
          ))}
        </div>
      )}
    </div>
  );
}
