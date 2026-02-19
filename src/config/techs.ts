export interface TechDef {
  id: string;
  name: string;
  description: string;
  cost: number; // Tech Points
  req?: string; // Prerequisite Tech ID
  repeatable?: boolean;
}

export const TECHS: Record<string, TechDef> = {
  woodworking: {
    id: "woodworking",
    name: "Woodworking",
    description: "Better wood processing. Unlocks Sawmill.",
    cost: 10,
  },
  masonry: {
    id: "masonry",
    name: "Masonry",
    description: "Stone processing. Unlocks Stone Mason.",
    cost: 20,
  },
  agriculture: {
    id: "agriculture",
    name: "Agriculture",
    description: "Refined food. Unlocks Windmill.",
    cost: 30,
  },
  food_processing: {
    id: "food_processing",
    name: "Baking",
    description: "Efficient food. Unlocks Bakery.",
    cost: 50,
    req: "agriculture",
  },
  economics: {
    id: "economics",
    name: "Economics",
    description: "Trade. Unlocks Marketplace.",
    cost: 100,
  },
  logistics: {
    id: "logistics",
    name: "Logistics",
    description: "Organized transport. Unlocks Truck Depot.",
    cost: 150,
  },
  advanced_logistics: {
    id: "advanced_logistics",
    name: "Heavy Duty",
    description: "Trucks carry +5 items.",
    cost: 300,
    req: "logistics",
  },
  auto_trade: {
    id: "auto_trade",
    name: "Auto-Trade",
    description:
      "Automatically sell excess resources. Configurable in Logistics.",
    cost: 250,
    req: "economics",
  },
  "research_speed": {
    id: "research_speed",
    name: "Research Speed",
    description: "Research Labs work 20% faster. (Repeatable).",
    cost: 300,
    repeatable: true,
  },
  auto_upgrade: {
    id: "auto_upgrade",
    name: "Auto-Upgrade",
    description: "Automatically upgrade buildings to target level.",
    cost: 500,
    req: "logistics",
  },
  industrial_efficiency: {
    id: "industrial_efficiency",
    name: "Industrial Efficiency",
    description: "+10% Global Production (Repeatable).",
    repeatable: true,
    cost: 200,
  },
  reinforced_tools: {
    id: "reinforced_tools",
    name: "Reinforced Tools",
    description: "Logging Camps and Quarries produce 50% more.",
    cost: 150,
    req: "masonry",
  },
  warehousing: {
    id: "warehousing",
    name: "Warehousing",
    description: "Increases Marketplace Auto-Sell limit by 100 per level. (Repeatable).",
    cost: 400,
    repeatable: true,
  },
  urban_planning: {
    id: "urban_planning",
    name: "Urban Planning",
    description: "Houses provide +2 Max Population per level. (Repeatable).",
    cost: 600,
    req: "economics",
    repeatable: true,
  },
};
