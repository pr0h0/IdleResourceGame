// Defines all item types in the game

export const RESOURCES = {
  // T0 - Raw
  WOOD: "wood",
  STONE: "stone",
  ORE: "ore",
  WHEAT: "wheat",

  // T1 - Refined
  PLANKS: "planks",
  BRICKS: "bricks",
  STEEL: "steel",
  FLOUR: "flour", // Changed from Bread in design to intermediate
  BREAD: "bread",

  // Special
  TECH_POINTS: "tech_points",

  // T3 - Logistics
  SUPPLY_CRATE: "supply_crate",
} as const;

export type ResourceId = (typeof RESOURCES)[keyof typeof RESOURCES];

export const RESOURCE_INFO: Record<
  ResourceId,
  { name: string; tier: number; baseValue: number }
> = {
  [RESOURCES.WOOD]: { name: "Raw Wood", tier: 0, baseValue: 1 },
  [RESOURCES.STONE]: { name: "Rough Stone", tier: 0, baseValue: 1 },
  [RESOURCES.ORE]: { name: "Iron Ore", tier: 0, baseValue: 2 },
  [RESOURCES.WHEAT]: { name: "Wheat Bushel", tier: 0, baseValue: 1 },

  [RESOURCES.PLANKS]: { name: "Plank", tier: 1, baseValue: 5 },
  [RESOURCES.BRICKS]: { name: "Brick", tier: 1, baseValue: 5 },
  [RESOURCES.STEEL]: { name: "Steel Bar", tier: 1, baseValue: 8 },
  [RESOURCES.FLOUR]: { name: "Flour Sack", tier: 1, baseValue: 4 },
  [RESOURCES.BREAD]: { name: "Loaf", tier: 1, baseValue: 10 },

  [RESOURCES.TECH_POINTS]: { name: "Tech Points", tier: 0, baseValue: 0 },

  [RESOURCES.SUPPLY_CRATE]: { name: "Supply Crate", tier: 3, baseValue: 100 },
};
