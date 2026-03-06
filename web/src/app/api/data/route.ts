import { NextRequest, NextResponse } from "next/server";
import { DataFeed } from "@pinescript-utils/data-feed";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const asset = searchParams.get("asset") || "AAPL";
    const timeframe = searchParams.get("timeframe") || "1d";
    const from = searchParams.get("from") || "2023-01-01";
    const to = searchParams.get("to");
    const mock = searchParams.get("mock") === "true";

    const feed = new DataFeed();
    let data;
    if (mock) {
      data = feed.getMockData("random", 252, 100);
    } else {
      data = await feed.fetchHistorical(
        asset,
        timeframe as any,
        new Date(from),
        to ? new Date(to) : new Date()
      );
    }

    return NextResponse.json({
      symbol: asset,
      timeframe,
      count: data.length,
      data: data.slice(-50), // last 50 candles
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Data fetch failed" },
      { status: 500 }
    );
  }
}
