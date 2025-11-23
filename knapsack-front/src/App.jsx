// src/App.jsx
import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import GlobalInputs from './components/GlobalInputs';
import SettingsPanel from './components/SettingsPanel';
import RailTable from './components/RailTable';
import ResultCard from './components/ResultCard';
import { loadSettings, saveSettings, DEFAULT_SETTINGS, DEFAULT_LENGTHS } from './lib/storage';

export default function App() {
  // Load saved settings
  const savedSettings = useMemo(() => loadSettings(), []);

  // Settings state
  const [settings, setSettings] = useState(savedSettings);

  // Table rows state - start empty, user adds rows manually
  const [rows, setRows] = useState([]);

  // Selected row for detail view
  const [selectedRowId, setSelectedRowId] = useState(null);

  // Get selected row
  const selectedRow = rows.find(r => r.id === selectedRowId);

  // Save settings whenever they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Update a single setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header
        userMode={settings.userMode}
        setUserMode={(mode) => updateSetting('userMode', mode)}
      />

      <main className="mx-auto max-w-[80%] px-4 py-6">
        {/* Top: Global Inputs */}
        <div className="mb-6">
          <GlobalInputs settings={settings} setSettings={setSettings} />
        </div>

        {/* Main Content: 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Settings Panel */}
          <aside className="lg:col-span-3">
            <SettingsPanel settings={settings} setSettings={setSettings} />
          </aside>

          {/* Center: Rail Table */}
          <section className="lg:col-span-6">
            <RailTable
              rows={rows}
              setRows={setRows}
              selectedRowId={selectedRowId}
              setSelectedRowId={setSelectedRowId}
              settings={settings}
            />
          </section>

          {/* Right: Result Card */}
          <aside className="lg:col-span-3">
            <ResultCard row={selectedRow} settings={settings} />
          </aside>
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-gray-500">
        Rail Cut Optimizer - Built for solar rail standardization
      </footer>
    </div>
  );
}
