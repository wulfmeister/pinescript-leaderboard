/**
 * POST /api/alpha-lab/adaptive-wf — Start an Adaptive Walk-Forward job.
 *
 * Runs walk-forward analysis, identifies failing windows, and uses
 * the LLM to diagnose and fix the strategy iteratively.
 */

import { NextRequest, NextResponse } from "next/server";
import { dataFeed } from "@pinescript-utils/data-feed";
import { runAdaptiveWalkForward } from "@pinescript-utils/alpha-lab";
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
      script,
      asset = "AAPL",
      capital = 10000,
      mock = false,
      mockType = "random",
      mockBars = 500,
      timeframe = "1d",
      from: startDate,
      to: endDate,
      // Adaptive WF-specific
      windows = 5,
      trainRatio = 0.7,
      failureThreshold = 0,
      maxAdaptations = 3,
      objective = "sharpe",
      model,
    } = body;

    // Validation
    if (!script) {
      return NextResponse.json(
        { error: "script is required" },
        { status: 400 },
      );
    }

    // Validate numeric bounds
    if (windows < 1 || windows > 20) {
      return NextResponse.json(
        { error: "windows must be 1-20" },
        { status: 400 },
      );
    }
    if (trainRatio <= 0 || trainRatio >= 1) {
      return NextResponse.json(
        { error: "trainRatio must be between 0 and 1 (exclusive)" },
        { status: 400 },
      );
    }
    if (maxAdaptations < 1 || maxAdaptations > 10) {
      return NextResponse.json(
        { error: "maxAdaptations must be 1-10" },
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

    // Create job and start adaptive WF in the background
    const job = createJob("adaptive-wf");
    startJob(job.id);

    runAdaptiveWalkForward(data, asset, {
      script,
      apiKey,
      model,
      windows,
      trainRatio,
      failureThreshold,
      maxAdaptations,
      objective,
      initialCapital: capital,
      signal: job.abortController?.signal,
      onProgress: (event) => emitJobEvent(job.id, event),
    })
      .then((result) => completeJob(job.id, result))
      .catch((err) =>
        failJob(
          job.id,
          err instanceof Error ? err.message : "Adaptive WF failed",
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
