# 📊 Rail Cut Optimizer - Result Output Guide

Complete documentation of the optimizer result structure and field meanings.

---

## 📦 Result Object Structure

When you call `optimizeCuts()`, you get back a result object with the following structure:

### ✅ Successful Result (ok: true)

```javascript
{
  ok: true,                    // Boolean: Operation succeeded
  plan: [2000, 1500],         // Array: Actual pieces to cut (in order)
  countsByLength: {            // Object: Count of each length used
    "1500": 1,
    "2000": 1
  },
  total: 3500,                 // Number: Sum of all pieces (mm)
  extra: 0,                    // Number: Overshoot/waste (mm)
  shortage: 0,                 // Number: Undershoot (mm) if total < required
  pieces: 2,                   // Number: Total number of pieces
  joints: 1,                   // Number: Number of connections (pieces - 1)
  smallCount: 0,               // Number: How many small pieces used
  cost: 220.00                 // Number: Total penalty cost
}
```

### ❌ Failed Result (ok: false)

```javascript
{
  ok: false,                   // Boolean: Operation failed
  reason: "No feasible..."     // String: Why it failed
}
```

---

## 📋 Field-by-Field Explanation

### 1. **`ok`** (Boolean)
**What it is:** Success/failure indicator

**Values:**
- `true` → Solution found successfully
- `false` → No solution found (check `reason` field)

**Usage:**
```javascript
const result = optimizeCuts({...});
if (result.ok) {
  console.log("Success!", result.plan);
} else {
  console.error("Failed:", result.reason);
}
```

---

### 2. **`plan`** (Array of Numbers)
**What it is:** The actual cutting plan - which pieces to use

**Example:**
```javascript
plan: [2000, 1500]
// Means: Cut one 2000mm piece and one 1500mm piece
```

**Details:**
- Listed in the order they were selected
- Units: millimeters (mm)
- Can contain duplicates: `[1000, 1000, 1000]` means three 1000mm pieces
- Empty array `[]` if failed

**Real-world interpretation:**
```javascript
plan: [3000, 2000, 500]
// Installation:
// - Take one 3000mm rail
// - Join with one 2000mm rail
// - Join with one 500mm rail
// = Total 5500mm installed
```

---

### 3. **`countsByLength`** (Object)
**What it is:** Summary of how many of each length you need to cut

**Example:**
```javascript
countsByLength: {
  "1000": 2,  // Need two 1000mm pieces
  "2000": 1,  // Need one 2000mm piece
  "3000": 1   // Need one 3000mm piece
}
```

**Usage - Generate Shopping List:**
```javascript
console.log("Shopping List:");
for (const [length, count] of Object.entries(result.countsByLength)) {
  console.log(`- ${count}x ${length}mm rails`);
}

// Output:
// Shopping List:
// - 2x 1000mm rails
// - 1x 2000mm rails
// - 1x 3000mm rails
```

**Why it's useful:**
- Order from supplier: "I need 2 pieces of 1000mm and 1 piece of 2000mm"
- Inventory check: "Do I have enough of each length?"
- Cost estimation: "2×$20 + 1×$35 = $75 total"

---

### 4. **`total`** (Number)
**What it is:** Sum of all pieces in the plan (mm)

**Formula:**
```javascript
total = plan.reduce((sum, piece) => sum + piece, 0)
```

**Example:**
```javascript
plan: [2000, 1500, 500]
total: 4000  // = 2000 + 1500 + 500
```

**Relationship to required:**
- `total >= required` → Good! (may have some waste)
- `total < required` → Too short! (has shortage)

---

### 5. **`extra`** (Number)
**What it is:** Amount of waste/overshoot (mm)

**Formula:**
```javascript
extra = Math.max(0, total - required)
```

**Examples:**

| Required | Total | Extra | Waste % |
|----------|-------|-------|---------|
| 5000mm | 5000mm | 0mm | 0% ✅ |
| 5000mm | 5100mm | 100mm | 2% ✅ |
| 5000mm | 6000mm | 1000mm | 20% ⚠️ |
| 5000mm | 4950mm | 0mm | 0% (but has shortage!) |

