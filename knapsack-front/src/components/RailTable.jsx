// src/components/RailTable.jsx
import { useMemo } from 'react';
import { optimizeCuts, requiredRailLength, generateScenarios } from '../lib/optimizer';
import { parseNumList, fmt } from '../lib/storage';

export default function RailTable({
  rows,
  setRows,
  selectedRowId,
  setSelectedRowId,
  settings
}) {
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
    priority
  } = settings;

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
        return { row, required, result: null };
      }

      // Generate scenarios and pick best based on priority
      const scenarios = generateScenarios({
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

      if (scenarios.length === 0) {
        return { row, required, result: null };
      }

      // Sort by priority and pick best
      let sorted = [...scenarios];
      if (priority === 'length') {
        sorted.sort((a, b) => a.total - b.total);
      } else if (priority === 'joints') {
        sorted.sort((a, b) => a.joints - b.joints);
      }

      const result = sorted[0];
      return { row, required, result };
    });
  }, [rows, moduleWidth, midClamp, endClampWidth, buffer, parsedLengths,
      maxWastePct, allowUndershootPct, alphaJoint, betaSmall,
      gammaShort, costPerMm, costPerJointSet, joinerLength, priority]);

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
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b">
        <h2 className="font-semibold">Rail Calculations</h2>
        <button
          onClick={addRow}
          className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
        >
          + Add Row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">Modules</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">Required</th>
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
              <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">Total</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">% Extra</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b">Joints</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b">Cost</th>
              <th className="px-2 py-2 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {rowResults.length === 0 ? (
              <tr>
                <td colSpan={allLengths.length + 7} className="px-4 py-8 text-center text-gray-500">
                  No rows yet. Click "Add Row" to get started.
                </td>
              </tr>
            ) : (
              rowResults.map(({ row, required, result }) => {
                const isSelected = row.id === selectedRowId;
                const extraPct = result?.ok && required > 0
                  ? ((result.actualOvershoot / required) * 100).toFixed(2)
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
                      {result?.ok ? fmt(result.totalLengthWithJoiners) : '-'}
                    </td>
                    <td className={`px-3 py-2 text-right border-b ${
                      result?.ok && result.actualOvershoot > 0 ? 'text-red-600' : ''
                    }`}>
                      {result?.ok ? `${extraPct}%` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      {result?.ok ? result.joints : '-'}
                    </td>
                    <td className="px-3 py-2 text-right border-b font-medium text-green-600">
                      {result?.ok ? result.totalActualCost.toFixed(2) : '-'}
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
