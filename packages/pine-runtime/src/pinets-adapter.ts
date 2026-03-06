import { Indicator, PineTS } from "pinets";
import type { OHLCV, Signal } from "@pinescript-utils/core";
import type {
  IPineRuntime,
  StrategyParameter,
  ValidationResult,
} from "./types.js";
import { preprocessV2 } from "./v2-preprocessor.js";
import { toCandles } from "./ohlcv-adapter.js";
import { StrategyNamespace } from "./strategy-namespace.js";
import { extractParams, mapOverrides } from "./param-mapper.js";
import { validateScript as validatePineScript } from "./validate.js";
import { getGlobalTranspileCache } from "./transpile-cache.js";

type StrategyCallableWithParam = ((
  title: string,
  overlay?: boolean,
) => void) & {
  long: "long";
  short: "short";
  entry: (
    id: string,
    direction: "long" | "short",
    context?: { timestamp?: number; price?: number },
  ) => void;
  close: (id: string, context?: { timestamp?: number; price?: number }) => void;
  exit: (
    id: string,
    fromEntry?: string,
    context?: { timestamp?: number; price?: number },
  ) => void;
  param?: <T>(source: T | T[], index?: number) => T;
};

export class PineTSAdapter implements IPineRuntime {
  private readonly transpileCache = getGlobalTranspileCache();

  async executeStrategy(
    script: string,
    data: OHLCV[],
    initialCapital: number,
    paramOverrides?: Record<string, number>,
  ): Promise<Signal[]> {
    void initialCapital;

    try {
      if (data.length === 0) return [];

      const preprocessedScript = preprocessV2(script);
      const candles = toCandles(data);
      if (candles.length === 0) return [];

      const params = extractParams(script);
      const mappedOverrides = paramOverrides
        ? mapOverrides(params, paramOverrides)
        : {};

      const cached = this.transpileCache.getOrTranspile(
        preprocessedScript,
        (source) => ({
          scriptHash: "",
          indicators: new Map<string, unknown>([["source", source]]),
          rules: new Map<string, unknown>(),
          inputs: new Map<string, number>(),
          timestamp: Date.now(),
        }),
      );

      const cachedScript = cached.indicators.get("source");
      const scriptToRun =
        typeof cachedScript === "string" ? cachedScript : preprocessedScript;

      let runtimeContext: any = null;
      const strategyNamespace = new StrategyNamespace(() => {
        const contextData = runtimeContext?.data;
        const idx =
          typeof runtimeContext?.idx === "number" ? runtimeContext.idx : 0;
        const openTimeSeries =
          contextData?.openTime && typeof contextData.openTime === "object"
            ? contextData.openTime
            : null;
        const closeSeries =
          contextData?.close && typeof contextData.close === "object"
            ? contextData.close
            : null;
        const timestamp = Array.isArray(openTimeSeries?.data)
          ? (openTimeSeries.data[idx] ?? openTimeSeries.data[0] ?? 0)
          : 0;
        const price = Array.isArray(closeSeries?.data)
          ? (closeSeries.data[idx] ?? closeSeries.data[0] ?? 0)
          : 0;

        return { timestamp, price };
      });

      const strategyCallable =
        strategyNamespace.strategy as StrategyCallableWithParam;
      strategyCallable.param = strategyNamespace.param.bind(strategyNamespace);

      const pinets = new PineTS(candles);
      this.injectStrategyNamespace(pinets, strategyCallable, (ctx) => {
        runtimeContext = ctx;
      });

      const runnable = new Indicator(scriptToRun, mappedOverrides);
      await pinets.run(runnable, candles.length);

      return strategyNamespace.getSignals();
    } catch {
      return [];
    }
  }

  async executeIndicator<T>(script: string, data: OHLCV[]): Promise<T[]> {
    try {
      const candles = toCandles(data);
      if (candles.length === 0) return [];

      const pinets = new PineTS(candles);
      const context = await pinets.run(preprocessV2(script), candles.length);
      const result = context?.result;

      if (Array.isArray(result)) {
        return result as T[];
      }

      return [];
    } catch {
      return [];
    }
  }

  extractParameters(script: string): StrategyParameter[] {
    return extractParams(script);
  }

  validateScript(script: string): ValidationResult {
    return validatePineScript(script);
  }

  private injectStrategyNamespace(
    pinets: PineTS,
    strategy: StrategyCallableWithParam,
    onContext: (context: unknown) => void,
  ): void {
    const runtime = pinets as unknown as {
      _initializeContext?: (inputs?: Record<string, unknown>) => any;
    };

    const originalInitializeContext = runtime._initializeContext;
    if (!originalInitializeContext) return;

    runtime._initializeContext = (inputs?: Record<string, unknown>) => {
      const context = originalInitializeContext.call(pinets, inputs);
      if (context?.pine) {
        context.pine.strategy = strategy;
      }
      onContext(context);
      return context;
    };
  }
}

export const pineRuntime = new PineTSAdapter();
