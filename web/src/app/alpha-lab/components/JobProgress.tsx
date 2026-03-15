/**
 * Live job progress display, connected to the SSE event stream.
 *
 * Shows a progress bar, current phase, and a scrolling event log.
 * Used by all three Alpha Lab modes.
 */

"use client";

import { useRef, useEffect } from "react";

interface JobEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface Props {
  status: string;
  events: JobEvent[];
  error: string | null;
  onCancel: () => void;
}

/** Map event types to human-readable labels. */
function formatEvent(event: JobEvent): string {
  const d = event.data;
  switch (event.type) {
    // Genetic Evolver events
    case "evolution_start":
      return `Starting evolution: ${d.generations} generations, population ${d.populationSize}`;
    case "generation_start":
      return `Generation ${(d.index as number) + 1} — parent: ${d.parentName} (score: ${(d.parentScore as number)?.toFixed(3)})`;
    case "candidate_generating":
      return `  Generating ${d.origin}...`;
    case "candidate_backtested":
      return `  ${d.name}: score ${(d.score as number)?.toFixed(3)} (${d.origin})`;
    case "candidate_failed":
      return `  Failed: ${d.error}`;
    case "generation_complete":
      return `Generation ${(d.index as number) + 1} complete — best: ${(d.bestScore as number)?.toFixed(3)} (${d.invalidCount} invalid)`;
    case "evolution_complete":
      return `Evolution complete! Best score: ${(d.bestScore as number)?.toFixed(3)}`;

    // Factor Synthesis events
    case "synthesis_start":
      return `Starting synthesis: ${d.factorCount} factors across ${(d.categories as string[])?.length} categories`;
    case "iteration_start":
      return `Iteration ${(d.iteration as number) + 1}: generating ${d.factorsToGenerate} factors`;
    case "factor_generating":
      return `  Generating ${d.category} factor...`;
    case "factor_backtested":
      return `  ${d.name}: score ${(d.score as number)?.toFixed(3)} (${d.trades} trades)`;
    case "factor_failed":
      return `  ${d.category} factor failed: ${d.error}`;
    case "correlation_computed":
      return `Correlation: ${d.survivingCount} surviving, ${d.prunedCount} pruned`;
    case "weights_computed":
      return `Weights calculated (${d.method})`;
    case "synthesis_complete":
      return `Synthesis complete! ${d.survivingCount} factors, composite score: ${(d.compositeScore as number)?.toFixed(3)}`;

    // Adaptive Walk-Forward events
    case "adaptive_start":
      return `Starting adaptive WF: ${d.windows} windows, threshold ${d.failureThreshold}`;
    case "baseline_running":
      return `Running baseline walk-forward...`;
    case "baseline_complete":
      return `Baseline: efficiency ${(d.efficiency as number)?.toFixed(3)}, ${d.failingWindowCount} failing windows`;
    case "adaptation_start":
      return `Adaptation round ${(d.round as number) + 1}: ${d.failingWindowCount} failing windows`;
    case "diagnosis_complete":
      return `  Diagnosis: ${(d.diagnosis as string)?.slice(0, 100)}...`;
    case "fix_generated":
      return `  Fix generated (${d.codeLength} chars)`;
    case "adaptation_complete":
      return `  Efficiency: ${(d.efficiencyBefore as number)?.toFixed(3)} → ${(d.efficiencyAfter as number)?.toFixed(3)} ${d.improved ? "(improved)" : "(no improvement)"}`;
    case "adaptive_complete":
      return `Adaptive WF complete! ${(d.bestEfficiency as number)?.toFixed(3)} efficiency`;

    // Terminal
    case "job_complete":
      return "Job completed successfully.";
    case "job_failed":
      return `Job failed: ${d.error}`;
    case "job_cancelled":
      return "Job cancelled.";

    default:
      return `${event.type}: ${JSON.stringify(d)}`;
  }
}

export function JobProgress({ status, events, error, onCancel }: Props) {
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the event log to the bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events.length]);

  if (status === "idle") return null;

  const isRunning = status === "connecting" || status === "running";

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">
          {isRunning
            ? "Running..."
            : status === "completed"
              ? "Complete"
              : "Stopped"}
        </h3>
        {isRunning && (
          <button
            onClick={onCancel}
            className="btn btn-ghost text-xs text-red-400"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="w-full bg-zinc-800 rounded-full h-2 mb-3">
          <div
            className="bg-brand-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${estimateProgress(events)}%` }}
          />
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-red-400 text-sm mb-3 p-2 bg-red-900/20 rounded">
          {error}
        </div>
      )}

      {/* Event log */}
      <div
        ref={logRef}
        className="bg-zinc-950 rounded-md p-3 max-h-[300px] overflow-y-auto font-mono text-xs leading-relaxed"
      >
        {events.map((event, i) => (
          <div
            key={i}
            className={`${
              event.type.includes("failed") || event.type.includes("error")
                ? "text-red-400"
                : event.type.includes("complete") ||
                    event.type.includes("backtested")
                  ? "text-green-400"
                  : "text-zinc-400"
            }`}
          >
            {formatEvent(event)}
          </div>
        ))}
        {isRunning && (
          <div className="text-zinc-600 animate-pulse">
            Waiting for next event...
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Rough progress estimate based on event types.
 * This is a heuristic — not exact.
 */
function estimateProgress(events: JobEvent[]): number {
  const last = events[events.length - 1];
  if (!last) return 5;

  // Look for generation/iteration indices to estimate progress
  if (
    last.type === "generation_complete" &&
    typeof last.data.index === "number"
  ) {
    const total =
      (events.find((e) => e.type === "evolution_start")?.data
        .generations as number) ?? 10;
    return Math.min(95, (((last.data.index as number) + 1) / total) * 100);
  }
  if (
    last.type === "correlation_computed" &&
    typeof last.data.iteration === "number"
  ) {
    const total = 3; // maxIterations default
    return Math.min(
      95,
      (((last.data.iteration as number) + 1) / total) * 90 + 10,
    );
  }
  if (
    last.type === "adaptation_complete" &&
    typeof last.data.round === "number"
  ) {
    return Math.min(95, (((last.data.round as number) + 1) / 3) * 90 + 10);
  }
  if (last.type.includes("complete")) return 100;
  if (last.type.includes("start")) return 10;

  return 50;
}
