// src/lib/optimizer.js

/**
 * Rail cut optimizer (unbounded knapsack with overshoot, joint & small-piece penalties)
 * Params:
 *  required: number (mm)                       - target rail length (>= 0)
 *  lengths: number[]                           - stock cut sizes (mm)
 *  smallLengths?: number[]                     - subset treated as "small" (discouraged)
 *  maxPieces?: number                          - hard cap on number of pieces (optional)
 *  allowUndershootPct?: number                 - e.g. 0.01 allows up to 1% shortfall (optional)
 *  maxWastePct?: number                        - e.g. 0.02 allows max 2% waste (optional)
 *  alphaJoint?: number                         - penalty per joint (pieces - 1), in "mm units"
 *  betaSmall?: number                          - penalty per piece chosen from smallLengths
 *  gammaShort?: number                         - penalty per mm of undershoot
 *  costPerMeter?: number                       - actual cost per meter of rail (for BOM)
 *  costPerJointSet?: number                    - actual cost per joint connector set (for BOM)
 */
export function optimizeCuts({
  required,
  lengths,
  smallLengths = [],
  maxPieces,
  allowUndershootPct = 0,
  maxWastePct,
  alphaJoint = 220,
  betaSmall = 60,
  gammaShort = 5,
  costPerMeter = 0,
  costPerJointSet = 0
}) {
  const L = Array.from(new Set(lengths)).filter(x => Number.isFinite(x) && x > 0).sort((a,b)=>a-b);
  if (L.length === 0) return { ok:false, reason:"No valid cut lengths." };

  const R = Math.max(0, Math.round(Number(required) || 0));
  const maxL = Math.max(...L);
  const TMAX = R + maxL - 1;

  const smallSet = new Set(smallLengths);
  /** @type {(null|{total:number,pieces:number,small:number,prev:number|null,lastIdx:number|null})[]} */
  const best = Array(TMAX + 1).fill(null);
  best[0] = { total: 0, pieces: 0, small: 0, prev: null, lastIdx: null };

  for (let t = 0; t <= TMAX; t++) {
    const cur = best[t];
    if (!cur) continue;

    for (let i = 0; i < L.length; i++) {
      const li = L[i];
      const nt = Math.min(TMAX, t + li);

      const cand = {
        total: Math.min(TMAX, cur.total + li),
        pieces: cur.pieces + 1,
        small: cur.small + (smallSet.has(li) ? 1 : 0),
        prev: t,
        lastIdx: i
      };

      if (maxPieces && cand.pieces > maxPieces) continue;

      const old = best[nt];
      if (!old || betterDP(cand, old)) {
        best[nt] = cand;
      }
    }
  }

  const minAllowed = allowUndershootPct > 0
    ? Math.ceil(R * (1 - allowUndershootPct))
    : R;

  const candidates = [];
  for (let t = minAllowed; t <= TMAX; t++) {
    const s = best[t];
    if (!s) continue;

    const extra = Math.max(0, s.total - R);
    const shortage = s.total >= R ? 0 : (R - s.total);

    // Check waste percentage constraint if specified
    if (maxWastePct !== undefined && R > 0) {
      const wastePct = extra / R;
      if (wastePct > maxWastePct) continue; // Skip solutions exceeding waste limit
    }

    const joints = Math.max(0, s.pieces - 1);
    const cost = extra + alphaJoint * joints + betaSmall * s.small + gammaShort * shortage;

    candidates.push({ t, s, cost, extra, shortage, joints });
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: maxWastePct !== undefined
        ? `No solution found within ${(maxWastePct * 100).toFixed(1)}% waste limit. Try increasing max waste, max pieces, or allowing undershoot.`
        : "No feasible combination found. Try increasing max pieces or allowing undershoot."
    };
  }

  candidates.sort((a,b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.extra !== b.extra) return a.extra - b.extra;
    if (a.s.pieces !== b.s.pieces) return a.s.pieces - b.s.pieces;
    if (a.s.small !== b.s.small) return a.s.small - b.s.small;
    return a.t - b.t;
  });

  const bestCand = candidates[0];

  // Reconstruct chosen pieces
  const plan = [];
  let curT = bestCand.t;
  let node = best[curT];
  while (node && node.prev !== null && node.lastIdx !== null) {
    plan.push(L[node.lastIdx]);
    curT = node.prev;
    node = best[curT];
  }
  plan.reverse();

  const countsByLength = {};
  for (const len of plan) countsByLength[len] = (countsByLength[len] || 0) + 1;

  // Calculate actual costs for BOM
  const totalMeters = bestCand.s.total / 1000;
  const materialCost = totalMeters * costPerMeter;
  const jointCost = bestCand.joints * costPerJointSet;
  const totalActualCost = materialCost + jointCost;

  return {
    ok: true,
    plan,
    countsByLength,
    total: bestCand.s.total,
    extra: bestCand.extra,
    shortage: bestCand.shortage,
    pieces: plan.length,
    joints: bestCand.joints,
    smallCount: plan.filter(x => smallSet.has(x)).length,
    cost: bestCand.cost,
    // Actual costs for BOM
    materialCost,
    jointCost,
    totalActualCost
  };

  // DP tie-breaker: prefer fewer pieces, then fewer small, then shorter total
  function betterDP(a, b) {
    if (a.pieces !== b.pieces) return a.pieces < b.pieces;
    if (a.small  !== b.small)  return a.small  < b.small;
    return a.total < b.total;
  }
}

