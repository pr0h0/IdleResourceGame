import { gameState } from "../core/gameState";
import { PRESTIGE_UPGRADES } from "../config/prestige";
import { world } from "../core/ecs";
import Decimal from "decimal.js";
import { GridLookup } from "../core/grid";
import { ZONES, type ZoneId } from "../config/constants";
import { createTile } from "../entities/createTile";
import { createBuilding } from "../entities/createBuilding";
import { BUILDINGS } from "../config/buildings";
import { createNaturalResource } from "../entities/createNaturalResource";
import { NATURAL } from "../config/constants";
import { RESOURCES } from "../config/resources";
import { batchDestroyVisuals, finishBatchDestroy } from "../render/RenderSystem";

export class PrestigeSystem {
  // 1 Amber per 5000 Credits Earned (Lifetime)
  // Using simple linear or sqrt formula?
  // Let's use SQRT to encourage deeper runs, but keep it accessible.
  // Amber = floor( sqrt( LifetimeCredits / (1000 + LifetimeAmber * 10) ) )
  static calculatePendingPrestige(): Decimal {
    // Safety check for legacy saves/hot-reload
    if (!gameState.lifetimeAmber) {
      gameState.lifetimeAmber = gameState.prestigeCurrency || new Decimal(0);
    }

    // Dynamic Divisor: The more Amber you have ever earned, the harder the next one is.
    // This helps curb the "farm 1 amber quickly" loop.
    // Updated to * 100 to significantly slow down rapid farming.
    const divisor = new Decimal(1000).plus(gameState.lifetimeAmber.mul(100));

    if (gameState.lifetimeEarnings.lt(divisor)) return new Decimal(0);

    return gameState.lifetimeEarnings.div(divisor).sqrt().floor();
  }

  static buyUpgrade(id: string) {
    const upgrade = PRESTIGE_UPGRADES[id];
    if (!upgrade) return;

    const currentLevel = gameState.prestigeUpgrades[id] || 0;
    if (upgrade.maxLevel && currentLevel >= upgrade.maxLevel) return;

    let costVal = upgrade.cost;
    if (upgrade.costScale === "linear") {
      costVal = upgrade.cost + currentLevel;
    }

    const cost = new Decimal(costVal);

    if (gameState.prestigeCurrency.gte(cost)) {
      gameState.prestigeCurrency = gameState.prestigeCurrency.minus(cost);
      gameState.prestigeUpgrades[id] = currentLevel + 1;
      console.log(
        `Bought Prestige Upgrade: ${upgrade.name} Lvl ${currentLevel + 1}`,
      );

      // Special Handling (Instant Effect)
      if (id === "land_expansion") {
        this.expandWorldImmediately();
      }
    }
  }

  private static expandWorldImmediately() {
    const newSize = gameState.worldWidth; // Already includes the +1 from upgrade
    // The previous size was newSize - 1. We need to fill x=(newSize-1) and y=(newSize-1)

    // Actually, just iterate 0..newSize and create if missing is safer
    // And we must do this for ALL ZONES

    Object.values(ZONES).forEach((zone) => {
      for (let x = 0; x < newSize; x++) {
        for (let y = 0; y < newSize; y++) {
          // Check existing via GridLookup or just try to create (createTile checks lookup? No createTile force creates)
          // createTile logic:
          // const id = `${zone},${x},${y}`;
          // if (GridLookup.has(id)) return; // Ideal

          if (!GridLookup.has(`${zone},${x},${y}`)) {
            createTile(zone as ZoneId, x, y);
          }
        }
      }
    });

    console.log("World Expanded to " + newSize + "x" + newSize);
  }

