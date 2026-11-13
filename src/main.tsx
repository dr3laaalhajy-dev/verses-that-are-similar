import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initOfflineSyncManager } from './services/offlineSyncManager';
import { installApiFetch, startSessionChecks } from './lib/playerSession';

// One fetch wrapper for every /api/* call: routes to the live server when packaged inside
// Capacitor, adds the player token, and ends the session on SESSION_REPLACED / SESSION_INVALID.
installApiFetch(window, {
  isNative: () =>
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
    (window.location.hostname === 'localhost' && !window.location.port),
});

// Check the player session at start and on return from background (only if a token is stored).
startSessionChecks(window);

// تشغيل نظام المزامنة الأوفلاين التلقائي فور بدء تشغيل التطبيق
initOfflineSyncManager();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
