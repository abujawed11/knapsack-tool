// walkwayBomCalculations.js
// Pure formula engine for Walkway BOM generation.
// Takes rows[] and settings → returns { horizontal, vertical, totals }

const SECTION_LENGTH = 2.01;

// Fallback constants used only if DB items haven't loaded yet
const WEIGHT_FALLBACKS = {
  walkwaySection: 7.638,
  walkwayCleat:   0.048,
  jointer:        0.24,
  baseRail:       0.5,
  railNut:        0.0154,
};
const RATE_FALLBACKS = {
  blindRivets: 1.2,
  epdmPad:     3.0,
  m8Bolt:      10.0,
  m8Washer:    5.0,
};

/**
 * Build a lookup map from DB master items array.
 * { itemKey -> { wtPc, fixedRatePc, id } }
 */
function buildLookup(masterItems = []) {
  const map = {};
  for (const item of masterItems) {
    map[item.itemKey] = {
      id:          item.id,
      wtPc:        item.wtPc        != null ? parseFloat(item.wtPc)        : null,
      fixedRatePc: item.fixedRatePc != null ? parseFloat(item.fixedRatePc) : null,
    };
  }
  return map;
}

/**
 * Calculate aggregated section/cleat/jointer/baseRail totals
 * for a filtered set of rows.
 */
function aggregateRows(rows) {
  let totalSections = 0;
  let totalLCleats  = 0;
  let totalJointers = 0;
  let totalBaseRail = 0;

  for (const row of rows) {
    const length = parseFloat(row.length);
    const qty    = parseInt(row.qty, 10);
    if (!length || length <= 0 || !qty || qty <= 0) continue;

    const sections       = Math.ceil(length / SECTION_LENGTH);
    const baseRailPerRun = sections * 2 + 1;
    const lCleats        = row.type === 'V' ? baseRailPerRun * 2 : sections * 6;
    const jointers       = sections * 2;
    const baseRail       = row.type === 'V' ? baseRailPerRun * qty : 0;

    totalSections  += sections  * qty;
    totalLCleats   += lCleats   * qty;
    totalJointers  += jointers  * qty;
    totalBaseRail  += baseRail;
  }

  return { totalSections, totalLCleats, totalJointers, totalBaseRail };
}

function withSpare(baseQty, sparePct) {
  const spareQty = Math.ceil(baseQty * (sparePct / 100));
  return { baseQty, spareQty, totalQty: baseQty + spareQty };
}

function makeItem(description, baseQty, sparePct, wtPc, materialRate, fixedRatePc, material, profile = null, cutLength = null, masterItemId = null) {
  const { baseQty: bq, spareQty, totalQty } = withSpare(baseQty, sparePct);

  let wtPcFinal = wtPc ?? 0;
  let ratePc, totalWeight, cost;

  if (fixedRatePc != null) {
    ratePc      = fixedRatePc;
    totalWeight = 0;
    cost        = totalQty * ratePc;
  } else {
    ratePc      = wtPcFinal * materialRate;
    totalWeight = totalQty * wtPcFinal;
    cost        = totalWeight * materialRate;
  }

  return {
    description,
    material,
    profile,
    cutLength,
    masterItemId,
    baseQty: bq,
    spareQty,
    totalQty,
    wtPc: wtPcFinal || null,
    totalWeight: totalWeight || null,
    rateKg:  fixedRatePc != null ? null : materialRate,
    ratePc:  parseFloat(ratePc.toFixed(4)),
    cost:    parseFloat(cost.toFixed(2)),
    uom: 'Nos',
  };
}

function buildHorizontalBOM(agg, settings, lookup) {
  const { totalSections, totalLCleats, totalJointers } = agg;
  const { magnelisRate, sparePct, includeBlindRivets, includeSDS } = settings;

  const ws  = lookup.walkwaySection ?? {};
  const wc  = lookup.walkwayCleat   ?? {};
  const jo  = lookup.jointer        ?? {};
  const br  = lookup.blindRivets    ?? {};
  const ep  = lookup.epdmPad        ?? {};

  const fastenerQty = totalLCleats + totalJointers * 4;
  const items = [];

  items.push(makeItem('Walkway Section (310mm width, 2010mm)', totalSections, sparePct, ws.wtPc ?? WEIGHT_FALLBACKS.walkwaySection, magnelisRate, null, 'Magnelis', 'Walkway Section 310×35×10×0.9mm', 2010, ws.id ?? null));
  items.push(makeItem('Walkway Cleat (L-Angle, 40mm)',         totalLCleats,  sparePct, wc.wtPc ?? WEIGHT_FALLBACKS.walkwayCleat,   magnelisRate, null, 'Magnelis', 'L-Angle 35×45×1.2',               40,   wc.id ?? null));
  items.push(makeItem('Jointer (200mm)',                       totalJointers, sparePct, jo.wtPc ?? WEIGHT_FALLBACKS.jointer,        magnelisRate, null, 'Magnelis', 'L-Angle 35×45×2',                 200,  jo.id ?? null));

  if (includeBlindRivets) {
    items.push(makeItem('Blind Rivets (4.8×15mm)', fastenerQty, sparePct, null, null, br.fixedRatePc ?? RATE_FALLBACKS.blindRivets, 'Al 5000', 'Blind Rivet 4.8×15mm', null, br.id ?? null));
  }
  if (includeSDS) {
    items.push(makeItem('SDS Screws', fastenerQty, sparePct, null, null, settings.sdsRate ?? null, '—', 'SDS Screw', null, null));
  }
  items.push(makeItem('EPDM Pad (30×30×2mm)', totalLCleats, sparePct, null, null, ep.fixedRatePc ?? RATE_FALLBACKS.epdmPad, 'Al 5001', 'EPDM Pad 30×30×2mm', null, ep.id ?? null));

  return items;
}

