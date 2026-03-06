import { describe, it, expect } from "vitest";
import { EloRating, ARENA_PROMPTS, DEFAULT_ARENA_CONFIG } from "../arena.js";

describe("EloRating", () => {
  it("initializes all players with start rating", () => {
    const elo = new EloRating(["A", "B", "C"], 1500, 32);
    expect(elo.getRating("A")).toBe(1500);
    expect(elo.getRating("B")).toBe(1500);
    expect(elo.getRating("C")).toBe(1500);
  });

  it("returns default 1500 for unknown player", () => {
    const elo = new EloRating(["A"], 1500, 32);
    expect(elo.getRating("Unknown")).toBe(1500);
  });

  it("winner gains rating, loser loses rating", () => {
    const elo = new EloRating(["A", "B"], 1500, 32);
    elo.update("A", "B", 1); // A wins

    expect(elo.getRating("A")).toBeGreaterThan(1500);
    expect(elo.getRating("B")).toBeLessThan(1500);
  });

  it("ratings change symmetrically for equal-rated players", () => {
    const elo = new EloRating(["A", "B"], 1500, 32);
    elo.update("A", "B", 1);

    const gainA = elo.getRating("A") - 1500;
    const lossB = 1500 - elo.getRating("B");
    expect(gainA).toBeCloseTo(lossB, 5);
  });

  it("draw does not change equal ratings", () => {
    const elo = new EloRating(["A", "B"], 1500, 32);
    elo.update("A", "B", 0.5); // draw

    // Both should stay at 1500 since expected outcome = actual outcome
    expect(elo.getRating("A")).toBeCloseTo(1500, 5);
    expect(elo.getRating("B")).toBeCloseTo(1500, 5);
  });

  it("upset victory gives bigger rating swing", () => {
    const elo = new EloRating(["Strong", "Weak"], 1500, 32);
    // Make Strong much higher rated
    for (let i = 0; i < 10; i++) {
      elo.update("Strong", "Weak", 1);
    }

    const strongBefore = elo.getRating("Strong");
    const weakBefore = elo.getRating("Weak");

    // Now Weak wins an upset
    elo.update("Weak", "Strong", 1);

    const weakGain = elo.getRating("Weak") - weakBefore;
    // Upset victory should give a bigger gain (closer to K)
    expect(weakGain).toBeGreaterThan(16); // more than K/2 since it's an upset
  });

  it("K-factor controls magnitude of change", () => {
    const eloSmallK = new EloRating(["A", "B"], 1500, 16);
    const eloBigK = new EloRating(["A", "B"], 1500, 64);

    eloSmallK.update("A", "B", 1);
    eloBigK.update("A", "B", 1);

    const changeSmall = Math.abs(eloSmallK.getRating("A") - 1500);
    const changeBig = Math.abs(eloBigK.getRating("A") - 1500);

    expect(changeBig).toBeGreaterThan(changeSmall);
  });

  it("getAll returns all ratings", () => {
    const elo = new EloRating(["X", "Y", "Z"], 1500, 32);
    elo.update("X", "Y", 1);
    const all = elo.getAll();
    expect(all.size).toBe(3);
    expect(all.has("X")).toBe(true);
    expect(all.has("Y")).toBe(true);
    expect(all.has("Z")).toBe(true);
  });

  it("multiple rounds converge to reflect skill", () => {
    const elo = new EloRating(["Best", "Mid", "Worst"], 1500, 32);

    // Best always beats Mid, Mid always beats Worst
    for (let i = 0; i < 20; i++) {
      elo.update("Best", "Mid", 1);
      elo.update("Mid", "Worst", 1);
      elo.update("Best", "Worst", 1);
    }

    expect(elo.getRating("Best")).toBeGreaterThan(elo.getRating("Mid"));
    expect(elo.getRating("Mid")).toBeGreaterThan(elo.getRating("Worst"));
  });

  it("total rating is conserved (zero-sum)", () => {
    const elo = new EloRating(["A", "B"], 1500, 32);
    const totalBefore = elo.getRating("A") + elo.getRating("B");

    elo.update("A", "B", 1);
    const totalAfter = elo.getRating("A") + elo.getRating("B");

    expect(totalAfter).toBeCloseTo(totalBefore, 5);
  });
});

describe("ARENA_PROMPTS", () => {
  it("has at least 3 prompts", () => {
    expect(ARENA_PROMPTS.length).toBeGreaterThanOrEqual(3);
  });

  it("all prompts are non-empty strings", () => {
    for (const prompt of ARENA_PROMPTS) {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(20);
    }
  });

  it("all prompts mention PineScript", () => {
    for (const prompt of ARENA_PROMPTS) {
      expect(prompt.toLowerCase()).toContain("pinescript");
    }
  });
});

describe("DEFAULT_ARENA_CONFIG", () => {
  it("has reasonable defaults", () => {
    expect(DEFAULT_ARENA_CONFIG.rounds).toBeGreaterThan(0);
    expect(DEFAULT_ARENA_CONFIG.initialCapital).toBeGreaterThan(0);
    expect(DEFAULT_ARENA_CONFIG.eloK).toBeGreaterThan(0);
    expect(DEFAULT_ARENA_CONFIG.eloStart).toBeGreaterThan(0);
    expect(DEFAULT_ARENA_CONFIG.models.length).toBeGreaterThan(0);
  });
});
