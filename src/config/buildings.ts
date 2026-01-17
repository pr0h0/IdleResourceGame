import { RESOURCES } from "./resources";
import { ZONES } from "./constants";

export const BUILDINGS = {
  // Outposts
  LOGGING_CAMP: "logging_camp",
  SAWMILL: "sawmill",
  QUARRY: "quarry",
  FARM_FIELD: "farm_field",

  // Logistics
  FOREST_DOCK: "forest_dock", // Maybe deprecated? Or use as depot?
  TRANSPORT_DEPOT: "transport_depot",
  CITY_DEPOT: "city_depot",

  // City
  TOWN_HALL: "town_hall",
  TENEMENT: "tenement",

  // Processing
  STONE_MASON: "stone_mason",
  WINDMILL: "windmill",
  BAKERY: "bakery",
  RESEARCH_LAB: "research_lab",
  MARKETPLACE: "marketplace",
} as const;

export type BuildingId = (typeof BUILDINGS)[keyof typeof BUILDINGS];

// Definitions
export interface BuildingDef {
  name: string;
  description?: string;
  unlockReq?: string;
  cost: Partial<Record<string, number>>;
  upgradeCost?: Partial<Record<string, number>>; // Additional costs for leveling up
  workers?: number; // Jobs required
  housing?: number; // Beds provided
  output: { resource: string; rate: number } | null;
  input?: { resource: string; rate: number } | null;
  storage?: boolean; // Tag identifying it as a pickup point
  validZones: string[];
}

export const BUILDING_INFO: Record<string, BuildingDef> = {
  [BUILDINGS.LOGGING_CAMP]: {
    name: "Logging Camp",
    cost: { money: 100 },
    upgradeCost: { [RESOURCES.WOOD]: 50 },
    workers: 2,
    output: { resource: RESOURCES.WOOD, rate: 1 }, // 1 per sec
    validZones: [ZONES.FOREST],
  },
  [BUILDINGS.SAWMILL]: {
    name: "Sawmill",
    unlockReq: "woodworking",
    cost: { money: 200, [RESOURCES.WOOD]: 100 },
    upgradeCost: { [RESOURCES.PLANKS]: 50 },
    workers: 3,
    input: { resource: RESOURCES.WOOD, rate: 2 },
    output: { resource: RESOURCES.PLANKS, rate: 1 },
    validZones: [ZONES.FOREST],
  },
  [BUILDINGS.TRANSPORT_DEPOT]: {
    name: "Truck Depot",
    description:
      "Hub for logistics. Upgrade to increase Fleet Size (+2 Trucks) and Speed (+20%).",
    unlockReq: "logistics",
    cost: { money: 100 },
    upgradeCost: {
      [RESOURCES.WOOD]: 100,
      [RESOURCES.STONE]: 100,
      [RESOURCES.PLANKS]: 50,
    }, // Harder to upgrade
    workers: 5,
    output: null,
    storage: true, // Tag as having transporters
    validZones: [ZONES.CITY, ZONES.FOREST, ZONES.MOUNTAIN, ZONES.FARM],
  },
  [BUILDINGS.TOWN_HALL]: {
    name: "Town Hall",
    description: "Administrative center. Provides basic housing.",
    cost: { money: 0 }, // Free / Pre-built
    upgradeCost: { money: 500, [RESOURCES.WOOD]: 200, [RESOURCES.STONE]: 100 },
    housing: 5,
    output: null,
    validZones: [ZONES.CITY],
  },
  [BUILDINGS.QUARRY]: {
    name: "Quarry",
    cost: { money: 200 },
    upgradeCost: { [RESOURCES.WOOD]: 100, [RESOURCES.STONE]: 100 },
    workers: 5,
    output: { resource: RESOURCES.STONE, rate: 0.5 },
    validZones: [ZONES.MOUNTAIN],
  },
  [BUILDINGS.FOREST_DOCK]: {
    name: "Forest Dock",
    cost: { money: 500, [RESOURCES.WOOD]: 100 },
    workers: 1, // Storekeeper
    output: { resource: "money", rate: 1 }, // Trading
    storage: true,
    validZones: [ZONES.FOREST],
  },
  [BUILDINGS.TENEMENT]: {
    name: "Tenement",
    cost: { money: 150 },
    housing: 5, // Provides 5 pop
    output: null,
    validZones: [ZONES.CITY],
  },
  [BUILDINGS.FARM_FIELD]: {
    name: "Wheat Field",
    cost: { money: 50 },
    workers: 1,
    output: { resource: RESOURCES.WHEAT, rate: 2 },
    validZones: [ZONES.FARM],
  },

  // --- Processing ---
  [BUILDINGS.STONE_MASON]: {
    name: "Stone Mason",
    unlockReq: "masonry",
    cost: { money: 300, [RESOURCES.STONE]: 50 },
    workers: 3,
    input: { resource: RESOURCES.STONE, rate: 2 },
    output: { resource: RESOURCES.BRICKS, rate: 1 },
    validZones: [ZONES.MOUNTAIN],
  },
  [BUILDINGS.WINDMILL]: {
    name: "Windmill",
    unlockReq: "agriculture",
    cost: { money: 200, [RESOURCES.WOOD]: 50, [RESOURCES.WHEAT]: 50 },
    workers: 2,
    input: { resource: RESOURCES.WHEAT, rate: 4 },
    output: { resource: RESOURCES.FLOUR, rate: 2 },
    validZones: [ZONES.FARM],
  },
  [BUILDINGS.BAKERY]: {
    name: "Bakery",
    unlockReq: "food_processing",
    cost: {
      money: 400,
      [RESOURCES.WOOD]: 100,
      [RESOURCES.STONE]: 50,
      [RESOURCES.FLOUR]: 20,
    },
    workers: 3,
    input: { resource: RESOURCES.FLOUR, rate: 2 },
    output: { resource: RESOURCES.BREAD, rate: 2 }, // Efficient food production
    validZones: [ZONES.CITY],
  },
  [BUILDINGS.RESEARCH_LAB]: {
    name: "Research Lab",
    description: "Generates Tech Points.",
    cost: { money: 500, [RESOURCES.WOOD]: 100 },
    workers: 2,
    output: { resource: RESOURCES.TECH_POINTS, rate: 1 },
    validZones: [ZONES.CITY],
  },
  [BUILDINGS.MARKETPLACE]: {
    name: "Marketplace",
    description: "Trade resources.",
    cost: { money: 1000, [RESOURCES.BRICKS]: 50, [RESOURCES.PLANKS]: 50 },
    upgradeCost: { money: 500, [RESOURCES.WOOD]: 200, [RESOURCES.STONE]: 200 },
    workers: 2,
    output: null,
    unlockReq: "economics",
    validZones: [ZONES.CITY],
  },
};
