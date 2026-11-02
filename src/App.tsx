import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { AppRouter } from './routes/AppRouter';
import { MainLayout } from './components/layout/MainLayout';
import { GlobalOverlays } from './components/common/GlobalOverlays';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminLogin from './components/Admin/AdminLogin';

function AppContent() {
  const app = useApp();

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
      className={`min-h-screen relative font-sans selection:bg-holyEmerald-500/20 ${app.librarySettings?.darkMode ? 'lib-dark bg-obsidian-950 text-regalGold-100' : 'bg-slate-50 text-slate-900'}`}
      dir="rtl"
    >
      <div
        className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-700 ${app.librarySettings?.darkMode ? 'girih-overlay opacity-25' : 'mix-blend-multiply opacity-10'}`}
        style={app.librarySettings?.darkMode ? undefined : {
          backgroundImage: `url('/islamic_pattern.png')`,
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
