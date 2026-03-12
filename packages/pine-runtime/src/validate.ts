import { Indicator, PineTS } from "pinets";
import { preprocessV2 } from "./v2-preprocessor.js";
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "./types.js";

export function validateScript(script: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!script.includes("@version")) {
    warnings.push({
      line: 0,
      message: "Script should include //@version directive",
    });
  }

  if (script.includes("strategy(") && !script.includes("strategy.entry")) {
    warnings.push({
      line: 0,
      message: "Strategy declared but no entry rules found",
    });
  }

  try {
    const preprocessed = preprocessV2(script);
    const mockData = [
      {
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        volume: 1000,
        openTime: 1704067200000,
        closeTime: 1704070800000,
      },
    ];
    // Construct PineTS and Indicator to trigger transpilation-time errors.
    // ready() is a no-op for static array sources (data already loaded).
    const pinets = new PineTS(mockData);
    // Constructing Indicator triggers script parsing/transpilation
    new Indicator(preprocessed);

    return { valid: true, errors, warnings };
  } catch (e: any) {
    errors.push({
      line: 0,
      column: 0,
      message: e.message || "Unknown transpilation error",
    });

    return { valid: false, errors, warnings };
  }
}
