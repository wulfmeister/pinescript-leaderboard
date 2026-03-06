import { describe, it, expect } from "vitest";

interface Trade {
  timestamp: number;
  action: string;
  price: number;
  pnl?: number;
  direction?: string;
  quantity?: number;
  symbol?: string;
}

interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

function buildMonthBuckets(trades: Trade[]) {
  const closed = trades.filter((t) => t.pnl !== undefined);
  if (closed.length === 0) return [];
  const buckets = new Map<
    string,
    { label: string; pnl: number; wins: number; losses: number; trades: number }
  >();
  closed.forEach((t) => {
    const d = new Date(t.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
    if (!buckets.has(key))
      buckets.set(key, { label, pnl: 0, wins: 0, losses: 0, trades: 0 });
    const b = buckets.get(key)!;
    b.pnl += t.pnl ?? 0;
    b.trades += 1;
    if ((t.pnl ?? 0) >= 0) b.wins += 1;
    else b.losses += 1;
  });
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function nearestIndex(curve: EquityPoint[], ts: number): number {
  let best = 0;
  let bestDiff = Math.abs(curve[0].timestamp - ts);
  for (let i = 1; i < curve.length; i++) {
    const diff = Math.abs(curve[i].timestamp - ts);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function toCSV(trades: Trade[]): string {
  const header = "date,direction,action,price,quantity,symbol,pnl";
  const rows = trades
    .filter((t) => t.pnl !== undefined)
    .map((t) =>
      [
        new Date(t.timestamp).toISOString(),
        t.direction ?? "",
        t.action,
        t.price.toFixed(4),
        t.quantity ?? "",
        t.symbol ?? "",
        (t.pnl ?? 0).toFixed(4),
      ].join(","),
    );
  return [header, ...rows].join("\n");
}

describe("Monthly PnL aggregation", () => {
  it("groups trades by calendar month", () => {
    const jan10 = new Date(2024, 0, 10).getTime();
    const jan20 = new Date(2024, 0, 20).getTime();
    const feb5  = new Date(2024, 1, 5).getTime();
    const trades: Trade[] = [
      { timestamp: jan10, action: "close", price: 100, pnl: 50 },
      { timestamp: jan20, action: "close", price: 110, pnl: -20 },
      { timestamp: feb5,  action: "close", price: 120, pnl: 80 },
    ];
    const months = buildMonthBuckets(trades);
    expect(months).toHaveLength(2);
    expect(months[0].label).toContain("Jan");
    expect(months[0].pnl).toBeCloseTo(30);
    expect(months[0].wins).toBe(1);
    expect(months[0].losses).toBe(1);
    expect(months[1].label).toContain("Feb");
    expect(months[1].pnl).toBeCloseTo(80);
  });

  it("returns empty array when no closed trades", () => {
    const trades: Trade[] = [
      { timestamp: Date.now(), action: "entry", price: 100 },
    ];
    expect(buildMonthBuckets(trades)).toHaveLength(0);
  });

  it("handles single month correctly", () => {
    const trades: Trade[] = [
      { timestamp: new Date(2024, 2, 1).getTime(), action: "close", price: 50, pnl: 10 },
      { timestamp: new Date(2024, 2, 15).getTime(), action: "close", price: 55, pnl: 5 },
    ];
    const months = buildMonthBuckets(trades);
    expect(months).toHaveLength(1);
    expect(months[0].trades).toBe(2);
    expect(months[0].wins).toBe(2);
    expect(months[0].losses).toBe(0);
  });
});

describe("CSV export", () => {
  it("includes header row", () => {
    const csv = toCSV([]);
    expect(
      csv.startsWith("date,direction,action,price,quantity,symbol,pnl"),
    ).toBe(true);
  });

  it("only includes closed trades", () => {
    const trades: Trade[] = [
      {
        timestamp: new Date(2024, 0, 1).getTime(),
        action: "entry",
        price: 100,
      },
      {
        timestamp: new Date(2024, 0, 10).getTime(),
        action: "close",
        price: 110,
        pnl: 50,
      },
    ];
    const csv = toCSV(trades);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("close");
  });

  it("formats numeric fields correctly", () => {
    const trades: Trade[] = [
      {
        timestamp: new Date(2024, 0, 1).getTime(),
        action: "close",
        price: 123.456789,
        pnl: 12.34,
        direction: "long",
        quantity: 10,
        symbol: "AAPL",
      },
    ];
    const csv = toCSV(trades);
    const row = csv.split("\n")[1];
    expect(row).toContain("123.4568");
    expect(row).toContain("12.3400");
    expect(row).toContain("long");
    expect(row).toContain("AAPL");
  });
});

describe("Nearest index for trade markers", () => {
  const curve: EquityPoint[] = [
    { timestamp: 1000, equity: 10000, drawdown: 0 },
    { timestamp: 2000, equity: 10100, drawdown: 0 },
    { timestamp: 3000, equity: 10200, drawdown: 0 },
    { timestamp: 4000, equity: 10300, drawdown: 0 },
  ];

  it("returns exact match index", () => {
    expect(nearestIndex(curve, 2000)).toBe(1);
  });

  it("returns nearest index for midpoint timestamp", () => {
    expect(nearestIndex(curve, 1400)).toBe(0);
    expect(nearestIndex(curve, 1600)).toBe(1);
  });

  it("handles timestamp before start", () => {
    expect(nearestIndex(curve, 0)).toBe(0);
  });

  it("handles timestamp after end", () => {
    expect(nearestIndex(curve, 9999)).toBe(3);
  });
});

describe("Trade table sort logic", () => {
  type SortKey = "timestamp" | "price" | "pnl";
  type SortDir = "asc" | "desc";

  function sortTrades(trades: Trade[], key: SortKey, dir: SortDir): Trade[] {
    return [...trades].sort((a, b) => {
      let av: number, bv: number;
      if (key === "timestamp") {
        av = a.timestamp;
        bv = b.timestamp;
      } else if (key === "price") {
        av = a.price;
        bv = b.price;
      } else {
        av = a.pnl ?? 0;
        bv = b.pnl ?? 0;
      }
      return dir === "asc" ? av - bv : bv - av;
    });
  }

  const trades: Trade[] = [
    { timestamp: 3000, action: "close", price: 110, pnl: 20 },
    { timestamp: 1000, action: "close", price: 90, pnl: -10 },
    { timestamp: 2000, action: "close", price: 100, pnl: 5 },
  ];

  it("sorts by timestamp asc", () => {
    const result = sortTrades(trades, "timestamp", "asc");
    expect(result.map((t) => t.timestamp)).toEqual([1000, 2000, 3000]);
  });

  it("sorts by pnl desc", () => {
    const result = sortTrades(trades, "pnl", "desc");
    expect(result.map((t) => t.pnl)).toEqual([20, 5, -10]);
  });

  it("sorts by price asc", () => {
    const result = sortTrades(trades, "price", "asc");
    expect(result.map((t) => t.price)).toEqual([90, 100, 110]);
  });
});
