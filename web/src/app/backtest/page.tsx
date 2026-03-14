"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  getDefaultDataSettings,
  formatDataSourceBadge,
  type DataSettingsValue,
} from "../components/data-settings";
import { type BacktestResult, type SavedStrategy } from "./types";
import { type OHLCV } from "@pinescript-utils/core";
import { SAMPLE_STRATEGY } from "../lib/sample-strategy";
import { StrategyEditorPanel } from "./components/StrategyEditorPanel";
import { BacktestSettingsPanel } from "./components/BacktestSettingsPanel";
import { BacktestSummaryCards } from "./components/BacktestSummaryCards";
import { BacktestMetricsTable } from "./components/BacktestMetricsTable";
import { EquityChart } from "./components/EquityChart";
import { DrawdownChart } from "./components/DrawdownChart";
import { TradeTable } from "./components/TradeTable";
import { MonthlyPnL } from "./components/MonthlyPnL";
import { ExportButtons } from "./components/ExportButtons";
import { OverlaySelector } from "./components/OverlaySelector";
import { PriceChart } from "./components/PriceChart";
import {
  IndicatorToggles,
  type IndicatorConfig,
} from "./components/IndicatorToggles";

export default function BacktestPage() {
  return (
    <Suspense fallback={<div className="text-zinc-500">Loading...</div>}>
      <BacktestPageInner />
    </Suspense>
  );
}

