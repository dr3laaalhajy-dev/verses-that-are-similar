import React from 'react';
import { motion } from 'framer-motion';
import {
  Gamepad2, Play, Trophy, Star, CheckCircle2, Moon, Flame, Zap, ArrowLeft
} from 'lucide-react';
import { View } from '../types/challenges';
import Dashboard from '../components/Dashboard';
import { DailyChallengeEmblem, VideoLibraryIcon } from '../components/IslamicChallengeEmblems';
import { GooglePlayButton } from '../components/GooglePlayTesterModal';

export interface HomePageProps {
  activeRunningRoom: any;
  handleResumeActiveRoom: (room: any) => void;
  playerName: string | null;
  isElite: boolean;
  isNameDecorated: boolean;
  currentStyle: any;
  motivationalQuote: string | null;
  streak: number;
  cups: number;
  totalPoints: number;
  completedChallengeIds: Set<any>;
  setIsOccasionsModalOpen: (open: boolean) => void;
  nearestOccasion: any;
  lastPlayedDate: string | null;
  dailyCompleted: boolean;
  setView: (view: View) => void;
  streakInfo: any;
  handleStartDaily: () => void;
  systemSettings: {
    hideIslamicVideos?: boolean;
    [key: string]: any;
  };
  isNativeApp: boolean;
  testerStatus: any;
  setShowGooglePlayModal: (show: boolean) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  activeRunningRoom,
  handleResumeActiveRoom,
  playerName,
  isElite,
  isNameDecorated,
  currentStyle,
  motivationalQuote,
  streak,
  cups,
  totalPoints,
  completedChallengeIds,
  setIsOccasionsModalOpen,
  nearestOccasion,
  lastPlayedDate,
  dailyCompleted,
  setView,
  streakInfo,
  handleStartDaily,
  systemSettings,
  isNativeApp,
  testerStatus,
  setShowGooglePlayModal
}) => {
  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col gap-6 md:gap-10 max-w-6xl mx-auto py-6 md:py-10 px-4 overflow-visible pb-36 sm:pb-48"
    >
      {/* Active Running Room Banner */}
      {activeRunningRoom && (
        <motion.div
          initial={{ opacity: 0, y: -15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="p-4 md:p-5 rounded-3xl bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 text-white shadow-xl shadow-orange-500/25 border-2 border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-right"
        >
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
              <Gamepad2 className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] md:text-xs bg-white/25 px-2.5 py-0.5 rounded-full font-black text-white inline-block">
                  {activeRunningRoom.status === 'WAITING' ? 'غرفتك قيد الانتظار 👑' : 'تحدي جاري الآن ⚡'}
                </span>
                <span className="text-[10px] md:text-xs opacity-90 font-bold">
                  {activeRunningRoom.status === 'WAITING'
                    ? 'أنت منشئ الغرفة'
                    : (activeRunningRoom.transitionMode === 'ASYNC' ? 'سباق فردي سريع' : 'متزامن')}
                </span>
              </div>
              <h3 className="text-sm md:text-base font-black text-white mt-1">
                {activeRunningRoom.name || 'غرفة التحدي الجماعي'}
              </h3>
              <p className="text-[11px] text-orange-100 font-bold">
                {activeRunningRoom.status === 'WAITING'
                  ? 'أنشأت هذه الغرفة وما زالت بانتظار المتسابقين، يمكنك إدارتها وبدء التحدي!'
                  : 'لديك تحدي قيد التشغيل لم يكتمل بعد!'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleResumeActiveRoom(activeRunningRoom)}
            className="w-full sm:w-auto px-6 py-3 bg-white text-orange-700 hover:bg-orange-50 active:scale-95 rounded-2xl font-black text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{activeRunningRoom.status === 'WAITING' ? 'دخول قاعة الانتظار (المضيف) 👑' : 'إكمال التحدي / العودة للغرفة'}</span>
          </button>
        </motion.div>
      )}

      {/* Premium Welcome Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center text-center space-y-4 mb-4"
      >
        <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">
          السلام عليكم يا <span className={`underline decoration-brand-gold/30 decoration-4 underline-offset-8 transition-all ${isElite && isNameDecorated && currentStyle ? `text-transparent bg-clip-text bg-gradient-to-r ${currentStyle.textColor}` : 'text-brand-emerald'}`}>{playerName || 'يا ضيفنا الكريم'}</span>
        </h1>

        {/* Motivational Quote / Hadith */}
        {motivationalQuote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="max-w-3xl mx-auto px-4 py-2 text-center"
          >
            <h3 className="font-uthmani text-lg md:text-2xl lg:text-3xl text-emerald-950 font-bold leading-relaxed" dir="rtl">
              "{motivationalQuote}"
            </h3>
          </motion.div>
        )}

        <div className="h-1 w-20 bg-brand-gold/30 rounded-full mx-auto mt-2" />
      </motion.div>

      {/* Top Interactive Hub: Prayer Times & 2x2 Stats Grid Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch px-1">
        {/* Prayer Times Box (Compact & Balanced) */}
        <div className="lg:col-span-6 flex flex-col">
          <Dashboard streakCount={streak} />
        </div>

        {/* 2x2 Stats Grid (مربعين فوق ومربعين تحت) */}
        <div className="lg:col-span-6 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 h-full">
            {/* 1. إجمالي الكؤوس */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 shadow-xs hover:border-amber-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">إجمالي الكؤوس</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div className="mt-3 text-right">
                <span className="text-2xl sm:text-3xl font-black text-slate-800 tabular-nums leading-tight block">{cups}</span>
                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">الأوسمة والبطولات</span>
              </div>
            </div>

            {/* 2. نقاط المهارة */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">نقاط المهارة</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                </div>
              </div>
              <div className="mt-3 text-right">
                <span className="text-2xl sm:text-3xl font-black text-slate-800 tabular-nums leading-tight block">{totalPoints}</span>
                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">رصيد الخبرة</span>
              </div>
            </div>

            {/* 3. التقدم الكلي */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 shadow-xs hover:border-teal-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">التقدم الكلي</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                </div>
              </div>
              <div className="mt-3 text-right">
                <span className="text-2xl sm:text-3xl font-black text-slate-800 tabular-nums leading-tight block">{completedChallengeIds.size}</span>
                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">تحدياً مكتملاً</span>
              </div>
            </div>

            {/* 4. مواسم الطاعات وسنن الأيام */}
            <button
              onClick={() => setIsOccasionsModalOpen(true)}
              className="bg-white p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 shadow-xs hover:border-amber-300 hover:shadow-md transition-all duration-200 text-right group cursor-pointer"
              title="انقر لاستعراض أقرب مواسم الطاعات وسُنن الأيام والأحاديث الواردة فيها"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">
                  مواسم الطاعات
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Moon className="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>
              </div>
              <div className="mt-2 text-right">
                <span className="text-sm sm:text-base font-black text-slate-800 leading-tight block truncate group-hover:text-amber-700 transition-colors">
                  {nearestOccasion?.title}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200/60 font-bold px-1.5 py-0.2 rounded-md shrink-0">
                    {nearestOccasion?.timingBadge}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold truncate">
                    {nearestOccasion?.hijriDateText}
                  </span>
                </div>
                <span className="text-[10px] text-amber-600 font-bold block mt-1 group-hover:underline">
                  استعراض السُنن والأحاديث 🌙
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Subtitle / Last Played Date info */}
      <div className="flex items-center justify-between px-3 -mt-2 text-xs text-slate-400 font-medium">
        <span>آخر نشاط: <strong className="text-slate-600 font-bold">{lastPlayedDate ? (lastPlayedDate === new Date().toISOString().split('T')[0] ? 'اليوم' : lastPlayedDate) : 'لم يبدأ بعد'}</strong></span>
        <span className="text-[11px] text-emerald-700/80 font-bold hidden sm:inline">انقر على شعلة الزاوية لمعرفة نظام الـ 24 ساعة ومهلة الإنقاذ 🔥</span>
      </div>

      {/* Daily Challenge Card on Home */}
      <div className="px-1">
        {dailyCompleted ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-slate-800 text-sm sm:text-base">تم إنجاز التحدي اليومي بنجاح!</h4>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-bold px-2 py-0.5 rounded-full">مكتمل</span>
                </div>
                <p className="text-xs text-slate-400 font-bold mt-0.5">شعلتك مشتعلة بأمان حتى الغد. استمر في تعاهد كتاب الله.</p>
              </div>
            </div>
            <button
              onClick={() => setView('challenges')}
              className="px-4 py-2 bg-slate-50 hover:bg-emerald-50 text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95 shrink-0"
            >
              استكشف التحديات الأخرى
            </button>
          </div>
        ) : streakInfo?.status === 'warning' ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-amber-500/10 border-2 border-amber-400 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Flame className="w-5 h-5 text-amber-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                    مهلة إنقاذ الشعلة: متبقي {streakInfo?.timeLeftFormatted}
                  </span>
                </div>
                <h4 className="font-black text-amber-950 text-sm sm:text-base mt-1">
                  شعلتك انطفأت مؤقتاً! أنقذ سلسلتك الآن
                </h4>
                <p className="text-xs text-amber-900/80 font-bold mt-0.5">
                  أكمل التحدي اليومي قبل انتهاء المهلة لتعود الشعلة للاشتعال فوراً ولا تفقد تقدمك!
                </p>
              </div>
            </div>
            <button
              onClick={handleStartDaily}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 shrink-0"
            >
              <Zap className="w-4 h-4 text-amber-200" />
              <span>أنقذ الشعلة الآن 🔥</span>
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-150 hover:border-emerald-400 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 text-right group">
            <div className="flex items-center gap-3.5">
              <DailyChallengeEmblem className="w-11 h-11 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-black text-slate-800 text-base group-hover:text-brand-emerald transition-colors">
                    التحدي اليومي: إكمال الآية
                  </h4>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-black px-2 py-0.5 rounded-full">
                    تحدي اليوم
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-bold leading-relaxed">
                  أكمل الآية الكريمة، وحافظ على اشتعال شعلتك اليومية واكسب نقاط المهارة القرآنية
                </p>
              </div>
            </div>
            <button
              onClick={handleStartDaily}
              className="w-full sm:w-auto px-5 py-2.5 bg-brand-emerald hover:bg-[#033628] text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <span>ابدأ التحدي اليومي</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Islamic Videos Quick Entry on Home */}
      {!systemSettings.hideIslamicVideos && (
        <div className="px-1 mt-1">
          <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setView('islamic_videos')}
            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0D6E52] via-[#0A5640] to-[#043325] text-white shadow-md hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#D4AF37]/30"
          >
            {/* Geometric Pattern Overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-5 mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30zM30 6.863L53.137 30 30 53.137 6.863 30zM30 15l15 15-15 15-15-15z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                backgroundSize: '40px 40px'
              }}
            />

            <div className="flex items-center gap-3.5 relative z-10 w-full sm:w-auto">
              <VideoLibraryIcon className="w-12 h-12 shrink-0 drop-shadow-md" />
              <div className="text-right">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-black text-white text-base">
                    المكتبة المرئية الإسلامية
                  </h4>
                  <span className="text-[10px] bg-[#D4AF37] text-[#0A5640] font-black px-2 py-0.5 rounded-full shadow-xs">
                    جديد
                  </span>
                </div>
                <p className="text-xs text-emerald-100/90 font-semibold leading-relaxed">
                  روائع المقاطع الدعوية، شروحات الحديث، الفقه، والتفسير لكبار العلماء
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 relative z-10 self-end sm:self-center shrink-0">
              <span className="px-4 py-2 bg-white/15 hover:bg-white/25 text-[#FCEEB5] border border-white/20 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 backdrop-blur-md">
                <span>استعراض المرئيات</span>
                <ArrowLeft className="w-3.5 h-3.5 text-[#D4AF37]" />
              </span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Google Play Tester Button at the bottom (Web Version Only) */}
      {!isNativeApp && (
        <div className="px-1 mt-4 flex items-center justify-center">
          <GooglePlayButton
            status={testerStatus}
            onClick={() => setShowGooglePlayModal(true)}
          />
        </div>
      )}
    </motion.div>
  );
};

export default HomePage;
