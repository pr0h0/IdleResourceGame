import { gameState } from "../core/gameState";
import { ZONES, type ZoneId } from "../config/constants";
import { BUILDINGS, BUILDING_INFO } from "../config/buildings";
import { TECHS } from "../config/techs";
import { RESOURCES } from "../config/resources";
import { RESOURCE_PRICES } from "../config/prices";
import { world } from "../core/ecs";
import Decimal from "decimal.js";
import { updatePixiToolbar } from "./PixiToolbar";
import { initPrestigeUI } from "./PrestigeUI";
import { initSettingsUI } from "./SettingsUI";

export function initUISystem() {
  // createZoneUI(); // Moved to PixiToolbar
  // createSystemUI(); // Moved to PixiToolbar
  createTechUI();
  // createBuildingUI(); // Replaced by PixiToolbar
  createResourcesUI();
  createInspectorUI();
  createLogisticsUI();
  createMarketUI();
  initPrestigeUI();
  initSettingsUI();

  // Refresh UI periodically
  setInterval(() => {
    updatePixiToolbar();
    refreshTechUI();
    refreshInspectorUI();
    refreshLogisticsUI();
    refreshResourcesUI(); // Added refresh
    refreshMarketUI();
  }, 500); // 2Hz
}

// function createSystemUI() { ... } // Removed

let techContainer: HTMLElement;
let isTechOpen = false;

export function toggleTechUI() {
  isTechOpen = !isTechOpen;
  if (techContainer) {
    techContainer.style.display = isTechOpen ? "flex" : "none";
    if (isTechOpen) refreshTechUI();
  }
}

// --- TECH UI (Optimized) ---
function createTechUI() {
  techContainer = document.createElement("div");
  Object.assign(techContainer.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "600px",
    height: "auto",
    maxHeight: "80vh",
    backgroundColor: "#111",
    border: "2px solid #555",
    display: "none",
    flexDirection: "column",
    padding: "20px",
    gap: "10px",
    zIndex: "200",
    color: "white",
    overflowY: "auto",
  });
  document.body.appendChild(techContainer);

  // Header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.innerHTML = "<h2>Research Lab</h2>";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "X";
  closeBtn.onclick = () => toggleTechUI();
  header.appendChild(closeBtn);

  techContainer.appendChild(header);

  // Points Display (Separate for fast updates)
  const pointsDiv = document.createElement("div");
  pointsDiv.id = "tech-points-display";
  pointsDiv.style.marginBottom = "10px";
  pointsDiv.style.fontWeight = "bold";
  techContainer.appendChild(pointsDiv);

  // Content List
  const content = document.createElement("div");
  content.id = "tech-list";
  Object.assign(content.style, {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  });
  techContainer.appendChild(content);

  // Populate List ONCE (Static structure)
  // Dynamic updates will happen via ID lookup
  Object.values(TECHS).forEach((tech) => {
    const row = document.createElement("div");
    row.id = `tech-row-${tech.id}`;
    Object.assign(row.style, {
      display: "flex",
      justifyContent: "space-between",
      padding: "10px",
      border: "1px solid #444",
      alignItems: "center",
    });

    const info = document.createElement("div");
    info.id = `tech-info-${tech.id}`;
    info.innerHTML = `<strong>${tech.name}</strong><br><small>${tech.description}</small>`;

    const action = document.createElement("div");
    action.id = `tech-action-${tech.id}`;

    row.appendChild(info);
    row.appendChild(action);
    content.appendChild(row);
  });
}

export function refreshTechUI() {
  if (!techContainer || !isTechOpen) return;

  // 1. Update Points
  const points =
    gameState.resources[ZONES.CITY].get(RESOURCES.TECH_POINTS) ||
    new Decimal(0);
  const pointsDiv = document.getElementById("tech-points-display");
  if (pointsDiv)
    pointsDiv.textContent = `Available Tech Points: ${points.floor()}`;

  // 2. Update Rows (In-place)
  Object.values(TECHS).forEach((tech) => {
    const row = document.getElementById(`tech-row-${tech.id}`);
    const action = document.getElementById(`tech-action-${tech.id}`);
    const info = document.getElementById(`tech-info-${tech.id}`);
    if (!row || !action || !info) return;

    // Repeatable logic
    const isRepeatable = !!tech.repeatable;
    const level = gameState.techLevels[tech.id] || 0;
    let cost = new Decimal(tech.cost);

    if (isRepeatable) {
      cost = new Decimal(tech.cost).mul(Math.pow(1.5, level));
      info.innerHTML = `<strong>${tech.name} (Lv.${level})</strong><br><small>${tech.description}</small>`;
    }

    const isUnlocked = gameState.unlockedTechs.has(tech.id);
    const canUnlock =
      !isUnlocked && (!tech.req || gameState.unlockedTechs.has(tech.req));

    if (isRepeatable) {
      // Repeatable always "can unlock" (if enough points)
      let btn = action.querySelector("button") as HTMLButtonElement;
      if (!btn) {
        btn = document.createElement("button");
        // Only bind click once or re-bind safely
        btn.onclick = () => {
          // Re-fetch points to be safe in closure
          const currentPoints = gameState.resources[ZONES.CITY].get(RESOURCES.TECH_POINTS) || new Decimal(0);
          // Recalculate cost in closure
          const currentLvl = gameState.techLevels[tech.id] || 0;
          const currentCost = new Decimal(tech.cost).mul(Math.pow(1.5, currentLvl));

          if (currentPoints.gte(currentCost)) {
            gameState.resources[ZONES.CITY].set(
              RESOURCES.TECH_POINTS,
              currentPoints.sub(currentCost),
            );
            if (!gameState.techLevels[tech.id]) gameState.techLevels[tech.id] = 0;
            gameState.techLevels[tech.id]++;
            gameState.unlockedTechs.add(tech.id);
            refreshTechUI();
          }
        };
        action.innerHTML = "";
        action.appendChild(btn);
      }

      // Update Button State
      btn.textContent = `Upgrade (${cost.floor()} TP)`;
      btn.disabled = points.lt(cost);

      row.style.backgroundColor = points.gte(cost) ? "#333" : "#222";
    } else if (isUnlocked) {
      if (row.dataset.state !== 'unlocked') {
        row.style.backgroundColor = "#224422";
        action.innerHTML = '<span style="color:#8f8">Researched</span>';
        row.dataset.state = 'unlocked';
      }
    } else {
      if (canUnlock) {
        let btn = action.querySelector("button") as HTMLButtonElement;
        if (!btn || row.dataset.state !== 'canUnlock') {
          btn = document.createElement("button");
          btn.onclick = () => {
            const currentPoints = gameState.resources[ZONES.CITY].get(RESOURCES.TECH_POINTS) || new Decimal(0);
            if (currentPoints.gte(tech.cost)) {
              gameState.resources[ZONES.CITY].set(
                RESOURCES.TECH_POINTS,
                currentPoints.sub(tech.cost),
              );
              gameState.unlockedTechs.add(tech.id);
              refreshTechUI();
            }
          };
          action.innerHTML = "";
          action.appendChild(btn);
          row.dataset.state = 'canUnlock';
        }

        btn.textContent = `Unlock (${tech.cost} TP)`;
        btn.disabled = points.lt(tech.cost);
        row.style.backgroundColor = "#333";
      } else {
        if (row.dataset.state !== 'locked') {
          row.style.backgroundColor = "#111";
          action.innerHTML = `<span style="color:#888">Requires: ${TECHS[tech.req!]?.name || tech.req}</span>`;
          row.dataset.state = 'locked';
        }
      }
    }
  });
}

