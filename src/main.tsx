import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Route relative /api/ calls to the live server when running packaged inside Capacitor
const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request)?.url;
  if (typeof url === 'string' && url.startsWith('/api/')) {
    const isNative = (window as any).Capacitor?.isNativePlatform?.() || 
                     window.location.protocol === 'capacitor:' || 
                     window.location.protocol === 'file:' ||
                     (window.location.hostname === 'localhost' && !window.location.port);
    if (isNative) {
      const fullUrl = `https://mateen-quran.vercel.app${url}`;
      return originalFetch(fullUrl, init);
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
