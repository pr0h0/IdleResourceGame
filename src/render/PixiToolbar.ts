import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  Sprite,
} from "pixi.js";
import { gameState } from "../core/gameState";
import {
  BUILDINGS,
  BUILDING_INFO,
  type BuildingId,
  type BuildingDef,
} from "../config/buildings";
import { SPRITE_MAP, drawBuildingShape } from "../entities/createBuilding";
import { ZONES, type ZoneId } from "../config/constants"; // Added ZONES
import { world } from "../core/ecs";
import {
  showTooltip,
  hideTooltip,
  inputToLabel,
  toggleTechUI,
  toggleLogisticsUI,
  toggleMarketUI,
} from "./UISystem";
// import { SaveSystem } from "../systems/SaveSystem";
import Decimal from "decimal.js";
import { toggleSettingsUI } from "./SettingsUI";
import { togglePrestigeUI } from "./PrestigeUI";
import { calculateZoneRates } from "../utils/stats"; // Import Stats Helper

const TOOLBAR_HEIGHT = 190;
const TOOLBAR_FONT = "Tahoma, Geneva, Verdana, sans-serif";
const BUTTON_WIDTH = 110;
const BUTTON_HEIGHT = 80;
const BUTTON_GAP = 10;
const PADDING = 10;

// Cursors
const CURSOR_POINTER = "url('/sprites/cursor_pointer.png'), pointer";
const CURSOR_GRAB = "url('/sprites/cursor_grab.png'), grab";
const CURSOR_GRABBING = "url('/sprites/cursor_grabbing.png'), grabbing";

// Custom Button Type
type ToolbarButton = Container & {
  toolId?: string;
  bId?: string;
  isTool?: boolean;
};

let toolbarContainer: Container;
let row2Container: Container;
let row2Mask: Graphics;
let appRef: Application;

// Scroll State
let isDragging = false;
let dragStartX = 0;
let scrollStartX = 0;
// let row2ScrollX = 0;
let maxScroll = 0;

// Track button instances to avoid full rebuilds
const buttonCache: Map<string, Container> = new Map();

export function initPixiToolbar(app: Application) {
  appRef = app;
  toolbarContainer = new Container();
  toolbarContainer.label = "UI_Toolbar";
  app.stage.addChild(toolbarContainer);

  // Row 2 Container for Scroll
  row2Container = new Container();
  row2Container.label = "Row2_Scroll";
  toolbarContainer.addChild(row2Container);

  // Mask
  row2Mask = new Graphics();
  toolbarContainer.addChild(row2Mask);
  row2Container.mask = row2Mask;

  // Initial resize
  onResize();
}

function onResize() {
  if (!toolbarContainer || !appRef) return;

  // Position at bottom
  toolbarContainer.y = Math.floor(appRef.screen.height - TOOLBAR_HEIGHT);

  // Draw Background
  let bg = toolbarContainer.getChildByLabel("ToolbarBG") as Graphics;
  if (!bg) {
    bg = new Graphics();
    bg.label = "ToolbarBG";
    toolbarContainer.addChildAt(bg, 0);
  }

  bg.clear();
  bg.rect(0, 0, appRef.screen.width, TOOLBAR_HEIGHT);
  bg.fill({ color: 0x111111, alpha: 0.95 });
  bg.stroke({ width: 1, color: 0x555555 });

  // Drag Hit Area (Row 2 Background)
  let hitArea = toolbarContainer.getChildByLabel("Row2HitArea") as Graphics;
  if (!hitArea) {
    hitArea = new Graphics();
    hitArea.label = "Row2HitArea";
    hitArea.eventMode = "static";
    hitArea.cursor = CURSOR_GRAB;
    // Insert at index 1 (Above BG=0, Below Row2Container=1->2)
    // Check if BG exists at 0? Yes.
    toolbarContainer.addChildAt(hitArea, 1);
  }
  hitArea.clear();
  hitArea.rect(0, 100, appRef.screen.width, 90);
  hitArea.fill({ color: 0x000000, alpha: 0.001 }); // Invisible interactive

  // Input Handling for Background (Click blocking & Scrolling)
  // We attach to toolbarContainer to capture events bubbled from buttons too
  toolbarContainer.eventMode = "static";

  // Clean listeners
  toolbarContainer.removeAllListeners();

  toolbarContainer.on("pointerdown", (e) => {
    // Only care if in bottom area
    const local = e.data.getLocalPosition(toolbarContainer);
    if (local.y > 100) {
      // Just track start
      isDragging = false; // Reset
      dragStartX = e.data.global.x;
      scrollStartX = row2Container.x;

      toolbarContainer.cursor = CURSOR_GRABBING;

      toolbarContainer.on("globalpointermove", onDragMove);
      toolbarContainer.on("pointerup", onDragEnd);
      toolbarContainer.on("pointerupoutside", onDragEnd);
    }
  });

  // Update Mask
  row2Mask.clear();
  row2Mask.rect(0, 100, appRef.screen.width, 90);
  row2Mask.fill(0xffffff);

  // Rebuild content
  rebuildToolbar();
}

