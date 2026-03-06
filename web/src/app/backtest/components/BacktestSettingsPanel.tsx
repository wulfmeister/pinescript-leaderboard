"use client";

import {
  DataSettings,
  type DataSettingsValue,
} from "../../components/data-settings";

interface Props {
  asset: string;
  capital: string;
  dataSettings: DataSettingsValue;
  loading: boolean;
  onAssetChange: (v: string) => void;
  onCapitalChange: (v: string) => void;
  onDataSettingsChange: (v: DataSettingsValue) => void;
  onRun: () => void;
}

export function BacktestSettingsPanel({
  asset,
  capital,
  dataSettings,
  loading,
  onAssetChange,
  onCapitalChange,
  onDataSettingsChange,
  onRun,
}: Props) {
  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-white">Settings</h2>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Asset</label>
        <input
          value={asset}
          onChange={(e) => onAssetChange(e.target.value)}
          className="w-full"
          placeholder="AAPL, BTC-USD, etc."
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Capital</label>
        <input
          value={capital}
          onChange={(e) => onCapitalChange(e.target.value)}
          className="w-full"
          type="number"
        />
      </div>
      <DataSettings value={dataSettings} onChange={onDataSettingsChange} />
      <button
        onClick={onRun}
        disabled={loading}
        className="btn btn-primary w-full"
      >
        {loading ? "Running..." : "Run Backtest"}
      </button>
    </div>
  );
}
