import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Swords, Bell, Sparkles, Loader2 } from 'lucide-react';

export type ModalType = 'default' | 'success' | 'alert' | 'danger' | 'invite';
export type ModalButtonVariant = 'primary' | 'gold' | 'danger' | 'secondary' | 'outline';

export interface ModalAction {
  label: React.ReactNode;
  onClick: () => void | Promise<void>;
  variant?: ModalButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface ModalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ModalButtonVariant;
  loading?: boolean;
  children: React.ReactNode;
}

/**
 * Standardized button for modal Call-to-Actions (CTAs)
 * Full-width, rounded-xl, and competitive game gradients
 */
export const ModalButton: React.FC<ModalButtonProps> = ({
  variant = 'primary',
  loading = false,
  disabled = false,
  children,
  className = '',
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        // Competitive game gradient: Emerald through Teal to Golden Amber
        return 'bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-500 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-400 text-white shadow-lg shadow-emerald-900/25 border-t border-white/25 active:scale-[0.98]';
      case 'gold':
        // Victory & Achievement gold gradient
        return 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500 text-white shadow-lg shadow-amber-900/25 border-t border-white/30 active:scale-[0.98]';
      case 'danger':
        // Warning / Declining / Destructive action
        return 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-red-900/25 border-t border-white/20 active:scale-[0.98]';
      case 'secondary':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 active:scale-[0.98]';
      case 'outline':
        return 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-700 active:scale-[0.98]';
      default:
        return 'bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-500 text-white shadow-lg';
    }
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`w-full py-3.5 px-5 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${getVariantStyles()} ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>جاري التنفيذ...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export interface GlobalModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  type?: ModalType;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  maxWidthClass?: string;
  headerClassName?: string;
  headerContent?: React.ReactNode;
  children?: React.ReactNode;
  primaryAction?: ModalAction;
  secondaryAction?: ModalAction;
  footer?: React.ReactNode;
  zIndex?: number;
}

/**
 * GlobalModalWrapper
 * High-end modal wrapper reflecting the visual identity of "متين":
 * - Overlay with glassmorphism (bg-black/50 backdrop-blur-sm)
 * - Smooth fade-in & scale-up animation
 * - Rounded-3xl body with pure white bg and shadow-2xl
 * - Top header with Green & Gold gradient + faint Islamic pattern watermark (opacity-10)
 * - Circular close button (X) in header
 * - Unified competitive game gradient buttons (w-full, rounded-xl)
 */
export const GlobalModalWrapper: React.FC<GlobalModalWrapperProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  type = 'default',
  icon,
  badge,
  showCloseButton = true,
  closeOnBackdropClick = true,
  maxWidthClass = 'max-w-md',
  headerClassName = '',
  headerContent,
  children,
  primaryAction,
  secondaryAction,
  footer,
  zIndex = 1100,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Determine default icon based on type if not provided
  const renderIcon = () => {
    if (icon) return icon;

    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 dark:text-emerald-400" />;
      case 'alert':
        return <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />;
      case 'danger':
        return <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-rose-500" />;
      case 'invite':
        return <Swords className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />;
      default:
        return <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400" />;
    }
  };

  const hasEmblem = Boolean(icon || type !== 'default');

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          dir="rtl"
          style={{ zIndex }}
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={closeOnBackdropClick ? onClose : undefined}
        >
          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full ${maxWidthClass} mx-4 bg-white dark:bg-[#151518] rounded-3xl shadow-2xl overflow-hidden border border-emerald-900/10 dark:border-slate-800 flex flex-col my-auto`}
          >
            {/* 1. Brand Identity Top Header (Green & Gold Gradient with Faint Islamic Pattern) */}
            <div
              className={`relative bg-gradient-to-r from-emerald-800 via-teal-800 to-amber-600 px-5 pt-5 pb-7 text-white shrink-0 overflow-hidden ${headerClassName}`}
            >
              {/* Islamic Geometric Pattern Watermark (opacity-10) */}
              <div
                className="absolute inset-0 bg-[url('/islamic_pattern.png')] dark:bg-[url('/islamic_pattern_dark.png')] bg-repeat opacity-10 pointer-events-none mix-blend-overlay"
                style={{ backgroundSize: '180px 180px' }}
              />

              {/* Subtle radiant overlay for luxury depth */}
              <div className="absolute inset-0 bg-radial from-amber-400/15 via-transparent to-black/20 pointer-events-none" />

              {/* Header Top Bar */}
              <div className="relative z-10 flex items-center justify-between gap-3">
                {/* Badge or App Title */}
                <div className="flex items-center gap-2">
                  {badge || (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold text-amber-200 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>متين</span>
                    </div>
                  )}
                </div>

                {/* Circular Close Button (X) */}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="إغلاق النافذة"
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs border border-white/20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Optional Custom Header Content */}
              {headerContent && (
                <div className="relative z-10 mt-3">
                  {headerContent}
                </div>
              )}
            </div>

            {/* 2. Floating Icon Emblem (Bridging Header and Body) */}
            {hasEmblem && (
              <div className="relative -mt-9 z-10 flex justify-center shrink-0">
                <div className="w-18 h-18 rounded-2xl bg-white dark:bg-slate-900 p-1.5 shadow-xl border border-emerald-100 dark:border-slate-800 flex items-center justify-center">
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-emerald-50 via-teal-50 to-amber-50 dark:from-slate-800 dark:to-slate-800/80 flex items-center justify-center border border-emerald-100/60 dark:border-slate-700 shadow-inner">
                    {renderIcon()}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Modal Body Content */}
            <div className={`p-6 ${hasEmblem ? 'pt-3' : 'pt-5'} flex flex-col flex-1 text-center`}>
              {/* Title & Subtitle */}
              {title && (
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-quran tracking-tight mb-2">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4 px-2">
                  {subtitle}
                </p>
              )}

              {/* Injected Children */}
              {children && <div className="text-right">{children}</div>}

              {/* 4. Action Buttons (Unified CTA Layout) */}
              {(primaryAction || secondaryAction || footer) && (
                <div className="mt-6 flex flex-col gap-2.5">
                  {footer ? (
                    footer
                  ) : (
                    <>
                      {primaryAction && (
                        <ModalButton
                          variant={primaryAction.variant || (type === 'danger' ? 'danger' : 'primary')}
                          loading={primaryAction.loading}
                          disabled={primaryAction.disabled}
                          onClick={primaryAction.onClick}
                        >
                          {primaryAction.icon}
                          <span>{primaryAction.label}</span>
                        </ModalButton>
                      )}

                      {secondaryAction && (
                        <ModalButton
                          variant={secondaryAction.variant || 'secondary'}
                          loading={secondaryAction.loading}
                          disabled={secondaryAction.disabled}
                          onClick={secondaryAction.onClick}
                        >
                          {secondaryAction.icon}
                          <span>{secondaryAction.label}</span>
                        </ModalButton>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GlobalModalWrapper;

