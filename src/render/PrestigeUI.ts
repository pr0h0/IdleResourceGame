import { gameState } from "../core/gameState";
import { PrestigeSystem } from "../systems/PrestigeSystem";
import { PRESTIGE_UPGRADES } from "../config/prestige";
import Decimal from "decimal.js";

let container: HTMLElement;
let isOpen = false;

export function initPrestigeUI() {
  createPrestigeUI();
  // Button removed - moved to SettingsUI
  // Add button to document body for access
  /*     const btn = document.createElement("button");
    btn.textContent = "Prestige";
    Object.assign(btn.style, {
        position: 'absolute',
        top: '60px', // Moved down from 10px to avoid stats
        right: '25px', 
        zIndex: '100',
        padding: '5px 10px',
        backgroundColor: '#673AB7',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    });
    btn.onclick = togglePrestigeUI;
    document.body.appendChild(btn); */

  // Refresh loop
  setInterval(refreshPrestigeUI, 1000);
}

export function togglePrestigeUI() {
  isOpen = !isOpen;
  if (container) {
    container.style.display = isOpen ? "flex" : "none";
    if (isOpen) refreshPrestigeUI();
  }
}

function createPrestigeUI() {
  container = document.createElement("div");
  Object.assign(container.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "700px",
    height: "500px",
    backgroundColor: "#221133", // Purple theme
    border: "2px solid #9C27B0",
    display: "none",
    flexDirection: "column",
    padding: "20px",
    gap: "10px",
    zIndex: "200",
    color: "white",
    overflowY: "auto",
    fontFamily: "monospace",
  });
  document.body.appendChild(container);

  // Header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.innerHTML = "<h2>Prestige / Legacy</h2>";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "X";
  closeBtn.onclick = () => togglePrestigeUI();
  header.appendChild(closeBtn);

  container.appendChild(header);

  // Status Panel
  const statusPanel = document.createElement("div");
  statusPanel.id = "prestige-status";
  Object.assign(statusPanel.style, {
    padding: "10px",
    backgroundColor: "rgba(0,0,0,0.3)",
    border: "1px solid #555",
    marginBottom: "10px",
  });
  container.appendChild(statusPanel);

  // Reset Button
  const resetBtn = document.createElement("button");
  resetBtn.id = "prestige-reset-btn";
  Object.assign(resetBtn.style, {
    width: "100%",
    padding: "15px",
    backgroundColor: "#E91E63",
    color: "white",
    fontSize: "1.2em",
    fontWeight: "bold",
    cursor: "pointer",
    border: "none",
    marginBottom: "20px",
  });
  resetBtn.onclick = () => {
    if (
      confirm(
        "Are you sure you want to Prestige? You will start over but keep Amber and Upgrades.",
      )
    ) {
      PrestigeSystem.doPrestige();
      togglePrestigeUI(); // Close
    }
  };
  container.appendChild(resetBtn);

  // Shop Section
  const shopHeader = document.createElement("h3");
  shopHeader.textContent = "Amber Shop";
  container.appendChild(shopHeader);

  const shopGrid = document.createElement("div");
  Object.assign(shopGrid.style, {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  });
  container.appendChild(shopGrid);

  // Init Shop Items
  Object.values(PRESTIGE_UPGRADES).forEach((upg) => {
    const card = document.createElement("div");
    Object.assign(card.style, {
      padding: "10px",
      border: "1px solid #7B1FA2",
      backgroundColor: "#4A148C",
    });

    const title = document.createElement("div");
    title.innerHTML = `<strong>${upg.name}</strong>`;

    const desc = document.createElement("div");
    desc.textContent = upg.description;
    desc.style.fontSize = "0.9em";
    desc.style.color = "#E1BEE7";
    desc.style.margin = "5px 0";

    const stats = document.createElement("div");
    stats.id = `prestige-stats-${upg.id}`;

    const buyBtn = document.createElement("button");
    buyBtn.id = `prestige-buy-${upg.id}`;
    buyBtn.onclick = () => {
      PrestigeSystem.buyUpgrade(upg.id);
      refreshPrestigeUI();
    };

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(stats);
    card.appendChild(buyBtn);
    shopGrid.appendChild(card);
  });
}

export function refreshPrestigeUI() {
  if (!container || !isOpen) return;

  // 1. Status
  const amber = gameState.prestigeCurrency.floor();
  const pending = PrestigeSystem.calculatePendingPrestige();
  const lifetime = gameState.lifetimeEarnings;

  const statusDiv = document.getElementById("prestige-status");
  if (statusDiv) {
    statusDiv.innerHTML = `
            <div><strong>Current Amber:</strong> <span style="color:#FFB74D; font-size:1.5em">${amber}</span></div>
            <div>Lifetime Earnings: $${lifetime.floor()}</div>
            <div>Pending Amber (on Reset): <span style="color:#00E676">+${pending}</span></div>
        `;
  }

  const resetBtn = document.getElementById(
    "prestige-reset-btn",
  ) as HTMLButtonElement;
  if (resetBtn) {
    if (pending.lte(0)) {
      resetBtn.disabled = true;
      resetBtn.style.opacity = "0.5";
      resetBtn.textContent = "Collect more Credits to Prestige";
    } else {
      resetBtn.disabled = false;
      resetBtn.style.opacity = "1";
      resetBtn.textContent = `PRESTIGE NOW (+${pending} Amber)`;
    }
  }

  // 2. Shop Buttons
  Object.values(PRESTIGE_UPGRADES).forEach((upg) => {
    const level = gameState.prestigeUpgrades[upg.id] || 0;
    const isMaxed = upg.maxLevel && level >= upg.maxLevel;

    // Calculate Cost Dynamically
    let costVal = upg.cost;
    if (upg.costScale === "linear") {
      costVal = upg.cost + level;
    }
    const cost = new Decimal(costVal);

    const statsDiv = document.getElementById(`prestige-stats-${upg.id}`);
    if (statsDiv) {
      statsDiv.innerHTML = `Lvl: ${level} ${upg.maxLevel ? "/ " + upg.maxLevel : ""}`;
    }

    const btn = document.getElementById(
      `prestige-buy-${upg.id}`,
    ) as HTMLButtonElement;
    if (btn) {
      if (isMaxed) {
        btn.textContent = "MAXED";
        btn.disabled = true;
      } else {
        btn.textContent = `Buy (Cost: ${cost} Amber)`;
        btn.disabled = gameState.prestigeCurrency.lt(cost);
      }
    }
  });
}
