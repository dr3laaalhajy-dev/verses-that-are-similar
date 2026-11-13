import React from 'react';
import {
  ShieldCheck,
  User,
  Mic,
  Bell,
  Ban,
  CheckCircle2,
  Server,
  Trash2,
  Lock,
  HeartHandshake,
  Mail,
  Sparkles,
} from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="space-y-6 text-right text-slate-700 leading-relaxed" dir="rtl">
      {/* Title & Introduction Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/60 rounded-2xl border border-emerald-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 text-brand-emerald mb-2">
          <Sparkles className="w-5 h-5" />
          <h3 className="text-base sm:text-lg font-black text-emerald-950">
            سياسة خصوصية تطبيق متين (Mateen)
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
            معتمد من Google Play
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-xs">
            خالٍ تماماً من الإعلانات
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-700 text-white shadow-xs">
            تشفير سحابي متقدم
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
          نحن نحترم خصوصيتكم التامة ونلتزم بأعلى معايير حماية البيانات الشخصية وفقاً لسياسات Google Play الرسمية ومعايير حماية الخصوصية العالمية.
        </p>
      </div>

      {/* ١. مقدمة ونبذة عن التطبيق */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-2.5">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ١
          </span>
          <span>مقدمة ونبذة عن التطبيق</span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          أهلاً بكم في تطبيق <strong className="text-slate-900">"متين"</strong> المخصص لضبط وإتقان المتشابهات القرآنية، تلاوة القرآن الكريم، واختبارات السيرة النبوية والعلوم الإسلامية. نحن نحترم خصوصيتكم التامة ونلتزم بأعلى معايير حماية البيانات الشخصية وفقاً لسياسات (Google Play).
        </p>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          تم تطوير هذا التطبيق كعمل دعوي وتعليمي هادف بواسطة <strong className="text-slate-900">د. علاء الدين الحجي</strong>، وهو مجاني بالكامل وخالٍ تماماً من أي إعلانات تجارية.
        </p>
      </section>

      {/* ٢. المعلومات والبيانات التي نجمعها */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٢
          </span>
          <span>المعلومات والبيانات التي نجمعها</span>
        </h4>
        <div className="space-y-2.5 pr-1">
          <div className="flex items-start gap-2.5">
            <User className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">الاسم واسم المستخدم:</strong> لحفظ حسابك، سجل إنجازاتك، نقاطك، والتنافس الشريف في لوحة المتصدرين.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">كلمة المرور:</strong> مشفرة بالكامل لحماية حسابك وتمكينك من تسجيل الدخول والمتابعة من أجهزتك المختلفة.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">بيانات التحديات والإنجازات:</strong> عدد النقاط، الكؤوس المكتسبة، الاختبارات المكتملة، وشهادات الإنجاز الصادرة باسمك.
            </p>
          </div>
        </div>
      </section>

      {/* ٣. أذونات الجهاز المطلوبة */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٣
          </span>
          <span>أذونات الجهاز المطلوبة</span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 font-medium">
          لتقديم أفضل تجربة للمستخدم، قد يطلب التطبيق الأذونات التالية وقت الحاجة فقط:
        </p>
        <div className="space-y-2.5 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
          <div className="flex items-start gap-2.5">
            <Mic className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              <strong className="text-emerald-950">الميكروفون (Microphone):</strong> يُطلب بشكل اختياري فقط عند خوض "التحدي الصوتي" لمطابقة تلاوتك للآيات الكريمة عبر تقنية التعرف على الكلام (Speech-to-Text). تتم معالجة الصوت لحظياً ومحلياً، ولا يتم تسجيله، أو تخزينه، أو إرساله إلى أي خوادم خارجية أبداً.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <Bell className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              <strong className="text-emerald-950">الإشعارات (Notifications):</strong> يُطلب هذا الإذن لتذكيرك بالورد القرآني، وتنبيهك بالتحديات الجديدة، ودعوات غرف التنافس الجماعي، ومتابعة تقدمك التعليمي.
            </p>
          </div>
        </div>
      </section>

      {/* ٤. ما لا نطلبه ولا نصل إليه مطلقاً */}
      <section className="bg-amber-50/60 rounded-2xl p-4 sm:p-5 border border-amber-200/80 shadow-xs space-y-2">
        <h4 className="font-black text-sm sm:text-base text-amber-950 flex items-center gap-2 border-b border-amber-200/60 pb-2">
          <span className="w-7 h-7 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-black text-xs shrink-0">
            ٤
          </span>
          <span className="flex items-center gap-1.5">
            <Ban className="w-4 h-4 text-amber-700 inline" />
            <span>ما لا نطلبه ولا نصل إليه مطلقاً</span>
          </span>
        </h4>
        <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
          التطبيق آمن تماماً؛ فنحن لا نطلب ولا نصل بأي شكل من الأشكال إلى موقعك الجغرافي (GPS)، الكاميرا، جهات الاتصال، الصور والملفات الشخصية، أو أي بيانات مالية وبنكية.
        </p>
      </section>

      {/* ٥. كيف نستخدم المعلومات؟ */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٥
          </span>
          <span>كيف نستخدم المعلومات؟</span>
        </h4>
        <ul className="space-y-2 pr-1 text-xs sm:text-sm text-slate-600 font-medium">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تمكين المستخدم من متابعة تقدمه ومستويات حفظه في مصحفه الإلكتروني.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>مزامنة النتائج وعرض قائمة المتصدرين في التحديات الفردية والجماعية.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>إصدار شهادات الإنجاز في مسابقات السيرة والقرآن الكريم.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تحسين أداء واستقرار التطبيق التقني وحل أي أعطال.</span>
          </li>
        </ul>
      </section>

      {/* ٦. مشاركة البيانات والإعلانات */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٦
          </span>
          <span>مشاركة البيانات والإعلانات</span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          التطبيق خالٍ تماماً من الإعلانات. نحن لا نبيع، أو نؤجر، أو نشارك بيانات المستخدمين مع أي أطراف ثالثة أو جهات تسويقية على الإطلاق.
        </p>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          تتم معالجة البيانات فقط عبر بنية تحتية سحابية مشفرة وموثوقة عالمياً لضمان عمل التطبيق:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
            <Server className="w-4 h-4 text-brand-emerald shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs sm:text-sm text-slate-900">Vercel Cloud</p>
              <p className="text-[11px] sm:text-xs text-slate-500">لاستضافة الخوادم بواجهات آمنة (HTTPS/SSL).</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
            <Server className="w-4 h-4 text-brand-emerald shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs sm:text-sm text-slate-900">Supabase PostgreSQL</p>
              <p className="text-[11px] sm:text-xs text-slate-500">كقاعدة بيانات مشفرة وآمنة وفقاً لمعايير الأمان العالمية.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ٧. حذف الحساب والبيانات */}
      <section className="bg-rose-50/50 rounded-2xl p-4 sm:p-5 border border-rose-200/80 shadow-xs space-y-2.5">
        <h4 className="font-black text-sm sm:text-base text-rose-950 flex items-center gap-2 border-b border-rose-200/60 pb-2">
          <span className="w-7 h-7 rounded-xl bg-rose-200 text-rose-900 flex items-center justify-center font-black text-xs shrink-0">
            ٧
          </span>
          <span className="flex items-center gap-1.5">
            <Trash2 className="w-4 h-4 text-rose-600 inline" />
            <span>حذف الحساب والبيانات</span>
          </span>
        </h4>
        <p className="text-xs sm:text-sm text-rose-950 leading-relaxed font-medium">
          يحق لك التحكم الكامل في بياناتك. يوفر التطبيق ميزة "حذف الحساب" مباشرة من داخل إعدادات التطبيق. عند طلبك حذف الحساب، يقوم النظام فوراً وبشكل تلقائي بمسح كافة بياناتك، نقاطك، وإنجازاتك من قواعد بياناتنا بشكل نهائي، ولا يمكن استرجاعها.
        </p>
      </section>

      {/* ٨. أمان وحماية البيانات */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-2.5">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٨
          </span>
          <span>أمان وحماية البيانات</span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          نطبق أحدث تقنيات التشفير لضمان سرية البيانات أثناء النقل عبر بروتوكول (HTTPS / TLS) وأثناء التخزين، ونبذل قصارى جهدنا لمنع أي وصول غير مصرح به.
        </p>
      </section>

      {/* ٩. خصوصية الأطفال وسياسة العائلة */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-2.5">
        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2 text-brand-emerald border-b border-emerald-50 pb-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-brand-emerald flex items-center justify-center font-black text-xs shrink-0">
            ٩
          </span>
          <span className="flex items-center gap-1.5">
            <HeartHandshake className="w-4 h-4 text-emerald-600 inline" />
            <span>خصوصية الأطفال وسياسة العائلة</span>
          </span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          تطبيق "متين" موجه لجميع أفراد الأسرة ولجميع الفئات العمرية. التطبيق لا يحتوي على أي محتوى غير لائق أو إعلانات، ويتوافق تماماً مع إرشادات عائلات (Google Play) وقانون حماية خصوصية الأطفال على الإنترنت (COPPA).
        </p>
      </section>

      {/* ١٠. التواصل مع المطور */}
      <section className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-md space-y-3.5">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
          <span className="w-7 h-7 rounded-xl bg-white/20 text-emerald-300 flex items-center justify-center font-black text-xs shrink-0">
            ١٠
          </span>
          <h4 className="font-black text-sm sm:text-base text-white">التواصل مع المطور</h4>
        </div>
        <p className="text-xs sm:text-sm text-emerald-100 font-medium">
          لأي استفسارات أو ملاحظات، يمكنكم التواصل المباشر مع مطور التطبيق:
        </p>
        <div className="space-y-1.5 bg-white/10 p-3.5 rounded-xl border border-white/15 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-gold shrink-0" />
            <span>البريد الإلكتروني: </span>
            <a
              href="mailto:dr3laaalhajy@gmail.com"
              className="text-brand-gold font-bold underline hover:text-amber-300 transition-colors"
              dir="ltr"
            >
              dr3laaalhajy@gmail.com
            </a>
          </div>
          <p className="text-emerald-100">
            <strong className="text-white">المطور:</strong> د. علاء الدين الحجي
          </p>
          <p className="text-emerald-100">
            <strong className="text-white">فكرة:</strong> عمر سمير طبش
          </p>
        </div>
        <p className="text-[11px] sm:text-xs text-emerald-200/80 text-center pt-1 font-semibold">
          جميع الحقوق محفوظة © تطبيق متين للقرآن الكريم (صدقة جارية).
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
