import { Application, Assets, TextureStyle } from "pixi.js";
import { gameLoop } from "./core/loop";
import "./style.css";
import { initRenderSystem, RenderSystem } from "./render/RenderSystem";
import { initUISystem } from "./render/UISystem";
import { initPixiToolbar } from "./render/PixiToolbar";
import { initResourceSystem } from "./systems/ResourceSystem";
import { initTransportSystem } from "./systems/TransportSystem";
import { initMarketSystem } from "./systems/MarketSystem";
import { initInputSystem } from "./systems/InputSystem";
import { initAutoUpgradeSystem } from "./systems/AutoUpgradeSystem";
import { SaveSystem } from "./systems/SaveSystem";
// import { initDebugUI } from "./utils/debug";
import { createTile } from "./entities/createTile";
import { createBuilding, SPRITE_MAP } from "./entities/createBuilding";
import { gameState } from "./core/gameState";
import { ZONES, type ZoneId } from "./config/constants";
import { BUILDINGS } from "./config/buildings";

import { createNaturalResource } from "./entities/createNaturalResource";
import { NATURAL } from "./config/constants";
import { RESOURCE_SPRITESHEETS } from "./config/animations";
import { world, type Entity } from "./core/ecs";

// Extend Window interface for HMR support
declare global {
  interface Window {
    saveInterval?: number | ReturnType<typeof setInterval>;
  }
}

// ... existing imports

// Remove default vite style that centers everything, we want full screen usually
// or at least a specific container.
const appDiv = document.querySelector<HTMLDivElement>("#app")!;
appDiv.innerHTML = "";

// Initialize Pixi
const app = new Application();

// Set default scaling to nearest neighbor for pixel art
TextureStyle.defaultOptions.scaleMode = "nearest";

export const pixiApp = app; // Export for RenderSystem usage

async function init() {
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x222222,
    resizeTo: window,
  });

  // Attach Canvas
  appDiv.appendChild(app.canvas);

  // --- Preload Assets ---
  console.log("Loading assets...");
  const allAssets = [
    ...Object.values(SPRITE_MAP),
    ...Object.values(RESOURCE_SPRITESHEETS).map((s) => s.path),
  ];
  await Assets.load(allAssets);
  console.log("Assets loaded.");

  // --- Initialize Systems ---
  initRenderSystem(app);
  initPixiToolbar(app);
  initUISystem();
  initResourceSystem();
  initTransportSystem();
  initMarketSystem();
  initInputSystem();
  initAutoUpgradeSystem();
  // initDebugUI(); // Disabled for production feel

  // Add Loop Callbacks
  // gameLoop.addLogicSystem(ResourceSystem); // Added inside initResourceSystem
  gameLoop.addRenderSystem(RenderSystem);

  // --- Load Save OR Create New World ---
  if (!SaveSystem.load()) {
    console.log("Creating New World...");

    // Helper to Check Occupied (roughly, only for pre-gen logic)
    const occupied = new Set<string>();
    const mark = (z: string, x: number, y: number) =>
      occupied.add(`${z},${x},${y}`);
    const isFree = (z: string, x: number, y: number) =>
      !occupied.has(`${z},${x},${y}`);

    // Helper for Cap Logic
    const resourceQueues: Record<string, Entity[]> = {};

    const addNaturalSafely = (
      zone: string,
      x: number,
      y: number,
      type: string,
    ) => {
      const key = `${zone}-${type}`;
      if (!resourceQueues[key]) resourceQueues[key] = [];

      const ent = createNaturalResource(zone as ZoneId, x, y, type);
      resourceQueues[key].push(ent);

      // Enforce Cap
      const cap = 5 + (gameState.prestigeUpgrades["nature_abundance"] || 0) * 2;
      if (resourceQueues[key].length > cap) {
        const old = resourceQueues[key].shift();
        if (old) {
          world.remove(old);
          if (old.sprite) old.sprite.destroy();
        }
      }
      mark(zone, x, y);
    };

    // Helper to distribute resources randomly without bias
    const scatterResources = (
      zone: string,
      type: string,
      count: number,
      exclude: { x: number; y: number }[] = [],
    ) => {
      const spots: { x: number; y: number }[] = [];
      const size = gameState.worldWidth;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          // Check exclude
          if (exclude.some((p) => p.x === x && p.y === y)) continue;
          spots.push({ x, y });
        }
      }
      // Fisher-Yates Shuffle
      for (let i = spots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spots[i], spots[j]] = [spots[j], spots[i]];
      }
      // Spawn
      for (let i = 0; i < Math.min(count, spots.length); i++) {
        addNaturalSafely(zone, spots[i].x, spots[i].y, type);
      }
    };

    const W = gameState.worldWidth;
    const H = gameState.worldHeight;
    const natureBonus =
      (gameState.prestigeUpgrades["nature_abundance"] || 0) * 2;

    // Create Grid for City
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        createTile(ZONES.CITY, x, y);
      }
    }

    // Create Grid for Forest
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        createTile(ZONES.FOREST, x, y);
      }
    }
    // Scatter Trees
    scatterResources(ZONES.FOREST, NATURAL.TREE, 5 + natureBonus, [
      { x: 2, y: 2 },
      { x: 4, y: 4 },
    ]);

    // Create Grid for Mountain
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        createTile(ZONES.MOUNTAIN, x, y);
      }
    }
    // Scatter Rocks
    scatterResources(ZONES.MOUNTAIN, NATURAL.ROCK, 5 + natureBonus);

    // Create Grid for Farm
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        createTile(ZONES.FARM, x, y);
      }
    }

    // Create buildings (Safe Check)
    if (isFree(ZONES.FOREST, 2, 2))
      createBuilding(ZONES.FOREST, 2, 2, BUILDINGS.LOGGING_CAMP);
    if (isFree(ZONES.FOREST, 4, 4))
      createBuilding(ZONES.FOREST, 4, 4, BUILDINGS.FOREST_DOCK);

    // Create Town Hall (provides 5 housing)
    createBuilding(ZONES.CITY, 5, 5, BUILDINGS.TOWN_HALL);
    gameState.maxPopulation = 5;
    gameState.totalPopulation = 5; // Ready people
  }

  // Start the Game Loop
  gameLoop.start();

  // Auto-Save (every 60s)
  // Clear existing interval to prevent HMR buildup
  if (window.saveInterval) clearInterval(window.saveInterval);

  window.saveInterval = setInterval(() => {
    SaveSystem.save();
  }, 60000);

  // Save on Exit (Best effort)
  window.addEventListener("beforeunload", () => {
    SaveSystem.save();
  });

  console.log("Game Initialized!");
}

init();
