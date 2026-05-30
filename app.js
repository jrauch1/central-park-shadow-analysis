/* ============================================================================
 * app.js — Central Park incremental-shadow analysis
 *
 * Geometry
 * --------
 * For a flat-topped extruded building, the ground shadow is the convex hull of
 *   (footprint vertices) ∪ (footprint vertices translated by the shadow vector).
 * The shadow vector for a point at height h with sun altitude α and azimuth A:
 *   length d = h / tan(α)
 *   compass bearing of the shadow = (degrees(A)) mod 360
 *     (SunCalc azimuth is measured from due south, clockwise toward west;
 *      the shadow falls opposite the sun, which works out to A mod 360.)
 *
 * CEQR
 * ----
 * Representative days, an analysis window of [sunrise+90min, sunset-90min], and
 * an incremental-shadow duration computed per sun-sensitive resource by stepping
 * the sun across the window and testing point-in-shadow at each step.
 * ========================================================================== */

const FT_TO_M = 0.3048;
const STEP_MIN = 10;            // analysis time step (minutes)
const MAX_SHADOW_M = 6000;      // clamp absurd low-sun shadows

/* ---- CEQR representative days (year filled at runtime) ---- */
const CEQR_DAYS = [
  { id: 'mar21', label: 'Mar 21 — Spring equinox', m: 2,  d: 21 },
  { id: 'may06', label: 'May 6 / Aug 6 — Mid-season', m: 4, d: 6 },
  { id: 'jun21', label: 'Jun 21 — Summer solstice', m: 5, d: 21 },
  { id: 'dec21', label: 'Dec 21 — Winter solstice', m: 11, d: 21 }
];

/* ---------------------------------------------------------------- state ---- */
const state = {
  footprint: defaultFootprint(),   // array of [lat,lng]
  heightFt: 1100,
  ceqrMode: true,
  date: null,                      // Date for current day at midnight
  minutes: 12 * 60,               // current time of day, minutes
  showSweep: true,
  window: null                     // {start, end} minutes for current day
};

/* default: a Billionaires' Row supertall on Central Park South (W 57th St) */
function defaultFootprint() {
  const c = [40.7657, -73.9788];
  const dLat = 0.00022, dLng = 0.00030;   // ~40m x 50m slab
  return [
    [c[0] - dLat, c[1] - dLng],
    [c[0] - dLat, c[1] + dLng],
    [c[0] + dLat, c[1] + dLng],
    [c[0] + dLat, c[1] - dLng]
  ];
}

/* ------------------------------------------------------------------ map ---- */
const map = L.map('map', { zoomControl: true }).setView(CENTRAL_PARK_CENTER, 14);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap, © CARTO', subdomains: 'abcd', maxZoom: 20
}).addTo(map);

const parkLayer = L.polygon(CENTRAL_PARK_BOUNDARY, {
  color: '#3aa757', weight: 2, fillColor: '#3aa757', fillOpacity: 0.08, interactive: false
}).addTo(map);

const sweepLayer = L.layerGroup().addTo(map);   // cumulative day shadows
let shadowLayer = null;                          // current-time shadow
let buildingLayer = null;                        // footprint
const resourceMarkers = {};                      // id -> marker

/* draw resource markers */
RESOURCES.forEach(r => {
  const t = RESOURCE_TYPES[r.type] || { color: '#888' };
  const m = L.circleMarker([r.lat, r.lng], {
    radius: 6, color: '#0b0f12', weight: 1.5, fillColor: t.color, fillOpacity: 0.95
  }).addTo(map);
  m.bindPopup(resourcePopup(r));
  resourceMarkers[r.id] = m;
});

function resourcePopup(r, durMin) {
  const t = RESOURCE_TYPES[r.type] || {};
  const dur = (durMin != null)
    ? `<div style="margin-top:6px"><b>${fmtDur(durMin)}</b> of new shadow on the analysis day</div>` : '';
  return `<b>${r.name}</b><br><span style="color:#9fb0bd">${t.label}${r.sunSensitive ? ' · sun-sensitive' : ''}</span>
    <div style="margin-top:6px">${r.desc}</div>
    <div style="margin-top:6px"><b>Operator:</b> ${r.operator}</div>
    <div><b>Users:</b> ${r.users.join(', ')}</div>${dur}`;
}

