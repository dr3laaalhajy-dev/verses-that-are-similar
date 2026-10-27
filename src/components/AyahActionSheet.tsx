import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Play,
  Pause,
  ExternalLink,
  ChevronRight,
  BookMarked,
  Info,
} from 'lucide-react';
import {
  getSurahName,
  getAyahText,
  getAyahTafseer,
  findSimilarAyahs,
  getAyahAudioUrl,
  RECITERS,
  SimilarAyah,
} from '../services/AyahSelectionService';
import { getPageNumber } from '../services/PageRepository';
import { renderQuranText } from '../utils/quranUtils';

interface AyahActionSheetProps {
  selectedAyah: { surah: number; ayah: number };
  onClose: () => void;
  onNavigateToPage?: (page: number) => void;
  onOpenEncyclopedia?: (surah: number, ayah: number) => void;
  darkMode: boolean;
}

type TabType = 'tafseer' | 'mutashabihat' | 'audio';

export const AyahActionSheet: React.FC<AyahActionSheetProps> = ({
  selectedAyah,
  onClose,
  onNavigateToPage,
  onOpenEncyclopedia,
  darkMode,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('tafseer');
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [selectedReciter, setSelectedReciter] = useState('alafasy');
  const [audioProgress, setAudioProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { surah, ayah } = selectedAyah;
  const surahName = getSurahName(surah);
  const ayahText = getAyahText(surah, ayah);
  const tafseerText = getAyahTafseer(surah, ayah);
  const pageNumber = getPageNumber(surah, ayah);
  const [similarAyahs, setSimilarAyahs] = useState<SimilarAyah[]>([]);

  // Calculate approximate Juz (1-30) based on page number
  const juzNumber = Math.min(30, Math.max(1, Math.ceil(pageNumber / 20)));

  // Load similar ayahs
  useEffect(() => {
    const list = findSimilarAyahs(surah, ayah);
    setSimilarAyahs(list);
  }, [surah, ayah]);

  // Audio cleanup & reset on ayah or reciter change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsPlaying(false);
      setAudioProgress(0);
      setAudioError(false);
    }
  }, [surah, ayah, selectedReciter]);

  const toggleAudio = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setAudioLoading(true);
    setAudioError(false);

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setAudioProgress(0);
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current && audioRef.current.duration) {
          setAudioProgress(
            (audioRef.current.currentTime / audioRef.current.duration) * 100
          );
        }
      };
      audioRef.current.onerror = () => {
        setAudioLoading(false);
        setIsPlaying(false);
        setAudioError(true);
      };
    }

    const audioUrl = getAyahAudioUrl(surah, ayah, selectedReciter);
    audioRef.current.src = audioUrl;

    audioRef.current
      .play()
      .then(() => {
        setAudioLoading(false);
        setIsPlaying(true);
      })
      .catch(() => {
        setAudioLoading(false);
        setIsPlaying(false);
        setAudioError(true);
      });
  };

  const handleCopy = () => {
    const textToCopy = `﴿ ${ayahText} ﴾\n[${surahName}: ${ayah}]`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`fixed bottom-0 left-0 right-0 z-[999] rounded-t-3xl border-t shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom max-h-[85vh] flex flex-col ${
        darkMode
          ? 'bg-slate-900/98 text-slate-100 border-emerald-500/30'
          : 'bg-white/98 text-slate-800 border-emerald-200'
      } backdrop-blur-2xl`}
      style={{ direction: 'rtl' }}
    >
      {/* Drag handle / top bar */}
      <div className="flex items-center justify-between px-5 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-600/20">
            {ayah}
          </div>
          <div>
            <h3 className="text-base font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <span>{surahName}</span>
              <span className="text-xs font-normal opacity-60">• الآية {ayah}</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
              الجزء {juzNumber} • الصفحة {pageNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Copy Button */}
          <button
            onClick={handleCopy}
            className={`p-2 rounded-xl transition-all active:scale-95 text-xs flex items-center gap-1 font-bold ${
              copied
                ? 'bg-emerald-600 text-white'
                : darkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="نسخ نص الآية"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-all active:scale-95 ${
              darkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected Ayah Text Card */}
      <div className="px-5 py-2.5">
        <div
          className={`p-3.5 rounded-2xl border text-center relative ${
            darkMode
              ? 'bg-slate-800/80 border-slate-700/60 shadow-inner'
              : 'bg-emerald-50/60 border-emerald-100/80 shadow-inner'
          }`}
        >
          <div className="font-quran text-lg sm:text-xl leading-relaxed text-slate-900 dark:text-slate-50 select-text">
            {renderQuranText(ayahText)}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="px-5 pt-1 pb-2 flex items-center gap-2 border-b border-slate-200/50 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('tafseer')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all ${
            activeTab === 'tafseer'
              ? 'bg-emerald-600 text-white shadow-md'
              : darkMode
              ? 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>التفسير الميسر</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-emerald-200 font-bold">
            أوفلاين
          </span>
        </button>

        <button
          onClick={() => setActiveTab('mutashabihat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all ${
            activeTab === 'mutashabihat'
              ? 'bg-emerald-600 text-white shadow-md'
              : darkMode
              ? 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>المتشابهات</span>
          {similarAyahs.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 font-bold">
              {similarAyahs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audio')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all ${
            activeTab === 'audio'
              ? 'bg-emerald-600 text-white shadow-md'
              : darkMode
              ? 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>استماع</span>
        </button>
      </div>

      {/* Tab Content Body (Scrollable) */}
      <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3.5 min-h-[140px] max-h-[42vh]">
        {/* TAB 1: Tafsir Al-Muyassar (100% Offline) */}
        {activeTab === 'tafseer' && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                <span>التفسير الميسر (مجمع الملك فهد)</span>
              </span>
              <span className="text-[10px] opacity-75 font-normal">يعمل بدون إنترنت</span>
            </div>
            <p className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300 select-text p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/60">
              {tafseerText}
            </p>
          </div>
        )}

        {/* TAB 2: Mutashabihat (Similar Verses) */}
        {activeTab === 'mutashabihat' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                {similarAyahs.length > 0
                  ? `وُجدت (${similarAyahs.length}) آيات متشابهة في أوائل الآيات:`
                  : 'لا توجد آيات أخرى تبدأ بنفس البداية اللفظية.'}
              </span>

              {onOpenEncyclopedia && (
                <button
                  onClick={() => onOpenEncyclopedia(surah, ayah)}
                  className="flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <span>موسوعة المتشابهات</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {similarAyahs.length > 0 ? (
              <div className="space-y-2">
                {similarAyahs.map((sim, idx) => (
                  <div
                    key={`${sim.surahNumber}_${sim.ayahNumber}_${idx}`}
                    className={`p-3 rounded-xl border transition-all ${
                      darkMode
                        ? 'bg-slate-800/60 border-slate-700/60 hover:border-emerald-500/40'
                        : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                        {sim.surahName} • الآية {sim.ayahNumber}
                      </span>
                      {onNavigateToPage && (
                        <button
                          onClick={() => {
                            onNavigateToPage(sim.page);
                            onClose();
                          }}
                          className="flex items-center gap-0.5 text-[11px] font-bold text-brand-gold hover:underline"
                        >
                          <span>انتقال لصفحة {sim.page}</span>
                          <ChevronRight className="w-3 h-3 rotate-180" />
                        </button>
                      )}
                    </div>
                    <p className="font-quran text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      {renderQuranText(sim.text)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                <BookMarked className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p>هذه الآية فريدة في بدايتها اللفظية ولم تُسجل لها متشابهات في أوائل الآيات.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Audio Recitation */}
        {activeTab === 'audio' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Reciter Selector */}
            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">
                اختر القارئ:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {RECITERS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReciter(r.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-black border text-right transition-all ${
                      selectedReciter === r.id
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : darkMode
                        ? 'border-slate-800 bg-slate-800/50 text-slate-400'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Playback Controls */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex-1">
                <p className="text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  تلاوة الآية {ayah} من {surahName}
                </p>
                {/* Progress Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-150"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
              </div>

              <button
                onClick={toggleAudio}
                disabled={audioLoading}
                className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-lg transition-all"
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {audioLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
            </div>

            {audioError && (
              <p className="text-xs text-rose-500 text-center font-bold">
                تعذر تشغيل الصوت. تأكد من توفر اتصال بالإنترنت للاستماع للتلاوة.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AyahActionSheet;
