import { describe, it, expect } from "vitest";
import {
  generateName,
  generateChildName,
  generateCrossoverName,
  generateFactorName,
} from "../name-generator.js";

describe("generateName", () => {
  it("returns a hyphenated two-word name", () => {
    const name = generateName();
    expect(name).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it("generates different names on successive calls (probabilistic)", () => {
    const names = new Set<string>();
    for (let i = 0; i < 20; i++) {
      names.add(generateName());
    }
    // With 43 adjectives * 43 nouns = 1849 possibilities,
    // 20 calls should produce at least 5 unique names
    expect(names.size).toBeGreaterThanOrEqual(5);
  });
});

describe("generateChildName", () => {
  it("preserves the parent's noun", () => {
    const child = generateChildName("swift-hawk");
    expect(child).toMatch(/-hawk$/);
  });

  it("returns a valid hyphenated name", () => {
    const child = generateChildName("bold-wolf");
    expect(child).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it("handles single-word parent name", () => {
    const child = generateChildName("hawk");
    expect(child).toMatch(/-hawk$/);
  });

  it("handles multi-hyphen parent name by using last segment", () => {
    const child = generateChildName("momentum-swift-hawk");
    expect(child).toMatch(/-hawk$/);
  });
});

describe("generateCrossoverName", () => {
  it("combines parts of both parent nouns", () => {
    const name = generateCrossoverName("swift-hawk", "bold-wolf");
    // Should contain first 3 chars of "hawk" and first 3 of "wolf"
    expect(name).toContain("haw");
    expect(name).toContain("wol");
  });

  it("returns a valid hyphenated name", () => {
    const name = generateCrossoverName("swift-hawk", "bold-wolf");
    expect(name).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it("handles short nouns gracefully", () => {
    const name = generateCrossoverName("swift-arc", "bold-ax");
    // "arc" → "arc", "ax" → "ax" (shorter than 3 chars)
    expect(name).toContain("arc");
  });
});

describe("generateFactorName", () => {
  it("prefixes with the category", () => {
    const name = generateFactorName("momentum");
    expect(name).toMatch(/^momentum-[a-z]+-[a-z]+$/);
  });

  it("works for all factor categories", () => {
    const categories = [
      "momentum",
      "mean-reversion",
      "trend",
      "volatility",
      "volume",
      "breakout",
    ];
    for (const cat of categories) {
      const name = generateFactorName(cat);
      expect(name.startsWith(cat)).toBe(true);
    }
  });
});
