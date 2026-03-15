/**
 * Reusable server-side Job Manager with SSE streaming.
 *
 * Manages long-running jobs (evolution, synthesis, walk-forward) and
 * streams progress events to clients via Server-Sent Events.
 *
 * Usage:
 *   // In an API route — start a job:
 *   const job = jobManager.create("evolve");
 *   runGeneticEvolution(data, symbol, {
 *     ...config,
 *     onProgress: (event) => jobManager.emit(job.id, event),
 *   }).then((result) => jobManager.complete(job.id, result))
 *     .catch((err) => jobManager.fail(job.id, err.message));
 *   return Response.json({ jobId: job.id });
 *
 *   // In the SSE route — stream events:
 *   const stream = jobManager.subscribe(jobId);
 *   return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
 */

export interface JobEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface Job<T = unknown> {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  events: JobEvent[];
  result?: T;
  error?: string;
  createdAt: number;
  updatedAt: number;
  /** AbortController for cancelling the running job's work. */
  abortController?: AbortController;
}

// In-memory job store — lives for the lifetime of the server process.
// This is intentional: jobs are ephemeral and don't need persistence.
const jobs = new Map<string, Job>();

// SSE subscribers: jobId -> Set of push functions
const subscribers = new Map<string, Set<(event: JobEvent) => void>>();

let idCounter = 0;

function generateJobId(): string {
  idCounter++;
  return `job_${Date.now()}_${idCounter}`;
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupInterval(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => cleanupJobs(), 30 * 60 * 1000);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Create a new job and return it.
 */
export function createJob(type: string): Job {
  startCleanupInterval();
  const job: Job = {
    id: generateJobId(),
    type,
    status: "pending",
    progress: 0,
    events: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    abortController: new AbortController(),
  };
  jobs.set(job.id, job);
  return job;
}

/**
 * Get a job by ID.
 */
export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Mark a job as running.
 */
export function startJob(id: string): void {
  const job = jobs.get(id);
  if (job) {
    job.status = "running";
    job.updatedAt = Date.now();
  }
}

/**
 * Emit a progress event for a job.
 * Pushes to all SSE subscribers and stores in the event log.
 */
export function emitJobEvent(id: string, event: JobEvent): void {
  const job = jobs.get(id);
  if (!job) return;

  job.events.push(event);
  job.updatedAt = Date.now();

  // Calculate progress from event data if available
  if (typeof event.data.progress === "number") {
    job.progress = event.data.progress;
  }

  // Push to all SSE subscribers
  const subs = subscribers.get(id);
  if (subs) {
    for (const push of subs) {
      push(event);
    }
  }
}

/**
 * Mark a job as completed with a result.
 */
export function completeJob<T>(id: string, result: T): void {
  const job = jobs.get(id);
  if (!job) return;

  // Don't overwrite cancelled status — the engine finished after cancellation
  if (job.status === "cancelled") return;

  job.status = "completed";
  job.progress = 100;
  job.result = result;
  job.updatedAt = Date.now();

  // Notify subscribers of completion
  const completionEvent: JobEvent = {
    type: "job_complete",
    data: { result },
    timestamp: Date.now(),
  };
  job.events.push(completionEvent);

  const subs = subscribers.get(id);
  if (subs) {
    for (const push of subs) {
      push(completionEvent);
    }
  }
}

/**
 * Mark a job as failed.
 */
export function failJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;

  // Don't overwrite cancelled status
  if (job.status === "cancelled") return;

  job.status = "failed";
  job.error = error;
  job.updatedAt = Date.now();

  const failEvent: JobEvent = {
    type: "job_failed",
    data: { error },
    timestamp: Date.now(),
  };
  job.events.push(failEvent);

  const subs = subscribers.get(id);
  if (subs) {
    for (const push of subs) {
      push(failEvent);
    }
  }
}

/**
 * Cancel a running job.
 */
export function cancelJob(id: string): void {
  const job = jobs.get(id);
  if (!job || job.status === "completed" || job.status === "failed") return;

  // Signal the running engine to stop
  job.abortController?.abort();

  job.status = "cancelled";
  job.updatedAt = Date.now();

  const cancelEvent: JobEvent = {
    type: "job_cancelled",
    data: {},
    timestamp: Date.now(),
  };
  job.events.push(cancelEvent);

  const subs = subscribers.get(id);
  if (subs) {
    for (const push of subs) {
      push(cancelEvent);
    }
  }
}

/**
 * Create an SSE-compatible ReadableStream that pushes job events.
 *
 * The stream replays all existing events first, then pushes new events
 * as they arrive. Closes when the job completes, fails, or is cancelled.
 */
export function subscribeToJob(id: string): ReadableStream | null {
  const job = jobs.get(id);
  if (!job) return null;

  const encoder = new TextEncoder();

  // Track the push function so cancel() can clean it up
  let pushRef: ((event: JobEvent) => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (!pushRef) return;
    const subs = subscribers.get(id);
    if (subs) {
      subs.delete(pushRef);
      if (subs.size === 0) subscribers.delete(id);
    }
    pushRef = null;
  };

  return new ReadableStream({
    start(controller) {
      // Replay existing events
      for (const event of job.events) {
        const line = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(line));
      }

      // If job is already terminal, close immediately
      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled"
      ) {
        controller.close();
        return;
      }

      // Subscribe to new events
      const push = (event: JobEvent) => {
        try {
          const line = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));

          // Close stream on terminal events
          if (
            event.type === "job_complete" ||
            event.type === "job_failed" ||
            event.type === "job_cancelled"
          ) {
            // Delay ensures the terminal event is flushed to the
            // client's ReadableStream before closing the stream.
            setTimeout(() => {
              try {
                controller.close();
              } catch {
                /* already closed */
              }
              cleanup();
            }, 100);
          }
        } catch {
          // Stream may have been cancelled by client
          cleanup();
        }
      };

      pushRef = push;

      // Register subscriber
      if (!subscribers.has(id)) {
        subscribers.set(id, new Set());
      }
      subscribers.get(id)!.add(push);

      // Send a heartbeat every 30s to keep the connection alive for long-running jobs
      heartbeatTimer = setInterval(() => {
        if (job.status !== "running" && job.status !== "pending") {
          clearInterval(heartbeatTimer!);
          heartbeatTimer = null;
          return;
        }
        try {
          const heartbeat: JobEvent = {
            type: "job_heartbeat",
            data: {},
            timestamp: Date.now(),
          };
          const line = `data: ${JSON.stringify(heartbeat)}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          cleanup();
        }
      }, 30_000);
    },

    // Called when the client disconnects — ensures deterministic cleanup
    cancel() {
      cleanup();
    },
  });
}

/**
 * Remove jobs older than maxAgeMs. Call periodically to prevent memory leaks.
 */
export function cleanupJobs(maxAgeMs: number = 3600000): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    // Never clean running or pending jobs — they may run for hours
    if (job.status === "running" || job.status === "pending") continue;
    if (now - job.updatedAt > maxAgeMs) {
      jobs.delete(id);
      subscribers.delete(id);
    }
  }
}
