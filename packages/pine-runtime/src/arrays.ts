export type PineArrayType = "float" | "int" | "bool";

export interface PineArray {
  type: PineArrayType;
  data: number[];
}

const MAX_ARRAY_SIZE = 1000;

export function createPineArray(
  type: PineArrayType,
  size: number,
  initialValue: number = 0,
): PineArray {
  if (size < 0)
    throw new RangeError(`Array size must be non-negative, got ${size}`);
  if (size > MAX_ARRAY_SIZE)
    throw new RangeError(`Array size exceeds limit of ${MAX_ARRAY_SIZE}`);
  return { type, data: new Array(size).fill(initialValue) };
}

export function arrayGet(arr: PineArray, index: number): number {
  if (index < 0 || index >= arr.data.length) {
    throw new RangeError(
      `Array index ${index} out of bounds (size=${arr.data.length})`,
    );
  }
  return arr.data[index];
}

export function arraySet(arr: PineArray, index: number, value: number): void {
  if (index < 0 || index >= arr.data.length) {
    throw new RangeError(
      `Array index ${index} out of bounds (size=${arr.data.length})`,
    );
  }
  arr.data[index] = value;
}

export function arrayPush(arr: PineArray, value: number): void {
  if (arr.data.length >= MAX_ARRAY_SIZE) {
    throw new RangeError(`Array push would exceed limit of ${MAX_ARRAY_SIZE}`);
  }
  arr.data.push(value);
}

export function arrayPop(arr: PineArray): number {
  if (arr.data.length === 0)
    throw new RangeError("Cannot pop from empty array");
  return arr.data.pop()!;
}

export function arraySize(arr: PineArray): number {
  return arr.data.length;
}

export function arrayShift(arr: PineArray): number {
  if (arr.data.length === 0)
    throw new RangeError("Cannot shift from empty array");
  return arr.data.shift()!;
}

export function arrayUnshift(arr: PineArray, value: number): void {
  if (arr.data.length >= MAX_ARRAY_SIZE) {
    throw new RangeError(
      `Array unshift would exceed limit of ${MAX_ARRAY_SIZE}`,
    );
  }
  arr.data.unshift(value);
}

export function arrayClear(arr: PineArray): void {
  arr.data.length = 0;
}

export function arraySum(arr: PineArray): number {
  return arr.data.reduce((s, v) => s + v, 0);
}

export function arrayAvg(arr: PineArray): number {
  if (arr.data.length === 0) return NaN;
  return arraySum(arr) / arr.data.length;
}

export function arrayMax(arr: PineArray): number {
  if (arr.data.length === 0) return NaN;
  return Math.max(...arr.data);
}

export function arrayMin(arr: PineArray): number {
  if (arr.data.length === 0) return NaN;
  return Math.min(...arr.data);
}