/* ----------------------------------------------------- sun + shadow math --- */
function sunPosition(date, lat, lng) {
  const p = SunCalc.getPosition(date, lat, lng);
  return { altitude: p.altitude, azimuth: p.azimuth };   // radians
}

/* translate [lat,lng] by distance d (m) along compass bearing (deg, 0=N CW) */
function offset(lat, lng, d, bearingDeg) {
  const th = bearingDeg * Math.PI / 180;
  const dLat = (d * Math.cos(th)) / 111320;
  const dLng = (d * Math.sin(th)) / (111320 * Math.cos(lat * Math.PI / 180));
  return [lat + dLat, lng + dLng];
}

/* shadow polygon (array of [lat,lng]) for footprint at given sun position,
   or null if the sun is at/below the horizon */
function shadowPolygon(footprint, heightM, sun) {
  if (sun.altitude <= 0.01) return null;
  let d = heightM / Math.tan(sun.altitude);
  if (!isFinite(d) || d <= 0) return null;
  d = Math.min(d, MAX_SHADOW_M);
  const bearing = ((sun.azimuth * 180 / Math.PI) % 360 + 360) % 360;

  const pts = [];
  footprint.forEach(([la, ln]) => {
    pts.push([la, ln]);                               // base vertex
    pts.push(offset(la, ln, d, bearing));             // projected top vertex
  });
  return convexHull(pts);
}

