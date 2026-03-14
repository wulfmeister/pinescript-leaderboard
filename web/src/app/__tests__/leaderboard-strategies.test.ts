import { LEADERBOARD_STRATEGIES, LEADERBOARD_CONFIG } from "../leaderboard-strategies";

describe("LEADERBOARD_STRATEGIES", () => {
  it("defines exactly 5 strategies", () => {
    expect(LEADERBOARD_STRATEGIES).toHaveLength(5);
  });

  it("all strategies have non-empty name and script", () => {
    for (const s of LEADERBOARD_STRATEGIES) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.script.length).toBeGreaterThan(0);
    }
  });

  it("each script contains strategy( and //@version=5", () => {
    for (const s of LEADERBOARD_STRATEGIES) {
      expect(s.script).toContain("strategy(");
      expect(s.script).toContain("//@version=5");
    }
  });

  it("all names are unique", () => {
    const names = LEADERBOARD_STRATEGIES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("LEADERBOARD_CONFIG", () => {
  it("has expected defaults", () => {
    expect(LEADERBOARD_CONFIG.asset).toBe("BTC-USD");
    expect(LEADERBOARD_CONFIG.capital).toBe(10000);
    expect(LEADERBOARD_CONFIG.timeframe).toBe("5m");
    expect(LEADERBOARD_CONFIG.mock).toBe(false);
  });
});
