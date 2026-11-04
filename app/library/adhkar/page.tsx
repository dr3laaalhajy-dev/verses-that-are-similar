'use client';

import React from 'react';
import { useApp } from '../../../src/contexts/AppContext';
import { AdhkarPage } from '../../../src/pages/AdhkarPage';

export default function AdhkarAppRoutePage() {
  const app = useApp();

  return (
    <div className="w-full min-h-screen">
      <AdhkarPage
        adhkarSearchQuery={app.adhkarSearchQuery}
        setAdhkarSearchQuery={app.setAdhkarSearchQuery}
        selectedAdhkarCategoryId={app.selectedAdhkarCategoryId}
        setSelectedAdhkarCategoryId={app.setSelectedAdhkarCategoryId}
        adhkarProgress={app.adhkarProgress}
        setAdhkarProgress={app.setAdhkarProgress}
        setIsSettingsOpen={app.setIsSettingsOpen}
        handleBackToHome={app.handleBackToHome}
      />
    </div>
  );
}

