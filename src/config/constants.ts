// Grid Settings
export const TILE_SIZE = 64;
export const DEFAULT_GRID_WIDTH = 10;
export const DEFAULT_GRID_HEIGHT = 10;

// Zone IDs
export const ZONES = {
  CITY: "city",
  FOREST: "forest",
  MOUNTAIN: "mountain",
  FARM: "farm",
} as const;

export type ZoneId = (typeof ZONES)[keyof typeof ZONES];

export const NATURAL = {
  TREE: "tree",
  ROCK: "rock",
  RIVER: "river",
} as const;

// Colors for debugging/placeholder sprites
export const ZONE_COLORS = {
  [ZONES.CITY]: 0x555555, // Grey
  [ZONES.FOREST]: 0x228822, // Green
  [ZONES.MOUNTAIN]: 0x884422, // Brown
  [ZONES.FARM]: 0xddaa22, // Wheat Gold
};
