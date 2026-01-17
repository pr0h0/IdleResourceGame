import { World } from "miniplex";
import { Container } from "pixi.js";
import Decimal from "decimal.js";

// Define the components that our entities can have
export type Entity = {
  // --- Core ---
  id?: number; // purely for miniplex internal use usually, but good to have if needed
  zoneId?: string; // "city", "forest", "mountain"

  // --- Spatial ---
  position?: { x: number; y: number }; // Logic coordinates (Grid or Pixel)
  gridPosition?: { x: number; y: number }; // Explicit Grid coordinates (0-9)

  // --- Visual ---
  sprite?: Container; // Broader type to allow Graphics, Sprite, etc. Everything extends Container.

  // --- Logistics ---
  truck?: {
    speed: number;
    capacity: number;
    targetRoute?: string;
    inventory: Map<string, Decimal>;
    state:
      | "idle"
      | "moving_to_source"
      | "loading"
      | "moving_to_sink"
      | "unloading";
    targetEntity?: Entity;
    targetX: number;
    targetY: number;
  };

  // --- Production ---
  producer?: {
    resourceType: string;
    rate: Decimal; // Amount per second
    inputResource?: string; // Input required (e.g., 'wood')
    inputRate?: Decimal; // Input consumed per second
    lastSubSecondTick?: number; // Accumulator for fractional updates
    isPaused?: boolean; // User manually paused
  };

  // --- Storage ---
  inventory?: Map<string, Decimal>;

  // --- Construction ---
  building?: {
    type: string;
    level: number;
  };

  // --- Environment ---
  natural?: string; // 'tree', 'rock', 'river'
};

export const world = new World<Entity>();
