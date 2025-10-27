// src/App.jsx
import { useMemo, useState } from "react";
import { optimizeCuts, requiredRailLength } from "./lib/optimizer";

const DEFAULT_LENGTHS = [1595, 1798, 2400, 2750, 3200, 3600, 4800];
const DEFAULT_SMALL = [1595, 1798, 2400];

export default function App() {
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
  const [smallInput, setSmallInput] = useState(DEFAULT_SMALL.join(", "));
  const [maxPieces, setMaxPieces] = useState(3);          // <= 3 pieces (2 joints)
  const [alphaJoint, setAlphaJoint] = useState(220);
  const [betaSmall, setBetaSmall] = useState(60);
  const [allowUndershootPct, setAllowUndershootPct] = useState(0);
  const [gammaShort, setGammaShort] = useState(5);

  const parsedLengths = useMemo(
    () => parseNumList(lengthsInput),
    [lengthsInput]
  );
  const parsedSmall = useMemo(
    () => parseNumList(smallInput),
    [smallInput]
  );

  const result = useMemo(() => {
    return optimizeCuts({
      required,
      lengths: parsedLengths,
      smallLengths: parsedSmall,
      maxPieces: Number(maxPieces) || undefined,
      allowUndershootPct: Number(allowUndershootPct) || 0,
      alphaJoint: Number(alphaJoint) || 0,
      betaSmall: Number(betaSmall) || 0,
      gammaShort: Number(gammaShort) || 0
    });
  }, [required, parsedLengths, parsedSmall, maxPieces, allowUndershootPct, alphaJoint, betaSmall, gammaShort]);

  const extraPct = useMemo(() => {
    if (!result.ok) return 0;
    if (required <= 0) return 0;
    return (result.extra / required) * 100;
  }, [result, required]);

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
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-sm hover:shadow-md"
            >
              🎯 Performance Benchmark
            </a>
            <div className="text-sm text-gray-500">React + Tailwind • DP Knapsack</div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField label="Cut Lengths (mm, comma-separated)" value={lengthsInput} setValue={setLengthsInput} />
              <TextField label="Small Lengths (discourage)" value={smallInput} setValue={setSmallInput} />
              <NumberField label="Max Pieces (hard cap)" value={maxPieces} setValue={setMaxPieces} />
              <NumberField label="α Joint Penalty (per joint, in mm)" value={alphaJoint} setValue={setAlphaJoint} />
              <NumberField label="β Small Penalty (per small piece, in mm)" value={betaSmall} setValue={setBetaSmall} />
              <NumberField label="Allow Undershoot (%)" value={allowUndershootPct} setValue={setAllowUndershootPct} />
              <NumberField label="γ Shortage Penalty (per mm)" value={gammaShort} setValue={setGammaShort} />
              <NumberField label="Required Override (mm) – optional" value={requiredOverride} setValue={setRequiredOverride} />
            </div>
          </Card>
        </section>

        {/* Right column: results */}
        <section className="md:col-span-1 space-y-6">
          <Card title="Result">
            {!result.ok ? (
              <div className="text-red-600">{result.reason || "No solution"}</div>
            ) : (
              <div className="space-y-4">
                <KV label="Required (mm)" value={fmt(required)} />
                <KV label="Total Chosen (mm)" value={fmt(result.total)} />
                <KV label="Overshoot (mm)" value={fmt(result.extra)} />
                <KV label="% Extra Length" value={`${extraPct.toFixed(2)}%`} />
                <KV label="Pieces" value={result.pieces} />
                <KV label="Joints" value={result.joints} />
                <KV label="Small Pieces" value={result.smallCount} />
                <div className="pt-2">
                  <h4 className="text-sm font-semibold mb-2">Chosen Pieces</h4>
                  {result.plan.length === 0 ? (
                    <div className="text-gray-500">—</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {result.plan.map((p, i) => (
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
                      {Object.entries(result.countsByLength).sort((a,b)=>Number(a[0])-Number(b[0])).map(([len, ct]) => (
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

          <Card title="Tips">
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
              <li>Raise <strong>α</strong> to reduce joints (accept a bit more waste).</li>
              <li>Raise <strong>β</strong> to avoid small pieces.</li>
              <li>Lower <strong>Max Pieces</strong> to strictly cap joints.</li>
              <li>Set <strong>Allow Undershoot</strong> if field practice allows small shortfalls.</li>
            </ul>
          </Card>
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

function NumberField({ label, value, setValue }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-gray-600">{label}</div>
      <input
        type="number"
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