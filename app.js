/* ============================================================================
 * app.js — Central Park Shadow Screening Tool
 *
 * Two-scenario incremental-shadow analysis (baseline vs. proposed) following
 * NYC CEQR Technical Manual Chapter 8 methodology.
 *
 * Phases implemented:
 *  1. Baseline vs. proposed scenario logic + true incremental shadow
 *  2. Area/coverage metrics via grid-sampled polygon intersection
 *  3. Resources-of-interest filter + rich metadata
 *  4. Day-rankings, seasonal summary, resource×time heatmap
 *  5. Mitigation matrix + CSV/memo export
 * ========================================================================== */

const FT_TO_M  = 0.3048;
const STEP_MIN = 10;
const MAX_SHADOW_M = 6000;

const CEQR_DAYS = [
  { id: 'mar21', label: 'Mar 21 — Spring equinox',      m: 2,  d: 21 },
  { id: 'may06', label: 'May 6 / Aug 6 — Mid-season',   m: 4,  d:  6 },
  { id: 'jun21', label: 'Jun 21 — Summer solstice',     m: 5,  d: 21 },
  { id: 'dec21', label: 'Dec 21 — Winter solstice',     m: 11, d: 21 }
];

/* ================================================================ data init ==
 * Merge RESOURCE_META + ADDITIONAL_RESOURCES into RESOURCES at boot.
 * Pre-compute centroid, sample grid, and area for each resource.          */

ADDITIONAL_RESOURCES.forEach(r => RESOURCES.push(r));

RESOURCES.forEach(r => {
  const meta = RESOURCE_META[r.id] || {};
  Object.assign(r, meta);

  if (RESOURCES_OF_INTEREST.has(r.id)) r.interestResource = true;

  const geom = GEOMETRIES[r.id];
  if (geom) {
    r._geom = geom;
    const [la, ln] = centroid(geom);
    r._lat = la; r._lng = ln;
    r._sampleGrid = buildSampleGrid(geom);
    r._areaAcres  = polygonAreaAcres(geom);
  } else {
    r._lat = r.lat; r._lng = r.lng;
    r._sampleGrid = [[r.lat, r.lng]];
    r._areaAcres  = 0.05;
  }
});

/* ====================================================== geometry utilities ==*/

function centroid(coords) {
  let la = 0, ln = 0;
  for (const [a, b] of coords) { la += a; ln += b; }
  return [la / coords.length, ln / coords.length];
}

function buildSampleGrid(coords, target = 120) {
  const lats = coords.map(c => c[0]);
  const lngs = coords.map(c => c[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat, dLng = maxLng - minLng;
  const aspect = dLng / (dLat + 1e-12);
  const nLat = Math.max(4, Math.round(Math.sqrt(target / Math.max(aspect, 0.1))));
  const nLng = Math.max(4, Math.round(nLat * aspect));
  const pts = [];
  for (let i = 0; i <= nLat; i++) {
    for (let j = 0; j <= nLng; j++) {
      const lat = minLat + (i / nLat) * dLat;
      const lng = minLng + (j / nLng) * dLng;
      if (pointInPolygon(lat, lng, coords)) pts.push([lat, lng]);
    }
  }
  return pts.length > 0 ? pts : [centroid(coords)];
}

function polygonAreaAcres(coords) {
  const n = coords.length;
  if (n < 3) return 0.05;
  const lat0 = coords.reduce((s, c) => s + c[0], 0) / n;
  const mLat = 110574;
  const mLng = 111320 * Math.cos(lat0 * Math.PI / 180);
  let area = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area += (coords[j][1] * mLng) * (coords[i][0] * mLat)
          - (coords[i][1] * mLng) * (coords[j][0] * mLat);
  }
  return Math.max(0.01, Math.abs(area) / 2 / 4046.86);
}

function offset(lat, lng, d, bearingDeg) {
  const th = bearingDeg * Math.PI / 180;
  const dLat = (d * Math.cos(th)) / 111320;
  const dLng = (d * Math.sin(th)) / (111320 * Math.cos(lat * Math.PI / 180));
  return [lat + dLat, lng + dLng];
}

function shadowPolygon(footprint, heightM, sun) {
  if (!footprint || heightM < 1 || sun.altitude <= 0.01) return null;
  let d = heightM / Math.tan(sun.altitude);
  if (!isFinite(d) || d <= 0) return null;
  d = Math.min(d, MAX_SHADOW_M);
  const bearing = ((sun.azimuth * 180 / Math.PI) % 360 + 360) % 360;
  const pts = [];
  footprint.forEach(([la, ln]) => {
    pts.push([la, ln]);
    pts.push(offset(la, ln, d, bearing));
  });
  return convexHull(pts);
}

function convexHull(points) {
  const p = points.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[1]-o[1])*(b[0]-o[0]) - (a[0]-o[0])*(b[1]-o[1]);
  const lower = [], upper = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  for (let i = p.length-1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function pointInPolygon(lat, lng, poly) {
  let inside = false;
  for (let i = 0, j = poly.length-1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1];
    const yj = poly[j][0], xj = poly[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj-xi)*(lat-yi)/(yj-yi)+xi))
      inside = !inside;
  }
  return inside;
}

/* ================================================================== state ===*/

function defaultProposed() {
  const c = [40.7657, -73.9788];
  const dLat = 0.00022, dLng = 0.00030;
  return [[c[0]-dLat,c[1]-dLng],[c[0]-dLat,c[1]+dLng],
          [c[0]+dLat,c[1]+dLng],[c[0]+dLat,c[1]-dLng]];
}

const state = {
  scenarios: {
    baseline: { footprint: null, heightFt: 0 },
    proposed: { footprint: defaultProposed(), heightFt: 1100 }
  },
  editing: 'proposed',
  ceqrMode: true,
  date: null,
  minutes: 12 * 60,
  showSweep: true,
  showBaseline: true,
  window: null,
  activeTab: 'results',
  filter: 'all',
  sortBy: 'incrDur',
  dayResults: {},
  seasonalResults: null,
  concernOverrides: {},
  currentDayId: 'jun21'
};

/* ================================================================== map =====*/

const map = L.map('map', { zoomControl: true }).setView(CENTRAL_PARK_CENTER, 14);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap, © CARTO', subdomains: 'abcd', maxZoom: 20
}).addTo(map);

L.polygon(CENTRAL_PARK_BOUNDARY, {
  color: '#3aa757', weight: 2, fillColor: '#3aa757', fillOpacity: 0.08, interactive: false
}).addTo(map);

const sweepBaseLayer = L.layerGroup().addTo(map);
const sweepPropLayer = L.layerGroup().addTo(map);
const sweepIncrLayer = L.layerGroup().addTo(map);
let shadowBaseLayer = null, shadowPropLayer = null, shadowIncrLayer = null;
let buildingBaseLayer = null, buildingPropLayer = null;
const resourceMarkers = {};

RESOURCES.forEach(r => {
  const t = RESOURCE_TYPES[r.type] || { color: '#888' };
  const geom = r._geom;
  let m;
  if (geom) {
    m = L.polygon(geom, {
      color: t.color, weight: 1.5, fillColor: t.color, fillOpacity: 0.30, interactive: true
    }).addTo(map);
  } else {
    m = L.circleMarker([r._lat, r._lng], {
      radius: 6, color: '#0b0f12', weight: 1.5, fillColor: t.color, fillOpacity: 0.95
    }).addTo(map);
  }
  m.bindPopup(() => resourcePopup(r));
  m.on('click', () => {
    const res = (state.dayResults[state.currentDayId] || {}).results || {};
    m.setPopupContent(resourcePopup(r, res[r.id]));
  });
  resourceMarkers[r.id] = m;
});

function resourcePopup(r, metrics) {
  const t = RESOURCE_TYPES[r.type] || {};
  const m = metrics;
  const durHtml = m && m.incrMin > 0
    ? `<div style="margin-top:6px"><b style="color:var(--accent)">${fmtDur(m.incrMin)}</b> incremental shadow
       &nbsp;·&nbsp; ${m.maxIncrPct.toFixed(0)}% max coverage
       &nbsp;·&nbsp; ${m.acreMin.toFixed(1)} acre-min</div>
       <div style="font-size:11px;color:#9fb0bd;margin-top:2px">
         Existing: ${fmtDur(m.existingMin)} &nbsp;·&nbsp; Proposed: ${fmtDur(m.proposedMin)}
       </div>` : '';
  return `<b>${r.name}</b><br>
    <span style="color:#9fb0bd">${t.label || r.type}${r.sunSensitive ? ' · sun-sensitive' : ''}</span>
    <div style="margin-top:6px">${r.desc || ''}</div>
    <div style="margin-top:4px"><b>Operator:</b> ${r.operator || '—'}</div>
    ${durHtml}`;
}

/* ====================================================== analysis core =======*/

function sunPosition(date, lat, lng) {
  const p = SunCalc.getPosition(date, lat, lng);
  return { altitude: p.altitude, azimuth: p.azimuth };
}

function makeDate(year, m, d, minutes) {
  const dt = new Date(year, m, d, 0, 0, 0, 0);
  dt.setMinutes(minutes);
  return dt;
}

