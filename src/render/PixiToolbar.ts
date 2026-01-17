import { Application, Container, Graphics, Text } from "pixi.js";
import { gameState } from "../core/gameState";
import {
  BUILDINGS,
  BUILDING_INFO,
  type BuildingId,
  type BuildingDef,
} from "../config/buildings";
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
const BUTTON_WIDTH = 110;
const BUTTON_HEIGHT = 80;
const BUTTON_GAP = 10;
const PADDING = 10;

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
  toolbarContainer.y = appRef.screen.height - TOOLBAR_HEIGHT;

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

  // Input Handling for Background (Click blocking & Scrolling)
  bg.eventMode = "static";

  // Clean listeners to avoid dupes on resize? onResize might be called multiple times.
  bg.removeAllListeners();

  bg.on("pointerdown", (e) => {
    e.stopPropagation();

    // Start Scroll if in bottom area
    const local = e.data.getLocalPosition(toolbarContainer);
    if (local.y > 100) {
      isDragging = true;
      dragStartX = e.data.global.x;
      scrollStartX = row2Container.x; // row2Container is offset by scroll
    }
  });

  bg.on("globalpointermove", (e) => {
    if (isDragging) {
      const delta = e.data.global.x - dragStartX;
      let newX = scrollStartX + delta;

      // Clamp
      // minScroll is usually negative (content width - screen width)
      // maxScroll (start position) is PADDING or 0?
      // Let's say default X is 0.
      // row2Container X range: [screen_width - content_width - padding, 0]

      // Actually, let's logic this out in rebuild.
      // For now, update var.
      row2Container.x = newX;
      const minX = Math.min(0, appRef.screen.width - maxScroll - PADDING * 2);

      if (row2Container.x > 0) row2Container.x = 0;
      if (row2Container.x < minX) row2Container.x = minX;
    }
  });

  bg.on("pointerup", () => {
    isDragging = false;
  });
  bg.on("pointerupoutside", () => {
    isDragging = false;
  });

  // Update Mask
  row2Mask.clear();
  row2Mask.rect(0, 100, appRef.screen.width, 90);
  row2Mask.fill(0xffffff);

  // Rebuild content
  rebuildToolbar();
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
    if (info.unlockReq && !gameState.unlockedTechs.has(info.unlockReq)) return;

    createBuildingButton(bId, info, r1x, r1y);
    r1x += BUTTON_WIDTH + BUTTON_GAP;
  });

  // --- Row 2: Controls & System (Lower) ---

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
  let sep = new Graphics();
  sep.rect(0, 0, 2, 70);
  sep.fill(0x555555);
  sep.x = currentX;
  sep.y = 5;
  row2Container.addChild(sep);
  currentX += 15;

  // 2. Tools
  createToolButton(
    "🖱️",
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
    "✋",
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
    "🗑️",
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
  sep = new Graphics();
  sep.rect(0, 0, 2, 70);
  sep.fill(0x555555);
  sep.x = currentX;
  sep.y = 5;
  row2Container.addChild(sep);
  currentX += 15;

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
  const txt = new Text({
    text: icon,
    style: { fontSize: Math.min(width, height) * 0.4, fill: "white" },
  });
  txt.anchor.set(0.5);
  txt.x = width / 2;
  txt.y = height / 2;
  btn.addChild(txt);

  // Interaction
  btn.eventMode = "static";
  btn.cursor = "pointer";

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
    text: info.name,
    style: {
      fontSize: 12,
      fill: "white",
      fontWeight: "bold",
      wordWrap: true,
      wordWrapWidth: BUTTON_WIDTH - 4,
      align: "center",
    },
  });
  nameTxt.anchor.set(0.5, 0);
  nameTxt.x = BUTTON_WIDTH / 2;
  nameTxt.y = 5;
  btn.addChild(nameTxt);

  // Count
  const countTxt = new Text({
    text: "Cnt: 0",
    style: { fontSize: 10, fill: "#4CAF50" },
  });
  countTxt.label = "CountTxt";
  countTxt.anchor.set(0.5, 1);
  countTxt.x = BUTTON_WIDTH / 2;
  countTxt.y = BUTTON_HEIGHT - 5;
  btn.addChild(countTxt);

  // Interaction
  btn.eventMode = "static";
  btn.cursor = "pointer";

  btn.on("pointertap", () => {
    // Check dragging status
    if (!isDragging) {
      gameState.selectedBuilding = bId as BuildingId;
      updateButtonStates();
    }
  });

  // Tooltip construction
  btn.on("pointerenter", () => {
    if (!isDragging) {
      const global = btn.getGlobalPosition();
      const tooltipHTML = generateTooltip(info);
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
      const count = world.with("building").where((e) => e.building.type === bId)
        .entities.length;
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

    bg.clear();
    drawButtonBg(bg, w, h, isActive);
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
      style: {
        fill: 0xffffff,
        fontSize: 12, // Slightly smaller to fit "MOUNTAIN"
        fontWeight: "bold",
        fontFamily: "Arial",
      },
    });
    t.label = "TXT";
    t.anchor.set(0.5);
    t.x = width / 2;
    t.y = height / 2;
    btn.addChild(t);

    // Interaction
    btn.eventMode = "static";
    btn.cursor = "pointer";
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
    style: {
      fontSize: 13,
      fill: locked ? "#666" : "white",
      fontWeight: "bold",
    },
  });
  if (locked) txt.text = label; // Just keep label, color does the work

  txt.anchor.set(0.5);
  txt.x = width / 2;
  txt.y = height / 2;
  btn.addChild(txt);

  if (!locked) {
    btn.eventMode = "static";
    btn.cursor = "pointer";
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
