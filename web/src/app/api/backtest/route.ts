import { NextRequest, NextResponse } from "next/server";
import { pineRuntime } from "@pinescript-utils/pine-runtime";
import { BacktestEngine } from "@pinescript-utils/backtester";
import { DataFeed } from "@pinescript-utils/data-feed";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      script,
      asset,
      timeframe = "1d",
      from,
      to,
      capital = 10000,
      mock = false,
      mockType = "random",
      mockBars = 252,
      riskManagement,
    } = body;

    if (!script) {
      return NextResponse.json({ error: "script is required" }, { status: 400 });
    }

    // Validate date range for real data
    if (!mock && from && to && new Date(from) > new Date(to)) {
      return NextResponse.json(
        { error: "From date must be before To date" },
        { status: 400 }
      );
    }

    // Validate mock bar count
    if (mock && (mockBars < 50 || mockBars > 1000)) {
      return NextResponse.json(
        { error: "Mock bar count must be between 50 and 1000" },
        { status: 400 }
      );
    }

    const feed = new DataFeed();
    let data;
    if (mock) {
      data = feed.getMockData(mockType, mockBars, 100);
    } else {
      data = await feed.fetchHistorical(
        asset || "AAPL",
        timeframe,
        new Date(from || "2023-01-01"),
        to ? new Date(to) : new Date()
      );
    }

    const signals = await pineRuntime.executeStrategy(script, data, capital);
    const engineConfig: any = { initialCapital: capital };
    if (riskManagement) engineConfig.riskManagement = riskManagement;
    const engine = new BacktestEngine(engineConfig);
    const result = await engine.run(signals, data, asset || "MOCK");

    return NextResponse.json({
      trades: result.trades,
      equityCurve: result.equityCurve,
      metrics: result.metrics,
      initialCapital: result.initialCapital,
      finalCapital: result.finalCapital,
      startTime: result.startTime,
      endTime: result.endTime,
      dataPoints: data.length,
      signalCount: signals.length,
      ohlcv: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Backtest failed" },
      { status: 500 }
    );
  }
}
