import { world } from "../core/ecs";
import { gameState } from "../core/gameState";
import Decimal from "decimal.js";
import { type ZoneId } from "../config/constants";

export function calculateZoneRates(zoneId: ZoneId) {
  const stats: Record<
    string,
    {
      amount: Decimal;
      production: number;
      consumption: number;
      transportIn: number;
      transportOut: number;
      net: number;
    }
  > = {};

  // Initialize with existing resources
  const inv = gameState.resources[zoneId];
  if (inv) {
    for (const [res, amount] of inv) {
      stats[res] = {
        amount,
        production: 0,
        consumption: 0,
        transportIn: 0,
        transportOut: 0,
        net: 0,
      };
    }
  }

  // 1. Producers (Actual Production logic is complex, this estimates "Potential" or uses stored rate if available)
  // To match user request "0/s if transported", we need actual rates.
  // The most accurate way is to check the `producer` component.
  // Ideally the ResourceSystem updates a 'lastTickProduction' on the entity, but we might not have that.
  // We will estimate based on active status.

  // Producers
  const producers = world
    .with("producer", "zoneId")
    .where((e) => e.zoneId === zoneId);
  for (const ent of producers) {
    // Only count if it has inputs satisfied? This requires deeper logic.
    // For estimating, assume 100% usually, or better:
    // ResourceSystem logic says: if (input) consume; if ok -> produce.
    // Let's assume full rate for UI simplicity, unless we want to simulate input check here.
    // The user specifically asked about transport masking production.

    const p = ent.producer;
    let rate = p.rate.toNumber(); // Base Rate

    // Ensure stat entry exists
    if (!stats[p.resourceType])
      stats[p.resourceType] = {
        amount: new Decimal(0),
        production: 0,
        consumption: 0,
        transportIn: 0,
        transportOut: 0,
        net: 0,
      };

    stats[p.resourceType].production += rate;

    // Input Consumption
    if (p.inputResource && p.inputRate) {
      const inRes = p.inputResource;
      const inRate = p.inputRate.toNumber();
      if (!stats[inRes])
        stats[inRes] = {
          amount: new Decimal(0),
          production: 0,
          consumption: 0,
          transportIn: 0,
          transportOut: 0,
          net: 0,
        };
      stats[inRes].consumption += inRate;
    }
  }

  // 2. Transports (Routes)
  const routes = gameState.routes.filter((r) => r.active);
  for (const r of routes) {
    const rate = r.throughput || 0;
    if (rate <= 0) continue;

    // Outgoing
    if (r.from === zoneId) {
      if (!stats[r.resource])
        stats[r.resource] = {
          amount: new Decimal(0),
          production: 0,
          consumption: 0,
          transportIn: 0,
          transportOut: 0,
          net: 0,
        };
      stats[r.resource].transportOut += rate;
    }

    // Incoming
    if (r.to === zoneId) {
      if (!stats[r.resource])
        stats[r.resource] = {
          amount: new Decimal(0),
          production: 0,
          consumption: 0,
          transportIn: 0,
          transportOut: 0,
          net: 0,
        };
      stats[r.resource].transportIn += rate;
    }
  }

  // 3. Calculate Net
  for (const key in stats) {
    const s = stats[key];
    // Net = (Prod + TransIn) - (Cons + TransOut)
    s.net = s.production + s.transportIn - (s.consumption + s.transportOut);
  }

  return stats;
}