function analysisWindow(date, lat, lng) {
  const times = SunCalc.getTimes(date, lat, lng);
  const toMin = t => t.getHours()*60 + t.getMinutes();
  let start = toMin(times.sunrise) + 90;
  let end   = toMin(times.sunset)  - 90;
  if (end <= start) { start = 6*60; end = 18*60; }
  return { start, end, sunrise: toMin(times.sunrise), sunset: toMin(times.sunset) };
}

/* Analyse a single CEQR day; returns {results, steps, win}. Cached. */
function analyzeDay(dayId) {
  const cacheKey = dayId + '_' + scenHash();
  if (state.dayResults[cacheKey]) return state.dayResults[cacheKey];

  const day  = CEQR_DAYS.find(d => d.id === dayId);
  const year = state.date.getFullYear();
  const prop = state.scenarios.proposed;
  const base = state.scenarios.baseline;
  const propFP = prop.footprint, propH = prop.heightFt * FT_TO_M;
  const baseFP = base.footprint, baseH = base.heightFt * FT_TO_M;

  const refPt = propFP ? propFP[0] : [40.7812, -73.9665];
  const date  = new Date(year, day.m, day.d);
  const win   = state.ceqrMode
    ? analysisWindow(date, refPt[0], refPt[1])
    : { start: 0, end: 1439, sunrise: 360, sunset: 1080 };

  const results = {};
  RESOURCES.forEach(r => {
    results[r.id] = {
      existingMin: 0, proposedMin: 0, incrMin: 0,
      firstIncrT: null, lastIncrT: null,
      maxIncrPct: 0, totalIncrPctSteps: 0, incrPctStepCount: 0,
      acreMin: 0
    };
  });

  let steps = 0;
  const timelineMap = {};  // rid -> array of step codes (0=none,1=existing,2=proposed,3=incr)
  RESOURCES.forEach(r => { timelineMap[r.id] = []; });

  for (let t = win.start; t <= win.end; t += STEP_MIN) {
    const dt  = makeDate(year, day.m, day.d, t);
    const sun = sunPosition(dt, refPt[0], refPt[1]);
    const propSp = shadowPolygon(propFP, propH, sun);
    const baseSp = (baseFP && baseH >= 1) ? shadowPolygon(baseFP, baseH, sun) : null;

    if (!propSp && !baseSp) {
      RESOURCES.forEach(r => timelineMap[r.id].push({ t, code: 0 }));
      continue;
    }
    steps++;

    RESOURCES.forEach(r => {
      const res     = results[r.id];
      const samples = r._sampleGrid;
      const n       = samples.length;
      let inBase = 0, inProp = 0;

      for (const [la, ln] of samples) {
        if (baseSp && pointInPolygon(la, ln, baseSp)) inBase++;
        if (propSp && pointInPolygon(la, ln, propSp)) inProp++;
      }
      const inIncr = inProp - Math.min(inBase, inProp);

      if (inBase  > 0) res.existingMin  += STEP_MIN;
      if (inProp  > 0) res.proposedMin  += STEP_MIN;
      if (inIncr  > 0) {
        res.incrMin += STEP_MIN;
        if (res.firstIncrT === null) res.firstIncrT = t;
        res.lastIncrT = t;
        const pct = (inIncr / n) * 100;
        if (pct > res.maxIncrPct) res.maxIncrPct = pct;
        res.totalIncrPctSteps += pct;
        res.incrPctStepCount++;
        res.acreMin += (pct / 100) * r._areaAcres * STEP_MIN;
      }

      // heatmap code
      let code = 0;
      if (inIncr > 0) code = 3;
      else if (inProp > 0) code = 2;
      else if (inBase > 0) code = 1;
      timelineMap[r.id].push({ t, code });
    });
  }

  RESOURCES.forEach(r => {
    const res = results[r.id];
    res.avgIncrPct = res.incrPctStepCount > 0
      ? res.totalIncrPctSteps / res.incrPctStepCount : 0;
  });

  const out = { results, steps, win, dayId, timelineMap };
  state.dayResults[cacheKey] = out;
  return out;
}

function scenHash() {
  const p = state.scenarios.proposed;
  const b = state.scenarios.baseline;
  const pfp = p.footprint ? p.footprint[0].join(',') : 'null';
  const bfp = b.footprint ? b.footprint[0].join(',') : 'null';
  return `${pfp}_${p.heightFt}_${bfp}_${b.heightFt}`;
}

function invalidateDayCache() {
  state.dayResults = {};
  state.seasonalResults = null;
}

/* ================================================= concern level logic ======*/

function computeConcern(r, metrics, seasonalDays) {
  if (!metrics || metrics.incrMin <= 0) return 'None';
  if (state.concernOverrides[r.id]) return state.concernOverrides[r.id];
  let score = 0;
  if (metrics.incrMin >= 120) score += 3;
  else if (metrics.incrMin >= 60) score += 2;
  else if (metrics.incrMin >= 30) score += 1;
  if (metrics.maxIncrPct >= 50) score += 3;
  else if (metrics.maxIncrPct >= 25) score += 2;
  else if (metrics.maxIncrPct >= 10) score += 1;
  if (seasonalDays >= 3) score += 2;
  else if (seasonalDays >= 2) score += 1;
  if (r.publicUseSensitivity === 'High') score += 2;
  else if (r.publicUseSensitivity === 'Medium') score += 1;
  if (r.useIntensity === 'High') score += 2;
  else if (r.useIntensity === 'Medium') score += 1;
  const highTheory = ['direct human activity','transportation comfort','circulation/safety'];
  if (r.impactTheory && r.impactTheory.some(t => highTheory.includes(t))) score += 1;
  if (score >= 9) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}

function concernBadge(level) {
  const cls = { High:'badge-high', Medium:'badge-medium', Low:'badge-low', None:'badge-none' }[level] || 'badge-none';
  return `<span class="badge ${cls}">${level}</span>`;
}

/* ============================================================= rendering ====*/

function render() {
  const prop = state.scenarios.proposed;
  const base = state.scenarios.baseline;

  /* building footprint layers */
  if (buildingPropLayer) map.removeLayer(buildingPropLayer);
  if (buildingBaseLayer) map.removeLayer(buildingBaseLayer);

  if (prop.footprint) {
    buildingPropLayer = L.polygon(prop.footprint, {
      color: '#f4c430', weight: 2, fillColor: '#f4c430', fillOpacity: 0.25, interactive: false
    }).addTo(map);
    buildingPropLayer.bindTooltip(`Proposed · ${prop.heightFt} ft`, { sticky: true });
  }
  if (base.footprint && base.heightFt > 0) {
    buildingBaseLayer = L.polygon(base.footprint, {
      color: '#4a7abf', weight: 2, fillColor: '#4a7abf', fillOpacity: 0.20, interactive: false, dashArray: '5 4'
    }).addTo(map);
    buildingBaseLayer.bindTooltip(`Existing · ${base.heightFt} ft`, { sticky: true });
  }

  const out = analyzeDay(state.currentDayId);

  /* day sweep */
  sweepBaseLayer.clearLayers();
  sweepPropLayer.clearLayers();
  sweepIncrLayer.clearLayers();

  if (state.showSweep) {
    const { day, year } = { day: CEQR_DAYS.find(d => d.id === state.currentDayId), year: state.date.getFullYear() };
    const propFP = prop.footprint, propH = prop.heightFt * FT_TO_M;
    const baseFP = base.footprint, baseH = base.heightFt * FT_TO_M;

    for (let t = out.win.start; t <= out.win.end; t += STEP_MIN) {
      const dt  = makeDate(year, day.m, day.d, t);
      const sun = sunPosition(dt, propFP ? propFP[0][0] : 40.7812, propFP ? propFP[0][1] : -73.9665);
      const pSp = shadowPolygon(propFP, propH, sun);
      const bSp = (baseFP && baseH >= 1) ? shadowPolygon(baseFP, baseH, sun) : null;

      if (bSp && state.showBaseline)
        L.polygon(bSp, { stroke:false, fillColor:'#4a7abf', fillOpacity:0.04, interactive:false }).addTo(sweepBaseLayer);
      if (pSp)
        L.polygon(pSp, { stroke:false, fillColor:'#f4c430', fillOpacity:0.035, interactive:false }).addTo(sweepPropLayer);
    }
  }

  renderResults(out);
  renderHeatmap(out);
  renderCurrent();
}

function renderCurrent() {
  const prop = state.scenarios.proposed;
  const base = state.scenarios.baseline;
  const year = state.date.getFullYear();
  const day  = CEQR_DAYS.find(d => d.id === state.currentDayId) || CEQR_DAYS[0];
  const ref  = prop.footprint ? prop.footprint[0] : [40.7812, -73.9665];

  const now = makeDate(year, day.m, day.d, state.minutes);
  const sun = sunPosition(now, ref[0], ref[1]);

  const propSp = shadowPolygon(prop.footprint, prop.heightFt * FT_TO_M, sun);
  const baseSp = (base.footprint && base.heightFt >= 1)
    ? shadowPolygon(base.footprint, base.heightFt * FT_TO_M, sun) : null;

  if (shadowPropLayer) map.removeLayer(shadowPropLayer);
  if (shadowBaseLayer) map.removeLayer(shadowBaseLayer);
  if (shadowIncrLayer) map.removeLayer(shadowIncrLayer);

  if (baseSp && state.showBaseline) {
    shadowBaseLayer = L.polygon(baseSp, {
      stroke: false, fillColor: '#2a4a7f', fillOpacity: 0.50, interactive: false
    }).addTo(map);
  }
  if (propSp) {
    shadowPropLayer = L.polygon(propSp, {
      color: '#0b0f16', weight: 1, fillColor: '#0b0f16', fillOpacity: 0.45, interactive: false
    }).addTo(map);
  }

  const altDeg = sun.altitude * 180 / Math.PI;
  document.getElementById('clock').textContent = fmtClock(state.minutes);
  document.getElementById('sunInfo').innerHTML = altDeg > 0
    ? `Sun alt ${altDeg.toFixed(1)}°<br>az ${(((sun.azimuth*180/Math.PI)+180)%360).toFixed(0)}°`
    : 'Sun below horizon';
}

