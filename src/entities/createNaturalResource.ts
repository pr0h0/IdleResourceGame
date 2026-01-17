import { world } from "../core/ecs";
import { Graphics } from "pixi.js";
import { TILE_SIZE, NATURAL, type ZoneId } from "../config/constants";
import { registerTile } from "../core/grid";

export function createNaturalResource(
  zoneId: ZoneId,
  x: number,
  y: number,
  type: string,
) {
  const entity = {
    zoneId,
    position: { x: x * TILE_SIZE, y: y * TILE_SIZE },
    gridPosition: { x, y },
    natural: type, // 'tree', 'rock', 'river'
    sprite: new Graphics(),
  };

  const g = entity.sprite;
  g.label = `Natural-${type}`;

  // Simple Drawing
  if (type === NATURAL.TREE) {
    g.circle(32, 32, 16);
    g.fill(0x2e7d32); // Dark Green
    g.rect(28, 48, 8, 16); // Trunk
    g.fill(0x5d4037);
  } else if (type === NATURAL.ROCK) {
    g.poly([10, 60, 30, 20, 50, 60]);
    g.fill(0x757575); // Grey
  } else if (type === NATURAL.RIVER) {
    g.rect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fill({ color: 0x42a5f5, alpha: 0.6 });
  }

  world.add(entity);
  registerTile(entity as any);
  return entity;
}
