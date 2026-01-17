import { Pane } from "tweakpane";
import { world } from "../core/ecs";
import { RESOURCES } from "../config/resources";
import { gameState } from "../core/gameState";

export function initDebugUI() {
  const pane = new Pane({ title: "Debug Controls" });

  // Global Stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const folder = (pane as any).addFolder({ title: "Game State" });
  folder.addBinding(gameState, "activeZone", { readonly: true });

  // Monitor First Producer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const btn = (pane as any).addButton({ title: "Log Producer Inventory" });
  btn.on("click", () => {
    const producers = world.with("producer", "inventory");
    for (const p of producers) {
      console.log("Entity Inventory:", Object.fromEntries(p.inventory));
      // rough convert for log
      p.inventory.forEach((val, key) => {
        console.log(`${key}: ${val.toFixed(2)}`);
      });
    }
  });

  // Auto-update Monitor
  // Removed problematic binding that was causing buffer errors in Tweakpane 4.x

  // Better way: Bind to a proxy object that updates
  const debugStats = { flowWood: 0.0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pane as any).addBinding(debugStats, "flowWood", {
    readonly: true,
    label: "Camp Wood",
  });

  setInterval(() => {
    const p = world.with("producer", "inventory").first;
    if (p && p.inventory.has(RESOURCES.WOOD)) {
      debugStats.flowWood = p.inventory.get(RESOURCES.WOOD)!.toNumber();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pane as any).refresh();
    }
  }, 500);
}