/* Andrew's monotone chain on [lat,lng] (treats lng=x, lat=y) */
function convexHull(points) {
  const p = points.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const lower = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

/* ray-casting point-in-polygon; poly is [[lat,lng],...] */
function pointInPolygon(lat, lng, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1];
    const yj = poly[j][0], xj = poly[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/* --------------------------------------------------------- date helpers --- */
function makeDate(year, m, d, minutes) {
  const dt = new Date(year, m, d, 0, 0, 0, 0);
  dt.setMinutes(minutes);
  return dt;
}
function analysisWindow(date, lat, lng) {
  const times = SunCalc.getTimes(date, lat, lng);
  const toMin = t => t.getHours() * 60 + t.getMinutes();
  let start = toMin(times.sunrise) + 90;
  let end = toMin(times.sunset) - 90;
  if (end <= start) { start = 6 * 60; end = 18 * 60; }   // fallback (deep winter)
  return { start, end, sunrise: toMin(times.sunrise), sunset: toMin(times.sunset) };
}
function fmtClock(minutes) {
  let h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}
function fmtDur(min) {
  if (min <= 0) return '0 min';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m} min`;
}

/* ============================================================= rendering ===
 * render()         — full recompute: footprint, day-sweep, per-resource
 *                    durations. Call when building / height / date changes.
 * renderCurrent()  — cheap: just the current-time shadow + clock. Call while
 *                    scrubbing or animating the time slider.
 * ========================================================================== */
function render() {
  // draw building footprint
  if (buildingLayer) map.removeLayer(buildingLayer);
  buildingLayer = L.polygon(state.footprint, {
    color: '#f4c430', weight: 2, fillColor: '#f4c430', fillOpacity: 0.35
  }).addTo(map);
  buildingLayer.bindTooltip(`Proposed building · ${state.heightFt} ft`, { sticky: true });

  const year = state.date.getFullYear();
  const lat0 = state.footprint[0][0], lng0 = state.footprint[0][1];
  const heightM = state.heightFt * FT_TO_M;
  const win = state.window;

  // ---- analysis sweep across the window + per-resource duration ----
  sweepLayer.clearLayers();
  const counts = {};
  RESOURCES.forEach(r => counts[r.id] = 0);
  let steps = 0;

  for (let t = win.start; t <= win.end; t += STEP_MIN) {
    const dt = makeDate(year, state.date.getMonth(), state.date.getDate(), t);
    const s = sunPosition(dt, lat0, lng0);
    const sp = shadowPolygon(state.footprint, heightM, s);
    if (!sp) continue;
    steps++;
    if (state.showSweep) {
      L.polygon(sp, { stroke: false, fillColor: '#f4c430', fillOpacity: 0.045, interactive: false }).addTo(sweepLayer);
    }
    RESOURCES.forEach(r => { if (pointInPolygon(r.lat, r.lng, sp)) counts[r.id] += STEP_MIN; });
  }

  renderResults(counts, steps);
  renderCurrent();
}

function renderCurrent() {
  const year = state.date.getFullYear();
  const lat0 = state.footprint[0][0], lng0 = state.footprint[0][1];
  const heightM = state.heightFt * FT_TO_M;

  const now = makeDate(year, state.date.getMonth(), state.date.getDate(), state.minutes);
  const sun = sunPosition(now, lat0, lng0);
  if (shadowLayer) map.removeLayer(shadowLayer);
  const poly = shadowPolygon(state.footprint, heightM, sun);
  if (poly) {
    shadowLayer = L.polygon(poly, {
      color: '#1b2330', weight: 1, fillColor: '#0b0f16', fillOpacity: 0.55, interactive: false
    }).addTo(map);
  }

  const altDeg = (sun.altitude * 180 / Math.PI);
  document.getElementById('clock').textContent = fmtClock(state.minutes);
  document.getElementById('sunInfo').innerHTML = altDeg > 0
    ? `Sun altitude ${altDeg.toFixed(1)}°<br>azimuth ${(((sun.azimuth * 180 / Math.PI) + 180) % 360).toFixed(0)}° (from N)`
    : `Sun below horizon`;
}

function renderResults(counts, steps) {
  const impacted = RESOURCES
    .map(r => ({ r, dur: counts[r.id] }))
    .filter(x => x.dur > 0)
    .sort((a, b) => b.dur - a.dur);

  const sunSensitiveHit = impacted.filter(x => x.r.sunSensitive);
  const totalMaxDur = impacted.length ? impacted[0].dur : 0;

  // summary
  const summary = document.getElementById('summary');
  summary.innerHTML = `
    <div><span class="big">${impacted.length}</span> resources receive new shadow
      <span class="sub">(${sunSensitiveHit.length} sun-sensitive)</span></div>
    <div class="sub" style="margin-top:6px">Peak incremental shadow on any one resource:
      <b style="color:var(--text)">${fmtDur(totalMaxDur)}</b> over the analysis day.
      Window stepped every ${STEP_MIN} min (${steps} solar positions).</div>`;

  const list = document.getElementById('resourceList');
  list.innerHTML = '';
  if (!impacted.length) {
    document.getElementById('noImpact').style.display = 'block';
    return;
  }
  document.getElementById('noImpact').style.display = 'none';

  impacted.forEach(({ r, dur }) => {
    const t = RESOURCE_TYPES[r.type] || {};
    const cls = dur >= 120 ? 'high' : dur >= 45 ? 'mid' : 'low';
    const el = document.createElement('div');
    el.className = 'resource';
    el.innerHTML = `
      <div class="top">
        <div class="name"><span class="dot" style="background:${t.color}"></span>${r.name}
          ${r.sunSensitive ? '<span class="pill">sun-sensitive</span>' : ''}</div>
        <div class="dur ${cls}">${fmtDur(dur)}</div>
      </div>
      <div class="meta"><b>Operator:</b> ${r.operator}</div>
      <div class="users">${r.users.map(u => `<span class="pill">${u}</span>`).join('')}</div>`;
    el.addEventListener('click', () => {
      map.setView([r.lat, r.lng], 16, { animate: true });
      resourceMarkers[r.id].setPopupContent(resourcePopup(r, dur)).openPopup();
    });
    list.appendChild(el);
  });
}

/* recompute analysis window whenever date/footprint changes */
function refreshWindow() {
  const lat0 = state.footprint[0][0], lng0 = state.footprint[0][1];
  state.window = state.ceqrMode
    ? analysisWindow(state.date, lat0, lng0)
    : { start: 0, end: 1439, sunrise: 360, sunset: 1080 };

  const slider = document.getElementById('timeSlider');
  slider.min = state.window.start;
  slider.max = state.window.end;
  if (state.minutes < state.window.start) state.minutes = state.window.start;
  if (state.minutes > state.window.end) state.minutes = state.window.end;
  slider.value = state.minutes;

  document.getElementById('windowNote').innerHTML = state.ceqrMode
    ? `Analysis window <b>${fmtClock(state.window.start)} – ${fmtClock(state.window.end)}</b>
       (sunrise ${fmtClock(state.window.sunrise)}, sunset ${fmtClock(state.window.sunset)})`
    : `Full day (CEQR window off)`;
}

/* ================================================================== UI ===== */
function initUI() {
  const year = new Date(state.date ? state.date.getTime() : Date.now()).getFullYear();

  // CEQR day selector
  const daySel = document.getElementById('daySelect');
  CEQR_DAYS.forEach(d => {
    const o = document.createElement('option');
    o.value = d.id; o.textContent = d.label; daySel.appendChild(o);
  });
  daySel.value = 'jun21';

  // height
  document.getElementById('heightFt').value = state.heightFt;
  document.getElementById('heightFt').addEventListener('input', e => {
    state.heightFt = Math.max(0, +e.target.value || 0);
    document.getElementById('stories').value = Math.round(state.heightFt / 11);
    render();
  });
  document.getElementById('stories').addEventListener('input', e => {
    state.heightFt = Math.round((+e.target.value || 0) * 11);
    document.getElementById('heightFt').value = state.heightFt;
    render();
  });

  // date / day
  daySel.addEventListener('change', e => { setCeqrDay(e.target.value); });
  document.getElementById('customDate').addEventListener('change', e => {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split('-').map(Number);
    state.date = new Date(y, m - 1, d);
    refreshWindow(); render();
  });

  // CEQR mode toggle
  document.getElementById('ceqrToggle').addEventListener('click', e => {
    state.ceqrMode = !state.ceqrMode;
    e.target.classList.toggle('active', state.ceqrMode);
    e.target.textContent = state.ceqrMode ? 'CEQR window: ON' : 'CEQR window: OFF';
    refreshWindow(); render();
  });

  // time slider
  document.getElementById('timeSlider').addEventListener('input', e => {
    state.minutes = +e.target.value; renderCurrent();
  });

  // sweep toggle
  document.getElementById('sweepToggle').addEventListener('click', e => {
    state.showSweep = !state.showSweep;
    e.target.classList.toggle('active', state.showSweep);
    render();
  });

  // play / animate
  let playing = null;
  document.getElementById('playBtn').addEventListener('click', e => {
    if (playing) { clearInterval(playing); playing = null; e.target.textContent = '▶ Play day'; return; }
    e.target.textContent = '⏸ Pause';
    playing = setInterval(() => {
      state.minutes += 10;
      if (state.minutes > state.window.end) state.minutes = state.window.start;
      document.getElementById('timeSlider').value = state.minutes;
      renderCurrent();
    }, 120);
  });

  // locate by BBL
  document.getElementById('bblBtn').addEventListener('click',
    () => resolveBBL(document.getElementById('bblInput').value));
  document.getElementById('bblInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') resolveBBL(e.target.value);
  });

  // building drawing
  document.getElementById('drawBtn').addEventListener('click', startDrawing);
  document.getElementById('rectBtn').addEventListener('click', enableRectMode);
  document.getElementById('resetBtn').addEventListener('click', () => {
    state.footprint = defaultFootprint();
    map.setView(CENTRAL_PARK_CENTER, 14);
    refreshWindow(); render();
  });

  // legend
  const legend = document.getElementById('legend');
  Object.values(RESOURCE_TYPES).forEach(t => {
    const el = document.createElement('div');
    el.className = 'legend-item';
    el.innerHTML = `<span class="dot" style="background:${t.color}"></span>${t.label}`;
    legend.appendChild(el);
  });
}

function setCeqrDay(id) {
  const d = CEQR_DAYS.find(x => x.id === id);
  const year = state.date.getFullYear();
  state.date = new Date(year, d.m, d.d);
  document.getElementById('customDate').value =
    `${year}-${String(d.m + 1).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  refreshWindow(); render();
}

/* ---- footprint drawing (click vertices) ---- */
let drawing = false, drawPts = [], drawMarkers = [], drawLine = null;
function startDrawing() {
  drawing = true; drawPts = []; drawMarkers = [];
  if (drawLine) map.removeLayer(drawLine);
  document.getElementById('drawBanner').style.display = 'block';
  document.getElementById('drawBanner').textContent =
    'Click to add corners · double-click or press Enter to finish · Esc to cancel';
  map.on('click', onDrawClick);
  map.doubleClickZoom.disable();
  map.on('dblclick', finishDrawing);
}
function onDrawClick(e) {
  drawPts.push([e.latlng.lat, e.latlng.lng]);
  const mk = L.circleMarker(e.latlng, { radius: 4, color: '#f4c430', fillColor: '#f4c430', fillOpacity: 1 }).addTo(map);
  drawMarkers.push(mk);
  if (drawLine) map.removeLayer(drawLine);
  drawLine = L.polyline(drawPts, { color: '#f4c430', dashArray: '4 4' }).addTo(map);
}
function finishDrawing() {
  if (!drawing) return;
  if (drawPts.length >= 3) state.footprint = drawPts.slice();
  cancelDrawing();
  refreshWindow(); render();
}
function cancelDrawing() {
  drawing = false;
  map.off('click', onDrawClick);
  map.off('dblclick', finishDrawing);
  setTimeout(() => map.doubleClickZoom.enable(), 50);
  drawMarkers.forEach(m => map.removeLayer(m));
  if (drawLine) { map.removeLayer(drawLine); drawLine = null; }
  document.getElementById('drawBanner').style.display = 'none';
}

/* ---- locate site by BBL (NYC Open Data) ----
 * Building Footprints (5zhs-2jue) gives the real footprint polygon; PLUTO
 * (64uk-42ks) gives address, centroid, lot area and existing floor count.
 * For a lot with no building (vacant / redevelopment) we synthesize a square
 * footprint from the lot area at the PLUTO centroid.                          */
const BBL_BOROUGH = { 1: 'Manhattan', 2: 'Bronx', 3: 'Brooklyn', 4: 'Queens', 5: 'Staten Island' };

function bblStatus(html, isErr) {
  const el = document.getElementById('bblStatus');
  el.innerHTML = html;
  el.style.color = isErr ? 'var(--bad)' : 'var(--muted)';
}

/* signed area of a [lat,lng] ring in m² (local equirectangular) */
function ringAreaM2(ring) {
  if (ring.length < 3) return 0;
  const mx = 111320 * Math.cos(ring[0][0] * Math.PI / 180), my = 110540;
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][1] * mx) * (ring[i][0] * my) - (ring[i][1] * mx) * (ring[j][0] * my);
  }
  return s / 2;
}

