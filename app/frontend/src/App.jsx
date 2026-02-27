import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Timesheets from './pages/Timesheets';
import Invoices from './pages/Invoices';
import Payroll from './pages/Payroll';
import Settings from './pages/Settings';
import BugReporter from './components/BugReporter';

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/timesheets', label: 'Timesheets', icon: '📋' },
  { path: '/invoices', label: 'Invoices', icon: '🧾' },
  { path: '/payroll', label: 'Payroll', icon: '💰' },
  { path: '/settings', label: 'Settings', icon: '⚙️' }
];

function Sidebar({ open, onClose }) {
  const { user, logout, authEnabled } = useAuth();
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 flex flex-col transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 md:w-56
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="px-4 py-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">🏥 Billing</h1>
            <p className="text-gray-400 text-xs mt-1">Tampa Bay OT LLC</p>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white text-2xl" onClick={onClose}>×</button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-700">
          {user && authEnabled && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-xs">👤 {user.name}</span>
              <button onClick={logout} className="text-gray-500 hover:text-red-400 text-xs transition-colors">
                Logout
              </button>
            </div>
          )}
          <BugReporter variant="sidebar" />
          <a href="https://fltechadventures.com" target="_blank" rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 text-xs block transition-colors mt-2">fltechadventures.com</a>
          <a href="mailto:alain@fltechadventures.com"
            className="text-gray-500 hover:text-gray-300 text-xs block transition-colors">alain@fltechadventures.com</a>
          <p className="text-gray-600 text-xs mt-1">v1.2.0</p>
        </div>
      </aside>
    </>
  );
}

function MobileHeader({ onMenuClick }) {
  const location = useLocation();
  const current = NAV_ITEMS.find(i => i.path === location.pathname) || NAV_ITEMS[0];
  return (
    <header className="md:hidden bg-gray-900 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
      <button onClick={onMenuClick} className="text-2xl">☰</button>
      <span className="text-base">{current.icon}</span>
      <span className="font-semibold">{current.label}</span>
    </header>
  );
}

function AuthenticatedApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/timesheets" element={<Timesheets />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedApp /> : <Login />;
}

// Wrap in main.jsx with AuthProvider
