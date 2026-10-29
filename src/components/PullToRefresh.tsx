import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children, onRefresh }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const isPulling = useRef(false);
  const pullThreshold = 70;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull to refresh when scrolled at the very top
      if (window.scrollY <= 2) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      } else {
        isPulling.current = false;
        touchStartY.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || touchStartY.current === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      if (diff > 0 && window.scrollY <= 2) {
        // Apply friction to pull distance
        const distance = Math.min(diff * 0.4, 95);
        setPullDistance(distance);
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) return;
      isPulling.current = false;
      touchStartY.current = null;

      if (pullDistance >= pullThreshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(55); // Hold at indicator height while refreshing

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            // محاكاة تأخير خفيف للتحديث في الخلفية دون إعادة تحميل الصفحة نهائياً
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        } catch (err) {
          console.error('Background refresh error:', err);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  const rotation = Math.min((pullDistance / pullThreshold) * 360, 360);
  const isReady = pullDistance >= pullThreshold;

  return (
    <div className="relative w-full">
      {/* Pull Indicator */}
      <AnimatePresence>
        {(pullDistance > 10 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
            style={{ height: `${pullDistance}px` }}
            className="w-full flex items-center justify-center overflow-hidden transition-all duration-150 pointer-events-none select-none z-40"
          >
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-emerald text-brand-gold border border-brand-gold/40 shadow-xl backdrop-blur-md">
              <RotateCw
                className={`w-4 h-4 text-brand-gold ${isRefreshing ? 'animate-spin' : ''}`}
                style={{
                  transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
                  transition: isRefreshing ? undefined : 'transform 0.05s ease-out'
                }}
              />
              <span className="text-xs font-bold text-white tracking-wide">
                {isRefreshing
                  ? 'جاري التحديث...'
                  : isReady
                  ? 'أفلت للتحديث'
                  : 'اسحب للأسفل للتحديث'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Children: Keep UI visible at all times to prevent blank screens or white flashes */}
      <div 
        className="transition-transform duration-200 ease-out"
        style={{
          transform: isRefreshing ? 'translateY(6px)' : pullDistance > 0 ? `translateY(${pullDistance * 0.2}px)` : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
};
