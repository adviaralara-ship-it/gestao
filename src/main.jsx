import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { auth } from './firebase'

// Interceptor de segurança: injeta token de autenticação do Firebase em chamadas para /api/
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    let [resource, config] = args;
    const url = typeof resource === 'string' ? resource : resource?.url;

    if (url && (url.startsWith('/api/') || url.includes('/api/'))) {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const token = await currentUser.getIdToken();
          config = config || {};
          const headers = new Headers(config.headers || {});
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          config.headers = headers;
          args[1] = config;
        }
      } catch (err) {
        console.warn('Erro ao anexar token de autenticação na API:', err);
      }
    }
    return originalFetch.apply(window, args);
  };
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.update().catch(() => {});
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
