import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_PRINT_SETTINGS = {
  includeQuantity: true,
  includeSpare: true,
  includeCosting: true,
  includeNotes: false,
  includeChangeLog: false,
};

export default function WalkwayBOMPrintPreview() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('walkwayBomPrint');
    if (!raw) { navigate('/walkway-bom'); return; }
    try {
      setData(JSON.parse(raw));
    } catch {
      navigate('/walkway-bom');
    }
  }, [navigate]);

  if (!data) return null;

  const { bom, settings, project, changeLog, printSettings: ps } = data;
  const printSettings = { ...DEFAULT_PRINT_SETTINGS, ...(ps ?? {}) };
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <>
      {/* Print toolbar — hidden when printing */}
      <div className="no-print bg-gray-800 text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <span className="font-semibold text-sm">Print Preview — Walkway BOM</span>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/walkway-bom')}
            className="px-4 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-400 rounded-lg font-bold transition-colors"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="print-page bg-white min-h-screen px-10 py-8 text-gray-900 font-sans text-sm max-w-[1050px] mx-auto">
        {/* ── Document header ── */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">WALKWAY BILL OF MATERIALS</h1>
              <p className="text-xs text-gray-500 mt-0.5">Solar Rooftop Walkway System</p>
            </div>
            <div className="text-right text-xs text-gray-600 space-y-0.5">
              <p>Date: <strong>{date}</strong></p>
              {project && (
                <>
                  <p>Project: <strong>{project.name}</strong></p>
                  <p>Client: <strong>{project.clientName}</strong></p>
                  <p>ID: <strong>{project.projectId}</strong></p>
                </>
              )}
            </div>
          </div>

          {/* Settings summary */}
          {/* {settings && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-700 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
              <span>Spare: <strong>{settings.sparePct}%</strong></span>
              <span>|</span>
              <span>Fasteners: <strong>
                {[settings.includeBlindRivets && 'Blind Rivets (4.8×15mm)', settings.includeSDS && 'SDS Screws'].filter(Boolean).join(' + ')}
              </strong></span>
            </div>
          )} */}
        </div>

        {/* ── Sections ── */}
        {bom.horizontal && (
          <PrintSection title="SECTION A — HORIZONTAL WALKWAY" items={bom.horizontal} printSettings={printSettings} />
        )}

        {bom.vertical && (
          <PrintSection title="SECTION B — VERTICAL WALKWAY" items={bom.vertical} printSettings={printSettings} className={bom.horizontal ? 'mt-8' : ''} />
        )}

        {/* ── Grand totals ── */}
        {printSettings.includeCosting && (
          <div className="mt-8 border-t-2 border-gray-800 pt-4">
            <table className="w-full text-sm">
              <tbody>
                <tr className="font-bold">
                  <td className="py-1.5 pr-4 text-gray-600">Total Project Cost</td>
                  <td className="py-1.5 font-black text-base">
                    ₹{bom.summary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 text-gray-600">Total Walkway Length</td>
                  <td className="py-1 font-semibold">{bom.summary.totalLength.toFixed(1)} m</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 text-gray-600">Cost per Running Metre</td>
                  <td className="py-1 font-semibold">₹{bom.summary.costPerRM.toFixed(2)} / RM</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Notes ── */}
        {printSettings.includeNotes && (
          <div className="mt-8 border-t border-gray-200 pt-4">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Notes</p>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Recommended support spacing: <strong>1000 mm</strong> centre-to-centre.</li>
              <li>Seam Clamps and Grub Screws are customer-supplied and are <strong>not included</strong> in this BOM.</li>
              <li>Each walkway section = 2010 mm length × 310 mm width (Magnelis).</li>
              <li>Spare quantity calculated at <strong>{settings?.sparePct ?? 0.1}%</strong> on all items (rounded up).</li>
            </ul>
          </div>
        )}

        {/* ── Change Log ── */}
        {printSettings.includeChangeLog && changeLog?.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-4">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              Change Log
              <span className="ml-2 text-gray-400 font-normal normal-case">({changeLog.length} {changeLog.length === 1 ? 'entry' : 'entries'})</span>
            </p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-3 py-2 text-left">Timestamp</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-center">Section</th>
                  <th className="px-3 py-2 text-center">Field</th>
                  <th className="px-3 py-2 text-center">Old Value</th>
                  <th className="px-3 py-2 text-center">New Value</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {changeLog.map((entry, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 border border-gray-200 whitespace-nowrap text-gray-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 border border-gray-200 font-medium text-gray-900">{entry.itemDescription}</td>
                    <td className="px-3 py-1.5 border border-gray-200 text-center text-gray-600">
                      {entry.section === 'horizontal' ? 'Sec A' : 'Sec B'}
                    </td>
                    <td className="px-3 py-1.5 border border-gray-200 text-center text-gray-600">{entry.field}</td>
                    <td className="px-3 py-1.5 border border-gray-200 text-center text-red-500 font-medium">{entry.oldValue ?? '—'}</td>
                    <td className="px-3 py-1.5 border border-gray-200 text-center text-green-600 font-bold">{entry.newValue ?? '—'}</td>
                    <td className="px-3 py-1.5 border border-gray-200 text-gray-600 italic">"{entry.reason}"</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { max-width: 100% !important; margin: 0 !important; padding: 12mm 14mm !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}

function PrintSection({ title, items, printSettings, className = '' }) {
  const { includeQuantity, includeSpare, includeCosting } = printSettings;

  const sectionTotal = items.reduce((s, i) => s + (i.cost || 0), 0);
  const sectionWt    = items.reduce((s, i) => s + (i.totalWeight || 0), 0);

  // Separator columns appear between groups when both neighbours are visible
  const showSep1 = includeSpare;                         // between Item Details and Spare
  const showSep2 = includeCosting;                       // between Spare/Item Details and Costing

  // Column counts per group
  const g1Cols = 4 + (includeQuantity ? 1 : 0);         // S.No, Desc, Material, UoM [+ Base Qty]
  const g2Cols = includeSpare ? 2 : 0;                  // Spare, Total Qty
  // g3 = 3 cols: Wt/pc, Total Wt, Cost — but footer label absorbs Wt/pc

  // Footer "Section Total" label colSpan
  const labelColSpan = g1Cols
    + (showSep1 ? 1 : 0)
    + g2Cols
    + (showSep2 ? 1 : 0)
    + (includeCosting ? 1 : 0); // absorbs Wt/pc into label

  const SEP_TH   = <th className="w-2 p-0 bg-gray-400 border-0" />;
  const SEP_TD   = <td className="w-2 p-0 bg-gray-300 border-0" />;
  const SEP_FOOT = <td className="w-2 p-0 bg-gray-600 border-0" />;

  return (
    <div className={className}>
      <h2 className="text-xs font-black uppercase tracking-wider text-gray-800 bg-gray-100 px-3 py-2 rounded mb-2 border border-gray-300">
        {title}
      </h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          {/* Group label row */}
          <tr className="bg-gray-600 text-white text-xs font-bold uppercase tracking-wide">
            <th colSpan={g1Cols} className="px-3 py-1.5 text-left">Item Details</th>
            {showSep1 && SEP_TH}
            {includeSpare && <th colSpan={g2Cols} className="px-3 py-1.5 text-center">Spare</th>}
            {showSep2 && SEP_TH}
            {includeCosting && <th colSpan={3} className="px-3 py-1.5 text-center">Weight &amp; Cost</th>}
          </tr>
          {/* Column header row */}
          <tr className="bg-gray-800 text-white">
            <th className="px-3 py-2 text-left w-8">S.No</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-center">Material</th>
            <th className="px-3 py-2 text-center">UoM</th>
            {includeQuantity && <th className="px-3 py-2 text-center">Base Qty</th>}
            {showSep1 && SEP_TH}
            {includeSpare && <th className="px-3 py-2 text-center">Spare</th>}
            {includeSpare && <th className="px-3 py-2 text-center font-bold">Total Qty</th>}
            {showSep2 && SEP_TH}
            {includeCosting && <th className="px-3 py-2 text-center">Wt/pc (kg)</th>}
            {includeCosting && <th className="px-3 py-2 text-center">Total Wt</th>}
            {includeCosting && <th className="px-3 py-2 text-center">Cost (₹)</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-1.5 text-center text-gray-500 border border-gray-200">{i + 1}</td>
              <td className="px-3 py-1.5 font-medium text-gray-900 border border-gray-200">{item.description}</td>
              <td className="px-3 py-1.5 text-center text-gray-600 border border-gray-200">{item.material}</td>
              <td className="px-3 py-1.5 text-center text-gray-500 border border-gray-200">Nos</td>
              {includeQuantity && (
                <td className="px-3 py-1.5 text-center border border-gray-200">{item.baseQty.toLocaleString()}</td>
              )}
              {showSep1 && SEP_TD}
              {includeSpare && (
                <td className="px-3 py-1.5 text-center text-gray-500 border border-gray-200">{item.spareQty}</td>
              )}
              {includeSpare && (
                <td className="px-3 py-1.5 text-center font-bold border border-gray-200">{item.totalQty.toLocaleString()}</td>
              )}
              {showSep2 && SEP_TD}
              {includeCosting && (
                <td className="px-3 py-1.5 text-center border border-gray-200">
                  {item.wtPc != null ? item.wtPc.toFixed(4) : '—'}
                </td>
              )}
              {includeCosting && (
                <td className="px-3 py-1.5 text-center border border-gray-200">
                  {item.totalWeight != null && item.totalWeight > 0 ? item.totalWeight.toFixed(2) : '—'}
                </td>
              )}
              {includeCosting && (
                <td className="px-3 py-1.5 text-center font-semibold border border-gray-200">
                  {item.cost != null ? item.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-800 text-white font-bold">
            <td colSpan={labelColSpan} className="px-3 py-2 text-right">Section Total</td>
            {showSep2 && SEP_FOOT}
            {includeCosting && (
              <td className="px-3 py-2 text-center">{sectionWt > 0 ? sectionWt.toFixed(2) : '—'}</td>
            )}
            {includeCosting && (
              <td className="px-3 py-2 text-center">
                {sectionTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