/* ============================================================ result tabs ===*/

function filteredResources(results) {
  return RESOURCES.filter(r => {
    if (state.filter === 'interest')      return r.interestResource;
    if (state.filter === 'sun-sensitive') return r.sunSensitive;
    if (state.filter === 'human-use')     return r.impactTheory && r.impactTheory.some(t => ['direct human activity','visitor comfort','transportation comfort','circulation/safety'].includes(t));
    if (state.filter === 'ecological')    return r.impactTheory && r.impactTheory.some(t => ['ecological/natural resource'].includes(t));
    if (state.filter === 'mitigation')    return r.mitigationCandidate;
    return true;
  }).filter(r => results ? results[r.id].incrMin > 0 : true);
}

function getSeasonalDays(rid) {
  if (!state.seasonalResults) return 0;
  return CEQR_DAYS.filter(d => (state.seasonalResults[d.id] || {})[rid]?.incrMin > 0).length;
}

function renderResults(out) {
  const { results, steps } = out;
  let visible = RESOURCES.filter(r => results[r.id].incrMin > 0);
  const sunHit = visible.filter(r => r.sunSensitive).length;

  document.getElementById('summary').innerHTML = `
    <div><span class="big">${visible.length}</span> resources receive incremental shadow
      <span class="sub">(${sunHit} sun-sensitive)</span></div>
    <div class="scenario-row">
      <span class="scen-stat"><b>Baseline:</b> ${state.scenarios.baseline.heightFt} ft</span>
      <span class="scen-stat"><b>Proposed:</b> ${state.scenarios.proposed.heightFt} ft</span>
      <span class="sub">${steps} steps · ${STEP_MIN}-min interval</span>
    </div>`;

  if (state.activeTab === 'results')  renderResultsTab(results, steps);
  if (state.activeTab === 'context')  renderContextTab(results);
  if (state.activeTab === 'mitigation') renderMitigationTab(results);

  updateAssumptionsNote();
}

function sortedResources(results) {
  const all = RESOURCES.map(r => ({ r, m: results[r.id] })).filter(x => x.m.incrMin > 0);
  const sb = state.sortBy;
  return all.sort((a, b) => {
    if (sb === 'incrDur') return b.m.incrMin - a.m.incrMin;
    if (sb === 'maxPct')  return b.m.maxIncrPct - a.m.maxIncrPct;
    if (sb === 'avgPct')  return b.m.avgIncrPct - a.m.avgIncrPct;
    if (sb === 'acreMin') return b.m.acreMin - a.m.acreMin;
    return 0;
  });
}

function renderResultsTab(results, steps) {
  const list = document.getElementById('resourceList');
  const noImpact = document.getElementById('noImpact');
  list.innerHTML = '';

  const sorted = sortedResources(results);
  const filtered = sorted.filter(({r}) => resourcePassesFilter(r));

  if (!filtered.length) { noImpact.style.display = 'block'; return; }
  noImpact.style.display = 'none';

  filtered.forEach(({ r, m }) => {
    const t    = RESOURCE_TYPES[r.type] || {};
    const cl   = m.incrMin >= 120 ? 'high' : m.incrMin >= 45 ? 'medium' : 'low';
    const seaDays = getSeasonalDays(r.id);
    const concern = computeConcern(r, m, seaDays);
    const el   = document.createElement('div');
    el.className = 'resource';
    el.innerHTML = `
      <div class="r-top">
        <div class="r-name"><span class="dot" style="background:${t.color}"></span>${r.name}</div>
        <div class="r-badges">
          ${r.interestResource ? '<span class="badge badge-priority">★ Priority</span>' : ''}
          ${concernBadge(concern)}
        </div>
      </div>
      <div class="r-metrics">
        <span class="r-metric-label">Incremental</span>
        <span class="r-metric-val" style="color:var(--accent)">${fmtDur(m.incrMin)}</span>
        <span class="r-metric-label">Max coverage</span>
        <span class="r-metric-val">${m.maxIncrPct.toFixed(0)}%</span>
        <span class="r-metric-label">Avg coverage</span>
        <span class="r-metric-val">${m.avgIncrPct.toFixed(0)}%</span>
        <span class="r-metric-label">Acre-minutes</span>
        <span class="r-metric-val">${m.acreMin.toFixed(1)}</span>
      </div>
      <div class="r-scenario-row">
        <span class="r-scen"><b>Existing:</b> ${fmtDur(m.existingMin)}</span>
        <span class="r-scen"><b>Proposed:</b> ${fmtDur(m.proposedMin)}</span>
      </div>
      ${m.firstIncrT != null ? `<div class="r-time-range">Incremental shadow: ${fmtClock(m.firstIncrT)} – ${fmtClock(m.lastIncrT)}</div>` : ''}`;
    el.addEventListener('click', () => {
      map.setView([r._lat, r._lng], 16, { animate: true });
      resourceMarkers[r.id].setPopupContent(resourcePopup(r, m)).openPopup();
    });
    list.appendChild(el);
  });
}

function renderContextTab(results) {
  const list = document.getElementById('contextList');
  list.innerHTML = '';
  RESOURCES.filter(r => resourcePassesFilter(r)).forEach(r => {
    const m = results[r.id];
    const seaDays = getSeasonalDays(r.id);
    const concern = computeConcern(r, m, seaDays);
    const t = RESOURCE_TYPES[r.type] || {};
    const el = document.createElement('div');
    el.className = 'ctx-card';
    el.innerHTML = `
      <div class="ctx-name"><span class="dot" style="background:${t.color}"></span>${r.name}
        ${r.sunSensitive ? '<span class="badge badge-ss" style="margin-left:6px">sun-sensitive</span>' : ''}
        ${r.interestResource ? '<span class="badge badge-priority" style="margin-left:4px">★</span>' : ''}
      </div>
      <div class="ctx-grid">
        <span class="ctx-label">Primary use</span><span class="ctx-val">${r.primaryUse || '—'}</span>
        <span class="ctx-label">Public-use sens.</span><span class="ctx-val">${r.publicUseSensitivity || '—'}</span>
        <span class="ctx-label">Use intensity</span><span class="ctx-val">${r.useIntensity || '—'}</span>
        <span class="ctx-label">Seasonal</span><span class="ctx-val">${r.seasonalSensitivity || '—'}</span>
        <span class="ctx-label">Time of day</span><span class="ctx-val">${r.timeOfDaySensitivity || '—'}</span>
        <span class="ctx-label">Impact theory</span><span class="ctx-val">${(r.impactTheory||[]).join(', ') || '—'}</span>
        <span class="ctx-label">Incremental</span><span class="ctx-val" style="color:var(--accent)">${fmtDur(m.incrMin)}</span>
      </div>
      <div class="ctx-concern-row">
        <label>Screening concern:</label>
        <select data-rid="${r.id}" class="concern-sel">
          <option value="">Auto (${concern})</option>
          <option value="High"   ${state.concernOverrides[r.id]==='High'   ?'selected':''}>High</option>
          <option value="Medium" ${state.concernOverrides[r.id]==='Medium' ?'selected':''}>Medium</option>
          <option value="Low"    ${state.concernOverrides[r.id]==='Low'    ?'selected':''}>Low</option>
          <option value="None"   ${state.concernOverrides[r.id]==='None'   ?'selected':''}>None / N/A</option>
        </select>
      </div>`;
    el.querySelector('.concern-sel').addEventListener('change', e => {
      const val = e.target.value;
      if (val) state.concernOverrides[r.id] = val;
      else delete state.concernOverrides[r.id];
    });
    list.appendChild(el);
  });
}

function renderMitigationTab(results) {
  const list = document.getElementById('mitigationList');
  list.innerHTML = '';
  RESOURCES.filter(r => resourcePassesFilter(r) && (results[r.id].incrMin > 0 || r.mitigationCandidate)).forEach(r => {
    const t = RESOURCE_TYPES[r.type] || {};
    const el = document.createElement('div');
    el.className = 'mit-card';
    el.innerHTML = `
      <div class="mit-name">
        <span><span class="dot" style="background:${t.color}"></span>${r.name}</span>
        ${r.mitigationCandidate ? '<span class="badge badge-medium">Mitigation candidate</span>' : ''}
      </div>
      ${r.possibleCritique ? `<div class="mit-critique">${r.possibleCritique}</div>` : ''}
      ${r.mitigationMeasure ? `<div class="mit-measure">${r.mitigationMeasure}</div>` : ''}
      <div class="mit-grid">
        <span class="mit-label">Category</span><span class="mit-val">${r.mitigationCategory || '—'}</span>
        <span class="mit-label">Cost range</span><span class="mit-val">${r.roughCostRange || '—'}</span>
        <span class="mit-label">Partner</span><span class="mit-val">${r.implementationPartner || '—'}</span>
        <span class="mit-label">Feasibility</span><span class="mit-val">${r.feasibility || '—'}</span>
      </div>`;
    list.appendChild(el);
  });
  if (!list.children.length) list.innerHTML = '<p class="hint">No mitigation candidates match the current filter.</p>';
}

