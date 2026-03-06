import { NextRequest, NextResponse } from "next/server";
import type { OHLCV } from "@pinescript-utils/core";
import { DataFeed } from "@pinescript-utils/data-feed";
import { runPortfolioBacktest } from "@pinescript-utils/portfolio";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      script,
      assets,
      capital,
      mock = false,
      mockType = "random",
      mockBars = 252,
      timeframe = "1d",
      from,
      to,
      riskManagement,
    } = body;

    if (!script || typeof script !== "string" || script.trim() === "") {
      return NextResponse.json(
        { error: "script is required" },
        { status: 400 },
      );
    }

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json(
        { error: "assets array is required and must not be empty" },
        { status: 400 },
      );
    }

    if (assets.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 assets allowed" },
        { status: 400 },
      );
    }

    if (!capital || capital <= 0) {
      return NextResponse.json(
        { error: "capital is required and must be greater than 0" },
        { status: 400 },
      );
    }

    if (!mock && from && to && new Date(from) > new Date(to)) {
      return NextResponse.json(
        { error: "From date must be before To date" },
        { status: 400 },
      );
    }

    if (mock && (mockBars < 50 || mockBars > 1000)) {
      return NextResponse.json(
        { error: "Mock bar count must be between 50 and 1000" },
        { status: 400 },
      );
    }

    const startTime = Date.now();

    const seen = new Set<string>();
    const uniqueAssets: string[] = [];
    for (const asset of assets) {
      const upper = String(asset).toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        uniqueAssets.push(upper);
      }
    }

    const feed = new DataFeed();
    const warnings: string[] = [];
    const assetData: { symbol: string; data: OHLCV[] }[] = [];

    if (mock) {
      const results = await Promise.all(
        uniqueAssets.map(async (symbol) => {
          try {
            const data = feed.getMockData(mockType, mockBars, 100);
            return { symbol, data };
          } catch (err: any) {
            warnings.push(`Failed to fetch data for ${symbol}: ${err.message}`);
            return null;
          }
        }),
      );
      for (const r of results) {
        if (r) assetData.push(r);
      }
    } else {
      for (let i = 0; i < uniqueAssets.length; i++) {
        const symbol = uniqueAssets[i];
        try {
          const data = await feed.fetchHistorical(
            symbol,
            timeframe,
            new Date(from || "2023-01-01"),
            to ? new Date(to) : new Date(),
          );
          assetData.push({ symbol, data });
        } catch (err: any) {
          warnings.push(`Failed to fetch data for ${symbol}: ${err.message}`);
        }
        if (i < uniqueAssets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    if (assetData.length === 0) {
      return NextResponse.json(
        { error: "Failed to fetch data for all assets" },
        { status: 500 },
      );
    }

    const result = await runPortfolioBacktest({
      script,
      assets: assetData,
      totalCapital: capital,
      backtestConfig: { riskManagement },
    });

    const elapsedMs = Math.max(Date.now() - startTime, 1);

    return NextResponse.json({
      ...result,
      elapsedMs,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Portfolio backtest failed" },
      { status: 500 },
    );
  }
}
