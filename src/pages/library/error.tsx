'use client';

import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { router } from '../../services/router';

export interface ErrorProps {
  error?: Error;
  reset?: () => void;
}

/**
 * Next.js / Library Route Error Boundary Component
 * Catches client-side errors in the library section and provides instant recovery
 */
export default function Error({ error, reset }: ErrorProps) {
  return (
    <div
      dir="rtl"
      className="w-full max-w-lg mx-auto my-12 p-6 sm:p-8 rounded-3xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-4 shadow-xs">
        <AlertCircle className="w-7 h-7" />
      </div>

      <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2 font-quran">
        تعذر تحميل قسم المكتبة
      </h3>

      <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
        حدث خطأ أثناء تحميل محتويات المكتبة والعلوم الشرعية. تم عزل المشكلة تلقائياً لمنع تجمّد باقي أجزاء التطبيق.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {reset && (
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => router.push('/')}
          className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>الرئيسية</span>
        </button>
      </div>
    </div>
  );
}

