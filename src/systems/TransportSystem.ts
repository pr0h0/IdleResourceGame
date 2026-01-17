import { gameLoop } from "../core/loop";
import { gameState } from "../core/gameState";
import { world } from "../core/ecs";
import { BUILDINGS } from "../config/buildings";
import Decimal from "decimal.js";

export function initTransportSystem() {
  gameLoop.addLogicSystem(TransportSystem);
  console.log("TransportSystem Initialized (Route Logic)");
}

function TransportSystem(dt: number) {
  // 1. Calculate Capacity & Speed
  const depots = world
    .with("building")
    .where((e) => e.building.type === BUILDINGS.TRANSPORT_DEPOT);

  let totalTrucks = 0;
  let totalSpeedAccumulator = 0;

  for (const ent of depots) {
    const level = ent.building.level || 1;
    // Capacity: Base 5 + 2 per extra level
    totalTrucks += 5 + (level - 1) * 2;

    // Speed: Base 10 + 20% per extra level
    // We average the speed across the fleet
    totalSpeedAccumulator += 10 * (1 + (level - 1) * 0.2);
  }

  // Average speed (default to 10 if no depots)
  const baseRate =
    depots.entities.length > 0
      ? new Decimal(totalSpeedAccumulator / depots.entities.length)
      : new Decimal(10);

  // Debug logging (throttle)
  if (Math.random() < 0.01) {
    // console.log(`Transport Debug: Trucks: ${totalTrucks}, Routes: ${gameState.routes.length}`);
  }

  let usedTrucks = 0;

  // 2. Process Routes
  for (const route of gameState.routes) {
    if (usedTrucks < totalTrucks) {
      route.active = true;
      usedTrucks++;

      // Move Goods
      // Fixed rate for now: 10 per sec (Boosted from 5)
      // const ratePerSec = new Decimal(10);
      const ratePerSec = baseRate;

      let amount = ratePerSec.mul(dt);
      let actualMoved = new Decimal(0);

      // Limit by Target Amount
      if (route.targetAmount > 0) {
        const remaining = new Decimal(route.targetAmount).sub(
          route.movedAmount || 0,
        );
        if (remaining.lte(0)) {
          // Route Done -> Mark for deletion (handled by filter below loop usually, or simple cleanup)
          route.active = false;
          continue;
        }
        if (amount.gt(remaining)) amount = remaining;
      }

      // Consume from Source
      const sourceInv = gameState.resources[route.from];
      const available = sourceInv.get(route.resource) || new Decimal(0);

      if (available.gte(amount)) {
        gameState.consumeResource(route.from, route.resource, amount);
        gameState.addResource(route.to, route.resource, amount);

        if (!route.movedAmount) route.movedAmount = new Decimal(0);
        route.movedAmount = route.movedAmount.add(amount);
        actualMoved = amount;
      } else if (available.gt(0)) {
        // Partial move
        gameState.consumeResource(route.from, route.resource, available);
        gameState.addResource(route.to, route.resource, available);

        if (!route.movedAmount) route.movedAmount = new Decimal(0);
        route.movedAmount = route.movedAmount.add(available);
        actualMoved = available;
      } else {
        actualMoved = new Decimal(0);
      }

      // Update Throughput (Simple Exponential Moving Average or just instantaneous)
      // dt is variable, so convert back to rate
      const currentRate = actualMoved.div(dt).toNumber();
      route.throughput = currentRate;
    } else {
      route.active = false;
      route.throughput = 0;
    }
  }

  // Cleanup finished routes
  gameState.routes = gameState.routes.filter(
    (r) => !(r.targetAmount > 0 && r.movedAmount?.gte(r.targetAmount)),
  );
}
