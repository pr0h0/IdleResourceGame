import { gameLoop } from "../core/loop";
import { world, type Entity } from "../core/ecs";
import { gameState } from "../core/gameState";
import { BUILDING_INFO } from "../config/buildings";
import Decimal from "decimal.js";
import { refreshInspectorUI } from "../render/UISystem";

export function initAutoUpgradeSystem() {
  // Check every 1 second (approx 60 ticks) to avoid performance spam
  gameLoop.addLogicSystem(AutoUpgradeSystem);
  console.log("AutoUpgradeSystem Initialized");
}

let timer = 0;
const INTERVAL = 1.0; // Seconds

function AutoUpgradeSystem(dt: number) {
  timer += dt;
  if (timer < INTERVAL) return;
  timer = 0;

  // Query Entities with Auto-Upgrade Target
  const candidates = world.with("building");

  for (const entity of candidates) {
    if (!entity.building) continue;
    const { level, autoUpgradeTarget, type } = entity.building;

    // Check if Auto Upgrade is active for this entity
    if (!autoUpgradeTarget || autoUpgradeTarget <= level) continue;

    // Check Info
    const info = BUILDING_INFO[type as keyof typeof BUILDING_INFO];
    if (!info) continue;

    // Calculate Costs for Next Level
    const costMult = Math.pow(1.5, level);
    const totalCosts: Record<string, number> = {};

    for (const [res, amt] of Object.entries(info.cost)) {
      totalCosts[res] = Math.floor((amt as number) * costMult);
    }
    if (info.upgradeCost) {
      for (const [res, amt] of Object.entries(info.upgradeCost)) {
        const extra = Math.floor((amt as number) * costMult);
        totalCosts[res] = (totalCosts[res] || 0) + extra;
      }
    }

    // Check Affordability
    let canAfford = true;

    // 1. Check Population
    if (info.workers) {
      const freePop = gameState.totalPopulation - gameState.employed;
      if (freePop < info.workers) {
        canAfford = false;
      }
    }

    // 2. Check Resources
    if (canAfford) {
      for (const [res, amt] of Object.entries(totalCosts)) {
        if (res === "money") {
          if (gameState.credits.lt(amt)) {
            canAfford = false;
            break;
          }
        } else {
          const have = gameState.getResource((entity.zoneId as any) || gameState.activeZone, res);
          if (have.lt(amt)) {
            canAfford = false;
            break;
          }
        }
      }
    }

    if (canAfford) {
      performAutoUpgrade(entity, info, totalCosts);
    }
  }
}

function performAutoUpgrade(entity: Entity, info: any, costs: Record<string, number>) {
  // 1. Pay
  for (const [res, amt] of Object.entries(costs)) {
    if (res === "money") {
      gameState.addCredits(new Decimal(-amt));
    } else {
      gameState.consumeResource((entity.zoneId as any) || gameState.activeZone, res, new Decimal(amt));
    }
  }

  // 2. Upgrade
  if (!entity.building) return;
  entity.building.level += 1;
  const newLevel = entity.building.level;

  // Check if goal reached
  if (entity.building.autoUpgradeTarget && newLevel >= entity.building.autoUpgradeTarget) {
    entity.building.autoUpgradeTarget = undefined;
  }

  // 3. Effect (Update Components)
  if (entity.producer) {
    // Output: 1.5^(L-1)
    if (info.output) {
      const baseRate = new Decimal(info.output.rate);
      const newRate = baseRate.mul(Math.pow(1.5, newLevel - 1));
      entity.producer.rate = newRate;
    }

    // Input: 1.25^(L-1)
    if (info.input) {
      const baseIn = new Decimal(info.input.rate);
      const newIn = baseIn.mul(Math.pow(1.25, newLevel - 1));
      entity.producer.inputRate = newIn;
    }
  }

  // 4. Update Visual (Level Badge)
  if (entity.sprite && entity.sprite.children) {
    const lbl = entity.sprite.children.find((c: any) => c.label === "LevelLabel");
    if (lbl && (lbl as any).text !== undefined) {
      (lbl as any).text = newLevel.toString();
      (lbl as any).visible = newLevel > 1; // Only show if > 1
    }
  }

  // Refresh UI if this entity is selected
  if (gameState.selectedEntityId === entity.id) {
    refreshInspectorUI();
  }
}
