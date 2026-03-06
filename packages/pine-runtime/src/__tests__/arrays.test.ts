import { describe, it, expect } from "vitest";
import {
  createPineArray,
  arrayGet,
  arraySet,
  arrayPush,
  arrayPop,
  arraySize,
  arrayShift,
  arrayUnshift,
  arrayClear,
  arraySum,
  arrayAvg,
  arrayMax,
  arrayMin,
} from "../arrays.js";

describe("createPineArray", () => {
  it("creates array of given size filled with initial value", () => {
    const arr = createPineArray("float", 5, 1.5);
    expect(arr.data).toHaveLength(5);
    expect(arr.data.every((v) => v === 1.5)).toBe(true);
    expect(arr.type).toBe("float");
  });

  it("defaults initial value to 0", () => {
    const arr = createPineArray("int", 3);
    expect(arr.data).toEqual([0, 0, 0]);
  });

  it("creates empty array with size 0", () => {
    const arr = createPineArray("float", 0);
    expect(arr.data).toHaveLength(0);
  });

  it("throws for negative size", () => {
    expect(() => createPineArray("float", -1)).toThrow(RangeError);
  });

  it("throws for size exceeding limit", () => {
    expect(() => createPineArray("float", 1001)).toThrow(RangeError);
  });
});

describe("arrayGet / arraySet", () => {
  it("gets value at index", () => {
    const arr = createPineArray("float", 3, 0);
    arr.data[1] = 42;
    expect(arrayGet(arr, 1)).toBe(42);
  });

  it("sets value at index", () => {
    const arr = createPineArray("float", 3, 0);
    arraySet(arr, 2, 99);
    expect(arr.data[2]).toBe(99);
  });

  it("throws on out-of-bounds get", () => {
    const arr = createPineArray("float", 3, 0);
    expect(() => arrayGet(arr, 3)).toThrow(RangeError);
    expect(() => arrayGet(arr, -1)).toThrow(RangeError);
  });

  it("throws on out-of-bounds set", () => {
    const arr = createPineArray("float", 3, 0);
    expect(() => arraySet(arr, 5, 1)).toThrow(RangeError);
    expect(() => arraySet(arr, -1, 1)).toThrow(RangeError);
  });
});

describe("arrayPush / arrayPop", () => {
  it("push appends a value", () => {
    const arr = createPineArray("float", 0);
    arrayPush(arr, 7);
    arrayPush(arr, 8);
    expect(arr.data).toEqual([7, 8]);
  });

  it("pop removes and returns the last value", () => {
    const arr = createPineArray("float", 0);
    arrayPush(arr, 10);
    arrayPush(arr, 20);
    expect(arrayPop(arr)).toBe(20);
    expect(arr.data).toEqual([10]);
  });

  it("pop throws on empty array", () => {
    const arr = createPineArray("float", 0);
    expect(() => arrayPop(arr)).toThrow(RangeError);
  });

  it("push throws when size limit exceeded", () => {
    const arr = createPineArray("float", 1000, 0);
    expect(() => arrayPush(arr, 1)).toThrow(RangeError);
  });
});

describe("arrayShift / arrayUnshift", () => {
  it("shift removes and returns first element", () => {
    const arr = createPineArray("float", 0);
    arrayPush(arr, 1);
    arrayPush(arr, 2);
    expect(arrayShift(arr)).toBe(1);
    expect(arr.data).toEqual([2]);
  });

  it("shift throws on empty array", () => {
    const arr = createPineArray("float", 0);
    expect(() => arrayShift(arr)).toThrow(RangeError);
  });

  it("unshift prepends element", () => {
    const arr = createPineArray("float", 0);
    arrayPush(arr, 5);
    arrayUnshift(arr, 3);
    expect(arr.data).toEqual([3, 5]);
  });
});

describe("arraySize", () => {
  it("returns current length", () => {
    const arr = createPineArray("float", 4, 0);
    expect(arraySize(arr)).toBe(4);
    arrayPush(arr, 9);
    expect(arraySize(arr)).toBe(5);
  });
});

describe("arrayClear", () => {
  it("empties the array", () => {
    const arr = createPineArray("float", 5, 1);
    arrayClear(arr);
    expect(arr.data).toHaveLength(0);
  });
});

describe("arraySum / arrayAvg / arrayMax / arrayMin", () => {
  it("sum returns total", () => {
    const arr = createPineArray("float", 0);
    [1, 2, 3, 4].forEach((v) => arrayPush(arr, v));
    expect(arraySum(arr)).toBe(10);
  });

  it("avg returns mean", () => {
    const arr = createPineArray("float", 0);
    [1, 2, 3].forEach((v) => arrayPush(arr, v));
    expect(arrayAvg(arr)).toBeCloseTo(2);
  });

  it("avg returns NaN for empty array", () => {
    expect(arrayAvg(createPineArray("float", 0))).toBeNaN();
  });

  it("max returns largest value", () => {
    const arr = createPineArray("float", 0);
    [3, 1, 4, 1, 5].forEach((v) => arrayPush(arr, v));
    expect(arrayMax(arr)).toBe(5);
  });

  it("min returns smallest value", () => {
    const arr = createPineArray("float", 0);
    [3, 1, 4, 1, 5].forEach((v) => arrayPush(arr, v));
    expect(arrayMin(arr)).toBe(1);
  });

  it("max/min return NaN for empty array", () => {
    const arr = createPineArray("float", 0);
    expect(arrayMax(arr)).toBeNaN();
    expect(arrayMin(arr)).toBeNaN();
  });
});
