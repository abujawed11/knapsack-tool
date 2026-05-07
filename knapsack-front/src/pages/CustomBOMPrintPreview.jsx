import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/print.css';

const fmt = (v, d = 2) => (typeof v === 'number' ? v.toFixed(d) : '—');
const fmtIN = (v) => {
  if (typeof v !== 'number') return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
};

function BuildingTable({ building, index, printSettings, rates }) {
  const { includeQuantity, includeSpare, includeCosting } = printSettings;
  const items = building.items || [];

  const totalWt   = items.reduce((s, i) => s + (i.wt   || 0), 0);
  const totalCost = items.reduce((s, i) => s + (i.cost || 0), 0);

  // Separator after the Qty section (when Qty is visible and something follows it)
  const sepAfterQty   = includeQuantity && (includeSpare || includeCosting);
  // Separator between Spare and Costing (when both visible)
  const sepAfterSpare = includeSpare && includeCosting;

  const SEP_H = <th className="bg-gray-200 w-3 p-0 border-0" />;
  const SEP_D = <td className="bg-gray-200 w-3 p-0 border-0" />;

  return (
    <div className={index > 0 ? 'mt-8' : ''}>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-base font-bold text-gray-900">{building.name}</h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{items.length} items</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            {/* Row 1 — section group headers (no rowSpan) */}
            <tr className="bg-yellow-400">
              {includeQuantity && (
                <th colSpan={7} className="border border-gray-400 px-2 py-1 text-sm font-bold text-center">
                  {building.name}
                </th>
              )}
              {sepAfterQty && SEP_H}
              {includeSpare && (
                <th colSpan={2} className="border border-gray-400 px-2 py-1 text-sm font-bold text-center">
                  Spare
                </th>
              )}
              {sepAfterSpare && SEP_H}
              {includeCosting && (
                <th colSpan={6} className="border border-gray-400 px-2 py-1 text-sm font-bold text-center">
                  Weight &amp; Cost Calculation
                </th>
              )}
            </tr>

            {/* Row 2 — individual column labels */}
            <tr className="bg-yellow-400">
              {includeQuantity && (
                <>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">S.N</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Sunrack Code</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Item Description</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Material</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Length (mm)</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">UoM</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Qty</th>
                </>
              )}
              {sepAfterQty && SEP_H}
              {includeSpare && (
                <>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Spare<br/>Qty</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Final<br/>Qty</th>
                </>
              )}
              {sepAfterSpare && SEP_H}
              {includeCosting && (
                <>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Wt/RM<br/>(kg/m)</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">RM (m)</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Wt (kg)</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Rate<br/>(₹/kg)</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Rate/Piece<br/>(₹)</th>
                  <th className="border border-gray-400 px-2 py-1 text-xs font-bold text-center">Cost (₹)</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-4 py-6 text-center text-gray-400 border border-gray-300">
                  No items in this building
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const isFastener = item.itemType === 'FASTENER';
                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                return (
                  <tr key={item.id} className={rowBg}>
                    {includeQuantity && (
                      <>
                        <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-600">{item.itemCode || '—'}</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-gray-800">
                          <div className="font-semibold">{item.genericName}</div>
                          {item.itemDescription && item.itemDescription !== item.genericName && (
                            <div className="text-gray-400 mt-0.5">{item.itemDescription}</div>
                          )}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">{item.material || '—'}</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                          {isFastener ? <span className="text-gray-300">—</span> : (item.length || '—')}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-600">{item.uom || '—'}</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center font-medium text-gray-800">{item.quantity ?? '—'}</td>
                      </>
                    )}
                    {sepAfterQty && SEP_D}
                    {includeSpare && (
                      <>
                        <td className="border border-gray-300 px-2 py-1.5 text-center bg-green-50 text-green-800 font-medium">{item.spareQty ?? 0}</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center bg-purple-50 font-bold text-purple-800">{item.finalQty ?? item.quantity}</td>
                      </>
                    )}
                    {sepAfterSpare && SEP_D}
                    {includeCosting && (
                      <>
                        <td className="border border-gray-300 px-2 py-1.5 text-center bg-yellow-50 text-gray-700">
                          {isFastener ? <span className="text-gray-300">—</span> : fmt(item.designWeight, 4)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center bg-yellow-50 text-gray-700">
                          {isFastener ? <span className="text-gray-300">—</span> : fmt(item.rm, 3)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center bg-orange-50 text-gray-700">
                          {isFastener ? <span className="text-gray-300">—</span> : fmt(item.wt, 3)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center bg-orange-50 text-gray-700">
                          {isFastener ? <span className="text-gray-300">—</span> : fmt(item.rate, 2)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center bg-blue-50 text-blue-700 font-medium">
                          {item.costPerPiece ? fmt(item.costPerPiece, 2) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right font-bold bg-green-50 text-gray-800">
                          ₹{fmtIN(item.cost)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}

            {/* Totals row */}
            {items.length > 0 && includeCosting && (
              <tr className="bg-yellow-100 font-bold">
                {includeQuantity && <td colSpan={7} className="border border-gray-400 px-2 py-1.5 text-right text-xs text-gray-700">Building Total →</td>}
                {sepAfterQty && SEP_D}
                {includeSpare && <td colSpan={2} className="border border-gray-400" />}
                {sepAfterSpare && SEP_D}
                <td className="border border-gray-400" />
                <td className="border border-gray-400" />
                <td className="border border-gray-400 px-2 py-1.5 text-center text-xs">{fmt(totalWt, 3)}</td>
                <td className="border border-gray-400" />
                <td className="border border-gray-400" />
                <td className="border border-gray-400 px-2 py-1.5 text-right text-xs">₹{fmtIN(totalCost)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CustomBOMPrintPreview() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('customBomPrint');
    if (!raw) { navigate('/custom-bom/app'); return; }
    try {
      setData(JSON.parse(raw));
    } catch {
      navigate('/custom-bom/app');
    }
  }, [navigate]);

  if (!data) return null;

  const { buildings, printSettings, project, userNotes, rates, sparePercent, moduleWp, printedBy } = data;
  const ps = printSettings || {};
  const { includeQuantity, includeSpare, includeCosting, includeNotes, includeChangeLog } = ps;

  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const grandTotalWt   = buildings.reduce((s, b) => s + (b.items || []).reduce((ss, i) => ss + (i.wt   || 0), 0), 0);
  const grandTotalCost = buildings.reduce((s, b) => s + (b.items || []).reduce((ss, i) => ss + (i.cost || 0), 0), 0);
  const totalItems     = buildings.reduce((s, b) => s + (b.items?.length || 0), 0);

  const orientation = (includeQuantity && includeSpare && includeCosting) ? 'landscape' : 'portrait';

  return (
    <>
      <style>{`
        @page {
          size: A4 ${orientation};
          margin-top: 1cm;
          margin-right: 0.3cm;
          margin-left: 0.3cm;
          margin-bottom: 0.4in;
        }
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0 !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print bg-gray-800 text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <span className="font-semibold text-sm">
          Print Preview — Custom BOM
          {project?.name && <span className="ml-2 text-gray-400 font-normal">· {project.name}</span>}
        </span>
        <div className="flex gap-3 items-center">
          <span className="text-xs text-gray-400 font-normal">
            {orientation.toUpperCase()} · {totalItems} items
          </span>
          <button
            onClick={() => navigate('/custom-bom/app')}
            className="px-4 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg font-bold transition-colors"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="print-content bg-white min-h-screen px-10 py-8 text-gray-900 font-sans max-w-[1200px] mx-auto">

        {/* Document header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">CUSTOM BILL OF MATERIALS</h1>
              <p className="text-xs text-gray-500 mt-0.5">Custom Solar BOM</p>
            </div>
            <div className="text-right text-xs text-gray-600 space-y-0.5">
              <p>Date: <strong>{date}</strong></p>
              {project && (
                <>
                  <p>Project: <strong>{project.name}</strong></p>
                  {project.clientName && <p>Client: <strong>{project.clientName}</strong></p>}
                  {project.projectId && <p>ID: <strong>{project.projectId}</strong>}</p>}
                </>
              )}
              {moduleWp > 0 && <p>Module Wp: <strong>{moduleWp} Wp</strong></p>}
              <p>Spare: <strong>{sparePercent}%</strong></p>
              {printedBy && <p>Printed by: <strong>{printedBy}</strong></p>}
            </div>
          </div>

          {/* Rate summary */}
          {includeCosting && rates && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-700 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
              {rates.al6063Rate > 0 && <span>Al 6063: <strong>₹{rates.al6063Rate}/kg</strong></span>}
              {rates.giRate > 0 && <span>GI: <strong>₹{rates.giRate}/kg</strong></span>}
              {rates.hdgRate > 0 && <span>HDG: <strong>₹{rates.hdgRate}/kg</strong></span>}
              {rates.magnelisRate > 0 && <span>Magnelis: <strong>₹{rates.magnelisRate}/kg</strong></span>}
            </div>
          )}
        </div>

        {/* Building tables */}
        {buildings.map((building, idx) => (
          <BuildingTable
            key={building.id}
            building={building}
            index={idx}
            printSettings={ps}
            rates={rates}
          />
        ))}

        {/* Grand total */}
        {includeCosting && buildings.length > 1 && (
          <div className="mt-8 border-t-2 border-gray-800 pt-4">
            <table className="w-full text-sm">
              <tbody>
                <tr className="font-bold">
                  <td className="py-1.5 pr-4 text-gray-600">Total Project Weight</td>
                  <td className="py-1.5 text-gray-900">{fmt(grandTotalWt, 3)} kg</td>
                </tr>
                <tr className="font-bold text-lg">
                  <td className="py-1.5 pr-4 text-gray-700">Total Project Cost</td>
                  <td className="py-1.5 text-green-800">₹{fmtIN(grandTotalCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Notes / Disclaimer */}
        {includeNotes && (
          <div className="mt-8 border-t border-gray-300 pt-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Notes &amp; Disclaimer</h3>
            {userNotes && userNotes.length > 0 ? (
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-700">
                {userNotes.map((note, i) => (
                  <li key={note.id || i}>{note.text || note}</li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-gray-400 italic">No notes added.</p>
            )}
            <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-500">
              <p className="font-semibold text-gray-700 mb-1">Standard Disclaimer</p>
              <p>This BOM is generated based on the project parameters provided. Quantities and costs are estimates and subject to change based on final engineering review. All rates are indicative and may vary based on market conditions.</p>
            </div>
          </div>
        )}

        {/* Change Log — placeholder since custom BOM doesn't track changes */}
        {includeChangeLog && (
          <div className="mt-8 border-t border-gray-300 pt-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Change Log</h3>
            <p className="text-xs text-gray-400 italic">No change history available for this Custom BOM.</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
          <span>Generated by Sunrack BOM System</span>
          <span>{printedBy ? `Printed by: ${printedBy}` : ''}</span>
          <span>{date}</span>
        </div>
      </div>
    </>
  );
}
