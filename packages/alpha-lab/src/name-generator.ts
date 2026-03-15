/**
 * Random name generator for strategies and factors.
 *
 * Generates memorable two-word names (adjective + noun) for
 * identification. In Genetic Evolver mode, child strategies
 * inherit part of their parent's name to show lineage.
 */

const ADJECTIVES = [
  "swift",
  "bold",
  "calm",
  "dark",
  "keen",
  "wild",
  "iron",
  "cold",
  "warm",
  "deep",
  "fast",
  "rare",
  "wise",
  "pure",
  "firm",
  "true",
  "high",
  "low",
  "vast",
  "lean",
  "raw",
  "late",
  "thin",
  "flat",
  "hard",
  "soft",
  "blue",
  "red",
  "pale",
  "grim",
  "dual",
  "solo",
  "half",
  "full",
  "old",
  "new",
  "dry",
  "hot",
  "icy",
  "dim",
  "sly",
  "odd",
  "shy",
];

const NOUNS = [
  "hawk",
  "wolf",
  "bear",
  "bull",
  "lynx",
  "viper",
  "eagle",
  "pike",
  "reef",
  "tide",
  "wave",
  "storm",
  "ridge",
  "peak",
  "vale",
  "mesa",
  "dune",
  "crest",
  "grove",
  "flame",
  "frost",
  "spark",
  "pulse",
  "drift",
  "edge",
  "blade",
  "shard",
  "prism",
  "forge",
  "anvil",
  "coil",
  "wedge",
  "flare",
  "orbit",
  "quasar",
  "nexus",
  "vault",
  "helm",
  "axis",
  "spire",
  "arc",
  "node",
];

/** Pick a random element from an array. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a fresh two-word name like "swift-hawk".
 */
export function generateName(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
}

/**
 * Generate a child name that carries part of its parent's name.
 * Takes the noun from the parent and pairs it with a new adjective.
 *
 * Example: parent "swift-hawk" → child "bold-hawk"
 */
export function generateChildName(parentName: string): string {
  const parts = parentName.split("-");
  const parentNoun = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const adj = pick(ADJECTIVES);
  // Avoid producing the same name as the parent
  if (adj === parts[0]) {
    return `${pick(ADJECTIVES.filter((a) => a !== adj))}-${parentNoun}`;
  }
  return `${adj}-${parentNoun}`;
}

/**
 * Generate a crossover name by combining nouns from two parents.
 *
 * Example: parent1 "swift-hawk", parent2 "bold-wolf" → "keen-hawkwolf"
 */
export function generateCrossoverName(
  parent1Name: string,
  parent2Name: string,
): string {
  const noun1 = parent1Name.split("-").pop() ?? "alpha";
  const noun2 = parent2Name.split("-").pop() ?? "beta";
  // Take first 3 chars of each noun to keep it short
  const combined = noun1.slice(0, 3) + noun2.slice(0, 3);
  return `${pick(ADJECTIVES)}-${combined}`;
}

/**
 * Generate a factor name with its category prefix.
 *
 * Example: category "momentum" → "momentum-swift-hawk"
 */
export function generateFactorName(category: string): string {
  return `${category}-${pick(ADJECTIVES)}-${pick(NOUNS)}`;
}
