'use client';

import React from 'react';
import { AppProvider } from '../src/contexts/AppContext';
import { MainLayout } from '../src/components/layout/MainLayout';
import { GlobalOverlays } from '../src/components/common/GlobalOverlays';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-500/20">
        <ErrorBoundary>
          <AppProvider>
            <MainLayout>
              {children}
            </MainLayout>
            <GlobalOverlays />
          </AppProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

