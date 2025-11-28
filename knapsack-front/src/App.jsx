// src/App.jsx
import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import GlobalInputs from './components/GlobalInputs';
import RailTable from './components/RailTable';
import { loadSettings, saveSettings } from './lib/storage';

export default function App() {
  // Load saved settings
  const savedSettings = useMemo(() => loadSettings(), []);

  // Settings state
  const [settings, setSettings] = useState(savedSettings);

  // Table rows state - load from localStorage or start empty
  const [rows, setRows] = useState(() => {
    try {
      const saved = localStorage.getItem('railOptimizer_rows');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Selected row for detail view
  const [selectedRowId, setSelectedRowId] = useState(() => {
    try {
      const saved = localStorage.getItem('railOptimizer_selectedRowId');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Get selected row
  const selectedRow = rows.find(r => r.id === selectedRowId);

  // Save settings whenever they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Save rows whenever they change
  useEffect(() => {
    localStorage.setItem('railOptimizer_rows', JSON.stringify(rows));
  }, [rows]);

  // Save selected row ID whenever it changes
  useEffect(() => {
    localStorage.setItem('railOptimizer_selectedRowId', JSON.stringify(selectedRowId));
  }, [selectedRowId]);

  // Update a single setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header
        userMode={settings.userMode}
        setUserMode={(mode) => updateSetting('userMode', mode)}
        settings={settings}
        setSettings={setSettings}
      />

      <main className="mx-auto max-w-[80%] px-4 py-6">
        {/* Top: Global Inputs */}
        <div className="mb-6">
          <GlobalInputs settings={settings} setSettings={setSettings} />
        </div>

        {/* Main Content */}
        <section>
          <RailTable
            rows={rows}
            setRows={setRows}
            selectedRowId={selectedRowId}
            setSelectedRowId={setSelectedRowId}
            settings={settings}
            setSettings={setSettings}
            selectedRow={selectedRow}
          />
        </section>
      </main>

      <footer className="py-8 text-center text-xs text-gray-500">
        Rail Cut Optimizer - Built for solar rail standardization
      </footer>
    </div>
  );
}