function buildVerticalBOM(agg, settings, lookup) {
  const { totalSections, totalLCleats, totalJointers, totalBaseRail } = agg;
  const { magnelisRate, alRate, sparePct, includeBlindRivets, includeSDS } = settings;

  const ws  = lookup.walkwaySection ?? {};
  const bas = lookup.baseRail       ?? {};
  const wc  = lookup.walkwayCleat   ?? {};
  const jo  = lookup.jointer        ?? {};
  const rn  = lookup.railNut        ?? {};
  const mb  = lookup.m8Bolt         ?? {};
  const mw  = lookup.m8Washer       ?? {};
  const br  = lookup.blindRivets    ?? {};
  const ep  = lookup.epdmPad        ?? {};

  const fastenerQty = (totalBaseRail * 2) + totalLCleats + (totalJointers * 4);
  const items = [];

  items.push(makeItem('Walkway Section (310mm width, 2010mm)', totalSections, sparePct, ws.wtPc  ?? WEIGHT_FALLBACKS.walkwaySection, magnelisRate, null, 'Magnelis',   'Walkway Section 310×35×10×0.9mm', 2010, ws.id  ?? null));
  items.push(makeItem('Base Rail (400mm)',                     totalBaseRail, sparePct, bas.wtPc ?? WEIGHT_FALLBACKS.baseRail,       magnelisRate, null, 'Magnelis',   'Strut Channel 41×41×1.2mm',       400,  bas.id ?? null));
  items.push(makeItem('Walkway Cleat (L-Angle, 40mm)',         totalLCleats,  sparePct, wc.wtPc  ?? WEIGHT_FALLBACKS.walkwayCleat,   magnelisRate, null, 'Magnelis',   'L-Angle 35×45×1.2',               40,   wc.id  ?? null));
  items.push(makeItem('Jointer (200mm)',                       totalJointers, sparePct, jo.wtPc  ?? WEIGHT_FALLBACKS.jointer,        magnelisRate, null, 'Magnelis',   'L-Angle 35×45×2',                 200,  jo.id  ?? null));
  items.push(makeItem('Rail Nut',                              totalLCleats,  sparePct, rn.wtPc  ?? WEIGHT_FALLBACKS.railNut,        alRate,       null, 'Al 6063-T6', 'Rail Nut MA01',                   23,   rn.id  ?? null));

  items.push(makeItem('M8×20 Allen Hex Bolt',     totalLCleats, sparePct, null, null, mb.fixedRatePc ?? RATE_FALLBACKS.m8Bolt,   'SS 304', 'Allen Hex Bolt M8×20',     20,   mb.id ?? null));
  items.push(makeItem('M8 Plain & Spring Washer', totalLCleats, sparePct, null, null, mw.fixedRatePc ?? RATE_FALLBACKS.m8Washer, 'SS 304', 'M8 Plain & Spring Washer', null, mw.id ?? null));

  if (includeBlindRivets) {
    items.push(makeItem('Blind Rivets (4.8×15mm)', fastenerQty, sparePct, null, null, br.fixedRatePc ?? RATE_FALLBACKS.blindRivets, 'Al 5000', 'Blind Rivet 4.8×15mm', null, br.id ?? null));
  }
  if (includeSDS) {
    items.push(makeItem('SDS Screws', fastenerQty, sparePct, null, null, settings.sdsRate ?? null, '—', 'SDS Screw', null, null));
  }
  items.push(makeItem('EPDM Pad (30×30×2mm)', totalBaseRail * 2, sparePct, null, null, ep.fixedRatePc ?? RATE_FALLBACKS.epdmPad, 'Al 5001', 'EPDM Pad 30×30×2mm', null, ep.id ?? null));

  return items;
}

/**
 * Main entry point.
 * @param {Array}  rows        — WalkwayRow objects: { type, length, qty }
 * @param {Object} settings    — { magnelisRate, alRate, sparePct, includeBlindRivets, includeSDS, sdsRate? }
 * @param {Array}  masterItems — from DB via walkwayItemAPI.getAll() — optional, falls back to constants
 */
export function calculateWalkwayBOM(rows, settings, masterItems = []) {
  const lookup = buildLookup(masterItems);

  const hRows = rows.filter(r => r.type === 'H');
  const vRows = rows.filter(r => r.type === 'V');

  const hAgg = aggregateRows(hRows);
  const vAgg = aggregateRows(vRows);

  const horizontal = hRows.length > 0 ? buildHorizontalBOM(hAgg, settings, lookup) : null;
  const vertical   = vRows.length > 0 ? buildVerticalBOM(vAgg, settings, lookup)   : null;

  const totalLength = rows.reduce((sum, r) => {
    const len = parseFloat(r.length);
    const qty = parseInt(r.qty, 10);
    return sum + (isNaN(len) || isNaN(qty) ? 0 : len * qty);
  }, 0);

  const allItems  = [...(horizontal ?? []), ...(vertical ?? [])];
  const totalCost = allItems.reduce((s, i) => s + (i.cost || 0), 0);
  const costPerRM = totalLength > 0 ? totalCost / totalLength : 0;

  const summary = {
    totalCost:   parseFloat(totalCost.toFixed(2)),
    totalLength: parseFloat(totalLength.toFixed(2)),
    costPerRM:   parseFloat(costPerRM.toFixed(2)),
    hAgg,
    vAgg,
  };

  return { horizontal, vertical, summary };
}
