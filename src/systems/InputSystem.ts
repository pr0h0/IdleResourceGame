import { gameContainer } from "../render/RenderSystem";
import { TILE_SIZE } from "../config/constants";
import { gameState } from "../core/gameState";
import { createBuilding } from "../entities/createBuilding";
import { getTile } from "../core/grid";
import { FederatedPointerEvent, Rectangle, Graphics } from "pixi.js";
import { BUILDINGS, BUILDING_INFO } from "../config/buildings";
import { world } from "../core/ecs";
import Decimal from "decimal.js";
import { pixiApp } from "../main";

let cursorHighlight: Graphics;

// Panning State (Right Click)
let isDragging = false;
let startX = 0;
let startY = 0;

// Action State (Left Click Drag)
let isLeftMouseDown = false;
let lastActionGrid = "";

export function initInputSystem() {
  // Ensure container captures clicks everywhere in the grid, even on gaps
  // Use a large hitArea to cover potential expansion (e.g. 50x50)
  // Or we can update it dynamically, but a large static one is simpler performance-wise.
  gameContainer.hitArea = new Rectangle(0, 0, 50 * TILE_SIZE, 50 * TILE_SIZE);

  // Grid Interactions
  gameContainer.eventMode = "static";
  gameContainer.on("pointerdown", onGridDown);
  gameContainer.on("pointermove", onGridMove);
  gameContainer.on("pointerup", onGridUp);
  gameContainer.on("pointerupoutside", onGridUp);

  // Panning Interactions (on the Stage/Background)
  pixiApp.stage.eventMode = "static";
  pixiApp.stage.hitArea = pixiApp.screen;

  // Zoom Logic (Wheel)
  pixiApp.canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      let newScale = gameContainer.scale.x;

      if (e.deltaY < 0) {
        // Zoom In
        newScale *= 1 + zoomSpeed;
      } else {
        // Zoom Out
        newScale *= 1 - zoomSpeed;
      }

      // Clamp Zoom
      newScale = Math.min(Math.max(0.2, newScale), 5); // 0.2x to 5x

      // Zoom towards mouse pointer logic
      // 1. Get Mouse relative to Container
      const centerX = (e.clientX - gameContainer.x) / gameContainer.scale.x;
      const centerY = (e.clientY - gameContainer.y) / gameContainer.scale.y;

      // 2. Apply Scale
      gameContainer.scale.set(newScale);

      // 3. Move Container so that point is still under mouse
      gameContainer.x = e.clientX - centerX * newScale;
      gameContainer.y = e.clientY - centerY * newScale;
    },
    { passive: false },
  );

  pixiApp.stage.on("pointerdown", (e) => {
    // Only pan if Middle click or clicking outside grid (or if we decide left-drag is pan)
    // Let's allow Middle Click or Right Click for Panning
    if (e.button === 1 || e.button === 2) {
      isDragging = true;
      startX = e.global.x - gameContainer.x;
      startY = e.global.y - gameContainer.y;
      e.preventDefault();
    }
  });

  pixiApp.stage.on("pointermove", (e) => {
    if (isDragging) {
      gameContainer.x = e.global.x - startX;
      gameContainer.y = e.global.y - startY;
    }
  });

  pixiApp.stage.on("pointerup", () => {
    isDragging = false;
  });
  pixiApp.stage.on("pointerupoutside", () => {
    isDragging = false;
  });

  // Disable Context Menu
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  // Cursor Highlight
  cursorHighlight = new Graphics();

  // Create cursor highlight
  cursorHighlight = new Graphics();
  // Use Top-Left alignment logic (x:0, y:0) to match RenderSystem
  cursorHighlight.rect(0, 0, TILE_SIZE, TILE_SIZE);
  cursorHighlight.stroke({ width: 2, color: 0xffff00 });
  cursorHighlight.alpha = 0; // Hides initially

  // Add to container (top layer)
  gameContainer.addChild(cursorHighlight);

  console.log("InputSystem Initialized");
}

