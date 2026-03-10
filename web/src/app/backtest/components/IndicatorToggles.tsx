"use client";

import { useState } from "react";

export type IndicatorId = "sma" | "ema" | "bb" | "rsi" | "macd";

export interface IndicatorConfig {
  id: IndicatorId;
  enabled: boolean;
  period?: number;
  stdDev?: number;
  fast?: number;
  slow?: number;
  signal?: number;
}

const DEFAULT_CONFIGS: IndicatorConfig[] = [
  { id: "sma", enabled: false, period: 20 },
  { id: "ema", enabled: false, period: 20 },
  { id: "bb", enabled: false, period: 20, stdDev: 2 },
  { id: "rsi", enabled: false, period: 14 },
  { id: "macd", enabled: false, fast: 12, slow: 26, signal: 9 },
];

const INDICATOR_LABELS: Record<IndicatorId, string> = {
  sma: "SMA",
  ema: "EMA",
  bb: "Bollinger Bands",
  rsi: "RSI",
  macd: "MACD",
};

interface Props {
  onIndicatorChange: (indicators: IndicatorConfig[]) => void;
}

const inputClass =
  "w-12 text-xs bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white";

function NumberInput({
  label,
  value,
  onChange,
  min = 1,
  max = 500,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(v);
        }}
        className={inputClass}
      />
    </label>
  );
}

function IndicatorRow({
  config,
  onToggle,
  onFieldChange,
}: {
  config: IndicatorConfig;
  onToggle: () => void;
  onFieldChange: (field: keyof IndicatorConfig, value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <input
        type="checkbox"
        checked={config.enabled}
        onChange={onToggle}
        className="accent-blue-500"
      />
      <span className="text-xs text-zinc-300 w-24">
        {INDICATOR_LABELS[config.id]}
      </span>

      <div className="flex items-center gap-2 ml-auto">
        {config.id === "sma" && (
          <NumberInput
            label="P"
            value={config.period ?? 20}
            onChange={(v) => onFieldChange("period", v)}
          />
        )}

        {config.id === "ema" && (
          <NumberInput
            label="P"
            value={config.period ?? 20}
            onChange={(v) => onFieldChange("period", v)}
          />
        )}

        {config.id === "bb" && (
          <>
            <NumberInput
              label="P"
              value={config.period ?? 20}
              onChange={(v) => onFieldChange("period", v)}
            />
            <NumberInput
              label="σ"
              value={config.stdDev ?? 2}
              onChange={(v) => onFieldChange("stdDev", v)}
              max={10}
            />
          </>
        )}

        {config.id === "rsi" && (
          <NumberInput
            label="P"
            value={config.period ?? 14}
            onChange={(v) => onFieldChange("period", v)}
          />
        )}

        {config.id === "macd" && (
          <>
            <NumberInput
              label="F"
              value={config.fast ?? 12}
              onChange={(v) => onFieldChange("fast", v)}
            />
            <NumberInput
              label="S"
              value={config.slow ?? 26}
              onChange={(v) => onFieldChange("slow", v)}
            />
            <NumberInput
              label="Sig"
              value={config.signal ?? 9}
              onChange={(v) => onFieldChange("signal", v)}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function IndicatorToggles({ onIndicatorChange }: Props) {
  const [configs, setConfigs] = useState<IndicatorConfig[]>(DEFAULT_CONFIGS);

  const updateConfigs = (next: IndicatorConfig[]) => {
    setConfigs(next);
    onIndicatorChange(next);
  };

  const handleToggle = (id: IndicatorId) => {
    const next = configs.map((c) =>
      c.id === id ? { ...c, enabled: !c.enabled } : c,
    );
    updateConfigs(next);
  };

  const handleFieldChange = (
    id: IndicatorId,
    field: keyof IndicatorConfig,
    value: number,
  ) => {
    const next = configs.map((c) =>
      c.id === id ? { ...c, [field]: value } : c,
    );
    updateConfigs(next);
  };

  const overlays = configs.filter((c) =>
    (["sma", "ema", "bb"] as IndicatorId[]).includes(c.id),
  );
  const oscillators = configs.filter((c) =>
    (["rsi", "macd"] as IndicatorId[]).includes(c.id),
  );

  return (
    <div className="card p-3">
      <div className="mb-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
          Price Overlays
        </p>
        {overlays.map((c) => (
          <IndicatorRow
            key={c.id}
            config={c}
            onToggle={() => handleToggle(c.id)}
            onFieldChange={(field, value) =>
              handleFieldChange(c.id, field, value)
            }
          />
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
          Oscillators
        </p>
        {oscillators.map((c) => (
          <IndicatorRow
            key={c.id}
            config={c}
            onToggle={() => handleToggle(c.id)}
            onFieldChange={(field, value) =>
              handleFieldChange(c.id, field, value)
            }
          />
        ))}
      </div>
    </div>
  );
}
