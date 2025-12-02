// src/components/GlobalInputs.jsx
import { TextField } from './ui';
import { parseNumList } from '../lib/storage';

export default function GlobalInputs({ settings, setSettings }) {
  const {
    moduleWidth,
    midClamp,
    endClampWidth,
    buffer,
    purlinDistance,
    railsPerSide,
    lengthsInput,
    enabledLengths,
    userMode,
    priority
  } = settings;

  const allLengths = parseNumList(lengthsInput);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleLength = (len) => {
    setSettings(prev => ({
      ...prev,
      enabledLengths: {
        ...prev.enabledLengths,
        [len]: !prev.enabledLengths[len]
      }
    }));
  };

  const enableAll = () => {
    const newEnabled = {};
    allLengths.forEach(len => newEnabled[len] = true);
    updateSetting('enabledLengths', newEnabled);
  };

  const disableAll = () => {
    const newEnabled = {};
    allLengths.forEach(len => newEnabled[len] = false);
    updateSetting('enabledLengths', newEnabled);
  };

  const enabledCount = allLengths.filter(len => enabledLengths[len] !== false).length;

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">Global Parameters</h2>

      {/* Primary Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Module Width (mm)</label>
          <input
            type="number"
            value={moduleWidth}
            onChange={e => updateSetting('moduleWidth', e.target.value)}
            // className="w-full rounded-lg border px-3 py-2 text-center font-medium"
            className="w-40 rounded-lg border px-2 py-1.5 text-center font-medium"

          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Mid Clamp Gap (mm)</label>
          <input
            type="number"
            value={midClamp}
            onChange={e => updateSetting('midClamp', e.target.value)}
            // className="w-full rounded-lg border px-3 py-2 text-center font-medium"
            className="w-40 rounded-lg border px-2 py-1.5 text-center font-medium"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">End Clamp after Module (mm)</label>
          <input
            type="number"
            value={endClampWidth}
            onChange={e => updateSetting('endClampWidth', e.target.value)}
            // className="w-full rounded-lg border px-3 py-2 text-center font-medium"
            className="w-40 rounded-lg border px-2 py-1.5 text-center font-medium"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Buffer after End Clamp (mm)</label>
          <input
            type="number"
            value={buffer}
            onChange={e => updateSetting('buffer', e.target.value)}
            // className="w-full rounded-lg border px-3 py-2 text-center font-medium"
            className="w-40 rounded-lg border px-2 py-1.5 text-center font-medium"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Purlin to Purlin Distance (mm)</label>
          <input
            type="number"
            value={purlinDistance}
            onChange={e => updateSetting('purlinDistance', e.target.value)}
            // className="w-full rounded-lg border px-3 py-2 text-center font-medium"
            className="w-40 rounded-lg border px-2 py-1.5 text-center font-medium"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">No. of Rails per each side of Module</label>
          <input
            type="number"
            value={railsPerSide}
            onChange={e => updateSetting('railsPerSide', e.target.value)}
            min="1"
            // className="w-full rounded-lg border px-3 py-2 text-center font-medium"
            className="w-40 rounded-lg border px-2 py-1.5 text-center font-medium"
          />
          {Number(railsPerSide) === 1 && (
            <p className="text-[11px] text-amber-600 mt-1">⚠ Min no. of Rails for each side is Typically 2</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Priority</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={priority === 'cost'}
                onChange={() => updateSetting('priority', 'cost')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm">Cost</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={priority === 'length'}
                onChange={() => updateSetting('priority', 'length')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm">Length</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={priority === 'joints'}
                onChange={() => updateSetting('priority', 'joints')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm">Joints</span>
            </label>
          </div>
        </div>
      </div>

      {/* Length Selection */}
      <div>
        <div className="flex items-center mb-2 gap-4">
          <span className="text-sm text-gray-600">
            Available Cut Lengths ({enabledCount}/{allLengths.length} selected)
          </span>
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
              <span className="text-sm font-medium">{len}</span>
            </label>
          ))}
        </div>
        {enabledCount === 0 && (
          <p className="text-xs text-red-500 mt-2">Please select at least one length</p>
        )}
      </div>

      {/* Advanced: Edit lengths */}
      {userMode === 'advanced' && (
        <div className="mt-4 pt-4 border-t">
          <TextField
            label="Edit Cut Lengths (comma-separated)"
            value={lengthsInput}
            setValue={(v) => updateSetting('lengthsInput', v)}
          />
        </div>
      )}
    </div>
  );
}
