"use client";

interface Props {
  matrix: number[][];
  symbols: string[];
  isMockData: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function correlationToColor(r: number): string {
  const clamped = Math.max(-1, Math.min(1, r));

  if (clamped <= 0) {
    const t = clamped + 1;
    const red = [239, 68, 68] as const;
    const gray = [55, 65, 81] as const;
    return `rgb(${lerp(red[0], gray[0], t)},${lerp(red[1], gray[1], t)},${lerp(red[2], gray[2], t)})`;
  }

  const t = clamped;
  const gray = [55, 65, 81] as const;
  const green = [34, 197, 94] as const;
  return `rgb(${lerp(gray[0], green[0], t)},${lerp(gray[1], green[1], t)},${lerp(gray[2], green[2], t)})`;
}

export function CorrelationHeatmap({ matrix, symbols, isMockData }: Props) {
  if (!matrix.length || !symbols.length) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        No correlation data
      </div>
    );
  }

  const size = 48;

  return (
    <div className="space-y-3">
      {isMockData && (
        <div className="inline-flex items-center rounded border border-yellow-700 bg-yellow-950/40 px-2 py-1 text-xs text-yellow-300">
          ⚠ Mock data — correlations are random
        </div>
      )}

      <div className="overflow-auto">
        <div style={{ minWidth: symbols.length * size + 120 }}>
          <div className="flex items-end mb-2" style={{ marginLeft: 80 }}>
            {symbols.map((symbol) => (
              <div
                key={`x-${symbol}`}
                className="text-xs text-zinc-400 text-center truncate"
                style={{
                  width: size,
                  transform: "rotate(-30deg)",
                  transformOrigin: "bottom center",
                }}
                title={symbol}
              >
                {symbol}
              </div>
            ))}
          </div>

          {matrix.map((row, rowIndex) => (
            <div
              key={`row-${symbols[rowIndex] ?? rowIndex}`}
              className="flex items-center mb-1"
            >
              <div
                className="w-20 pr-2 text-right text-xs text-zinc-400 truncate"
                title={symbols[rowIndex]}
              >
                {symbols[rowIndex]}
              </div>
              <div className="flex gap-1">
                {row.map((value, colIndex) => (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className="flex items-center justify-center rounded text-xs text-white"
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: correlationToColor(value),
                    }}
                    title={`${symbols[rowIndex]} / ${symbols[colIndex]}: ${value.toFixed(2)}`}
                  >
                    {value.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
