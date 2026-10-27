import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import QuranAyahOverlay from './QuranAyahOverlay';

interface QuranZoomViewerProps {
  pageNumber: number;
  darkMode: boolean;
  isFullscreen?: boolean;
  externalScale?: number;
  onExternalScaleChange?: (scale: number) => void;
  onPageTurn?: (direction: 'next' | 'prev') => void;
  onTap?: () => void;
  onInteraction?: () => void;
  pageTurnDirection?: 'next' | 'prev';
  selectedAyah?: { surah: number; ayah: number } | null;
  onSelectAyah?: (surah: number, ayah: number) => void;
}

export const QuranZoomViewer: React.FC<QuranZoomViewerProps> = ({
  pageNumber,
  darkMode,
  isFullscreen = false,
  externalScale,
  onExternalScaleChange,
  onPageTurn,
  onTap,
  onInteraction,
  pageTurnDirection = 'next',
  selectedAyah,
  onSelectAyah,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalScale, setInternalScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const ayahTapTriggeredRef = useRef(false);

  const scale = externalScale !== undefined ? externalScale : internalScale;
  const setScale = useCallback(
    (newScaleOrFn: number | ((prev: number) => number)) => {
      if (typeof newScaleOrFn === 'function') {
        const next = newScaleOrFn(scale);
        const clamped = Math.max(1, Math.min(3.5, Number(next.toFixed(2))));
        if (onExternalScaleChange) onExternalScaleChange(clamped);
        else setInternalScale(clamped);
      } else {
        const clamped = Math.max(1, Math.min(3.5, Number(newScaleOrFn.toFixed(2))));
        if (onExternalScaleChange) onExternalScaleChange(clamped);
        else setInternalScale(clamped);
      }
    },
    [scale, onExternalScaleChange]
  );

  // Gesture Tracking Refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef(1);
  const lastTapTimeRef = useRef(0);
  const movedDistanceRef = useRef(0);

  // Reset zoom & pan when page changes
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    setScale(1);
  }, [pageNumber]);

  // Keep pan within sensible boundaries based on scale
  const clampPosition = useCallback(
    (x: number, y: number, currentScale: number) => {
      if (!containerRef.current || currentScale <= 1.02) {
        return { x: 0, y: 0 };
      }
      const rect = containerRef.current.getBoundingClientRect();
      const maxDeltaX = ((currentScale - 1) * rect.width) / 1.8;
      const maxDeltaY = ((currentScale - 1) * rect.height) / 1.8;

      return {
        x: Math.max(-maxDeltaX, Math.min(maxDeltaX, x)),
        y: Math.max(-maxDeltaY, Math.min(maxDeltaY, y)),
      };
    },
    []
  );

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    onInteraction?.();

    if (e.touches.length === 2) {
      // Pinch to Zoom start
      isDraggingRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialPinchDistRef.current = dist;
      initialPinchScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      // 1 Finger Drag / Tap / Double Tap
      const touch = e.touches[0];
      isDraggingRef.current = true;
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      posStartRef.current = { ...position };
      movedDistanceRef.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    onInteraction?.();

    if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      // Pinch to Zoom move
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / initialPinchDistRef.current;
      const nextScale = Math.max(1, Math.min(3.5, initialPinchScaleRef.current * ratio));
      setScale(nextScale);
      if (nextScale <= 1.05) {
        setPosition({ x: 0, y: 0 });
      } else {
        setPosition((prev) => clampPosition(prev.x, prev.y, nextScale));
      }
    } else if (e.touches.length === 1 && isDraggingRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      movedDistanceRef.current = Math.hypot(dx, dy);

      if (scale > 1.05) {
        // Pan freely in 2D
        const nextX = posStartRef.current.x + dx;
        const nextY = posStartRef.current.y + dy;
        setPosition(clampPosition(nextX, nextY, scale));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    onInteraction?.();

    if (e.touches.length < 2) {
      initialPinchDistRef.current = null;
    }

    if (isDraggingRef.current && e.touches.length === 0) {
      isDraggingRef.current = false;

      // Handle swipe page turn if scale is 1
      if (scale <= 1.05) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;
        const swipeThreshold = 45;

        if (Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx > 0) {
            // Swipe right -> Next page in Arabic RTL
            if (pageNumber < 604) onPageTurn?.('next');
          } else {
            // Swipe left -> Prev page in Arabic RTL
            if (pageNumber > 1) onPageTurn?.('prev');
          }
          return;
        }
      }

      // Check for tap / double tap
      if (movedDistanceRef.current < 8) {
        const now = Date.now();
        const diff = now - lastTapTimeRef.current;
        lastTapTimeRef.current = now;

        if (diff < 320) {
          // Double Tap: Toggle Zoom (1x <-> 2.2x)
          if (scale > 1.2) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
          } else {
            setScale(2.2);
          }
        } else {
          // Single Tap (suppressed if an Ayah was clicked)
          setTimeout(() => {
            const sinceLast = Date.now() - lastTapTimeRef.current;
            if (sinceLast >= 300 && !ayahTapTriggeredRef.current) {
              onTap?.();
            }
          }, 300);
        }
      }
    }
  };

  // Mouse Handlers for Desktop Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1.05) return;
    onInteraction?.();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...position };
    movedDistanceRef.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || scale <= 1.05) return;
    onInteraction?.();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    movedDistanceRef.current = Math.hypot(dx, dy);

    const nextX = posStartRef.current.x + dx;
    const nextY = posStartRef.current.y + dy;
    setPosition(clampPosition(nextX, nextY, scale));
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (movedDistanceRef.current < 6) {
        onTap?.();
      }
    }
  };

  // Desktop Wheel with Ctrl / Cmd to Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onInteraction?.();
      const delta = e.deltaY * -0.01;
      const nextScale = Math.max(1, Math.min(3.5, scale + delta));
      setScale(nextScale);
      if (nextScale <= 1.05) {
        setPosition({ x: 0, y: 0 });
      } else {
        setPosition((prev) => clampPosition(prev.x, prev.y, nextScale));
      }
    }
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    onInteraction?.();
  };

  const isZoomed = scale > 1.05;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none touch-none ${
        isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      {/* Zoomable Image Wrapper */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <div className="relative inline-block max-w-full">
          <img
            src={`/quran-pages/${pageNumber.toString().padStart(3, '0')}.png`}
            alt={`صفحة ${pageNumber}`}
            draggable={false}
            className={`block pointer-events-none select-none transition-filter duration-300 ${
              isFullscreen
                ? 'w-auto h-auto max-h-[100dvh] max-w-full drop-shadow-2xl'
                : 'w-auto h-auto max-h-[85vh] max-w-full shadow-none md:shadow-xl rounded-none md:rounded-2xl'
            }`}
            style={{
              filter: darkMode
                ? 'invert(0.92) hue-rotate(180deg) brightness(0.88) contrast(1.12)'
                : 'none',
            }}
          />

          {onSelectAyah && (
            <QuranAyahOverlay
              pageNumber={pageNumber}
              selectedAyah={selectedAyah || null}
              onSelectAyah={(surah, ayah) => {
                ayahTapTriggeredRef.current = true;
                setTimeout(() => {
                  ayahTapTriggeredRef.current = false;
                }, 400);
                if (movedDistanceRef.current < 8) {
                  onSelectAyah(surah, ayah);
                }
              }}
              darkMode={darkMode}
            />
          )}
        </div>
      </div>

      {/* Floating Zoom Controls Badge when Zoomed In */}
      {isZoomed && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 text-white backdrop-blur-xl border border-white/20 shadow-2xl text-xs font-black animate-in fade-in zoom-in-95 duration-200"
        >
          <span className="text-brand-gold">{Math.round(scale * 100)}%</span>
          <span className="text-white/30">•</span>
          <span className="text-[11px] text-white/80 font-bold hidden sm:inline">اسحب للتحريك في كل الاتجاهات</span>
          <button
            onClick={resetZoom}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-black transition-all active:scale-95"
            title="إعادة التكبير إلى 100%"
          >
            <RotateCcw className="w-3 h-3 text-brand-gold" />
            <span>100%</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default QuranZoomViewer;

