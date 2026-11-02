import React, { useState } from 'react';

export const WHO_AM_I_ID = 'who_am_i';

// هوك الاستبعاد المتبادل
export function useSkillSelection(initial: string[] = []) {
  const [selected, setSelected] = useState<string[]>(initial);
  const isWhoAmI = selected.includes(WHO_AM_I_ID);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (id === WHO_AM_I_ID) {
        // اختيار "من أنا؟" يفرّغ كل المهارات الأخرى، وإعادة الضغط تلغيه
        return prev.includes(WHO_AM_I_ID) ? [] : [WHO_AM_I_ID];
      }
      // اختيار مهارة أخرى يلغي "من أنا؟"
      const without = prev.filter((s) => s !== WHO_AM_I_ID);
      return without.includes(id) ? without.filter((s) => s !== id) : [...without, id];
    });
  };
  return { selected, isWhoAmI, toggle, setSelected };
}

export function WhoAmIInfoAlert() {
  return (
    <div
      role="note"
      className="p-3.5 sm:p-4 rounded-2xl bg-blue-50/90 border-2 border-blue-200 text-blue-900 font-bold text-xs sm:text-sm leading-relaxed text-right flex items-start gap-2.5 shadow-xs"
    >
      <span className="text-lg shrink-0">ℹ️</span>
      <div>
        <p className="font-black text-blue-950 mb-0.5">نظام التحدي الخاص:</p>
        <p>تحدي "من أنا؟" يعتمد نظام التلميحات المتدرجة (20 ثانية لكل تلميح) بنظام متزامن تلقائياً لجميع اللاعبين.</p>
      </div>
    </div>
  );
}

export default WhoAmIInfoAlert;