function resourcePassesFilter(r) {
  if (state.filter === 'interest')      return !!r.interestResource;
  if (state.filter === 'sun-sensitive') return !!r.sunSensitive;
  if (state.filter === 'human-use')     return (r.impactTheory||[]).some(t => ['direct human activity','visitor comfort','transportation comfort','circulation/safety'].includes(t));
  if (state.filter === 'ecological')    return (r.impactTheory||[]).includes('ecological/natural resource');
  if (state.filter === 'mitigation')    return !!r.mitigationCandidate;
  return true;
}

/* ============================================================ heatmap =======*/

function renderHeatmap(out) {
  const { timelineMap } = out;
  const container = document.getElementById('heatmap');
  if (!container) return;

  const visible = RESOURCES.filter(r => resourcePassesFilter(r));
  if (!visible.length || !timelineMap) { container.innerHTML = '<p class="hint">No resources to display.</p>'; return; }

  // Get time steps from first resource's timeline
  const firstTimeline = timelineMap[visible[0].id] || [];
  if (!firstTimeline.length) { container.innerHTML = ''; return; }

  let html = '<table class="heatmap-tbl"><tbody>';
  visible.forEach(r => {
    const tl = timelineMap[r.id] || [];
    html += `<tr><td class="hm-label" title="${r.name}">${r.name.substring(0,22)}</td>`;
    tl.forEach(({ code }) => {
      const cls = ['hm-none','hm-existing','hm-proposed','hm-incr'][code] || 'hm-none';
      html += `<td class="hm-cell ${cls}"></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

/* ============================================================ seasonal ======*/

function runAllDays() {
  document.getElementById('seasonalStatus').textContent = 'Analyzing…';
  const seasonalResults = {};
  CEQR_DAYS.forEach(day => {
    const out = analyzeDay(day.id);
    seasonalResults[day.id] = out.results;
  });
  state.seasonalResults = seasonalResults;

  const totals = {};
  RESOURCES.forEach(r => {
    totals[r.id] = CEQR_DAYS.reduce((s, d) => s + (seasonalResults[d.id][r.id]?.incrMin || 0), 0);
  });

  const affected = RESOURCES.filter(r => totals[r.id] > 0)
    .sort((a, b) => totals[b.id] - totals[a.id]);

  if (!affected.length) {
    document.getElementById('seasonalTable').innerHTML = '<p class="hint">No resources affected across any CEQR day.</p>';
    document.getElementById('seasonalStatus').textContent = 'Analysis complete.';
    return;
  }

  let html = `<table class="seasonal-tbl">
    <thead><tr>
      <th>Resource</th>
      <th>Dec 21</th><th>Mar 21</th><th>May 6</th><th>Jun 21</th><th>Total</th>
    </tr></thead><tbody>`;

  affected.forEach(r => {
    const cells = CEQR_DAYS.map(d => {
      const min = (seasonalResults[d.id][r.id] || {}).incrMin || 0;
      return min > 0 ? `<td class="seas-hit">${fmtDur(min)}</td>`
                     : '<td class="seas-none">—</td>';
    });
    const reordered = [cells[3], cells[0], cells[1], cells[2]]; // dec, mar, may, jun
    html += `<tr>
      <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis" title="${r.name}">${r.name.substring(0,18)}</td>
      ${reordered.join('')}
      <td class="seas-total">${fmtDur(totals[r.id])}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('seasonalTable').innerHTML = html;
  document.getElementById('seasonalStatus').textContent = `${affected.length} resources affected across CEQR days.`;

  // Re-render results with seasonal recurrence data
  const out = analyzeDay(state.currentDayId);
  renderResults(out);
}

/* ============================================================ export ========*/

function exportCsv() {
  const out = analyzeDay(state.currentDayId);
  const { results } = out;
  const rows = [
    ['Resource ID','Resource Name','Type','Sun-Sensitive','Priority','Impact Theory',
     'Existing Shadow (min)','Proposed Shadow (min)','Incremental Shadow (min)',
     'First Incremental','Last Incremental','Max Coverage %','Avg Coverage %',
     'Acre-Minutes','Screening Concern','Mitigation Candidate','CEQR Day']
  ];
  RESOURCES.forEach(r => {
    const m = results[r.id];
    const seaDays = getSeasonalDays(r.id);
    const concern = computeConcern(r, m, seaDays);
    rows.push([
      r.id, r.name, r.type, r.sunSensitive?'Yes':'No',
      r.interestResource?'Yes':'No',
      (r.impactTheory||[]).join('; '),
      m.existingMin, m.proposedMin, m.incrMin,
      m.firstIncrT != null ? fmtClock(m.firstIncrT) : '',
      m.lastIncrT  != null ? fmtClock(m.lastIncrT)  : '',
      m.maxIncrPct.toFixed(1), m.avgIncrPct.toFixed(1), m.acreMin.toFixed(2),
      concern, r.mitigationCandidate?'Yes':'No',
      CEQR_DAYS.find(d => d.id === state.currentDayId)?.label || state.currentDayId
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadText(csv, `cp-shadow-${state.currentDayId}.csv`, 'text/csv');
}

function exportMemo() {
  const out = analyzeDay(state.currentDayId);
  const { results } = out;
  const prop = state.scenarios.proposed;
  const base = state.scenarios.baseline;

  const sorted = RESOURCES
    .map(r => ({ r, m: results[r.id] }))
    .filter(x => x.m.incrMin > 0)
    .sort((a, b) => b.m.incrMin - a.m.incrMin);

  const topResource = sorted[0];
  const highConcern = sorted.filter(({r, m}) => {
    const c = computeConcern(r, m, getSeasonalDays(r.id));
    return c === 'High';
  });
  const dayLabel = CEQR_DAYS.find(d => d.id === state.currentDayId)?.label || state.currentDayId;
  const plural = s => s === 1 ? '' : 's';

  let memo = `CENTRAL PARK SHADOW ANALYSIS — SCREENING-LEVEL MEMO
=======================================================
Analysis Date: ${new Date().toLocaleDateString()}
CEQR Analysis Day: ${dayLabel}
Time-Step Interval: ${STEP_MIN} minutes
Baseline Building: ${base.heightFt > 0 ? base.heightFt + ' ft (existing/as-of-right)' : 'No existing building (height = 0 ft)'}
Proposed Building: ${prop.heightFt} ft (proposed/discretionary)
Resource Polygon Source: OpenStreetMap (OSM/ODbL) — screening-level, not survey-certified
Tree Canopy: Excluded
Analysis Type: Screening-level; not a CEQR-significance determination

SUMMARY
-------
On ${dayLabel}, incremental shadow from the proposed building reaches ${sorted.length} park resource${plural(sorted.length)}, of which ${sorted.filter(x=>x.r.sunSensitive).length} are sun-sensitive.

`;

  if (topResource) {
    memo += `The most significantly affected resource is ${topResource.r.name}, which receives ${fmtDur(topResource.m.incrMin)} of incremental shadow with a maximum instantaneous coverage of ${topResource.m.maxIncrPct.toFixed(0)}% of the resource area (${topResource.m.acreMin.toFixed(1)} shadow-acre-minutes).

`;
  }

  if (state.seasonalResults) {
    const seasonalAffected = RESOURCES.filter(r =>
      CEQR_DAYS.some(d => (state.seasonalResults[d.id]?.[r.id]?.incrMin || 0) > 0)
    );
    const recurring = seasonalAffected.filter(r =>
      CEQR_DAYS.filter(d => (state.seasonalResults[d.id]?.[r.id]?.incrMin || 0) > 0).length >= 2
    );
    if (recurring.length) {
      memo += `${recurring.length} resource${plural(recurring.length)} receive incremental shadow on two or more CEQR analysis days, indicating a recurrent seasonal pattern: ${recurring.map(r=>r.name).join(', ')}.

`;
    }
  }

  memo += `AFFECTED RESOURCES — ${dayLabel.toUpperCase()}
${'─'.repeat(50)}
`;
  sorted.forEach(({ r, m }) => {
    const seaDays = getSeasonalDays(r.id);
    const concern = computeConcern(r, m, seaDays);
    memo += `
${r.name}
  Existing shadow:     ${fmtDur(m.existingMin)}
  Proposed shadow:     ${fmtDur(m.proposedMin)}
  Incremental shadow:  ${fmtDur(m.incrMin)}  (${m.firstIncrT != null ? fmtClock(m.firstIncrT) + ' – ' + fmtClock(m.lastIncrT) : 'N/A'})
  Max coverage:        ${m.maxIncrPct.toFixed(0)}%
  Avg coverage:        ${m.avgIncrPct.toFixed(0)}%
  Shadow-acre-minutes: ${m.acreMin.toFixed(1)}
  Impact theory:       ${(r.impactTheory||[]).join(', ') || '—'}
  Screening concern:   ${concern}
  Mitigation:          ${r.mitigationCandidate ? r.mitigationMeasure || 'Candidate — see mitigation tab' : 'Not identified as candidate'}
`;
  });

  memo += `
CONCLUSIONS
-----------
Based on this screening-level analysis, `;
  if (highConcern.length) {
    memo += `${highConcern.map(x=>x.r.name).join(', ')} ${highConcern.length === 1 ? 'appears' : 'appear'} to warrant further consultant review given the duration, coverage, and sensitivity of the resource${plural(highConcern.length)}. `;
  }
  const lowConcern = sorted.filter(({r,m}) => computeConcern(r, m, getSeasonalDays(r.id)) === 'Low');
  if (lowConcern.length) {
    memo += `Other resources (${lowConcern.map(x=>x.r.name).join(', ')}) do not appear to show concentrated or recurrent incremental shadow effects based on this screening.`;
  }

  memo += `

DISCLAIMER
----------
This is a screening-level analysis, not a CEQR-significance determination. Results are
approximate and intended for initial study, not a certified environmental impact statement.
For a defensible EIS, use 3-D CAD/GIS shadow modeling with certified consultant review.
`;

  downloadText(memo, `cp-shadow-memo-${state.currentDayId}.txt`, 'text/plain');
}

/* ============================================================ all-days exports */

function ensureAllDays() {
  CEQR_DAYS.forEach(day => analyzeDay(day.id));
  if (!state.seasonalResults) {
    const sr = {};
    CEQR_DAYS.forEach(day => { sr[day.id] = analyzeDay(day.id).results; });
    state.seasonalResults = sr;
  }
}

function exportCsvAllDays() {
  ensureAllDays();
  const prop = state.scenarios.proposed;
  const base = state.scenarios.baseline;

  // Header row
  const header = [
    'Resource ID', 'Resource Name', 'Type', 'Sun-Sensitive', 'Priority',
    'Impact Theory', 'Mitigation Candidate', 'Concern Level (overall)'
  ];
  CEQR_DAYS.forEach(d => {
    const lbl = d.id.toUpperCase();
    header.push(
      `${lbl} Existing (min)`, `${lbl} Proposed (min)`, `${lbl} Incremental (min)`,
      `${lbl} Max Coverage %`, `${lbl} Avg Coverage %`, `${lbl} Acre-Minutes`
    );
  });
  header.push('Total Incremental (min)', 'Total Incremental (formatted)', 'CEQR Days Affected');

  const rows = [header];

  RESOURCES.forEach(r => {
    const dayMetrics = CEQR_DAYS.map(d => state.seasonalResults[d.id][r.id]);
    const totalIncr  = dayMetrics.reduce((s, m) => s + m.incrMin, 0);
    const daysHit    = dayMetrics.filter(m => m.incrMin > 0).length;
    const worstDay   = dayMetrics.reduce((best, m) => m.incrMin > best.incrMin ? m : best, dayMetrics[0]);
    const concern    = computeConcern(r, worstDay, daysHit);

    const row = [
      r.id, r.name, r.type,
      r.sunSensitive ? 'Yes' : 'No',
      r.interestResource ? 'Yes' : 'No',
      (r.impactTheory || []).join('; '),
      r.mitigationCandidate ? 'Yes' : 'No',
      concern
    ];
    dayMetrics.forEach(m => {
      row.push(m.existingMin, m.proposedMin, m.incrMin,
               m.maxIncrPct.toFixed(1), m.avgIncrPct.toFixed(1), m.acreMin.toFixed(2));
    });
    row.push(totalIncr, fmtDur(totalIncr), daysHit);
    rows.push(row);
  });

  // Assumptions footer
  rows.push([]);
  rows.push(['Assumptions']);
  rows.push(['Baseline height (ft)', base.heightFt]);
  rows.push(['Proposed height (ft)', prop.heightFt]);
  rows.push(['Time-step (min)', STEP_MIN]);
  rows.push(['CEQR days', CEQR_DAYS.map(d => d.label).join(' | ')]);
  rows.push(['Resource polygons', 'OpenStreetMap (OSM/ODbL) — screening-level']);
  rows.push(['Tree canopy', 'Excluded']);
  rows.push(['Analysis type', 'Screening-level; not a CEQR significance determination']);

  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadText(csv, 'cp-shadow-all-ceqr-days.csv', 'text/csv');
}

function exportMemoAllDays() {
  ensureAllDays();
  const prop = state.scenarios.proposed;
  const base = state.scenarios.baseline;

  const totals = {};
  RESOURCES.forEach(r => {
    totals[r.id] = CEQR_DAYS.reduce((s, d) => s + (state.seasonalResults[d.id][r.id]?.incrMin || 0), 0);
  });

  const overallAffected = RESOURCES
    .filter(r => totals[r.id] > 0)
    .sort((a, b) => totals[b.id] - totals[a.id]);

  const daysHitMap = {};
  RESOURCES.forEach(r => {
    daysHitMap[r.id] = CEQR_DAYS.filter(d => (state.seasonalResults[d.id][r.id]?.incrMin || 0) > 0).length;
  });

  const worstDayMetric = r => CEQR_DAYS
    .map(d => state.seasonalResults[d.id][r.id])
    .reduce((best, m) => m.incrMin > best.incrMin ? m : best);

  const overallConcern = r => computeConcern(r, worstDayMetric(r), daysHitMap[r.id]);

  const highC = overallAffected.filter(r => overallConcern(r) === 'High');
  const midC  = overallAffected.filter(r => overallConcern(r) === 'Medium');
  const recurring = overallAffected.filter(r => daysHitMap[r.id] >= 2);

  const line = '─'.repeat(56);

  let memo = `CENTRAL PARK SHADOW ANALYSIS — FULL SEASONAL SCREENING MEMO
${'='.repeat(60)}
Analysis Date: ${new Date().toLocaleDateString()}
CEQR Analysis Days: Mar 21, May 6/Aug 6, Jun 21, Dec 21 (all four)
Time-Step Interval: ${STEP_MIN} minutes
Baseline Building: ${base.heightFt > 0 ? base.heightFt + ' ft (existing/as-of-right)' : 'No existing building (height = 0 ft)'}
Proposed Building: ${prop.heightFt} ft (proposed/discretionary)
Resource Polygon Source: OpenStreetMap (OSM/ODbL) — screening-level
Tree Canopy: Excluded
Analysis Type: Screening-level; not a CEQR significance determination

OVERALL SUMMARY
${line}
Across all four CEQR analysis days, incremental shadow from the proposed
building reaches ${overallAffected.length} park resource${overallAffected.length === 1 ? '' : 's'} on at least one analysis day.

`;

  if (recurring.length) {
    memo += `${recurring.length} resource${recurring.length === 1 ? '' : 's'} receive incremental shadow on two or more analysis days,
indicating a recurrent seasonal pattern:
${recurring.map(r => `  • ${r.name} (${daysHitMap[r.id]} of 4 days, total ${fmtDur(totals[r.id])})`).join('\n')}

`;
  }

  if (highC.length) {
    memo += `Resources rising to HIGH screening concern:
${highC.map(r => `  • ${r.name}`).join('\n')}

`;
  }
  if (midC.length) {
    memo += `Resources at MEDIUM screening concern:
${midC.map(r => `  • ${r.name}`).join('\n')}

`;
  }

  // Per-day sections
  CEQR_DAYS.forEach(day => {
    const dayResults = state.seasonalResults[day.id];
    const affected = RESOURCES
      .filter(r => dayResults[r.id].incrMin > 0)
      .sort((a, b) => dayResults[b.id].incrMin - dayResults[a.id].incrMin);

    memo += `\n${day.label.toUpperCase()}
${'='.repeat(50)}
`;
    if (!affected.length) {
      memo += `No resources receive incremental shadow on this day.\n`;
      return;
    }
    memo += `${affected.length} resource${affected.length === 1 ? '' : 's'} affected.\n\n`;

    affected.forEach(r => {
      const m = dayResults[r.id];
      const concern = computeConcern(r, m, daysHitMap[r.id]);
      memo += `${r.name}  [${concern} concern]
  Existing:    ${fmtDur(m.existingMin)}
  Proposed:    ${fmtDur(m.proposedMin)}
  Incremental: ${fmtDur(m.incrMin)}${m.firstIncrT != null ? '  (' + fmtClock(m.firstIncrT) + ' – ' + fmtClock(m.lastIncrT) + ')' : ''}
  Max coverage: ${m.maxIncrPct.toFixed(0)}%  |  Avg: ${m.avgIncrPct.toFixed(0)}%  |  Acre-min: ${m.acreMin.toFixed(1)}
  Impact theory: ${(r.impactTheory || []).join(', ')}
`;
    });
  });

  // Seasonal summary table
  memo += `\nSEASONAL SUMMARY TABLE
${'='.repeat(50)}
${'Resource'.padEnd(28)} ${'Dec 21'.padStart(7)} ${'Mar 21'.padStart(7)} ${'May 6'.padStart(7)} ${'Jun 21'.padStart(7)} ${'Total'.padStart(8)} Days
${line}
`;
  overallAffected.forEach(r => {
    const cells = [3,0,1,2].map(i => {
      const min = (state.seasonalResults[CEQR_DAYS[i].id][r.id]?.incrMin || 0);
      return (min > 0 ? fmtDur(min) : '—').padStart(7);
    });
    memo += `${r.name.substring(0, 27).padEnd(28)} ${cells.join(' ')} ${fmtDur(totals[r.id]).padStart(8)} ${daysHitMap[r.id]}/4\n`;
  });

  memo += `\nCONCLUSIONS
${line}
Based on this screening-level analysis across all four CEQR representative days:

`;
  if (highC.length) {
    memo += `${highC.map(r => r.name).join(', ')} ${highC.length === 1 ? 'appears' : 'appear'} to warrant further consultant review given the duration, seasonal recurrence, and sensitivity of the resource${highC.length === 1 ? '' : 's'}.

`;
  }
  const lowC = overallAffected.filter(r => overallConcern(r) === 'Low');
  if (lowC.length) {
    memo += `${lowC.map(r => r.name).join(', ')} ${lowC.length === 1 ? 'does' : 'do'} not appear to show concentrated or recurrent incremental shadow effects based on this screening and ${lowC.length === 1 ? 'does' : 'do'} not appear to warrant further review at this time.

`;
  }

  memo += `DISCLAIMER
${line}
This is a screening-level analysis, not a CEQR significance determination. Results
are approximate and intended for initial study only. For a defensible EIS, use 3-D
CAD/GIS shadow modeling with certified consultant review.
`;

  downloadText(memo, 'cp-shadow-memo-all-ceqr-days.txt', 'text/plain');
}

/* ============================================================ slide prompt ==*/

function generateSlidePrompt() {
  const out = analyzeDay(state.currentDayId);
  const { results } = out;
  const prop = state.scenarios.proposed;
  const base = state.scenarios.baseline;
  const dayLabel = CEQR_DAYS.find(d => d.id === state.currentDayId)?.label || state.currentDayId;

  const sorted = RESOURCES
    .map(r => ({ r, m: results[r.id] }))
    .filter(x => x.m.incrMin > 0)
    .sort((a, b) => b.m.incrMin - a.m.incrMin);

  const highConcern = sorted.filter(({ r, m }) =>
    computeConcern(r, m, getSeasonalDays(r.id)) === 'High');
  const midConcern  = sorted.filter(({ r, m }) =>
    computeConcern(r, m, getSeasonalDays(r.id)) === 'Medium');

  const mitigationCandidates = sorted.filter(x => x.r.mitigationCandidate);

  // seasonal table rows
  let seasonalRows = '';
  if (state.seasonalResults) {
    const totals = {};
    RESOURCES.forEach(r => {
      totals[r.id] = CEQR_DAYS.reduce((s, d) => s + ((state.seasonalResults[d.id]?.[r.id]?.incrMin) || 0), 0);
    });
    const affectedSeasonal = RESOURCES.filter(r => totals[r.id] > 0)
      .sort((a, b) => totals[b.id] - totals[a.id]).slice(0, 12);
    seasonalRows = affectedSeasonal.map(r => {
      const cells = CEQR_DAYS.map(d => fmtDur((state.seasonalResults[d.id]?.[r.id]?.incrMin) || 0));
      return `  - ${r.name}: Dec 21=${cells[3]}, Mar 21=${cells[0]}, May 6=${cells[1]}, Jun 21=${cells[2]}, Total=${fmtDur(totals[r.id])}`;
    }).join('\n');
  }

  const resourceDetails = sorted.slice(0, 12).map(({ r, m }) => {
    const seaDays = getSeasonalDays(r.id);
    const concern = computeConcern(r, m, seaDays);
    return `  - ${r.name}
      Incremental: ${fmtDur(m.incrMin)} | Existing: ${fmtDur(m.existingMin)} | Proposed: ${fmtDur(m.proposedMin)}
      Max coverage: ${m.maxIncrPct.toFixed(0)}% | Avg coverage: ${m.avgIncrPct.toFixed(0)}% | Acre-minutes: ${m.acreMin.toFixed(1)}
      Window: ${m.firstIncrT != null ? fmtClock(m.firstIncrT) + ' – ' + fmtClock(m.lastIncrT) : 'N/A'}
      Impact theory: ${(r.impactTheory||[]).join(', ')}
      Screening concern: ${concern} | Seasonal days affected: ${seaDays}
      Mitigation candidate: ${r.mitigationCandidate ? 'Yes — ' + (r.mitigationMeasure || '') : 'No'}`;
  }).join('\n\n');

  const prompt = `You are a professional urban planner and data visualization expert. I need you to create a complete slide deck for a Central Park shadow impact screening study. Use the analysis data below to write out every slide — title, subtitle, body text, data, and detailed instructions for the visual on each slide.

STUDY CONTEXT
=============
Project type: NYC CEQR Chapter 8 Shadows — screening-level incremental shadow analysis
Baseline condition: ${base.heightFt > 0 ? base.heightFt + ' ft existing/as-of-right building' : 'No existing building (0 ft baseline)'}
Proposed condition: ${prop.heightFt} ft proposed/discretionary building
Primary analysis day shown: ${dayLabel}
Time-step interval: ${STEP_MIN} minutes
Analysis window: CEQR standard (sunrise +90 min to sunset −90 min)
Resource polygons: OpenStreetMap (screening-level)
Tree canopy: Excluded
Disclaimer: Screening-level only — not a CEQR significance determination

AFFECTED RESOURCES — ${dayLabel.toUpperCase()}
${sorted.length > 0 ? resourceDetails : '  None affected on this day.'}

${state.seasonalResults ? `SEASONAL SUMMARY (all 4 CEQR days)
=====================================
${seasonalRows || '  No seasonal data available.'}` : 'SEASONAL SUMMARY: Not yet computed (user has not run all CEQR days).'}

HIGH-CONCERN RESOURCES: ${highConcern.length > 0 ? highConcern.map(x => x.r.name).join(', ') : 'None identified'}
MEDIUM-CONCERN RESOURCES: ${midConcern.length > 0 ? midConcern.map(x => x.r.name).join(', ') : 'None identified'}
MITIGATION CANDIDATES: ${mitigationCandidates.length > 0 ? mitigationCandidates.map(x => x.r.name).join(', ') : 'None identified'}

SLIDE DECK INSTRUCTIONS
========================
Create a 10–14 slide deck in a dark, professional urban-planning aesthetic (dark navy/charcoal background, gold and white accents). The audience is a municipal review board or project team conducting environmental review.

Build the following slides:

SLIDE 1 — TITLE SLIDE
Title: "Central Park Shadow Impact Screening"
Subtitle: "Baseline vs. Proposed Incremental Shadow Analysis · NYC CEQR Chapter 8"
Visual: A stylized aerial outline of Central Park with a building shadow sweeping across it. Show the park boundary in green and the shadow as a semi-transparent amber polygon.

SLIDE 2 — STUDY METHODOLOGY
Title: "Approach & Assumptions"
Content: bullet points covering CEQR methodology, the 4 representative days, the analysis window, two-scenario approach (baseline vs. proposed), and the screening-level disclaimer.
Visual: A simple diagram showing the sun's arc, building extrusion, and shadow vector with labeled components (height, sun altitude angle, shadow length).

SLIDE 3 — BUILDING SCENARIOS
Title: "Baseline vs. Proposed Conditions"
Content: A two-column comparison table:
  Left column — Existing/As-of-Right: ${base.heightFt} ft, footprint description
  Right column — Proposed/Discretionary: ${prop.heightFt} ft, footprint description
Visual: A side-by-side 3-D massing diagram showing the two buildings at scale next to a simplified Central Park outline.

SLIDE 4 — SHADOW EXTENT MAP
Title: "Incremental Shadow Extent — ${dayLabel}"
Content: Caption explaining what incremental shadow means and which resources are affected.
Visual: A map of Central Park showing:
  - Park boundary in green
  - Baseline shadow in blue-grey
  - Proposed shadow in dark overlay
  - Incremental shadow in amber/gold
  - Affected resource polygons labeled and highlighted
  - A north arrow, scale bar, and legend

SLIDE 5 — RESOURCE IMPACT RANKING
Title: "Incremental Shadow Duration by Resource — ${dayLabel}"
Content: Brief framing sentence about the ranking.
Visual: A horizontal bar chart ranking the top ${Math.min(sorted.length, 10)} affected resources by incremental shadow duration (minutes). Color bars by concern level: red for High, orange for Medium, green for Low. Label each bar with the duration and concern level badge.

SLIDE 6 — COVERAGE METRICS
Title: "Area Coverage & Scale of Impact"
Content: Explanation that duration alone doesn't capture significance — coverage % and acre-minutes show how much of each resource is affected.
Visual: A scatter plot with incremental duration (x-axis) vs. max coverage % (y-axis). Each point represents one resource, sized by shadow-acre-minutes, colored by concern level, and labeled by resource name.

${state.seasonalResults ? `SLIDE 7 — SEASONAL SUMMARY
Title: "Seasonal Pattern of Incremental Shadow"
Content: Which resources are affected across multiple CEQR analysis days — recurrence signals greater significance.
Visual: A heat table (matrix) where rows are the top affected resources and columns are the 4 CEQR days. Color cells by incremental duration: white/light = minimal, gold = moderate, amber = significant. Include a total column on the right.

SLIDE 8 — RESOURCES OF CONCERN
` : `SLIDE 7 — RESOURCES OF CONCERN
`}Title: "Screening-Level Concern Assessment"
Content: A table with columns: Resource | Impact Theory | Incremental Duration | Max Coverage | Concern Level. Highlight High and Medium rows.
Visual: Styled table with concern-level badges. Add a footnote: "Concern levels are screening indicators, not CEQR significance determinations."

${highConcern.length > 0 ? `SLIDE ${state.seasonalResults ? 9 : 8} — HIGH-CONCERN RESOURCE SPOTLIGHT
Title: "${highConcern[0].r.name} — Detailed Impact"
Content: Full metrics for ${highConcern[0].r.name}: duration, coverage, window, impact theory, and why this resource warrants further review.
Visual: A zoomed map of ${highConcern[0].r.name} showing the incremental shadow polygon overlaid on the resource polygon at the time of maximum coverage. Include a small inset timeline bar showing when incremental shadow occurs across the day.

SLIDE ${state.seasonalResults ? 10 : 9} — MITIGATION IDEAS
` : `SLIDE ${state.seasonalResults ? 9 : 8} — MITIGATION IDEAS
`}Title: "Potential Mitigation Measures"
Content: For each mitigation candidate, list the resource name, possible critique, suggested measure, implementation partner, and feasibility.
Visual: A styled card layout, one card per resource. Each card has a small icon for the mitigation category (shelter, lighting, landscaping, etc.), the resource name in bold, and the measure in plain text.

SLIDE ${state.seasonalResults ? (highConcern.length > 0 ? 11 : 10) : (highConcern.length > 0 ? 10 : 9)} — CONCLUSIONS
Title: "Screening-Level Findings"
Content:
  - Summary of total resources affected
  - Which resources rise to High/Medium concern and why
  - Which resources show seasonal recurrence
  - Recommended next steps (further consultant review for High-concern resources; no further action for Low-concern resources)
  - Disclaimer that this is screening-level only
Visual: A simple summary scorecard with three columns: Resource | Concern Level | Recommended Action. Use color coding.

SLIDE ${state.seasonalResults ? (highConcern.length > 0 ? 12 : 11) : (highConcern.length > 0 ? 11 : 10)} — APPENDIX / ASSUMPTIONS
Title: "Assumptions & Data Sources"
Content bullet points:
  - Baseline: ${base.heightFt} ft
  - Proposed: ${prop.heightFt} ft
  - Analysis days: Mar 21, May 6/Aug 6, Jun 21, Dec 21
  - Time-step interval: ${STEP_MIN} minutes
  - Resource polygons: OpenStreetMap (OSM/ODbL)
  - Shadow geometry: flat-topped extrusion, convex hull
  - Tree canopy: excluded
  - Analysis type: Screening-level; not consultant-certified
  - Tool: Central Park Shadow Screening App (custom)
Visual: Clean text slide, no chart needed.

FORMATTING NOTES
=================
- Use a dark navy or charcoal background (#0f1418 or similar) throughout.
- Accent colors: gold/amber (#f4c430) for proposed/incremental shadow, steel blue (#4a7abf) for baseline/existing, white for text, muted grey (#9fb0bd) for secondary text.
- Concern level badge colors: red for High, orange for Medium, green for Low.
- All charts should have labeled axes, a legend, and a data source note.
- Maps should include a north arrow, scale bar, and legend.
- Keep slide body text to 3–5 bullet points maximum. Put detail in speaker notes.
- Add speaker notes to each slide with additional context for the presenter.
- The tone should be objective, technical, and appropriate for a municipal environmental review audience.`;

  return prompt;
}

function showPromptModal() {
  const prompt = generateSlidePrompt();
  document.getElementById('promptText').value = prompt;
  document.getElementById('promptModal').style.display = 'flex';
}

function downloadText(content, filename, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
}

/* ============================================================ date/window ===*/

function refreshWindow() {
  const prop = state.scenarios.proposed;
  const ref  = prop.footprint ? prop.footprint[0] : [40.7812, -73.9665];
  const day  = CEQR_DAYS.find(d => d.id === state.currentDayId);
  const date = state.date;

  state.window = state.ceqrMode
    ? analysisWindow(date, ref[0], ref[1])
    : { start: 0, end: 1439, sunrise: 360, sunset: 1080 };

  const slider = document.getElementById('timeSlider');
  slider.min = state.window.start;
  slider.max = state.window.end;
  if (state.minutes < state.window.start) state.minutes = state.window.start;
  if (state.minutes > state.window.end)   state.minutes = state.window.end;
  slider.value = state.minutes;

  document.getElementById('windowNote').innerHTML = state.ceqrMode
    ? `Analysis window <b>${fmtClock(state.window.start)} – ${fmtClock(state.window.end)}</b>
       (sunrise ${fmtClock(state.window.sunrise)}, sunset ${fmtClock(state.window.sunset)})`
    : `Full day (CEQR window off)`;
}

function setCeqrDay(id) {
  state.currentDayId = id;
  const d = CEQR_DAYS.find(x => x.id === id);
  const year = state.date.getFullYear();
  state.date = new Date(year, d.m, d.d);
  document.getElementById('customDate').value =
    `${year}-${String(d.m+1).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  refreshWindow();
  render();
}

function updateAssumptionsNote() {
  const prop = state.scenarios.proposed;
  const base = state.scenarios.baseline;
  const note = document.getElementById('assumptionsNote');
  if (note) note.textContent =
    `Baseline: ${base.heightFt} ft · Proposed: ${prop.heightFt} ft · ${STEP_MIN}-min steps · ` +
    `Polygons: OSM · Canopy: excluded · Screening only.`;
}

/* ============================================================= formatting ===*/

function fmtClock(minutes) {
  let h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2,'0')} ${ap}`;
}
function fmtDur(min) {
  if (min <= 0) return '0 min';
  const h = Math.floor(min/60), m = min%60;
  return h ? `${h}h ${m}m` : `${m} min`;
}

/* ================================================================== UI ======*/

let drawing = false, drawPts = [], drawMarkers = [], drawLine = null;
let rectMode = false;

function initUI() {
  const year = new Date().getFullYear();

  /* CEQR day selector */
  const daySel = document.getElementById('daySelect');
  CEQR_DAYS.forEach(d => {
    const o = document.createElement('option');
    o.value = d.id; o.textContent = d.label; daySel.appendChild(o);
  });
  daySel.value = 'jun21';

  /* Height inputs */
  document.getElementById('proposedHeightFt').value = state.scenarios.proposed.heightFt;
  document.getElementById('baselineHeightFt').value = state.scenarios.baseline.heightFt;
  updateStoryLabels();

  document.getElementById('proposedHeightFt').addEventListener('input', e => {
    state.scenarios.proposed.heightFt = Math.max(0, +e.target.value || 0);
    document.getElementById('proposedStories').textContent = Math.round(state.scenarios.proposed.heightFt / 11);
    invalidateDayCache(); render();
  });
  document.getElementById('baselineHeightFt').addEventListener('input', e => {
    state.scenarios.baseline.heightFt = Math.max(0, +e.target.value || 0);
    document.getElementById('baselineStories').textContent = Math.round(state.scenarios.baseline.heightFt / 11);
    invalidateDayCache(); render();
  });

  /* Scenario edit toggle */
  document.querySelectorAll('.scen-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scen-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.editing = btn.dataset.scen;
      const labels = { baseline: 'Existing / As-of-Right', proposed: 'Proposed / Discretionary' };
      document.getElementById('editingLabel').innerHTML =
        `Editing: <b>${labels[state.editing]}</b>`;
    });
  });

  /* Date/day */
  daySel.addEventListener('change', e => setCeqrDay(e.target.value));
  document.getElementById('customDate').addEventListener('change', e => {
    if (!e.target.value) return;
    const [y,m,d] = e.target.value.split('-').map(Number);
    state.date = new Date(y, m-1, d);
    invalidateDayCache(); refreshWindow(); render();
  });

  /* CEQR window toggle */
  document.getElementById('ceqrToggle').addEventListener('click', e => {
    state.ceqrMode = !state.ceqrMode;
    e.target.classList.toggle('active', state.ceqrMode);
    e.target.textContent = state.ceqrMode ? 'CEQR window: ON' : 'CEQR window: OFF';
    invalidateDayCache(); refreshWindow(); render();
  });

  /* Time slider */
  document.getElementById('timeSlider').addEventListener('input', e => {
    state.minutes = +e.target.value; renderCurrent();
  });

  /* Day sweep toggle */
  document.getElementById('sweepToggle').addEventListener('click', e => {
    state.showSweep = !state.showSweep;
    e.target.classList.toggle('active', state.showSweep);
    render();
  });

  /* Show baseline shadow toggle */
  document.getElementById('showBaselineToggle').addEventListener('click', e => {
    state.showBaseline = !state.showBaseline;
    e.target.classList.toggle('active', state.showBaseline);
    render();
  });

  /* Play/pause */
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

  /* Drawing tools */
  document.getElementById('drawBtn').addEventListener('click', startDrawing);
  document.getElementById('rectBtn').addEventListener('click', enableRectMode);
  document.getElementById('resetBtn').addEventListener('click', () => {
    state.scenarios.proposed.footprint = defaultProposed();
    state.scenarios.baseline.footprint = null;
    document.getElementById('proposedHeightFt').value = 1100;
    document.getElementById('baselineHeightFt').value = 0;
    state.scenarios.proposed.heightFt = 1100;
    state.scenarios.baseline.heightFt = 0;
    updateStoryLabels();
    map.setView(CENTRAL_PARK_CENTER, 14);
    invalidateDayCache(); refreshWindow(); render();
  });

  /* BBL lookup */
  document.getElementById('bblBtn').addEventListener('click',
    () => resolveBBL(document.getElementById('bblInput').value));
  document.getElementById('bblInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') resolveBBL(document.getElementById('bblInput').value);
  });

  /* Tabs */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      state.activeTab = tab.dataset.tab;
      document.getElementById(`tab-${tab.dataset.tab}`).style.display = 'block';
      const out = analyzeDay(state.currentDayId);
      renderResults(out);
    });
  });

  /* Filters */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      const out = analyzeDay(state.currentDayId);
      renderResults(out);
      renderHeatmap(out);
    });
  });

  /* Sort by */
  document.getElementById('sortBy').addEventListener('change', e => {
    state.sortBy = e.target.value;
    const out = analyzeDay(state.currentDayId);
    renderResultsTab(out.results, out.steps);
  });

  /* Seasonal analysis */
  document.getElementById('runAllDaysBtn').addEventListener('click', runAllDays);

  /* Export */
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
  document.getElementById('exportMemoBtn').addEventListener('click', exportMemo);
  document.getElementById('exportCsvAllBtn').addEventListener('click', exportCsvAllDays);
  document.getElementById('exportMemoAllBtn').addEventListener('click', exportMemoAllDays);
  document.getElementById('exportPromptBtn').addEventListener('click', showPromptModal);

  /* Prompt modal */
  document.getElementById('promptCloseBtn').addEventListener('click', () => {
    document.getElementById('promptModal').style.display = 'none';
  });
  document.getElementById('promptBackdrop').addEventListener('click', () => {
    document.getElementById('promptModal').style.display = 'none';
  });
  document.getElementById('promptCopyBtn').addEventListener('click', () => {
    const txt = document.getElementById('promptText');
    txt.select();
    navigator.clipboard.writeText(txt.value).then(() => {
      const btn = document.getElementById('promptCopyBtn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy to clipboard'; }, 2000);
    });
  });

  /* Legend */
  const legend = document.getElementById('legend');
  Object.values(RESOURCE_TYPES).forEach(t => {
    const el = document.createElement('div');
    el.className = 'legend-item';
    el.innerHTML = `<span class="dot" style="background:${t.color};width:11px;height:11px;border-radius:2px;"></span>${t.label}`;
    legend.appendChild(el);
  });
}

