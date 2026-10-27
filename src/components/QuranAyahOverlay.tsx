import React, { useMemo } from 'react';
import { getAyahBoundsForPage } from '../services/AyahSelectionService';

interface QuranAyahOverlayProps {
  pageNumber: number;
  selectedAyah: { surah: number; ayah: number } | null;
  onSelectAyah: (surah: number, ayah: number) => void;
  darkMode: boolean;
}

export const QuranAyahOverlay: React.FC<QuranAyahOverlayProps> = ({
  pageNumber,
  selectedAyah,
  onSelectAyah,
  darkMode,
}) => {
  const pageBounds = useMemo(() => getAyahBoundsForPage(pageNumber), [pageNumber]);

  if (!pageBounds || !pageBounds.b || pageBounds.b.length === 0) {
    return null;
  }

  return (
    <svg
      viewBox={pageBounds.v}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-auto select-none"
      style={{ zIndex: 15 }}
    >
      <defs>
        {/* Glow filter for selected ayah */}
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#f59e0b" floodOpacity="0.6" />
        </filter>
        <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#10b981" floodOpacity="0.6" />
        </filter>
      </defs>

      {pageBounds.b.map((item, idx) => {
        const isSelected =
          selectedAyah?.surah === item.s && selectedAyah?.ayah === item.a;

        return (
          <path
            key={`${item.s}_${item.a}_${idx}`}
            d={item.d}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAyah(item.s, item.a);
            }}
            className="cursor-pointer transition-all duration-150 outline-none"
            style={{
              fill: isSelected
                ? darkMode
                  ? 'rgba(251, 191, 36, 0.32)' // Gold highlight in dark mode
                  : 'rgba(217, 119, 6, 0.28)'  // Amber/gold highlight in light mode
                : 'transparent',
              stroke: isSelected
                ? darkMode
                  ? 'rgba(251, 191, 36, 0.9)'
                  : 'rgba(217, 119, 6, 0.85)'
                : 'transparent',
              strokeWidth: isSelected ? 1.5 : 0,
              filter: isSelected ? 'url(#goldGlow)' : 'none',
            }}
          />
        );
      })}
    </svg>
  );
};

export default QuranAyahOverlay;
