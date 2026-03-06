import { NextRequest, NextResponse } from "next/server";
import { createVeniceClient } from "@pinescript-utils/venice";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "VENICE_API_KEY not configured. Add it to web/.env.local" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { action, ...params } = body;

    const client = createVeniceClient(apiKey);

    switch (action) {
      case "generate": {
        const code = await client.generateStrategy(params.description, {
          model: params.model,
        });
        return NextResponse.json({ code });
      }

      case "analyse": {
        const analysis = await client.analyseResults(
          params.strategyCode,
          params.metricsJson,
          { model: params.model }
        );
        return NextResponse.json({ analysis });
      }

      case "chat": {
        const response = await client.prompt(
          params.prompt,
          params.systemPrompt || "You are an expert PineScript and quantitative trading assistant.",
          { model: params.model, temperature: params.temperature }
        );
        return NextResponse.json({ response });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "LLM request failed" },
      { status: 500 }
    );
  }
}
