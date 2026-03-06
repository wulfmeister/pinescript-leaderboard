import type { Signal } from "@pinescript-utils/core";

type StrategyDirection = "long" | "short";

interface SignalContext {
  timestamp: number;
  price: number;
}

type StrategyCallable = ((title: string, overlay?: boolean) => void) & {
  long: StrategyDirection;
  short: StrategyDirection;
  entry: (
    id: string,
    direction: StrategyDirection,
    context?: Partial<SignalContext>,
  ) => void;
  close: (id: string, context?: Partial<SignalContext>) => void;
  exit: (
    id: string,
    fromEntry?: string,
    context?: Partial<SignalContext>,
  ) => void;
};

export class StrategyNamespace {
  readonly strategy: StrategyCallable;

  private readonly signals: Signal[] = [];
  private longPosition = false;
  private shortPosition = false;
  private currentTimestamp = 0;
  private currentPrice = 0;

  constructor(private readonly contextProvider?: () => SignalContext) {
    const strategyFn = ((
      _title: string,
      _overlay = true,
    ): void => {}) as StrategyCallable;

    strategyFn.long = "long";
    strategyFn.short = "short";
    strategyFn.entry = this.entry.bind(this);
    strategyFn.close = this.close.bind(this);
    strategyFn.exit = this.exit.bind(this);

    this.strategy = strategyFn;
  }

  setCurrentBar(timestamp: number, price: number): void {
    this.currentTimestamp = timestamp;
    this.currentPrice = price;
  }

  param<T>(source: T | T[], index = 0): T {
    if (Array.isArray(source)) {
      return source[index] as T;
    }
    return source;
  }

  entry(
    id: string,
    direction: StrategyDirection,
    context?: Partial<SignalContext>,
  ): void {
    const signalContext = this.resolveContext(context);

    if (direction === "long" && !this.longPosition) {
      if (this.shortPosition) {
        this.signals.push({
          timestamp: signalContext.timestamp,
          action: "buy",
          price: signalContext.price,
          metadata: { ruleId: id, closeShort: true },
        });
        this.shortPosition = false;
      }

      this.signals.push({
        timestamp: signalContext.timestamp,
        action: "buy",
        price: signalContext.price,
        metadata: { ruleId: id, direction: "long" },
      });
      this.longPosition = true;
      return;
    }

    if (direction === "short" && !this.shortPosition) {
      if (this.longPosition) {
        this.signals.push({
          timestamp: signalContext.timestamp,
          action: "sell",
          price: signalContext.price,
          metadata: { ruleId: id, closeLong: true },
        });
        this.longPosition = false;
      }

      this.signals.push({
        timestamp: signalContext.timestamp,
        action: "sell",
        price: signalContext.price,
        metadata: { ruleId: id, direction: "short" },
      });
      this.shortPosition = true;
    }
  }

  close(id: string, context?: Partial<SignalContext>): void {
    if (!this.longPosition && !this.shortPosition) return;

    const signalContext = this.resolveContext(context);

    if (this.longPosition) {
      this.signals.push({
        timestamp: signalContext.timestamp,
        action: "sell",
        price: signalContext.price,
        metadata: { ruleId: id },
      });
      this.longPosition = false;
    }

    if (this.shortPosition) {
      this.signals.push({
        timestamp: signalContext.timestamp,
        action: "buy",
        price: signalContext.price,
        metadata: { ruleId: id, closeShort: true },
      });
      this.shortPosition = false;
    }
  }

  exit(
    id: string,
    _fromEntry?: string,
    context?: Partial<SignalContext>,
  ): void {
    this.close(id, context);
  }

  getSignals(): Signal[] {
    return [...this.signals];
  }

  private resolveContext(context?: Partial<SignalContext>): SignalContext {
    const resolved = this.contextProvider?.();
    return {
      timestamp:
        context?.timestamp ?? resolved?.timestamp ?? this.currentTimestamp,
      price: context?.price ?? resolved?.price ?? this.currentPrice,
    };
  }
}
