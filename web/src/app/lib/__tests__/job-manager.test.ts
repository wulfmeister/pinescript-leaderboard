import { describe, it, expect } from "vitest";
import {
  createJob,
  getJob,
  startJob,
  emitJobEvent,
  completeJob,
  failJob,
  cancelJob,
  subscribeToJob,
  cleanupJobs,
  type JobEvent,
} from "../job-manager";

describe("JobManager", () => {
  describe("createJob", () => {
    it("creates a job with pending status", () => {
      const job = createJob("evolve");
      expect(job.id).toBeTruthy();
      expect(job.type).toBe("evolve");
      expect(job.status).toBe("pending");
      expect(job.progress).toBe(0);
      expect(job.events).toEqual([]);
    });

    it("generates unique IDs", () => {
      const job1 = createJob("a");
      const job2 = createJob("b");
      expect(job1.id).not.toBe(job2.id);
    });
  });

  describe("getJob", () => {
    it("retrieves a created job", () => {
      const job = createJob("test");
      const retrieved = getJob(job.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(job.id);
    });

    it("returns undefined for nonexistent job", () => {
      expect(getJob("nonexistent")).toBeUndefined();
    });
  });

  describe("startJob", () => {
    it("sets status to running", () => {
      const job = createJob("test");
      startJob(job.id);
      expect(getJob(job.id)!.status).toBe("running");
    });
  });

  describe("emitJobEvent", () => {
    it("appends event to job event log", () => {
      const job = createJob("test");
      const event: JobEvent = {
        type: "test_event",
        data: { value: 42 },
        timestamp: Date.now(),
      };
      emitJobEvent(job.id, event);

      const updated = getJob(job.id)!;
      expect(updated.events).toHaveLength(1);
      expect(updated.events[0].type).toBe("test_event");
      expect(updated.events[0].data.value).toBe(42);
    });

    it("updates progress when event has progress field", () => {
      const job = createJob("test");
      emitJobEvent(job.id, {
        type: "progress",
        data: { progress: 50 },
        timestamp: Date.now(),
      });
      expect(getJob(job.id)!.progress).toBe(50);
    });

    it("does nothing for nonexistent job", () => {
      // Should not throw
      emitJobEvent("nonexistent", {
        type: "test",
        data: {},
        timestamp: Date.now(),
      });
    });
  });

  describe("completeJob", () => {
    it("sets status to completed and stores result", () => {
      const job = createJob("test");
      startJob(job.id);
      completeJob(job.id, { answer: 42 });

      const updated = getJob(job.id)!;
      expect(updated.status).toBe("completed");
      expect(updated.progress).toBe(100);
      expect(updated.result).toEqual({ answer: 42 });
    });

    it("adds a job_complete event", () => {
      const job = createJob("test");
      completeJob(job.id, "done");

      const updated = getJob(job.id)!;
      const lastEvent = updated.events[updated.events.length - 1];
      expect(lastEvent.type).toBe("job_complete");
    });
  });

  describe("failJob", () => {
    it("sets status to failed and stores error", () => {
      const job = createJob("test");
      startJob(job.id);
      failJob(job.id, "Something went wrong");

      const updated = getJob(job.id)!;
      expect(updated.status).toBe("failed");
      expect(updated.error).toBe("Something went wrong");
    });

    it("adds a job_failed event", () => {
      const job = createJob("test");
      failJob(job.id, "error");

      const updated = getJob(job.id)!;
      const lastEvent = updated.events[updated.events.length - 1];
      expect(lastEvent.type).toBe("job_failed");
      expect(lastEvent.data.error).toBe("error");
    });
  });

  describe("cancelJob", () => {
    it("sets status to cancelled", () => {
      const job = createJob("test");
      startJob(job.id);
      cancelJob(job.id);

      expect(getJob(job.id)!.status).toBe("cancelled");
    });

    it("does not cancel already completed job", () => {
      const job = createJob("test");
      completeJob(job.id, "result");
      cancelJob(job.id);

      // Should still be completed
      expect(getJob(job.id)!.status).toBe("completed");
    });

    it("adds a job_cancelled event", () => {
      const job = createJob("test");
      startJob(job.id);
      cancelJob(job.id);

      const updated = getJob(job.id)!;
      const lastEvent = updated.events[updated.events.length - 1];
      expect(lastEvent.type).toBe("job_cancelled");
    });
  });

  describe("subscribeToJob", () => {
    it("returns null for nonexistent job", () => {
      expect(subscribeToJob("nonexistent")).toBeNull();
    });

    it("returns a ReadableStream for existing job", () => {
      const job = createJob("test");
      const stream = subscribeToJob(job.id);
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it("replays existing events in the stream", async () => {
      const job = createJob("test");
      emitJobEvent(job.id, {
        type: "event_1",
        data: { val: 1 },
        timestamp: Date.now(),
      });
      completeJob(job.id, "done");

      const stream = subscribeToJob(job.id)!;
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const text = chunks.join("");
      expect(text).toContain("event_1");
      expect(text).toContain("job_complete");
    });
  });

  describe("cleanupJobs", () => {
    it("removes old jobs", () => {
      const job = createJob("old");
      // Manually set updatedAt to the past
      const j = getJob(job.id)!;
      j.status = "completed";
      j.updatedAt = Date.now() - 7200000; // 2 hours ago

      cleanupJobs(3600000); // 1 hour max age
      expect(getJob(job.id)).toBeUndefined();
    });

    it("keeps recent jobs", () => {
      const job = createJob("recent");
      cleanupJobs(3600000);
      expect(getJob(job.id)).toBeDefined();
    });

    it("does not remove running jobs even if old", () => {
      const job = createJob("running-old");
      startJob(job.id);
      const j = getJob(job.id)!;
      j.updatedAt = Date.now() - 7200000;

      cleanupJobs(3600000);
      expect(getJob(job.id)).toBeDefined();
      expect(getJob(job.id)!.status).toBe("running");
    });

    it("does not remove pending jobs even if old", () => {
      const job = createJob("pending-old");
      const j = getJob(job.id)!;
      j.updatedAt = Date.now() - 7200000;

      cleanupJobs(3600000);
      expect(getJob(job.id)).toBeDefined();
      expect(getJob(job.id)!.status).toBe("pending");
    });

    it("removes old failed jobs", () => {
      const job = createJob("failed-old");
      startJob(job.id);
      failJob(job.id, "boom");
      const j = getJob(job.id)!;
      j.updatedAt = Date.now() - 7200000;

      cleanupJobs(3600000);
      expect(getJob(job.id)).toBeUndefined();
    });

    it("removes old cancelled jobs", () => {
      const job = createJob("cancelled-old");
      startJob(job.id);
      cancelJob(job.id);
      const j = getJob(job.id)!;
      j.updatedAt = Date.now() - 7200000;

      cleanupJobs(3600000);
      expect(getJob(job.id)).toBeUndefined();
    });
  });

  describe("completeJob — cancelled guard", () => {
    it("does not overwrite cancelled status", () => {
      const job = createJob("test");
      startJob(job.id);
      cancelJob(job.id);
      completeJob(job.id, "late-result");

      expect(getJob(job.id)!.status).toBe("cancelled");
      expect(getJob(job.id)!.result).toBeUndefined();
    });
  });

  describe("failJob — cancelled guard", () => {
    it("does not overwrite cancelled status", () => {
      const job = createJob("test");
      startJob(job.id);
      cancelJob(job.id);
      failJob(job.id, "late-error");

      expect(getJob(job.id)!.status).toBe("cancelled");
    });
  });

  describe("cancelJob — edge cases", () => {
    it("does not cancel already failed job", () => {
      const job = createJob("test");
      startJob(job.id);
      failJob(job.id, "error");
      cancelJob(job.id);

      expect(getJob(job.id)!.status).toBe("failed");
    });

    it("fires AbortController.abort()", () => {
      const job = createJob("test");
      const signal = job.abortController!.signal;
      expect(signal.aborted).toBe(false);

      cancelJob(job.id);
      expect(signal.aborted).toBe(true);
    });
  });

  describe("subscribeToJob — live streaming", () => {
    it("pushes live events to active subscriber", async () => {
      const job = createJob("test");
      startJob(job.id);

      const stream = subscribeToJob(job.id)!;
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      // Emit events after subscribing
      emitJobEvent(job.id, {
        type: "progress",
        data: { step: 1 },
        timestamp: Date.now(),
      });
      completeJob(job.id, "done");

      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const text = chunks.join("");
      expect(text).toContain("progress");
      expect(text).toContain("job_complete");
    });

    it("closes stream immediately for already failed job", async () => {
      const job = createJob("test");
      failJob(job.id, "error");

      const stream = subscribeToJob(job.id)!;
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const text = chunks.join("");
      expect(text).toContain("job_failed");
    });

    it("closes stream immediately for already cancelled job", async () => {
      const job = createJob("test");
      startJob(job.id);
      cancelJob(job.id);

      const stream = subscribeToJob(job.id)!;
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const text = chunks.join("");
      expect(text).toContain("job_cancelled");
    });

    it("emits SSE-formatted lines with data: prefix", async () => {
      const job = createJob("test");
      emitJobEvent(job.id, {
        type: "test_fmt",
        data: { v: 1 },
        timestamp: Date.now(),
      });
      completeJob(job.id, "done");

      const stream = subscribeToJob(job.id)!;
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const text = chunks.join("");
      // Each SSE event should start with "data: " and end with double newline
      const lines = text.split("\n\n").filter(Boolean);
      for (const line of lines) {
        expect(line.startsWith("data: ")).toBe(true);
        // Should be valid JSON after "data: "
        const json = JSON.parse(line.slice(6));
        expect(json).toHaveProperty("type");
        expect(json).toHaveProperty("timestamp");
      }
    });
  });
});
