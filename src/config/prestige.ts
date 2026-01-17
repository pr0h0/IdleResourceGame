export interface PrestigeUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number; // Base cost
  costScale: "static" | "linear"; // simple scaling flag
  maxLevel?: number; // Infinite if undefined
}

export const PRESTIGE_UPGRADES: Record<string, PrestigeUpgrade> = {
  starter_pack: {
    id: "starter_pack",
    name: "Inheritance",
    description: "Start with scaled credits (500, 1500, 3500...).",
    cost: 1,
    costScale: "linear",
    maxLevel: 10,
  },
  production_boost: {
    id: "production_boost",
    name: "Golden Age",
    description: "All production +25% per level.",
    cost: 5,
    costScale: "linear",
  },
  tech_savvy: {
    id: "tech_savvy",
    name: "Ancient Knowledge",
    description: "Start with +10 Tech Points per level.",
    cost: 2,
    costScale: "linear",
    maxLevel: 10,
  },
  resource_preservation: {
    id: "resource_preservation",
    name: "Vault",
    description: "Keep 10% of resources on reset per level (Max 50%).",
    cost: 5,
    costScale: "linear",
    maxLevel: 5,
  },
  nature_abundance: {
    id: "nature_abundance",
    name: "Druidic Rites",
    description:
      "Increase natural resource cap (Trees/Stones) by +2 per level.",
    cost: 3,
    costScale: "linear",
    maxLevel: 10,
  },
  land_expansion: {
    id: "land_expansion",
    name: "Manifest Destiny",
    description: "Increase Grid Size by +1 per level (Max 20x20).",
    cost: 5,
    costScale: "linear", // Start at 5, then 6, 7? Or 5, 10, 15? Linear additive usually means Base + Lvl.
    maxLevel: 10, // Start 10x10 -> +10 -> 20x20
  },
};