/** Excel-like helper: compute required rail length from module & clamp inputs */
export function requiredRailLength({ modules, moduleWidth, midClamp, endClampWidth, buffer }) {
  const m = Number(modules) || 0;
  const MW = Number(moduleWidth) || 0;
  const MC = Number(midClamp) || 0;
  const EC = Number(endClampWidth) || 0;
  const BF = Number(buffer) || 0;
  return m*MW + (m>0 ? (m-1)*MC : 0) + 2*EC + 2*BF;
}

/**
 * Generate multiple scenarios for cost comparison
 * Returns scenarios with different piece/joint trade-offs
 */
export function generateScenarios(baseConfig) {
  const scenarios = [];
  const maxL = Math.max(...baseConfig.lengths);
  const minPossiblePieces = Math.ceil(baseConfig.required / maxL);

  // Generate scenarios with different maxPieces values
  for (let pieces = minPossiblePieces; pieces <= Math.min(minPossiblePieces + 4, 8); pieces++) {
    const result = optimizeCuts({
      ...baseConfig,
      maxPieces: pieces
    });

    if (result.ok) {
      scenarios.push({
        ...result,
        maxPiecesUsed: pieces,
        label: pieces === minPossiblePieces
          ? 'Minimum Joints'
          : pieces === minPossiblePieces + 1
            ? 'Balanced'
            : `${pieces} Pieces (${pieces - 1} joints)`
      });
    }
  }

  // Also try with different alpha values to get varied solutions
  const alphaVariations = [0, 100, 500, 1000];
  for (const alpha of alphaVariations) {
    for (let pieces = minPossiblePieces; pieces <= Math.min(minPossiblePieces + 2, 6); pieces++) {
      const result = optimizeCuts({
        ...baseConfig,
        maxPieces: pieces,
        alphaJoint: alpha
      });

      if (result.ok) {
        scenarios.push({
          ...result,
          maxPiecesUsed: pieces,
          label: alpha === 0
            ? `${pieces} Pieces (minimize waste)`
            : alpha >= 500
              ? `${pieces} Pieces (minimize joints)`
              : `${pieces} Pieces`
        });
      }
    }
  }

  // Remove duplicates (same plan)
  const uniqueScenarios = [];
  const seenPlans = new Set();

  for (const scenario of scenarios) {
    const planKey = scenario.plan.join(',');
    if (!seenPlans.has(planKey)) {
      seenPlans.add(planKey);
      uniqueScenarios.push(scenario);
    }
  }

  // Sort by total cost by default
  uniqueScenarios.sort((a, b) => a.totalActualCost - b.totalActualCost);

  // Mark the cheapest
  if (uniqueScenarios.length > 0) {
    uniqueScenarios[0].isCheapest = true;
  }

  return uniqueScenarios;
}
