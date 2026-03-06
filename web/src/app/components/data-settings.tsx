"use client";

import { useState } from "react";

export interface DataSettingsValue {
  timeframe: string;
  from: string;
  to: string;
  useMock: boolean;
  mockType: "random" | "bull" | "bear";
  mockBars: number;
}

const TIMEFRAMES = [
  { value: "1m", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "15m", label: "15 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "1d", label: "1 day" },
  { value: "1w", label: "1 week" },
  { value: "1M", label: "1 month" },
];

const MOCK_TYPES = [
  { value: "random", label: "Random Walk" },
  { value: "bull", label: "Bull Market (trending up)" },
  { value: "bear", label: "Bear Market (trending down)" },
];

const DEFAULT_FROM = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
})();

const DEFAULT_TO = (() => {
  const d = new Date();
  return d.toISOString().split("T")[0];
})();

interface DataSettingsProps {
  value: DataSettingsValue;
  onChange: (value: DataSettingsValue) => void;
}

export function DataSettings({ value, onChange }: DataSettingsProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const update = <K extends keyof DataSettingsValue>(
    key: K,
    newValue: DataSettingsValue[K]
  ) => {
    onChange({ ...value, [key]: newValue });
  };

  return (
    <div className="space-y-4">
      {/* Data Source Toggle */}
      <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useMock"
            checked={value.useMock}
            onChange={(e) => update("useMock", e.target.checked)}
            className="rounded"
          />
          <label htmlFor="useMock" className="text-sm text-zinc-300 cursor-pointer">
            Use Mock Data
          </label>
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <span className="text-zinc-500 text-xs cursor-help">[?]</span>
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-400 z-50">
                Mock data generates synthetic OHLCV bars for testing without
                calling external APIs. Choose random walk or trending markets.
                Disable to fetch real data from Yahoo Finance.
              </div>
            )}
          </div>
        </div>
        <span className="text-xs text-zinc-500">
          {value.useMock ? "Synthetic" : "Yahoo Finance"}
        </span>
      </div>

      {value.useMock ? (
        /* Mock Data Settings */
        <div className="space-y-3 pl-6 border-l-2 border-zinc-800">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Market Type</label>
            <select
              value={value.mockType}
              onChange={(e) =>
                update("mockType", e.target.value as DataSettingsValue["mockType"])
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
            >
              {MOCK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Bar Count: <span className="text-white">{value.mockBars}</span>
            </label>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={value.mockBars}
              onChange={(e) => update("mockBars", parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>50</span>
              <span>1000</span>
            </div>
          </div>
        </div>
      ) : (
        /* Real Data Settings */
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Timeframe</label>
            <select
              value={value.timeframe}
              onChange={(e) => update("timeframe", e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
            >
              {TIMEFRAMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">From</label>
              <input
                type="date"
                value={value.from || DEFAULT_FROM}
                onChange={(e) => update("from", e.target.value)}
                className="w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">To</label>
              <input
                type="date"
                value={value.to || DEFAULT_TO}
                onChange={(e) => update("to", e.target.value)}
                className="w-full text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function getDefaultDataSettings(): DataSettingsValue {
  return {
    timeframe: "1d",
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    useMock: true,
    mockType: "random",
    mockBars: 252,
  };
}

export function formatDataSourceBadge(
  settings: DataSettingsValue,
  asset: string
): string {
  if (settings.useMock) {
    return `${settings.mockBars} bars, ${settings.mockType} walk`;
  } else {
    const fromStr = settings.from
      ? new Date(settings.from).toLocaleDateString()
      : "?";
    const toStr = settings.to
      ? new Date(settings.to).toLocaleDateString()
      : "?";
    return `${asset} ${settings.timeframe}: ${fromStr} - ${toStr}`;
  }
}
