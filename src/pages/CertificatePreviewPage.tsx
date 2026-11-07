import React, { useState } from 'react';
import { ChallengeCertificate } from '../components/ChallengeCertificate';
import { Award, Sparkles, ArrowRight } from 'lucide-react';
import { useRouter } from '../services/router';

export const CertificatePreviewPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const router = useRouter();

  const challengesList = [
    {
      id: 'complete',
      name: 'إتمام 100 سؤال في تحدي إكمال الآية الكريمة',
      score: '100%',
      rank: 'حافظ متقن',
      surahOrJuz: 'كامل القرآن الكريم'
    },
    {
      id: 'figh',
      name: 'ختم مسابقة الفقه والمعلومات الإسلامية',
      score: '100%',
      rank: 'فقيه متقن',
      surahOrJuz: 'قسم العبادات والمعاملات'
    },
    {
      id: 'surah',
      name: 'إتمام 50 سؤالاً في تحدي تحديد اسم السورة',
      score: '50/50',
      rank: 'خبير المتشابهات',
      surahOrJuz: 'جزء عمّ وتبارك'
    },
    {
      id: 'seerah',
      name: 'إتمام 60 سؤالاً في تحدي السيرة النبوية الشريفة',
      score: '60/60 نقطة',
      rank: 'عالم بالسيرة النبوية',
      surahOrJuz: 'العهد النبوي والغزوات'
    },
    {
      id: 'speed',
      name: 'إحراز 1000 نقطة والمركز الأول في تحدي السرعة',
      score: '1,000 نقطة',
      rank: 'فارس السرعة والبديهة',
      surahOrJuz: 'المرحلة المتقدمة'
    },
    {
      id: 'daily',
      name: 'إتمام سلسلة 30 يوماً متتالية في التحدي اليومي',
      score: 'سلسلة 30 يوماً',
      rank: 'مواظب متميز',
      surahOrJuz: 'حفظ الورد وتثبيت الآيات'
    }
  ];

  const [selectedChallenge, setSelectedChallenge] = useState(challengesList[0]);
  const [playerName] = useState(() => localStorage.getItem('quran_user_triple_name') || localStorage.getItem('quran_player_name') || 'عبد الرحمن بن محمد الحجي');

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 flex flex-col items-center" dir="rtl">
      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm transition-all"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للتطبيق</span>
        </button>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
          <Sparkles className="w-4 h-4" />
          <span>تطبيق متين لعلوم القرآن الكريم</span>
        </div>
      </div>

      <div className="w-full max-w-4xl text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          لوحة تجربة شهادات إكمال التحديات 📜
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          اختر أحد التحديات لمعاينة الشهادة واختبار جودة الطباعة والتنزيل الفوري والمشاركة
        </p>
      </div>

      {/* شريط اختيار التحديات السريعة */}
      <div className="w-full max-w-4xl flex items-center justify-center flex-wrap gap-2 mb-6">
        {challengesList.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => setSelectedChallenge(ch)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedChallenge.id === ch.id
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>{ch.name}</span>
          </button>
        ))}
      </div>

      {/* المكون الرئيسي للشهادة */}
      <div className="w-full max-w-5xl bg-white/5 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-white/10 shadow-2xl">
        <ChallengeCertificate
          playerName={playerName}
          challengeName={selectedChallenge.name}
          score={selectedChallenge.score}
          surahOrJuz={selectedChallenge.surahOrJuz}
          showControls={true}
          allowNameEdit={true}
        />
      </div>
    </div>
  );
};

export default CertificatePreviewPage;

