import { NextRequest, NextResponse } from "next/server";
import { DataFeed } from "@pinescript-utils/data-feed";
import { WalkForwardAnalyzer } from "@pinescript-utils/walk-forward";
import type { OptimizationObjective } from "@pinescript-utils/optimizer";

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
      mockBars = 500,
      windows = 5,
      trainRatio = 0.7,
      objective = "sharpe",
      minTrades = 3,
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

    // Fetch data
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

    const analyzer = new WalkForwardAnalyzer();
    const result = await analyzer.analyze(script, data, asset || "MOCK", {
      windows,
      trainRatio,
      objective: objective as OptimizationObjective,
      minTrades,
      initialCapital: capital,
    });

    // Serialize window results (strip large equity curves)
    const windowResults = result.windows.map((w) => ({
      windowIndex: w.windowIndex,
      trainStart: w.trainStart,
      trainEnd: w.trainEnd,
      testStart: w.testStart,
      testEnd: w.testEnd,
      trainBars: w.trainBars,
      testBars: w.testBars,
      bestParams: w.bestParams,
      trainScore: w.trainScore,
      trainMetrics: w.trainMetrics,
      testMetrics: w.testMetrics,
      testEquityCurve: w.testResult.equityCurve,
      testFinalCapital: w.testResult.finalCapital,
    }));

    return NextResponse.json({
      windows: windowResults,
      aggregateMetrics: result.aggregateMetrics,
      efficiency: result.efficiency,
      elapsedMs: result.elapsedMs,
      dataPoints: data.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Walk-forward analysis failed" },
      { status: 500 }
    );
  }
}
