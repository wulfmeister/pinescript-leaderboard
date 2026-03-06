import { NextRequest, NextResponse } from "next/server";
import { DataFeed } from "@pinescript-utils/data-feed";
import { StrategyOptimizer } from "@pinescript-utils/optimizer";
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
      mockBars = 252,
      objective = "sharpe",
      minTrades = 3,
      topN = 20,
      parameterRanges,
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

    const optimizer = new StrategyOptimizer();

    // Extract parameter info
    const detectedRanges = optimizer.getParameterRanges(script);
    if (detectedRanges.length === 0 && !parameterRanges) {
      return NextResponse.json(
        { error: "No input() parameters found in strategy" },
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

    // Run optimization
    const result = await optimizer.optimize(
      script,
      data,
      asset || "MOCK",
      {
        objective: objective as OptimizationObjective,
        minTrades,
        initialCapital: capital,
        parameterRanges: parameterRanges ?? undefined,
      }
    );

    // Return top N runs (without full equity curves to keep response small)
    const topRuns = result.runs.slice(0, topN).map((run) => ({
      params: run.params,
      score: run.score,
      metrics: run.result.metrics,
      finalCapital: run.result.finalCapital,
    }));

    return NextResponse.json({
      best: {
        params: result.best.params,
        score: result.best.score,
        metrics: result.best.result.metrics,
        finalCapital: result.best.result.finalCapital,
        equityCurve: result.best.result.equityCurve,
      },
      runs: topRuns,
      parameters: result.parameters,
      totalCombinations: result.totalCombinations,
      validResults: result.runs.length,
      elapsedMs: result.elapsedMs,
      objective: result.objective,
      dataPoints: data.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Optimization failed" },
      { status: 500 }
    );
  }
}
