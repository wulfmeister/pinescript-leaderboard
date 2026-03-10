import { describe, it, expect } from "vitest";
import { toUTCTimestamp } from "../useLightweightChart";

describe("toUTCTimestamp", () => {
  it("converts milliseconds to seconds (floor)", () => {
    expect(toUTCTimestamp(1704067200000)).toBe(1704067200);
  });

  it("floors fractional seconds", () => {
    expect(toUTCTimestamp(1500)).toBe(1);
  });

  it("handles zero", () => {
    expect(toUTCTimestamp(0)).toBe(0);
  });

  it("handles sub-second timestamps", () => {
    expect(toUTCTimestamp(999)).toBe(0);
  });

  it("handles typical equity curve timestamps", () => {
    const jan1_2024 = new Date("2024-01-01T00:00:00Z").getTime();
    const result = toUTCTimestamp(jan1_2024);
    expect(result).toBe(Math.floor(jan1_2024 / 1000));
    expect(typeof result).toBe("number");
  });

  it("handles large timestamps (far future)", () => {
    const year2050 = new Date("2050-01-01T00:00:00Z").getTime();
    expect(toUTCTimestamp(year2050)).toBe(Math.floor(year2050 / 1000));
  });
});