function onDragMove(e: any) {
  const delta = e.data.global.x - dragStartX;

  // Threshold to treat as drag
  if (Math.abs(delta) > 5) {
    isDragging = true;
  }

  if (isDragging) {
    let newX = scrollStartX + delta;

    const minX = Math.min(0, appRef.screen.width - maxScroll - PADDING * 2);
    if (newX > 0) newX = 0;
    if (newX < minX) newX = minX;

    // Round to nearest integer to prevent sub-pixel rendering blur on text
    row2Container.x = Math.round(newX);
  }
}

function onDragEnd() {
  toolbarContainer.off("globalpointermove", onDragMove);
  toolbarContainer.off("pointerup", onDragEnd);
  toolbarContainer.off("pointerupoutside", onDragEnd);

  toolbarContainer.cursor = 'auto';

  // We keep isDragging true for a frame so button tap handlers can see it
  setTimeout(() => {
    isDragging = false;
  }, 50);
}

function createGripSeparator(x: number, y: number, parent: Container) {
  const g = new Container();
  g.x = x;
  g.y = y;

  // Hit Area for grip
  const bg = new Graphics();
  bg.rect(0, 0, 15, 80);
  bg.fill({ color: 0x000000, alpha: 0.01 }); // Almost invisible hit area
  g.addChild(bg);

  // Dots
  const dots = new Graphics();
  const dotColor = 0x666666;
  dots.circle(7.5, 25, 3);
  dots.circle(7.5, 40, 3);
  dots.circle(7.5, 55, 3);
  dots.fill(dotColor);
  g.addChild(dots);

  parent.addChild(g);
}

let lastZone: string | null = null;

export function updatePixiToolbar() {
  if (!toolbarContainer) return;

  // Handle Resize Position (Cheap check)
  if (toolbarContainer.y !== appRef.screen.height - TOOLBAR_HEIGHT) {
    onResize();
  }
  const bg = toolbarContainer.getChildByLabel("ToolbarBG") as Graphics;
  if (bg && bg.width !== appRef.screen.width) {
    onResize();
  }

  // Check Zone Change
  if (gameState.activeZone !== lastZone) {
    lastZone = gameState.activeZone;
    rebuildToolbar();
  }

  // Update States (Colors, Counts)
  // Optimization: Only update if not dragging or interacting heavily?
  // Or check if state changed? 
  // For now, let's optimize updateButtonStates to NOT redraw BG if state hasn't changed.
  updateButtonStates();
}