function updateStoryLabels() {
  document.getElementById('proposedStories').textContent = Math.round(state.scenarios.proposed.heightFt / 11);
  document.getElementById('baselineStories').textContent = Math.round(state.scenarios.baseline.heightFt / 11);
}

/* ---- footprint drawing ---- */
function startDrawing() {
  drawing = true; drawPts = []; drawMarkers = [];
  if (drawLine) map.removeLayer(drawLine);
  document.getElementById('drawBanner').style.display = 'block';
  document.getElementById('drawBanner').textContent =
    `Drawing: ${state.editing} — click corners · double-click or Enter to finish · Esc to cancel`;
  map.on('click', onDrawClick);
  map.doubleClickZoom.disable();
  map.on('dblclick', finishDrawing);
}
function onDrawClick(e) {
  drawPts.push([e.latlng.lat, e.latlng.lng]);
  const mk = L.circleMarker(e.latlng, { radius:4, color:'#f4c430', fillColor:'#f4c430', fillOpacity:1 }).addTo(map);
  drawMarkers.push(mk);
  if (drawLine) map.removeLayer(drawLine);
  drawLine = L.polyline(drawPts, { color:'#f4c430', dashArray:'4 4' }).addTo(map);
}
function finishDrawing() {
  if (!drawing) return;
  if (drawPts.length >= 3) state.scenarios[state.editing].footprint = drawPts.slice();
  cancelDrawing();
  invalidateDayCache(); refreshWindow(); render();
}
function cancelDrawing() {
  drawing = false;
  map.off('click', onDrawClick); map.off('dblclick', finishDrawing);
  setTimeout(() => map.doubleClickZoom.enable(), 50);
  drawMarkers.forEach(m => map.removeLayer(m));
  if (drawLine) { map.removeLayer(drawLine); drawLine = null; }
  document.getElementById('drawBanner').style.display = 'none';
}

