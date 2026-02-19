import { ZONES, type ZoneId } from "../config/constants";
import type { BuildingId } from "../config/buildings";
import type { Entity } from "./ecs";
import { RESOURCES } from "../config/resources";
import Decimal from "decimal.js";

export interface MerchantOffer {
  id: number;
  resource: string;
  amount: number;
  cost: number;
  isBuying: boolean; // true = merchant buys from player
}

class GameState {
  // View State
  public activeZone: ZoneId = ZONES.CITY;
  public selectedBuilding: BuildingId | "DESTROY" | "MOVE" | null = null;
  public selectedEntityId: number | null = null; // ID of clicked entity for inspection
  public moveSourceParams: { x: number; y: number; entity: Entity } | null =
    null; // Storing source of move

  public get worldWidth(): number {
    const bonus = this.prestigeUpgrades["land_expansion"] || 0;
    return 10 + bonus;
  }

  public get worldHeight(): number {
    return this.worldWidth; // Square grid for now
  }

  // Global Economy
  public credits: Decimal = new Decimal(1000);
  public techPoints: Decimal = new Decimal(0);
  public unlockedTechs: Set<string> = new Set();
  public techLevels: Record<string, number> = {}; // Track repeatable tech levels

  // Prestige
  public prestigeCurrency: Decimal = new Decimal(0); // "Amber"
  public lifetimeAmber: Decimal = new Decimal(0); // Total Amber ever gained
  public lifetimeEarnings: Decimal = new Decimal(0); // For calculating prestige gain
  public prestigeUpgrades: Record<string, number> = {}; // { "upgrade_id": level }

  // Market
  public marketOffers: MerchantOffer[] = [];
  public lastOfferUpdate: number = 0;

  // Population
  public totalPopulation: number = 0; // Current people (grows to max)
  public maxPopulation: number = 0; // Housing Capacity (Provided by Town Hall)

  // Workforce (Global Pool)
  public employed: number = 0;

  // Zone Resources (Local Inventory)
  // Map<ResourceType, Amount> keyed by ZoneId
  public resources: Record<string, Map<string, Decimal>> = {
    [ZONES.CITY]: new Map([[RESOURCES.BREAD, new Decimal(1000)]]),
    [ZONES.FOREST]: new Map(),
    [ZONES.MOUNTAIN]: new Map(),
    [ZONES.FARM]: new Map(),
  };

  // Per-Resource Rates (Recalculated periodically for UI)
  public productionRates: Record<string, Map<string, number>> = {};

  // Transport
  public truckCapacity: number = 5;

  // Route Definition
  public routes: Array<{
    id: number;
    from: ZoneId;
    to: ZoneId;
    resource: string;
    active: boolean; // if enough trucks
    targetAmount: number; // 0 = Infinite, >0 = Move this specific amount
    movedAmount: Decimal; // Track progress
    throughput?: number; // Actual moved per sec
  }> = [];

  public autoSellRoutes: Array<{
    id: number;
    zone: ZoneId;
    resource: string;
    keepAmount: number; // Sell everything above this
    active: boolean;
  }> = [];

  constructor() { }

  public switchZone(zone: ZoneId) {
    this.activeZone = zone;
    // console.log(`Switched to zone: ${zone}`);
  }

  public addCredits(amount: Decimal) {
    if (amount.gt(0)) {
      this.lifetimeEarnings = this.lifetimeEarnings.plus(amount);
    }
    this.credits = this.credits.plus(amount);
    // console.log(`Credits: ${this.credits.toString()}`);
  }

  public getResource(zone: ZoneId, type: string): Decimal {
    const zoneMap = this.resources[zone];
    return zoneMap?.get(type) || new Decimal(0);
  }

  public addResource(zone: ZoneId, type: string, amount: Decimal) {
    const zoneMap = this.resources[zone];
    if (!zoneMap) return;

    const current = zoneMap.get(type) || new Decimal(0);
    zoneMap.set(type, current.plus(amount));
  }

  public hasResource(zone: ZoneId, type: string, amount: Decimal): boolean {
    return this.getResource(zone, type).gte(amount);
  }

  public consumeResource(zone: ZoneId, type: string, amount: Decimal): boolean {
    if (!this.hasResource(zone, type, amount)) return false;

    const zoneMap = this.resources[zone];
    const current = zoneMap.get(type)!;
    zoneMap.set(type, current.minus(amount));
    return true;
  }
}

export const gameState = new GameState();
