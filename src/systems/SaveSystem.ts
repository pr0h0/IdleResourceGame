import { world } from "../core/ecs";
import { gameState } from "../core/gameState";
import { createBuilding } from "../entities/createBuilding";
import { createTile } from "../entities/createTile";
import { type BuildingId } from "../config/buildings";
import { clearGrid } from "../core/grid";
import Decimal from "decimal.js";
import { ZONES, type ZoneId } from "../config/constants";

import { createNaturalResource } from "../entities/createNaturalResource";

interface SavedEntity {
  zoneId: string;
  x: number;
  y: number;
  type: "building" | "natural" | "tile";
  buildingId?: string;
  level?: number;
  naturalType?: string;
  inventory?: Record<string, string>;
}

interface SaveData {
  gameState: {
    credits: string;
    techPoints: string;
    unlockedTechs: string[];
    techLevels: Record<string, number>;
    prestigeCurrency: string;
    prestigeUpgrades: Record<string, number>;
    lifetimeEarnings: string;
    resources: Record<string, Record<string, string>>;
    population: { current: number; max: number; employed: number };
    activeZone: string;
    routes: any[];
  };
  entities: SavedEntity[];
}

// Helper to serialize Map
function mapToObject(map: Map<string, any>) {
  const obj: Record<string, string> = {};
  for (const [key, value] of map) {
    obj[key] = value.toString();
  }
  return obj;
}

// Helper to deserialize Map
function objectToMap(obj: Record<string, string> | undefined) {
  const map = new Map<string, Decimal>();
  if (!obj) return map;
  for (const k in obj) {
    map.set(k, new Decimal(obj[k]));
  }
  return map;
}

let isResetting = false;
let isSaving = false;

export const SaveSystem = {
  save: () => {
    if (isResetting || isSaving) return;
    isSaving = true;

    try {
      // Resources: Record<ZoneId, Map> -> Record<ZoneId, Object>
      const resObj: Record<string, Record<string, string>> = {};
      for (const [zone, map] of Object.entries(gameState.resources)) {
        resObj[zone] = mapToObject(map);
      }

      // Routes: Handle Decimal serialization
      const routesSafe = gameState.routes.map((r) => ({
        ...r,
        movedAmount: r.movedAmount.toString(),
      }));

      const data = {
        gameState: {
          credits: gameState.credits.toString(),
          techPoints: gameState.techPoints.toString(),
          unlockedTechs: Array.from(gameState.unlockedTechs),
          techLevels: gameState.techLevels,
          // Save Prestige
          prestigeCurrency: gameState.prestigeCurrency.toString(),
          prestigeUpgrades: gameState.prestigeUpgrades,
          lifetimeEarnings: gameState.lifetimeEarnings.toString(),

          resources: resObj,
          population: {
            current: gameState.totalPopulation,
            max: gameState.maxPopulation,
            employed: gameState.employed,
          },
          activeZone: gameState.activeZone,
          routes: routesSafe,
        },
        entities: [] as SavedEntity[],
      };

      // Entities
      for (const ent of world.entities) {
        // Must have position to be saved
        if (!ent.gridPosition || !ent.zoneId) continue;

        const entry: SavedEntity = {
          zoneId: ent.zoneId,
          x: ent.gridPosition.x,
          y: ent.gridPosition.y,
          type: "tile", // Default
        };

        if (ent.building) {
          entry.type = "building";
          entry.buildingId = ent.building.type;
          entry.level = ent.building.level; // Save Level
          if (ent.inventory) entry.inventory = mapToObject(ent.inventory);
        } else if (ent.natural) {
          entry.type = "natural";
          entry.naturalType = ent.natural;
        } else {
          // Assume Tile
          entry.type = "tile";
        }

        data.entities.push(entry);
      }

      const str = JSON.stringify(data);
      localStorage.setItem("idleGameSave", str);
      // console.log("Game Saved to localStorage");
    } catch (e) {
      console.error("Save Error:", e);
    } finally {
      isSaving = false;
    }
  },

  load: (): boolean => {
    const str = localStorage.getItem("idleGameSave");
    if (!str) {
      console.log("No save game found.");
      return false;
    }

    try {
      const data = JSON.parse(str) as SaveData;
      console.log("Loading Game...");

      // 1. Clear World
      // Destroy PIXI sprites
      for (const ent of world.entities) {
        if (ent.sprite) ent.sprite.destroy();
      }
      world.clear();
      clearGrid();

      // 2. Restore GameState
      gameState.credits = new Decimal(data.gameState.credits || 0);
      gameState.techPoints = new Decimal(data.gameState.techPoints || 0);
      gameState.unlockedTechs = new Set(data.gameState.unlockedTechs || []);
      gameState.techLevels = data.gameState.techLevels || {};

      // Load Prestige (Backward compat check)
      gameState.prestigeCurrency = new Decimal(
        data.gameState.prestigeCurrency || 0,
      );
      gameState.prestigeUpgrades = data.gameState.prestigeUpgrades || {};
      gameState.lifetimeEarnings = new Decimal(
        data.gameState.lifetimeEarnings || 0,
      );

      // Restore Resources
      if (data.gameState.resources) {
        for (const [zone, obj] of Object.entries(data.gameState.resources)) {
          if (gameState.resources[zone]) {
            gameState.resources[zone] = objectToMap(obj);
          }
        }
      }

      // Restore Population
      gameState.totalPopulation = Number(data.gameState.population.current);
      gameState.maxPopulation = Number(data.gameState.population.max);
      gameState.employed = Number(data.gameState.population.employed || 0);

      // Restore View
      gameState.activeZone =
        (data.gameState.activeZone as ZoneId) || ZONES.CITY;

      // Restore Routes
      if (data.gameState.routes) {
        gameState.routes = data.gameState.routes.map((r: any) => ({
          ...r,
          movedAmount: new Decimal(r.movedAmount || 0),
        }));
      }

      // 3. Restore Entities
      for (const entry of data.entities) {
        if (entry.type === "tile") {
          createTile(entry.zoneId as ZoneId, entry.x, entry.y);
        } else if (entry.type === "natural") {
          createNaturalResource(
            entry.zoneId as ZoneId,
            entry.x,
            entry.y,
            entry.naturalType!,
          );
        } else if (entry.type === "building") {
          // Create Base
          const entity = createBuilding(
            entry.zoneId as ZoneId,
            entry.x,
            entry.y,
            entry.buildingId as BuildingId,
          );

          if (entity) {
            // Restore Level
            if (entry.level && entity.building) {
              entity.building.level = entry.level;

              // Re-apply Level Multiplier
              if (entity.producer && entity.producer.rate && entry.level > 1) {
                entity.producer.rate = entity.producer.rate.mul(
                  Math.pow(1.5, entry.level - 1),
                );
              }
            }

            // Restore Inventory
            if (entry.inventory && entity.inventory) {
              entity.inventory = objectToMap(entry.inventory);
            }
          }
        }
      }

      console.log("Game Loaded Successfully");
      return true;
    } catch (e) {
      console.error("Failed to load save:", e);
      return false;
    }
  },

  hardReset: () => {
    if (
      confirm(
        "Are you sure you want to Wipe Save and Restart? This cannot be undone.",
      )
    ) {
      isResetting = true;
      localStorage.removeItem("idleGameSave");
      location.reload();
    }
  },
};
