// src/components/RailTable.jsx
import { useMemo, useState } from 'react';
import { optimizeCuts, requiredRailLength, generateScenarios } from '../lib/optimizer';
import { parseNumList, fmt } from '../lib/storage';
import { TextField, NumberField } from './ui';

export default function RailTable({
  rows,
  setRows,
  selectedRowId,
  setSelectedRowId,
  settings,
  setSettings
}) {
  const [showSettings, setShowSettings] = useState(false);

  const {
    userMode,
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
    priority
  } = settings;

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const parsedLengths = useMemo(
    () => parseNumList(lengthsInput).filter(len => enabledLengths[len] !== false),
    [lengthsInput, enabledLengths]
  );

  const allLengths = useMemo(() => parseNumList(lengthsInput), [lengthsInput]);

  // Calculate results for each row
  const rowResults = useMemo(() => {
    return rows.map(row => {
      const required = requiredRailLength({
        modules: row.modules,
        moduleWidth: Number(moduleWidth) || 0,
        midClamp: Number(midClamp) || 0,
        endClampWidth: Number(endClampWidth) || 0,
        buffer: Number(buffer) || 0
      });

      if (required <= 0 || parsedLengths.length === 0) {
        return { row, required, combos: null, result: null };
      }

      // Generate scenarios and get C, L, J combos
      const combos = generateScenarios({
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

      if (!combos) {
        return { row, required, combos: null, result: null };
      }

      // Select combo based on priority
      let result;
      if (priority === 'cost') {
        result = combos.C;
      } else if (priority === 'length') {
        result = combos.L;
      } else if (priority === 'joints') {
        result = combos.J;
      } else {
        result = combos.C;  // Default to cost
      }

      return { row, required, combos, result };
    });
  }, [rows, moduleWidth, midClamp, endClampWidth, buffer, parsedLengths,
      maxWastePct, allowUndershootPct, alphaJoint, betaSmall,
      gammaShort, costPerMm, costPerJointSet, joinerLength, priority]);

  // Calculate totals for all columns
  const totals = useMemo(() => {
    const result = {
      required: 0,
      total: 0,
      joints: 0,
      cost: 0,
      countsByLength: {},
      wastage: 0
    };

    // Initialize counts for all lengths
    allLengths.forEach(len => {
      result.countsByLength[len] = 0;
    });

    rowResults.forEach(({ required, result: rowResult }) => {
      result.required += required;

      if (rowResult?.ok) {
        result.total += rowResult.totalRailLength;  // Sum of rail pieces only
        result.joints += rowResult.joints;
        result.cost += rowResult.totalActualCost;
        result.wastage += rowResult.overshootMm;  // Overshoot without joiners

        // Sum up piece counts for each length
        allLengths.forEach(len => {
          result.countsByLength[len] += (rowResult.countsByLength[len] || 0);
        });
      }
    });

    // Calculate overall wastage percentage
    result.wastagePct = result.required > 0
      ? ((result.wastage / result.required) * 100).toFixed(2)
      : 0;

    return result;
  }, [rowResults, allLengths]);

  const addRow = () => {
    const newId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
    const lastModules = rows.length > 0 ? rows[rows.length - 1].modules : 0;
    setRows([...rows, { id: newId, modules: lastModules + 1 }]);
    // Auto-select the new row
    setSelectedRowId(newId);
  };

  const updateRowModules = (id, modules) => {
    setRows(rows.map(r => r.id === id ? { ...r, modules: Number(modules) || 0 } : r));
  };

  const deleteRow = (id) => {
    const newRows = rows.filter(r => r.id !== id);
    setRows(newRows);
    if (selectedRowId === id) {
      setSelectedRowId(newRows.length > 0 ? newRows[0].id : null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm">
      <div className="flex justify-between items-center px-4 py-3 border-b">
        <h2 className="font-semibold">Rail Calculations</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            + Add Row
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-600"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {showSettings && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                {/* Header */}
                <div className="bg-linear-to-r from-purple-600 to-purple-700 px-4 py-3">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    Calculation Settings
                  </h3>
                </div>

                <div className="p-4 max-h-96 overflow-y-auto">
                  {/* Cost & Optimization Settings */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">Cost & Limits</h4>
                    <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                      <TextField
                        label="Cost per mm"
                        value={costPerMm}
                        setValue={(v) => updateSetting('costPerMm', v)}
                      />
                      <TextField
                        label="Cost per Joint Set"
                        value={costPerJointSet}
                        setValue={(v) => updateSetting('costPerJointSet', v)}
                      />
                      <TextField
                        label="Joiner Length (mm)"
                        value={joinerLength}
                        setValue={(v) => updateSetting('joinerLength', v)}
                      />
                      <NumberField
                        label="Max Pieces"
                        value={maxPieces}
                        setValue={(v) => updateSetting('maxPieces', v)}
                      />
                    </div>
                  </div>

                  {/* Advanced Settings */}
                  {userMode === 'advanced' && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-3">Advanced Tuning</h4>
                      <div className="space-y-3 bg-orange-50 rounded-lg p-3">
                        <NumberField
                          label="Max Waste %"
                          value={maxWastePct}
                          setValue={(v) => updateSetting('maxWastePct', v)}
                          step={0.01}
                        />
                        <NumberField
                          label="α Joint Penalty"
                          value={alphaJoint}
                          setValue={(v) => updateSetting('alphaJoint', v)}
                        />
                        <NumberField
                          label="β Small Penalty"
                          value={betaSmall}
                          setValue={(v) => updateSetting('betaSmall', v)}
                        />
                        <NumberField
                          label="Allow Undershoot %"
                          value={allowUndershootPct}
                          setValue={(v) => updateSetting('allowUndershootPct', v)}
                        />
                        <NumberField
                          label="γ Shortage Penalty"
                          value={gammaShort}
                          setValue={(v) => updateSetting('gammaShort', v)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t bg-gray-50 px-4 py-3">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-full py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">Modules</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="End Clamp">EC</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="Mid Clamp">MC</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 border-b cursor-help" title="Required Rail Length (mm)">Required</th>
              {allLengths.map(len => (
                <th
                  key={len}
                  className={`px-2 py-2 text-center font-medium border-b ${
                    enabledLengths[len] !== false ? 'text-gray-600' : 'text-gray-300'
                  }`}
                >
                  {len}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-gray-600 border-b cursor-help" title="Total Rail Length (mm)">Total</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 border-b cursor-help" title="Wastage (Total - Required)">Difference</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 border-b cursor-help" title="Percentage Extra Material">% Extra</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="Number of Joints Required">Joints</th>
              <th className="px-2 py-2 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {rowResults.length === 0 ? (
              <tr>
                <td colSpan={allLengths.length + 8} className="px-4 py-8 text-center text-gray-500">
                  No rows yet. Click "Add Row" to get started.
                </td>
              </tr>
            ) : (
              rowResults.map(({ row, required, result }) => {
                const isSelected = row.id === selectedRowId;
                const extraPct = result?.ok && required > 0
                  ? ((result.overshootMm / required) * 100).toFixed(2)
                  : '-';

                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRowId(row.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-50 border-l-4 border-l-purple-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2 border-b">
                      <input
                        type="number"
                        value={row.modules}
                        onChange={(e) => updateRowModules(row.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 px-2 py-1 border rounded text-center"
                        min="1"
                      />
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      2
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      {row.modules > 0 ? row.modules - 1 : 0}
                    </td>
                    <td className="px-3 py-2 text-right border-b font-medium">
                      {fmt(required)}
                    </td>
                    {allLengths.map(len => (
                      <td
                        key={len}
                        className={`px-2 py-2 text-center border-b ${
                          enabledLengths[len] !== false ? '' : 'text-gray-300'
                        }`}
                      >
                        {result?.ok ? (result.countsByLength[len] || 0) : '-'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right border-b font-medium">
                      {result?.ok ? fmt(result.totalRailLength) : '-'}
                    </td>
                    <td className={`px-3 py-2 text-right border-b ${
                      result?.ok && result.overshootMm > 0 ? 'text-red-600' : ''
                    }`}>
                      {result?.ok ? fmt(result.overshootMm) : '-'}
                    </td>
                    <td className={`px-3 py-2 text-right border-b ${
                      result?.ok && result.overshootMm > 0 ? 'text-red-600' : ''
                    }`}>
                      {result?.ok ? `${extraPct}%` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      {result?.ok ? result.joints : '-'}
                    </td>
                    <td className="px-2 py-2 border-b">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRow(row.id);
                        }}
                        className="text-gray-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
            {/* Totals Row */}
            {rowResults.length > 0 && (
              <tr className="bg-purple-50 font-semibold border-t-2 border-purple-200">
                <td className="px-3 py-2 border-b text-purple-700">Total</td>
                <td className="px-3 py-2 text-center border-b text-purple-700">-</td>
                <td className="px-3 py-2 text-center border-b text-purple-700">-</td>
                <td className="px-3 py-2 text-right border-b text-purple-700">
                  {fmt(totals.required)}
                </td>
                {allLengths.map(len => (
                  <td
                    key={len}
                    className={`px-2 py-2 text-center border-b ${
                      enabledLengths[len] !== false ? 'text-purple-700' : 'text-gray-300'
                    }`}
                  >
                    {totals.countsByLength[len] || 0}
                  </td>
                ))}
                <td className="px-3 py-2 text-right border-b text-purple-700">
                  {fmt(totals.total)}
                </td>
                <td className="px-3 py-2 text-right border-b text-red-600">
                  {fmt(totals.wastage)}
                </td>
                <td className="px-3 py-2 text-right border-b text-purple-700">
                  {totals.wastagePct}%
                </td>
                <td className="px-3 py-2 text-center border-b text-purple-700">
                  {totals.joints}
                </td>
                <td className="px-2 py-2 border-b"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Overall Summary Card */}
      {rowResults.length > 0 && (
        <div className="border-t bg-linear-to-r from-purple-50 to-green-50 px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-8">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Required</span>
                <p className="text-lg font-bold text-purple-700">{fmt(totals.required)} mm</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Rail Length</span>
                <p className="text-lg font-bold text-purple-700">{fmt(totals.total)} mm</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overall Wastage</span>
                <p className="text-lg font-bold text-red-600">{fmt(totals.wastage)} mm ({totals.wastagePct}%)</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Joints</span>
                <p className="text-lg font-bold text-purple-700">{totals.joints}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overall Cost</span>
              <p className="text-2xl font-bold text-green-600">₹{totals.cost.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