function rebuildToolbar() {
  // Remove all buttons (keep BG, mask, row2)
  // row2Container needs to clear its own children

  // Clear Main Container (Buildings)
  const childrenToRemove = toolbarContainer.children.filter(
    (c) =>
      c.label !== "ToolbarBG" && c.label !== "Row2_Scroll" && c !== row2Mask,
  );
  toolbarContainer.removeChild(...childrenToRemove);

  // Clear Row 2
  row2Container.removeChildren();

  buttonCache.clear();

  // --- Row 1: Buildings (Upper) ---
  let r1x = PADDING;
  const r1y = 10;

  const activeZone = gameState.activeZone;

  Object.values(BUILDINGS).forEach((bId) => {
    if (bId === BUILDINGS.TOWN_HALL) return;

    const info = BUILDING_INFO[bId];
    if (!info) return;

    if (!info.validZones.includes(activeZone)) return;

    const isLocked = !!(
      info.unlockReq && !gameState.unlockedTechs.has(info.unlockReq)
    );

    createBuildingButton(bId, info, r1x, r1y, toolbarContainer, isLocked);
    r1x += BUTTON_WIDTH + BUTTON_GAP;
  });

  // --- Row 2: Controls & System (Lower) ---
  row2Container.y = 100;

  // Calculate Width
  let currentX = PADDING;

  const addParams = (w: number) => {
    currentX += w + BUTTON_GAP;
  };

  // 1. Zones
  Object.values(ZONES).forEach((z) => {
    // Add to row2Container, y=0
    createZoneButton(z as ZoneId, currentX, 0, row2Container); // Passing parent
    addParams(BUTTON_WIDTH);
  });

  // Separator
  currentX += 5; // Left margin
  createGripSeparator(currentX, 0, row2Container);
  currentX += 15 + 15; // Grip width + Right margin

  // 2. Tools
  createToolButton(
    "cursor_default", // Was "🖱️"
    null,
    "Select",
    currentX,
    0,
    BUTTON_WIDTH,
    BUTTON_HEIGHT,
    row2Container,
  );
  addParams(BUTTON_WIDTH);

  createToolButton(
    "tool_move", // Was "✋"
    "MOVE",
    "Move",
    currentX,
    0,
    BUTTON_WIDTH,
    BUTTON_HEIGHT,
    row2Container,
  );
  addParams(BUTTON_WIDTH);

  createToolButton(
    "tool_destroy", // Was "🗑️"
    "DESTROY",
    "Destroy",
    currentX,
    0,
    BUTTON_WIDTH,
    BUTTON_HEIGHT,
    row2Container,
  );
  addParams(BUTTON_WIDTH);

  // Separator
  currentX += 5;
  createGripSeparator(currentX, 0, row2Container);
  currentX += 15 + 15;

  // 3. System Buttons
  // Use BUTTON_WIDTH / BUTTON_HEIGHT
  const sysY = 0; // Align top

  // Research
  const hasLab = world
    .with("building")
    .where((e) => e.building.type === BUILDINGS.RESEARCH_LAB).first;
  createSystemButton(
    "RESEARCH",
    () => toggleTechUI(),
    currentX,
    sysY,
    BUTTON_WIDTH,
    BUTTON_HEIGHT,
    !hasLab,
    0x333333,
    row2Container,
  );
  addParams(BUTTON_WIDTH);

  // Logistics
  createSystemButton(
    "LOGISTICS",
    () => toggleLogisticsUI(),
    currentX,
    sysY,
    BUTTON_WIDTH,
    BUTTON_HEIGHT,
    false,
    0x333333,
    row2Container,
  );
  addParams(BUTTON_WIDTH);

  // Market
  const hasMarket = world
    .with("building")
    .where((e) => e.building.type === BUILDINGS.MARKETPLACE).first;
  createSystemButton(
    "MARKET",
    () => toggleMarketUI(),
    currentX,
    sysY,
    BUTTON_WIDTH,
    BUTTON_HEIGHT,
    !hasMarket,
    0x333333,
    row2Container,
  );
  addParams(BUTTON_WIDTH);

  // Prestige
  createSystemButton(
    "PRESTIGE",
    () => togglePrestigeUI(),
    currentX,
    sysY,
    BUTTON_WIDTH,
    BUTTON_HEIGHT,
    false,
    0x673ab7,
    row2Container,
  );
  addParams(BUTTON_WIDTH);

  // Settings
  createSystemButton(
    "SETTINGS",
    () => toggleSettingsUI(),
    currentX,
    sysY,
    BUTTON_WIDTH,
    BUTTON_HEIGHT,
    false,
    0x333333,
    row2Container,
  );
  addParams(BUTTON_WIDTH);

  maxScroll = currentX; // Total Width
}

// function createSystemButton(label: string, onClick: () => void, x: number, width: number = 100) {
//     const btn = new Container();
// ... (Removed unused function)
// }

