/**
 * SSE client hook for streaming job progress.
 *
 * Connects to GET /api/jobs/:jobId, receives events via SSE,
 * accumulates them, and exposes the current job state.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface JobEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

type JobStatus =
  | "idle"
  | "connecting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

interface UseJobReturn {
  status: JobStatus;
  events: JobEvent[];
  result: unknown | null;
  error: string | null;
  cancel: () => void;
}

const MAX_RETRIES = 3;
const MAX_EVENTS = 10_000;

/**
 * Subscribe to a job's SSE stream and accumulate events.
 *
 * @param jobId - The job ID to subscribe to. Pass null to not connect.
 */
export function useJob(jobId: string | null): UseJobReturn {
  const [status, setStatus] = useState<JobStatus>("idle");
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [result, setResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const statusRef = useRef<JobStatus>("idle");
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventTimestampRef = useRef(0);

  // Connect to SSE stream when jobId changes
  useEffect(() => {
    if (!jobId) {
      statusRef.current = "idle";
      setStatus("idle");
      return;
    }

    statusRef.current = "connecting";
    setStatus("connecting");
    setEvents([]);
    setResult(null);
    setError(null);
    retryCountRef.current = 0;
    lastEventTimestampRef.current = 0;

    function connect() {
      const es = new EventSource(`/api/jobs/${jobId}`);
      eventSourceRef.current = es;

      es.onopen = () => {
        retryCountRef.current = 0;
        statusRef.current = "running";
        setStatus("running");
      };

      es.onmessage = (msg) => {
        try {
          const event: JobEvent = JSON.parse(msg.data);

          // Deduplicate replayed events on reconnect
          if (event.timestamp <= lastEventTimestampRef.current) return;
          lastEventTimestampRef.current = event.timestamp;

          setEvents((prev) => {
            const next = [...prev, event];
            return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
          });

          // Handle terminal events
          if (event.type === "job_complete") {
            setResult(event.data.result ?? null);
            statusRef.current = "completed";
            setStatus("completed");
            es.close();
          } else if (event.type === "job_failed") {
            setError((event.data.error as string) ?? "Job failed");
            statusRef.current = "failed";
            setStatus("failed");
            es.close();
          } else if (event.type === "job_cancelled") {
            statusRef.current = "cancelled";
            setStatus("cancelled");
            es.close();
          }
        } catch (e) {
          console.warn("[useJob] Failed to parse SSE event:", e);
        }
      };

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          es.close();

          // Retry with exponential backoff if still connecting
          if (
            statusRef.current === "connecting" &&
            retryCountRef.current < MAX_RETRIES
          ) {
            const delay = 1000 * Math.pow(2, retryCountRef.current);
            retryCountRef.current++;
            retryTimerRef.current = setTimeout(connect, delay);
            return;
          }

          // Exhausted retries or never connected
          if (statusRef.current === "connecting") {
            statusRef.current = "failed";
            setStatus("failed");
            setError("Connection to job stream failed");
          }
        }
      };
    }

    connect();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [jobId]);

  // Cancel the job
  const cancel = useCallback(() => {
    if (!jobId) return;

    fetch(`/api/jobs/${jobId}`, { method: "DELETE" }).catch(() => {
      // Ignore errors — job may already be done
    });

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    eventSourceRef.current?.close();
    statusRef.current = "cancelled";
    setStatus("cancelled");
  }, [jobId]);

  return { status, events, result, error, cancel };
}
