'use client';

import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg mx-auto p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">حدث خطأ عام غير متوقع</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-4 leading-relaxed">
            {error?.message || 'تم عزل الخطأ العام بنجاح لحماية التطبيق.'}
          </p>
          {error?.digest && (
            <p className="text-[10px] font-mono text-slate-400 mb-6 bg-slate-50 p-2 rounded-xl">
              رمز الخطأ: {error.digest}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل الصفحة</span>
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-slate-200 transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>الرئيسية</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