/*
function createZoneUI() {
    const uiContainer = document.createElement("div");
    uiContainer.id = "zone-ui";
    Object.assign(uiContainer.style, {
        position: "absolute",
        top: "10px",
        left: "10px",
        display: "flex",
        gap: "10px",
        zIndex: "100"
    });
    document.body.appendChild(uiContainer);

    Object.values(ZONES).forEach(zone => {
        const btn = document.createElement("button");
        btn.textContent = zone.toUpperCase();
        Object.assign(btn.style, {
            padding: "10px 20px",
            cursor: "pointer",
            fontWeight: "bold",
            border: "1px solid #ccc",
            borderRadius: "4px"
        });
        
        btn.onclick = () => {
            gameState.switchZone(zone as ZoneId);
            gameState.selectedBuilding = null; // Reset selection
            updateZoneButtons(uiContainer, zone);
            // refreshBuildingUI();
        };
        
        btn.dataset.zone = zone;
        uiContainer.appendChild(btn);
    });

    updateZoneButtons(uiContainer, gameState.activeZone);
}
*/

/* function updateZoneButtons(container: HTMLElement, activeZone: string) {
    const buttons = container.querySelectorAll("button");
    buttons.forEach(b => {
        if (b.dataset.zone === activeZone) {
            b.style.backgroundColor = "#4CAF50"; // Green
            b.style.color = "white";
        } else {
            b.style.backgroundColor = "#f0f0f0";
            b.style.color = "black";
        }
    });
} */

// let buildingContainer: HTMLElement; // Removed

// --- Tooltip System ---
let tooltipEl: HTMLElement;

export function showTooltip(text: string, x: number, y: number) {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    Object.assign(tooltipEl.style, {
      position: "absolute",
      backgroundColor: "rgba(0, 0, 0, 0.9)",
      color: "white",
      padding: "8px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      zIndex: "1000",
      pointerEvents: "none",
      whiteSpace: "pre-line",
      border: "1px solid #444",
      maxWidth: "200px",
      boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
    });
    document.body.appendChild(tooltipEl);
  }
  tooltipEl.innerHTML = text; // Allow HTML
  tooltipEl.style.display = "block";

  // Re-position if off screen
  const rect = tooltipEl.getBoundingClientRect();
  let top = y - rect.height - 10;
  let left = x - rect.width / 2;

  if (top < 0) top = y + 20; // Flip down if too high
  if (left < 10) left = 10;
  if (left + rect.width > window.innerWidth)
    left = window.innerWidth - rect.width - 10;

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
}

export function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = "none";
}

