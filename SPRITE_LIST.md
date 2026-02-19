# Asset Request List

Please provide sprites for the following categories.
**Recommended Format**: PNG (Transparent background).
**Recommended Size**:

- Tiles/Buildings: 64x64px (or 128x128px for HD)
- Icons: 32x32px
- Characters/Vehicles: 32x32px - 48x48px

---

## 1. Terrain & Environment (64x64px)

_The background tiles for the grid._

| Asset Name             | Description                                                  |
| :--------------------- | :----------------------------------------------------------- |
| `tile_city_ground`     | Pavement, concrete, or asphalt. The base floor for the City. |
| `tile_forest_ground`   | Grass with dead leaves, dirt paths, or mossy earth.          |
| `tile_mountain_ground` | Rocky ground, gray stone texture, maybe some snow.           |
| `tile_farm_ground`     | Tilled soil rows or bright green grass.                      |
| `prop_tree`            | A pine or oak tree (resource node). Should look harvestable. |
| `prop_ore_vein`        | A rock with visible iron/gold streaks (resource node).       |
| `prop_water`           | Water tile (for decoration or future docks).                 |

## 2. Buildings (64x64px)

_Structures placed on the grid._

### City Buildings

| Asset Name       | Description                                                      |
| :--------------- | :--------------------------------------------------------------- |
| `bldg_town_hall` | Grand building with a clock tower or pillars. The HQ.            |
| `bldg_tenement`  | Basic apartment block. Brick, multi-story, fire escape.          |
| `bldg_market`    | Stalls with colored awnings or a small shop front.               |
| `bldg_lab`       | High-tech looking building, white/blue, vents or satellite dish. |
| `bldg_depot`     | Garage doors, parking lot look. Where trucks spawn.              |
| `bldg_warehouse` | Large wooden or metal storage shed. Boxy.                        |

### Outpost Buildings

| Asset Name          | Description                                                        |
| :------------------ | :----------------------------------------------------------------- |
| `bldg_logging_camp` | Small wooden shack with axes or logs piled outside.                |
| `bldg_sawmill`      | Industrial shed with a large saw blade or detailed wood machinery. |
| `bldg_quarry_rig`   | Mining drill or crane structure. Industrial/Rusty.                 |
| `bldg_smelter`      | Furnace with a chimney/smoke. Glowing detail (optional).           |
| `bldg_farm_house`   | Rustic barn or farmhouse.                                          |
| `bldg_windmill`     | Traditional windmill (for flour processing).                       |
| `bldg_packer`       | Factory unit with conveyor belts or boxes stacked.                 |
| `bldg_dock`         | A loading platform with a crane.                                   |

## 3. Vehicles & Units (32x32px or 48x48px)

_Moving entities._

| Asset Name          | Description                                                      |
| :------------------ | :--------------------------------------------------------------- |
| `unit_truck_empty`  | A flatbed truck or pickup truck (empty bed).                     |
| `unit_truck_loaded` | The same truck but carrying crates/logs in the back.             |
| `unit_worker`       | Tiny person with a hardhat or overalls.                          |
| `unit_drone`        | (Optional) Flying drone if you want a sci-fi upgrade look later. |

## 4. Resource Icons (32x32px)

_Used in UI and floating bubbles._

### Raw

| Asset Name   | Description              |
| :----------- | :----------------------- |
| `icon_wood`  | A log or stack of logs.  |
| `icon_stone` | A grey rock pile.        |
| `icon_ore`   | Chunk of iron/metal ore. |
| `icon_wheat` | Sheaf of wheat.          |

### Refined

| Asset Name   | Description               |
| :----------- | :------------------------ |
| `icon_plank` | Sawn timber boards.       |
| `icon_brick` | Red clay brick.           |
| `icon_steel` | Shiny metal ingot/I-Beam. |
| `icon_flour` | White sack of flour.      |
| `icon_bread` | Loaf of bread.            |

### Logistics

| Asset Name          | Description                                     |
| :------------------ | :---------------------------------------------- |
| `icon_crate`        | Wooden shipping crate (generic).                |
| `icon_crate_packed` | High-tech or metal shipping container (Tier 2). |

## 5. UI Elements

| Asset Name          | Description                           |
| :------------------ | :------------------------------------ |
| `ui_coin`           | Gold coin or "$" symbol.              |
| `ui_science`        | Beaker or Blue Atom symbol.           |
| `ui_people`         | Silhouette of a person content/happy. |
| `ui_happiness_low`  | Sad or Angry face (for strikes).      |
| `ui_happiness_high` | Happy face.                           |

## 6. Tools & Cursors (32x32px or 48x48px)

_Cursors and action icons for the toolbar._

| Asset Name           | Description                                                     |
| :------------------- | :-------------------------------------------------------------- |
| `cursor_default`     | Stylized arrow cursor. Matches the UI theme.                    |
| `cursor_pointer`     | Hand cursor with index finger pointing (for clickable items).   |
| `cursor_grab`        | Open hand (for panning/dragging the map).                       |
| `cursor_grabbing`    | Closed hand (active dragging state).                            |
| `icon_tool_select`   | Default selection pointer or dashed selection box.              |
| `icon_tool_move`     | Four-directional arrow (`+` shape) or a crane hook layout.      |
| `icon_tool_bulldoze` | A small bulldozer or wrecking ball. Cleaner look for "Destroy". |
| `icon_tool_settings` | Gear or Cogwheel.                                               |
| `icon_tool_research` | Microscope or Flask (alternative to system button text).        |
