import { world, type Entity } from "../core/ecs";
import { TILE_SIZE, type ZoneId, NATURAL } from "../config/constants";
import { BUILDING_INFO, BUILDINGS, type BuildingId } from "../config/buildings";
import { Graphics, Container, Sprite, Texture, Text } from "pixi.js";
import Decimal from "decimal.js";

export const SPRITE_MAP: Record<string, string> = {
  // Buildings
  [BUILDINGS.TENEMENT]: "/sprites/bldg_tenement.png",
  [BUILDINGS.MARKETPLACE]: "/sprites/bldg_market.png",
  [BUILDINGS.TOWN_HALL]: "/sprites/bldg_city_hall.png",
  [BUILDINGS.RESEARCH_LAB]: "/sprites/bldg_research.png",

  // Natural Resources
  [NATURAL.RIVER]: "/sprites/prop_water.png",
  [NATURAL.ROCK]: "/sprites/prop_stone.png",

  // Tiles
  tile_forest: "/sprites/tile_forest_ground.png",

  // Tools
  tool_move: "/sprites/icon_tool_move.png",
  tool_destroy: "/sprites/icon_tool_bomb.png",

  // Cursors
  cursor_default: "/sprites/cursor_default.png",
  cursor_pointer: "/sprites/cursor_pointer.png",
  cursor_grab: "/sprites/cursor_grab.png",
  cursor_grabbing: "/sprites/cursor_grabbing.png",
};

export function createBuilding(
  zoneId: ZoneId,
  x: number,
  y: number,
  buildingId: BuildingId,
) {
  const info = BUILDING_INFO[buildingId as keyof typeof BUILDING_INFO];
  if (!info) return null;

  // Visual: Container holding offset graphics
  const container = new Container();

  if (SPRITE_MAP[buildingId]) {
    const texture = Texture.from(SPRITE_MAP[buildingId]);
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.width = TILE_SIZE;
    s.height = TILE_SIZE;
    s.x = TILE_SIZE / 2;
    s.y = TILE_SIZE / 2;
    container.addChild(s);
  } else {
    const g = new Graphics();
    // Draw centered shape
    drawBuildingShape(g, buildingId);
    // Offset the graphics to center of tile
    g.x = TILE_SIZE / 2;
    g.y = TILE_SIZE / 2;
    container.addChild(g);
  }

  // Add Level Text (Always create, hide if Level 1 initially?)
  const lvlTxt = new Text({
    text: "1", // Initial level
    style: {
      fontSize: 10,
      fill: "white",
      fontWeight: "bold",
      stroke: { color: "#000000", width: 2 }, // Strong outline
    },
  });
  lvlTxt.label = "LevelLabel"; // Tag for easier update
  lvlTxt.anchor.set(0.5);
  lvlTxt.x = TILE_SIZE - 8; // Bottom right corner
  lvlTxt.y = TILE_SIZE - 8;
  lvlTxt.visible = false; // Hide 1
  container.addChild(lvlTxt);

  // Position (Top-Left of Tile for logic consistency with RenderSystem)
  const pixelX = x * TILE_SIZE;
  const pixelY = y * TILE_SIZE;

  const entity: Entity = {
    id: Math.floor(Math.random() * 1_000_000_000), // Assign ID for selection
    zoneId,
    gridPosition: { x, y },
    position: { x: pixelX, y: pixelY },
    sprite: container as any, // Cast for ECS typings (treat container as sprite)
    building: { type: buildingId, level: 1 },
    inventory: new Map(), // Inventory to store output
  };

  // Only add producer component if the building actually produces something
  if (info.output) {
    entity.producer = {
      resourceType: info.output.resource,
      rate: new Decimal(info.output.rate),
    };
    // Add Input if exists
    if (info.input) {
      entity.producer.inputResource = info.input.resource;
      entity.producer.inputRate = new Decimal(info.input.rate);
    }
  }

  world.add(entity);
  return entity;
}

