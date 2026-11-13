import React from 'react';
import {
  BookOpen,
  UserCheck,
  Trophy,
  Scale,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const TermsOfUse: React.FC = () => {
  return (
    <div className="space-y-6 text-right text-slate-700 leading-relaxed" dir="rtl">
      {/* Title & Introduction Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-50 via-amber-100/50 to-orange-50 rounded-2xl border border-amber-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 text-amber-900 mb-2">
          <Sparkles className="w-5 h-5 text-amber-600" />
          <h3 className="text-base sm:text-lg font-black text-amber-950">
            شروط وأحكام استخدام تطبيق متين (Mateen)
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-amber-900 font-medium leading-relaxed">
          تطبيق "متين" هو عمل دعوي ووقف رقمي (صدقة جارية) يهدف إلى خدمة كتاب الله تعالى وسنة نبيه ﷺ. باستخدامك لهذا التطبيق، فإنك توافق تماماً على الالتزام بالشروط والأحكام التالية:
        </p>
      </div>

      {/* ١. قدسية المحتوى */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-2.5">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ١
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-brand-emerald inline" />
            <span>قدسية المحتوى</span>
          </span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          يجب التعامل مع نصوص وآيات القرآن الكريم بوقار وتدبر. يُرجى استخدام التطبيق بنية صالحة وبما يليق بقدسية الآيات القرآنية الكريمة، ويُمنع استخدامه في أي سياق لا يليق بكتاب الله.
        </p>
      </section>

      {/* ٢. الحسابات والأسماء اللائقة */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٢
          </span>
          <span className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-brand-emerald inline" />
            <span>الحسابات والأسماء اللائقة</span>
          </span>
        </h4>
        <div className="space-y-2.5 pr-1 text-xs sm:text-sm text-slate-600 font-medium">
          <p className="leading-relaxed">
            <strong className="text-slate-900">الاسم المعروض:</strong> يلتزم المستخدم باختيار اسم محترم ولائق. يُحظر تماماً استخدام أسماء مستخدمين تحمل إساءات دينية، أو أخلاقية، أو خادشة للحياء.
          </p>
          <p className="leading-relaxed">
            <strong className="text-slate-900">أمان الحساب:</strong> أنت مسؤول عن الحفاظ على سرية كلمة المرور الخاصة بك، والتطبيق غير مسؤول عن أي اختراق ينتج عن مشاركتك لبياناتك مع الآخرين.
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 font-bold">
            يحق لإدارة التطبيق تعديل الأسماء المسيئة أو حظر أي حساب يخالف هذه الشروط فوراً وبدون إشعار مسبق.
          </div>
        </div>
      </section>

      {/* ٣. اللعب النزيه وقواعد التنافس (Fair Play) */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٣
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500 inline" />
            <span>اللعب النزيه وقواعد التنافس (Fair Play)</span>
          </span>
        </h4>
        <div className="space-y-2.5 pr-1 text-xs sm:text-sm text-slate-600 font-medium">
          <p className="leading-relaxed">
            يلتزم اللاعب بالمنافسة الشريفة في غرف التحدي الفردية والجماعية.
          </p>
          <p className="leading-relaxed">
            يُحظر قطعياً استخدام أي برامج خارجية، ثغرات، أو أدوات آلية للغش أو التلاعب بنتائج التحديات والتأثير على لوحة المتصدرين. اكتشاف أي تلاعب يؤدي إلى الإغلاق النهائي للحساب ومسح الإنجازات.
          </p>
        </div>
      </section>

      {/* ٤. حقوق الملكية الفكرية */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-2.5">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٤
          </span>
          <span className="flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-brand-emerald inline" />
            <span>حقوق الملكية الفكرية</span>
          </span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          كافة محتويات التطبيق، نصوص التحديات، قواعد بيانات المتشابهات، والبرمجيات الخاصة بتطبيق "متين" محفوظة للمطور <strong className="text-slate-900">د. علاء الدين الحجي</strong> وفريق العمل. تُتاح هذه المحتويات مجاناً كوقف رقمي لنفع أمة الإسلام، ويُمنع نسخها أو إعادة استخدامها لأغراض تجارية.
        </p>
      </section>

      {/* ٥. إخلاء المسؤولية وتوافر الخدمة */}
      <section className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-2.5">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
          <span className="w-7 h-7 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center font-black text-xs shrink-0">
            ٥
          </span>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-slate-600 inline" />
            <span>إخلاء المسؤولية وتوافر الخدمة</span>
          </span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          يُقدم التطبيق مجاناً لوجه الله. رغم سعينا الدائم لضمان استقرار التطبيق وحفظ بياناتك السحابية، إلا أننا لا نضمن خلوه التام من الانقطاعات أو الأخطاء التقنية الخارجة عن إرادتنا، ولا نتحمل أي مسؤولية قانونية عن أي فقدان مؤقت أو دائم للبيانات.
        </p>
      </section>

      {/* ٦. تحديث الشروط */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-2.5">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٦
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 text-brand-emerald inline" />
            <span>تحديث الشروط</span>
          </span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          نحتفظ بحق تعديل أو تحديث هذه الشروط عند الضرورة لمواكبة التطورات التقنية أو قوانين المتاجر. سيتم إشعار المستخدمين بأي تغييرات جوهرية داخل التطبيق، واستمرارك في الاستخدام يعني موافقتك على هذه التحديثات.
        </p>
      </section>
    </div>
  );
};

export default TermsOfUse;
