import { gameLoop } from "../core/loop";
import { gameState } from "../core/gameState";
import { world } from "../core/ecs";
import { BUILDINGS } from "../config/buildings";
import { RESOURCES } from "../config/resources";

export function initMarketSystem() {
  gameLoop.addLogicSystem(MarketSystem);
}

function MarketSystem(_dt: number) {
  // Check if Marketplace Exists
  const markets = world
    .with("building")
    .where((e) => e.building.type === BUILDINGS.MARKETPLACE);
  if (markets.entities.length === 0) return;

  // Refresh offers every 30s
  const now = Date.now();
  if (now - gameState.lastOfferUpdate > 30000) {
    // 30s
    generateOffers();
    gameState.lastOfferUpdate = now;
  }
}

function generateOffers() {
  // Determine Market Level (Max of all markets)
  let marketLevel = 1;
  const markets = world
    .with("building")
    .where((e) => e.building.type === BUILDINGS.MARKETPLACE);
  for (const ent of markets) {
    if (ent.building.level > marketLevel) marketLevel = ent.building.level;
  }

  gameState.marketOffers = [];

  // Level Scaling Logic
  // Lvl 1: 3-5 offers. Each upgrade +2.
  // Lvl 1 Min: 3. Lvl 1 Max: 3 + rand(3) = 3 to 5?
  // User requested "Each upgrade gives +2 offers"
  // Base = 3.
  // Count = 3 + ((marketLevel - 1) * 2) + rand(2);

  const baseCount = 3 + (marketLevel - 1) * 2;
  const count = baseCount + Math.floor(Math.random() * 2);

  const resources: string[] = [
    RESOURCES.WOOD,
    RESOURCES.STONE,
    RESOURCES.PLANKS,
    RESOURCES.BRICKS,
    RESOURCES.WHEAT,
    RESOURCES.FLOUR,
    RESOURCES.BREAD,
  ];

  for (let i = 0; i < count; i++) {
    const res = resources[Math.floor(Math.random() * resources.length)];
    const isBuying = Math.random() > 0.5; // Merchant is Buying (Player Sells)

    // Amount Scaling
    // "on level 1 user gets 100-1000"
    // "increase offers values from smaller to a bit larger than before"
    // Min = 100 * Level
    // Max = 1000 * Level

    const minAmt = 100 * marketLevel;
    const maxAmt = 1000 * marketLevel;

    const amount = minAmt + Math.floor(Math.random() * (maxAmt - minAmt));

    // Cap by player stock ONLY if selling?
    // User asked for "start with small amounts... so on level 1 user gets 100-1000".
    // They didn't ask to cap by stock, but it's physically impossible to sell what you don't have.
    // However, the *offer* can exist even if you can't fulfill it yet.
    // Showing "Sell 1000 Wood" when you have 500 motivates you to get more wood.
    // So I will NOT cap generation by stock, but the "Sell" button logic (in UI) handle the check.

    // Simple Base Price
    let basePrice = 1;
    if (
      (
        [RESOURCES.PLANKS, RESOURCES.BRICKS, RESOURCES.FLOUR] as string[]
      ).includes(res)
    )
      basePrice = 4;
    if (([RESOURCES.BREAD] as string[]).includes(res)) basePrice = 8;

    const totalVal = amount * basePrice;

    // Random Variance
    const modifier = 0.7 + Math.random() * 0.6; // 0.7 to 1.3

    const cost = Math.max(1, Math.floor(totalVal * modifier));

    gameState.marketOffers.push({
      id: Date.now() + i,
      resource: res,
      amount,
      cost,
      isBuying,
    });
  }
}
