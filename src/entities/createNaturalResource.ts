import { world } from "../core/ecs";
import { Graphics, AnimatedSprite, Texture, Rectangle, Sprite } from "pixi.js";
import { TILE_SIZE, NATURAL, type ZoneId } from "../config/constants";
import { RESOURCE_SPRITESHEETS } from "../config/animations";
import { SPRITE_MAP } from "./createBuilding";
import { registerTile } from "../core/grid";

const TEXTURE_CACHE: Record<string, Texture[]> = {};

export function createNaturalResource(
  zoneId: ZoneId,
  x: number,
  y: number,
  type: string,
) {
  let sprite;

  // Check for Animation
  if (RESOURCE_SPRITESHEETS[type]) {
    if (!TEXTURE_CACHE[type]) {
      const config = RESOURCE_SPRITESHEETS[type];
      const baseTex = Texture.from(config.path);

      // Slice frames
      const frames = [];
      for (let i = 0; i < config.frames; i++) {
        const rect = new Rectangle(
          i * config.width,
          0,
          config.width,
          config.height,
        );
        frames.push(new Texture({ source: baseTex.source, frame: rect }));
      }
      TEXTURE_CACHE[type] = frames;
    }

    const anim = new AnimatedSprite(TEXTURE_CACHE[type]);
    anim.animationSpeed = 0.1; // roughly 6fps
    anim.play();

    // Default anchor is 0 (top-left). Since RenderSystem sets x,y to top-left of tile,
    // this works if images are TILE_SIZExTILE_SIZE or intended to draw from top-left.

    anim.width = TILE_SIZE;
    anim.height = TILE_SIZE;
    sprite = anim;
  } else if (SPRITE_MAP[type]) {
    // Static Sprite
    sprite = Sprite.from(SPRITE_MAP[type]);
    sprite.width = TILE_SIZE;
    sprite.height = TILE_SIZE;
  } else {
    // Fallback to Graphics
    sprite = new Graphics();
  }

  const entity = {
    zoneId,
    position: { x: x * TILE_SIZE, y: y * TILE_SIZE },
    gridPosition: { x, y },
    natural: type, // 'tree', 'rock', 'river'
    sprite: sprite,
  };

  const g = entity.sprite;
  g.label = `Natural-${type}`;

  if (g instanceof AnimatedSprite) {
    // It's just a sprite, we don't draw on it.
    // But wait, Graphics code below executes on 'g' which is typed as Graphics in previous code?
    // No, JS is loose. But if I change 'sprite' type to Graphics | AnimatedSprite
  } else if (g instanceof Graphics) {
    const graph = g;
    // Simple Drawing
    if (type === NATURAL.TREE) {
      graph.circle(32, 32, 16);
      graph.fill(0x2e7d32); // Dark Green
      graph.rect(28, 48, 8, 16); // Trunk
      graph.fill(0x5d4037);
    } else if (type === NATURAL.ROCK) {
      graph.poly([10, 60, 30, 20, 50, 60]);
      graph.fill(0x757575); // Grey
    } else if (type === NATURAL.RIVER) {
      graph.rect(0, 0, TILE_SIZE, TILE_SIZE);
      graph.fill({ color: 0x42a5f5, alpha: 0.6 });
    }
  }

  world.add(entity);
  registerTile(entity as any);
  return entity;
}
