import { world } from "../core/ecs";
import { ZONES, NATURAL, type ZoneId } from "../config/constants";
import Decimal from "decimal.js";
import { gameLoop } from "../core/loop";
import { gameState } from "../core/gameState";
import { BUILDINGS, BUILDING_INFO } from "../config/buildings";
import { RESOURCE_PRICES } from "../config/prices";
import { RESOURCES } from "../config/resources";
import { getTile } from "../core/grid";
import { createNaturalResource } from "../entities/createNaturalResource"; // Added import

const producers = world.with("producer", "inventory");
const storages = world.with("building", "inventory");

// Helper: Check for Adjacent Natural Resources
function getAdjacencyMultiplier(
  zone: ZoneId,
  x: number,
  y: number,
  buildingType: string,
): number {
  let multiplier = 1;

  // Define Bonuses
  // Logging Camp -> Tree (x2)
  // Quarry / Mason -> Rock (x2)
  // Farm / Dock -> River (x2)

  const targetNatural =
    buildingType === BUILDINGS.LOGGING_CAMP
      ? NATURAL.TREE
      : buildingType === BUILDINGS.QUARRY ||
          buildingType === BUILDINGS.STONE_MASON
        ? NATURAL.ROCK
        : buildingType === BUILDINGS.FARM_FIELD ||
            buildingType === BUILDINGS.FOREST_DOCK
          ? NATURAL.RIVER
          : null;

  if (!targetNatural) return 1;

  const neighbors = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  for (const n of neighbors) {
    // We look for entities in the grid that have 'natural' property == targetNatural
    // BUT, getTile returns the Topmost entity.
    // If the Tree is a blocker, it should be in the grid.
    // However, if we built NEXT to it, the Tree tile should have the Tree entity.

    const ent = getTile(zone, x + n.dx, y + n.dy);
    if (ent && (ent as any).natural === targetNatural) {
      multiplier *= 2;
    }
  }

  return multiplier;
}

export function initResourceSystem() {
  gameLoop.addLogicSystem(ResourceSystem);
  console.log("ResourceSystem Initialized");
}

function calculateMaxPopulation() {
  let pop = 0;
  const houses = world.with("building");
  for (const ent of houses) {
    const info = BUILDING_INFO[ent.building.type];
    if (info && info.housing) {
      let housing = info.housing;
      // Scale by Level? Usually housing scales with level.
      // If Town Hall level 1 = 5, Level 2 = 10?
      if (ent.building.level > 1) {
        housing += (ent.building.level - 1) * 5;
      }
      pop += housing;
    }
  }
  return pop;
}

