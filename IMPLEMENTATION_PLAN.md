# Knapsack Tool - Complete Implementation Plan

## Table of Contents
1. [Overview](#overview)
2. [Current Architecture](#current-architecture)
3. [Phase 1: Tab System (localStorage)](#phase-1-tab-system-localstorage)
4. [Phase 2: BOM System (localStorage/IndexedDB)](#phase-2-bom-system-localstorageindexeddb)
5. [Phase 3: Backend + Authentication (MySQL)](#phase-3-backend--authentication-mysql)
6. [Migration Strategy](#migration-strategy)

---

## Overview

### Implementation Timeline
- **NOW:** Tab system with localStorage
- **NEXT:** BOM (Bill of Materials) with localStorage/IndexedDB
- **LATER:** Backend API + User Authentication + MySQL migration

### Technology Stack
- **Frontend:** React + Tailwind CSS
- **Phase 1-2 Storage:** localStorage / IndexedDB
- **Phase 3 Backend:** Node.js + Express
- **Phase 3 Database:** MySQL / PostgreSQL
- **Phase 3 Auth:** JWT (JSON Web Tokens)

---

## Current Architecture

### Current Data Storage (localStorage)
```javascript
// Key: 'railOptimizerSettings'
{
  userMode: 'normal',
  moduleLength: 2278,
  moduleWidth: 1134,
  frameThickness: 35,
  midClamp: 20,
  endClampWidth: 40,
  buffer: 15,
  purlinDistance: 1700,
  railsPerSide: 2,
  lengthsInput: "1595, 1798, 2400, ...",
  enabledLengths: {...},
  priority: 'cost',
  // ... other settings
}

// Key: 'railOptimizer_rows'
[
  { id: 1, modules: 10, quantity: 5, supportBase1: 3, supportBase2: 0 },
  { id: 2, modules: 12, quantity: 3, ... },
  ...
]

// Key: 'railOptimizer_selectedRowId'
10
```

### Current File Structure
```
knapsack-front/
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── GlobalInputs.jsx
│   │   ├── RailTable.jsx
│   │   └── ResultCard.jsx
│   ├── lib/
│   │   ├── storage.js      ← Current storage logic
│   │   └── optimizer.js
│   └── App.jsx
```

---

## Phase 1: Tab System (localStorage)

### Goals
- Multi-project support via tabs
- Each tab has independent Global Parameters + Rail Table
- Tab creation, deletion, switching
- Persist all tabs in localStorage

---

### 1.1 Data Structure

#### New localStorage Schema
```javascript
// Key: 'knapsack_tabs'
{
  tabs: [
    {
      id: 1,                    // Unique tab ID
      name: "Project 1",        // User-defined name
      createdAt: "2025-12-07",
      settings: {               // Global Parameters
        moduleLength: 2278,
        moduleWidth: 1134,
        frameThickness: 35,
        midClamp: 20,
        // ... all settings
      },
      rows: [                   // Rail Table rows
        { id: 1, modules: 10, quantity: 5, ... },
        ...
      ],
      selectedRowId: 1
    },
    {
      id: 2,
      name: "Analysis",
      createdAt: "2025-12-08",
      settings: {...},
      rows: [...],
      selectedRowId: null
    }
  ],
  activeTabId: 1               // Currently active tab
}
```

---

### 1.2 UI Components to Create

#### A. TabBar Component (`src/components/TabBar.jsx`)

**Location:** Between Header and GlobalInputs

**UI Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [Project 1 ×] [Analysis ×] [Site A ×]         [+]      │
│  ↑ active      ↑ inactive                     ↑ add    │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Display all tabs horizontally
- Active tab: Purple background, bold text
- Inactive tabs: Gray background, normal text
- Each tab has close button (×) on right side
- Plus button (+) at the end to add new tab
- Click tab to switch
- Click × to close (with confirmation)
- Click + to create new tab (opens dialog)

**Props:**
```javascript
<TabBar
  tabs={tabs}
  activeTabId={activeTabId}
  onTabSwitch={handleTabSwitch}
  onTabCreate={handleTabCreate}
  onTabClose={handleTabClose}
/>
```

**Styling:**
```css
Active tab:
- bg-purple-600
- text-white
- font-bold
- border-b-4 border-purple-800

Inactive tab:
- bg-gray-200
- text-gray-700
- hover:bg-gray-300

Close button (×):
- text-gray-500
- hover:text-red-600
- ml-2

Plus button (+):
- bg-purple-500
- text-white
- rounded-full
- hover:bg-purple-700
```

---

#### B. CreateTabDialog Component (`src/components/CreateTabDialog.jsx`)

**UI:**
```
┌──────────────────────────────────┐
│  Create New Tab                  │
├──────────────────────────────────┤
│  Enter tab name:                 │
│  ┌────────────────────────────┐  │
│  │ [User types here...]       │  │
│  └────────────────────────────┘  │
│                                  │
│      [Cancel]  [Create]          │
│                 ↑ disabled until │
│                   name entered   │
└──────────────────────────────────┘
```

**Features:**
- Modal/Dialog overlay
- Input field for tab name
- "Create" button disabled until text entered
- Press Enter to create (if name valid)
- Press Escape to cancel
- Validation: Tab name must be non-empty and unique

**Props:**
```javascript
<CreateTabDialog
  isOpen={showCreateDialog}
  onClose={() => setShowCreateDialog(false)}
  onCreate={(tabName) => handleCreateTab(tabName)}
  existingTabNames={tabs.map(t => t.name)}
/>
```

**State Management:**
```javascript
const [tabName, setTabName] = useState('');
const isValid = tabName.trim().length > 0 && !existingTabNames.includes(tabName.trim());
```

---

#### C. CloseTabConfirmDialog Component (`src/components/CloseTabConfirmDialog.jsx`)

**UI:**
```
┌──────────────────────────────────┐
│  Close Tab?                      │
├──────────────────────────────────┤
│  Are you sure you want to        │
│  close "{tabName}"?              │
│                                  │
│  All data will be lost.          │
│                                  │
│      [Cancel]  [Close Tab]       │
└──────────────────────────────────┘
```

**Features:**
- Modal/Dialog overlay
- Shows tab name being closed
- Warning about data loss
- "Close Tab" button in red color
- Press Escape to cancel

**Props:**
```javascript
<CloseTabConfirmDialog
  isOpen={showCloseConfirm}
  tabName={tabToClose?.name}
  onClose={() => setShowCloseConfirm(false)}
  onConfirm={() => confirmCloseTab()}
/>
```

---

### 1.3 Storage Helper Functions (`src/lib/tabStorage.js`)

Create new file: `src/lib/tabStorage.js`

```javascript
// src/lib/tabStorage.js

const TABS_STORAGE_KEY = 'knapsack_tabs';

// Initialize default tab structure
export const DEFAULT_TAB = {
  settings: {
    moduleLength: 2278,
    moduleWidth: 1134,
    frameThickness: 35,
    midClamp: 20,
    endClampWidth: 40,
    buffer: 15,
    purlinDistance: 1700,
    railsPerSide: 2,
    lengthsInput: '1595, 1798, 2400, 2750, 3200, 3600, 4800',
    enabledLengths: {},
    maxPieces: 3,
    maxWastePct: '',
    alphaJoint: 220,
    betaSmall: 60,
    allowUndershootPct: 0,
    gammaShort: 5,
    costPerMm: '0.1',
    costPerJointSet: '50',
    joinerLength: '100',
    priority: 'cost',
    userMode: 'normal'
  },
  rows: [],
  selectedRowId: null
};

// Load all tabs from localStorage
export function loadTabs() {
  try {
    const saved = localStorage.getItem(TABS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load tabs:', e);
  }

  // Return default structure with one tab
  return {
    tabs: [
      {
        id: 1,
        name: 'Project 1',
        createdAt: new Date().toISOString(),
        ...DEFAULT_TAB
      }
    ],
    activeTabId: 1
  };
}

// Save all tabs to localStorage
export function saveTabs(tabsData) {
  try {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabsData));
  } catch (e) {
    console.error('Failed to save tabs:', e);
  }
}

// Create new tab
export function createTab(tabsData, tabName) {
  const newId = Math.max(...tabsData.tabs.map(t => t.id), 0) + 1;
  const newTab = {
    id: newId,
    name: tabName,
    createdAt: new Date().toISOString(),
    ...DEFAULT_TAB
  };

  return {
    ...tabsData,
    tabs: [...tabsData.tabs, newTab],
    activeTabId: newId
  };
}

// Delete tab
export function deleteTab(tabsData, tabId) {
  const newTabs = tabsData.tabs.filter(t => t.id !== tabId);

  // If deleted tab was active, switch to first available tab
  let newActiveId = tabsData.activeTabId;
  if (tabId === tabsData.activeTabId && newTabs.length > 0) {
    newActiveId = newTabs[0].id;
  }

  return {
    ...tabsData,
    tabs: newTabs,
    activeTabId: newActiveId
  };
}

// Update tab data
export function updateTab(tabsData, tabId, updates) {
  return {
    ...tabsData,
    tabs: tabsData.tabs.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    )
  };
}

// Switch active tab
export function switchTab(tabsData, tabId) {
  return {
    ...tabsData,
    activeTabId: tabId
  };
}

// Get active tab
export function getActiveTab(tabsData) {
  return tabsData.tabs.find(t => t.id === tabsData.activeTabId);
}
```

---

### 1.4 Refactor App.jsx

**Current App.jsx changes:**

```javascript
// src/App.jsx
import { useState, useEffect } from 'react';
import Header from './components/Header';
import TabBar from './components/TabBar';
import GlobalInputs from './components/GlobalInputs';
import RailTable from './components/RailTable';
import CreateTabDialog from './components/CreateTabDialog';
import CloseTabConfirmDialog from './components/CloseTabConfirmDialog';
import {
  loadTabs,
  saveTabs,
  createTab,
  deleteTab,
  updateTab,
  switchTab,
  getActiveTab
} from './lib/tabStorage';

export default function App() {
  // Load tabs data
  const [tabsData, setTabsData] = useState(() => loadTabs());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [tabToClose, setTabToClose] = useState(null);

  // Get active tab
  const activeTab = getActiveTab(tabsData);

  // Save tabs whenever they change
  useEffect(() => {
    saveTabs(tabsData);
  }, [tabsData]);

  // Tab operations
  const handleTabSwitch = (tabId) => {
    setTabsData(switchTab(tabsData, tabId));
  };

  const handleTabCreate = (tabName) => {
    setTabsData(createTab(tabsData, tabName));
    setShowCreateDialog(false);
  };

  const handleTabCloseRequest = (tab) => {
    // Don't allow closing if only 1 tab
    if (tabsData.tabs.length === 1) {
      alert('Cannot close the last tab!');
      return;
    }
    setTabToClose(tab);
    setShowCloseConfirm(true);
  };

  const confirmCloseTab = () => {
    setTabsData(deleteTab(tabsData, tabToClose.id));
    setShowCloseConfirm(false);
    setTabToClose(null);
  };

  // Update active tab's settings
  const updateSettings = (newSettings) => {
    setTabsData(updateTab(tabsData, activeTab.id, {
      settings: { ...activeTab.settings, ...newSettings }
    }));
  };

  // Update active tab's rows
  const updateRows = (newRows) => {
    setTabsData(updateTab(tabsData, activeTab.id, { rows: newRows }));
  };

  // Update active tab's selected row
  const updateSelectedRowId = (rowId) => {
    setTabsData(updateTab(tabsData, activeTab.id, { selectedRowId: rowId }));
  };

  const selectedRow = activeTab?.rows.find(r => r.id === activeTab.selectedRowId);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header
        userMode={activeTab?.settings.userMode}
        setUserMode={(mode) => updateSettings({ userMode: mode })}
        settings={activeTab?.settings}
        setSettings={updateSettings}
      />

      {/* Tab Bar */}
      <TabBar
        tabs={tabsData.tabs}
        activeTabId={tabsData.activeTabId}
        onTabSwitch={handleTabSwitch}
        onTabCreate={() => setShowCreateDialog(true)}
        onTabClose={handleTabCloseRequest}
      />

      <main className="mx-auto max-w-[80%] px-4 py-6">
        {/* Global Inputs for active tab */}
        <div className="mb-6">
          <GlobalInputs
            settings={activeTab?.settings}
            setSettings={updateSettings}
          />
        </div>

        {/* Rail Table for active tab */}
        <section>
          <RailTable
            rows={activeTab?.rows || []}
            setRows={updateRows}
            selectedRowId={activeTab?.selectedRowId}
            setSelectedRowId={updateSelectedRowId}
            settings={activeTab?.settings}
            setSettings={updateSettings}
            selectedRow={selectedRow}
          />
        </section>
      </main>

      {/* Dialogs */}
      <CreateTabDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleTabCreate}
        existingTabNames={tabsData.tabs.map(t => t.name)}
      />

      <CloseTabConfirmDialog
        isOpen={showCloseConfirm}
        tabName={tabToClose?.name}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={confirmCloseTab}
      />

      <footer className="py-8 text-center text-xs text-gray-500">
        Rail Cut Optimizer - Built for solar rail standardization
      </footer>
    </div>
  );
}
```

---

### 1.5 Migration from Current Storage

**Step to migrate existing data:**

When user first loads the app after tab implementation:

```javascript
// In loadTabs() function, add migration logic:
export function loadTabs() {
  try {
    const saved = localStorage.getItem(TABS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }

    // MIGRATION: Check for old storage format
    const oldSettings = localStorage.getItem('railOptimizerSettings');
    const oldRows = localStorage.getItem('railOptimizer_rows');
    const oldSelectedRowId = localStorage.getItem('railOptimizer_selectedRowId');

    if (oldSettings || oldRows) {
      // Migrate old data to tab format
      const migratedTab = {
        id: 1,
        name: 'Project 1',
        createdAt: new Date().toISOString(),
        settings: oldSettings ? JSON.parse(oldSettings) : DEFAULT_TAB.settings,
        rows: oldRows ? JSON.parse(oldRows) : [],
        selectedRowId: oldSelectedRowId ? JSON.parse(oldSelectedRowId) : null
      };

      // Clean up old storage
      localStorage.removeItem('railOptimizerSettings');
      localStorage.removeItem('railOptimizer_rows');
      localStorage.removeItem('railOptimizer_selectedRowId');

      return {
        tabs: [migratedTab],
        activeTabId: 1
      };
    }
  } catch (e) {
    console.error('Failed to load tabs:', e);
  }

  // Return default
  return {
    tabs: [
      {
        id: 1,
        name: 'Project 1',
        createdAt: new Date().toISOString(),
        ...DEFAULT_TAB
      }
    ],
    activeTabId: 1
  };
}
```

---

### 1.6 Implementation Checklist

- [ ] Create `src/lib/tabStorage.js` with helper functions
- [ ] Create `src/components/TabBar.jsx`
- [ ] Create `src/components/CreateTabDialog.jsx`
- [ ] Create `src/components/CloseTabConfirmDialog.jsx`
- [ ] Refactor `src/App.jsx` to use tab system
- [ ] Add migration logic for existing localStorage data
- [ ] Test tab creation
- [ ] Test tab switching
- [ ] Test tab deletion (with confirmation)
- [ ] Test data persistence across browser refresh
- [ ] Test minimum 1 tab constraint
- [ ] Test unique tab name validation

---

## Phase 2: BOM System (localStorage/IndexedDB)

### Goals
- Bill of Materials (BOM) generation from rail calculations
- Store large constant data (profiles, weights, materials)
- Profile database with codes and specifications
- Export BOM to Excel/CSV

---

### 2.1 Data Structure

#### BOM Profile Constants (IndexedDB)

**Why IndexedDB?**
- Large datasets (100s-1000s of profiles)
- Better performance than localStorage
- Structured queries

**Database Schema:**

```javascript
Database: "KnapsackBOM_DB"
Version: 1

Store 1: "profiles"
{
  id: 1,
  profileCode: "MMS-RAIL-40X40",
  description: "MMS Rail 40x40mm",
  weight: 1.85,              // kg/meter
  material: "Aluminum",
  category: "Rails",
  unitPrice: 150,            // per meter
  supplier: "ABC Metals",
  specifications: {
    length: 6000,            // mm
    width: 40,
    height: 40,
    thickness: 2
  }
}

Store 2: "clamps"
{
  id: 1,
  clampCode: "END-CLAMP-40",
  description: "End Clamp 40mm",
  weight: 0.15,              // kg/piece
  material: "Aluminum",
  category: "Clamps",
  unitPrice: 25,             // per piece
  compatibleProfiles: ["MMS-RAIL-40X40"]
}

Store 3: "hardwareItems"
{
  id: 1,
  itemCode: "BOLT-M8-50",
  description: "M8x50 Bolt",
  weight: 0.025,
  category: "Hardware",
  unitPrice: 5,
  unit: "piece"
}
```

#### BOM Output Data (Per Tab)

**Store in tab data (localStorage):**

```javascript
// In each tab:
{
  id: 1,
  name: "Project 1",
  settings: {...},
  rows: [...],
  selectedRowId: 1,
  bom: {                     // NEW: BOM data
    generated: true,
    generatedAt: "2025-12-10T10:30:00",
    items: [
      {
        category: "Rails",
        itemCode: "MMS-RAIL-40X40",
        description: "MMS Rail 40x40mm",
        quantity: 45,        // Total from calculations
        unit: "meters",
        unitWeight: 1.85,
        totalWeight: 83.25,
        unitPrice: 150,
        totalPrice: 6750
      },
      {
        category: "Clamps",
        itemCode: "END-CLAMP-40",
        description: "End Clamp 40mm",
        quantity: 90,
        unit: "pieces",
        unitWeight: 0.15,
        totalWeight: 13.5,
        unitPrice: 25,
        totalPrice: 2250
      },
      // ... more items
    ],
    summary: {
      totalWeight: 250.5,    // kg
      totalCost: 45000,      // currency
      itemCount: 150
    }
  }
}
```

---

### 2.2 UI Components to Create

#### A. BOM Tab in RailTable

**Add a new section below "Overall Summary Card":**

```
┌────────────────────────────────────────────────┐
│ [Generate BOM] button                          │
└────────────────────────────────────────────────┘

After generation:

┌────────────────────────────────────────────────┐
│ BOM Summary                                    │
│ Generated: 2025-12-10 10:30 AM                 │
│                                                │
│ ┌──────────────────────────────────────────┐  │
│ │ Category  │ Item   │ Qty │ Weight │ Cost │  │
│ ├──────────────────────────────────────────┤  │
│ │ Rails     │ MMS... │ 45m │ 83.2kg │ 6750 │  │
│ │ Clamps    │ End... │ 90  │ 13.5kg │ 2250 │  │
│ │ ...                                       │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ Total: 250.5 kg, ₹45,000                      │
│                                                │
│ [Export to Excel] [Export to CSV] [Regenerate]│
└────────────────────────────────────────────────┘
```

#### B. Profile Management Page

**New route/page: `/profiles` or modal**

Features:
- View all profiles
- Add/Edit/Delete profiles
- Import from CSV/Excel
- Search & filter

---

### 2.3 IndexedDB Helper Functions (`src/lib/bomDB.js`)

```javascript
// src/lib/bomDB.js

const DB_NAME = 'KnapsackBOM_DB';
const DB_VERSION = 1;

// Initialize IndexedDB
export function initBOMDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create stores if they don't exist
      if (!db.objectStoreNames.contains('profiles')) {
        const profileStore = db.createObjectStore('profiles', {
          keyPath: 'id',
          autoIncrement: true
        });
        profileStore.createIndex('profileCode', 'profileCode', { unique: true });
        profileStore.createIndex('category', 'category', { unique: false });
      }

      if (!db.objectStoreNames.contains('clamps')) {
        const clampStore = db.createObjectStore('clamps', {
          keyPath: 'id',
          autoIncrement: true
        });
        clampStore.createIndex('clampCode', 'clampCode', { unique: true });
      }

      if (!db.objectStoreNames.contains('hardwareItems')) {
        const hardwareStore = db.createObjectStore('hardwareItems', {
          keyPath: 'id',
          autoIncrement: true
        });
        hardwareStore.createIndex('itemCode', 'itemCode', { unique: true });
      }
    };
  });
}

// Add profile
export async function addProfile(profileData) {
  const db = await initBOMDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['profiles'], 'readwrite');
    const store = transaction.objectStore('profiles');
    const request = store.add(profileData);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all profiles
export async function getAllProfiles() {
  const db = await initBOMDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['profiles'], 'readonly');
    const store = transaction.objectStore('profiles');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get profile by code
export async function getProfileByCode(code) {
  const db = await initBOMDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['profiles'], 'readonly');
    const store = transaction.objectStore('profiles');
    const index = store.index('profileCode');
    const request = index.get(code);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Similar functions for clamps and hardware...
```

---

### 2.4 BOM Generation Logic (`src/lib/bomGenerator.js`)

```javascript
// src/lib/bomGenerator.js

import { getAllProfiles, getClampByCode, getHardwareByCode } from './bomDB';

export async function generateBOM(tabData) {
  const { settings, rows } = tabData;
  const bomItems = [];

  // Get profile data from IndexedDB
  const profiles = await getAllProfiles();
  const railProfile = profiles.find(p => p.category === 'Rails');

  if (!railProfile) {
    throw new Error('Rail profile not found in database');
  }

  // Calculate totals from rows
  let totalRailLength = 0;
  let totalEndClamps = 0;
  let totalMidClamps = 0;

  rows.forEach(row => {
    const qty = row.quantity || 1;
    // Add calculations based on your optimizer logic
    totalRailLength += /* calculated rail length */ * qty;
    totalEndClamps += 2 * qty;
    totalMidClamps += (row.modules - 1) * qty;
  });

  // Multiply by railsPerSide
  const rps = Number(settings.railsPerSide) || 1;
  totalRailLength *= rps;
  totalEndClamps *= rps;
  totalMidClamps *= rps;

  // Add rail item to BOM
  bomItems.push({
    category: 'Rails',
    itemCode: railProfile.profileCode,
    description: railProfile.description,
    quantity: (totalRailLength / 1000).toFixed(2), // Convert mm to meters
    unit: 'meters',
    unitWeight: railProfile.weight,
    totalWeight: (totalRailLength / 1000 * railProfile.weight).toFixed(2),
    unitPrice: railProfile.unitPrice,
    totalPrice: (totalRailLength / 1000 * railProfile.unitPrice).toFixed(2)
  });

  // Add clamps...
  // Add hardware...

  // Calculate summary
  const summary = {
    totalWeight: bomItems.reduce((sum, item) => sum + parseFloat(item.totalWeight), 0),
    totalCost: bomItems.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0),
    itemCount: bomItems.reduce((sum, item) => sum + parseFloat(item.quantity), 0)
  };

  return {
    generated: true,
    generatedAt: new Date().toISOString(),
    items: bomItems,
    summary
  };
}
```

---

### 2.5 Excel Export (`src/lib/excelExport.js`)

**Use library: `xlsx` (SheetJS)**

```bash
npm install xlsx
```

```javascript
// src/lib/excelExport.js
import * as XLSX from 'xlsx';

export function exportBOMToExcel(bom, projectName) {
  // Create worksheet data
  const wsData = [
    ['Bill of Materials'],
    ['Project:', projectName],
    ['Generated:', new Date(bom.generatedAt).toLocaleString()],
    [],
    ['Category', 'Item Code', 'Description', 'Quantity', 'Unit', 'Unit Weight (kg)', 'Total Weight (kg)', 'Unit Price', 'Total Price'],
    ...bom.items.map(item => [
      item.category,
      item.itemCode,
      item.description,
      item.quantity,
      item.unit,
      item.unitWeight,
      item.totalWeight,
      item.unitPrice,
      item.totalPrice
    ]),
    [],
    ['Summary'],
    ['Total Weight (kg):', bom.summary.totalWeight],
    ['Total Cost:', bom.summary.totalCost],
    ['Total Items:', bom.summary.itemCount]
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOM');

  // Download
  XLSX.writeFile(wb, `BOM_${projectName}_${Date.now()}.xlsx`);
}

export function exportBOMToCSV(bom, projectName) {
  // Similar to Excel but use writeFile with .csv extension
  // ...
}
```

---

### 2.6 Implementation Checklist

- [ ] Install `xlsx` library
- [ ] Create `src/lib/bomDB.js` with IndexedDB functions
- [ ] Create `src/lib/bomGenerator.js` with BOM calculation logic
- [ ] Create `src/lib/excelExport.js` with export functions
- [ ] Add BOM section to RailTable component
- [ ] Create Profile Management UI (modal or page)
- [ ] Add "Generate BOM" button
- [ ] Add BOM display table
- [ ] Add Export buttons (Excel, CSV)
- [ ] Add sample profile data to IndexedDB
- [ ] Test BOM generation
- [ ] Test Excel export
- [ ] Test CSV export
- [ ] Add BOM to tab data structure
- [ ] Persist BOM with tabs in localStorage

---

## Phase 3: Backend + Authentication (MySQL)

### Goals
- User registration & login
- Multi-device sync
- Cloud storage of all data
- Secure API
- Data migration from localStorage to MySQL

---

### 3.1 Technology Stack

**Backend:**
- Node.js + Express.js
- MySQL (or PostgreSQL)
- JWT for authentication
- bcrypt for password hashing

**API Structure:**
- RESTful API
- JSON responses
- Token-based auth

---

### 3.2 Database Schema (MySQL)

```sql
-- Users table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabs table (projects)
CREATE TABLE tabs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Settings table (global parameters per tab)
CREATE TABLE tab_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tab_id INT NOT NULL UNIQUE,
  module_length DECIMAL(10,2),
  module_width DECIMAL(10,2),
  frame_thickness DECIMAL(10,2),
  mid_clamp DECIMAL(10,2),
  end_clamp_width DECIMAL(10,2),
  buffer DECIMAL(10,2),
  purlin_distance DECIMAL(10,2),
  rails_per_side INT,
  lengths_input TEXT,
  enabled_lengths JSON,
  max_pieces INT,
  max_waste_pct DECIMAL(5,2),
  alpha_joint DECIMAL(10,2),
  beta_small DECIMAL(10,2),
  allow_undershoot_pct DECIMAL(5,2),
  gamma_short DECIMAL(10,2),
  cost_per_mm DECIMAL(10,4),
  cost_per_joint_set DECIMAL(10,2),
  joiner_length DECIMAL(10,2),
  priority VARCHAR(50),
  user_mode VARCHAR(50),
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

-- Rows table (rail table rows per tab)
CREATE TABLE tab_rows (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tab_id INT NOT NULL,
  row_order INT NOT NULL,
  modules INT,
  quantity INT,
  support_base1 INT,
  support_base2 INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

-- BOM Profiles table (shared across all users)
CREATE TABLE bom_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  profile_code VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  weight DECIMAL(10,4),
  material VARCHAR(100),
  category VARCHAR(100),
  unit_price DECIMAL(10,2),
  supplier VARCHAR(255),
  specifications JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BOM Clamps table
CREATE TABLE bom_clamps (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clamp_code VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  weight DECIMAL(10,4),
  material VARCHAR(100),
  category VARCHAR(100),
  unit_price DECIMAL(10,2),
  compatible_profiles JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BOM Hardware table
CREATE TABLE bom_hardware (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_code VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  weight DECIMAL(10,4),
  category VARCHAR(100),
  unit_price DECIMAL(10,2),
  unit VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated BOMs table (per tab)
CREATE TABLE tab_boms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tab_id INT NOT NULL UNIQUE,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  bom_data JSON,  -- Store entire BOM as JSON
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_tabs_user ON tabs(user_id);
CREATE INDEX idx_rows_tab ON tab_rows(tab_id);
CREATE INDEX idx_profiles_category ON bom_profiles(category);
CREATE INDEX idx_clamps_category ON bom_clamps(category);
```

---

### 3.3 Backend API Structure

**Project Structure:**
```
knapsack-backend/
├── src/
│   ├── config/
│   │   └── database.js      # MySQL connection
│   ├── middleware/
│   │   ├── auth.js          # JWT verification
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js          # Login, register
│   │   ├── tabs.js          # Tab CRUD
│   │   ├── settings.js      # Settings CRUD
│   │   ├── rows.js          # Rows CRUD
│   │   ├── bom.js           # BOM operations
│   │   └── profiles.js      # Profile management
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── tabController.js
│   │   ├── settingsController.js
│   │   ├── rowsController.js
│   │   ├── bomController.js
│   │   └── profileController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Tab.js
│   │   ├── Settings.js
│   │   └── ...
│   └── server.js            # Express app
├── package.json
└── .env                     # Environment variables
```

---

### 3.4 API Endpoints

#### Authentication

```
POST   /api/auth/register
Body: { email, password, fullName }
Response: { user, token }

POST   /api/auth/login
Body: { email, password }
Response: { user, token }

GET    /api/auth/me
Header: Authorization: Bearer <token>
Response: { user }
```

#### Tabs

```
GET    /api/tabs
Header: Authorization: Bearer <token>
Response: { tabs: [...] }

POST   /api/tabs
Header: Authorization: Bearer <token>
Body: { name }
Response: { tab }

PUT    /api/tabs/:id
Header: Authorization: Bearer <token>
Body: { name }
Response: { tab }

DELETE /api/tabs/:id
Header: Authorization: Bearer <token>
Response: { success: true }
```

#### Settings

```
GET    /api/tabs/:tabId/settings
PUT    /api/tabs/:tabId/settings
Body: { moduleLength, moduleWidth, ... }
```

#### Rows

```
GET    /api/tabs/:tabId/rows
POST   /api/tabs/:tabId/rows
PUT    /api/tabs/:tabId/rows/:rowId
DELETE /api/tabs/:tabId/rows/:rowId
```

#### BOM

```
GET    /api/tabs/:tabId/bom
POST   /api/tabs/:tabId/bom/generate
GET    /api/profiles
POST   /api/profiles
PUT    /api/profiles/:id
DELETE /api/profiles/:id
```

---

### 3.5 Frontend Migration

**Create API service layer: `src/services/api.js`**

```javascript
// src/services/api.js

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Get token from localStorage
function getToken() {
  return localStorage.getItem('auth_token');
}

// Fetch with auth
async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// Auth API
export const authAPI = {
  register: (data) => authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  login: (data) => authFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getCurrentUser: () => authFetch('/auth/me')
};

// Tabs API
export const tabsAPI = {
  getAll: () => authFetch('/tabs'),
  create: (name) => authFetch('/tabs', {
    method: 'POST',
    body: JSON.stringify({ name })
  }),
  update: (id, data) => authFetch(`/tabs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (id) => authFetch(`/tabs/${id}`, {
    method: 'DELETE'
  })
};

// Settings API
export const settingsAPI = {
  get: (tabId) => authFetch(`/tabs/${tabId}/settings`),
  update: (tabId, settings) => authFetch(`/tabs/${tabId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings)
  })
};

// Rows API
export const rowsAPI = {
  getAll: (tabId) => authFetch(`/tabs/${tabId}/rows`),
  create: (tabId, row) => authFetch(`/tabs/${tabId}/rows`, {
    method: 'POST',
    body: JSON.stringify(row)
  }),
  update: (tabId, rowId, row) => authFetch(`/tabs/${tabId}/rows/${rowId}`, {
    method: 'PUT',
    body: JSON.stringify(row)
  }),
  delete: (tabId, rowId) => authFetch(`/tabs/${tabId}/rows/${rowId}`, {
    method: 'DELETE'
  })
};

// BOM API
export const bomAPI = {
  get: (tabId) => authFetch(`/tabs/${tabId}/bom`),
  generate: (tabId) => authFetch(`/tabs/${tabId}/bom/generate`, {
    method: 'POST'
  })
};

// Profiles API
export const profilesAPI = {
  getAll: () => authFetch('/profiles'),
  create: (profile) => authFetch('/profiles', {
    method: 'POST',
    body: JSON.stringify(profile)
  }),
  update: (id, profile) => authFetch(`/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(profile)
  }),
  delete: (id) => authFetch(`/profiles/${id}`, {
    method: 'DELETE'
  })
};
```

---

### 3.6 Authentication UI Components

#### Login Page (`src/pages/Login.jsx`)

```jsx
import { useState } from 'react';
import { authAPI } from '../services/api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user, token } = await authAPI.login({ email, password });
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm">
          Don't have an account? <a href="/register" className="text-purple-600">Register</a>
        </p>
      </div>
    </div>
  );
}
```

---

### 3.7 Migration Strategy

#### Data Migration Tool

Create a migration page/button that:

1. **Reads localStorage data**
2. **Authenticates user**
3. **Uploads data to backend**
4. **Verifies migration**
5. **Clears localStorage (optional)**

**Migration Component: `src/components/MigrationTool.jsx`**

```javascript
export async function migrateLocalStorageToBackend(token) {
  // Load all tabs from localStorage
  const localTabs = loadTabs();

  // For each tab, upload to backend
  for (const tab of localTabs.tabs) {
    // Create tab
    const newTab = await tabsAPI.create(tab.name);

    // Upload settings
    await settingsAPI.update(newTab.id, tab.settings);

    // Upload rows
    for (const row of tab.rows) {
      await rowsAPI.create(newTab.id, row);
    }

    // Upload BOM if exists
    if (tab.bom) {
      await bomAPI.generate(newTab.id);
    }
  }

  // Clear localStorage after successful migration
  localStorage.removeItem('knapsack_tabs');

  return true;
}
```

---

### 3.8 Refactor App.jsx for Backend

**Update App.jsx to use API instead of localStorage:**

```javascript
// src/App.jsx
import { useState, useEffect } from 'react';
import { tabsAPI, settingsAPI, rowsAPI } from './services/api';
import Login from './pages/Login';
// ... other imports

export default function App() {
  const [user, setUser] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Load tabs from backend
  useEffect(() => {
    if (user) {
      loadTabsFromBackend();
    }
  }, [user]);

  async function loadTabsFromBackend() {
    try {
      const data = await tabsAPI.getAll();
      setTabs(data.tabs);
      if (data.tabs.length > 0) {
        setActiveTabId(data.tabs[0].id);
      }
    } catch (err) {
      console.error('Failed to load tabs:', err);
    }
  }

  // Show login if not authenticated
  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  // ... rest of app (tabs, table, etc.)
  // All state updates now go through API calls instead of localStorage
}
```

---

### 3.9 Backend Implementation Steps

**Step-by-step backend setup:**

1. **Initialize Node.js project**
   ```bash
   mkdir knapsack-backend
   cd knapsack-backend
   npm init -y
   ```

2. **Install dependencies**
   ```bash
   npm install express mysql2 bcryptjs jsonwebtoken dotenv cors
   npm install --save-dev nodemon
   ```

3. **Create `.env` file**
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=knapsack_db
   JWT_SECRET=your_secret_key_here
   PORT=5000
   ```

4. **Create database connection** (`src/config/database.js`)
   ```javascript
   const mysql = require('mysql2/promise');
   require('dotenv').config();

   const pool = mysql.createPool({
     host: process.env.DB_HOST,
     user: process.env.DB_USER,
     password: process.env.DB_PASSWORD,
     database: process.env.DB_NAME,
     waitForConnections: true,
     connectionLimit: 10
   });

   module.exports = pool;
   ```

5. **Create Express server** (`src/server.js`)
   ```javascript
   const express = require('express');
   const cors = require('cors');
   require('dotenv').config();

   const app = express();

   // Middleware
   app.use(cors());
   app.use(express.json());

   // Routes
   app.use('/api/auth', require('./routes/auth'));
   app.use('/api/tabs', require('./routes/tabs'));
   app.use('/api/profiles', require('./routes/profiles'));
   // ... more routes

   // Error handler
   app.use(require('./middleware/errorHandler'));

   const PORT = process.env.PORT || 5000;
   app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

6. **Implement auth middleware** (`src/middleware/auth.js`)
   ```javascript
   const jwt = require('jsonwebtoken');

   module.exports = function(req, res, next) {
     const token = req.header('Authorization')?.replace('Bearer ', '');

     if (!token) {
       return res.status(401).json({ error: 'No token provided' });
     }

     try {
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       req.userId = decoded.userId;
       next();
     } catch (err) {
       res.status(401).json({ error: 'Invalid token' });
     }
   };
   ```

7. **Implement controllers** (authController, tabController, etc.)

8. **Run MySQL schema** (create tables)

9. **Test endpoints** with Postman/Thunder Client

10. **Deploy backend** (Heroku, AWS, DigitalOcean, etc.)

---

### 3.10 Implementation Checklist

**Backend:**
- [ ] Set up Node.js + Express project
- [ ] Configure MySQL database
- [ ] Create database schema (run SQL)
- [ ] Implement authentication (register, login)
- [ ] Implement JWT middleware
- [ ] Create tabs CRUD endpoints
- [ ] Create settings CRUD endpoints
- [ ] Create rows CRUD endpoints
- [ ] Create BOM endpoints
- [ ] Create profiles endpoints
- [ ] Test all endpoints
- [ ] Add error handling
- [ ] Add validation
- [ ] Deploy backend

**Frontend:**
- [ ] Create API service layer
- [ ] Create Login page
- [ ] Create Register page
- [ ] Update App.jsx to use API
- [ ] Remove localStorage dependencies (replace with API calls)
- [ ] Create migration tool for existing users
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test authentication flow
- [ ] Test tab operations with backend
- [ ] Test BOM with backend
- [ ] Update environment variables for production

---

## Migration Strategy

### From Phase 1 to Phase 2
- BOM data structure is added to existing tab data
- No breaking changes to tab structure
- IndexedDB added alongside localStorage

### From Phase 2 to Phase 3
- One-time data migration from localStorage/IndexedDB to MySQL
- Provide migration tool in UI
- User logs in → migration runs → data uploaded
- localStorage can be cleared after successful migration
- BOM profiles from IndexedDB → migrated to MySQL

---

## Testing Strategy

### Phase 1 Testing
- [ ] Create 5+ tabs
- [ ] Switch between tabs rapidly
- [ ] Close tabs (verify confirmation)
- [ ] Refresh browser (verify persistence)
- [ ] Enter data in multiple tabs
- [ ] Verify unique tab names
- [ ] Test minimum 1 tab constraint

### Phase 2 Testing
- [ ] Generate BOM with various configurations
- [ ] Verify calculations are correct
- [ ] Export to Excel (verify format)
- [ ] Export to CSV (verify format)
- [ ] Add/edit profiles in IndexedDB
- [ ] Test with large profile database (1000+ items)
- [ ] Verify BOM persists with tab data

### Phase 3 Testing
- [ ] Register new user
- [ ] Login with credentials
- [ ] Create tabs via API
- [ ] Verify data syncs across devices
- [ ] Test logout/login (data persists)
- [ ] Test with multiple users (isolation)
- [ ] Migration tool (localStorage → MySQL)
- [ ] Test API error handling
- [ ] Test token expiration
- [ ] Load testing (multiple concurrent users)

---

## Notes & Best Practices

### localStorage Best Practices
- Always use try-catch when accessing localStorage
- Stringify/parse JSON carefully
- Check quota exceeded errors
- Provide fallback for private browsing mode

### IndexedDB Best Practices
- Use versioning for schema changes
- Create indexes for frequently queried fields
- Handle database upgrade events
- Close connections after operations

### Backend Best Practices
- Use prepared statements (prevent SQL injection)
- Hash passwords with bcrypt
- Use HTTPS in production
- Implement rate limiting
- Validate all inputs
- Use environment variables for secrets
- Log errors properly
- Use database transactions for related operations

### Security Considerations
- Never store passwords in plain text
- Use secure JWT secret (long, random)
- Set token expiration (e.g., 7 days)
- Validate user permissions for all operations
- Sanitize user inputs
- Use CORS properly
- Implement CSRF protection if needed

---

## Deployment

### Frontend Deployment (Vercel/Netlify)
```bash
# Build production
npm run build

# Deploy to Vercel
vercel --prod

# Or Netlify
netlify deploy --prod
```

### Backend Deployment (Heroku example)
```bash
# Create Heroku app
heroku create knapsack-api

# Set environment variables
heroku config:set DB_HOST=xxx DB_USER=xxx DB_PASSWORD=xxx JWT_SECRET=xxx

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

### Database Hosting
- **Development:** Local MySQL
- **Production:** AWS RDS, Google Cloud SQL, or PlanetScale

---

## Future Enhancements

- Real-time collaboration (Socket.io)
- Data export/import (full project backup)
- Templates (pre-configured settings)
- Undo/Redo functionality
- Version history
- Advanced BOM features (material alternatives, supplier comparison)
- Mobile app (React Native)
- Offline mode with sync

---

## Resources

### Documentation
- Express.js: https://expressjs.com/
- MySQL2: https://github.com/sidorares/node-mysql2
- JWT: https://jwt.io/
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- SheetJS (Excel): https://docs.sheetjs.com/

### Tools
- Postman: API testing
- MySQL Workbench: Database management
- DB Browser: SQLite viewer (for testing)

---

## Contact & Support

If you encounter issues during implementation:
1. Check browser console for errors
2. Verify API endpoints with Postman
3. Check database connections
4. Review error logs
5. Consult this document for reference

---

**End of Implementation Plan**

*Last Updated: 2025-12-07*
