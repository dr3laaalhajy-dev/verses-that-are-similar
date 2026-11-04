'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Root App Error]', error);
  }, [error]);

  return (
    <div
      dir="rtl"
      className="w-full max-w-lg mx-auto my-12 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>

      <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 font-quran">
        حدث تعطل غير متوقع في التطبيق
      </h2>

      <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
        {error?.message || 'تم اعتراض الخطأ بنجاح لمنع تجمّد التوجيه في أزرار التنقل.'}
      </p>

      {error?.digest && (
        <p className="text-[10px] font-mono text-slate-400 mb-6 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
          رمز الخطأ: {error.digest}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>إعادة المحاولة</span>
        </button>

        <button
          type="button"
          onClick={() => { window.location.href = '/'; }}
          className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>الرئيسية</span>
        </button>
      </div>
    </div>
  );
}