function ResourceSystem(dt: number) {
  // Recalculate Max Pop
  gameState.maxPopulation = calculateMaxPopulation();

  // Reset production rates for this frame calculation
  gameState.productionRates = {};

  // 1. Production
  for (const entity of producers) {
    if (!gameState.productionRates[entity.zoneId as string]) {
      gameState.productionRates[entity.zoneId as string] = new Map();
    }
    const rates = gameState.productionRates[entity.zoneId as string];

    const { resourceType, rate, inputResource, inputRate, isPaused } =
      entity.producer;

    if (isPaused) continue;

    let multiplier = new Decimal(1);

    // Tech Multiplier (Industrial Efficiency)
    const levels = gameState.techLevels["industrial_efficiency"] || 0;
    if (levels > 0) {
      multiplier = multiplier.mul(1 + levels * 0.1);
    }

    // Prestige Multiplier (Golden Age)
    const prestigeLevel = gameState.prestigeUpgrades["production_boost"] || 0;
    if (prestigeLevel > 0) {
      multiplier = multiplier.mul(1 + prestigeLevel * 0.25);
    }

    // Adjacency Multiplier
    if (entity.gridPosition && entity.building) {
      const adj = getAdjacencyMultiplier(
        entity.zoneId as ZoneId,
        entity.gridPosition.x,
        entity.gridPosition.y,
        entity.building.type,
      );
      if (adj > 1) {
        multiplier = multiplier.mul(adj);
      }
    }

    const productionPerSec = rate.mul(multiplier).toNumber();
    rates.set(resourceType, (rates.get(resourceType) || 0) + productionPerSec);

    if (inputResource && inputRate) {
      const consumptionPerSec = inputRate.toNumber(); // Input usually static, but could scale?
      rates.set(
        inputResource,
        (rates.get(inputResource) || 0) - consumptionPerSec,
      );
    }

    // --- Input Logic ---
    // Input comes from LOCAL ZONE stash
    if (inputResource && inputRate) {
      const required = inputRate.mul(dt);
      // Check local zone
      const z = (entity.zoneId as ZoneId) || gameState.activeZone;
      const available = gameState.getResource(z, inputResource);

      if (available.gte(required)) {
        // Consume
        gameState.consumeResource(z, inputResource, required);
      } else {
        // Not enough input!
        if (available.gt(0)) {
          // Partial production
          multiplier = available.div(required);
          gameState.consumeResource(z, inputResource, available);
        } else {
          multiplier = new Decimal(0); // Stop
        }
      }
    }

    if (multiplier.gt(0)) {
      const amount = rate.mul(dt).mul(multiplier);

      // Special Case: Money/Credits goes directly to global wallet
      if (resourceType === "money") {
        gameState.addCredits(amount);
        // We also log it to rates for UI to show "Money +X/sec"
        rates.set(
          "money",
          (rates.get("money") || 0) + amount.div(dt).toNumber(),
        );
      } else {
        if (!entity.inventory.has(resourceType)) {
          entity.inventory.set(resourceType, new Decimal(0));
        }

        const current = entity.inventory.get(resourceType)!;
        entity.inventory.set(resourceType, current.add(amount));
      }
    }
  }

  // 2. Automated Shipping (Entity -> Local Zone Stash)
  // Instantly move produced goods to the Zone's shared inventory
  for (const entity of storages) {
    const z = (entity.zoneId as ZoneId) || gameState.activeZone;

    for (const [res, amount] of entity.inventory) {
      if (amount.gt(0)) {
        gameState.addResource(z, res, amount);
        entity.inventory.set(res, new Decimal(0));
      }
    }
  }

  // 3. Population Consumption & Growth
  const FOOD_CONSUMPTION = 0.05; // bread per person per second
  const consumption = new Decimal(
    gameState.totalPopulation * FOOD_CONSUMPTION * dt,
  );

  // Food comes from City Storage
  const availableFood = gameState.getResource(ZONES.CITY, RESOURCES.BREAD);

  // Bootstrap: If pop < 1, allow free growth to 1
  if (
    gameState.totalPopulation < 1 &&
    gameState.totalPopulation < gameState.maxPopulation
  ) {
    gameState.totalPopulation += 0.2 * dt;
  } else if (consumption.gt(0)) {
    if (availableFood.gte(consumption)) {
      // Eat
      gameState.consumeResource(ZONES.CITY, RESOURCES.BREAD, consumption);

      // Grow
      if (gameState.totalPopulation < gameState.maxPopulation) {
        const growthRate = 0.5;
        gameState.totalPopulation += growthRate * dt;
      }
    } else {
      // Starve (Insufficient Food)
      if (availableFood.gt(0)) {
        gameState.consumeResource(ZONES.CITY, RESOURCES.BREAD, availableFood);
      }
      // Decay population
      const decay = Math.max(0.1, gameState.totalPopulation * 0.1) * dt;
      gameState.totalPopulation = Math.max(
        0,
        gameState.totalPopulation - decay,
      );
    }
  }

  // Hard Cap
  if (gameState.totalPopulation > gameState.maxPopulation) {
    gameState.totalPopulation = gameState.maxPopulation;
  }

  // 4. Marketplace Auto-Sell
  let marketCount = 0;
  for (const entity of world.with("building")) {
    if (
      entity.building.type === BUILDINGS.MARKETPLACE &&
      entity.zoneId === ZONES.CITY
    ) {
      marketCount++;
    }
  }

  if (marketCount > 0) {
    let capacity = new Decimal(marketCount * 5 * dt); // Sell 5 items per market per sec

    const cityRes = gameState.resources[ZONES.CITY];
    const resourceLimit = 200;

    for (const [res, amount] of cityRes) {
      if (res === RESOURCES.TECH_POINTS || res === RESOURCES.BREAD) continue; // Don't sell Food or Science

      if (amount.gt(resourceLimit)) {
        const toSell = Decimal.min(amount.sub(resourceLimit), capacity);

        if (toSell.gt(0)) {
          gameState.consumeResource(ZONES.CITY, res, toSell);
          capacity = capacity.sub(toSell);

          const price = RESOURCE_PRICES[res] || 0.1;
          gameState.credits = gameState.credits.add(toSell.mul(price));

          if (capacity.lte(0)) break;
        }
      }
    }
  }

  // 5. Nature Respawn Logic
  checkNatureRespawn(dt);
}

