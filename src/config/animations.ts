import { NATURAL } from "./constants";

export interface SpriteSheetConfig {
  path: string;
  frames: number;
  width: number;
  height: number;
}

// Define spritesheet configs
export const RESOURCE_SPRITESHEETS: Record<string, SpriteSheetConfig> = {
  [NATURAL.TREE]: {
    path: "/sprites/tree_spritesheet.png",
    frames: 16,
    width: 64, // TILE_SIZE
    height: 64, // TILE_SIZE
  },
};

// Deprecated: Individual frames
export const RESOURCE_ANIMATIONS: Record<string, string[]> = {};
