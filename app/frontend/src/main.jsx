import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './hooks/useAuth.jsx';
import { setupAuthFetch } from './hooks/useApiFetch.jsx';
import App from './App';
import './index.css';

// Monkey-patch fetch to auto-inject auth token on all /api/ calls
setupAuthFetch();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
