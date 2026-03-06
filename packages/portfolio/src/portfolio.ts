import type { Trade } from "@pinescript-utils/core";
import { calculateMetrics } from "@pinescript-utils/core";
import { BacktestEngine } from "@pinescript-utils/backtester";
import { pineRuntime } from "@pinescript-utils/pine-runtime";
import { alignEquityCurves } from "./alignment.js";
import { calculateCorrelationMatrix } from "./correlation.js";
import type { AssetResult, PortfolioConfig, PortfolioResult } from "./types.js";

function validateConfig(config: PortfolioConfig): void {
  const assetCount = config.assets.length;
  if (assetCount < 1 || assetCount > 10) {
    throw new Error("Portfolio requires between 1 and 10 assets.");
  }

  if (!config.script || config.script.trim().length === 0) {
    throw new Error("Portfolio requires a non-empty script.");
  }

  if (!Number.isFinite(config.totalCapital) || config.totalCapital <= 0) {
    throw new Error("Portfolio totalCapital must be greater than 0.");
  }
}

export async function runPortfolioBacktest(
  config: PortfolioConfig,
): Promise<PortfolioResult> {
  validateConfig(config);

  const startedAt = Date.now();
  const allocation = config.totalCapital / config.assets.length;

  const perAsset: AssetResult[] = await Promise.all(
    config.assets.map(async ({ symbol, data }) => {
      const signals = await pineRuntime.executeStrategy(
        config.script,
        data,
        allocation,
      );
      const engine = new BacktestEngine({
        ...config.backtestConfig,
        initialCapital: allocation,
      });
      const result = await engine.run(signals, data, symbol);

      return {
        symbol,
        allocation,
        result,
        signalCount: signals.length,
      };
    }),
  );

  const curves = new Map(
    perAsset.map((asset) => [asset.symbol, asset.result.equityCurve]),
  );
  const combinedCurve =
    perAsset.length === 1
      ? [...perAsset[0].result.equityCurve]
      : alignEquityCurves(curves, config.totalCapital);
  const finalCapital =
    combinedCurve[combinedCurve.length - 1]?.equity ?? config.totalCapital;

  const allTrades: Trade[] = perAsset
    .flatMap((asset) => asset.result.trades)
    .sort((a, b) => a.timestamp - b.timestamp);

  const startTime = combinedCurve[0]?.timestamp ?? 0;
  const endTime = combinedCurve[combinedCurve.length - 1]?.timestamp ?? 0;
  const metrics = calculateMetrics(
    allTrades,
    combinedCurve.map((p) => p.equity),
    config.totalCapital,
    finalCapital,
    startTime,
    endTime,
  );

  const correlationMatrix = calculateCorrelationMatrix(
    new Map(config.assets.map((asset) => [asset.symbol, asset.data])),
  );

  return {
    perAsset,
    combined: {
      equityCurve: combinedCurve,
      metrics,
      initialCapital: config.totalCapital,
      finalCapital,
      trades: allTrades,
    },
    correlationMatrix,
    assetSymbols: perAsset.map((asset) => asset.symbol),
    totalCapital: config.totalCapital,
    elapsedMs: Date.now() - startedAt,
  };
}
