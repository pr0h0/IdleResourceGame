export interface TechDef {
  id: string;
  name: string;
  description: string;
  cost: number; // Tech Points
  req?: string; // Prerequisite Tech ID
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
  industrial_efficiency: {
    id: "industrial_efficiency",
    name: "Industrial Efficiency",
    description: "+10% Global Production (Repeatable).",
    cost: 200,
  },
};
