import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import QuranAyahOverlay from './QuranAyahOverlay';

// 3D Realistic Page Flip Variants (Arabic RTL Oriented)
const pageFlipVariants: Variants = {
  enter: (direction: 'next' | 'prev') => ({
    rotateY: direction === 'next' ? 65 : -65,
    x: direction === 'next' ? 35 : -35,
    opacity: 0,
    scale: 0.95,
    transformOrigin: direction === 'next' ? 'left center' : 'right center',
    filter: 'brightness(0.8) drop-shadow(0 15px 30px rgba(0,0,0,0.35))',
  }),
  center: {
    rotateY: 0,
    x: 0,
    opacity: 1,
    scale: 1,
    transformOrigin: 'center center',
    filter: 'brightness(1) drop-shadow(0 8px 18px rgba(0,0,0,0.12))',
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
  exit: (direction: 'next' | 'prev') => ({
    rotateY: direction === 'next' ? -65 : 65,
    x: direction === 'next' ? -35 : 35,
    opacity: 0,
    scale: 0.95,
    transformOrigin: direction === 'next' ? 'right center' : 'left center',
    filter: 'brightness(0.65) drop-shadow(0 20px 35px rgba(0,0,0,0.45))',
    transition: {
      duration: 0.38,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

interface QuranZoomViewerProps {
  pageNumber: number;
  darkMode: boolean;
  isFullscreen?: boolean;
  externalScale?: number;
  onExternalScaleChange?: (scale: number) => void;
  onPageTurn?: (direction: 'next' | 'prev') => void;
  onTap?: () => void;
  onInteraction?: () => void;
  pageTurnDirection?: 'next' | 'prev' | null;
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
  const effectivePageTurnDirection = pageTurnDirection || 'next';
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalScale, setInternalScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const ayahTapTriggeredRef = useRef(false);

  const rawScale = externalScale !== undefined ? externalScale : internalScale;
  const scale = typeof rawScale === 'number' && Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;

  const setScale = useCallback(
    (newScaleOrFn: number | ((prev: number) => number)) => {
      const currentValid = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1;
      let next = typeof newScaleOrFn === 'function' ? newScaleOrFn(currentValid) : newScaleOrFn;
      if (typeof next !== 'number' || !Number.isFinite(next) || isNaN(next)) {
        next = 1;
      }
      const clamped = Math.max(0.6, Math.min(3.5, Number(next.toFixed(2))));
      if (onExternalScaleChange) onExternalScaleChange(clamped);
      else setInternalScale(clamped);
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

  // Preload neighboring pages for instant, flicker-free 3D page flip
  useEffect(() => {
    const pages = [pageNumber - 2, pageNumber - 1, pageNumber + 1, pageNumber + 2].filter(
      (p) => p >= 1 && p <= 604
    );
    pages.forEach((p) => {
      const img = new Image();
      img.src = `/quran-pages/${p.toString().padStart(3, '0')}.webp`;
    });
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
      if (dist > 5) {
        initialPinchDistRef.current = dist;
        initialPinchScaleRef.current = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1;
      }
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

    if (e.touches.length === 2 && initialPinchDistRef.current && initialPinchDistRef.current > 5) {
      // Pinch to Zoom move
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (dist > 0) {
        const ratio = dist / initialPinchDistRef.current;
        const base = typeof initialPinchScaleRef.current === 'number' && Number.isFinite(initialPinchScaleRef.current) && initialPinchScaleRef.current > 0
          ? initialPinchScaleRef.current
          : 1;
        const rawNextScale = base * ratio;
        if (Number.isFinite(rawNextScale)) {
          const nextScale = Math.max(0.6, Math.min(3.5, rawNextScale));
          setScale(nextScale);
          if (nextScale <= 1.05) {
            setPosition({ x: 0, y: 0 });
          } else {
            setPosition((prev) => clampPosition(prev.x, prev.y, nextScale));
          }
        }
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
        const swipeThreshold = 40;

        if (Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.3) {
          if (dx < 0) {
            // Swipe left (toward left arrow) -> Next page in Arabic RTL
            if (pageNumber < 604) onPageTurn?.('next');
          } else {
            // Swipe right (toward right arrow) -> Prev page in Arabic RTL
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

  // Mouse Handlers for Desktop Panning & Swipe Page Turning
  const handleMouseDown = (e: React.MouseEvent) => {
    onInteraction?.();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...position };
    movedDistanceRef.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    onInteraction?.();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    movedDistanceRef.current = Math.hypot(dx, dy);

    if (scale > 1.05) {
      const nextX = posStartRef.current.x + dx;
      const nextY = posStartRef.current.y + dy;
      setPosition(clampPosition(nextX, nextY, scale));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;

      // Desktop Mouse Swipe Page Turning
      if (scale <= 1.05) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const swipeThreshold = 50;

        if (Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.3) {
          if (dx < 0) {
            // Drag left -> Next page in Arabic RTL
            if (pageNumber < 604) onPageTurn?.('next');
          } else {
            // Drag right -> Prev page in Arabic RTL
            if (pageNumber > 1) onPageTurn?.('prev');
          }
          return;
        }
      }

      if (movedDistanceRef.current < 6 && !ayahTapTriggeredRef.current) {
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
      className={`relative w-full h-full flex items-center justify-center select-none ${isFullscreen
          ? (isZoomed ? 'touch-none overflow-hidden cursor-grab active:cursor-grabbing' : 'touch-pan-y overflow-hidden cursor-default')
          : (isZoomed ? 'touch-none overflow-hidden cursor-grab active:cursor-grabbing' : 'touch-pan-y overflow-visible cursor-default')
        }`}
    >
      {/* 3D Realistic Perspective Page Container */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
          transformOrigin: 'center center',
          perspective: 1600,
        }}
      >
        <AnimatePresence mode="wait" custom={effectivePageTurnDirection}>
          <motion.div
            key={pageNumber}
            custom={effectivePageTurnDirection}
            variants={isZoomed ? undefined : pageFlipVariants}
            initial={isZoomed ? false : 'enter'}
            animate="center"
            exit={isZoomed ? undefined : 'exit'}
            className="relative inline-block max-w-full"
            style={{
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden',
            }}
          >
            <img
              src={`/quran-pages/${pageNumber.toString().padStart(3, '0')}.webp`}
              alt={`صفحة ${pageNumber}`}
              draggable={false}
              className={`block pointer-events-none select-none transition-filter duration-300 ${isFullscreen
                  ? 'w-auto h-auto max-h-[100dvh] max-w-full object-contain drop-shadow-2xl'
                  : 'w-full sm:w-auto h-auto max-h-[75vh] sm:max-h-[85vh] max-w-full object-contain shadow-none md:shadow-xl rounded-none md:rounded-2xl'
                }`}
              style={{
                filter: darkMode
                  ? 'invert(0.92) hue-rotate(180deg) brightness(0.88) contrast(1.12)'
                  : 'none',
              }}
            />

            {/* Dynamic 3D Book Spine Shadow & Page Reflection */}
            {!isZoomed && (
              <motion.div
                key={`shadow-${pageNumber}`}
                initial={{ opacity: 0.65 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0.75 }}
                transition={{ duration: 0.38, ease: 'easeOut' }}
                className={`absolute inset-0 pointer-events-none rounded-none md:rounded-2xl z-20 ${effectivePageTurnDirection === 'next'
                    ? 'bg-gradient-to-r from-black/35 via-transparent to-black/15'
                    : 'bg-gradient-to-l from-black/35 via-transparent to-black/15'
                  }`}
              />
            )}

            {onSelectAyah && (
              <QuranAyahOverlay
                pageNumber={pageNumber}
                selectedAyah={selectedAyah || null}
                onSelectAyah={(surah, ayah) => {
                  ayahTapTriggeredRef.current = true;
                  setTimeout(() => {
                    ayahTapTriggeredRef.current = false;
                  }, 500);
                  if (movedDistanceRef.current < 35) {
                    onSelectAyah(surah, ayah);
                  }
                }}
                darkMode={darkMode}
              />
            )}
          </motion.div>
        </AnimatePresence>
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

