import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { projectAPI, walkwayAPI, walkwayItemAPI } from '../services/api';
import { calculateWalkwayBOM } from '../lib/walkwayBomCalculations';
import { DEFAULT_MAGNELIS_RATE_PER_KG, DEFAULT_ALUMINIUM_RATE_PER_KG } from '../constants/bomDefaults';
import PrintSettingsModal from '../components/BOM/PrintSettingsModal';
import { useAuth } from '../context/AuthContext';

const WALKWAY_PROJECT_KEY = 'currentWalkwayProjectId';

const FIELD_LABELS = {
  baseQty:  'Base Qty',
  spareQty: 'Spare Qty',
  rateKg:   'Rate/kg (₹)',
  ratePc:   'Rate/pc (₹)',
  wtPc:     'Wt/pc (kg)',
};

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel({ settings, onChange, editMode }) {
  const { magnelisRate, alRate, sparePct, includeBlindRivets, includeSDS } = settings;
  const set = (key, value) => onChange({ ...settings, [key]: value });
  const fastenerError = !includeBlindRivets && !includeSDS;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm px-6 py-4 transition-colors ${editMode ? 'border-2 border-yellow-400' : 'border-gray-200'}`}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
        BOM Settings — edit to update live
        {editMode && <span className="ml-3 text-yellow-600 normal-case font-semibold">● Edit mode active</span>}
      </p>
      <div className="flex flex-wrap gap-6 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Magnelis Rate <span className="text-gray-400 font-normal">(₹/kg)</span></label>
          <input type="number" min="0" step="0.01" value={magnelisRate}
            onChange={e => set('magnelisRate', parseFloat(e.target.value) || 0)}
            className="px-3 py-2 border-2 border-yellow-300 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent w-36 bg-yellow-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Aluminium Rate <span className="text-gray-400 font-normal">(₹/kg)</span></label>
          <input type="number" min="0" step="0.01" value={alRate}
            onChange={e => set('alRate', parseFloat(e.target.value) || 0)}
            className="px-3 py-2 border-2 border-blue-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent w-36 bg-blue-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600">Spare %</label>
          <input type="number" min="0" step="0.1" value={sparePct}
            onChange={e => set('sparePct', parseFloat(e.target.value) || 0)}
            className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent w-24"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-gray-600">Fasteners</span>
          <div className="flex gap-3">
            <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${includeBlindRivets ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500'}`}>
              <input type="checkbox" checked={includeBlindRivets} onChange={e => set('includeBlindRivets', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
              Blind Rivets
            </label>
            <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${includeSDS ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500'}`}>
              <input type="checkbox" checked={includeSDS} onChange={e => set('includeSDS', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
              SDS Screws
            </label>
          </div>
          {fastenerError && <p className="text-red-500 text-xs font-medium mt-0.5">Select at least one fastener.</p>}
        </div>
      </div>
    </div>
  );
}

// ── BOM Table ─────────────────────────────────────────────────────────────────

const SEP   = <td className="bg-gray-200 w-3 p-0" />;
const SEP_H = (rowSpan) => <th rowSpan={rowSpan} className="bg-gray-200 w-3 p-0" />;

function EditInput({ value, index, field, sectionKey, sectionOverrides, onItemChange, isInt = false, step = 1 }) {
  const hasOverride = sectionOverrides?.[index]?.[field] !== undefined;
  return (
    <input
      type="number" min={0} step={step} value={value ?? ''}
      onChange={e => {
        const raw = isInt ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
        onItemChange(sectionKey, index, field, isNaN(raw) ? 0 : raw);
      }}
      className={`w-20 px-2 py-1 text-center text-xs font-semibold rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
        hasOverride ? 'bg-yellow-50 border-yellow-400 text-yellow-900' : 'bg-gray-50 border-gray-300 text-gray-800'
      }`}
    />
  );
}

function BOMSectionTable({ title, items, accentColor = 'blue', editMode = false, sectionKey, sectionOverrides = {}, onItemChange, onRowReset, canEditWtPc = false }) {
  const headerBg  = accentColor === 'orange' ? 'bg-orange-600' : 'bg-blue-700';
  const totalCost = items.reduce((s, i) => s + (i.cost || 0), 0);
  const totalWt   = items.reduce((s, i) => s + (i.totalWeight || 0), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className={`px-6 py-3 ${headerBg}`}>
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200">
              {editMode && <th rowSpan={2} className="px-3 py-2 text-center border-r border-gray-200 text-gray-400 w-12">Reset</th>}
              <th colSpan={6} className="px-4 py-2 text-left border-r border-gray-200">Item Details</th>
              {SEP_H(2)}
              <th colSpan={2} className="px-4 py-2 text-center border-r border-gray-200">Spare</th>
              {SEP_H(2)}
              <th colSpan={5} className="px-4 py-2 text-center">Weight &amp; Cost Calculation</th>
            </tr>
            <tr className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left w-10">S.No</th>
              <th className="px-4 py-3 text-left">Description</th>
              {/* <th className="px-4 py-3 text-left">Profile</th> */}
              <th className="px-4 py-3 text-center">Cut Length (mm)</th>
              <th className="px-4 py-3 text-center">Material</th>
              <th className="px-4 py-3 text-center">UoM</th>
              <th className="px-4 py-3 text-center border-r border-gray-200">Base Qty</th>
              <th className="px-4 py-3 text-center">Spare</th>
              <th className="px-4 py-3 text-center font-bold text-gray-800 border-r border-gray-200">Total Qty</th>
              <th className="px-4 py-3 text-center">Wt/pc (kg)</th>
              <th className="px-4 py-3 text-center">Total Wt (kg)</th>
              <th className="px-4 py-3 text-center">Rate/kg (₹)</th>
              <th className="px-4 py-3 text-center">Rate/pc (₹)</th>
              <th className="px-4 py-3 text-center">Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, i) => {
              const hasRowOverride = !!sectionOverrides[i] && Object.keys(sectionOverrides[i]).length > 0;
              const isWeightBased  = item.rateKg != null;
              return (
                <tr key={i} className={`transition-colors ${hasRowOverride && editMode ? 'bg-yellow-50/40' : 'hover:bg-gray-50'}`}>
                  {editMode && (
                    <td className="px-3 py-2 text-center border-r border-gray-100">
                      {hasRowOverride && (
                        <button onClick={() => onRowReset(sectionKey, i)} title="Reset row to auto-calculated values" className="text-gray-400 hover:text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-400 font-medium text-center">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.description}</td>
                  {/* <td className="px-4 py-3 text-center text-gray-400 text-xs">—</td> */}
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">{item.cutLength != null ? item.cutLength : '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{item.material}</td>
                  <td className="px-4 py-3 text-center text-gray-500">Nos</td>
                  <td className="px-3 py-2 text-center border-r border-gray-200">
                    {editMode
                      ? <EditInput value={item.baseQty} index={i} field="baseQty" sectionKey={sectionKey} sectionOverrides={sectionOverrides} onItemChange={onItemChange} isInt />
                      : <span className="text-gray-700">{item.baseQty.toLocaleString()}</span>}
                  </td>
                  {SEP}
                  <td className="px-3 py-2 text-center">
                    {editMode
                      ? <EditInput value={item.spareQty} index={i} field="spareQty" sectionKey={sectionKey} sectionOverrides={sectionOverrides} onItemChange={onItemChange} isInt />
                      : <span className="text-gray-500">{item.spareQty}</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-gray-900 border-r border-gray-200">{item.totalQty.toLocaleString()}</td>
                  {SEP}
                  <td className={`px-4 py-3 text-center text-gray-600 ${editMode && canEditWtPc && item.wtPc != null && sectionOverrides[i]?.wtPc !== undefined ? 'bg-yellow-50' : ''}`}>
                    {editMode && canEditWtPc && item.wtPc != null
                      ? <EditInput value={sectionOverrides[i]?.wtPc ?? item.wtPc} index={i} field="wtPc" sectionKey={sectionKey} sectionOverrides={sectionOverrides} onItemChange={onItemChange} step={0.0001} />
                      : (item.wtPc != null ? item.wtPc.toFixed(4) : '—')}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {item.totalWeight != null && item.totalWeight > 0 ? item.totalWeight.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {editMode && isWeightBased
                      ? <EditInput value={item.rateKg} index={i} field="rateKg" sectionKey={sectionKey} sectionOverrides={sectionOverrides} onItemChange={onItemChange} step={0.01} />
                      : item.rateKg != null ? `₹${item.rateKg.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {editMode
                      ? <EditInput value={sectionOverrides[i]?.ratePc ?? item.ratePc} index={i} field="ratePc" sectionKey={sectionKey} sectionOverrides={sectionOverrides} onItemChange={onItemChange} step={0.01} />
                      : item.ratePc != null ? `₹${item.ratePc.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">
                    {item.cost != null ? `₹${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-900 text-white border-t-2 border-gray-600">
              {editMode && <td className="bg-gray-800 w-12 p-0" />}
              <td colSpan={6} className="px-4 py-3 text-right font-bold text-sm text-gray-300">Section Total</td>
              <td className="bg-gray-700 w-3 p-0" />
              <td colSpan={2} className="px-4 py-3"></td>
              <td className="bg-gray-700 w-3 p-0" />
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-center font-bold text-yellow-300">{totalWt > 0 ? totalWt.toFixed(2) : '—'}</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-center font-black text-yellow-400 text-base">
                ₹{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Override application ──────────────────────────────────────────────────────

function applyOverridesToSection(items, sectionOvr) {
  if (!items) return null;
  return items.map((item, i) => {
    const ov = sectionOvr?.[i];
    if (!ov) return item;

    const baseQty  = ov.baseQty  ?? item.baseQty;
    const spareQty = ov.spareQty ?? item.spareQty;
    const totalQty = baseQty + spareQty;
    const wtPc     = ov.wtPc     ?? item.wtPc;
    const rateKg   = ov.rateKg   !== undefined ? ov.rateKg   : item.rateKg;
    const ratePc   = ov.ratePc   !== undefined ? ov.ratePc   : item.ratePc;

    let totalWeight, cost;
    if (rateKg != null && wtPc != null) {
      totalWeight = parseFloat((totalQty * wtPc).toFixed(2));
      // If user directly overrode rate/pc, use it for cost; otherwise derive from weight × rate/kg
      cost = ov.ratePc !== undefined
        ? parseFloat((totalQty * ratePc).toFixed(2))
        : parseFloat((totalWeight * rateKg).toFixed(2));
    } else {
      totalWeight = wtPc != null ? parseFloat((totalQty * wtPc).toFixed(2)) : null;
      cost        = ratePc != null ? parseFloat((totalQty * ratePc).toFixed(2)) : null;
    }

    return { ...item, baseQty, spareQty, totalQty, wtPc, rateKg, ratePc, totalWeight, cost };
  });
}

// ── Review Changes Modal ──────────────────────────────────────────────────────

function ReviewChangesModal({ changes, onConfirm, onCancel }) {
  const [reasons, setReasons]             = useState({});
  const [applyToFuture, setApplyToFuture] = useState({});

  const isValid = changes.length > 0 && changes.every(c => reasons[c.id]?.trim().length > 0);

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(changes.map(c => ({ ...c, reason: reasons[c.id].trim(), applyToFuture: !!applyToFuture[c.id] })));
  };

  const sectionLabel = (s) => s === 'horizontal' ? 'Section A — Horizontal' : 'Section B — Vertical';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-yellow-500 px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-white">Review Changes</h2>
          <p className="text-yellow-100 text-sm mt-0.5">
            {changes.length} change{changes.length !== 1 ? 's' : ''} detected — provide a reason for each before confirming.
          </p>
        </div>

        {/* Change list */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {changes.map((c) => (
            <div key={c.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Item</span>
                  <span className="font-semibold text-gray-900">{c.itemDescription}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Section</span>
                  <span className="font-medium text-gray-700">{sectionLabel(c.section)}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Field</span>
                  <span className="font-medium text-gray-700">{FIELD_LABELS[c.field] ?? c.field}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Change</span>
                  <span className="text-red-500 font-medium">{c.oldValue ?? '—'}</span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="text-green-600 font-bold">{c.newValue ?? '—'}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reasons[c.id] ?? ''}
                  onChange={e => setReasons(prev => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="Enter reason for this change…"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
              </div>
              {c.field === 'wtPc' && c.masterItemId && (
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 mt-1">
                  <input
                    type="checkbox"
                    checked={!!applyToFuture[c.id]}
                    onChange={e => setApplyToFuture(prev => ({ ...prev, [c.id]: e.target.checked }))}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <span>Apply to Future — update master Wt/pc in database</span>
                </label>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-400">
            {Object.values(reasons).filter(r => r?.trim().length > 0).length} / {changes.length} reasons filled
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-semibold text-gray-600 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Back to Editing
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValid}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-colors shadow-sm ${
                isValid ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Confirm &amp; Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Truncated Cell ────────────────────────────────────────────────────────────

function TruncatedCell({ text, limit = 60, className = '' }) {
  const [open, setOpen] = useState(false);
  if (!text) return <span className={className}>—</span>;
  const needsTrunc = text.length > limit;
  return (
    <span className={`inline-flex items-start gap-1 ${className}`}>
      <span>{needsTrunc && !open ? text.slice(0, limit) + '…' : text}</span>
      {needsTrunc && (
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          title={open ? 'Collapse' : 'Expand'}
        >
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </span>
  );
}

// ── Change Log Section ────────────────────────────────────────────────────────

function ChangeLogSection({ changeLog }) {
  const [expanded, setExpanded] = useState(false);
  if (!changeLog.length) return null;

  const sectionLabel = (s) => s === 'horizontal' ? 'Sec A' : 'Sec B';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-sm font-bold text-gray-700">Change Log</span>
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
            {changeLog.length} {changeLog.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left w-20">Timestamp</th>
                <th className="px-4 py-3 text-left w-40">Item</th>
                <th className="px-4 py-3 text-center">Section</th>
                <th className="px-4 py-3 text-center">Field</th>
                <th className="px-4 py-3 text-center">Old Value</th>
                <th className="px-4 py-3 text-center">New Value</th>
                <th className="px-4 py-3 text-left w-80">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...changeLog].reverse().map((entry, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 w-20">
                    <span className="block">{new Date(entry.timestamp).toLocaleDateString()}</span>
                    <span className="block text-gray-300">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 text-xs w-40">
                    <TruncatedCell text={entry.itemDescription} limit={40} />
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{sectionLabel(entry.section)}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">{FIELD_LABELS[entry.field] ?? entry.field}</td>
                  <td className="px-4 py-3 text-center text-red-500 font-medium text-xs">{entry.oldValue ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-green-600 font-bold text-xs">{entry.newValue ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 italic text-xs w-80">
                    "<TruncatedCell text={entry.reason} limit={80} />"
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  magnelisRate: DEFAULT_MAGNELIS_RATE_PER_KG,
  alRate: DEFAULT_ALUMINIUM_RATE_PER_KG,
  sparePct: 0.1,
  includeBlindRivets: true,
  includeSDS: true,
};

const EMPTY_OVERRIDES = { horizontal: {}, vertical: {} };

export default function WalkwayBOMPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { can }   = useAuth();
  // When navigated with { state: { resetBOM: true } }, ignore any saved BOM data
  const resetBOM  = location.state?.resetBOM === true;

  const [project, setProject]                   = useState(null);
  const [rows, setRows]                         = useState([]);
  const [walkwayMasterItems, setWalkwayMasterItems] = useState([]);
  const [settings, setSettings]         = useState(DEFAULT_SETTINGS);
  const [bomActive, setBomActive]       = useState(true);
  const [overrides, setOverrides]       = useState(EMPTY_OVERRIDES);
  const [changeLog, setChangeLog]       = useState([]);
  const [editMode, setEditMode]         = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');
  const [error, setError]               = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Snapshot of displayBom items at the moment edit mode was entered
  // Used as the reference "old value" for change tracking
  const editSnapshotRef = useRef(null);

  // ── Load ──
  useEffect(() => {
    const projectId = localStorage.getItem(WALKWAY_PROJECT_KEY);
    if (!projectId) { navigate('/walkway/create'); return; }

    const load = async () => {
      try {
        const [proj, savedRows, masterItems] = await Promise.all([
          projectAPI.getById(projectId),
          walkwayAPI.getRows(projectId),
          walkwayItemAPI.getAll(),
        ]);
        setProject(proj);
        setRows(savedRows ?? []);
        setWalkwayMasterItems(masterItems ?? []);

        // Skip restoring saved data when user explicitly chose "Create New BOM"
        if (!resetBOM) {
          try {
            const saved = await walkwayAPI.getBOM(projectId);
            if (saved?.bomData?.moduleType === 'WALKWAY' && saved.bomData.settings) {
              setSettings(saved.bomData.settings);
              if (saved.bomData.overrides)  setOverrides(saved.bomData.overrides);
              if (saved.bomData.changeLog)  setChangeLog(saved.bomData.changeLog);
              setBomActive(true);
            }
          } catch { /* no saved BOM yet */ }
        }
      } catch (err) {
        setError('Failed to load project data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  // ── Base BOM ──
  const bom = useMemo(() => {
    if (!bomActive || settings.magnelisRate <= 0 || settings.alRate <= 0) return null;
    if (!settings.includeBlindRivets && !settings.includeSDS) return null;
    return calculateWalkwayBOM(rows, settings, walkwayMasterItems);
  }, [rows, settings, bomActive, walkwayMasterItems]);

  // ── Display BOM (overrides applied) ──
  const displayBom = useMemo(() => {
    if (!bom) return null;
    const horizontal = applyOverridesToSection(bom.horizontal, overrides.horizontal);
    const vertical   = applyOverridesToSection(bom.vertical,   overrides.vertical);
    const allItems   = [...(horizontal ?? []), ...(vertical ?? [])];
    const totalCost  = allItems.reduce((s, i) => s + (i.cost || 0), 0);
    const costPerRM  = bom.summary.totalLength > 0 ? totalCost / bom.summary.totalLength : 0;
    return {
      horizontal,
      vertical,
      summary: {
        ...bom.summary,
        totalCost: parseFloat(totalCost.toFixed(2)),
        costPerRM: parseFloat(costPerRM.toFixed(2)),
      },
    };
  }, [bom, overrides]);

  // ── Manual save ──
  const handleSave = async () => {
    const projectId = localStorage.getItem(WALKWAY_PROJECT_KEY);
    if (!projectId || !displayBom) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await walkwayAPI.saveBOM(projectId, {
        moduleType: 'WALKWAY',
        settings,
        bom: displayBom,
        overrides,
        changeLog,
        generatedAt: new Date().toISOString(),
      });
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      console.error('Failed to save BOM:', err);
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset all overrides back to auto-calculated defaults ──
  const handleReset = () => {
    if (!window.confirm('Reset all manual edits? This will revert all quantities, rates, and weights back to their calculated defaults. The change log will be cleared. This cannot be undone until you save.')) return;
    setOverrides(EMPTY_OVERRIDES);
    setChangeLog([]);
    setPendingChanges({});
    editSnapshotRef.current = null;
    setEditMode(false);
    setSaveMsg('');
  };

  // ── Settings change ──
  const handleSettingsChange = useCallback((next) => {
    setSettings(next);
  }, []);

  // ── Edit mode enter ──
  const handleEnterEditMode = () => {
    // Snapshot current item values as the baseline for change tracking
    editSnapshotRef.current = {
      horizontal: displayBom?.horizontal ? [...displayBom.horizontal] : [],
      vertical:   displayBom?.vertical   ? [...displayBom.vertical]   : [],
    };
    setPendingChanges({});
    setEditMode(true);
  };

  // ── Field change (tracks pending changes against snapshot) ──
  const handleItemChange = useCallback((section, index, field, value) => {
    // Update override
    setOverrides(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [index]: { ...(prev[section]?.[index] ?? {}), [field]: value },
      },
    }));

    // Track change against snapshot
    const changeId = `${section}-${index}-${field}`;
    const snapshot  = editSnapshotRef.current;
    const oldValue  = snapshot?.[section]?.[index]?.[field] ?? null;

    setPendingChanges(prev => {
      // If user reverted to original value, drop the tracking entry
      if (value === oldValue) {
        const next = { ...prev };
        delete next[changeId];
        return next;
      }
      return {
        ...prev,
        [changeId]: {
          id: changeId,
          section,
          itemIndex: index,
          itemDescription: snapshot?.[section]?.[index]?.description ?? `Row ${index + 1}`,
          masterItemId: snapshot?.[section]?.[index]?.masterItemId ?? null,
          field,
          oldValue: prev[changeId]?.oldValue ?? oldValue, // preserve original old on repeated edits
          newValue: value,
        },
      };
    });
  }, []);

  // ── Row reset ──
  const handleRowReset = useCallback((section, index) => {
    setOverrides(prev => {
      const next = { ...prev[section] };
      delete next[index];
      return { ...prev, [section]: next };
    });
    // Clear pending changes for this row
    setPendingChanges(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.startsWith(`${section}-${index}-`)) delete next[key];
      });
      return next;
    });
  }, []);

  // ── Done editing — open review modal if there are changes ──
  const handleDoneEditing = () => {
    const changes = Object.values(pendingChanges);
    if (changes.length > 0) {
      setReviewModalOpen(true);
    } else {
      // No changes — just exit
      setEditMode(false);
      editSnapshotRef.current = null;
    }
  };

  // ── Review confirmed — append to changeLog, optionally update master DB ──
  const handleReviewConfirm = async (changesWithReasons) => {
    const masterUpdates = changesWithReasons.filter(c => c.applyToFuture && c.field === 'wtPc' && c.masterItemId);
    if (masterUpdates.length > 0) {
      try {
        await Promise.all(masterUpdates.map(c => walkwayItemAPI.update(c.masterItemId, { wtPc: c.newValue })));
        const refreshed = await walkwayItemAPI.getAll();
        setWalkwayMasterItems(refreshed ?? []);
      } catch (err) {
        console.error('Failed to update master Wt/pc:', err);
      }
    }

    const newEntries = changesWithReasons.map(c => ({
      ...c,
      timestamp: new Date().toISOString(),
    }));
    setChangeLog(prev => [...prev, ...newEntries]);
    setPendingChanges({});
    editSnapshotRef.current = null;
    setReviewModalOpen(false);
    setEditMode(false);
  };

  const handleReviewCancel = () => {
    setReviewModalOpen(false);
    // Stay in edit mode
  };

  const handlePrintPreview = (printSettings) => {
    sessionStorage.setItem('walkwayBomPrint', JSON.stringify({ bom: displayBom, settings, project, changeLog, printSettings }));
    navigate('/walkway-bom/print-preview');
  };

  const canPrint = !!displayBom && !editMode;

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-200"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-yellow-500 absolute top-0 left-0"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading BOM...</p>
        </div>
      </div>
    );
  }

  const pendingCount = Object.keys(pendingChanges).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {reviewModalOpen && (
        <ReviewChangesModal
          changes={Object.values(pendingChanges)}
          onConfirm={handleReviewConfirm}
          onCancel={handleReviewCancel}
        />
      )}

      <PrintSettingsModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onPrint={(ps) => { handlePrintPreview(ps); setShowPrintModal(false); }}
        changeLog={changeLog}
      />

      {/* ── Navbar ── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <img src="/white_back_photo.svg" alt="Logo" className="h-7 shrink-0" />

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">

            {saveMsg && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${saveMsg === 'Saved!' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                {saveMsg}
              </span>
            )}

            {/* Edit BOM */}
            {displayBom && !editMode && (
              <button onClick={handleEnterEditMode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit BOM
              </button>
            )}

            {/* Done Editing */}
            {editMode && (
              <button onClick={handleDoneEditing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Done Editing
                {pendingCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-white/30 text-white text-xs font-black rounded-full">{pendingCount}</span>
                )}
              </button>
            )}

            {/* Reset */}
            {displayBom && !editMode && (
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                title="Revert all manual edits to auto-calculated defaults">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset
              </button>
            )}

            {/* Save BOM */}
            {displayBom && !editMode && (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors shadow-sm disabled:opacity-60">
                {saving
                  ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                }
                {saving ? 'Saving...' : 'Save BOM'}
              </button>
            )}

            {/* Print */}
            <button onClick={() => setShowPrintModal(true)} disabled={!canPrint}
              title={editMode ? 'Finish editing before printing' : ''}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border rounded-lg transition-colors ${canPrint ? 'text-gray-600 border-gray-300 hover:bg-gray-50' : 'text-gray-300 border-gray-100 cursor-not-allowed'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>

            {/* Back */}
            <button onClick={() => navigate('/walkway-app')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>
      </header>

      {/* ── Project Info Banner ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-x-8 gap-y-1">
          <div>
            <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">Walkway BOM</p>
            <h1 className="text-lg font-black text-gray-900 leading-tight">Bill of Materials</h1>
          </div>
          {project && (
            <>
              <div className="h-10 w-px bg-gray-200 hidden sm:block" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Project</p>
                <p className="text-sm font-bold text-gray-800">{project.name}</p>
              </div>
              <div className="h-10 w-px bg-gray-200 hidden sm:block" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Client</p>
                <p className="text-sm font-bold text-gray-800">{project.clientName}</p>
              </div>
              <div className="h-10 w-px bg-gray-200 hidden sm:block" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Project ID</p>
                <p className="text-sm font-bold text-gray-800">{project.projectId}</p>
              </div>
              {project.walkwayVariation && (
                <>
                  <div className="h-10 w-px bg-gray-200 hidden sm:block" />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Variation</p>
                    <p className="text-sm font-bold text-gray-800">{project.walkwayVariation}</p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Main ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        {/* Edit mode banner */}
        {editMode && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-5 py-3 text-sm text-yellow-800 flex items-center gap-3">
            <svg className="w-4 h-4 shrink-0 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Edit mode:</strong> Base Qty, Spare, and Rate fields are editable. Overridden cells are highlighted yellow.
              Total Qty, Total Weight, and Cost recalculate automatically. Click <strong>Done Editing</strong> — you will be asked to provide a reason for each change before it is saved.
              {pendingCount > 0 && <span className="ml-2 font-bold text-yellow-700">{pendingCount} unsaved change{pendingCount !== 1 ? 's' : ''}.</span>}
            </span>
          </div>
        )}

        {/* Settings panel */}
        {bomActive && (
          <SettingsPanel settings={settings} onChange={handleSettingsChange} editMode={editMode} />
        )}

        {/* BOM tables */}
        {displayBom && (
          <>
            {displayBom.horizontal && (
              <BOMSectionTable
                title="Section A — Horizontal Walkway"
                items={displayBom.horizontal}
                accentColor="blue"
                editMode={editMode}
                sectionKey="horizontal"
                sectionOverrides={overrides.horizontal}
                onItemChange={handleItemChange}
                onRowReset={handleRowReset}
                canEditWtPc={can('canUpdateMasterItem')}
              />
            )}

            {displayBom.vertical && (
              <BOMSectionTable
                title="Section B — Vertical Walkway"
                items={displayBom.vertical}
                accentColor="orange"
                editMode={editMode}
                sectionKey="vertical"
                sectionOverrides={overrides.vertical}
                onItemChange={handleItemChange}
                onRowReset={handleRowReset}
                canEditWtPc={can('canUpdateMasterItem')}
              />
            )}

            {/* Grand totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard label="Total Project Cost" value={`₹${displayBom.summary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="yellow" />
              <SummaryCard label="Total Walkway Length" value={`${displayBom.summary.totalLength.toFixed(1)} m`} color="blue" />
              <SummaryCard label="Cost per Running Metre" value={`₹${displayBom.summary.costPerRM.toFixed(2)} / RM`} color="green" />
            </div>

            {/* Change log */}
            <ChangeLogSection changeLog={changeLog} />

            {/* Note */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Recommended support spacing: <strong>1000 mm</strong> (centre to centre). Seam Clamps and Grub Screws are customer-supplied and not included in this BOM.</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }) {
  const colors = {
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    blue:   'bg-blue-50  border-blue-200  text-blue-800',
    green:  'bg-green-50 border-green-200 text-green-800',
  };
  return (
    <div className={`rounded-2xl border-2 px-6 py-5 ${colors[color]}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-sm font-semibold mt-1 opacity-70">{label}</p>
    </div>
  );
}