export function inputToLabel(s: string) {
  // logging_camp -> Logging Camp
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function createResourcesUI() {
  const resContainer = document.createElement("div");
  resContainer.id = "resource-ui";
  Object.assign(resContainer.style, {
    position: "absolute",
    top: "15px",
    right: "15px",
    color: "#e0e0e0",
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    backdropFilter: "blur(5px)", // Glass effect
    border: "1px solid #444",
    boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
    padding: "15px",
    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    zIndex: "100",
    borderRadius: "12px",
    minWidth: "240px",
    fontSize: "14px",
    transition: "all 0.2s ease",
  });
  document.body.appendChild(resContainer);

  const header = document.createElement("div");
  header.id = "res-header";
  header.style.display = "flex";
  header.style.flexDirection = "column";
  header.style.marginBottom = "12px";
  header.style.borderBottom = "1px solid #555";
  header.style.paddingBottom = "8px";
  resContainer.appendChild(header);

  // Stats Container
  const stats = document.createElement("div");
  stats.id = "res-stats";
  header.appendChild(stats);

  // Controls Container (Sell Selector)
  const controls = document.createElement("div");
  controls.id = "res-controls";
  controls.style.marginTop = "8px";
  controls.style.display = "flex";
  controls.style.justifyContent = "flex-end";
  controls.style.alignItems = "center";
  header.appendChild(controls);

  const list = document.createElement("div");
  list.id = "res-list";
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "8px";
  resContainer.appendChild(list);
}

function refreshResourcesUI() {
  const stats = document.getElementById("res-stats");
  const controls = document.getElementById("res-controls");
  const list = document.getElementById("res-list");
  if (!stats || !controls || !list) return;

  const totalPop = Math.floor(gameState.totalPopulation);
  const freePop = Math.floor(gameState.totalPopulation - gameState.employed);

  // Stats: Improved Layout
  stats.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
            <span style="color:#aaa; font-size:12px;">ZONE</span>
            <span style="font-weight:bold; color:#fff; letter-spacing:1px">${gameState.activeZone.toUpperCase()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
            <span style="color:#aaa; font-size:12px;">CREDITS</span>
            <span style="color:#FFD700; font-weight:bold;">💰 ${gameState.credits?.toFixed(0) ?? "0"}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
             <span style="color:#aaa; font-size:12px;">POPULATION</span>
             <span style="color:#90caf9;">👥 ${Math.floor(gameState.employed)} / ${totalPop} <span style="font-size:10px; color:#666">(${freePop} free)</span></span>
        </div>
    `;

  const currentResources = gameState.resources[gameState.activeZone];
  if (!currentResources) return;

  const RESOURCES_TO_SHOW = [
    RESOURCES.WOOD,
    RESOURCES.STONE,
    RESOURCES.WHEAT,
    RESOURCES.PLANKS,
    RESOURCES.BRICKS,
    RESOURCES.FLOUR,
    RESOURCES.BREAD,
    RESOURCES.TECH_POINTS,
  ];

  // Sell Selector: Cleaner Style
  let sellAmountSel = document.getElementById(
    "sell-amount-selector",
  ) as HTMLSelectElement;
  if (!sellAmountSel) {
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.gap = "8px";

    div.innerHTML = `<span style="font-size:11px; color:#888;">AMT:</span>`;

    sellAmountSel = document.createElement("select");
    sellAmountSel.id = "sell-amount-selector";
    Object.assign(sellAmountSel.style, {
      fontSize: "11px",
      padding: "2px 6px",
      backgroundColor: "#222",
      color: "#ddd",
      border: "1px solid #555",
      borderRadius: "4px",
      outline: "none",
      cursor: "pointer",
    });

    [10, 50, 100].forEach((pct) => {
      const opt = document.createElement("option");
      opt.value = pct.toString();
      opt.text = pct === 100 ? "MAX" : `${pct}%`;
      if (pct === 100) opt.selected = true;
      sellAmountSel.appendChild(opt);
    });

    div.appendChild(sellAmountSel);
    controls.appendChild(div);
  }

  RESOURCES_TO_SHOW.forEach((res) => {
    const amount = currentResources.get(res);
    if (!amount || amount.lte(0)) {
      const el = document.getElementById(`res-row-${res}`);
      if (el) el.style.display = "none";
      return;
    }

    let row = document.getElementById(`res-row-${res}`);
    if (!row) {
      row = document.createElement("div");
      row.id = `res-row-${res}`;
      Object.assign(row.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 8px",
        backgroundColor: "rgba(255,255,255,0.03)",
        borderRadius: "6px",
        marginBottom: "2px",
      });

      const leftCol = document.createElement("div");
      leftCol.style.display = "flex";
      leftCol.style.flexDirection = "column";

      const name = document.createElement("span");
      name.textContent = inputToLabel(res);
      name.style.fontSize = "11px";
      name.style.color = "#aaa";
      name.style.fontWeight = "600";
      leftCol.appendChild(name);

      const valContainer = document.createElement("div");

      const val = document.createElement("span");
      val.id = `res-val-${res}`;
      val.style.fontWeight = "bold";
      val.style.fontSize = "13px";
      val.style.color = "#eee";
      valContainer.appendChild(val);

      const rate = document.createElement("span");
      rate.id = `res-rate-${res}`;
      rate.style.marginLeft = "4px";
      rate.style.fontSize = "10px";
      valContainer.appendChild(rate);

      leftCol.appendChild(valContainer);
      row.appendChild(leftCol);

      // Add sell button only for sellable resources (not tech points)
      if (res !== RESOURCES.TECH_POINTS) {
        const btn = document.createElement("button");
        btn.textContent = "$";
        Object.assign(btn.style, {
          fontSize: "12px",
          width: "28px",
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backgroundColor: "transparent",
          border: "1px solid #4CAF50",
          color: "#4CAF50",
          borderRadius: "50%",
          marginLeft: "10px",
          transition: "all 0.1s",
        });
        btn.onmouseenter = () => {
          btn.style.backgroundColor = "#4CAF50";
          btn.style.color = "white";
        };
        btn.onmouseleave = () => {
          btn.style.backgroundColor = "transparent";
          btn.style.color = "#4CAF50";
        };
        btn.onclick = () => {
          const sel = document.getElementById(
            "sell-amount-selector",
          ) as HTMLSelectElement;
          const pct = sel ? parseInt(sel.value) : 100;
          sellResource(res, pct);
          btn.style.transform = "scale(0.9)";
          setTimeout(() => (btn.style.transform = "scale(1)"), 100);
        };
        row.appendChild(btn);
      } else {
        const spacer = document.createElement("div");
        spacer.style.width = "28px";
        row.appendChild(spacer);
      }

      list.appendChild(row);
    }

    // Ensure row is visible
    row.style.display = "flex";

    // Update Value
    const valEl = document.getElementById(`res-val-${res}`);
    if (valEl) valEl.textContent = amount.floor().toString();

    // Update Rate
    const rateEl = document.getElementById(`res-rate-${res}`);
    if (rateEl) {
      rateEl.innerHTML = "";
      const zoneRates = gameState.productionRates[gameState.activeZone];
      if (zoneRates) {
        const r = zoneRates.get(res) || 0;
        if (Math.abs(r) > 0.01) {
          const color = r > 0 ? "#8f8" : "#f88";
          const sign = r > 0 ? "+" : "";
          rateEl.innerHTML = `<span style="color:${color}">(${sign}${r.toFixed(1)}/s)</span>`;
        }
      }
    }
  });
}

export function toggleLogisticsUI() {
  const ui = document.getElementById("logistics-ui");
  if (ui) {
    const isHidden = ui.style.display === "none";
    ui.style.display = isHidden ? "block" : "none";
    if (isHidden) {
      refreshLogisticsUI();
    }
  }
}

function createLogisticsUI() {
  const parent = document.createElement("div");
  parent.id = "logistics-ui"; // ID for toggling
  Object.assign(parent.style, {
    position: "absolute",
    top: "60px",
    left: "10px",
    backgroundColor: "rgba(20, 20, 30, 0.9)",
    border: "1px solid #444",
    padding: "10px",
    color: "#eee",
    borderRadius: "8px",
    minWidth: "260px",
    fontSize: "12px",
    zIndex: "95",
    display: "none", // Hidden by default
  });

  parent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #555; margin-bottom:5px; padding-bottom:3px;">
            <div style="font-weight:bold;">Logistics Network</div>
            <button id="close-logistics" style="background:none; border:none; color:#f44336; font-weight:bold; cursor:pointer;">X</button>
        </div>
        
        <div style="display:flex; gap:5px; margin-bottom:10px;">
             <button id="tab-transport" style="flex:1; padding:5px; background:#444; border:none; color:white; cursor:pointer; font-size:11px;">Transport</button>
             <button id="tab-autosell" style="flex:1; padding:5px; background:#222; border:none; color:#888; cursor:pointer; font-size:11px;">Auto-Sell</button>
        </div>

        <div id="logistics-capacity" style="margin-bottom:10px;">Trucks: 0 / 0</div>

        <!-- TRANSPORT PANEL -->
        <div id="panel-transport">
            <div id="logistics-routes" style="max-height:200px; overflow-y:auto; margin-bottom:10px;"></div>
            <div style="background:#333; padding:5px; border-radius:4px;">
                <div style="margin-bottom:5px;">New Route:</div>
                
                <div style="margin-bottom:3px;">
                    <label style="font-size:10px; color:#aaa; display:block;">From:</label>
                    <div id="route-from-container" style="display:flex; gap:2px;"></div>
                </div>
                
                <div style="margin-bottom:3px;">
                    <label style="font-size:10px; color:#aaa; display:block;">To:</label>
                    <div id="route-to-container" style="display:flex; gap:2px;"></div>
                </div>
                
                <div style="margin-bottom:3px;">
                    <label style="font-size:10px; color:#aaa; display:block;">Resource:</label>
                    <select id="route-res" style="width:100%; box-sizing:border-box;"></select>
                </div>

                 <div style="margin-bottom:5px;">
                    <label style="font-size:10px; color:#aaa; display:block;">Qty (0 = Infinite):</label>
                    <input id="route-amount" type="number" value="0" style="width:100%; box-sizing:border-box; font-size:11px;" placeholder="0" />
                </div>
                <button id="add-route-btn" style="width:100%; background:#2196F3; border:none; color:white; padding:4px; cursor:pointer;">Add Route</button>
            </div>
        </div>

        <!-- AUTO-SELL PANEL -->
        <div id="panel-autosell" style="display:none;">
            <div id="autosell-routes" style="max-height:200px; overflow-y:auto; margin-bottom:10px;"></div>
            <div style="background:#333; padding:5px; border-radius:4px;">
                <div style="margin-bottom:5px;">New Auto-Sell Route:</div>
                
                <div style="margin-bottom:3px;">
                    <label style="font-size:10px; color:#aaa; display:block;">Zone:</label>
                    <div id="sell-zone-container" style="display:flex; gap:2px;"></div>
                </div>
                
                <div style="margin-bottom:3px;">
                    <label style="font-size:10px; color:#aaa; display:block;">Resource:</label>
                    <select id="sell-res" style="width:100%; box-sizing:border-box;"></select>
                </div>

                 <div style="margin-bottom:5px;">
                    <label style="font-size:10px; color:#aaa; display:block;">Keep Amount (0 = Sell All):</label>
                    <input id="sell-amount" type="number" value="0" style="width:100%; box-sizing:border-box; font-size:11px;" placeholder="Min Stock" />
                </div>
                <button id="add-sell-btn" style="width:100%; background:#FF9800; border:none; color:white; padding:4px; cursor:pointer;">Add Sell Order</button>
            </div>
        </div>
    `;

  document.body.appendChild(parent);

  // Tab Logic
  const tabTransport = parent.querySelector("#tab-transport") as HTMLElement;
  const tabAutoSell = parent.querySelector("#tab-autosell") as HTMLElement;
  const panelTransport = parent.querySelector(
    "#panel-transport",
  ) as HTMLElement;
  const panelAutoSell = parent.querySelector("#panel-autosell") as HTMLElement;

  const setTab = (mode: "transport" | "autosell") => {
    if (mode === "transport") {
      panelTransport.style.display = "block";
      panelAutoSell.style.display = "none";
      tabTransport.style.background = "#444";
      tabTransport.style.color = "white";
      tabAutoSell.style.background = "#222";
      tabAutoSell.style.color = "#888";
    } else {
      // Check Tech
      if (!gameState.unlockedTechs.has("auto_trade")) {
        alert("Requires research: Auto-Trade");
        return;
      }
      panelTransport.style.display = "none";
      panelAutoSell.style.display = "block";
      tabAutoSell.style.background = "#444";
      tabAutoSell.style.color = "white";
      tabTransport.style.background = "#222";
      tabTransport.style.color = "#888";
    }
  };

  tabTransport.onclick = () => setTab("transport");
  tabAutoSell.onclick = () => setTab("autosell");

  // Default Selection
  let selectedFrom: ZoneId = ZONES.CITY;
  let selectedTo: ZoneId = ZONES.FOREST;
  let selectedSellZone: ZoneId = ZONES.CITY;

  // Helper to render buttons
  const renderZoneButtons = (
    containerId: string,
    current: string,
    onClick: (z: ZoneId) => void,
  ) => {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = "";
    Object.values(ZONES).forEach((z) => {
      const btn = document.createElement("button");
      btn.textContent = z.substring(0, 3).toUpperCase(); // CIT, FOR...
      Object.assign(btn.style, {
        flex: "1",
        fontSize: "10px",
        padding: "2px",
        border: "1px solid #555",
        background: z === current ? "#2196F3" : "#444",
        color: "white",
        cursor: "pointer",
      });
      btn.onclick = () => {
        onClick(z as ZoneId);
      };
      c.appendChild(btn);
    });
  };

  const resSel = parent.querySelector("#route-res") as HTMLSelectElement;
  const sellResSel = parent.querySelector("#sell-res") as HTMLSelectElement;

  const updateUI = () => {
    renderZoneButtons("route-from-container", selectedFrom, (z) => {
      selectedFrom = z;
      updateUI();
    });
    renderZoneButtons("route-to-container", selectedTo, (z) => {
      selectedTo = z;
      updateUI();
    });
    renderZoneButtons("sell-zone-container", selectedSellZone, (z) => {
      selectedSellZone = z;
      updateUI();
    });

    const populateRes = (sel: HTMLSelectElement, zone: string) => {
      sel.innerHTML = "";
      if (gameState.resources[zone]) {
        const available = gameState.resources[zone];
        let hasAny = false;
        available.forEach((amount, resName) => {
          if (amount.gt(0)) {
            hasAny = true;
            // Using inputToLabel if available, else raw string
            const label =
              typeof inputToLabel === "function"
                ? inputToLabel(resName)
                : resName;
            sel.add(new Option(`${label} (${amount.floor()})`, resName));
          }
        });
        if (!hasAny) {
          sel.add(new Option("No resources", ""));
          sel.disabled = true;
        } else {
          sel.disabled = false;
        }
      }
    };

    // Populate Resources based on Source Zone
    populateRes(resSel, selectedFrom);
    populateRes(sellResSel, selectedSellZone);
  };
  updateUI();

  const closeBtn = parent.querySelector(
    "#close-logistics",
  ) as HTMLButtonElement;
  closeBtn.onclick = () => {
    parent.style.display = "none";
  };

  const amtInput = parent.querySelector("#route-amount") as HTMLInputElement;
  const sellAmtInput = parent.querySelector("#sell-amount") as HTMLInputElement;

  const btn = parent.querySelector("#add-route-btn") as HTMLButtonElement;
  btn.onclick = () => {
    const from = selectedFrom;
    const to = selectedTo;
    const res = resSel.value;
    const amount = parseInt(amtInput.value) || 0;

    if (from === to) return;

    gameState.routes.push({
      id: Date.now(),
      from,
      to,
      resource: res,
      active: false,
      targetAmount: amount,
      movedAmount: new Decimal(0),
    });
    refreshLogisticsUI();
  };

  const sellBtn = parent.querySelector("#add-sell-btn") as HTMLButtonElement;
  sellBtn.onclick = () => {
    const zone = selectedSellZone;
    const res = sellResSel.value;
    const keep = parseInt(sellAmtInput.value) || 0;

    if (!gameState.autoSellRoutes) gameState.autoSellRoutes = [];
    gameState.autoSellRoutes.push({
      id: Date.now(),
      zone: zone,
      resource: res,
      keepAmount: keep,
      active: false,
    });
    refreshLogisticsUI();
  };
}

function refreshLogisticsUI() {
  const depots = world
    .with("building")
    .where((e) => e.building.type === BUILDINGS.TRANSPORT_DEPOT);
  const totalTrucks = depots.entities.length * 5; // Should match TransportSystem logic

  let activeRoutes = 0;
  gameState.routes.forEach((r) => {
    if (r.active) activeRoutes++;
  });
  if (gameState.autoSellRoutes) {
    gameState.autoSellRoutes.forEach((r) => {
      if (r.active) activeRoutes++;
    });
  }

  const capEl = document.getElementById("logistics-capacity");
  if (capEl) {
    if (totalTrucks === 0) {
      capEl.innerHTML = `<span style="color:#EF5350; font-weight:bold;">NO TRUCKS! Build a Transport Depot.</span>`;
    } else {
      const color = activeRoutes >= totalTrucks ? "#ff9800" : "#4CAF50";
      capEl.innerHTML = `Active Routes: <span style="color:${color}">${activeRoutes}</span> / ${totalTrucks}`;
    }
  }

  // --- Transport Routes Listing ---
  const listEl = document.getElementById("logistics-routes");
  if (listEl) {
    listEl.innerHTML = ""; // Simpler to rebuild
    if (gameState.routes.length === 0) {
      listEl.innerHTML =
        '<div style="color:#888; font-style:italic; padding:5px;">No active transport routes</div>';
    } else {
      gameState.routes.forEach((r, idx) => {
        const row = document.createElement("div");
        Object.assign(row.style, {
          background: "rgba(255,255,255,0.05)",
          padding: "4px",
          marginBottom: "4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderLeft: `3px solid ${r.active ? "#4CAF50" : "#EF5350"}`,
        });

        let progress = "∞";
        if (r.targetAmount && r.targetAmount > 0) {
          progress = `${r.movedAmount?.floor() ?? 0} / ${r.targetAmount}`;
        }
        const rate = r.throughput ? r.throughput.toFixed(1) : "0.0";

        row.innerHTML = `
                <div class="route-info">
                   <div>${r.from} &rarr; ${r.to}</div>
                   <div style="color:#aaa;">${r.resource} (~${rate}/s)</div>
                   <div style="color:#888; font-size:10px;">Progress: ${progress}</div>
                </div>
                <button onclick="window.removeRoute(${idx})" style="background:none; border:none; color:#EF5350; cursor:pointer;">X</button>
             `;
        listEl.appendChild(row);
      });
    }
  }

  // --- Auto-Sell Routes Listing ---
  const sellListEl = document.getElementById("autosell-routes");
  if (sellListEl) {
    sellListEl.innerHTML = "";
    if (!gameState.autoSellRoutes || gameState.autoSellRoutes.length === 0) {
      sellListEl.innerHTML =
        '<div style="color:#888; font-style:italic; padding:5px;">No active sell orders</div>';
    } else {
      gameState.autoSellRoutes.forEach((r, idx) => {
        const row = document.createElement("div");
        Object.assign(row.style, {
          background: "rgba(255,255,255,0.05)",
          padding: "4px",
          marginBottom: "4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderLeft: `3px solid ${r.active ? "#4CAF50" : "#EF5350"}`,
        });

        row.innerHTML = `
                <div class="route-info">
                   <div><span style="color:#FF9800">[SELL]</span> ${r.zone}</div>
                   <div style="color:#aaa;">${r.resource} (Keep: ${r.keepAmount})</div>
                </div>
                <button onclick="window.removeSellRoute(${idx})" style="background:none; border:none; color:#EF5350; cursor:pointer;">X</button>
              `;
        sellListEl.appendChild(row);
      });
    }
  }
}

(window as any).removeRoute = (idx: number) => {
  gameState.routes.splice(idx, 1);
  refreshLogisticsUI();
};

(window as any).removeSellRoute = (idx: number) => {
  if (gameState.autoSellRoutes) {
    gameState.autoSellRoutes.splice(idx, 1);
    refreshLogisticsUI();
  }
};

let inspectorEl: HTMLElement;

function createInspectorUI() {
  inspectorEl = document.createElement("div");
  Object.assign(inspectorEl.style, {
    position: "absolute",
    bottom: "120px", // Above build bar
    left: "50%",
    transform: "translateX(-50%)",
    backgroundColor: "rgba(30,30,30,0.95)",
    border: "1px solid #555",
    borderRadius: "8px",
    padding: "15px",
    color: "white",
    minWidth: "300px",
    display: "none", // Hidden by default
    zIndex: "90",
  });

  inspectorEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #555; padding-bottom:5px;">
            <div id="insp-title" style="font-weight:bold; font-size:16px;"></div>
            <button id="close-inspector" style="background:none; border:none; color:#999; cursor:pointer;">X</button>
        </div>
        <div id="insp-stats"></div>
        <div id="insp-upgrade" style="background:#222; padding:10px; border-radius:4px; margin-top:10px;">
            <div id="insp-up-title" style="font-size:12px; font-weight:bold; margin-bottom:5px;"></div>
            <div id="insp-up-costs" style="display:flex; flex-direction:column; gap:2px; margin-bottom:5px;"></div>
            <div id="insp-auto-upgrade" style="margin-bottom:5px; padding-top:5px; border-top:1px solid #444; display:none;"></div>
            <button id="upgrade-btn" style="width:100%; padding:5px; cursor:pointer; background:#555; border:none; color:white; font-weight:bold; border-radius:2px;">
                UPGRADE
            </button>
        </div>
        <div id="insp-actions" style="margin-top:10px; display:flex; gap:5px;">
            <button id="pause-btn" style="flex:1; padding:5px; cursor:pointer; background:#444; border:1px solid #666; color:white;">
                PAUSE
            </button>
        </div>
    `;

  document.body.appendChild(inspectorEl);

  // One-time binds
  const closeBtn = inspectorEl.querySelector(
    "#close-inspector",
  ) as HTMLButtonElement;
  closeBtn.onclick = () => {
    gameState.selectedEntityId = null;
    refreshInspectorUI();
  };

  const pauseBtn = inspectorEl.querySelector("#pause-btn") as HTMLButtonElement;
  pauseBtn.onclick = () => {
    // Defer to refreshInspectorUI binding
    if ((pauseBtn as any).toggleAction) (pauseBtn as any).toggleAction();
  };

  const upBtn = inspectorEl.querySelector("#upgrade-btn") as HTMLButtonElement;
  upBtn.onclick = () => {
    // Logic deferred to current state stored in element or global?
    // We can store the current upgrade action in a variable or property on the button
    if ((upBtn as any).upgradeAction) {
      (upBtn as any).upgradeAction();
    }
  };
}

export function refreshInspectorUI() {
  if (!inspectorEl) return;

  if (gameState.selectedBuilding || !gameState.selectedEntityId) {
    inspectorEl.style.display = "none";
    return;
  }

  // Find Entity
  const entity = world.entities.find(
    (e) => e.id === gameState.selectedEntityId,
  );

  if (!entity || !entity.building) {
    inspectorEl.style.display = "none";
    gameState.selectedEntityId = null;
    return;
  }

  inspectorEl.style.display = "block";
  const info = BUILDING_INFO[entity.building.type];
  const level = entity.building.level;

  // 1. Update Header
  const titleEl = document.getElementById("insp-title");
  if (titleEl)
    titleEl.innerHTML = `${info.name} <span style="font-size:12px; color:#aaa;">Lv.${level}</span>`;

  // 2. Update Stats (Current vs Next)
  const statsEl = document.getElementById("insp-stats");
  const nextLevel = level + 1;
  const costMult = Math.pow(1.5, level); // Cost multiplier for next level

  if (statsEl) {
    let html = `<div style="font-size:11px; color:#888; margin-bottom:10px;">${info.description || ""}</div>`;

    // Calculate Current & Next Stats
    // Logic must match performUpgrade / System logic
    const getStats = (lvl: number) => {
      const mult = Math.pow(1.5, lvl - 1);
      let prod = new Decimal(0);
      let cons = new Decimal(0);

      if (info.output) {
        prod = new Decimal(info.output.rate).mul(mult);
      }
      if (info.input) {
        // Consumption: Scales slower, e.g. 1.2x per level?
        // Logic in performUpgrade needs to match this.
        // Let's definition: Consumption scales by 1.25^level relative to base.
        const consMult = Math.pow(1.25, lvl - 1);
        cons = new Decimal(info.input.rate).mul(consMult);
      }
      return { prod, cons };
    };

    const cur = getStats(level);
    const next = getStats(nextLevel);

    // PRODUCTION
    if (info.output) {
      html += `<div style="margin-bottom:4px;">Production: 
                 <span style="color:#AED581">${cur.prod.toFixed(2)}</span> 
                 <span style="color:#aaa;">&rarr;</span> 
                 <span style="color:#4CAF50; font-weight:bold;">${next.prod.toFixed(2)}</span> 
                 /s ${inputToLabel(info.output.resource)}</div>`;
    }

    // CONSUMPTION
    if (info.input) {
      html += `<div style="margin-bottom:4px;">Consumes: 
                 <span style="color:#E57373">${cur.cons.toFixed(2)}</span> 
                 <span style="color:#aaa;">&rarr;</span> 
                 <span style="color:#F44336; font-weight:bold;">${next.cons.toFixed(2)}</span> 
                 /s ${inputToLabel(info.input.resource)}</div>`;
    }

    // SPECIAL STATS
    if (entity.building.type === BUILDINGS.TRANSPORT_DEPOT) {
      const getFleet = (lvl: number) => 5 + (lvl - 1) * 2;
      const getSpeed = (lvl: number) => 100 + (lvl - 1) * 20;

      html += `<div style="margin-bottom:4px;">Fleet Size: <span style="color:#4FC3F7">${getFleet(level)}</span> &rarr; <b>${getFleet(nextLevel)}</b></div>`;
      html += `<div style="margin-bottom:4px;">Speed: <span style="color:#4FC3F7">${getSpeed(level)}%</span> &rarr; <b>${getSpeed(nextLevel)}%</b></div>`;
    }

    if (entity.building.type === BUILDINGS.MARKETPLACE) {
      const getOffers = (lvl: number) => 3 + Math.floor((lvl - 1) * 1); // e.g. +1 per level
      html += `<div style="margin-bottom:4px;">Offers: <span style="color:#FFD54F">${getOffers(level)}</span> &rarr; <b>${getOffers(nextLevel)}</b></div>`;
    }

    if (entity.inventory && entity.inventory.size > 0) {
      html += `<hr style="border:0; border-top:1px solid #444; margin:5px 0;"><div style="font-size:12px; margin-bottom:10px;">Stock: `;
      entity.inventory.forEach((val, key) => {
        if (val.gt(0)) html += `${val.toFixed(0)} ${inputToLabel(key)}, `;
      });
      html += `</div>`;
    }
    statsEl.innerHTML = html;
  }

  // 3. Upgrade Section
  document.getElementById("insp-up-title")!.textContent =
    `Upgrade to Lv.${nextLevel}`;

  // 3b. Auto Upgrade Logic
  const autoUpEl = document.getElementById("insp-auto-upgrade");
  if (autoUpEl) {
    if (gameState.unlockedTechs.has("auto_upgrade")) {
      autoUpEl.style.display = "block";

      const currentTarget = entity.building.autoUpgradeTarget || 0;
      const isEnabled = (entity.building.autoUpgradeTarget !== undefined) && (entity.building.autoUpgradeTarget > level);

      // Check if we need to initialize the DOM or if context changed
      const lastId = autoUpEl.dataset.entityId;
      const currentIdStr = entity.id !== undefined ? entity.id.toString() : "unknown";
      const isNewEntity = lastId !== currentIdStr;
      autoUpEl.dataset.entityId = currentIdStr;

      let input = autoUpEl.querySelector("#auto-target-input") as HTMLInputElement;
      let btn = autoUpEl.querySelector("#auto-toggle-btn") as HTMLButtonElement;
      let statusDiv = autoUpEl.querySelector("#auto-status-msg") as HTMLDivElement;

      // Initialize DOM if missing
      if (!input || !btn || !statusDiv) {
        autoUpEl.innerHTML = `
                <div style="font-size:11px; margin-bottom:3px; color:#aaa;">Auto-Upgrade Target Level:</div>
                <div style="display:flex; gap:5px;">
                    <input type="number" id="auto-target-input" style="width:50px; font-size:11px; background:#333; color:white; border:1px solid #555; padding-left:4px;">
                    <button id="auto-toggle-btn" style="flex:1; font-size:10px; cursor:pointer; border-radius:3px; border:none; padding:4px;">
                        ENABLE AUTO-UPGRADE
                    </button>
                </div>
                <div id="auto-status-msg" style="font-size:10px; color:#4CAF50; margin-top:2px; text-align:center; min-height:14px;"></div>
              `;

        input = autoUpEl.querySelector("#auto-target-input") as HTMLInputElement;
        btn = autoUpEl.querySelector("#auto-toggle-btn") as HTMLButtonElement;
        statusDiv = autoUpEl.querySelector("#auto-status-msg") as HTMLDivElement;

        // Bind Events
        btn.onclick = () => {
          if (!entity.building) return;
          const val = parseInt(input.value);

          // Toggle Logic
          // If currently enabled, we disable.
          // If currently disabled, we enable (if input valid).
          const currentlyEnabled = (entity.building.autoUpgradeTarget !== undefined);

          if (currentlyEnabled) {
            entity.building.autoUpgradeTarget = undefined;
          } else {
            if (!val || val <= entity.building.level) {
              // Invalid target
              return;
            }
            entity.building.autoUpgradeTarget = val;
          }
          refreshInspectorUI();
        };

        // Input Change Logic
        input.onchange = () => {
          if (entity.building && entity.building.autoUpgradeTarget !== undefined) {
            const val = parseInt(input.value);
            if (val > entity.building.level) {
              entity.building.autoUpgradeTarget = val;
              refreshInspectorUI();
            }
          }
        };
      }

      // Update Values (Only if needed)

      // 1. Input Value
      // Reset input ONLY if a new entity is selected
      if (isNewEntity) {
        const displayTarget = isEnabled ? currentTarget : (level + 10);
        input.value = displayTarget.toString();
      } else {
        // Same entity. 
        // If input is NOT focused, sync it (if enabled)
        if (document.activeElement !== input) {
          if (isEnabled) {
            input.value = currentTarget.toString();
          }
          // If disabled, keep user's typed value (don't overwrite)
        }
      }

      // 2. Button State
      if (isEnabled) {
        btn.textContent = 'ENABLED (Click to Stop)';
        btn.style.background = "#2E7D32";
        btn.style.color = "white";
      } else {
        btn.textContent = 'ENABLE AUTO-UPGRADE';
        btn.style.background = "#444";
        btn.style.color = "#ccc";
      }

      // 3. Status Message
      if (isEnabled) {
        statusDiv.textContent = `Active until Lv.${currentTarget}`;
      } else {
        statusDiv.textContent = '';
      }

    } else {
      autoUpEl.style.display = "none";
    }
  }

  // Calculate Costs
  const totalCosts: Record<string, number> = {};
  for (const [res, amt] of Object.entries(info.cost)) {
    totalCosts[res] = Math.floor((amt as number) * costMult);
  }
  if (info.upgradeCost) {
    for (const [res, amt] of Object.entries(info.upgradeCost)) {
      const extra = Math.floor((amt as number) * costMult);
      totalCosts[res] = (totalCosts[res] || 0) + extra;
    }
  }

  // Cost: Workers
  const requiredPop = info.workers || 0;
  const freePop = Math.floor(gameState.totalPopulation - gameState.employed);

  let canAfford = true;
  let costHtml = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">`;

  // Check Population
  if (requiredPop > 0) {
    const havePop = freePop >= requiredPop;
    if (!havePop) canAfford = false;
    costHtml += `<div style="font-size:11px; color:${havePop ? "#ccc" : "#E57373"}">
            People: ${requiredPop}
        </div>`;
  }

  for (const [res, amt] of Object.entries(totalCosts)) {
    const cost = amt as number;
    const have =
      res === "money"
        ? gameState.credits
        : gameState.getResource(gameState.activeZone, res);
    const afford =
      res === "money" ? gameState.credits.gte(cost) : have.gte(cost);
    if (!afford) canAfford = false;

    costHtml += `<div style="font-size:11px; color:${afford ? "#ccc" : "#E57373"}">
            ${inputToLabel(res)}: ${cost}
        </div>`;
  }
  costHtml += `</div>`;

  const costEl = document.getElementById("insp-up-costs");
  if (costEl && costEl.innerHTML !== costHtml) costEl.innerHTML = costHtml;

  // Update Button
  const upBtn = document.getElementById("upgrade-btn") as HTMLButtonElement;
  if (upBtn) {
    upBtn.disabled = !canAfford;
    upBtn.style.backgroundColor = canAfford ? "#4CAF50" : "#555";
    upBtn.style.cursor = canAfford ? "pointer" : "default";

    // Bind Action (Closure update)
    (upBtn as any).upgradeAction = () =>
      performUpgrade(entity, info, costMult, totalCosts);
  }

  // 4. Pause Button
  const pauseBtn = document.getElementById("pause-btn") as HTMLButtonElement;
  const pauseDiv = document.getElementById("insp-actions")!;

  if (entity.producer && entity.producer.inputResource) {
    pauseDiv.style.display = "flex";
    const isPaused = !!entity.producer.isPaused;
    pauseBtn.textContent = isPaused ? "RESUME" : "PAUSE";
    pauseBtn.style.background = isPaused ? "#2E7D32" : "#D32F2F";

    (pauseBtn as any).toggleAction = () => {
      if (entity.producer) {
        entity.producer.isPaused = !isPaused;
        refreshInspectorUI();
      }
    };
  } else {
    pauseDiv.style.display = "none";
  }
}

function performUpgrade(
  entity: any,
  info: any,
  _costMult: number,
  totalCosts: Record<string, number>,
) {
  // 1. Pay
  for (const [res, amt] of Object.entries(totalCosts)) {
    const cost = amt;
    if (res === "money") {
      gameState.addCredits(new Decimal(-cost));
    } else {
      gameState.consumeResource(gameState.activeZone, res, new Decimal(cost));
    }
  }

  // 2. Upgrade
  entity.building.level += 1;

  // 3. Effect (Update Components)
  const newLevel = entity.building.level;

  if (entity.producer) {
    // Output: 1.5^(L-1)
    if (info.output) {
      const baseRate = new Decimal(info.output.rate);
      const newRate = baseRate.mul(Math.pow(1.5, newLevel - 1));
      entity.producer.rate = newRate;
    }

    // Input: 1.25^(L-1)
    if (info.input) {
      const baseIn = new Decimal(info.input.rate);
      const newIn = baseIn.mul(Math.pow(1.25, newLevel - 1));
      entity.producer.inputRate = newIn;
    }
  }

  // 4. Update Visual (Level Badge)
  if (entity.sprite && entity.sprite.children) {
    const lbl = entity.sprite.children.find(
      (c: any) => c.label === "LevelLabel",
    );
    if (lbl && (lbl as any).text !== undefined) {
      (lbl as any).text = newLevel.toString();
      (lbl as any).visible = newLevel > 1; // Only show if > 1
    }
  }

  console.log(`Upgraded to Level ${newLevel}`);
  refreshInspectorUI();
}

function sellResource(resId: string, percentage: number = 100) {
  const amount = gameState.getResource(gameState.activeZone, resId);
  if (amount.lte(0)) return;

  // Calculate amount to sell
  const sellAmount = amount.mul(percentage).div(100).floor();

  if (sellAmount.lte(0)) return;

  const price = RESOURCE_PRICES[resId] || 1;
  const value = sellAmount.mul(price);

  if (value.gt(0)) {
    gameState.consumeResource(gameState.activeZone, resId, sellAmount);
    gameState.addCredits(value);
    console.log(
      `Sold ${sellAmount} ${resId} (${percentage}%) for ${value} credits`,
    );
  }
}

// --- MARKET UI ---

let isMarketOpen = false;

export function toggleMarketUI() {
  isMarketOpen = !isMarketOpen;
  refreshMarketUI();
}

function createMarketUI() {
  const container = document.createElement("div");
  container.id = "market-ui";
  Object.assign(container.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: "rgba(30, 30, 40, 0.95)",
    border: "1px solid #666",
    padding: "10px",
    color: "white",
    display: "none",
    zIndex: "200", // Modal
    width: "400px",
    height: "auto",
    maxHeight: "80vh",
    overflowY: "auto",
    borderRadius: "8px",
    boxShadow: "0 0 20px rgba(0,0,0,0.5)",
  });

  container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #555; margin-bottom:10px; padding-bottom:5px;">
            <div style="font-weight:bold; font-size:1.2em;">Marketplace</div>
            <button id="market-close-btn" style="background:none; border:none; color:white; font-weight:bold; cursor:pointer;">X</button>
        </div>
        <div id="market-timer" style="font-size:12px; color:#aaa; margin-bottom:5px;">Check back later...</div>
        <div id="market-list" style="display:flex; flex-direction:column; gap:5px;"></div>
    `;
  document.body.appendChild(container);

  document.getElementById("market-close-btn")!.onclick = () => {
    isMarketOpen = false;
    refreshMarketUI();
  };

  // Add Toggle Button to Main UI (If built)
  // We'll inject a button dynamically when Marketplace is detected in refresh loop if not present
}

// let marketBtn: HTMLElement | null = null; // Removed DOM button

function refreshMarketUI() {
  const marketEl = document.getElementById("market-ui");
  if (!marketEl) return;

  // Check Existence
  // const markets = world
  //   .with("building")
  //   .where((e) => e.building.type === BUILDINGS.MARKETPLACE);
  // const hasMarket = markets.entities.length > 0;

  // Manage Toggle Button - REMOVED for PixiToolbar integration
  // if (hasMarket && !marketBtn) { ... }

  if (!isMarketOpen) {
    marketEl.style.display = "none";
    return;
  }

  marketEl.style.display = "block";

  const list = document.getElementById("market-list");
  if (!list) return;

  // Timer Update
  const timer = document.getElementById("market-timer");
  if (timer) {
    const remaining = Math.max(
      0,
      30000 - (Date.now() - gameState.lastOfferUpdate),
    );
    timer.textContent = `New offers in ${(remaining / 1000).toFixed(0)}s`;
  }

  // Sync Offers
  list.innerHTML = "";

  if (gameState.marketOffers.length === 0) {
    list.innerHTML =
      "<div style='color:#777; font-style:italic;'>No offers available.</div>";
    return;
  }

  gameState.marketOffers.forEach((offer) => {
    const row = document.createElement("div");
    Object.assign(row.style, {
      background: "#333",
      padding: "5px",
      fontSize: "12px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderLeft: offer.isBuying ? "3px solid #4CAF50" : "3px solid #2196F3",
    });

    let desc = "";
    let btnText = "";
    let canAfford = false;

    const resName = inputToLabel(offer.resource);

    if (offer.isBuying) {
      // Player SELLS to Merchant
      desc = `<div>Gets: <strong>${offer.amount} ${resName}</strong></div><div style='color:#FFD700'>Pays: ${offer.cost} Credits</div>`;
      btnText = "SELL";

      const playerRes = gameState.getResource(
        gameState.activeZone,
        offer.resource,
      );
      canAfford = playerRes.gte(offer.amount);
    } else {
      // Player BUYS from Merchant
      desc = `<div>Offers: <strong>${offer.amount} ${resName}</strong></div><div style='color:#FFD700'>Cost: ${offer.cost} Credits</div>`;
      btnText = "BUY";
      canAfford = gameState.credits.gte(offer.cost);
    }

    row.innerHTML = `<div style="flex-grow:1">${desc}</div>`;

    const btn = document.createElement("button");
    btn.textContent = btnText;
    btn.disabled = !canAfford;
    Object.assign(btn.style, {
      cursor: canAfford ? "pointer" : "default",
      backgroundColor: canAfford
        ? offer.isBuying
          ? "#E65100"
          : "#1B5E20"
        : "#555",
      color: "white",
      border: "none",
      padding: "4px 8px",
      marginLeft: "5px",
      fontWeight: "bold",
      borderRadius: "2px",
    });

    btn.onclick = () => {
      acceptOffer(offer);
    };

    row.appendChild(btn);
    list.appendChild(row);
  });
}

function acceptOffer(offer: any) {
  if (offer.isBuying) {
    // Sell: Player loses Resource, gains Credit
    if (
      gameState.consumeResource(
        gameState.activeZone,
        offer.resource,
        new Decimal(offer.amount),
      )
    ) {
      gameState.addCredits(new Decimal(offer.cost));
      gameState.marketOffers = gameState.marketOffers.filter(
        (x) => x.id !== offer.id,
      );
      refreshMarketUI();
    }
  } else {
    // Buy: Player loses Credit, gains Resource
    if (gameState.credits.gte(offer.cost)) {
      gameState.addCredits(new Decimal(-offer.cost));
      gameState.addResource(
        gameState.activeZone,
        offer.resource,
        new Decimal(offer.amount),
      );
      gameState.marketOffers = gameState.marketOffers.filter(
        (x) => x.id !== offer.id,
      );
      refreshMarketUI();
    }
  }
}
