import React from 'react';
import { AchievementsMilestoneTracker } from '../components/AchievementsMilestoneTracker';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useRouter } from '../services/router';

export const CertificatePreviewPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 md:p-8 flex flex-col items-center" dir="rtl">
      {/* Header */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للتطبيق</span>
        </button>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
          <Sparkles className="w-4 h-4" />
          <span>تطبيق متين لعلوم القرآن الكريم</span>
        </div>
      </div>

      {/* لوحة تتبع الإنجازات والأوسمة */}
      <div className="w-full max-w-5xl">
        <AchievementsMilestoneTracker />
      </div>
    </div>
  );
};

export default CertificatePreviewPage;
