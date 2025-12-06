// src/components/GlobalInputs.jsx
import { TextField } from './ui';
import { parseNumList } from '../lib/storage';

export default function GlobalInputs({ settings, setSettings }) {
  const {
    moduleLength,
    moduleWidth,
    frameThickness,
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

      {/* 2x2 Grid Layout */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Top Left - Module Parameters */}
        <div className="border-2 border-blue-200 rounded-xl p-3 bg-blue-50/30">
          <h3 className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Module Parameters</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Module Length (mm)</label>
              <input
                type="number"
                value={moduleLength}
                onChange={e => updateSetting('moduleLength', e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm text-center font-medium"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Module Width (mm)</label>
              <input
                type="number"
                value={moduleWidth}
                onChange={e => updateSetting('moduleWidth', e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm text-center font-medium"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Frame Thickness (mm)</label>
              <input
                type="number"
                value={frameThickness}
                onChange={e => updateSetting('frameThickness', e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm text-center font-medium"
              />
            </div>
            <div>
              {/* Empty box */}
            </div>
          </div>
        </div>

        {/* Top Right - MMS Parameters */}
        <div className="border-2 border-purple-200 rounded-xl p-3 bg-purple-50/30">
          <h3 className="text-xs font-bold text-purple-700 mb-2 uppercase tracking-wide">MMS Parameters</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">End Clamp after Module (mm)</label>
              <input
                type="number"
                value={endClampWidth}
                onChange={e => updateSetting('endClampWidth', e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm text-center font-medium"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Mid Clamp Gap (mm)</label>
              <input
                type="number"
                value={midClamp}
                onChange={e => updateSetting('midClamp', e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm text-center font-medium"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Buffer after End Clamp (mm)</label>
              <input
                type="number"
                value={buffer}
                onChange={e => updateSetting('buffer', e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm text-center font-medium"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">No. of Rails per each side</label>
              <input
                type="number"
                value={railsPerSide}
                onChange={e => updateSetting('railsPerSide', e.target.value)}
                min="1"
                className="w-full rounded border px-2 py-1 text-sm text-center font-medium"
              />
              {Number(railsPerSide) === 1 && (
                <p className="text-[10px] text-amber-600 mt-0.5">⚠ Min typically 2</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Left - Site Parameters */}
        <div className="border-2 border-green-200 rounded-xl p-3 bg-green-50/30">
          <h3 className="text-xs font-bold text-green-700 mb-2 uppercase tracking-wide">Site Parameters</h3>
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">Purlin to Purlin Distance (mm)</label>
            <input
              type="number"
              value={purlinDistance}
              onChange={e => updateSetting('purlinDistance', e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm text-center font-medium"
            />
          </div>
        </div>

        {/* Bottom Right - Priority */}
        <div className="border-2 border-orange-200 rounded-xl p-3 bg-orange-50/30">
          <h3 className="text-xs font-bold text-orange-700 mb-2 uppercase tracking-wide">Priority</h3>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={priority === 'cost'}
                onChange={() => updateSetting('priority', 'cost')}
                className="w-3.5 h-3.5 text-orange-600"
              />
              <span className="text-xs font-medium">Cost</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={priority === 'length'}
                onChange={() => updateSetting('priority', 'length')}
                className="w-3.5 h-3.5 text-orange-600"
              />
              <span className="text-xs font-medium">Length</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={priority === 'joints'}
                onChange={() => updateSetting('priority', 'joints')}
                className="w-3.5 h-3.5 text-orange-600"
              />
              <span className="text-xs font-medium">Joints</span>
            </label>
          </div>
        </div>
      </div>

      {/* Length Selection */}
      <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50/30 mt-4">
        <div className="flex items-center mb-3 gap-4">
          <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wide">
            Available Cut Lengths ({enabledCount}/{allLengths.length} selected)
          </h3>
          <div className="flex gap-2">
            <button onClick={enableAll} className="text-xs text-purple-600 hover:text-purple-800 font-medium">All</button>
            <span className="text-gray-300">|</span>
            <button onClick={disableAll} className="text-xs text-purple-600 hover:text-purple-800 font-medium">None</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {allLengths.map(len => (
            <label
              key={len}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                enabledLengths[len] !== false
                  ? 'bg-purple-100 border-purple-400 text-purple-800'
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
