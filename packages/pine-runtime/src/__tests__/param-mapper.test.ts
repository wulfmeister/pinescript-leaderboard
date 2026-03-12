import { describe, it, expect } from "vitest";
import { extractParams, mapOverrides, clampToConstraints } from "../param-mapper.js";

describe("extractParams", () => {
  it("extracts simple input() declarations", () => {
    const script = `fastLength = input(10, title="Fast Length")
slowLength = input(30, title="Slow Length")`;
    const params = extractParams(script);
    expect(params).toHaveLength(2);
    expect(params[0]).toEqual({
      name: "fastLength",
      defaultValue: 10,
      title: "Fast Length",
    });
    expect(params[1]).toEqual({
      name: "slowLength",
      defaultValue: 30,
      title: "Slow Length",
    });
  });

  it("extracts input.int() and input.float() declarations", () => {
    const script = `period = input.int(14, title="Period")
threshold = input.float(0.5, title="Threshold")`;
    const params = extractParams(script);
    expect(params).toHaveLength(2);
    expect(params[0]).toMatchObject({ name: "period", defaultValue: 14 });
    expect(params[1]).toMatchObject({ name: "threshold", defaultValue: 0.5 });
  });

  it("extracts minval, maxval, and step", () => {
    const script = `length = input(14, title="Length", minval=1, maxval=200, step=1)`;
    const params = extractParams(script);
    expect(params[0]).toEqual({
      name: "length",
      defaultValue: 14,
      title: "Length",
      minval: 1,
      maxval: 200,
      step: 1,
    });
  });

  it("handles inputs without title", () => {
    const script = `length = input(14)`;
    const params = extractParams(script);
    expect(params[0]).toEqual({ name: "length", defaultValue: 14 });
    expect(params[0].title).toBeUndefined();
  });

  it("handles negative default values", () => {
    const script = `offset = input(-5, title="Offset")`;
    const params = extractParams(script);
    expect(params[0].defaultValue).toBe(-5);
  });

  it("skips comments and blank lines", () => {
    const script = `// this is a comment
fastLength = input(10, title="Fast Length")

// another comment
slowLength = input(30, title="Slow Length")`;
    const params = extractParams(script);
    expect(params).toHaveLength(2);
  });

  it("skips lines without input declarations", () => {
    const script = `strategy("Test", overlay=true)
fastLength = input(10, title="Fast Length")
fast = ta.sma(close, fastLength)`;
    const params = extractParams(script);
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe("fastLength");
  });

  it("returns empty array for scripts with no inputs", () => {
    const script = `strategy("Test", overlay=true)
fast = ta.sma(close, 10)`;
    expect(extractParams(script)).toEqual([]);
  });

  it("handles float default values", () => {
    const script = `mult = input(2.5, title="Multiplier")`;
    const params = extractParams(script);
    expect(params[0].defaultValue).toBe(2.5);
  });
});

describe("mapOverrides", () => {
  it("maps overrides using title when available", () => {
    const params = [
      { name: "fastLength", defaultValue: 10, title: "Fast Length" },
      { name: "slowLength", defaultValue: 30, title: "Slow Length" },
    ];
    const overrides = { fastLength: 5, slowLength: 50 };
    const mapped = mapOverrides(params, overrides);
    expect(mapped).toEqual({
      "Fast Length": 5,
      "Slow Length": 50,
    });
  });

  it("falls back to variable name when no title exists", () => {
    const params = [{ name: "length", defaultValue: 14 }];
    const overrides = { length: 20 };
    const mapped = mapOverrides(params, overrides);
    expect(mapped).toEqual({ length: 20 });
  });

  it("ignores overrides for non-existent params", () => {
    const params = [{ name: "length", defaultValue: 14, title: "Length" }];
    const overrides = { length: 20, unknown: 99 };
    const mapped = mapOverrides(params, overrides);
    expect(mapped).toEqual({ Length: 20 });
    expect(mapped).not.toHaveProperty("unknown");
  });

  it("returns empty object when no overrides match", () => {
    const params = [{ name: "length", defaultValue: 14 }];
    const overrides = { other: 5 };
    expect(mapOverrides(params, overrides)).toEqual({});
  });

  it("returns empty object for empty params", () => {
    expect(mapOverrides([], { length: 5 })).toEqual({});
  });

  it("clamps overrides to minval", () => {
    const params = [{ name: "length", defaultValue: 14, title: "Length", minval: 5 }];
    const mapped = mapOverrides(params, { length: 2 });
    expect(mapped).toEqual({ Length: 5 });
  });

  it("clamps overrides to maxval", () => {
    const params = [{ name: "length", defaultValue: 14, title: "Length", maxval: 100 }];
    const mapped = mapOverrides(params, { length: 200 });
    expect(mapped).toEqual({ Length: 100 });
  });

  it("snaps overrides to step", () => {
    const params = [{ name: "length", defaultValue: 10, title: "Length", minval: 0, step: 5 }];
    const mapped = mapOverrides(params, { length: 12 });
    // 12 snaps to nearest step of 5 from 0 → 10
    expect(mapped).toEqual({ Length: 10 });
  });

  it("passes through values within bounds", () => {
    const params = [{ name: "length", defaultValue: 14, title: "Length", minval: 1, maxval: 200 }];
    const mapped = mapOverrides(params, { length: 50 });
    expect(mapped).toEqual({ Length: 50 });
  });
});

describe("clampToConstraints", () => {
  it("returns value unchanged when no constraints", () => {
    expect(clampToConstraints(42, { name: "x", defaultValue: 10 })).toBe(42);
  });

  it("clamps below minval", () => {
    expect(clampToConstraints(-5, { name: "x", defaultValue: 10, minval: 0 })).toBe(0);
  });

  it("clamps above maxval", () => {
    expect(clampToConstraints(300, { name: "x", defaultValue: 10, maxval: 200 })).toBe(200);
  });

  it("snaps to nearest step from minval", () => {
    const param = { name: "x", defaultValue: 10, minval: 2, step: 5 };
    // Steps from 2: 2, 7, 12, 17, ...
    expect(clampToConstraints(9, param)).toBe(7);
    expect(clampToConstraints(10, param)).toBe(12);
    expect(clampToConstraints(14, param)).toBe(12);
  });

  it("snaps to step from 0 when no minval", () => {
    const param = { name: "x", defaultValue: 10, step: 3 };
    expect(clampToConstraints(7, param)).toBe(6);
    expect(clampToConstraints(8, param)).toBe(9);
  });

  it("clamps and then snaps to nearest valid step", () => {
    const param = { name: "x", defaultValue: 5, minval: 1, maxval: 10, step: 4 };
    // Steps from 1: 1, 5, 9, 13...
    // 12 → clamped to 10 → step snap: 1 + round((10-1)/4)*4 = 1+8 = 9
    expect(clampToConstraints(12, param)).toBe(9);
    // 3 → within bounds → step snap: 1 + round((3-1)/4)*4 = 1+4 = 5
    expect(clampToConstraints(3, param)).toBe(5);
    // 4 → within bounds → step snap: 1 + round((4-1)/4)*4 = 1+4 = 5
    expect(clampToConstraints(4, param)).toBe(5);
  });
});