function onGridMove(e: FederatedPointerEvent) {
  // Show highlight under mouse
  const localPos = gameContainer.toLocal(e.global);
  const gridX = Math.floor(localPos.x / TILE_SIZE);
  const gridY = Math.floor(localPos.y / TILE_SIZE);

  // Check if tile exists (Robust check)
  // We only highlight if there is a valid tile to build/interact on
  const tileExists = getTile(gameState.activeZone, gridX, gridY);

  if (tileExists) {
    cursorHighlight.alpha = 0.5;
    cursorHighlight.x = gridX * TILE_SIZE;
    cursorHighlight.y = gridY * TILE_SIZE;

    // Scale stroke thickness inversely with container scale
    const thickness = 2 / gameContainer.scale.x;
    cursorHighlight
      .clear()
      .rect(0, 0, TILE_SIZE, TILE_SIZE)
      .stroke({ width: thickness, color: 0xffff00 });

    // DRAG ACTION (Build/Destroy)
    if (isLeftMouseDown) {
      const currentGrid = `${gridX},${gridY}`;
      if (currentGrid !== lastActionGrid) {
        lastActionGrid = currentGrid;

        // Only allow drag for Build or Destroy (not Inspect/Move)
        if (
          gameState.selectedBuilding === "DESTROY" ||
          (gameState.selectedBuilding && gameState.selectedBuilding !== "MOVE")
        ) {
          handleAction(gridX, gridY);
        }
      }
    }
  } else {
    cursorHighlight.alpha = 0;
  }
}

function onGridUp() {
  isLeftMouseDown = false;
  lastActionGrid = "";
}

function onGridDown(e: FederatedPointerEvent) {
  // Only allow Left Click (0) for interactions
  if (e.button !== 0) return;

  const localPos = gameContainer.toLocal(e.global);
  const gridX = Math.floor(localPos.x / TILE_SIZE);
  const gridY = Math.floor(localPos.y / TILE_SIZE);

  if (!getTile(gameState.activeZone, gridX, gridY)) return;

  isLeftMouseDown = true;
  lastActionGrid = `${gridX},${gridY}`;
  handleAction(gridX, gridY);
}

