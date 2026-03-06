"use client";

import { type SavedStrategy, type EquityPoint } from "../types";
import { type DataSettingsValue } from "../../components/data-settings";

interface Props {
  savedStrategies: SavedStrategy[];
  currentAsset: string;
  currentDataSettings: DataSettingsValue;
  selectedOverlayId: string | null;
  onSelect: (id: string | null) => void;
}

function isCompatible(
  s: SavedStrategy,
  asset: string,
  ds: DataSettingsValue,
): boolean {
  const ctx = s.lastResult?.context;
  if (!ctx || !s.lastResult?.equityCurve) return false;
  if (ctx.asset !== asset) return false;
  if (ctx.mock !== ds.useMock) return false;
  if (ds.useMock) {
    return ctx.mockType === ds.mockType && ctx.mockBars === ds.mockBars;
  }
  return (
    ctx.timeframe === ds.timeframe && ctx.from === ds.from && ctx.to === ds.to
  );
}

export function OverlaySelector({
  savedStrategies,
  currentAsset,
  currentDataSettings,
  selectedOverlayId,
  onSelect,
}: Props) {
  const withCurves = savedStrategies.filter(
    (s) => s.lastResult?.equityCurve && s.lastResult.equityCurve.length > 0,
  );

  if (withCurves.length === 0) return null;

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-3">Compare Strategy</h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`btn text-xs ${
            selectedOverlayId === null ? "btn-primary" : "btn-ghost"
          }`}
        >
          None
        </button>
        {withCurves.map((s) => {
          const compat = isCompatible(s, currentAsset, currentDataSettings);
          return (
            <button
              key={s.id}
              onClick={() => compat && onSelect(s.id)}
              disabled={!compat}
              title={
                compat
                  ? `Overlay ${s.name}`
                  : "Incompatible data context (different asset, timeframe, or data source)"
              }
              className={`btn text-xs ${
                selectedOverlayId === s.id
                  ? "btn-primary"
                  : compat
                    ? "btn-ghost"
                    : "btn-ghost opacity-40 cursor-not-allowed"
              }`}
            >
              {s.name}
              {!compat && (
                <span
                  className="ml-1 text-zinc-600"
                  title="Incompatible context"
                >
                  ⚠
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