function createToolButton(
  icon: string,
  id: string | null,
  tooltip: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parent: Container = toolbarContainer,
) {
  const btn = new Container() as ToolbarButton;
  btn.x = x;
  btn.y = y;

  // Hit Area / Background
  const bg = new Graphics();
  bg.label = "ButtonBG";
  drawButtonBg(bg, width, height, false);
  btn.addChild(bg);

  // Icon
  if (SPRITE_MAP[icon]) {
    // It's a sprite key
    try {
      const tex = Texture.from(SPRITE_MAP[icon]);
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.x = width / 2;
      s.y = height / 2;

      // Scale to fit
      const maxDim = Math.min(width, height) * 0.6;
      // const scale = maxDim / Math.max(tex.width, tex.height); // Assuming texture loaded or size known
      // If texture not loaded yet, width/height might be 1. logic holds roughly.
      // Better: let's fix size
      s.width = maxDim;
      s.height = maxDim;
      // s.scale.set(scale);

      btn.addChild(s);
    } catch (e) {
      console.warn("Failed to load sprite for tool:", icon, e);
      const txt = new Text({
        text: "?",
        style: { fontSize: Math.min(width, height) * 0.4, fill: "white" },
      });
      txt.anchor.set(0.5);
      txt.x = width / 2;
      txt.y = height / 2;
      btn.addChild(txt);
    }
  } else {
    // Text/Emoji
    const txt = new Text({
      text: icon,
      resolution: 2,
      style: {
        fontSize: Math.min(width, height) * 0.4,
        fill: "white",
        fontFamily: TOOLBAR_FONT,
      },
    });
    txt.anchor.set(0.5);
    txt.x = width / 2;
    txt.y = height / 2;
    btn.addChild(txt);
  }

  // Interaction
  btn.eventMode = "static";
  btn.cursor = CURSOR_POINTER;

  const toolId = id; // Closure capture

  btn.on("pointertap", () => {
    // Check dragging status if parent is scrollable (or generally)
    if (!isDragging) {
      gameState.selectedBuilding = toolId as any;
      updateButtonStates();
    }
  });

  btn.on("pointerenter", () => {
    if (!isDragging) {
      const global = btn.getGlobalPosition();
      showTooltip(tooltip, global.x + width / 2, global.y);
      bg.tint = 0xaaaaaa;
    }
  });

  btn.on("pointerleave", () => {
    hideTooltip();
    bg.tint = 0xffffff;
  });

  // Store identity
  btn.toolId = id || undefined;
  btn.isTool = true;

  parent.addChild(btn);
}

function createBuildingButton(
  bId: string,
  info: BuildingDef,
  x: number,
  y: number,
  parent: Container = toolbarContainer,
  locked: boolean = false,
) {
  const btn = new Container() as ToolbarButton;
  btn.x = x;
  btn.y = y;

  const bg = new Graphics();
  bg.label = "ButtonBG";
  drawButtonBg(bg, BUTTON_WIDTH, BUTTON_HEIGHT, false);
  btn.addChild(bg);

  // Name
  const nameTxt = new Text({
    text: locked ? "Locked" : info.name,
    resolution: 2,
    style: {
      fontSize: 12,
      fill: locked ? "#888888" : "white",
      fontWeight: "bold",
      fontFamily: TOOLBAR_FONT,
      wordWrap: true,
      wordWrapWidth: BUTTON_WIDTH - 4,
      align: "center",
    },
  });
  nameTxt.anchor.set(0.5, 0);
  nameTxt.x = BUTTON_WIDTH / 2;
  nameTxt.y = 5;
  btn.addChild(nameTxt);

  // Icon
  let iconContainer: Container | null = null;
  if (SPRITE_MAP[bId]) {
    try {
      const tex = Texture.from(SPRITE_MAP[bId]);
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.x = BUTTON_WIDTH / 2;
      s.y = BUTTON_HEIGHT / 2 + 5; // Center, slightly pushed down by title

      // Scale to a reasonable size
      const ICON_SIZE = 36;
      s.width = ICON_SIZE;
      s.height = ICON_SIZE;

      btn.addChild(s);
      iconContainer = s;
    } catch (e) {
      // Fallback to vector graphics shape for this building
      const g = new Graphics();
      drawBuildingShape(g, bId);
      g.x = BUTTON_WIDTH / 2;
      g.y = BUTTON_HEIGHT / 2 + 5;
      // Scale down (graphics are typically drawn for 64x64 tiles)
      g.scale.set(0.6);
      btn.addChild(g);
      iconContainer = g;
    }
  } else {
    // No sprite available: generate vector graphics shape
    const g = new Graphics();
    drawBuildingShape(g, bId);
    g.x = BUTTON_WIDTH / 2;
    g.y = BUTTON_HEIGHT / 2 + 5;
    // Scale down
    g.scale.set(0.6);
    btn.addChild(g);
    iconContainer = g;
  }

  // Lock Visuals
  if (locked && iconContainer) {
    if (iconContainer instanceof Sprite) {
      iconContainer.tint = 0x444444;
    } else if (iconContainer instanceof Graphics) {
      iconContainer.tint = 0x444444; // Graphics tint works in v8? Yes usually.
      iconContainer.alpha = 0.5;
    }
    // Add Lock Icon Overlay?
    const lock = new Text({ text: "🔒", style: { fontSize: 24 } });
    lock.anchor.set(0.5);
    lock.x = BUTTON_WIDTH / 2;
    lock.y = BUTTON_HEIGHT / 2 + 5;
    btn.addChild(lock);
  }

  // Count (Hide if locked)
  if (!locked) {
    const countTxt = new Text({
      text: "Cnt: 0",
      resolution: 2,
      style: {
        fontSize: 10,
        fill: "#4CAF50",
        fontFamily: TOOLBAR_FONT,
      },
    });
    countTxt.label = "CountTxt";
    countTxt.anchor.set(0.5, 1);
    countTxt.x = BUTTON_WIDTH / 2;
    countTxt.y = BUTTON_HEIGHT - 5;
    btn.addChild(countTxt);
  }

  // Interaction
  btn.eventMode = "static";

  if (!locked) {
    btn.cursor = CURSOR_POINTER;
    btn.on("pointertap", () => {
      // Check dragging status
      if (!isDragging) {
        gameState.selectedBuilding = bId as BuildingId;
        updateButtonStates();
      }
    });
  } else {
    btn.cursor = "not-allowed";
  }

  // Tooltip construction
  btn.on("pointerenter", () => {
    if (!isDragging) {
      const global = btn.getGlobalPosition();
      let tooltipHTML = generateTooltip(info);
      if (locked && info.unlockReq) {
        const techName = inputToLabel(info.unlockReq);
        tooltipHTML =
          `<div style="color:#ff6666"><strong>LOCKED</strong><br>Requires Tech: ${techName}</div>` +
          tooltipHTML;
      }
      showTooltip(tooltipHTML, global.x + BUTTON_WIDTH / 2, global.y);
    }
  });

  btn.on("pointerleave", () => {
    hideTooltip();
  });

  btn.bId = bId;

  parent.addChild(btn);
  buttonCache.set(bId, btn);
}

