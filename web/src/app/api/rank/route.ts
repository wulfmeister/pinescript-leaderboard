import { NextRequest, NextResponse } from "next/server";
import { pineRuntime } from "@pinescript-utils/pine-runtime";
import { StrategyRanker } from "@pinescript-utils/ranker";
import { DataFeed } from "@pinescript-utils/data-feed";
import type { StrategyDefinition } from "@pinescript-utils/ranker";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      strategies: rawStrategies,
      asset,
      timeframe = "1d",
      from,
      to,
      capital = 10000,
      mock = false,
      mockType = "random",
      mockBars = 252,
      minTrades = 1,
    } = body;

    if (!rawStrategies || !Array.isArray(rawStrategies) || rawStrategies.length === 0) {
      return NextResponse.json(
        { error: "strategies array is required" },
        { status: 400 }
      );
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

    // Parse each strategy
    const definitions: StrategyDefinition[] = [];
    for (const raw of rawStrategies) {
      try {
        const signals = await pineRuntime.executeStrategy(raw.script, data, capital);
        definitions.push({
          name: raw.name || "Unnamed",
          description: raw.description,
          signals,
        });
      } catch {
        // skip invalid strategies
      }
    }

    const ranker = new StrategyRanker({ minTrades });
    const results = await ranker.rankStrategies(definitions, data, asset || "MOCK");

    return NextResponse.json({
      rankings: results.map((r) => ({
        rank: r.rank,
        name: r.name,
        description: r.description,
        score: r.score,
        metrics: r.result.metrics,
        initialCapital: r.result.initialCapital,
        finalCapital: r.result.finalCapital,
        equityCurve: r.result.equityCurve,
      })),
      dataPoints: data.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Ranking failed" },
      { status: 500 }
    );
  }
}
