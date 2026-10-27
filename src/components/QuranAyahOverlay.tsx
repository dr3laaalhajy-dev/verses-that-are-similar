import React, { useMemo } from 'react';
import { getAyahBoundsForPage } from '../services/AyahSelectionService';

interface QuranAyahOverlayProps {
  pageNumber: number;
  selectedAyah?: { surah: number; ayah: number } | null;
  onSelectAyah: (surah: number, ayah: number) => void;
  darkMode?: boolean;
}

export const QuranAyahOverlay: React.FC<QuranAyahOverlayProps> = ({
  pageNumber,
  onSelectAyah,
}) => {
  const pageBounds = useMemo(() => getAyahBoundsForPage(pageNumber), [pageNumber]);

  if (!pageBounds || !pageBounds.b || pageBounds.b.length === 0) {
    return null;
  }

  return (
    <svg
      viewBox={pageBounds.v}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-auto select-none overflow-visible"
      style={{ zIndex: 15 }}
    >
      {pageBounds.b.map((item, idx) => (
        <path
          key={`${item.s}_${item.a}_${idx}`}
          d={item.d}
          onClick={(e) => {
            e.stopPropagation();
            onSelectAyah(item.s, item.a);
          }}
          className="cursor-pointer outline-none"
          style={{
            fill: 'rgba(0, 0, 0, 0.001)', // Invisible hit-area
            stroke: 'transparent',
            strokeWidth: 0,
            pointerEvents: 'all',
          }}
        />
      ))}
    </svg>
  );
};

export default QuranAyahOverlay;