function updateButtonStates() {
  const current = gameState.selectedBuilding || null; // null matches toolId null

  const allChildren = [...toolbarContainer.children, ...row2Container.children];

  // Iterate tools (direct children without bId) and Buildings
  allChildren.forEach((c) => {
    const child = c as ToolbarButton;
    if (child.label === "ToolbarBG" || child instanceof Graphics) return; // Skip separator/bg

    const bg = child.getChildByLabel("ButtonBG") as Graphics;
    if (!bg) return;

    // Skip Zone buttons and System buttons (check labels or props)
    // Zone buttons have label starting with "ZONE_"
    // System buttons have specific labels too?
    // Tools have isTool=true. Buildings have bId.
    // We should differentiate.

    // If it has neither isTool nor bId, and not system/zone, skip?
    if (!child.isTool && !child.bId) return;

    const isTool = child.isTool;
    let isActive = false;

    if (isTool) {
      if (!child.toolId) isActive = current === null;
      else isActive = current === child.toolId;
    } else {
      const bId = child.bId;
      isActive = current === bId;

      // Update Count
      // Optimized: Avoid dynamic query in loop
      const count = world.with("building").entities.filter(
        (e) => e.building.type === bId
      ).length;
      
      const cntTxt = child.getChildByLabel("CountTxt") as Text;
      if (cntTxt) cntTxt.text = `Cnt: ${count}`;

      // Affordability Opacity
      const info = BUILDING_INFO[bId as BuildingId];
      if (info) {
        let canAfford = true;
        for (const [res, amt] of Object.entries(info.cost)) {
          const cost = amt as number;
          let have = new Decimal(0);
          if (res === "money") have = gameState.credits;
          else have = gameState.getResource(gameState.activeZone, res);

          if (have.lt(cost)) {
            canAfford = false;
            break;
          }
        }
        child.alpha = canAfford ? 1.0 : 0.5;
      }
    }

    // Redraw BG based on Active
    const w = isTool ? BUTTON_WIDTH : BUTTON_WIDTH;
    const h = isTool ? BUTTON_HEIGHT : BUTTON_HEIGHT;
    // We standardized everything to BUTTON_WIDTH x BUTTON_HEIGHT

    // Optimization: Store last active state to avoid clearing/redrawing
    const lastActive = (child as any)._lastActive;
    if (lastActive !== isActive) {
      bg.clear();
      drawButtonBg(bg, w, h, isActive);
      (child as any)._lastActive = isActive;
    }
  });
}

