import type { StrategyParameter } from "./types.js";

const INPUT_RE = /^\s*(\w+)\s*=\s*input(?:\.int|\.float)?\s*\(\s*(-?[\d.]+)/;
const TITLE_RE = /title\s*=\s*"([^"]+)"/;
const MINVAL_RE = /minval\s*=\s*(-?[\d.]+)/;
const MAXVAL_RE = /maxval\s*=\s*(-?[\d.]+)/;
const STEP_RE = /step\s*=\s*(-?[\d.]+)/;

/**
 * Parse `input()`, `input.int()`, `input.float()` declarations from PineScript.
 * Extracts: name, defaultValue, title, minval, maxval, step.
 */
export function extractParams(script: string): StrategyParameter[] {
  const params: StrategyParameter[] = [];

  for (const line of script.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed === "") continue;

    const inputMatch = trimmed.match(INPUT_RE);
    if (!inputMatch) continue;

    const param: StrategyParameter = {
      name: inputMatch[1],
      defaultValue: Number(inputMatch[2]),
    };

    const titleMatch = trimmed.match(TITLE_RE);
    if (titleMatch) param.title = titleMatch[1];

    const minMatch = trimmed.match(MINVAL_RE);
    if (minMatch) param.minval = Number(minMatch[1]);

    const maxMatch = trimmed.match(MAXVAL_RE);
    if (maxMatch) param.maxval = Number(maxMatch[1]);

    const stepMatch = trimmed.match(STEP_RE);
    if (stepMatch) param.step = Number(stepMatch[1]);

    params.push(param);
  }

  return params;
}

/**
 * Clamp a value to the parameter's declared minval/maxval bounds.
 * If step is defined, snaps to nearest valid step from minval (or 0).
 */
export function clampToConstraints(
  value: number,
  param: StrategyParameter,
): number {
  let clamped = value;
  if (param.minval !== undefined && clamped < param.minval) {
    clamped = param.minval;
  }
  if (param.maxval !== undefined && clamped > param.maxval) {
    clamped = param.maxval;
  }
  if (param.step !== undefined && param.step > 0) {
    const base = param.minval ?? 0;
    clamped = base + Math.round((clamped - base) / param.step) * param.step;
    // Re-clamp after step snapping to avoid floating point drift past bounds
    if (param.minval !== undefined && clamped < param.minval) {
      clamped = param.minval;
    }
    if (param.maxval !== undefined && clamped > param.maxval) {
      clamped = param.maxval;
    }
  }
  return clamped;
}

/**
 * Translate optimizer overrides (keyed by variable name like `fastLength`)
 * to PineTS overrides (keyed by title like `"Fast Length"`).
 * Falls back to variable name when no title exists.
 * Clamps values to declared minval/maxval/step constraints.
 */
export function mapOverrides(
  params: StrategyParameter[],
  overrides: Record<string, number>,
): Record<string, number> {
  const mapped: Record<string, number> = {};

  for (const param of params) {
    if (!(param.name in overrides)) continue;
    const resolvedKey = param.title ?? param.name;
    mapped[resolvedKey] = clampToConstraints(overrides[param.name], param);
  }

  return mapped;
}
