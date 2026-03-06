import type { OHLCV, Signal } from "@pinescript-utils/core";

/**
 * Interface for PineScript runtime implementations.
 */
export interface IPineRuntime {
  executeStrategy(
    script: string,
    data: OHLCV[],
    initialCapital: number,
    paramOverrides?: Record<string, number>,
  ): Promise<Signal[]>;

  executeIndicator<T>(script: string, data: OHLCV[]): Promise<T[]>;

  extractParameters(script: string): StrategyParameter[];

  validateScript(script: string): ValidationResult;
}

/**
 * Strategy parameter extracted from input() declarations.
 */
export interface StrategyParameter {
  name: string;
  defaultValue: number;
  title?: string;
  minval?: number;
  maxval?: number;
  step?: number;
}

/**
 * Validation error with line and column information.
 */
export interface ValidationError {
  line: number;
  column?: number;
  message: string;
}

/**
 * Validation warning.
 */
export interface ValidationWarning {
  line: number;
  message: string;
}

/**
 * Result of script validation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