function drawButtonBg(g: Graphics, w: number, h: number, active: boolean) {
  const color = active ? 0x1976d2 : 0x2c2c2c;
  const stroke = active ? 0x64b5f6 : 0x555555;

  g.roundRect(0, 0, w, h, 4);
  g.fill({ color });
  g.stroke({ width: active ? 2 : 1, color: stroke });
}

function generateTooltip(info: BuildingDef): string {
  // Re-use logic from UISystem? Or copy it.
  // Since this is HTML string returned to showTooltip(HTML), we format it here.
  let html = `<div style="font-weight:bold; border-bottom:1px solid #666; padding-bottom:4px; margin-bottom:4px;">${info.name}</div>`;

  html += `<div style="font-size:11px; margin-bottom:4px; color:#ddd;">Costs:</div>`;
  for (const [res, amt] of Object.entries(info.cost)) {
    const costVal = amt as number;
    let have = new Decimal(0);
    if (res === "money") have = gameState.credits || new Decimal(0);
    else have = gameState.getResource(gameState.activeZone, res);

    const isAffordable = have.gte(costVal);
    const col = isAffordable ? "#66BB6A" : "#EF5350";

    html += `<div style="display:flex; justify-content:space-between; font-size:11px; color:#aaa;"><span>${inputToLabel(res)}:</span> <span style="color:${col}">${amt}</span></div>`;
  }

  if (info.workers) {
    const total = Math.floor(gameState.totalPopulation);
    const employed = gameState.employed;
    const free = total - employed;
    const color = free >= info.workers ? "#29B6F6" : "#EF5350";
    html += `<div style="display:flex; justify-content:space-between; font-size:11px; color:#aaa;"><span>Workers:</span> <span style="color:${color}">${info.workers} (Free: ${free})</span></div>`;
  }

  html += `<div style="font-size:11px; margin-top:6px; margin-bottom:2px; color:#ddd;">Effects:</div>`;
  if (info.housing)
    html += `<div style="font-size:11px; color:#81C784;">+${info.housing} Housing</div>`;
  if (info.output)
    html += `<div style="font-size:11px; color:#AED581;">Produces: ${info.output.rate}/s ${inputToLabel(info.output.resource)}</div>`;
  if (info.input)
    html += `<div style="font-size:11px; color:#E57373;">Consumes: ${info.input.rate}/s ${inputToLabel(info.input.resource)}</div>`;

  return html;
}

