import { NextRequest, NextResponse } from "next/server";
import { pineRuntime } from "@pinescript-utils/pine-runtime";
import { BacktestEngine } from "@pinescript-utils/backtester";
import { DataFeed } from "@pinescript-utils/data-feed";
import { runMonteCarloSimulation } from "@pinescript-utils/monte-carlo";

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
      simulations = 1000,
      ruinThreshold = 0.5,
      seed = 42,
    } = body;

    if (!script) {
      return NextResponse.json({ error: "script is required" }, { status: 400 });
    }

    if (!mock && from && to && new Date(from) > new Date(to)) {
      return NextResponse.json(
        { error: "From date must be before To date" },
        { status: 400 }
      );
    }

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

    // Run backtest
    const signals = await pineRuntime.executeStrategy(script, data, capital);
    const engineConfig: any = { initialCapital: capital };
    if (riskManagement) engineConfig.riskManagement = riskManagement;
    const engine = new BacktestEngine(engineConfig);
    const backtestResult = await engine.run(signals, data, asset || "MOCK");

    // Run Monte Carlo
    const mcResult = runMonteCarloSimulation(backtestResult, {
      simulations,
      ruinThreshold,
      seed,
    });

    return NextResponse.json(mcResult);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Monte Carlo simulation failed" },
      { status: 500 }
    );
  }
}
