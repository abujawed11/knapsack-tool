// src/components/ResultCard.jsx
import { useMemo } from 'react';
import { Card, KV } from './ui';
import { requiredRailLength, generateScenarios } from '../lib/optimizer';
import { parseNumList, fmt } from '../lib/storage';

export default function ResultCard({ row, settings }) {
  const {
    moduleWidth,
    midClamp,
    endClampWidth,
    buffer,
    lengthsInput,
    enabledLengths,
    maxPieces,
    maxWastePct,
    allowUndershootPct,
    alphaJoint,
    betaSmall,
    gammaShort,
    costPerMm,
    costPerJointSet,
    joinerLength,
    priority,
    userMode
  } = settings;

  const parsedLengths = useMemo(
    () => parseNumList(lengthsInput).filter(len => enabledLengths[len] !== false),
    [lengthsInput, enabledLengths]
  );

  const { required, result, extraPct } = useMemo(() => {
    const req = requiredRailLength({
      modules: row?.modules || 0,
      moduleWidth: Number(moduleWidth) || 0,
      midClamp: Number(midClamp) || 0,
      endClampWidth: Number(endClampWidth) || 0,
      buffer: Number(buffer) || 0
    });

    if (req <= 0 || parsedLengths.length === 0) {
      return { required: req, result: null, extraPct: 0 };
    }

    // Generate scenarios and pick best based on priority
    const scenarios = generateScenarios({
      required: req,
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

    if (scenarios.length === 0) {
      return { required: req, result: null, extraPct: 0 };
    }

    // Sort by priority and pick best
    let sorted = [...scenarios];
    if (priority === 'length') {
      sorted.sort((a, b) => a.total - b.total);
    } else if (priority === 'joints') {
      sorted.sort((a, b) => a.joints - b.joints);
    }

    const res = sorted[0];
    const pct = res?.ok && req > 0
      ? (res.actualOvershoot / req) * 100
      : 0;

    return { required: req, result: res, extraPct: pct };
  }, [row, moduleWidth, midClamp, endClampWidth, buffer, parsedLengths,
      maxWastePct, allowUndershootPct, alphaJoint, betaSmall,
      gammaShort, costPerMm, costPerJointSet, joinerLength, priority]);

  if (!row) {
    return (
      <Card title="Result">
        <p className="text-gray-500 text-sm">Select a row to view details</p>
      </Card>
    );
  }

  if (!result || !result.ok) {
    return (
      <Card title={`Result - ${row.modules} Modules`}>
        <div className="text-red-600 text-sm">
          {result?.reason || "No solution found. Try adjusting settings or selecting more lengths."}
        </div>
      </Card>
    );
  }

  return (
    <Card title={`Result - ${row.modules} Modules`}>
      <div className="space-y-4">
        {/* Priority indicator */}
        <div className="text-xs text-purple-600 font-medium">
          Optimized for: {priority === 'length' ? 'Lesser Rail Length' : 'Lesser Joints'}
        </div>

        {/* Length Details */}
        <div className="space-y-2">
          <KV label="Required (mm)" value={fmt(required)} />
          <KV label="Total Rail Length (mm)" value={fmt(result.total)} />
          {result.joints > 0 && (
            <>
              <KV label="Joiner Length (mm)" value={fmt(result.joinerTotalLength)} />
              <KV label="Total with Joiners (mm)" value={fmt(result.totalLengthWithJoiners)} />
            </>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-red-600">Overshoot (mm)</span>
            <span className="font-medium text-red-600">{fmt(result.actualOvershoot)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-red-600">% Extra Length</span>
            <span className="font-medium text-red-600">{extraPct.toFixed(2)}%</span>
          </div>
          <KV label="Pieces" value={result.pieces} />
          <KV label="Joints" value={result.joints} />
          {userMode === 'advanced' && (
            <KV label="Small Pieces" value={result.smallCount} />
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="pt-3 mt-3 border-t">
          <h4 className="text-sm font-semibold mb-2">Cost Breakdown</h4>
          <div className="space-y-2">
            <KV label="Rail Material Cost" value={result.materialCost.toFixed(2)} />
            {result.joints > 0 && (
              <KV label="Joint Set Cost" value={result.jointSetCost.toFixed(2)} />
            )}
            <div className="flex justify-between text-sm font-semibold pt-1 border-t">
              <span className="text-gray-800">Total Cost</span>
              <span className="text-green-600">{result.totalActualCost.toFixed(2)}</span>
            </div>
          </div>
          {result.extraCost > 0 && (
            <div className="mt-3 pt-2 border-t border-red-200">
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Extra Cost (waste)</span>
                <span className="font-medium text-red-600">{result.extraCost.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Chosen Pieces */}
        <div className="pt-2">
          <h4 className="text-sm font-semibold mb-2">Chosen Pieces</h4>
          {result.plan.length === 0 ? (
            <div className="text-gray-500">—</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {result.plan.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full border px-2 py-1 text-sm bg-white"
                >
                  {p} mm
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Counts by Length */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Counts by Length</h4>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(result.countsByLength)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([len, ct]) => (
                  <tr key={len} className="border-t">
                    <td className="py-1 text-gray-600">{len} mm</td>
                    <td className="py-1 text-right font-medium">{ct}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