  static doPrestige() {
    // 1. Calculate & Award Amber
    const gain = this.calculatePendingPrestige();
    if (gain.lte(0)) {
      console.log("Not enough progress to prestige!");
      return;
    }

    gameState.prestigeCurrency = gameState.prestigeCurrency.plus(gain);
    gameState.lifetimeAmber = gameState.lifetimeAmber.plus(gain);
    console.log(`Prestige Reset! Gained ${gain} Amber.`);

    // 2. Clear Run State
    // Keep Prestige Data
    // const savedPrestige = { ...gameState.prestigeUpgrades };
    // const savedCurrency = gameState.prestigeCurrency;

    // Reset GameState
    // We can't just new GameState() because it's a singleton instance exported.
    // We have to reset fields manually.

    // Preservation Logic
    const vaultLevel = gameState.prestigeUpgrades["resource_preservation"] || 0;
    const keepRatio = Math.min(0.5, vaultLevel * 0.1);

    const nextResources: Record<string, Map<string, Decimal>> = {
      [ZONES.CITY]: new Map([[RESOURCES.BREAD, new Decimal(1000)]]),
      [ZONES.FOREST]: new Map(),
      [ZONES.MOUNTAIN]: new Map(),
      [ZONES.FARM]: new Map(),
    };

    if (keepRatio > 0) {
      for (const z of Object.keys(gameState.resources)) {
        gameState.resources[z].forEach((amt, type) => {
          const current = nextResources[z].get(type) || new Decimal(0);
          nextResources[z].set(type, current.plus(amt.mul(keepRatio).floor()));
        });
      }
    }

    // --- RESET FIELDS ---
    gameState.credits = new Decimal(1000);

    // Starter Pack Bonus
    // Formula: 500 * (L^2 - L + 1) -> 500, 1500, 3500...
    const spLvl = gameState.prestigeUpgrades["starter_pack"] || 0;
    let startBonus = 0;
    if (spLvl > 0) {
      startBonus = 500 * (spLvl * spLvl - spLvl + 1);
    }
    gameState.credits = gameState.credits.plus(startBonus);

    gameState.techPoints = new Decimal(0);
    // Tech Savvy Bonus - Quadratic Scaling
    const tsLvl = gameState.prestigeUpgrades["tech_savvy"] || 0;
    let techBonus = 0;
    if (tsLvl > 0) {
      techBonus = 10 * (tsLvl * tsLvl - tsLvl + 1);
    }
    gameState.techPoints = gameState.techPoints.plus(techBonus);

    gameState.unlockedTechs = new Set();
    gameState.techLevels = {};
    gameState.lifetimeEarnings = new Decimal(0); // Reset for next run
    gameState.totalPopulation = 0;
    gameState.maxPopulation = 0;
    gameState.employed = 0;
    gameState.activeZone = ZONES.CITY;
    gameState.resources = nextResources; // Apply vaulted resources
    gameState.routes = []; // Clear logistics routes
    gameState.autoSellRoutes = []; // Clear auto-sell routes

    // Reset Buildings / Entities
    // Fast Batch visual destroy
    batchDestroyVisuals();

    // Now remove from World (logic only)
    // Using a simple loop is fine now since subscribers are skipped
    const entities = [...world.entities];
    for (const ent of entities) {
      world.remove(ent);
    }
    finishBatchDestroy();

    GridLookup.clear();

    // Clear PIXI Stage of everything except maybe UI if separate?
    // Actually, RenderSystem manages children.
    // We should clear the GameContainer.
    // But render system doesn't expose it easily.
    // However, destroying entity sprites usually removes them from parent.
    // To be safe, we might want to force rendering update?

    // 3. Re-Initialize World (Similar to main.ts logic)
    this.regenerateWorld();

    // 4. Force Zone Switch to refresh rendering view
    gameState.activeZone = ZONES.CITY;
    // The RenderSystem needs to re-fetch tiles.
    // Since we killed entities, RenderSystem loop should see new ones next frame.
  }

  private static regenerateWorld() {
    // This duplicates logic in main.ts, ideally we should extract main.ts init logic.
    // For now, I'll copy the basic structure or call a global reset handler if possible.
    // Since I can't easily refactor main.ts right now without risk, I'll replicate the basic starter map.

    // Init logic copied/adapted from main.ts

    const addNaturalSafely = (
      zone: string,
      x: number,
      y: number,
      type: string,
    ) => {
      // Simplified: Just add. No complex cap logic needed since we control the loop.
      createNaturalResource(zone as ZoneId, x, y, type);
    };

    const size = gameState.worldWidth;
    const natureBonus = (gameState.prestigeUpgrades["nature_abundance"] || 0);
    const initialCap = 5 + natureBonus;

    // City
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        createTile(ZONES.CITY, x, y);
      }
    }

    // Forest
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        createTile(ZONES.FOREST, x, y);
      }
    }

    // Re-implement Scatter Logic simply
    const forestFree: { x: number; y: number }[] = [];
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++) {
        if (!((x == 2 && y == 2) || (x == 4 && y == 4)))
          forestFree.push({ x, y });
      }
    // Shuffle
    for (let i = forestFree.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [forestFree[i], forestFree[j]] = [forestFree[j], forestFree[i]];
    }
    for (let i = 0; i < initialCap; i++) {
      if (forestFree[i])
        addNaturalSafely(
          ZONES.FOREST,
          forestFree[i].x,
          forestFree[i].y,
          NATURAL.TREE,
        );
    }

    // Mountain
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        createTile(ZONES.MOUNTAIN, x, y);
      }
    }
    const mountainFree: { x: number; y: number }[] = [];
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++) mountainFree.push({ x, y });
    for (let i = mountainFree.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mountainFree[i], mountainFree[j]] = [mountainFree[j], mountainFree[i]];
    }
    for (let i = 0; i < initialCap; i++) {
      if (mountainFree[i])
        addNaturalSafely(
          ZONES.MOUNTAIN,
          mountainFree[i].x,
          mountainFree[i].y,
          NATURAL.ROCK,
        );
    }

    // Farm
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        createTile(ZONES.FARM, x, y);
      }
    }
    
    // Farm Nature Spawn (Scatter)
    const farmFree: { x: number; y: number }[] = [];
    for (let x = 0; x < size; x++)
        for (let y = 0; y < size; y++) farmFree.push({ x, y });

    for (let i = farmFree.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [farmFree[i], farmFree[j]] = [farmFree[j], farmFree[i]];
    }
    
    // Spawn Small quantity of Water (River)
    for (let i = 0; i < initialCap; i++) {
        if (farmFree[i]) {
            addNaturalSafely(ZONES.FARM, farmFree[i].x, farmFree[i].y, NATURAL.RIVER);
        }
    }

    // Starter Buildings
    createBuilding(ZONES.FOREST, 2, 2, BUILDINGS.LOGGING_CAMP);
    createBuilding(ZONES.FOREST, 4, 4, BUILDINGS.FOREST_DOCK);
    createBuilding(ZONES.CITY, 5, 5, BUILDINGS.TOWN_HALL);

    gameState.maxPopulation = 5;
    gameState.totalPopulation = 5;
    gameState.employed = 0; // Recalculate

    // Fix Employed count based on starter buildings?
    // Logging Camp (2) + Forest Dock (1) = 3 employed?
    // Logic system runs next frame, but safe to init.
  }
}
