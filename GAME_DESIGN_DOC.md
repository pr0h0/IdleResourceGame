# Idle/Incremental Game Design Document

## 1. Technical Stack

- **Language**: TypeScript
- **Build Tool**: Vite
- **Renderer**: **Pixi.js** (v8)
- **Game Logic**: **Miniplex** (ECS)
- **Math**: **decimal.js** / `break_infinity.js`

---

## 2. Core Gameplay Mechanics: "Hub & Logistics"

### A. The Zoning System

- **The Hub (City)**: Consumption, Population, Research, Admin.
- **The Spokes (Outposts)**: Extraction (Forest, Mountain, Plains).
- **The Connection**: Trucking Routes.

### B. Buildings Breakdown

#### 1. City Buildings (The Hub)

| Building            | Size | Cost        | Function                                                     |
| :------------------ | :--- | :---------- | :----------------------------------------------------------- |
| **Tenement**        | 1x1  | Wood        | **Housing**: Provides Pop Cap.                               |
| **Market**          | 2x2  | Wood/Stone  | **Economy**: Sells Refined/Packed goods for **Credits ($)**. |
| **Research Lab**    | 2x2  | Stone/Glass | **Tech**: Consumes Science/Time to generate **Tech Points**. |
| **Transport Depot** | 3x3  | Concrete    | **Logistics**: Increases Global Truck Pool & Speed.          |
| **Warehouse**       | 2x2  | Wood        | **Storage**: Increases resource cap.                         |
| **Town Hall**       | 3x3  | Steel       | **Admin**: Unlocks new Outposts & Policies.                  |

#### 2. Outpost Buildings (The Spokes)

| Building         | Type      | Function                 | Input            | Output         |
| :--------------- | :-------- | :----------------------- | :--------------- | :------------- |
| **Logging Camp** | Extractor | Harvests Trees.          | Terrain          | Raw Wood       |
| **Quarry**       | Extractor | Harvests Stone/Ore.      | Terrain          | Raw Stone/Ore  |
| **Sawmill**      | Processor | Refines Wood.            | Raw Wood         | Planks         |
| **Smelter**      | Processor | Refines Ore.             | Ore + Coal       | Metal Bars     |
| **Crate Packer** | Logistics | Compresses goods.        | 10 Wood + 5 Food | 1 Supply Crate |
| **Dock**         | Depot     | Staging area for Trucks. | -                | -              |

---

### C. Materials & Economy

#### 1. Currencies (Global)

- **Credits ($)**: Main currency. Earned by the **Market** consuming goods.
- **Tech Points**: Earned by **Research Labs**. Used for Unlocks.
- **Influence**: Prestige currency.

#### 2. Resources (Physical)

Resources must move physically to be useful.

- **Tier 1 (Raw)**: Wood, Stone, Iron Ore, Coal, Wheat.
  - _Source_: Extractors in Outposts.
- **Tier 2 (Refined)**: Planks, Bricks, Steel, Bread.
  - _Source_: Processors. Higher sell value.
- **Tier 3 (Logistics)**: **Supply Crates**.
  - _Logic_: "Packing".
  - _Recipe_: High volume of low-tier goods -> 1 Crate.
  - _Benefit_: Takes 1 Transport Slot but sells for high value or satisfies high Pop needs.

---

### D. Logistics System (The Trucks)

Resources in Outposts are useless until they reach the City.

#### 1. The Truck Entity

- **Properties**: `Speed`, `Capacity`, `TargetRoute`.
- **Behavior**:
  1.  Spawn at City Depot.
  2.  Drive to Outpost Dock (Distance / Speed).
  3.  Load Inventory (Up to `Capacity`).
  4.  Return to City.
  5.  Unload -> Resources added to Global City Stock.

#### 2. Upgrades

- **Road Quality**: Direct multiplier to Truck Speed.
- **Tillage / Engines**: Increases Truck Capacity.
- **Containerization**: Unlocks the "Crate Packer" building, allowing 10x resource density per truck trip.

---

### E. Population Mechanics

#### 1. Growth Loop

1.  **Housing Cap**: Pop cannot exceed Tenement capacity.
2.  **Feeding**: Pop consumes `Food` (Bread/Wheat) every Tick.
3.  **Growth**: If Food needs met, Pop increases by `+X/sec`.

#### 2. Happiness & Stability

- **Hunger**: If Food = 0, Happiness drops rapidly.
- **Consequence**:
  - High Happiness: +Bonus to Science & Market prices.
  - Low Happiness: -Production Speed, Potential Strike (0 production).

---

### F. Prestige System: "Corporate Acquisition"

#### 1. The Soft Reset

- **Theme**: You are a startup founder. You sell the city to a Mega-Corp.
- **Trigger**: Reach Net Worth (Credits + Asset Value) of $1B.
- **Result**: World Reset.

#### 2. Permanent Rewards

- **Currency**: **Stock Options**.
- **Upgrades (The Board Room)**:
  - **Seed Capital**: Start with $10k instead of $0.
  - **Permits**: Start with Forest & Mountain unlocked.
  - **Efficiency Consultants**: All buildings work 10% faster permanently.
  - **Nepotism**: Hiring Workers costs -50%.

---

## 3. Architecture Overview (Reference)

### A. The ECS World (Miniplex)

Entities are tagged with a `zoneId`.

- **Rendering**: `RenderSystem` draws `entity.zoneId === currentActiveZone`.
- **Simulation**: `ResourceSystem` runs on all entities (Background simulation).

### B. Directory Structure

```text
src/
├── app.ts                 # Entry point
├── core/
│   ├── ecs.ts             # Miniplex world
│   ├── grid.ts            # GridLookup Map
│   └── loop.ts            # Main Loop
├── systems/
│   ├── ResourceSystem.ts  # Production logic
│   ├── TransportSystem.ts # Truck movement logic
│   ├── PopSystem.ts       # Consumption/Growth logic
│   └── GridSystem.ts      # Adjacency bonuses
└── entities/              # Entity Factories
```

### C. The Grid (Hybrid Approach)

- **GridLookup**: `Map<"x,y", Entity>` for O(1) access.
- **Dirty Flags**: Adjacency bonuses only recalc on placement changes.
- **Input**: Calculated via `Math.floor(mouse.x / TILE_SIZE)`.
