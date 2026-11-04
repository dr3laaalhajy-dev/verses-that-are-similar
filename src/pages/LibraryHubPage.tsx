import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { View } from '../types/challenges';
import { Link } from '../components/common/Link';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import {
  MushafLibraryIcon,
  AdhkarLibraryIcon,
  HadithLibraryIcon,
  BookLibraryIcon,
  EncyclopediaLibraryIcon,
  VideoLibraryIcon
} from '../components/IslamicChallengeEmblems';

export interface LibraryHubPageProps {
  setView: (view: View) => void;
  setSelectedSurahId: (id: any) => void;
  setSelectedJuz: (juz: any) => void;
  setIsSearchSubmitted: (isSubmitted: boolean) => void;
  setIsPageModeActive: (isActive: boolean) => void;
  setSelectedAdhkarCategoryId: (id: any) => void;
  setSelectedHadith: (hadith: any) => void;
  systemSettings?: {
    hideIslamicVideos?: boolean;
    [key: string]: any;
  };
}

export const LibraryHubPage: React.FC<LibraryHubPageProps> = ({
  setView,
  setSelectedSurahId,
  setSelectedJuz,
  setIsSearchSubmitted,
  setIsPageModeActive,
  setSelectedAdhkarCategoryId,
  setSelectedHadith,
  systemSettings
}) => {
  return (
    <ErrorBoundary
      fallbackTitle="تعذر عرض قسم المكتبة"
      fallbackMessage="حدث خطأ غير متوقع أثناء تحميل عناصر المكتبة. يمكنك إعادة المحاولة أو الانتقال للرئيسية."
    >
      <motion.div
        key="library"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="flex flex-col gap-6 max-w-6xl mx-auto py-4 md:py-6 px-4 pb-36 sm:pb-48"
      >
        {/* Clean Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-brand-gold rounded-full" />
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-brand-emerald tracking-tight">
                المكتبة والعلوم الشرعية
              </h2>
              <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
                المصحف الشريف، الأذكار، الأحاديث، وتفاسير القرآن الكريم
              </p>
            </div>
          </div>
        </div>

        {/* Clean & Beautiful Library Grid using standard Link with absolute paths */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">

          {/* 1. Mushaf Card */}
          <Link
            href="/mushaf"
            prefetch={false}
            onClick={() => {
              setView('mushaf');
              setSelectedSurahId(null);
              setSelectedJuz(null);
              setIsSearchSubmitted(false);
              setIsPageModeActive(false);
            }}
            className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-blue-400 bg-white shadow-xs hover:shadow-md min-h-[160px] active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <MushafLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">
                  القرآن الكريم
                </span>
                <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:-translate-x-1 transition-all" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-blue-700 transition-colors">
                المصحف الشريف
              </h3>
              <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                تصفح القرآن الكريم كاملاً بالرسم العثماني المقروء
              </p>
            </div>
          </Link>

          {/* 2. Adhkar Card */}
          <Link
            href="/adhkar"
            prefetch={false}
            onClick={() => {
              setView('adhkar');
              setSelectedAdhkarCategoryId(null);
            }}
            className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-indigo-400 bg-white shadow-xs hover:shadow-md min-h-[160px] active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <AdhkarLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                  حصن المسلم
                </span>
                <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:-translate-x-1 transition-all" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-indigo-700 transition-colors">
                أذكار المسلم
              </h3>
              <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                أذكار الصباح والمساء واليوم والليلة بالأدعية الصحيحة المأثورة
              </p>
            </div>
          </Link>

          {/* 3. Hadith Card */}
          <Link
            href="/hadith"
            prefetch={false}
            onClick={() => {
              setView('hadith');
              setSelectedHadith(null);
            }}
            className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-teal-400 bg-white shadow-xs hover:shadow-md min-h-[160px] active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <HadithLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/50">
                  السنة النبوية
                </span>
                <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-teal-600 group-hover:-translate-x-1 transition-all" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-teal-700 transition-colors">
                الأربعون النووية
              </h3>
              <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                قراءة وشرح وتبسيط أحاديث الأربعين النووية الشريفة
              </p>
            </div>
          </Link>

          {/* 4. Book Card */}
          <Link
            href="/book"
            prefetch={false}
            onClick={() => setView('book')}
            className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-amber-400 bg-white shadow-xs hover:shadow-md min-h-[160px] active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <BookLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/50">
                  كتاب تعليمي
                </span>
                <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-amber-600 group-hover:-translate-x-1 transition-all" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-amber-700 transition-colors">
                كتاب المتشابهات
              </h3>
              <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                كتاب اللؤلؤ والمرجان في ضبط متشابهات القرآن الكريم
              </p>
            </div>
          </Link>

          {/* 5. Encyclopedia Card */}
          <Link
            href="/encyclopedia"
            prefetch={false}
            onClick={() => setView('encyclopedia')}
            className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-purple-400 bg-white shadow-xs hover:shadow-md min-h-[160px] active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <EncyclopediaLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/50">
                  موسوعة شاملة
                </span>
                <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-purple-600 group-hover:-translate-x-1 transition-all" />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-purple-700 transition-colors">
                الموسوعة
              </h3>
              <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                موسوعة العلوم الشرعية وتوجيه متشابهات القرآن
              </p>
            </div>
          </Link>

          {/* 6. Islamic Videos Card (المكتبة المرئية) */}
          {!systemSettings?.hideIslamicVideos && (
            <Link
              href="/islamic_videos"
              prefetch={false}
              onClick={() => setView('islamic_videos')}
              className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-[#0D6E52] bg-white shadow-xs hover:shadow-md min-h-[160px] active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <VideoLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/50">
                    مرئيات دعوية
                  </span>
                  <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-[#0D6E52] group-hover:-translate-x-1 transition-all" />
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-[#0D6E52] transition-colors">
                  المكتبة المرئية
                </h3>
                <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                  دروس وشروحات ومواعظ مرئية مبوبة لكبار العلماء والدعاة
                </p>
              </div>
            </Link>
          )}

        </div>
      </motion.div>
    </ErrorBoundary>
  );
};

export default LibraryHubPage;
