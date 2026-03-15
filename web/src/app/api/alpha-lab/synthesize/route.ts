/**
 * POST /api/alpha-lab/synthesize — Start a Factor Synthesis job.
 *
 * Generates diverse alpha factors via LLM, prunes correlated ones,
 * and combines survivors into a composite strategy.
 */

import { NextRequest, NextResponse } from "next/server";
import { dataFeed } from "@pinescript-utils/data-feed";
import { runFactorSynthesis } from "@pinescript-utils/alpha-lab";
import {
  createJob,
  startJob,
  emitJobEvent,
  completeJob,
  failJob,
} from "@/app/lib/job-manager";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "VENICE_API_KEY environment variable is required" },
        { status: 500 },
      );
    }

    const body = await request.json();

    const {
      asset = "AAPL",
      capital = 10000,
      mock = false,
      mockType = "random",
      mockBars = 500,
      timeframe = "1d",
      from: startDate,
      to: endDate,
      // Synthesis-specific
      factorCount = 15,
      correlationThreshold = 0.7,
      weightingMethod = "sharpe-weighted",
      signalMode = "position",
      maxIterations = 3,
      objective = "sharpe",
      model,
    } = body;

    // Validate numeric bounds
    if (factorCount < 2 || factorCount > 50) {
      return NextResponse.json(
        { error: "factorCount must be 2-50" },
        { status: 400 },
      );
    }
    if (correlationThreshold < 0 || correlationThreshold > 1) {
      return NextResponse.json(
        { error: "correlationThreshold must be 0-1" },
        { status: 400 },
      );
    }

    // Fetch data
    let data;
    try {
      if (mock) {
        data = dataFeed.getMockData(mockType, mockBars, 100);
      } else {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: "from and to dates are required for real data" },
            { status: 400 },
          );
        }
        data = await dataFeed.fetchHistorical(
          asset,
          timeframe,
          new Date(startDate),
          new Date(endDate),
        );
      }
    } catch (fetchErr) {
      const message = fetchErr instanceof Error ? fetchErr.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to fetch market data: ${message}` },
        { status: 502 },
      );
    }

    // Create job and start synthesis in the background
    const job = createJob("synthesize");
    startJob(job.id);

    runFactorSynthesis(data, asset, {
      apiKey,
      model,
      factorCount,
      correlationThreshold,
      weightingMethod,
      signalMode,
      maxIterations,
      objective,
      initialCapital: capital,
      signal: job.abortController?.signal,
      onProgress: (event) => emitJobEvent(job.id, event),
    })
      .then((result) => completeJob(job.id, result))
      .catch((err) =>
        failJob(
          job.id,
          err instanceof Error ? err.message : "Synthesis failed",
        ),
      );

    return NextResponse.json({ jobId: job.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
