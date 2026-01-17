import type { Entity } from "./ecs";
import { type ZoneId } from "../config/constants";

// The single source of truth for spatial lookups
// Key: "zoneId,x,y" -> Value: Entity
export const GridLookup = new Map<string, Entity>();

export function getTileId(zoneId: ZoneId, x: number, y: number): string {
  return `${zoneId},${x},${y}`;
}

export function registerTile(entity: Entity) {
  if (entity.zoneId && entity.gridPosition) {
    const id = getTileId(
      entity.zoneId as ZoneId,
      entity.gridPosition.x,
      entity.gridPosition.y,
    );
    GridLookup.set(id, entity);
  }
}

export function unregisterTile(entity: Entity) {
  if (entity.zoneId && entity.gridPosition) {
    const id = getTileId(
      entity.zoneId as ZoneId,
      entity.gridPosition.x,
      entity.gridPosition.y,
    );
    GridLookup.delete(id);
  }
}

export function clearGrid() {
  GridLookup.clear();
}

export function getTile(
  zoneId: ZoneId,
  x: number,
  y: number,
): Entity | undefined {
  return GridLookup.get(getTileId(zoneId, x, y));
}

export function getNeighbor(
  zoneId: ZoneId,
  x: number,
  y: number,
  dx: number,
  dy: number,
): Entity | undefined {
  return getTile(zoneId, x + dx, y + dy);
}

// Dirty flag for optimizing adjacency updates
export const GridState = {
  isDirty: false,
};

export function markGridDirty() {
  GridState.isDirty = true;
}
