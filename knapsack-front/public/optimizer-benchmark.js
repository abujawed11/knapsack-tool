// optimizer-benchmark.js
// Comprehensive benchmark comparing different knapsack optimization approaches

import { optimizeCuts as originalOptimizeCuts } from './optimizer.js';

// =============================================================================
// IMPLEMENTATION 1: Original DP (Baseline)
// =============================================================================
export function dpOriginal(config) {
  return originalOptimizeCuts(config);
}

// =============================================================================
// IMPLEMENTATION 2: Optimized DP (Reduced bounds + cached lookups)
// =============================================================================
export function dpOptimized({
  required,
  lengths,
  smallLengths = [],
  maxPieces,
  allowUndershootPct = 0,
  alphaJoint = 220,
  betaSmall = 60,
  gammaShort = 5
}) {
  const L = Array.from(new Set(lengths)).filter(x => Number.isFinite(x) && x > 0).sort((a,b)=>a-b);
  if (L.length === 0) return { ok:false, reason:"No valid cut lengths." };

  const R = Math.max(0, Math.round(Number(required) || 0));
  if (R === 0) return { ok:false, reason:"Required length must be greater than 0." };

  const maxL = Math.max(...L);

  // OPTIMIZATION 1: Reduce TMAX with reasonable overshoot limit
  const maxOvershoot = Math.min(maxL - 1, Math.max(100, R * 0.05));
  const TMAX = R + maxOvershoot;

  // Validate TMAX to prevent "Invalid array length" error
  const MAX_ARRAY_SIZE = 10000000; // 10 million - reasonable limit
  if (!Number.isFinite(TMAX) || TMAX < 0 || TMAX > MAX_ARRAY_SIZE) {
    return {
      ok: false,
      reason: `Problem too large for DP Optimized (TMAX=${TMAX}). Try DP Original or Greedy.`
    };
  }

  // OPTIMIZATION 2: Pre-compute small piece flags
  const smallSet = new Set(smallLengths);
  const isSmall = L.map(li => smallSet.has(li));

  const best = Array(TMAX + 1).fill(null);
  best[0] = { total: 0, pieces: 0, small: 0, prev: null, lastIdx: null };

  for (let t = 0; t <= TMAX; t++) {
    const cur = best[t];
    if (!cur) continue;

    for (let i = 0; i < L.length; i++) {
      const li = L[i];
      const newTotal = t + li;

      // OPTIMIZATION 3: Skip early if exceeds bounds
      if (newTotal > TMAX) continue;

      const cand = {
        total: newTotal,
        pieces: cur.pieces + 1,
        small: cur.small + (isSmall[i] ? 1 : 0), // Use cached lookup
        prev: t,
        lastIdx: i
      };

      if (maxPieces && cand.pieces > maxPieces) continue;

      const old = best[newTotal];
      if (!old || betterDP(cand, old)) {
        best[newTotal] = cand;
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
    const joints = Math.max(0, s.pieces - 1);
    const cost = extra + alphaJoint * joints + betaSmall * s.small + gammaShort * shortage;

    candidates.push({ t, s, cost, extra, shortage, joints });

    // OPTIMIZATION 4: Early exit for perfect match
    if (s.total === R && s.pieces === 1 && s.small === 0) {
      break;
    }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: "No feasible combination found."
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

  // Reconstruct
  const plan = [];
  let curT = bestCand.t;
  let node = best[curT];
  while (node?.prev !== null && node?.lastIdx !== null) {
    plan.push(L[node.lastIdx]);
    curT = node.prev;
    node = best[curT];
  }
  plan.reverse();

  const countsByLength = {};
  for (const len of plan) countsByLength[len] = (countsByLength[len] || 0) + 1;

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
    cost: bestCand.cost
  };

  function betterDP(a, b) {
    if (a.pieces !== b.pieces) return a.pieces < b.pieces;
    if (a.small  !== b.small)  return a.small  < b.small;
    return a.total < b.total;
  }
}

// =============================================================================
// IMPLEMENTATION 3: Greedy Approach (Fast but not optimal)
// =============================================================================
export function greedyApproach({
  required,
  lengths,
  smallLengths = [],
  maxPieces,
  allowUndershootPct = 0,
  alphaJoint = 220,
  betaSmall = 60,
  gammaShort = 5
}) {
  const L = Array.from(new Set(lengths)).filter(x => Number.isFinite(x) && x > 0).sort((a,b)=>b-a); // Sort descending
  if (L.length === 0) return { ok:false, reason:"No valid cut lengths." };

  const R = Math.max(0, Math.round(Number(required) || 0));
  if (R === 0) return { ok:false, reason:"Required length must be greater than 0." };

  const smallSet = new Set(smallLengths);

  const plan = [];
  let total = 0;
  let smallCount = 0;

  // Greedy: Always pick largest piece that doesn't overshoot too much
  while (total < R) {
    let bestPick = null;
    let bestScore = -Infinity;

    for (const li of L) {
      if (maxPieces && plan.length >= maxPieces) break;

      const newTotal = total + li;
      const overshoot = newTotal - R;

      // Skip if overshoots by more than 10%
      if (overshoot > R * 0.1) continue;

      // Score: prefer pieces that get close without overshooting
      const distanceScore = overshoot >= 0 ? -overshoot : Math.abs(overshoot);
      const smallPenalty = smallSet.has(li) ? -betaSmall : 0;
      const score = distanceScore + smallPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestPick = li;
      }
    }

    if (!bestPick) break;

    plan.push(bestPick);
    total += bestPick;
    if (smallSet.has(bestPick)) smallCount++;
  }

  if (plan.length === 0) {
    return { ok: false, reason: "No feasible combination found." };
  }

  const extra = Math.max(0, total - R);
  const shortage = total >= R ? 0 : (R - total);
  const joints = Math.max(0, plan.length - 1);
  const cost = extra + alphaJoint * joints + betaSmall * smallCount + gammaShort * shortage;

  const countsByLength = {};
  for (const len of plan) countsByLength[len] = (countsByLength[len] || 0) + 1;

  return {
    ok: true,
    plan,
    countsByLength,
    total,
    extra,
    shortage,
    pieces: plan.length,
    joints,
    smallCount,
    cost
  };
}

// =============================================================================
// IMPLEMENTATION 4: Branch and Bound (Optimal but slower for large inputs)
// =============================================================================
export function branchAndBound({
  required,
  lengths,
  smallLengths = [],
  maxPieces,
  allowUndershootPct = 0,
  alphaJoint = 220,
  betaSmall = 60,
  gammaShort = 5
}) {
  const L = Array.from(new Set(lengths)).filter(x => Number.isFinite(x) && x > 0).sort((a,b)=>b-a);
  if (L.length === 0) return { ok:false, reason:"No valid cut lengths." };

  const R = Math.max(0, Math.round(Number(required) || 0));
  if (R === 0) return { ok:false, reason:"Required length must be greater than 0." };

  // Branch & Bound can be slow for large problems
  if (R > 50000) {
    return {
      ok: false,
      reason: `Problem too large for Branch & Bound (R=${R}). Try DP Optimized or Greedy.`
    };
  }

  const smallSet = new Set(smallLengths);
  const minAllowed = allowUndershootPct > 0 ? Math.ceil(R * (1 - allowUndershootPct)) : R;

  let bestSolution = null;
  let bestCost = Infinity;

  function calculateCost(plan, total) {
    const extra = Math.max(0, total - R);
    const shortage = total >= R ? 0 : (R - total);
    const joints = Math.max(0, plan.length - 1);
    const smallCount = plan.filter(x => smallSet.has(x)).length;
    return extra + alphaJoint * joints + betaSmall * smallCount + gammaShort * shortage;
  }

  function search(plan, total, startIdx) {
    // Prune if exceeded max pieces
    if (maxPieces && plan.length > maxPieces) return;

    // Check if valid solution
    if (total >= minAllowed && total <= R + L[0]) {
      const cost = calculateCost(plan, total);
      if (cost < bestCost) {
        bestCost = cost;
        bestSolution = { plan: [...plan], total, cost };
      }
      // Don't return - might find better with more pieces
    }

    // Prune if already too long or cost bound exceeded
    if (total > R + L[0]) return;
    if (plan.length > 0) {
      const lowerBound = calculateCost(plan, total);
      if (lowerBound >= bestCost) return;
    }

    // Try adding each length
    for (let i = startIdx; i < L.length; i++) {
      plan.push(L[i]);
      search(plan, total + L[i], i);
      plan.pop();
    }
  }

  // Start search
  search([], 0, 0);

  if (!bestSolution) {
    return { ok: false, reason: "No feasible combination found." };
  }

  const { plan, total, cost } = bestSolution;
  const extra = Math.max(0, total - R);
  const shortage = total >= R ? 0 : (R - total);
  const joints = Math.max(0, plan.length - 1);
  const smallCount = plan.filter(x => smallSet.has(x)).length;

  const countsByLength = {};
  for (const len of plan) countsByLength[len] = (countsByLength[len] || 0) + 1;

  return {
    ok: true,
    plan,
    countsByLength,
    total,
    extra,
    shortage,
    pieces: plan.length,
    joints,
    smallCount,
    cost
  };
}

// =============================================================================
// IMPLEMENTATION 5: Recursive Memoization
// =============================================================================
export function recursiveMemo({
  required,
  lengths,
  smallLengths = [],
  maxPieces,
  allowUndershootPct = 0,
  alphaJoint = 220,
  betaSmall = 60,
  gammaShort = 5
}) {
  const L = Array.from(new Set(lengths)).filter(x => Number.isFinite(x) && x > 0).sort((a,b)=>a-b);
  if (L.length === 0) return { ok:false, reason:"No valid cut lengths." };

  const R = Math.max(0, Math.round(Number(required) || 0));
  if (R === 0) return { ok:false, reason:"Required length must be greater than 0." };

  const maxL = Math.max(...L);
  const TMAX = R + maxL - 1;

  // Validate to prevent issues with very large inputs
  const MAX_VALUE = 100000000; // 100 million
  if (TMAX > MAX_VALUE) {
    return {
      ok: false,
      reason: `Problem too large for Recursive Memo (TMAX=${TMAX}). Try Greedy.`
    };
  }

  const smallSet = new Set(smallLengths);

  const memo = new Map();

  function solve(remaining, pieces, smallCount) {
    if (remaining <= 0) {
      return { total: R - remaining, pieces, smallCount, plan: [] };
    }
    if (maxPieces && pieces >= maxPieces) {
      return null;
    }

    const key = `${remaining},${pieces},${smallCount}`;
    if (memo.has(key)) return memo.get(key);

    let best = null;
    let bestScore = Infinity;

    for (const li of L) {
      const newRemaining = remaining - li;
      const newSmallCount = smallCount + (smallSet.has(li) ? 1 : 0);

      const subResult = solve(newRemaining, pieces + 1, newSmallCount);
      if (!subResult) continue;

      const total = subResult.total;
      const extra = Math.max(0, total - R);
      const shortage = total >= R ? 0 : (R - total);
      const joints = Math.max(0, subResult.pieces - 1);
      const cost = extra + alphaJoint * joints + betaSmall * subResult.smallCount + gammaShort * shortage;

      if (cost < bestScore) {
        bestScore = cost;
        best = {
          total: subResult.total,
          pieces: subResult.pieces,
          smallCount: subResult.smallCount,
          plan: [li, ...subResult.plan]
        };
      }
    }

    memo.set(key, best);
    return best;
  }

  const result = solve(R, 0, 0);

  if (!result) {
    return { ok: false, reason: "No feasible combination found." };
  }

  const { plan, total } = result;
  const extra = Math.max(0, total - R);
  const shortage = total >= R ? 0 : (R - total);
  const joints = Math.max(0, plan.length - 1);
  const smallCount = plan.filter(x => smallSet.has(x)).length;
  const cost = extra + alphaJoint * joints + betaSmall * smallCount + gammaShort * shortage;

  const countsByLength = {};
  for (const len of plan) countsByLength[len] = (countsByLength[len] || 0) + 1;

  return {
    ok: true,
    plan,
    countsByLength,
    total,
    extra,
    shortage,
    pieces: plan.length,
    joints,
    smallCount,
    cost
  };
}

// =============================================================================
// TEST SUITE & BENCHMARKING
// =============================================================================

const ALGORITHMS = {
  'DP Original': dpOriginal,
  'DP Optimized': dpOptimized,
  'Greedy': greedyApproach,
  'Branch & Bound': branchAndBound,
  'Recursive Memo': recursiveMemo
};

// Test cases of varying complexity
const TEST_CASES = [
  {
    name: 'Small - Exact match exists',
    config: {
      required: 2000,
      lengths: [500, 1000, 2000],
      smallLengths: [500],
      maxPieces: 10
    },
    expected: { pieces: 1, total: 2000, extra: 0 }
  },
  {
    name: 'Small - Need combination',
    config: {
      required: 1500,
      lengths: [500, 800, 1000],
      smallLengths: [500],
      maxPieces: 10
    },
    expected: { pieces: 2, total: 1500 } // 500 + 1000
  },
  {
    name: 'Medium - Multiple options',
    config: {
      required: 3500,
      lengths: [600, 800, 1000, 1200, 1500, 2000],
      smallLengths: [600, 800],
      maxPieces: 8
    },
    expectedMax: { pieces: 4, extra: 200 } // Allow some variation
  },
  {
    name: 'Large - Complex optimization',
    config: {
      required: 8000,
      lengths: [500, 800, 1000, 1200, 1500, 2000, 2500, 3000],
      smallLengths: [500, 800],
      maxPieces: 10
    },
    expectedMax: { pieces: 6, extra: 500 }
  },
  {
    name: 'Very Large - Stress test',
    config: {
      required: 15000,
      lengths: [600, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000],
      smallLengths: [600, 800, 1000],
      maxPieces: 12
    },
    expectedMax: { pieces: 8, extra: 1000 }
  },
  {
    name: 'Edge - No solution without overshoot',
    config: {
      required: 100,
      lengths: [500, 1000],
      maxPieces: 1
    },
    expected: { ok: false }
  },
  {
    name: 'Edge - Single piece only',
    config: {
      required: 750,
      lengths: [500, 1000, 1500],
      maxPieces: 1
    },
    expected: { pieces: 1, total: 1000 }
  }
];

function runTest(algorithm, testCase, timeout = 5000) {
  const startTime = performance.now();
  let result;
  let timedOut = false;

  try {
    // Simple timeout mechanism
    const timeoutId = setTimeout(() => { timedOut = true; }, timeout);
    result = algorithm(testCase.config);
    clearTimeout(timeoutId);

    if (timedOut) {
      return {
        passed: false,
        reason: 'TIMEOUT',
        time: timeout,
        result: null
      };
    }
  } catch (error) {
    return {
      passed: false,
      reason: `ERROR: ${error.message}`,
      time: performance.now() - startTime,
      result: null
    };
  }

  const endTime = performance.now();
  const timeTaken = endTime - startTime;

  // Validate result
  let passed = true;
  let reason = 'PASS';

  if (!result) {
    passed = false;
    reason = 'No result returned';
  } else if (testCase.expected?.ok === false) {
    // Expecting failure
    passed = result.ok === false;
    reason = passed ? 'PASS (Expected failure)' : 'Should have failed';
  } else if (!result.ok) {
    passed = false;
    reason = `Failed: ${result.reason}`;
  } else {
    // Validate solution
    const { plan, total, pieces, extra } = result;

    // Check sum
    const actualSum = plan.reduce((sum, x) => sum + x, 0);
    if (actualSum !== total) {
      passed = false;
      reason = `Sum mismatch: plan=${actualSum}, total=${total}`;
    }

    // Check pieces
    if (pieces !== plan.length) {
      passed = false;
      reason = `Piece count mismatch: pieces=${pieces}, plan.length=${plan.length}`;
    }

    // Check expected values if provided
    if (passed && testCase.expected) {
      if (testCase.expected.pieces !== undefined && result.pieces !== testCase.expected.pieces) {
        passed = false;
        reason = `Expected ${testCase.expected.pieces} pieces, got ${result.pieces}`;
      }
      if (testCase.expected.total !== undefined && result.total !== testCase.expected.total) {
        passed = false;
        reason = `Expected total ${testCase.expected.total}, got ${result.total}`;
      }
      if (testCase.expected.extra !== undefined && result.extra !== testCase.expected.extra) {
        passed = false;
        reason = `Expected extra ${testCase.expected.extra}, got ${result.extra}`;
      }
    }

    // Check max constraints if provided
    if (passed && testCase.expectedMax) {
      if (testCase.expectedMax.pieces !== undefined && result.pieces > testCase.expectedMax.pieces) {
        passed = false;
        reason = `Too many pieces: ${result.pieces} > ${testCase.expectedMax.pieces}`;
      }
      if (testCase.expectedMax.extra !== undefined && result.extra > testCase.expectedMax.extra) {
        passed = false;
        reason = `Too much waste: ${result.extra} > ${testCase.expectedMax.extra}`;
      }
    }
  }

  return {
    passed,
    reason,
    time: timeTaken,
    result
  };
}

export function runBenchmark(options = {}) {
  const {
    algorithms = Object.keys(ALGORITHMS),
    testCases = TEST_CASES,
    timeout = 5000
  } = options;

  console.log('\n='.repeat(80));
  console.log('KNAPSACK ALGORITHM BENCHMARK');
  console.log('='.repeat(80));

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n\nTest: ${testCase.name}`);
    console.log('-'.repeat(80));
    console.log(`Required: ${testCase.config.required}mm`);
    console.log(`Lengths: [${testCase.config.lengths.join(', ')}]`);
    console.log(`Max Pieces: ${testCase.config.maxPieces || 'unlimited'}`);
    console.log();

    const testResults = {};

    for (const algoName of algorithms) {
      const algorithm = ALGORITHMS[algoName];
      if (!algorithm) {
        console.warn(`Unknown algorithm: ${algoName}`);
        continue;
      }

      const testResult = runTest(algorithm, testCase, timeout);
      testResults[algoName] = testResult;

      const statusIcon = testResult.passed ? '✓' : '✗';
      const timeStr = testResult.time.toFixed(3).padStart(10);
      const status = testResult.passed ? 'PASS' : testResult.reason;

      console.log(`${statusIcon} ${algoName.padEnd(20)} ${timeStr}ms  ${status}`);

      if (testResult.passed && testResult.result?.ok) {
        const r = testResult.result;
        console.log(`  → ${r.pieces} pieces, total=${r.total}mm, extra=${r.extra}mm, cost=${r.cost.toFixed(2)}`);
        console.log(`     Plan: [${r.plan.join(', ')}]`);
      }
    }

    results.push({
      testCase: testCase.name,
      results: testResults
    });
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  for (const algoName of algorithms) {
    const totalTests = results.length;
    const passed = results.filter(r => r.results[algoName]?.passed).length;
    const totalTime = results.reduce((sum, r) => sum + (r.results[algoName]?.time || 0), 0);
    const avgTime = totalTime / totalTests;

    console.log(`\n${algoName}:`);
    console.log(`  Tests Passed: ${passed}/${totalTests}`);
    console.log(`  Total Time:   ${totalTime.toFixed(3)}ms`);
    console.log(`  Average Time: ${avgTime.toFixed(3)}ms`);
  }

  console.log('\n' + '='.repeat(80));

  return results;
}

// Export for use in other files
export { TEST_CASES, ALGORITHMS };
