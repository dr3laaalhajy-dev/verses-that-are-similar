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
      className={`min-h-screen relative text-slate-900 font-sans selection:bg-brand-emerald/10 ${app.librarySettings?.darkMode ? 'lib-dark' : 'bg-slate-50'}`}
      dir="rtl"
    >
      <div
        className={`absolute inset-0 z-0 opacity-10 pointer-events-none transition-opacity duration-700 ${app.librarySettings?.darkMode ? 'mix-blend-soft-light opacity-5' : 'mix-blend-multiply opacity-10'}`}
        style={{
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
