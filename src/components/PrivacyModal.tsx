import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, FileText, X, ExternalLink, Check, HeartHandshake } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms';
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-md overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl md:rounded-[2.5rem] max-w-xl w-full shadow-2xl relative overflow-hidden border border-emerald-100 flex flex-col max-h-[88vh] my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-5 sm:p-6 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <ShieldCheck className="w-6 h-6 text-brand-gold" />
              </div>
              <div className="text-right">
                <h3 className="text-lg sm:text-xl font-black">
                  {activeTab === 'privacy' ? 'سياسة الخصوصية' : 'شروط وأحكام الاستخدام'}
                </h3>
                <p className="text-xs text-emerald-100 font-semibold mt-0.5">
                  تطبيق متين - رفيقك في ضبط المتشابهات القرآنية
                </p>
              </div>
            </div>

            {/* Tab switch */}
            <div className="grid grid-cols-2 gap-2 mt-4 bg-black/20 p-1.5 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('privacy')}
                className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'privacy'
                    ? 'bg-white text-emerald-900 shadow-md scale-[1.02]'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>سياسة الخصوصية</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'terms'
                    ? 'bg-white text-emerald-900 shadow-md scale-[1.02]'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>شروط الاستخدام</span>
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-5 sm:p-7 overflow-y-auto space-y-4 text-right text-xs sm:text-sm text-slate-600 leading-relaxed custom-scrollbar">
            {activeTab === 'privacy' ? (
              <>
                <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-slate-700">
                  <p className="font-bold">
                    نحن في تطبيق <strong>متين</strong> نلتزم بأعلى معايير حماية الخصوصية واحترام أمان بيانات المستخدمين وفقاً لمعايير Google Play المعتمدة.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 text-brand-emerald">
                    <span className="w-2 h-2 rounded-full bg-brand-emerald"></span>
                    <span>ما نجمعه من بيانات:</span>
                  </h4>
                  <ul className="list-disc list-inside space-y-1.5 pr-2 font-medium">
                    <li><strong>الاسم واسم المستخدم:</strong> لحفظ حسابك وسجل إنجازاتك ونقاطك وعرض ترتيبك في لوحة الشرف وإصدار الشهادات.</li>
                    <li><strong>كلمة المرور:</strong> مشفرة لحماية حسابك وتمكينك من المتابعة من أجهزتك المختلفة.</li>
                    <li><strong>إحصائيات الإنجاز:</strong> النقاط، الكؤوس، التحديات المكتملة، وتاريخ الإنجاز.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 text-brand-emerald">
                    <span className="w-2 h-2 rounded-full bg-brand-emerald"></span>
                    <span>ما لا نطلبه أبداً:</span>
                  </h4>
                  <p className="font-medium text-slate-600 pr-2">
                    التطبيق <strong>لا يطلب ولا يصل</strong> إلى موقعك الجغرافي (GPS)، ولا جهات اتصالك، ولا كاميرا أو ميكروفون، ولا أي معلومات بنكية أو بطاقات دفع.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 text-brand-emerald">
                    <span className="w-2 h-2 rounded-full bg-brand-emerald"></span>
                    <span>عدم مشاركة البيانات والإعلانات:</span>
                  </h4>
                  <p className="font-medium text-slate-600 pr-2">
                    التطبيق <strong>خالٍ تماماً من الإعلانات</strong>، ولا نشارك أو نبيع أي بيانات لأي طرف ثالث لأغراض تسويقية أو تجارية على الإطلاق.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 text-brand-emerald">
                    <span className="w-2 h-2 rounded-full bg-brand-emerald"></span>
                    <span>حذف الحساب والبيانات:</span>
                  </h4>
                  <p className="font-medium text-slate-600 pr-2">
                    يحق لك طلب حذف حسابك وبياناتك نهائياً في أي وقت عبر التواصل معنا على البريد: 
                    <a href="mailto:dr3laaalhajy@gmail.com" className="text-brand-emerald font-bold underline mr-1" dir="ltr">
                      dr3laaalhajy@gmail.com
                    </a>
                    وسيتم حذفها بالكامل خلال 48 ساعة.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-100 text-slate-700">
                  <p className="font-bold flex items-center gap-2 text-amber-900">
                    <HeartHandshake className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>تطبيق متين صدقة جارية لخدمة كتاب الله تعالى، واستخدامك له يعني موافقتك على الشروط التالية:</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 text-brand-emerald">
                    <span className="w-2 h-2 rounded-full bg-brand-emerald"></span>
                    <span>احترام حرمة القرآن الكريم:</span>
                  </h4>
                  <p className="font-medium text-slate-600 pr-2">
                    يجب التعامل مع نصوص وآيات القرآن الكريم بوقار وتدبر، وعدم استخدام التطبيق في أي سياق لا يليق بكتاب الله.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 text-brand-emerald">
                    <span className="w-2 h-2 rounded-full bg-brand-emerald"></span>
                    <span>الأسماء اللائقة واللعب النزيه:</span>
                  </h4>
                  <ul className="list-disc list-inside space-y-1.5 pr-2 font-medium">
                    <li>يُمنع اختيار أسماء مستخدمين غير لائقة أو تحمل إساءات دينية أو أخلاقية.</li>
                    <li>يُحظر استخدام أي برامج غير مشروعة للتلاعب بنتائج التحديات الفردية أو الجماعية.</li>
                    <li>يحق لإدارة التطبيق حظر أي حساب يخالف هذه الشروط فوراً وبدون إشعار مسبق.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 text-brand-emerald">
                    <span className="w-2 h-2 rounded-full bg-brand-emerald"></span>
                    <span>الملكية الفكرية والخدمة:</span>
                  </h4>
                  <p className="font-medium text-slate-600 pr-2">
                    كافة محتويات التطبيق وقواعد بيانات المتشابهات تم إعدادها بعناية، وتتاح مجاناً كوقف رقمي لنفع أمة القرآن الكريم.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-slate-500 hover:text-brand-emerald flex items-center gap-1.5 transition-colors order-2 sm:order-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح الصفحة الكاملة (للمتصفح / Google Play)</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-emerald text-white rounded-xl font-black text-xs sm:text-sm shadow-md hover:bg-brand-emerald/90 transition-all active:scale-95 flex items-center justify-center gap-2 order-1 sm:order-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>فهمت وموافق</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PrivacyModal;
