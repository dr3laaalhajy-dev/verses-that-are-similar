import React, { useEffect } from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { AppRouter } from './routes/AppRouter';
import { MainLayout } from './components/layout/MainLayout';
import { GlobalOverlays } from './components/common/GlobalOverlays';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminLogin from './components/Admin/AdminLogin';
import { router } from './services/router';

function AppContent() {
  const app = useApp();

  // Requirement 2 & 3: Notification Action Listeners (Push & Local) with router.push direct navigation
  useEffect(() => {
    // 1. Web / Service Worker notification click listener via postMessage
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DEEP_LINK_NAVIGATE') {
        const route = event.data?.data?.route || event.data?.route || event.data?.url;
        if (route) {
          router.push(route);
        }
      }
    };
    window.addEventListener('message', handleServiceWorkerMessage);

    // 2. Capacitor Push Notifications Action Listener (pushNotificationActionPerformed)
    let pushListenerCleanup: (() => void) | null = null;
    try {
      const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
      const pushPlugin = cap?.Plugins?.PushNotifications;
      if (pushPlugin && typeof pushPlugin.addListener === 'function') {
        const handle = pushPlugin.addListener('pushNotificationActionPerformed', (notification: any) => {
          console.log('[NotificationListener] Push notification action performed:', notification);
          const route = notification?.notification?.data?.route ||
                        notification?.notification?.data?.url ||
                        notification?.data?.route ||
                        notification?.data?.url ||
                        notification?.notification?.data?.relative_url;
          if (route) {
            router.push(route);
          }
        });
        if (handle && typeof handle.then === 'function') {
          handle.then((sub: any) => {
            pushListenerCleanup = () => sub?.remove?.();
          });
        }
      }
    } catch (e) {
      console.warn('[NotificationListener] PushNotifications listener attachment error:', e);
    }

    // 3. Capacitor Local Notifications Action Listener (localNotificationActionPerformed)
    let localListenerCleanup: (() => void) | null = null;
    try {
      const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
      const localPlugin = cap?.Plugins?.LocalNotifications;
      if (localPlugin && typeof localPlugin.addListener === 'function') {
        const handle = localPlugin.addListener('localNotificationActionPerformed', (notification: any) => {
          console.log('[NotificationListener] Local notification action performed:', notification);
          const route = notification?.notification?.extra?.route ||
                        notification?.notification?.data?.route ||
                        notification?.notification?.extra?.url ||
                        notification?.data?.route ||
                        notification?.extra?.route;
          if (route) {
            router.push(route);
          }
        });
        if (handle && typeof handle.then === 'function') {
          handle.then((sub: any) => {
            localListenerCleanup = () => sub?.remove?.();
          });
        }
      }
    } catch (e) {
      console.warn('[NotificationListener] LocalNotifications listener attachment error:', e);
    }

    return () => {
      window.removeEventListener('message', handleServiceWorkerMessage);
      if (pushListenerCleanup) pushListenerCleanup();
      if (localListenerCleanup) localListenerCleanup();
    };
  }, []);

  if (app.view === 'admin') {
    return (
      <div className="relative z-10 w-full min-h-screen">
        {app.adminToken ? (
          <AdminDashboard
            token={app.adminToken}
            isSuperAdmin={app.isSuperAdmin}
            adminRole={app.adminRole}
            currentUsername={app.adminUsername}
            currentName={app.adminName}
            currentAdminId={app.adminId}
            canManageUsers={app.canManageUsers}
            onPermissionsUpdated={(updated) => {
              app.setCanManageUsers(updated);
              localStorage.setItem('quran_admin_can_manage_users', String(updated));
            }}
            systemSettings={app.systemSettings}
            onSettingsUpdated={app.fetchSettings}
            onLogout={app.handleAdminLogout}
            onBackHome={() => {
              app.setView('home');
              app.fetchChallenges();
              app.fetchCompletionChallenges();
            }}
          />
        ) : (
          <AdminLogin
            onLogin={app.handleAdminLogin}
            onBack={() => app.setView('home')}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen relative font-sans selection:bg-holyEmerald-500/20 ${app.librarySettings?.darkMode ? 'lib-dark bg-[#151518] text-regalGold-100' : 'bg-slate-50 text-slate-900'}`}
      dir="rtl"
    >
      <div
        className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-700 ${app.librarySettings?.darkMode ? 'dark-arabesque-overlay opacity-100' : 'bg-islamic-pattern mix-blend-multiply opacity-10'}`}
        style={{
          backgroundImage: `url('${app.librarySettings?.darkMode ? '/islamic_pattern_dark.png' : '/islamic_pattern.png'}')`,
          backgroundSize: '400px',
        }}
      />

      <MainLayout>
        <AppRouter />
      </MainLayout>

      <GlobalOverlays />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
