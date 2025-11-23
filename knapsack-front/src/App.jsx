// src/App.jsx
import { useMemo, useState } from "react";
import { optimizeCuts, requiredRailLength, generateScenarios } from "./lib/optimizer";

const DEFAULT_LENGTHS = [1595, 1798, 2400, 2750, 3200, 3600, 4800];

export default function App() {
  // User mode: 'normal' or 'advanced'
  const [userMode, setUserMode] = useState('normal');
  const [showSettings, setShowSettings] = useState(false);

  // Excel-like inputs
  const [modules, setModules] = useState(3);
  const [moduleWidth, setModuleWidth] = useState(1303);
  const [midClamp, setMidClamp] = useState(20);
  const [endClampWidth, setEndClampWidth] = useState(40);
  const [buffer, setBuffer] = useState(15);
  const computedRequired = useMemo(
    () => requiredRailLength({ modules, moduleWidth, midClamp, endClampWidth, buffer }),
    [modules, moduleWidth, midClamp, endClampWidth, buffer]
  );

  // Direct override for required
  const [requiredOverride, setRequiredOverride] = useState("");
  const required = useMemo(() => {
    const v = Number(requiredOverride);
    return Number.isFinite(v) && v > 0 ? Math.round(v) : computedRequired;
  }, [requiredOverride, computedRequired]);

  // Optimizer knobs
  const [lengthsInput, setLengthsInput] = useState(DEFAULT_LENGTHS.join(", "));
  // Track which lengths are enabled (true = use, false = ignore)
  const [enabledLengths, setEnabledLengths] = useState(() => {
    const initial = {};
    DEFAULT_LENGTHS.forEach(len => initial[len] = true);
    return initial;
  });
  const [maxPieces, setMaxPieces] = useState(3);          // <= 3 pieces (2 joints)
  const [maxWastePct, setMaxWastePct] = useState("");     // Optional: e.g., 0.02 for 2% max waste
  const [alphaJoint, setAlphaJoint] = useState(220);
  const [betaSmall, setBetaSmall] = useState(60);
  const [allowUndershootPct, setAllowUndershootPct] = useState(0);
  const [gammaShort, setGammaShort] = useState(5);

  // Cost parameters for BOM
  const [costPerMm, setCostPerMm] = useState("0.1");     // Cost per mm of rail
  const [costPerJointSet, setCostPerJointSet] = useState("50"); // Cost per joint connector set
  const [joinerLength, setJoinerLength] = useState("100"); // Length of each joiner in mm

  // Priority selection for optimization
  const [priority, setPriority] = useState('length'); // 'length', 'joints'

  const parsedLengths = useMemo(
    () => parseNumList(lengthsInput).filter(len => enabledLengths[len] !== false),
    [lengthsInput, enabledLengths]
  );

  // Update enabledLengths when lengthsInput changes
  const allLengths = useMemo(() => parseNumList(lengthsInput), [lengthsInput]);

  const toggleLength = (len) => {
    setEnabledLengths(prev => ({
      ...prev,
      [len]: !prev[len]
    }));
  };

  const enableAll = () => {
    const newEnabled = {};
    allLengths.forEach(len => newEnabled[len] = true);
    setEnabledLengths(newEnabled);
  };

  const disableAll = () => {
    const newEnabled = {};
    allLengths.forEach(len => newEnabled[len] = false);
    setEnabledLengths(newEnabled);
  };

  const result = useMemo(() => {
    const wasteLimit = Number(maxWastePct);
    return optimizeCuts({
      required,
      lengths: parsedLengths,
      maxPieces: Number(maxPieces) || undefined,
      maxWastePct: Number.isFinite(wasteLimit) && wasteLimit > 0 ? wasteLimit : undefined,
      allowUndershootPct: Number(allowUndershootPct) || 0,
      alphaJoint: Number(alphaJoint) || 0,
      betaSmall: Number(betaSmall) || 0,
      gammaShort: Number(gammaShort) || 0,
      costPerMm: Number(costPerMm) || 0,
      costPerJointSet: Number(costPerJointSet) || 0,
      joinerLength: Number(joinerLength) || 0
    });
  }, [required, parsedLengths, maxPieces, maxWastePct, allowUndershootPct, alphaJoint, betaSmall, gammaShort, costPerMm, costPerJointSet, joinerLength]);

  // Generate scenarios for comparison
  const scenarios = useMemo(() => {
    if (required <= 0 || parsedLengths.length === 0) return [];
    const rawScenarios = generateScenarios({
      required,
      lengths: parsedLengths,
      allowUndershootPct: Number(allowUndershootPct) || 0,
      maxWastePct: Number(maxWastePct) || undefined,
      alphaJoint: Number(alphaJoint) || 0,
      betaSmall: Number(betaSmall) || 0,
      gammaShort: Number(gammaShort) || 0,
      costPerMm: Number(costPerMm) || 0,
      costPerJointSet: Number(costPerJointSet) || 0,
      joinerLength: Number(joinerLength) || 0
    });

    // Sort and mark best based on priority
    const sorted = [...rawScenarios];

    // Reset isBest flag
    sorted.forEach(s => s.isBest = false);

    if (priority === 'length') {
      sorted.sort((a, b) => a.total - b.total);
    } else if (priority === 'joints') {
      sorted.sort((a, b) => a.joints - b.joints);
    }

    if (sorted.length > 0) {
      sorted[0].isBest = true;
    }

    return sorted;
  }, [required, parsedLengths, allowUndershootPct, maxWastePct, alphaJoint, betaSmall, gammaShort, costPerMm, costPerJointSet, joinerLength, priority]);

  // Get the best result based on priority (from scenarios)
  const bestResult = useMemo(() => {
    if (scenarios.length > 0) {
      return scenarios[0]; // First one is the best based on priority
    }
    return result; // Fallback to original result
  }, [scenarios, result]);

  const extraPct = useMemo(() => {
    if (!bestResult || !bestResult.ok) return 0;
    if (required <= 0) return 0;
    return (bestResult.actualOvershoot / required) * 100;
  }, [bestResult, required]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Rail Cut Optimizer</h1>
          <div className="flex items-center gap-4">
            <a
              href="/benchmark-test.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-purple-600 to-purple-700 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-sm hover:shadow-md"
            >
              Performance Benchmark
            </a>
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>
              {showSettings && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border p-4 z-50">
                  <h3 className="font-semibold mb-3">Settings</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                      <input
                        type="radio"
                        name="userMode"
                        checked={userMode === 'normal'}
                        onChange={() => setUserMode('normal')}
                        className="w-4 h-4 text-purple-600"
                      />
                      <div>
                        <div className="font-medium text-sm">Normal User</div>
                        <div className="text-xs text-gray-500">Simple interface</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                      <input
                        type="radio"
                        name="userMode"
                        checked={userMode === 'advanced'}
                        onChange={() => setUserMode('advanced')}
                        className="w-4 h-4 text-purple-600"
                      />
                      <div>
                        <div className="font-medium text-sm">Advanced User</div>
                        <div className="text-xs text-gray-500">All optimization controls</div>
                      </div>
                    </label>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="mt-3 w-full py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6 md:grid-cols-3">
        {/* Left column: inputs */}
        <section className="md:col-span-2 space-y-6">
          <Card title="1) Required Rail Length (Excel-style)">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <NumberField label="Modules in stack" value={modules} setValue={setModules} />
              <NumberField label="Module Width (mm)" value={moduleWidth} setValue={setModuleWidth} />
              <NumberField label="Mid Clamp Spacing (mm)" value={midClamp} setValue={setMidClamp} />
              <NumberField label="End Clamp Width (mm)" value={endClampWidth} setValue={setEndClampWidth} />
              <NumberField label="Buffer (mm)" value={buffer} setValue={setBuffer} />
              <div className="col-span-2 md:col-span-3">
                <ReadOnlyField label="Computed Required (mm)" value={computedRequired} />
              </div>
            </div>
          </Card>

          <Card title="2) Optimizer Settings">
            <div className="space-y-4">
              {userMode === 'advanced' && (
                <TextField label="Cut Lengths (mm, comma-separated)" value={lengthsInput} setValue={setLengthsInput} />
              )}

              {/* Length Selection */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Select Lengths to Use</span>
                  <div className="flex gap-2">
                    <button onClick={enableAll} className="text-xs text-purple-600 hover:text-purple-800">All</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={disableAll} className="text-xs text-purple-600 hover:text-purple-800">None</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allLengths.map(len => (
                    <label
                      key={len}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                        enabledLengths[len] !== false
                          ? 'bg-purple-50 border-purple-300 text-purple-700'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={enabledLengths[len] !== false}
                        onChange={() => toggleLength(len)}
                        className="w-3.5 h-3.5 text-purple-600 rounded"
                      />
                      <span className="text-sm">{len} mm</span>
                    </label>
                  ))}
                </div>
                {parsedLengths.length === 0 && (
                  <p className="text-xs text-red-500 mt-2">Please select at least one length</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NumberField label="Max Pieces (hard cap)" value={maxPieces} setValue={setMaxPieces} />
                {userMode === 'advanced' && (
                  <>
                    <NumberField label="Max Waste % (e.g., 0.02 for 2%) – optional" value={maxWastePct} setValue={setMaxWastePct} step={0.01} />
                    <NumberField label="α Joint Penalty (per joint, in mm)" value={alphaJoint} setValue={setAlphaJoint} />
                    <NumberField label="β Small Penalty (per small piece, in mm)" value={betaSmall} setValue={setBetaSmall} />
                    <NumberField label="Allow Undershoot (%)" value={allowUndershootPct} setValue={setAllowUndershootPct} />
                    <NumberField label="γ Shortage Penalty (per mm)" value={gammaShort} setValue={setGammaShort} />
                    <NumberField label="Required Override (mm) – optional" value={requiredOverride} setValue={setRequiredOverride} />
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card title="3) Cost Settings (for BOM)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField label="Cost per mm (currency)" value={costPerMm} setValue={setCostPerMm} />
              <TextField label="Cost per Joint Set (currency)" value={costPerJointSet} setValue={setCostPerJointSet} />
              <TextField label="Joiner Length (mm)" value={joinerLength} setValue={setJoinerLength} />
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Optimization Priority</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={priority === 'length'}
                    onChange={() => setPriority('length')}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm">Go with lesser rail length</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={priority === 'joints'}
                    onChange={() => setPriority('joints')}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm">Go with lesser joints</span>
                </label>
              </div>
            </div>
          </Card>
        </section>

        {/* Right column: results */}
        <section className="md:col-span-1 space-y-6">
          <Card title="Result">
            {!bestResult || !bestResult.ok ? (
              <div className="text-red-600">{bestResult?.reason || "No solution"}</div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-purple-600 font-medium mb-2">
                  Optimized for: {priority === 'length' ? 'Lesser Rail Length' : 'Lesser Joints'}
                </div>
                <KV label="Required (mm)" value={fmt(required)} />
                <KV label="Total Rail Length (mm)" value={fmt(bestResult.total)} />
                {bestResult.joints > 0 && (
                  <>
                    <KV label="Joiner Length (mm)" value={fmt(bestResult.joinerTotalLength)} />
                    <KV label="Total Length with Joiners (mm)" value={fmt(bestResult.totalLengthWithJoiners)} />
                  </>
                )}
                <KV label="Overshoot (mm)" value={fmt(bestResult.actualOvershoot)} />
                <KV label="% Extra Length" value={`${extraPct.toFixed(2)}%`} />
                <KV label="Pieces" value={bestResult.pieces} />
                <KV label="Joints" value={bestResult.joints} />
                {userMode === 'advanced' && <KV label="Small Pieces" value={bestResult.smallCount} />}

                {/* Cost Breakdown */}
                <div className="pt-3 mt-3 border-t">
                  <h4 className="text-sm font-semibold mb-2">Cost Breakdown</h4>
                  <div className="space-y-2">
                    <KV label="Rail Material Cost" value={`${bestResult.materialCost.toFixed(2)}`} />
                    {bestResult.joints > 0 && (
                      <KV label="Joint Set Cost" value={`${bestResult.jointSetCost.toFixed(2)}`} />
                    )}
                    <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                      <span className="text-gray-800">Total Cost</span>
                      <span className="text-green-600">{bestResult.totalActualCost.toFixed(2)}</span>
                    </div>
                  </div>
                  {bestResult.extraCost > 0 && (
                    <div className="mt-3 pt-2 border-t border-red-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Extra Cost (waste)</span>
                        <span className="font-medium text-red-600">{bestResult.extraCost.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="pt-2">
                  <h4 className="text-sm font-semibold mb-2">Chosen Pieces</h4>
                  {bestResult.plan.length === 0 ? (
                    <div className="text-gray-500">—</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {bestResult.plan.map((p, i) => (
                        <span key={i} className="inline-flex items-center rounded-full border px-2 py-1 text-sm bg-white">
                          {p} mm
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Counts by Length</h4>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(bestResult.countsByLength).sort((a,b)=>Number(a[0])-Number(b[0])).map(([len, ct]) => (
                        <tr key={len} className="border-t">
                          <td className="py-1 text-gray-600">{len} mm</td>
                          <td className="py-1 text-right font-medium">{ct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {scenarios.length > 0 && (
            <Card title="Scenario Comparison">
              <div className="space-y-3">
                {scenarios.length === 1 ? (
                  <p className="text-xs text-gray-500 mb-3">
                    Only one optimal solution found for this requirement.
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mb-3">
                    Sorted by: <strong>{priority === 'length' ? 'Lowest Rail Length' : 'Fewest Joints'}</strong>
                  </p>
                )}
                {scenarios.map((scenario, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${scenario.isBest ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm font-medium ${scenario.isBest ? 'text-green-700' : 'text-gray-700'}`}>
                        {scenario.label}
                        {scenario.isBest && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {priority === 'length' ? 'Shortest' : 'Fewest Joints'}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-gray-600">
                        <span className="font-medium">{scenario.pieces}</span> pieces, <span className="font-medium">{scenario.joints}</span> joints
                      </div>
                      <div className="text-right text-gray-600">
                        {fmt(scenario.total)} mm
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Material: {scenario.materialCost.toFixed(2)}</span>
                        <span className="text-gray-500">Joints: {scenario.jointSetCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-sm font-semibold text-gray-700">Total Cost</span>
                        <span className={`text-sm font-bold ${scenario.isBest ? 'text-green-600' : 'text-gray-800'}`}>
                          {scenario.totalActualCost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Plan: {scenario.plan.map(p => `${p}mm`).join(' + ')}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {userMode === 'advanced' ? (
            <Card title="Tips">
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                <li>Raise <strong>α</strong> to reduce joints (accept a bit more waste).</li>
                <li>Raise <strong>β</strong> to avoid small pieces.</li>
                <li>Lower <strong>Max Pieces</strong> to strictly cap joints.</li>
                <li>Set <strong>Max Waste %</strong> to 0.02 to enforce a 2% waste limit (hard constraint).</li>
                <li>Set <strong>Allow Undershoot</strong> if field practice allows small shortfalls.</li>
              </ul>
            </Card>
          ) : (
            <Card title="Tips">
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                <li>Compare scenarios above to find the cheapest option.</li>
                <li>Fewer pieces = fewer joints = lower joint cost but higher material cost.</li>
                <li>More pieces = more joints = lower material cost but higher joint cost.</li>
                <li>Use the gear icon to access advanced settings.</li>
              </ul>
            </Card>
          )}
        </section>
      </main>

      <footer className="py-8 text-center text-xs text-gray-500">
        Built for your solar rail standardization workflow.
      </footer>
    </div>
  );
}

function parseNumList(s) {
  return String(s)
    .split(/[, ]+/)
    .map(x => Number(x.trim()))
    .filter(x => Number.isFinite(x) && x > 0);
}

function fmt(n) {
  return new Intl.NumberFormat().format(n);
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3 font-semibold">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function TextField({ label, value, setValue }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-gray-600">{label}</div>
      <input
        className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
        value={value}
        onChange={e => setValue(e.target.value)}
        spellCheck={false}
      />
    </label>
  );
}

function NumberField({ label, value, setValue, step }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-gray-600">{label}</div>
      <input
        type="number"
        step={step}
        className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
        value={value}
        onChange={e => setValue(e.target.value)}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-gray-600">{label}</div>
      <div className="w-full rounded-xl border bg-gray-50 px-3 py-2">{value}</div>
    </label>
  );
}


function KV({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}