function handleAction(gridX: number, gridY: number) {
  // Grid coords are passed in directly

  // Bounds Check using Tile Existence
  // (Redundant check if called from onGridDown/Move but safe to keep or remove if pure logic)
  if (!getTile(gameState.activeZone, gridX, gridY)) return;

  // ... rest of logic ...
  const existing = world
    .with("building", "gridPosition", "zoneId")
    .where(
      (entity) =>
        entity.zoneId === gameState.activeZone &&
        entity.gridPosition.x === gridX &&
        entity.gridPosition.y === gridY,
    ).first;

  // --- INSPECT TOOL (Default) ---
  if (!gameState.selectedBuilding) {
    if (existing) {
      // Ensure ID exists (for old entities or migration)
      if (!existing.id) existing.id = Math.floor(Math.random() * 1000000000);

      console.log("Selected entity:", existing);
      gameState.selectedEntityId = existing.id ?? null;
      // Trigger UI open? UI should poll or subscribe.
      // For visual feedback:
      if (cursorHighlight) {
        cursorHighlight.clear();
        // Draw rect matched to RenderSystem (Top-Left 0,0)
        cursorHighlight
          .rect(0, 0, TILE_SIZE, TILE_SIZE)
          .stroke({ width: 2, color: 0xffffff });

        // If RenderSystem sets x = gridX * TILE_SIZE (Top-Left), then we use that directly.
        // If existing.position is center (old logic), we need to adjust.
        // But RenderSystem now enforces gridPosition -> TopLeft.
        // So existing.position is likely correct TopLeft.

        cursorHighlight.x = existing.position!.x;
        cursorHighlight.y = existing.position!.y;
        cursorHighlight.visible = true;
      }
    } else {
      gameState.selectedEntityId = null;
      if (cursorHighlight) cursorHighlight.visible = false;
    }
    return;
  }

  // --- DESTROY TOOL ---
  if (gameState.selectedBuilding === "DESTROY") {
    if (existing) {
      const bId = existing.building?.type;

      // Prevent destroying Town Hall
      if (bId === BUILDINGS.TOWN_HALL) {
        console.log("Cannot destroy Town Hall");
        // gameState.selectedBuilding = null;
        return;
      }

      if (bId) {
        const info = BUILDING_INFO[bId];
        if (info) {
          if (info.workers) {
            gameState.employed = Math.max(0, gameState.employed - info.workers);
          }
          if (info.housing) {
            gameState.maxPopulation = Math.max(
              0,
              gameState.maxPopulation - info.housing,
            );
            // Evict? Or keep overpop? Let's evict for consistency
            gameState.totalPopulation = Math.min(
              gameState.totalPopulation,
              gameState.maxPopulation,
            );
          }
        }
      }

      world.remove(existing);
      if (existing.sprite) {
        existing.sprite.destroy();
      }
      console.log("Destroyed building");

      // If we were inspecting this, close inspector
      if (gameState.selectedEntityId === existing.id) {
        gameState.selectedEntityId = null;
      }
      return;
    }

    // Check for Natural Resource (Not found in 'existing' scope which looks for building)
    // Manual search as 'existing' query specifically looks for 'building' component
    const natural = world
      .with("natural", "gridPosition", "zoneId")
      .where(
        (entity) =>
          entity.zoneId === gameState.activeZone &&
          entity.gridPosition.x === gridX &&
          entity.gridPosition.y === gridY,
      ).first;

    if (natural) {
      console.log("Destroying Natural Resource:", natural.natural);
      world.remove(natural);
      if (natural.sprite) {
        natural.sprite.destroy();
      }
      return;
    }

    return;
  }

  // --- MOVE TOOL ---
  if (gameState.selectedBuilding === "MOVE") {
    if (gameState.moveSourceParams) {
      // STEP 2: Place
      if (existing) {
        console.log("Cannot move here: Space occupied");
        return;
      }

      const natural = world
        .with("natural", "gridPosition", "zoneId")
        .where(
          (entity) =>
            entity.zoneId === gameState.activeZone &&
            entity.gridPosition.x === gridX &&
            entity.gridPosition.y === gridY,
        ).first;

      if (natural) {
        console.log("Cannot move here: Blocked by " + natural.natural);
        return;
      }

      if (!getTile(gameState.activeZone, gridX, gridY)) {
        console.log("No ground");
        return;
      }

      const ent = gameState.moveSourceParams.entity;

      if (!ent.gridPosition || !ent.position) {
        console.error("Entity missing position data");
        return;
      }

      // Update Logic
      ent.gridPosition.x = gridX;
      ent.gridPosition.y = gridY;
      // Update Visual (Top-Left Alignment)
      ent.position.x = gridX * TILE_SIZE;
      ent.position.y = gridY * TILE_SIZE;
      // Force Sprite update (RenderSystem does it usually if position changes,
      // but we might need to sync sprite.x/y immediately or next frame)

      // Clear selection
      gameState.moveSourceParams = null;
      // Visual indicator: maybe untint?
      if (ent.sprite) ent.sprite.alpha = 1;

      console.log("Moved building");
    } else {
      // STEP 1: Pickup
      if (existing) {
        gameState.moveSourceParams = { x: gridX, y: gridY, entity: existing };
        if (existing.sprite) existing.sprite.alpha = 0.5; // Visual feedback
        console.log("Picked up building to move...");
      }
    }
    return;
  }

  // --- BUILD TOOL ---

  // 1. Is there ground here?
  const tile = getTile(gameState.activeZone, gridX, gridY);
  if (!tile) {
    return;
  }

  // 2. Is there already a building?
  if (existing) {
    console.log("Cannot build: Space occupied");
    return;
  }

  // Check Natural Resource
  const natural = world
    .with("natural", "gridPosition", "zoneId")
    .where(
      (entity) =>
        entity.zoneId === gameState.activeZone &&
        entity.gridPosition.x === gridX &&
        entity.gridPosition.y === gridY,
    ).first;

  if (natural) {
    console.log("Cannot build: Blocked by " + natural.natural);
    return;
  }

  // 3. Check Cost
  const info = BUILDING_INFO[gameState.selectedBuilding];
  if (!info) return;

  // Check Worker Requirement
  if (info.workers) {
    // Global unemployment check
    const free = gameState.totalPopulation - gameState.employed;

    if (free < info.workers) {
      console.log(`Not enough WORKERS! Need ${info.workers}, have ${free}`);
      return;
    }
  }

  // Check all costs
  let affordable = true;
  for (const [res, count] of Object.entries(info.cost)) {
    const cost = new Decimal(count || 0);
    if (res === "money") {
      if (gameState.credits.lt(cost)) {
        console.log("Not enough credits");
        affordable = false;
        break;
      }
    } else {
      // Check LOCAL ZONE resources
      if (!gameState.hasResource(gameState.activeZone, res, cost)) {
        console.log(`Not enough ${res} in ${gameState.activeZone}`);
        affordable = false;
        break;
      }
    }
  }

  if (!affordable) return;

  // 4. Build
  // Deduct Resources
  for (const [res, count] of Object.entries(info.cost)) {
    const cost = new Decimal(count || 0);
    if (res === "money") {
      gameState.addCredits(cost.negated());
    } else {
      gameState.consumeResource(gameState.activeZone, res, cost);
      console.log(`Consumed ${cost} ${res} from ${gameState.activeZone}`);
    }
  }

  // Assign Workers / Housing
  if (info.workers) {
    gameState.employed += info.workers;
  }
  if (info.housing) {
    gameState.maxPopulation += info.housing;
  }

  // Spawn

  // Spawn
  createBuilding(
    gameState.activeZone,
    gridX,
    gridY,
    gameState.selectedBuilding,
  );
  console.log(`Built ${gameState.selectedBuilding} at ${gridX},${gridY}`);
}