function createZoneButton(
  zone: ZoneId,
  x: number,
  y: number,
  parent: Container = toolbarContainer,
) {
  const isActive = gameState.activeZone === zone;
  // Use constants for size
  const width = BUTTON_WIDTH;
  const height = BUTTON_HEIGHT;

  // Reuse or create
  const key = `ZONE_${zone}`;
  let btn = buttonCache.get(key);

  if (!btn) {
    btn = new Container();
    btn.label = key;

    // Background
    const bg = new Graphics();
    bg.label = "BG";
    btn.addChild(bg);

    // Text
    const t = new Text({
      text: zone.toUpperCase(), // FULL NAME
      resolution: 2, // High DPI text
      style: {
        fill: 0xffffff,
        fontSize: 12, // Slightly smaller to fit "MOUNTAIN"
        fontWeight: "bold",
        fontFamily: TOOLBAR_FONT,
      },
    });
    t.label = "TXT";
    t.anchor.set(0.5);
    t.x = width / 2;
    t.y = height / 2;
    btn.addChild(t);

    // Interaction
    btn.eventMode = "static";
    btn.cursor = CURSOR_POINTER;
    btn.on("pointertap", () => {
      if (!isDragging) {
        gameState.switchZone(zone);
        updatePixiToolbar(); // Force immediate update
      }
    });

    // Tooltip for Zone Stats
    btn.on("pointerenter", () => {
      if (!isDragging) {
        const stats = calculateZoneRates(zone);
        let html = `<div style="min-width:150px"><strong>${zone.toUpperCase()} STATUS</strong><hr style="margin:4px 0; border:0; border-top:1px solid #555"/>`;

        let hasRes = false;
        for (const [res, data] of Object.entries(stats)) {
          if (data.amount.lte(0) && data.net === 0) continue; // Hide empty/inactive

          hasRes = true;
          const netStr =
            data.net > 0
              ? `+${data.net.toFixed(1)}`
              : data.net < 0
                ? `${data.net.toFixed(1)}`
                : `0`;
          const color =
            data.net > 0 ? "#81C784" : data.net < 0 ? "#E57373" : "#aaa";

          html += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;">
                    <span>${inputToLabel(res)}:</span>
                    <span style="color:#fff">${data.amount.floor()} <small style="color:${color}">(${netStr}/s)</small></span>
                </div>`;
        }

        if (!hasRes)
          html += `<div style="font-size:11px; color:#888;">No Activity</div>`;

        html += `</div>`;

        if (!btn) return;
        const global = btn.getGlobalPosition();
        showTooltip(html, global.x + width / 2, global.y);
      }
    });

    btn.on("pointerleave", () => {
      hideTooltip();
    });

    buttonCache.set(key, btn);
  }

  // Update Visuals
  const bg = btn.getChildByLabel("BG") as Graphics;
  bg.clear();
  bg.roundRect(0, 0, width, height, 8);

  if (isActive) {
    bg.fill(0x4caf50); // Active Green
    bg.stroke({ width: 2, color: 0xffffff });
  } else {
    bg.fill(0x333333);
    bg.stroke({ width: 1, color: 0x666666 });
  }

  // Update Text Position (if width changed)
  const t = btn.getChildByLabel("TXT") as Text;
  if (t) {
    t.x = width / 2;
    t.y = height / 2;
    t.text = zone.toUpperCase();
  }

  // Position
  btn.x = x;
  btn.y = y;

  parent.addChild(btn);
}

function createSystemButton(
  label: string,
  onClick: () => void,
  x: number,
  y: number,
  width: number,
  height: number,
  locked: boolean,
  color: number = 0x333333,
  parent: Container = toolbarContainer,
) {
  // width/height passed in now

  const btn = new Container();
  btn.x = x;
  btn.y = y;

  const bg = new Graphics();
  bg.label = "ButtonBG";
  bg.roundRect(0, 0, width, height, 4);

  if (locked) {
    bg.fill({ color: 0x222222, alpha: 0.8 });
    bg.stroke({ width: 1, color: 0x444444 });
  } else {
    bg.fill({ color: color, alpha: 0.95 });
    bg.stroke({ width: 1, color: 0x666666 });
  }
  btn.addChild(bg);

  const txt = new Text({
    text: locked ? "LOCKED" : label, // Or keep label but grayed? Keep label.
    resolution: 2, // High resolution for sharper text
    style: {
      fontSize: 13,
      fill: locked ? "#666" : "white",
      fontWeight: "bold",
      fontFamily: TOOLBAR_FONT,
    },
  });
  if (locked) txt.text = label; // Just keep label, color does the work

  txt.anchor.set(0.5);
  txt.x = width / 2;
  txt.y = height / 2;
  btn.addChild(txt);

  if (!locked) {
    btn.eventMode = "static";
    btn.cursor = CURSOR_POINTER;
    btn.on("pointertap", () => {
      if (!isDragging) {
        onClick();
        bg.tint = 0x888888;
        setTimeout(() => (bg.tint = 0xffffff), 100);
      }
    });
    btn.on("pointerenter", () => {
      if (!isDragging) bg.stroke({ width: 1, color: 0xffffff });
    });
    btn.on("pointerleave", () => {
      bg.stroke({ width: 1, color: 0x666666 });
      bg.tint = 0xffffff;
    });
  } else {
    btn.eventMode = "static";
    btn.cursor = "not-allowed";
    // Tooltip explaining lock?
    btn.on("pointerenter", () => {
      if (!isDragging) {
        const msg =
          label === "RESEARCH"
            ? "Build Research Lab to unlock"
            : label === "MARKET"
              ? "Build Marketplace to unlock"
              : "Locked";
        const global = btn.getGlobalPosition();
        showTooltip(msg, global.x + width / 2, global.y);
      }
    });
    btn.on("pointerleave", () => hideTooltip());
  }

  parent.addChild(btn);
}
