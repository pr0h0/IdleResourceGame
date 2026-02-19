import { RESOURCES } from "./resources";

export const RESOURCE_PRICES: Record<string, number> = {
  [RESOURCES.WOOD]: 1,
  [RESOURCES.STONE]: 2,
  [RESOURCES.ORE]: 3,
  [RESOURCES.WHEAT]: 1,

  [RESOURCES.PLANKS]: 5,
  [RESOURCES.BRICKS]: 8,
  [RESOURCES.STEEL]: 15,
  [RESOURCES.FLOUR]: 4,
  [RESOURCES.BREAD]: 10,

  [RESOURCES.SUPPLY_CRATE]: 50,
};

export function getSellPrice(resource: string, _gameState?: any): number {
  return RESOURCE_PRICES[resource] || 1;
}
