import { world } from "../core/ecs";
import { gameState } from "../core/gameState";
import { TILE_SIZE, ZONES } from "../config/constants";
import { Container, Application } from "pixi.js";

// Container for Game World (Pand/Zoomable later)
export const gameContainer = new Container();
const groundLayer = new Container();
const naturalLayer = new Container(); // New Layer for Trees/Rocks
const objectLayer = new Container();

gameContainer.addChild(groundLayer);
gameContainer.addChild(naturalLayer);
gameContainer.addChild(objectLayer);

let isBatchDestroying = false;

// Optimization for Prestige/Reset
export function batchDestroyVisuals() {
  isBatchDestroying = true;
  // Destroy children of each layer but keep the layers
  groundLayer.removeChildren().forEach(c => c.destroy({ children: true }));
  naturalLayer.removeChildren().forEach(c => c.destroy({ children: true }));
  objectLayer.removeChildren().forEach(c => c.destroy({ children: true }));

  // Reset flag after a short delay or immediately? 
  // Immediately is risky if the entity loop happens right after.
  // We should rely on the caller to finish entity removal.
}

export function finishBatchDestroy() {
  isBatchDestroying = false;
}

// Zone Backgrounds (Outside Grid)
const ZONE_BG_COLORS = {
  [ZONES.CITY]: 0x1a1a1a, // Dark Grey
  [ZONES.FOREST]: 0x0d260d, // Very Dark Green
  [ZONES.MOUNTAIN]: 0x261a0d, // Very Dark Brown
  [ZONES.FARM]: 0x1a261a, // Darker Greenish
};

let appRef: Application;
let currentZoneBgString = "";

export function initRenderSystem(app: Application) {
  appRef = app;
  app.stage.addChild(gameContainer);

  // Center the container
  const gridWidth = gameState.worldWidth * TILE_SIZE;
  const gridHeight = gameState.worldHeight * TILE_SIZE;

  gameContainer.x = (app.screen.width - gridWidth) / 2;
  gameContainer.y = (app.screen.height - gridHeight) / 2;

  world.onEntityAdded.subscribe((entity) => {
    if (entity.sprite) {
      // Determine Layer
      if ("truck" in entity || "building" in entity) {
        objectLayer.addChild(entity.sprite);
      } else if ((entity as any).natural) {
        // Natural Resources go between ground and buildings
        naturalLayer.addChild(entity.sprite);
      } else {
        // Assume tile
        groundLayer.addChild(entity.sprite);
      }

      // Set initial position
      if (entity.position) {
        entity.sprite.x = entity.position.x;
        entity.sprite.y = entity.position.y;
      }
    }
  });

  world.onEntityRemoved.subscribe((entity) => {
    if (isBatchDestroying) return; // Skip individual cleanup during batch reset

    if (entity.sprite) {
      if (entity.sprite.parent) {
        entity.sprite.parent.removeChild(entity.sprite);
      }
      // Ensure we destroy the PIXI object to free memory/GL buffers
      // { children: true } destroys children recursively.
      // { texture: false, baseTexture: false } is default, preventing shared texture destruction.
      if (!entity.sprite.destroyed) {
        entity.sprite.destroy({ children: true });
      }
    }
  });

  console.log("RenderSystem Initialized");
}

export function RenderSystem(_dt: number) {
  const currentZone = gameState.activeZone;

  /* 
    // Remove continuous centering to allow panning
    if (appRef) {
        const gridWidth = gameState.worldWidth * TILE_SIZE;
        const gridHeight = gameState.worldHeight * TILE_SIZE;
        gameContainer.x = (appRef.screen.width - gridWidth) / 2;
        gameContainer.y = (appRef.screen.height - gridHeight) / 2;
    } 
    */

  // Update Background Color based on Zone
  if (appRef && currentZoneBgString !== currentZone) {
    currentZoneBgString = currentZone;
    const col = ZONE_BG_COLORS[currentZone] || 0x222222;
    appRef.renderer.background.color = col;
  }

  // Manual Loop over entities to handle visibility
  // Can we optimize? Sure, but for <1000 entities it's instant.

  // We iterate specific query or just all entities with sprites?
  // Using the query from before
  // const renderableEntities = world.with("position", "zoneId");
  // Re-querying here to be safe or use cached query
  const renderableEntities = world.with("position", "zoneId");

  for (const entity of renderableEntities) {
    if (!entity.sprite) continue;

    const isVisible = entity.zoneId === currentZone;
    entity.sprite.visible = isVisible;

    if (!isVisible) continue;

    if (entity.gridPosition) {
      entity.sprite.x = entity.gridPosition.x * TILE_SIZE;
      entity.sprite.y = entity.gridPosition.y * TILE_SIZE;
    } else if (entity.position) {
      entity.sprite.x = entity.position.x;
      entity.sprite.y = entity.position.y;
    }
  }
}
