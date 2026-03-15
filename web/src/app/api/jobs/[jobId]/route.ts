/**
 * SSE endpoint for streaming job progress events.
 *
 * GET /api/jobs/:jobId
 *
 * Returns a text/event-stream that pushes JobEvent objects as they occur.
 * Replays all existing events first, then streams new ones in real-time.
 * The stream closes automatically when the job completes, fails, or is cancelled.
 */

import { NextRequest } from "next/server";
import {
  getJob,
  subscribeToJob,
  cancelJob,
} from "@/app/lib/job-manager";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const job = getJob(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = subscribeToJob(jobId);
  if (!stream) {
    return new Response(
      JSON.stringify({ error: "Could not subscribe to job" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * DELETE /api/jobs/:jobId — cancel a running job.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const job = getJob(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  cancelJob(jobId);
  return new Response(JSON.stringify({ status: "cancelled" }), {
    headers: { "Content-Type": "application/json" },
  });
}