**Why extra happens:**
- No exact combination available
- Algorithm chooses slightly longer to avoid joints
- Better to be too long than too short

**Field notes:**
- Extra material can sometimes be trimmed/cut on site
- Small extra (1-3%) is usually acceptable
- Large extra (>10%) means inefficient use of material

---

### 6. **`shortage`** (Number)
**What it is:** Amount of undershoot (mm) if total is less than required

**Formula:**
```javascript
shortage = total < required ? (required - total) : 0
```

**Examples:**

| Required | Total | Shortage | Problem? |
|----------|-------|----------|----------|
| 5000mm | 5000mm | 0mm | No ✅ |
| 5000mm | 5100mm | 0mm | No (has extra instead) ✅ |
| 5000mm | 4950mm | 50mm | Yes! Too short ❌ |
| 5000mm | 4500mm | 500mm | Yes! Way too short ❌ |

**Why shortage is BAD:**
- Rail too short → Won't span the required distance
- Can't install solar panels properly
- Structural weakness

**Default behavior:**
- Algorithm strongly avoids shortage (γ=5 penalty per mm)
- Only happens if `allowUndershootPct` is set
- Example: `allowUndershootPct: 0.01` allows up to 1% shortage

---

### 7. **`pieces`** (Number)
**What it is:** Total number of rail pieces used

**Formula:**
```javascript
pieces = plan.length
```

**Examples:**
```javascript
plan: [5000]           → pieces: 1
plan: [3000, 2000]     → pieces: 2
plan: [2000, 2000, 1000] → pieces: 3
```

**Why it matters:**
- More pieces = More joints = More installation time
- More pieces = More connection hardware needed
- Fewer pieces = Stronger, cleaner installation

**Typical goals:**
- ✅ 1 piece: Perfect! No joints needed
- ✅ 2-3 pieces: Good, manageable
- ⚠️ 4-5 pieces: Okay if necessary
- ❌ 6+ pieces: Too many, increase maxPieces constraint

---

### 8. **`joints`** (Number)
**What it is:** Number of connections between pieces

**Formula:**
```javascript
joints = Math.max(0, pieces - 1)
```

**Examples:**

| Pieces | Joints | Visualization |
|--------|--------|---------------|
| 1 | 0 | `[════════]` (no joints) |
| 2 | 1 | `[════]⚡[════]` (1 joint) |
| 3 | 2 | `[══]⚡[══]⚡[══]` (2 joints) |
| 4 | 3 | `[═]⚡[═]⚡[═]⚡[═]` (3 joints) |

**Why joints matter:**
- Each joint needs:
  - Connection hardware (couplers, clamps)
  - Installation time
  - Alignment precision
  - Potential weak point

**Cost per joint:**
- Default α = 220mm equivalent penalty
- Increase α to discourage joints more strongly

---

### 9. **`smallCount`** (Number)
**What it is:** How many pieces are from the "small lengths" list

**Example:**
```javascript
// Configuration
smallLengths: [500, 800]  // Mark these as "small"

// Result
plan: [2000, 1000, 500]
smallCount: 1  // Only the 500mm piece is small
```

**Why small pieces are discouraged:**
- Harder to handle and install
- More prone to bending/warping
- Often leftover/scrap sizes
- Less structural integrity

**How it affects selection:**
- Default β = 60mm equivalent penalty per small piece
- Algorithm prefers larger pieces when possible
- Set β = 0 to disable small piece penalty

---

### 10. **`cost`** (Number)
**What it is:** Total penalty score (lower is better)

**Formula:**
```javascript
cost = extra + (alphaJoint × joints) + (betaSmall × smallCount) + (gammaShort × shortage)
```

**Example calculation:**
```javascript
// Configuration
required: 5000mm
alphaJoint: 220
betaSmall: 60
gammaShort: 5

// Result
plan: [3000, 2000, 500]
total: 5500mm
extra: 500mm
joints: 2
smallCount: 1
shortage: 0mm

// Cost calculation:
cost = 500 + (220 × 2) + (60 × 1) + (5 × 0)
cost = 500 + 440 + 60 + 0
cost = 1000
```

