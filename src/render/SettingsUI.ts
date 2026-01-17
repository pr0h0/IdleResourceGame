import { SaveSystem } from "../systems/SaveSystem";
import { gameState } from "../core/gameState";
import { ZONES } from "../config/constants";
import { RESOURCES } from "../config/resources";
import Decimal from "decimal.js";
// import { togglePrestigeUI } from "./PrestigeUI";

let settingsContainer: HTMLElement;
let isSettingsOpen = false;

export function initSettingsUI() {
  createSettingsUI();
}

export function toggleSettingsUI() {
  isSettingsOpen = !isSettingsOpen;
  if (settingsContainer) {
    settingsContainer.style.display = isSettingsOpen ? "flex" : "none";
  }
}

function createSettingsUI() {
  settingsContainer = document.createElement("div");
  Object.assign(settingsContainer.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "300px",
    height: "auto",
    backgroundColor: "#222",
    border: "2px solid #555",
    display: "none",
    flexDirection: "column",
    padding: "20px",
    gap: "10px",
    zIndex: "200",
    color: "white",
    borderRadius: "8px",
    boxShadow: "0 0 20px rgba(0,0,0,0.5)",
  });
  document.body.appendChild(settingsContainer);

  // Header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.innerHTML = "<h3>Settings</h3>";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "X";
  Object.assign(closeBtn.style, {
    background: "none",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
  });
  closeBtn.onclick = () => toggleSettingsUI();
  header.appendChild(closeBtn);
  settingsContainer.appendChild(header);

  // Buttons
  createButton(
    "Save Game",
    () => {
      SaveSystem.save();
      toggleSettingsUI();
    },
    "#388E3C",
  );
  createButton(
    "Load Game",
    () => {
      SaveSystem.load();
      toggleSettingsUI();
    },
    "#1976D2",
  );
  createButton(
    "Hard Reset",
    () => {
      if (confirm("Are you sure? This deletes everything.")) {
        SaveSystem.hardReset();
        toggleSettingsUI();
      }
    },
    "#D32F2F",
  );

  createButton(
    "Add 1M Resources",
    () => {
      gameState.prestigeCurrency = gameState.prestigeCurrency.plus(1000000); // Wait, prestigeCurrency uses Decimal? Yes, check type.
      // Actually gameState.prestigeCurrency is a specific property, check implementation.
      // Reading gameState.ts showed: public prestigeCurrency: Decimal = new Decimal(0);
      // Correct.

      gameState.addCredits(new Decimal(1000000));
      Object.values(ZONES).forEach((zone) => {
        Object.values(RESOURCES).forEach((res) => {
          gameState.addResource(zone, res, new Decimal(1000000));
        });
      });
      alert("Resources Added.");
    },
    "#9c27b0",
  ); // Purple/Cheat
}

function createButton(text: string, onClick: () => void, color: string) {
  const btn = document.createElement("button");
  btn.textContent = text;
  Object.assign(btn.style, {
    padding: "10px",
    backgroundColor: color,
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
  });

  // Hover effect
  btn.onmouseover = () => (btn.style.filter = "brightness(1.2)");
  btn.onmouseout = () => (btn.style.filter = "brightness(1.0)");

  btn.onclick = onClick;
  settingsContainer.appendChild(btn);
}