function BacktestPageInner() {
  const searchParams = useSearchParams();
  const [script, setScript] = useState(SAMPLE_STRATEGY);
  const [asset, setAsset] = useState("AAPL");
  const [capital, setCapital] = useState("10000");
  const [dataSettings, setDataSettings] = useState<DataSettingsValue>(
    getDefaultDataSettings(),
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState("");
  const [ohlcvData, setOhlcvData] = useState<OHLCV[]>([]);
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);

  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null,
  );

  const runBacktest = useCallback(
    async (overrides?: {
      script: string;
      asset: string;
      capital: number;
      dataSettings: DataSettingsValue;
    }) => {
      const s = overrides?.script ?? script;
      const a = overrides?.asset ?? asset;
      const c = overrides?.capital ?? parseFloat(capital);
      const ds = overrides?.dataSettings ?? dataSettings;

      setLoading(true);
      setError("");
      setResult(null);
      setOhlcvData([]);
      setIndicators([]);

      if (
        !ds.useMock &&
        ds.from &&
        ds.to &&
        new Date(ds.from) > new Date(ds.to)
      ) {
        setError("From date must be before To date");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/backtest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: s,
            asset: a,
            capital: c,
            timeframe: ds.timeframe,
            from: ds.from,
            to: ds.to,
            mock: ds.useMock,
            mockType: ds.mockType,
            mockBars: ds.mockBars,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setResult(data);
        setOhlcvData(data.ohlcv ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [script, asset, capital, dataSettings],
  );

  // Load shared or gallery strategy from URL params
  useEffect(() => {
    const shareId = searchParams.get("s");
    const galleryId = searchParams.get("gallery");

    if (shareId) {
      fetch(`/api/share?id=${encodeURIComponent(shareId)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject("not found")))
        .then((snapshot) => {
          setScript(snapshot.script);
          setAsset(snapshot.asset);
          setCapital(String(snapshot.capital));
          setDataSettings(snapshot.dataSettings);
          runBacktest({
            script: snapshot.script,
            asset: snapshot.asset,
            capital: snapshot.capital,
            dataSettings: snapshot.dataSettings,
          });
        })
        .catch(() => setError("Shared backtest not found"));
    } else if (galleryId) {
      import("../gallery/strategies").then(({ GALLERY_STRATEGIES }) => {
        const s = GALLERY_STRATEGIES.find((strat) => strat.id === galleryId);
        if (s) setScript(s.script);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadStrategies = useCallback(async () => {
    try {
      const res = await fetch("/api/strategies");
      if (res.ok) {
        const data = await res.json();
        setSavedStrategies(data.strategies || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  const saveStrategy = async () => {
    if (!saveName.trim()) return;
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          script,
          lastResult: result
            ? {
                metrics: result.metrics,
                finalCapital: result.finalCapital,
                asset,
                equityCurve: result.equityCurve,
                context: {
                  asset,
                  timeframe: dataSettings.timeframe,
                  from: dataSettings.from,
                  to: dataSettings.to,
                  mock: dataSettings.useMock,
                  mockType: dataSettings.mockType,
                  mockBars: dataSettings.mockBars,
                },
              }
            : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaveMessage("Saved!");
      setSaveName("");
      setShowSaveDialog(false);
      loadStrategies();
      setTimeout(() => setSaveMessage(""), 2000);
    } catch {
      setSaveMessage("Save failed");
      setTimeout(() => setSaveMessage(""), 2000);
    }
  };

  const loadStrategy = (s: SavedStrategy) => {
    setScript(s.script);
    setShowLoadDialog(false);
    setResult(null);
    setSelectedOverlayId(null);
  };

  const deleteStrategy = async (id: string) => {
    try {
      await fetch(`/api/strategies?id=${id}`, { method: "DELETE" });
      if (selectedOverlayId === id) setSelectedOverlayId(null);
      loadStrategies();
    } catch {}
  };

  const handleShare = async () => {
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          asset,
          capital: parseFloat(capital),
          dataSettings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const url = `${window.location.origin}/backtest?s=${data.id}`;
      await navigator.clipboard.writeText(url);
      setShareMessage("Link copied!");
      setTimeout(() => setShareMessage(""), 2000);
    } catch {
      setShareMessage("Share failed");
      setTimeout(() => setShareMessage(""), 2000);
    }
  };

  const overlayStrategy = selectedOverlayId
    ? savedStrategies.find((s) => s.id === selectedOverlayId)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Backtest</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <StrategyEditorPanel
            script={script}
            onScriptChange={setScript}
            savedStrategies={savedStrategies}
            showSaveDialog={showSaveDialog}
            showLoadDialog={showLoadDialog}
            saveName={saveName}
            saveMessage={saveMessage}
            onToggleSave={() => setShowSaveDialog((v) => !v)}
            onToggleLoad={() => setShowLoadDialog((v) => !v)}
            onSaveNameChange={setSaveName}
            onSave={saveStrategy}
            onLoad={loadStrategy}
            onDelete={deleteStrategy}
            onCancelSave={() => setShowSaveDialog(false)}
          />
        </div>

        <div className="space-y-4">
          <BacktestSettingsPanel
            asset={asset}
            capital={capital}
            dataSettings={dataSettings}
            loading={loading}
            onAssetChange={setAsset}
            onCapitalChange={setCapital}
            onDataSettingsChange={setDataSettings}
            onRun={runBacktest}
          />
        </div>
      </div>

      {error && (
        <div className="card border-red-800 bg-red-950/50 text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`px-2 py-1 rounded ${
                  dataSettings.useMock
                    ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700"
                    : "bg-blue-900/30 text-blue-400 border border-blue-700"
                }`}
              >
                {dataSettings.useMock ? "MOCK DATA" : "YAHOO FINANCE"}
              </span>
              <span className="text-zinc-500">
                {formatDataSourceBadge(dataSettings, asset)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ExportButtons result={result} asset={asset} />
              <button
                onClick={handleShare}
                className="btn btn-ghost text-xs"
              >
                {shareMessage || "Share"}
              </button>
            </div>
          </div>

          <BacktestSummaryCards metrics={result.metrics} />
          <BacktestMetricsTable result={result} />

          {result.equityCurve.length > 0 && (
            <>
              <OverlaySelector
                savedStrategies={savedStrategies}
                currentAsset={asset}
                currentDataSettings={dataSettings}
                selectedOverlayId={selectedOverlayId}
                onSelect={setSelectedOverlayId}
              />
              {ohlcvData.length > 0 && (
                <>
                  <IndicatorToggles onIndicatorChange={setIndicators} />
                  <PriceChart
                    ohlcvData={ohlcvData}
                    trades={result.trades}
                    indicators={indicators}
                  />
                </>
              )}
              <EquityChart
                equityCurve={result.equityCurve}
                trades={result.trades}
                initialCapital={result.initialCapital}
                overlayEquityCurve={overlayStrategy?.lastResult?.equityCurve}
                overlayLabel={overlayStrategy?.name}
              />
              <DrawdownChart equityCurve={result.equityCurve} />
            </>
          )}

          <TradeTable trades={result.trades} />
          <MonthlyPnL trades={result.trades} />
        </div>
      )}
    </div>
  );
}