export function drawBuildingShape(g: Graphics, id: string) {
  switch (id) {
    case BUILDINGS.LOGGING_CAMP:
      // Brown Log Cabin
      g.rect(-20, -20, 40, 40);
      g.fill(0x8b4513);
      // Roof
      g.poly([-25, -20, 0, -40, 25, -20]);
      g.fill(0x5d4037);
      // Door
      g.rect(-5, 5, 10, 15);
      g.fill(0x000000);
      break;

    case BUILDINGS.FOREST_DOCK:
      // Wooden Platform
      g.rect(-25, -25, 50, 50);
      g.fill(0xdeb887);
      // Crates
      g.rect(-15, -15, 10, 10);
      g.fill(0x8b4513);
      g.rect(5, 5, 10, 10);
      g.fill(0x8b4513);
      // Outline
      g.rect(-25, -25, 50, 50);
      g.stroke({ width: 2, color: 0x5d4037 });
      break;

    case BUILDINGS.SAWMILL:
      // Industrial Sawmill
      g.rect(-25, -20, 50, 40);
      g.fill(0xa1887f);
      // Saw Blade Icon (Circle)
      g.circle(0, 0, 12);
      g.fill(0xe0e0e0);
      g.circle(0, 0, 4);
      g.fill(0x3e2723);
      // Planks
      g.rect(-20, 10, 40, 5);
      g.fill(0xd7ccc8);
      break;

    case BUILDINGS.TRANSPORT_DEPOT:
    case BUILDINGS.CITY_DEPOT:
      // Truck Station
      g.rect(-30, -25, 60, 50);
      g.fill(0x455a64); // Dark Blue Grey
      // Garage Doors
      g.rect(-25, -5, 20, 25);
      g.fill(0x263238);
      g.rect(5, -5, 20, 25);
      g.fill(0x263238);
      // Roof Stripe
      g.rect(-30, -25, 60, 10);
      g.fill(0xffc107); // Amber Warning Stripe
      break;

    case BUILDINGS.TOWN_HALL:
      // Majestic Hall
      // Steps
      g.rect(-30, 15, 60, 10);
      g.fill(0x9e9e9e);
      // Pillars
      g.rect(-25, -15, 10, 30);
      g.fill(0xe0e0e0);
      g.rect(-5, -15, 10, 30);
      g.fill(0xe0e0e0);
      g.rect(15, -15, 10, 30);
      g.fill(0xe0e0e0);
      // Roof triangle
      g.poly([-35, -15, 0, -45, 35, -15]);
      g.fill(0x3f51b5); // Blue Roof
      break;

    case BUILDINGS.BAKERY:
      // Brick Oven House
      g.rect(-25, -25, 50, 50);
      g.fill(0xd84315); // Brick Orange
      // Oven Door
      g.circle(0, 10, 10);
      g.fill(0x3e2723);
      g.rect(-10, 10, 20, 10); // Flatten bottom
      g.fill(0x3e2723);
      // Bread sign
      g.circle(15, -15, 5);
      g.fill(0xffd54f);
      g.circle(20, -15, 5);
      g.fill(0xffd54f);
      g.circle(17, -18, 5);
      g.fill(0xffd54f);
      break;

    case BUILDINGS.RESEARCH_LAB:
      // High Tech Lab
      g.rect(-25, -25, 50, 50);
      g.fill(0xe0f7fa); // Cyan Tint White
      g.stroke({ width: 2, color: 0x00bcd4 });
      // Erlenmeyer Flask Icon
      g.poly([0, -10, -10, 10, 10, 10]);
      g.fill(0x76ff03); // Green goo
      break;

    case BUILDINGS.MARKETPLACE:
      // Stalls with striped awnings
      g.rect(-30, 0, 60, 20); // Base
      g.fill(0x8d6e63);
      // Awning (Stripes)
      g.rect(-30, -20, 20, 20);
      g.fill(0xf44336); // Red
      g.rect(-10, -20, 20, 20);
      g.fill(0xffffff); // White
      g.rect(10, -20, 20, 20);
      g.fill(0xf44336); // Red
      break;

    case BUILDINGS.QUARRY:
      // Big Hole
      g.circle(0, 0, 25);
      g.fill(0x757575);
      g.circle(0, 0, 18);
      g.fill(0x424242);
      // Stones
      g.circle(10, 10, 5);
      g.fill(0x000000); // Fixed typo 0B000000 -> 0x
      break;

    case BUILDINGS.FARM_FIELD:
      // Yellow square with lines
      g.rect(-28, -28, 56, 56);
      g.fill(0xffe082); // Light Gold
      // Crop Rows
      g.moveTo(-20, -28);
      g.lineTo(-20, 28);
      g.moveTo(0, -28);
      g.lineTo(0, 28);
      g.moveTo(20, -28);
      g.lineTo(20, 28);
      g.stroke({ width: 2, color: 0xffb300 }); // Dark Gold
      break;

    case BUILDINGS.TENEMENT:
      // Tall Grey Building
      g.rect(-20, -35, 40, 70); // Tall
      g.fill(0x607d8b);
      // Windows
      g.fill(0xffffe0);
      for (let i = 0; i < 3; i++) {
        g.rect(-10, -25 + i * 20, 8, 10);
        g.rect(2, -25 + i * 20, 8, 10);
      }
      g.fill(0xcfd8dc); // Window Color
      break;

    case BUILDINGS.STONE_MASON:
      // Grey Workshop with Saw
      g.rect(-25, -20, 50, 40);
      g.fill(0x78909c);
      // Chimney
      g.rect(10, -30, 10, 20);
      g.fill(0x546e7a);
      // Bricks Stacks
      g.rect(-20, 5, 10, 5);
      g.fill(0xd84315);
      g.rect(-20, 12, 10, 5);
      g.fill(0xd84315);
      break;

    case BUILDINGS.WINDMILL:
      // Tower
      g.poly([-15, 20, 15, 20, 10, -20, -10, -20]);
      g.fill(0xffffff);
      g.stroke({ width: 2, color: 0x999999 });
      // Blades (Static for now, rotate in system later?)
      // Cross
      g.moveTo(0, -20);
      g.lineTo(0, -50);
      g.moveTo(0, -20);
      g.lineTo(0, 10);
      g.moveTo(0, -20);
      g.lineTo(-30, -20);
      g.moveTo(0, -20);
      g.lineTo(30, -20);
      g.stroke({ width: 4, color: 0x5d4037 });
      break;

    default:
      // Generic Box
      g.rect(-20, -20, 40, 40);
      g.fill(0x9e9e9e); // Grey instead of Red
      g.rect(-10, -10, 20, 20);
      g.stroke({ width: 2, color: 0xffffff });
      break;
  }
}
