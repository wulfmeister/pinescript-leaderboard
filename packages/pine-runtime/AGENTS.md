# pine-runtime

PineScript execution pipeline: script → preprocess → transpile → execute → signals.

## Structure

```
src/
├── pinets-adapter.ts    # Main adapter class (PineTSAdapter). Entry point for all execution.
├── v2-preprocessor.ts   # Rewrites v2 PineScript to v5 syntax (bare calls → ta.* prefix).
├── strategy-namespace.ts # Injects strategy() namespace with entry/close/exit methods.
├── ohlcv-adapter.ts     # Converts OHLCV[] to PineTS Candle format.
├── param-mapper.ts      # Extracts input() params from scripts, maps override values.
├── transpile-cache.ts   # Global singleton cache for transpiled PineTS output.
├── validate.ts          # Script validation: version tag, entry rules, warnings.
├── types.ts             # IPineRuntime interface, ValidationResult, StrategyParameter.
├── arrays.ts            # PineScript array built-in compatibility layer.
└── index.ts             # Re-exports: PineTSAdapter (aliased as SimplePineRuntime), pineRuntime singleton.
```

## Execution flow

1. `PineTSAdapter.executeStrategy(script, data, capital, overrides?)` is the sole entry.
2. `preprocessV2(script)` — detects `@version=2` scripts, rewrites bare indicator calls (`sma(` → `ta.sma(`), bumps to v5.
3. `extractParams(script)` + `mapOverrides(params, overrides)` — extracts `input()` declarations, maps user overrides.
4. `transpileCache.getOrTranspile(script, fn)` — caches PineTS transpilation output by script hash.
5. PineTS `Indicator` runs bar-by-bar over candles with injected `StrategyNamespace`.
6. `StrategyNamespace` collects `entry()`/`close()`/`exit()` calls into `Signal[]`.

## Key patterns

- **Transpile caching**: Global singleton (`getGlobalTranspileCache()`). Cache key is the preprocessed script string. Avoids re-transpiling identical scripts during optimization sweeps.
- **Strategy namespace injection**: `StrategyNamespace` is a callable object that also exposes `.entry()`, `.close()`, `.exit()`, `.long`, `.short`. Injected as `strategy` into PineTS execution context.
- **v2 compatibility**: Regex-based rewrite (`TA_RE`). Uses negative lookbehind `(?<![\w.])` to avoid matching `ta.sma` or `fastSMA`. Scripts already at `@version=5` pass through unchanged.
- **Validation**: `validateScript()` checks for `@version` tag, `strategy()` call, entry rules. Returns `{ valid, errors, warnings }`.

## Gotchas

- The `pineRuntime` singleton is the standard import for consumers. `SimplePineRuntime` is just an alias for `PineTSAdapter`.
- Imports use `.js` extensions for ESM compatibility (e.g., `from "./types.js"`).
- `initialCapital` parameter in `executeStrategy` is currently unused (`void initialCapital`) — capital management happens in the backtester.
- PineTS is the external dependency (`pinets` package). Script must be valid PineScript v5 after preprocessing.
- The `param` method on strategy namespace (`strategy.param()`) allows runtime parameter access from within scripts.