/* ---- rectangle mode ---- */
function enableRectMode() {
  rectMode = true;
  document.getElementById('drawBanner').style.display = 'block';
  document.getElementById('drawBanner').textContent = `Click to drop center of ${state.editing} footprint`;
  map.once('click', e => {
    rectMode = false;
    document.getElementById('drawBanner').style.display = 'none';
    const w = +document.getElementById('rectW').value || 40;
    const l = +document.getElementById('rectL').value || 50;
    const { lat, lng } = e.latlng;
    const dLat = (l/2)/111320;
    const dLng = (w/2)/(111320*Math.cos(lat*Math.PI/180));
    state.scenarios[state.editing].footprint = [
      [lat-dLat,lng-dLng],[lat-dLat,lng+dLng],
      [lat+dLat,lng+dLng],[lat+dLat,lng-dLng]
    ];
    invalidateDayCache(); refreshWindow(); render();
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && drawing) cancelDrawing();
  if (e.key === 'Enter'  && drawing) finishDrawing();
});

/* ---- BBL lookup ---- */
const BBL_BOROUGH = { 1:'Manhattan', 2:'Bronx', 3:'Brooklyn', 4:'Queens', 5:'Staten Island' };

function bblStatus(html, isErr) {
  const el = document.getElementById('bblStatus');
  el.innerHTML = html;
  el.style.color = isErr ? 'var(--bad)' : 'var(--muted)';
}