**What cost means:**
- Lower cost = Better solution
- Algorithm finds the minimum cost solution
- Balances waste vs. joints vs. small pieces

**Interpreting costs:**

| Cost Range | Quality | Notes |
|------------|---------|-------|
| 0 - 100 | Excellent | Perfect or near-perfect match |
| 100 - 300 | Good | Minimal waste or 1 joint |
| 300 - 600 | Okay | Some compromise needed |
| 600+ | Poor | Multiple issues (waste + joints + small pieces) |

---

### 11. **`reason`** (String - only if `ok: false`)
**What it is:** Error message explaining why no solution was found

**Common reasons:**

#### "No valid cut lengths."
```javascript
// Problem: Empty or invalid lengths array
lengths: []  // ❌
lengths: [-100, 0, "abc"]  // ❌ All invalid
```
**Fix:** Provide valid positive numbers

---

#### "No feasible combination found. Try increasing max pieces or allowing undershoot."
```javascript
// Problem: Can't reach required length with constraints
required: 10000mm
lengths: [500, 1000]
maxPieces: 3

// Best possible: 1000 + 1000 + 1000 = 3000mm
// Still 7000mm short!
```
**Fix:**
- Increase `maxPieces`
- Add larger lengths to `lengths` array
- Set `allowUndershootPct` if acceptable

---

#### "No solution found within 2.0% waste limit. Try increasing max waste, max pieces, or allowing undershoot."
```javascript
// Problem: No solution exists within waste constraint
required: 5000mm
lengths: [6000]  // Only option = 20% waste
maxWastePct: 0.02  // But max allowed = 2%
```
**Fix:**
- Increase `maxWastePct` to 0.05 or higher
- Add more lengths options
- Remove waste constraint temporarily

---

#### "Required length must be greater than 0."
```javascript
// Problem: Invalid required value
required: 0    // ❌
required: -100 // ❌
required: NaN  // ❌
```
**Fix:** Provide positive required length

---

## 🎯 Real-World Usage Examples

### Example 1: Perfect Match
```javascript
const result = optimizeCuts({
  required: 5000,
  lengths: [1000, 2000, 3000, 5000]
});

console.log(result);
// {
//   ok: true,
//   plan: [5000],
//   countsByLength: { "5000": 1 },
//   total: 5000,
//   extra: 0,        // Perfect! No waste
//   shortage: 0,
//   pieces: 1,       // Single piece
//   joints: 0,       // No joints needed
//   smallCount: 0,
//   cost: 0          // Optimal solution
// }
```
**Interpretation:** Perfect! Use one 5000mm rail, no cutting needed.

---

### Example 2: Two-Piece Solution
```javascript
const result = optimizeCuts({
  required: 5000,
  lengths: [1000, 2000, 3000],
  alphaJoint: 220
});

console.log(result);
// {
//   ok: true,
//   plan: [3000, 2000],
//   countsByLength: { "2000": 1, "3000": 1 },
//   total: 5000,
//   extra: 0,
//   shortage: 0,
//   pieces: 2,
//   joints: 1,       // One connection needed
//   smallCount: 0,
//   cost: 220        // Cost = 0 extra + 220×1 joint
// }
```
**Interpretation:** Order one 3000mm and one 2000mm rail. Join them with one coupler.

---

### Example 3: Waste Trade-off
```javascript
const result = optimizeCuts({
  required: 5000,
  lengths: [3000, 4000],
  alphaJoint: 220
});

console.log(result);
// {
//   ok: true,
//   plan: [3000, 3000],      // Option A: 2 pieces
//   // OR
//   plan: [4000, 3000],      // Option B: 2 pieces
//   total: 6000,             // OR 7000
//   extra: 1000,             // OR 2000
//   shortage: 0,
//   pieces: 2,
//   joints: 1,
//   smallCount: 0,
//   cost: 1220               // 1000 extra + 220 joint
// }
```
**Interpretation:** No perfect match. Algorithm chooses best trade-off between waste and joints.

---

