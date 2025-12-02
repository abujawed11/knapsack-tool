// src/components/RailTable.jsx
import { useMemo, useState, useRef } from 'react';
import { optimizeCuts, requiredRailLength, generateScenarios } from '../lib/optimizer';
import { parseNumList, fmt } from '../lib/storage';
import { TextField, NumberField } from './ui';
import ResultCard from './ResultCard';

export default function RailTable({
  rows,
  setRows,
  selectedRowId,
  setSelectedRowId,
  settings,
  setSettings,
  selectedRow
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [enableSB2, setEnableSB2] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Draggable state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  // Drag handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX - position.x,
      startY: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragRef.current.startX,
        y: e.clientY - dragRef.current.startY
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset position when modal closes
  const closeModal = () => {
    setShowModal(false);
    setPosition({ x: 0, y: 0 });
  };

  const {
    userMode,
    moduleWidth,
    midClamp,
    endClampWidth,
    buffer,
    purlinDistance,
    railsPerSide,
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

  // Calculate default SB1 value for a row
  const calculateSB1 = (required) => {
    const purlin = Number(purlinDistance) || 1;
    return Math.ceil(required / purlin) + 1;
  };

  // Calculate totals for all columns
  const totals = useMemo(() => {
    const result = {
      modules: 0,
      endClamp: 0,
      midClamp: 0,
      required: 0,
      total: 0,
      joints: 0,
      cost: 0,
      countsByLength: {},
      wastage: 0,
      sb1: 0,
      sb2: 0
    };

    // Initialize counts for all lengths
    allLengths.forEach(len => {
      result.countsByLength[len] = 0;
    });

    // Sum with quantity multiplication: Σ(Qi × ValueI)
    rowResults.forEach(({ row, required, result: rowResult }) => {
      const qty = row.quantity || 1;

      result.modules += row.modules * qty;
      result.endClamp += 2 * qty;  // EC is always 2
      result.midClamp += (row.modules > 0 ? row.modules - 1 : 0) * qty;  // MC = modules - 1
      result.required += required * qty;

      if (rowResult?.ok) {
        result.total += rowResult.totalRailLength * qty;
        result.joints += rowResult.joints * qty;
        result.cost += rowResult.totalActualCost * qty;
        result.wastage += rowResult.overshootMm * qty;

        // Sum up piece counts for each length
        allLengths.forEach(len => {
          result.countsByLength[len] += (rowResult.countsByLength[len] || 0) * qty;
        });
      }

      // SB1 and SB2 calculations
      const defaultSB1 = calculateSB1(required);
      const sb1Value = enableSB2 ? (row.supportBase1 ?? defaultSB1) : defaultSB1;
      const sb2Value = row.supportBase2 ?? 0;

      result.sb1 += sb1Value * qty;
      result.sb2 += sb2Value * qty;
    });

    // Multiply all totals by railsPerSide
    const rps = Number(railsPerSide) || 1;
    result.modules *= rps;
    result.endClamp *= rps;
    result.midClamp *= rps;
    result.required *= rps;
    result.total *= rps;
    result.joints *= rps;
    result.cost *= rps;
    result.wastage *= rps;
    result.sb1 *= rps;
    result.sb2 *= rps;

    allLengths.forEach(len => {
      result.countsByLength[len] *= rps;
    });

    // Calculate overall wastage percentage
    result.wastagePct = result.required > 0
      ? ((result.wastage / result.required) * 100).toFixed(2)
      : 0;

    return result;
  }, [rowResults, allLengths, railsPerSide, enableSB2]);

  const addRow = () => {
    const newId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
    const lastModules = rows.length > 0 ? rows[rows.length - 1].modules : 0;
    setRows([...rows, { id: newId, modules: lastModules + 1, quantity: 1 }]);
    // Auto-select the new row
    setSelectedRowId(newId);
  };

  const updateRowModules = (id, modules) => {
    setRows(rows.map(r => r.id === id ? { ...r, modules: Number(modules) || 0 } : r));
  };

  const updateRowQuantity = (id, quantity) => {
    setRows(rows.map(r => r.id === id ? { ...r, quantity: Math.max(1, Number(quantity) || 1) } : r));
  };

  const deleteRow = (id) => {
    const newRows = rows.filter(r => r.id !== id);
    setRows(newRows);
    if (selectedRowId === id) {
      setSelectedRowId(newRows.length > 0 ? newRows[0].id : null);
    }
  };

  const updateRowSupportBase = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: Number(value) || 0 } : r));
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
            {/* Row 1: main headers + grouped title over cut lengths */}
            <tr>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b"
              >
                Quantity
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b"
              >
                Modules
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help"
                title="End Clamp"
              >
                End Clamp
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help"
                title="Mid Clamp"
              >
                Mid Clamp
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help"
                title="Required Rail Length (mm)"
              >
                Required Rail Length
              </th>

              {/* Group header over all cut-length columns */}
              <th
                colSpan={allLengths.length}
                className="px-3 py-2 text-center font-semibold text-purple-700 border-b border-x bg-purple-50"
              >
                Long Rail Cut length Combinations
              </th>

              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help"
                title="Total Rail Length (mm)"
              >
                Supply Rail Length
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help"
                title="Wastage (Total - Required)"
              >
                Extra Supply in mm
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help"
                title="Percentage Extra Material"
              >
                Extra Supply in %
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help"
                title="Number of Joints Required"
              >
                Joints
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help"
                title="Support Base 1"
              >
                SB1
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-center font-medium text-gray-600 border-b"
              >
                <div className="flex items-center justify-center gap-1">
                  <input
                    type="checkbox"
                    checked={enableSB2}
                    onChange={(e) => setEnableSB2(e.target.checked)}
                    className="w-3.5 h-3.5 text-purple-600 rounded cursor-pointer"
                    title="Enable Support Base 2 column"
                  />
                  <span className="cursor-help" title="Support Base 2">
                    SB2
                  </span>
                </div>
              </th>
              <th
                rowSpan={2}
                className="px-2 py-2 border-b"
              />
            </tr>

            {/* Row 2: individual cut-length headers */}
            <tr>
              {allLengths.map((len) => (
                <th
                  key={len}
                  className={`px-2 py-2 text-center font-medium border-b ${enabledLengths[len] !== false ? 'text-gray-600' : 'text-gray-300'
                    }`}
                >
                  {len}
                </th>
              ))}
            </tr>
          </thead>

          {/* <thead className="bg-gray-50">
            <tr className="bg-gray-100">
              <th colSpan={5} className="px-3 py-1 border-b bg-gray-50"></th>
              <th colSpan={allLengths.length} className="px-3 py-2 text-center font-semibold text-purple-700 border-b border-l border-r bg-purple-50">
                Long Rail Cut length Combinations
              </th>
              <th colSpan={7} className="px-3 py-1 border-b bg-gray-50"></th>
            </tr>
            <tr>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b">Quantity</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">Modules</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="End Clamp">End Clamp</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="Mid Clamp">Mid Clamp</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="Required Rail Length (mm)">Required Rail Length</th>
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
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="Total Rail Length (mm)">Supply Rail Length</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="Wastage (Total - Required)">Extra Supply in mm</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="Percentage Extra Material">Extra Supply in %</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="Number of Joints Required">Joints</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b cursor-help" title="Support Base 1">SB1</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b">
                <div className="flex items-center justify-center gap-1">
                  <input
                    type="checkbox"
                    checked={enableSB2}
                    onChange={(e) => setEnableSB2(e.target.checked)}
                    className="w-3.5 h-3.5 text-purple-600 rounded cursor-pointer"
                    title="Enable Support Base 2 column"
                  />
                  <span className="cursor-help" title="Support Base 2">SB2</span>
                </div>
              </th>
              <th className="px-2 py-2 border-b"></th>
            </tr>
          </thead> */}
          <tbody>
            {rowResults.length === 0 ? (
              <tr>
                <td colSpan={allLengths.length + 11} className="px-4 py-8 text-center text-gray-500">
                  No rows yet. Click "Add Row" to get started.
                </td>
              </tr>
            ) : (
              rowResults.map(({ row, required, result }) => {
                const isSelected = row.id === selectedRowId;
                const extraPct = result?.ok && required > 0
                  ? ((result.overshootMm / required) * 100).toFixed(2)
                  : '-';

                // Calculate default SB1
                const defaultSB1 = calculateSB1(required);
                const sb1Value = enableSB2 ? (row.supportBase1 ?? defaultSB1) : defaultSB1;
                const sb2Value = row.supportBase2 ?? 0;

                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setSelectedRowId(row.id);
                      setShowModal(true);
                    }}
                    className={`cursor-pointer transition-colors ${isSelected
                        ? 'bg-purple-50 border-l-4 border-l-purple-500'
                        : 'hover:bg-gray-50'
                      }`}
                  >
                    <td className="px-3 py-2 border-b">
                      <input
                        type="number"
                        value={row.quantity ?? 1}
                        onChange={(e) => updateRowQuantity(row.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 px-2 py-1 border rounded text-center"
                        min="1"
                      />
                    </td>
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
                    <td className="px-3 py-2 text-center border-b font-medium">
                      {fmt(required)}
                    </td>
                    {allLengths.map(len => (
                      <td
                        key={len}
                        className={`px-2 py-2 text-center border-b ${enabledLengths[len] !== false ? '' : 'text-gray-300'
                          }`}
                      >
                        {result?.ok ? (result.countsByLength[len] || 0) : '-'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center border-b font-medium">
                      {result?.ok ? fmt(result.totalRailLength) : '-'}
                    </td>
                    <td className={`px-3 py-2 text-center border-b ${result?.ok && result.overshootMm > 0 ? 'text-red-600' : ''
                      }`}>
                      {result?.ok ? fmt(result.overshootMm) : '-'}
                    </td>
                    <td className={`px-3 py-2 text-center border-b ${result?.ok && result.overshootMm > 0 ? 'text-red-600' : ''
                      }`}>
                      {result?.ok ? `${extraPct}%` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      {result?.ok ? result.joints : '-'}
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      {enableSB2 ? (
                        <input
                          type="number"
                          value={sb1Value}
                          onChange={(e) => updateRowSupportBase(row.id, 'supportBase1', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 px-2 py-1 border rounded text-center"
                          min="0"
                        />
                      ) : (
                        defaultSB1
                      )}
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      {enableSB2 ? (
                        <input
                          type="number"
                          value={sb2Value}
                          onChange={(e) => updateRowSupportBase(row.id, 'supportBase2', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 px-2 py-1 border rounded text-center"
                          min="0"
                        />
                      ) : (
                        '-'
                      )}
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
              <tr className="bg-linear-to-r from-purple-100 to-purple-50 font-bold border-t-4 border-purple-400 shadow-sm">
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-purple-700">-</td>
                <td className="px-3 py-3 border-b-2 border-purple-300 text-purple-800">{totals.modules}</td>
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-purple-800">{totals.endClamp}</td>
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-purple-800">{totals.midClamp}</td>
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-purple-800">
                  {fmt(totals.required)}
                </td>
                {allLengths.map(len => (
                  <td
                    key={len}
                    className={`px-2 py-3 text-center border-b-2 border-purple-300 ${enabledLengths[len] !== false ? 'text-purple-800 font-bold' : 'text-gray-400'
                      }`}
                  >
                    {totals.countsByLength[len] || 0}
                  </td>
                ))}
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-purple-800">
                  {fmt(totals.total)}
                </td>
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-red-700 font-bold">
                  {fmt(totals.wastage)}
                </td>
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-purple-800">
                  {totals.wastagePct}%
                </td>
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-purple-800">
                  {totals.joints}
                </td>
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-purple-800">{totals.sb1}</td>
                <td className="px-3 py-3 border-b-2 border-purple-300 text-center text-purple-800">
                  {enableSB2 ? totals.sb2 : '-'}
                </td>
                <td className="px-2 py-3 border-b-2 border-purple-300"></td>
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

      {/* Result Popover */}
      {showModal && selectedRow && (
        <div
          className="fixed top-40 right-8 z-50 w-80 animate-fadeIn"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            cursor: isDragging ? 'grabbing' : 'default'
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200">
            {/* Popover Header */}
            <div
              className="bg-linear-to-r from-purple-600 to-purple-700 px-3 py-2 flex justify-between items-center rounded-t-xl cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
            >
              <h3 className="font-semibold text-white text-xs">Row Details - {selectedRow.modules} Modules</h3>
              <button
                onClick={closeModal}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-white hover:text-gray-200 text-xl leading-none font-light transition-colors cursor-pointer"
                title="Close"
              >
                ×
              </button>
            </div>

            {/* Popover Content */}
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-4">
              <ResultCard row={selectedRow} settings={settings} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
