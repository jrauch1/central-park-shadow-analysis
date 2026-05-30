# Central Park Shadow Study

A browser-based, screening-level **incremental-shadow analysis** tool for a proposed building near Central Park, following the logic of the **NYC CEQR Technical Manual, Ch. 8 (Shadows)**.

**Live app:** https://danielgolliher.github.io/central-park-shadow-analysis/

## What it does

- Place a proposed building by **BBL** (NYC Borough-Block-Lot — pulls the real footprint from NYC Open Data), by **drawing a footprint**, or by **dropping a pin + dimensions**. Set its height in feet or stories.
- Computes the building's ground shadow for any sun position and sweeps it across the CEQR **analysis window** (1.5 h after sunrise → 1.5 h before sunset) on the four representative days (Mar 21, May 6 / Aug 6, Jun 21, Dec 21).
- Reports every **sun-sensitive resource** that receives new shadow, sorted by **incremental shadow duration**, with each resource's **operator** (Central Park Conservancy, NYC Parks, WCS, concessionaires…) and **who uses it** (sports leagues, birders, the Model Yacht Club, audiences, families…).

## How it works

- **Sun position:** [SunCalc](https://github.com/mourner/suncalc).
- **Shadow geometry:** the building is modeled as a flat-topped extrusion; the ground shadow is the convex hull of the footprint and its sun-projected top (shadow length = height ÷ tan(sun altitude)).
- **BBL lookup:** NYC Open Data — Building Footprints (`5zhs-2jue`) for the polygon, PLUTO (`64uk-42ks`) for address / centroid / lot area / floors.
- **Map tiles:** CARTO basemaps over OpenStreetMap.

Pure static site — `index.html` + `app.js` + `data.js` + `styles.css`, no build step. Map tiles, SunCalc, and BBL lookups require internet.

## Limitations

Screening-level only. It models the proposed building **in isolation** — it does not subtract shadow already cast by existing buildings (true incremental-over-baseline), nor model terrain or the structure's own setbacks. Resource coordinates are approximate. For a defensible EIS, use 3-D massing in a CAD/GIS shadow model.

## Run locally

```
cd central-park-shadow-analysis
python3 -m http.server 8753
# open http://localhost:8753/
```
