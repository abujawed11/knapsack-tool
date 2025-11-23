// src/components/GlobalInputs.jsx
import { TextField } from './ui';
import { parseNumList } from '../lib/storage';

export default function GlobalInputs({ settings, setSettings }) {
  const {
    moduleWidth,
    midClamp,
    endClampWidth,
    buffer,
    lengthsInput,
    enabledLengths,
    userMode
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Module Width (mm)</label>
          <input
            type="number"
            value={moduleWidth}
            onChange={e => updateSetting('moduleWidth', e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-center font-medium"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Mid Clamp (mm)</label>
          <input
            type="number"
            value={midClamp}
            onChange={e => updateSetting('midClamp', e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-center font-medium"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">End Clamp (mm)</label>
          <input
            type="number"
            value={endClampWidth}
            onChange={e => updateSetting('endClampWidth', e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-center font-medium"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Buffer (mm)</label>
          <input
            type="number"
            value={buffer}
            onChange={e => updateSetting('buffer', e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-center font-medium"
          />
        </div>
      </div>

      {/* Length Selection */}
      <div>
        <div className="flex justify-between items-center mb-2">
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