let natureTimer = 0;
function checkNatureRespawn(dt: number) {
  natureTimer += dt;
  if (natureTimer < 10) return; // Check every 10 seconds
  natureTimer = 0;

  const zonesToCheck = [ZONES.FOREST, ZONES.MOUNTAIN, ZONES.FARM];
  const natureBonus = (gameState.prestigeUpgrades["nature_abundance"] || 0) * 2;
  const baseCap = 5;
  const cap = baseCap + natureBonus;

  zonesToCheck.forEach((zone) => {
    // Count Existing
    let count = 0;
    const naturals = world.with("natural", "zoneId");
    for (const n of naturals) {
      if (n.zoneId === zone) count++;
    }

    const W = gameState.worldWidth;
    const H = gameState.worldHeight;

    // FARM: Linear River Logic
    if (zone === ZONES.FARM) {
      // Only spawn if no river exists
      if (count > 0) return;

      // Build Occupancy Map
      const occupiedMap = new Set<string>();
      const zoneEntities = world.with("gridPosition", "zoneId");
      for (const e of zoneEntities) {
        if (e.zoneId === zone && (e.building || e.natural)) {
          occupiedMap.add(`${e.gridPosition.x},${e.gridPosition.y}`);
        }
      }

      const minLen = Math.max(1, Math.ceil(W / 3));
      let maxLen = Math.floor(W / 2);
      if (maxLen < minLen) maxLen = minLen; // Safety

      // Try lengths descending
      for (let len = maxLen; len >= 1; len--) {
        const candidates: { x: number; y: number; dx: number; dy: number }[] =
          [];

        // Horizontal Scan
        for (let y = 0; y < H; y++) {
          for (let x = 0; x <= W - len; x++) {
            let valid = true;
            for (let k = 0; k < len; k++) {
              if (occupiedMap.has(`${x + k},${y}`)) {
                valid = false;
                break;
              }
            }
            if (valid) candidates.push({ x, y, dx: 1, dy: 0 });
          }
        }

        // Vertical Scan
        for (let x = 0; x < W; x++) {
          for (let y = 0; y <= H - len; y++) {
            let valid = true;
            for (let k = 0; k < len; k++) {
              if (occupiedMap.has(`${x},${y + k}`)) {
                valid = false;
                break;
              }
            }
            if (valid) candidates.push({ x, y, dx: 0, dy: 1 });
          }
        }

        if (candidates.length > 0) {
          const choice =
            candidates[Math.floor(Math.random() * candidates.length)];
          for (let k = 0; k < len; k++) {
            createNaturalResource(
              zone,
              choice.x + k * choice.dx,
              choice.y + k * choice.dy,
              NATURAL.RIVER,
            );
          }
          console.log(`Spawned River len ${len} in FARM`);
          return; // Spawning complete
        }
      }
      return; // No space
    }

    // OTHER ZONES: Random Scatter
    if (count < cap) {
      // Try 5 random spots
      for (let i = 0; i < 5; i++) {
        const rx = Math.floor(Math.random() * W);
        const ry = Math.floor(Math.random() * W);

        // Check if occupied by Building or Natural
        // We can query specific coords
        const occupied = world
          .with("gridPosition", "zoneId")
          .where(
            (e) =>
              e.zoneId === zone &&
              e.gridPosition.x === rx &&
              e.gridPosition.y === ry &&
              (!!e.building || !!e.natural),
          ).first;

        if (!occupied) {
          // Determine type
          let type: string = NATURAL.TREE;
          if (zone === ZONES.MOUNTAIN) type = NATURAL.ROCK;

          createNaturalResource(zone, rx, ry, type);
          console.log(`Respawned ${type} in ${zone} at ${rx},${ry}`);
          break; // Spawned 1, move to next zone
        }
      }
    }
  });
}
