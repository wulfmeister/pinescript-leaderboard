import { NextRequest, NextResponse } from "next/server";
import { DataFeed } from "@pinescript-utils/data-feed";
import { ArenaEngine, ARENA_PROMPTS } from "@pinescript-utils/llm-arena";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      models,
      rounds = 1,
      prompts,
      mock = true,
      capital = 10000,
    } = body;

    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "VENICE_API_KEY not configured. Add it to web/.env.local" },
        { status: 500 }
      );
    }

    if (!models || models.length < 2) {
      return NextResponse.json(
        { error: "At least 2 models are required for an arena match" },
        { status: 400 }
      );
    }

    // Fetch data
    const feed = new DataFeed();
    const data = mock
      ? feed.getMockData("random", 252, 100)
      : await feed.fetchHistorical("AAPL", "1d", new Date("2023-01-01"), new Date());

    const arena = new ArenaEngine({
      apiKey,
      models,
      rounds,
      initialCapital: capital,
    });

    const result = await arena.runTournament(
      data,
      "ARENA",
      prompts ?? ARENA_PROMPTS.slice(0, rounds)
    );

    // Serialize results (strip large equity curves from matchups)
    const matchups = result.matchups.map((m) => ({
      prompt: m.prompt,
      winner: m.winner,
      competitors: m.competitors.map((c) => ({
        model: c.model,
        score: c.score,
        error: c.error,
        codeLength: c.generatedCode.length,
        generatedCode: c.generatedCode,
        metrics: c.backtestResult?.metrics ?? null,
        finalCapital: c.backtestResult?.finalCapital ?? null,
      })),
    }));

    return NextResponse.json({
      standings: result.standings,
      matchups,
      elapsedMs: result.elapsedMs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Arena failed" },
      { status: 500 }
    );
  }
}
