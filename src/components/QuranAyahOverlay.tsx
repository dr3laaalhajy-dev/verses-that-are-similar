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
      style={{
        zIndex: 15,
        mixBlendMode: darkMode ? 'screen' : 'multiply',
      }}
    >
      <defs>
        {/* Soft Ambient Glow for Selected Ayah in Dark Mode */}
        <filter id="ayahSelectionGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
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
                  ? 'rgba(251, 191, 36, 0.26)' // Warm soft golden glow in Dark Mode
                  : 'rgba(234, 179, 8, 0.20)'  // Delicate authentic amber highlighter in Light Mode
                : 'transparent',
              stroke: 'none',
              filter: isSelected && darkMode ? 'url(#ayahSelectionGlow)' : 'none',
            }}
          />
        );
      })}
    </svg>
  );
};

export default QuranAyahOverlay;