### Example 4: Small Piece Penalty
```javascript
const result = optimizeCuts({
  required: 3500,
  lengths: [500, 2000, 3000],
  smallLengths: [500],
  betaSmall: 60
});

console.log(result);
// Option A: [3000, 500]
//   cost = 0 + 220 + 60 = 280 (has small piece)
//
// Option B: [2000, 2000]
//   cost = 500 + 220 + 0 = 720 (has waste)
//
// Algorithm picks Option A (lower cost)
// {
//   ok: true,
//   plan: [3000, 500],
//   total: 3500,
//   extra: 0,
//   pieces: 2,
//   joints: 1,
//   smallCount: 1,      // One small piece used
//   cost: 280
// }
```
**Interpretation:** Despite penalty, using the 500mm piece is still better than excessive waste.

---

## 📱 Displaying Results in UI

### Basic Display
```javascript
if (result.ok) {
  console.log(`✅ Solution found!`);
  console.log(`📦 Pieces needed: ${result.pieces}`);
  console.log(`🔗 Joints: ${result.joints}`);
  console.log(`📏 Total length: ${result.total}mm`);
  console.log(`♻️ Waste: ${result.extra}mm (${(result.extra/required*100).toFixed(1)}%)`);
  console.log(`📋 Plan: ${result.plan.join(' + ')}mm`);
} else {
  console.log(`❌ ${result.reason}`);
}
```

### Shopping List Generator
```javascript
if (result.ok) {
  console.log("🛒 Shopping List:");
  for (const [length, count] of Object.entries(result.countsByLength)) {
    console.log(`   - ${count}x ${length}mm rails`);
  }
}
```

### Cost Breakdown
```javascript
if (result.ok) {
  console.log("💰 Cost Breakdown:");
  console.log(`   Waste penalty: ${result.extra}mm`);
  console.log(`   Joint penalty: ${result.joints} × ${alphaJoint} = ${result.joints * alphaJoint}`);
  console.log(`   Small piece penalty: ${result.smallCount} × ${betaSmall} = ${result.smallCount * betaSmall}`);
  console.log(`   Total cost: ${result.cost}`);
}
```

---

## 🔍 Troubleshooting Guide

### Issue: `ok: false` - No solution found

**Check:**
1. Are `lengths` valid positive numbers?
2. Is `required` positive?
3. Is `maxPieces` too restrictive?
4. Can the lengths reach the required distance?

**Try:**
```javascript
// Relax constraints temporarily
optimizeCuts({
  required: 5000,
  lengths: [500, 1000, 2000],
  maxPieces: 10,              // Increase from 3
  maxWastePct: undefined,     // Remove waste limit
  allowUndershootPct: 0.01    // Allow 1% shortage
});
```

---

### Issue: `extra` is too high (>10%)

**Solutions:**
1. Add `maxWastePct: 0.02` to enforce 2% limit
2. Add more length options to `lengths` array
3. Increase `maxPieces` to allow more combinations
4. Check if required length is achievable with available lengths

---

### Issue: Too many `pieces` (>5)

**Solutions:**
1. Decrease `maxPieces` to enforce limit
2. Increase `alphaJoint` to penalize joints more (e.g., 400)
3. Add larger lengths to `lengths` array

---

### Issue: Algorithm picks too many `smallCount`

**Solutions:**
1. Increase `betaSmall` from 60 to 100 or 200
2. Review which lengths are in `smallLengths`
3. Add more medium/large lengths to `lengths` array

---

## 🎓 Summary

| Field | Type | Meaning | Good Value |
|-------|------|---------|------------|
| `ok` | Boolean | Success? | `true` |
| `plan` | Array | Pieces to cut | Any valid combination |
| `countsByLength` | Object | Shopping list | - |
| `total` | Number | Sum of pieces | ≥ required |
| `extra` | Number | Waste | 0-100mm (0-2%) |
| `shortage` | Number | Shortfall | 0mm |
| `pieces` | Number | # pieces | 1-3 |
| `joints` | Number | # connections | 0-2 |
| `smallCount` | Number | # small pieces | 0-1 |
| `cost` | Number | Penalty score | <300 |
| `reason` | String | Error message | (only if failed) |

---

**Need more help?** Check the inline code comments or the benchmark tool for live examples!