function ringAreaM2(ring) {
  if (ring.length < 3) return 0;
  const mx = 111320*Math.cos(ring[0][0]*Math.PI/180), my = 110540;
  let s = 0;
  for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
    s += (ring[j][1]*mx)*(ring[i][0]*my) - (ring[i][1]*mx)*(ring[j][0]*my);
  }
  return s/2;
}

function largestRing(footprints) {
  let best=null, bestA=0;
  for (const f of footprints) {
    const g = f.the_geom;
    if (!g) continue;
    const polys = g.type==='MultiPolygon' ? g.coordinates : g.type==='Polygon' ? [g.coordinates] : [];
    for (const poly of polys) {
      const ring = poly[0].map(([ln,la])=>[la,ln]);
      const a = Math.abs(ringAreaM2(ring));
      if (a > bestA) { bestA=a; best=ring; }
    }
  }
  if (!best) return null;
  if (best.length>1 && best[0][0]===best[best.length-1][0] && best[0][1]===best[best.length-1][1]) best.pop();
  return { ring:best, area:bestA };
}

async function resolveBBL(raw) {
  const bbl = (raw||'').replace(/\D/g,'');
  if (bbl.length!==10 || !BBL_BOROUGH[bbl[0]]) {
    bblStatus('Enter a valid 10-digit BBL.', true); return;
  }
  bblStatus(`Looking up BBL ${bbl}…`);
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
    } else if (pluto?.latitude && pluto?.lotarea) {
      const lat=+pluto.latitude, lng=+pluto.longitude;
      const sideM = Math.sqrt(Math.max(50, +pluto.lotarea*0.092903));
      const dLat=(sideM/2)/111320, dLng=(sideM/2)/(111320*Math.cos(lat*Math.PI/180));
      footprint=[[lat-dLat,lng-dLng],[lat-dLat,lng+dLng],[lat+dLat,lng+dLng],[lat+dLat,lng-dLng]];
      source=`lot-area estimate (${(+pluto.lotarea).toLocaleString()} ft²)`;
    } else {
      bblStatus(`No footprint found for BBL ${bbl}.`, true); return;
    }
    state.scenarios[state.editing].footprint = footprint;
    map.fitBounds(L.polygon(footprint).getBounds(), { maxZoom:17, padding:[60,60] });
    const floors = pluto?.numfloors ? Math.round(+pluto.numfloors) : null;
    const addr = pluto?.address || '(address not in PLUTO)';
    bblStatus(`<b>${addr}</b>, ${BBL_BOROUGH[bbl[0]]}<br>Loaded ${source}${floors ? ` · existing: ${floors} floors` : ''}. Set height above, then analyze.`);
    invalidateDayCache(); refreshWindow(); render();
  } catch(e) {
    bblStatus(`Lookup failed: ${e.message}`, true);
  }
}

/* ================================================================ boot ======*/

function boot() {
  state.date = new Date(new Date().getFullYear(), 5, 21);
  initUI();
  setCeqrDay('jun21');
  document.getElementById('customDate').value = `${state.date.getFullYear()}-06-21`;
  updateAssumptionsNote();
}
boot();
