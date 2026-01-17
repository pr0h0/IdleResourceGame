import { world } from "../core/ecs";
import { registerTile } from "../core/grid";
import { TILE_SIZE, ZONES, type ZoneId } from "../config/constants";
import { Graphics } from "pixi.js";

// Zone Background Colors
/* const BG_COLORS = {
    [ZONES.CITY]: 0x333333,
    [ZONES.FOREST]: 0x2E4E2E, // Darker green
    [ZONES.MOUNTAIN]: 0x4E3B31, // Darker brown
    [ZONES.FARM]: 0x5D4037
}; */

// Zone Grid/Floor Colors
const TILE_COLORS = {
  [ZONES.CITY]: 0x666666, // Pavement
  [ZONES.FOREST]: 0x4caf50, // Grass
  [ZONES.MOUNTAIN]: 0x8d6e63, // Dirt/Rock
  [ZONES.FARM]: 0xaed581, // Light Grass
};

export function createTile(zoneId: ZoneId, x: number, y: number) {
  const color = TILE_COLORS[zoneId] || 0xffffff;

  // Create Graphics
  const g = new Graphics();

  // Draw centered rect
  // Note: RenderSystem sets x,y to grid position * size.
  // If RenderSystem sets "sprite.x = grid.x * 64", then sprite 0,0 is at grid 0,0 top-left.
  // The previous code had `rect(-TILE_SIZE/2 ...)` and position centered?
  // Let's stick to standard top-left pivot for simplicity in my mental model,
  // but the existing code used centered.
  // Wait, previous code: position: { x: (x * TILE_SIZE) + (TILE_SIZE/2), ... }
  // Render System:
  // if (entity.gridPosition) { entity.sprite.x = entity.gridPosition.x * TILE_SIZE; }
  // There is a conflict here.
  // If RenderSystem overrides x/y with gridPosition * size, then the pivot is top-left of tile.
  // If I draw `rect(0,0, 64, 64)`, it fills the tile.

  g.rect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fill(color);

  // Add texture detail (noise)
  for (let i = 0; i < 5; i++) {
    const dotX = Math.random() * TILE_SIZE;
    const dotY = Math.random() * TILE_SIZE;
    g.circle(dotX, dotY, 2);
    g.fill({ color: 0x000000, alpha: 0.1 });
  }

  // Border
  g.rect(0, 0, TILE_SIZE, TILE_SIZE);
  g.stroke({ width: 1, color: 0x000000, alpha: 0.2 });

  const entity = world.add({
    zoneId,
    gridPosition: { x, y },
    // Position is irrelevant if RenderSystem overwrites it, but good for initial
    position: { x: x * TILE_SIZE, y: y * TILE_SIZE },
    sprite: g as any,
  });

  registerTile(entity);
  return entity;
}