/* pick the largest building polygon's outer ring, as [lat,lng] (open ring) */
function largestRing(footprints) {
  let best = null, bestA = 0;
  for (const f of footprints) {
    const g = f.the_geom;
    if (!g) continue;
    const polys = g.type === 'MultiPolygon' ? g.coordinates
                : g.type === 'Polygon' ? [g.coordinates] : [];
    for (const poly of polys) {
      const ring = poly[0].map(([ln, la]) => [la, ln]);
      const a = Math.abs(ringAreaM2(ring));
      if (a > bestA) { bestA = a; best = ring; }
    }
  }
  if (!best) return null;
  if (best.length > 1 &&
      best[0][0] === best[best.length - 1][0] && best[0][1] === best[best.length - 1][1]) best.pop();
  return { ring: best, area: bestA };
}

async function resolveBBL(raw) {
  const bbl = (raw || '').replace(/\D/g, '');
  if (bbl.length !== 10 || !BBL_BOROUGH[bbl[0]]) {
    bblStatus('Enter a valid 10-digit BBL — 1-digit borough (1–5) + 5-digit block + 4-digit lot.', true);
    return;
  }
  bblStatus(`Looking up BBL ${bbl} …`);
  const fpURL = `https://data.cityofnewyork.us/resource/5zhs-2jue.json?$where=base_bbl='${bbl}'&$select=the_geom,shape_area&$limit=100`;
  const plURL = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=bbl=${bbl}&$select=address,latitude,longitude,lotarea,numfloors,bldgclass&$limit=1`;
  try {
    const [fpRes, plRes] = await Promise.all([fetch(fpURL), fetch(plURL)]);
    const footprints = await fpRes.json();
    const pluto = (await plRes.json())[0];

    let source, footprint;
    const fp = largestRing(footprints || []);
    if (fp) {
      footprint = fp.ring;
      source = `existing building footprint (${Math.round(fp.area).toLocaleString()} m²)`;
    } else if (pluto && pluto.latitude && pluto.lotarea) {
      // vacant / no footprint → square from lot area at the centroid
      const lat = +pluto.latitude, lng = +pluto.longitude;
      const sideM = Math.sqrt(Math.max(50, +pluto.lotarea * 0.092903)); // ft² → m²
      const dLat = (sideM / 2) / 111320;
      const dLng = (sideM / 2) / (111320 * Math.cos(lat * Math.PI / 180));
      footprint = [[lat - dLat, lng - dLng], [lat - dLat, lng + dLng],
                   [lat + dLat, lng + dLng], [lat + dLat, lng - dLng]];
      source = `lot-area estimate (${(+pluto.lotarea).toLocaleString()} ft², no building on file)`;
    } else {
      bblStatus(`No footprint or lot found for BBL ${bbl} in NYC Open Data. Check the number, or place the building manually.`, true);
      return;
    }

    state.footprint = footprint;
    map.fitBounds(L.polygon(footprint).getBounds(), { maxZoom: 17, padding: [60, 60] });

    const floors = pluto && pluto.numfloors ? Math.round(+pluto.numfloors) : null;
    const addr = pluto && pluto.address ? pluto.address : '(address not in PLUTO)';
    const existing = floors ? ` · existing: ${floors} floor${floors === 1 ? '' : 's'} (~${Math.round(floors * 11)} ft)` : '';
    bblStatus(`<b style="color:var(--text)">${addr}</b>, ${BBL_BOROUGH[bbl[0]]}<br>Loaded ${source}${existing}. ` +
              `This is the <i>existing</i> footprint — edit corners or redraw for your proposed massing, then set the height above.`);

    refreshWindow();
    render();
  } catch (e) {
    bblStatus(`Lookup failed: ${e.message}. (NYC Open Data may be unreachable from this network.)`, true);
  }
}

/* ---- rectangle by pin + dimensions ---- */
let rectMode = false;
function enableRectMode() {
  rectMode = true;
  document.getElementById('drawBanner').style.display = 'block';
  document.getElementById('drawBanner').textContent = 'Click the map to drop the building center';
  map.once('click', e => {
    rectMode = false;
    document.getElementById('drawBanner').style.display = 'none';
    const w = +document.getElementById('rectW').value || 40;   // E-W meters
    const l = +document.getElementById('rectL').value || 50;   // N-S meters
    const lat = e.latlng.lat, lng = e.latlng.lng;
    const dLat = (l / 2) / 111320;
    const dLng = (w / 2) / (111320 * Math.cos(lat * Math.PI / 180));
    state.footprint = [
      [lat - dLat, lng - dLng], [lat - dLat, lng + dLng],
      [lat + dLat, lng + dLng], [lat + dLat, lng - dLng]
    ];
    refreshWindow(); render();
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && drawing) cancelDrawing();
  if (e.key === 'Enter' && drawing) finishDrawing();
});

/* ================================================================ boot ===== */
function boot() {
  const now = new Date();
  state.date = new Date(now.getFullYear(), 5, 21);   // default Jun 21
  initUI();
  setCeqrDay('jun21');
  document.getElementById('customDate').value =
    `${state.date.getFullYear()}-06-21`;
}
boot();
