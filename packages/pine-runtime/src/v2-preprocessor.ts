const TA_FUNCTIONS = [
  "sma",
  "ema",
  "rsi",
  "macd",
  "bb",
  "atr",
  "stoch",
  "vwap",
  "cci",
  "crossover",
  "crossunder",
  "wpr",
  "ichimoku",
  "adx",
  "obv",
  "roc",
  "mom",
  "supertrend",
] as const;

// Regex: (?<![\w.]) prevents matching `ta.sma` or `fastSMA`;
//        (?=\s*\()  requires a following paren (function call site)
const TA_RE = new RegExp(
  `(?<![\\w.])(?:${TA_FUNCTIONS.join("|")})(?=\\s*\\()`,
  "g",
);

const VERSION_RE = /^\/\/@version=(\d+)/m;

/**
 * Rewrite a v2 PineScript source to v5 syntax.
 *
 * Bare indicator calls (`sma(`, `ema(`, `crossover(`, etc.) become `ta.*`
 * and the version header is set to `@version=5`.
 *
 * Scripts already tagged `@version=5` pass through unchanged.
 */
export function preprocessV2(script: string): string {
  const versionMatch = script.match(VERSION_RE);

  if (versionMatch && versionMatch[1] === "5") {
    return script;
  }

  let result = script.replace(TA_RE, (fn) => `ta.${fn}`);

  if (versionMatch) {
    result = result.replace(VERSION_RE, "//@version=5");
  } else {
    result = `//@version=5\n${result}`;
  }

  return result;
}
