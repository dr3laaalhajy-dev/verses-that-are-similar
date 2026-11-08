import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Lock, Eye, EyeOff, Mic, CheckCircle, BookOpen, Sparkles, HelpCircle,
  Check, ArrowLeft, Settings, X, AlertTriangle, Plus, Minus, SlidersHorizontal
} from 'lucide-react';
import { View } from '../types/challenges';
import { ScopeSelector, JuzSurahSelector } from '../components/challenge/ScopeSelector';
import { useApp, ModularRoomSettings } from '../contexts/AppContext';
import { validateSurahChallengeScope, formatScopeSummary } from '../services/JuzRepository';
import { islamicCategoriesList } from '../data/islamicCategories';
import { IslamicInfoSettingsForm } from '../components/challenge/IslamicInfoSettingsForm';

export interface GroupCreatePageProps {
  mode?: 'create' | 'edit';
  initialData?: any;
  onClose?: () => void;
  onSubmitEdit?: () => void;
  isSaving?: boolean;
  v1RoomName: string;
  setV1RoomName: (name: string) => void;
  v1IsPrivate: boolean;
  setV1IsPrivate: (isPrivate: boolean) => void;
  showPasswordText: boolean;
  setShowPasswordText: (show: boolean) => void;
  v1RoomPassword: string;
  setV1RoomPassword: (pwd: string) => void;
  v1GameModes: ('audio' | 'complete' | 'surah' | 'islamic' | 'who_am_i')[];
  setV1GameModes: React.Dispatch<React.SetStateAction<('audio' | 'complete' | 'surah' | 'islamic' | 'who_am_i')[]>>;
  systemSettings: {
    hideAudioChallenge?: boolean;
    hideCompletionChallenge?: boolean;
    hideSurahChallenge?: boolean;
    [key: string]: any;
  };
  availableSkillCounts: Record<'audio' | 'complete' | 'surah', number>;
  skillQuestionCounts: Record<'audio' | 'complete' | 'surah', number>;
  setSkillQuestionCounts: React.Dispatch<React.SetStateAction<Record<'audio' | 'complete' | 'surah', number>>>;
  whoAmIQuestionCount: number;
  selectedWhoAmICategories: string[];
  setSelectedWhoAmICategories: React.Dispatch<React.SetStateAction<string[]>>;
  whoAmIAvailableCategories: { name: string; count?: number }[];
  whoAmICategoryCounts: Record<string, number>;
  setWhoAmICategoryCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  totalConfiguredQuestions: number;
  islamicRoomCategories: string[];
  islamicRoomLevels: any[];
  islamicRoomTopics: string[];
  islamicTopicQuestionCounts: Record<string, number>;
  setShowIslamicConfigModal: (show: boolean) => void;
  hasCountValidationErrors: boolean;
  v1Timer: boolean;
  setV1Timer: (timer: boolean) => void;
  v1TimePerQuestion: number;
  setV1TimePerQuestion: (time: number) => void;
  v1TransitionMode: 'SYNC' | 'ASYNC';
  setV1TransitionMode: (mode: 'SYNC' | 'ASYNC') => void;
  handleCreateV1: () => void;
  isCreatingRoom: boolean;
  setView: (view: View) => void;
  roomScopeMode?: 'juz' | 'surah';
  setRoomScopeMode?: (mode: 'juz' | 'surah') => void;
  roomSelectedJuzs?: number[];
  setRoomSelectedJuzs?: React.Dispatch<React.SetStateAction<number[]>> | ((juzs: number[] | ((prev: number[]) => number[])) => void);
  roomSelectedSurahs?: string[];
  setRoomSelectedSurahs?: React.Dispatch<React.SetStateAction<string[]>> | ((surahs: string[] | ((prev: string[]) => string[])) => void);
  roomSurahSearch?: string;
  setRoomSurahSearch?: (search: string) => void;
  roomSettings?: ModularRoomSettings;
  setRoomSettings?: React.Dispatch<React.SetStateAction<ModularRoomSettings>>;
}

export const GroupCreatePage: React.FC<GroupCreatePageProps> = ({
  mode = 'create',
  initialData,
  onClose,
  onSubmitEdit,
  isSaving = false,
  v1RoomName,
  setV1RoomName,
  v1IsPrivate,
  setV1IsPrivate,
  showPasswordText,
  setShowPasswordText,
  v1RoomPassword,
  setV1RoomPassword,
  v1GameModes,
  setV1GameModes,
  systemSettings,
  availableSkillCounts,
  skillQuestionCounts,
  setSkillQuestionCounts,
  whoAmIQuestionCount,
  selectedWhoAmICategories,
  setSelectedWhoAmICategories,
  whoAmIAvailableCategories,
  whoAmICategoryCounts,
  setWhoAmICategoryCounts,
  totalConfiguredQuestions,
  islamicRoomCategories,
  islamicRoomLevels,
  islamicRoomTopics,
  islamicTopicQuestionCounts,
  setShowIslamicConfigModal,
  hasCountValidationErrors,
  v1Timer,
  setV1Timer,
  v1TimePerQuestion,
  setV1TimePerQuestion,
  v1TransitionMode,
  setV1TransitionMode,
  handleCreateV1,
  isCreatingRoom,
  setView,
  roomScopeMode,
  setRoomScopeMode,
  roomSelectedJuzs,
  setRoomSelectedJuzs,
  roomSelectedSurahs,
  setRoomSelectedSurahs,
  roomSettings: propRoomSettings,
  setRoomSettings: propSetRoomSettings
}) => {
  const isEditMode = mode === 'edit';
  const { allChallenges, roomSettings: contextRoomSettings, setRoomSettings: contextSetRoomSettings } = useApp();

  // 1. هيكل البيانات المستقل (Modular Room Settings)
  const [roomSettings, setLocalRoomSettings] = useState<ModularRoomSettings>(() => {
    const existing = initialData?.roomSettings || initialData?.room_settings || initialData?.surahFilters?.roomSettings;
    if (existing) {
      return {
        ayahCompletion: {
          isSelected: existing.ayahCompletion?.isSelected ?? v1GameModes.includes('complete'),
          questionsCount: existing.ayahCompletion?.questionsCount ?? (skillQuestionCounts.complete || 5),
          scopeMode: existing.ayahCompletion?.scopeMode ?? roomScopeMode ?? 'juz',
          selectedJuzRange: existing.ayahCompletion?.selectedJuzRange ?? roomSelectedJuzs ?? [],
          selectedSurahs: existing.ayahCompletion?.selectedSurahs ?? roomSelectedSurahs ?? []
        },
        surahName: {
          isSelected: existing.surahName?.isSelected ?? v1GameModes.includes('surah'),
          questionsCount: existing.surahName?.questionsCount ?? (skillQuestionCounts.surah || 5),
          scopeMode: existing.surahName?.scopeMode ?? roomScopeMode ?? 'juz',
          selectedJuzRange: existing.surahName?.selectedJuzRange ?? roomSelectedJuzs ?? [],
          selectedSurahs: existing.surahName?.selectedSurahs ?? roomSelectedSurahs ?? []
        },
        islamicQuestions: {
          isSelected: existing.islamicQuestions?.isSelected ?? v1GameModes.includes('islamic'),
          questionsCount: existing.islamicQuestions?.questionsCount ?? 5,
          categories: existing.islamicQuestions?.categories ?? (islamicRoomCategories.length ? islamicRoomCategories : ['العقيدة']),
          topics: existing.islamicQuestions?.topics ?? (islamicRoomTopics.length ? islamicRoomTopics : ['all']),
          topicCounts: existing.islamicQuestions?.topicCounts ?? (Object.keys(islamicTopicQuestionCounts).length ? islamicTopicQuestionCounts : { all: 5 }),
          levels: existing.islamicQuestions?.levels ?? (islamicRoomLevels.length ? islamicRoomLevels : [1, 2, 3])
        },
        audio: {
          isSelected: existing.audio?.isSelected ?? v1GameModes.includes('audio'),
          questionsCount: existing.audio?.questionsCount ?? (skillQuestionCounts.audio || 5)
        },
        whoAmI: {
          isSelected: existing.whoAmI?.isSelected ?? v1GameModes.includes('who_am_i'),
          questionsCount: existing.whoAmI?.questionsCount ?? (whoAmIQuestionCount || 10),
          categories: existing.whoAmI?.categories ?? (selectedWhoAmICategories.length ? selectedWhoAmICategories : ['أنبياء ورسل']),
          categoryCounts: existing.whoAmI?.categoryCounts ?? (Object.keys(whoAmICategoryCounts).length ? whoAmICategoryCounts : { 'أنبياء ورسل': 10 })
        }
      };
    }

    if (contextRoomSettings) return contextRoomSettings;

    return {
      ayahCompletion: {
        isSelected: v1GameModes.includes('complete'),
        questionsCount: skillQuestionCounts.complete || 5,
        scopeMode: roomScopeMode || 'juz',
        selectedJuzRange: roomSelectedJuzs || [],
        selectedSurahs: roomSelectedSurahs || []
      },
      surahName: {
        isSelected: v1GameModes.includes('surah'),
        questionsCount: skillQuestionCounts.surah || 5,
        scopeMode: roomScopeMode || 'juz',
        selectedJuzRange: roomSelectedJuzs || [],
        selectedSurahs: roomSelectedSurahs || []
      },
      islamicQuestions: {
        isSelected: v1GameModes.includes('islamic'),
        questionsCount: 5,
        categories: islamicRoomCategories.length ? islamicRoomCategories : ['العقيدة'],
        topics: islamicRoomTopics.length ? islamicRoomTopics : ['all'],
        topicCounts: Object.keys(islamicTopicQuestionCounts).length ? islamicTopicQuestionCounts : { all: 5 },
        levels: islamicRoomLevels.length ? islamicRoomLevels : [1, 2, 3]
      },
      audio: {
        isSelected: v1GameModes.includes('audio'),
        questionsCount: skillQuestionCounts.audio || 5
      },
      whoAmI: {
        isSelected: v1GameModes.includes('who_am_i'),
        questionsCount: whoAmIQuestionCount || 10,
        categories: selectedWhoAmICategories.length ? selectedWhoAmICategories : ['أنبياء ورسل'],
        categoryCounts: Object.keys(whoAmICategoryCounts).length ? whoAmICategoryCounts : { 'أنبياء ورسل': 10 }
      }
    };
  });

  // تحديث الـ context والـ props عند تغيّر الإعدادات
  const updateModularSettings = (newSettings: ModularRoomSettings) => {
    setLocalRoomSettings(newSettings);
    if (contextSetRoomSettings) contextSetRoomSettings(newSettings);
    if (propSetRoomSettings) propSetRoomSettings(newSettings);

    // مزامنة الأنماط القديمة لضمان التوافقية الكاملة
    const modes: ('audio' | 'complete' | 'surah' | 'islamic' | 'who_am_i')[] = [];
    if (newSettings.whoAmI?.isSelected) {
      modes.push('who_am_i');
    } else {
      if (newSettings.audio?.isSelected) modes.push('audio');
      if (newSettings.ayahCompletion.isSelected) modes.push('complete');
      if (newSettings.surahName.isSelected) modes.push('surah');
      if (newSettings.islamicQuestions.isSelected) modes.push('islamic');
    }
    setV1GameModes(modes);

    setSkillQuestionCounts({
      audio: newSettings.audio?.questionsCount || 0,
      complete: newSettings.ayahCompletion.isSelected ? newSettings.ayahCompletion.questionsCount : 0,
      surah: newSettings.surahName.isSelected ? newSettings.surahName.questionsCount : 0
    });

    if (newSettings.surahName.isSelected) {
      if (setRoomScopeMode) setRoomScopeMode(newSettings.surahName.scopeMode);
      if (setRoomSelectedJuzs) setRoomSelectedJuzs(newSettings.surahName.selectedJuzRange);
      if (setRoomSelectedSurahs) setRoomSelectedSurahs(newSettings.surahName.selectedSurahs);
    } else if (newSettings.ayahCompletion.isSelected) {
      if (setRoomScopeMode) setRoomScopeMode(newSettings.ayahCompletion.scopeMode);
      if (setRoomSelectedJuzs) setRoomSelectedJuzs(newSettings.ayahCompletion.selectedJuzRange);
      if (setRoomSelectedSurahs) setRoomSelectedSurahs(newSettings.ayahCompletion.selectedSurahs);
    }
  };

  // حالة النافذة المنبثقة المفتوحة حالياً (Modal State)
  const [activeModal, setActiveModal] = useState<'complete' | 'surah' | 'islamic' | 'audio' | 'who_am_i' | null>(null);

  // مسودات الإعدادات المؤقتة داخل النوافذ المنبثقة
  // 1. مسودة إكمال الآية
  const [draftAyahCount, setDraftAyahCount] = useState(roomSettings.ayahCompletion.questionsCount);
  const [draftAyahScopeMode, setDraftAyahScopeMode] = useState<'juz' | 'surah'>(roomSettings.ayahCompletion.scopeMode);
  const [draftAyahJuzs, setDraftAyahJuzs] = useState<number[]>(roomSettings.ayahCompletion.selectedJuzRange);
  const [draftAyahSurahs, setDraftAyahSurahs] = useState<string[]>(roomSettings.ayahCompletion.selectedSurahs);
  const [draftAyahSearch, setDraftAyahSearch] = useState('');

  // 2. مسودة تحديد اسم السورة
  const [draftSurahCount, setDraftSurahCount] = useState(roomSettings.surahName.questionsCount);
  const [draftSurahScopeMode, setDraftSurahScopeMode] = useState<'juz' | 'surah'>(roomSettings.surahName.scopeMode);
  const [draftSurahJuzs, setDraftSurahJuzs] = useState<number[]>(roomSettings.surahName.selectedJuzRange);
  const [draftSurahSurahs, setDraftSurahSurahs] = useState<string[]>(roomSettings.surahName.selectedSurahs);
  const [draftSurahSearch, setDraftSurahSearch] = useState('');

  // 3. مسودة المعلومات الإسلامية
  const [draftIslamicTopics, setDraftIslamicTopics] = useState<string[]>(roomSettings.islamicQuestions.topics);
  const [draftIslamicTopicCounts, setDraftIslamicTopicCounts] = useState<Record<string, number>>(roomSettings.islamicQuestions.topicCounts);
  const [draftIslamicCategories, setDraftIslamicCategories] = useState<string[]>(roomSettings.islamicQuestions.categories);
  const [draftIslamicLevels, setDraftIslamicLevels] = useState<any[]>(roomSettings.islamicQuestions.levels);

  // 4. مسودة الصوت
  const [draftAudioCount, setDraftAudioCount] = useState(roomSettings.audio?.questionsCount || 5);

  // 5. مسودة من أنا؟
  const [draftWhoAmICategories, setDraftWhoAmICategories] = useState<string[]>(roomSettings.whoAmI?.categories || ['أنبياء ورسل']);
  const [draftWhoAmICategoryCounts, setDraftWhoAmICategoryCounts] = useState<Record<string, number>>(roomSettings.whoAmI?.categoryCounts || { 'أنبياء ورسل': 10 });

  // فتح نافذة التحدي مع تهيئة المسودة من الإعدادات الحالية
  const openModal = (skill: 'complete' | 'surah' | 'islamic' | 'audio' | 'who_am_i') => {
    if (skill === 'complete') {
      setDraftAyahCount(roomSettings.ayahCompletion.questionsCount);
      setDraftAyahScopeMode(roomSettings.ayahCompletion.scopeMode);
      setDraftAyahJuzs(roomSettings.ayahCompletion.selectedJuzRange);
      setDraftAyahSurahs(roomSettings.ayahCompletion.selectedSurahs);
      setDraftAyahSearch('');
    } else if (skill === 'surah') {
      setDraftSurahCount(roomSettings.surahName.questionsCount);
      setDraftSurahScopeMode(roomSettings.surahName.scopeMode);
      setDraftSurahJuzs(roomSettings.surahName.selectedJuzRange);
      setDraftSurahSurahs(roomSettings.surahName.selectedSurahs);
      setDraftSurahSearch('');
    } else if (skill === 'islamic') {
      setDraftIslamicTopics(roomSettings.islamicQuestions.topics);
      setDraftIslamicTopicCounts(roomSettings.islamicQuestions.topicCounts);
      setDraftIslamicCategories(roomSettings.islamicQuestions.categories);
      setDraftIslamicLevels(roomSettings.islamicQuestions.levels);
    } else if (skill === 'audio') {
      setDraftAudioCount(roomSettings.audio?.questionsCount || 5);
    } else if (skill === 'who_am_i') {
      setDraftWhoAmICategories(roomSettings.whoAmI?.categories || ['أنبياء ورسل']);
      setDraftWhoAmICategoryCounts(roomSettings.whoAmI?.categoryCounts || { 'أنبياء ورسل': 10 });
    }
    setActiveModal(skill);
  };

  // قيود الذكاء لتحدي اسم السورة (داخل المسودة)
  const draftSurahValidation = useMemo(() => {
    return validateSurahChallengeScope(
      allChallenges,
      {
        scopeMode: draftSurahScopeMode,
        selectedJuzs: draftSurahJuzs,
        selectedSurahs: draftSurahSurahs
      },
      draftSurahCount
    );
  }, [allChallenges, draftSurahScopeMode, draftSurahJuzs, draftSurahSurahs, draftSurahCount]);

  // قيود الذكاء لتحدي اسم السورة الحالي المحفوظ في الشاشة الرئيسية
  const savedSurahValidation = useMemo(() => {
    if (!roomSettings.surahName.isSelected) return { isValid: true, errorMessage: null };
    return validateSurahChallengeScope(
      allChallenges,
      {
        scopeMode: roomSettings.surahName.scopeMode,
        selectedJuzs: roomSettings.surahName.selectedJuzRange,
        selectedSurahs: roomSettings.surahName.selectedSurahs
      },
      roomSettings.surahName.questionsCount
    );
  }, [roomSettings.surahName, allChallenges]);

  // إجمالي الأسئلة المحسوبة
  const totalQuestions = useMemo(() => {
    let sum = 0;
    if (roomSettings.ayahCompletion.isSelected) sum += roomSettings.ayahCompletion.questionsCount;
    if (roomSettings.surahName.isSelected) sum += roomSettings.surahName.questionsCount;
    if (roomSettings.audio?.isSelected) sum += (roomSettings.audio.questionsCount || 0);
    if (roomSettings.islamicQuestions.isSelected) {
      if (roomSettings.islamicQuestions.topics.includes('all')) {
        sum += (roomSettings.islamicQuestions.topicCounts['all'] || 5);
      } else {
        sum += roomSettings.islamicQuestions.topics.reduce((acc, t) => acc + (roomSettings.islamicQuestions.topicCounts[t] || 0), 0);
      }
    }
    if (roomSettings.whoAmI?.isSelected) {
      sum += roomSettings.whoAmI.categories.reduce((acc, c) => acc + (roomSettings.whoAmI?.categoryCounts[c] || 0), 0);
    }
    return sum;
  }, [roomSettings]);

  const activeSkillsCount = useMemo(() => {
    return [
      roomSettings.ayahCompletion.isSelected,
      roomSettings.surahName.isSelected,
      roomSettings.islamicQuestions.isSelected,
      roomSettings.audio?.isSelected,
      roomSettings.whoAmI?.isSelected
    ].filter(Boolean).length;
  }, [roomSettings]);

  // تعطيل زر الإنشاء عند وجود خطأ بالتحقق أو 0 أسئلة
  const isSubmitDisabled =
    isSaving ||
    isCreatingRoom ||
    activeSkillsCount === 0 ||
    totalQuestions <= 0 ||
    (roomSettings.surahName.isSelected && !savedSurahValidation.isValid);

  return (
    <motion.div
      key={isEditMode ? "group_edit" : "group_create"}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={isEditMode ? "w-full text-right" : "w-full max-w-2xl mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4 min-h-screen overflow-y-auto pb-32 sm:pb-36"}
    >
      <div className={isEditMode ? "space-y-5 sm:space-y-6" : "glass p-4 sm:p-6 md:p-8 rounded-3xl border-orange-100 shadow-xl space-y-5 sm:space-y-6"}>
        {isEditMode ? (
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div className="text-right">
                <h2 className="text-lg sm:text-xl font-black text-slate-800">تعديل إعدادات الغرفة</h2>
                <p className="text-xs text-slate-400 font-bold">تحديث فوري للنوافذ المستقلة للمهارات</p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isCreatingRoom}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800">إنشاء غرفة تحدي جماعية</h2>
            <p className="text-xs text-slate-400 font-bold">اختر المهارات واضبط إعدادات ونطاق كل مهارة بشكل مستقل</p>
          </div>
        )}

        <div className="space-y-5 sm:space-y-6">
          {/* اسم الغرفة */}
          <div className="space-y-1.5 text-right">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
              اسم الغرفة (اختياري)
            </label>
            <input
              type="text"
              maxLength={40}
              value={v1RoomName}
              onChange={(e) => setV1RoomName(e.target.value)}
              placeholder="مثال: تحدي الحُفّاظ، فرسان القرآن..."
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-brand-emerald focus:outline-none bg-white text-slate-800 font-bold text-sm text-right shadow-xs"
            />
          </div>

          {/* نوع الخصوصية */}
          <div className="space-y-1.5 text-right">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
              نوع الغرفة (الخصوصية)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setV1IsPrivate(false)}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                  !v1IsPrivate
                    ? 'border-brand-emerald bg-brand-emerald/10 text-brand-emerald shadow-sm'
                    : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                }`}
              >
                <Globe className="w-5 h-5 shrink-0" />
                <div className="text-right">
                  <div className="text-xs md:text-sm font-black">عامة (Public)</div>
                  <div className="text-[10px] opacity-75 font-bold">تظهر للجميع في القائمة</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setV1IsPrivate(true)}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                  v1IsPrivate
                    ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm'
                    : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                }`}
              >
                <Lock className="w-5 h-5 shrink-0" />
                <div className="text-right">
                  <div className="text-xs md:text-sm font-black">خاصة (Private)</div>
                  <div className="text-[10px] opacity-75 font-bold">محمية بكلمة مرور</div>
                </div>
              </button>
            </div>
          </div>

          {/* كلمة المرور للغرفة الخاصة */}
          {v1IsPrivate && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              className="bg-orange-50/70 border border-orange-200 p-3.5 sm:p-4 rounded-2xl space-y-2 text-right"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-orange-900 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>كلمة مرور الغرفة (مطلوبة) *</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                >
                  {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPasswordText ? 'إخفاء' : 'إظهار'}</span>
                </button>
              </div>
              <input
                type={showPasswordText ? "text" : "password"}
                maxLength={30}
                value={v1RoomPassword}
                onChange={(e) => setV1RoomPassword(e.target.value)}
                placeholder="أدخل كلمة مرور الغرفة ليتمكن أصدقاؤك من الانضمام"
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-orange-200 focus:border-orange-500 focus:outline-none bg-white text-slate-800 font-bold text-sm text-right"
              />
            </motion.div>
          )}

          {/* بطاقات المهارات المستقلة (Modular Skill Cards UI) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-right">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                مهارات التحدي (انقر لضبط وتخصيص كل مهارة)
              </label>
              <span className="text-[10px] font-black bg-brand-emerald/10 text-brand-emerald px-2.5 py-0.5 rounded-full border border-brand-emerald/20">
                {activeSkillsCount} مهارات مفعلة • {totalQuestions} سؤال
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* 1. بطاقة تحدي إكمال الآية */}
              {!systemSettings.hideCompletionChallenge && (
                <div
                  className={`p-4 rounded-3xl border-2 transition-all flex flex-col justify-between gap-3 text-right relative overflow-hidden ${
                    roomSettings.ayahCompletion.isSelected
                      ? 'border-blue-500 bg-blue-50/40 shadow-sm'
                      : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          roomSettings.ayahCompletion.isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-800">تحدي إكمال الآية</h3>
                          <p className="text-[10px] text-slate-400 font-bold">توقع الكلمات المفقودة في الآيات</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateModularSettings({
                            ...roomSettings,
                            ayahCompletion: {
                              ...roomSettings.ayahCompletion,
                              isSelected: !roomSettings.ayahCompletion.isSelected
                            }
                          });
                        }}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                          roomSettings.ayahCompletion.isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {roomSettings.ayahCompletion.isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    </div>

                    {/* الملخص تحت البطاقة */}
                    {roomSettings.ayahCompletion.isSelected ? (
                      <div className="p-2.5 rounded-2xl bg-blue-100/60 border border-blue-200/70 text-xs font-bold text-blue-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-blue-700" />
                          <span>
                            {roomSettings.ayahCompletion.questionsCount} أسئلة • {formatScopeSummary(
                              roomSettings.ayahCompletion.scopeMode,
                              roomSettings.ayahCompletion.selectedJuzRange,
                              roomSettings.ayahCompletion.selectedSurahs
                            )}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-bold py-1">
                        غير مفعّل • انقر لتخصيص النطاق والأسئلة
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openModal('complete')}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      roomSettings.ayahCompletion.isSelected
                        ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{roomSettings.ayahCompletion.isSelected ? 'تخصيص النطاق والأسئلة ⚙️' : 'تفعيل وضبط الإعدادات ➕'}</span>
                  </button>
                </div>
              )}

              {/* 2. بطاقة تحدي تحديد اسم السورة */}
              {!systemSettings.hideSurahChallenge && (
                <div
                  className={`p-4 rounded-3xl border-2 transition-all flex flex-col justify-between gap-3 text-right relative overflow-hidden ${
                    roomSettings.surahName.isSelected
                      ? (!savedSurahValidation.isValid ? 'border-amber-500 bg-amber-50/40 shadow-sm' : 'border-purple-500 bg-purple-50/40 shadow-sm')
                      : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          roomSettings.surahName.isSelected
                            ? (!savedSurahValidation.isValid ? 'bg-amber-600 text-white' : 'bg-purple-600 text-white')
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-800">تحديد اسم السورة</h3>
                          <p className="text-[10px] text-slate-400 font-bold">التعرف على أسماء السور للآيات</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateModularSettings({
                            ...roomSettings,
                            surahName: {
                              ...roomSettings.surahName,
                              isSelected: !roomSettings.surahName.isSelected
                            }
                          });
                        }}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                          roomSettings.surahName.isSelected
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {roomSettings.surahName.isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    </div>

                    {/* الملخص والتنبيه تحت البطاقة */}
                    {roomSettings.surahName.isSelected ? (
                      <div className="space-y-1.5">
                        <div className="p-2.5 rounded-2xl bg-purple-100/60 border border-purple-200/70 text-xs font-bold text-purple-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-purple-700" />
                            <span>
                              {roomSettings.surahName.questionsCount} أسئلة • {formatScopeSummary(
                                roomSettings.surahName.scopeMode,
                                roomSettings.surahName.selectedJuzRange,
                                roomSettings.surahName.selectedSurahs
                              )}
                            </span>
                          </span>
                        </div>
                        {!savedSurahValidation.isValid && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 text-[10px] font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{savedSurahValidation.errorMessage}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-bold py-1">
                        غير مفعّل • انقر لتخصيص النطاق والأسئلة
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openModal('surah')}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      roomSettings.surahName.isSelected
                        ? (!savedSurahValidation.isValid ? 'bg-amber-600 text-white shadow-xs hover:bg-amber-700' : 'bg-purple-600 text-white shadow-xs hover:bg-purple-700')
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{roomSettings.surahName.isSelected ? 'تخصيص النطاق والأسئلة ⚙️' : 'تفعيل وضبط الإعدادات ➕'}</span>
                  </button>
                </div>
              )}

              {/* 3. بطاقة تحدي المعلومات الإسلامية */}
              <div
                className={`p-4 rounded-3xl border-2 transition-all flex flex-col justify-between gap-3 text-right relative overflow-hidden ${
                  roomSettings.islamicQuestions.isSelected
                    ? 'border-amber-500 bg-amber-50/40 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        roomSettings.islamicQuestions.isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800">معلومات إسلامية</h3>
                        <p className="text-[10px] text-slate-400 font-bold">عقيدة، فقه، سيرة وتفسير</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateModularSettings({
                          ...roomSettings,
                          islamicQuestions: {
                            ...roomSettings.islamicQuestions,
                            isSelected: !roomSettings.islamicQuestions.isSelected
                          }
                        });
                      }}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                        roomSettings.islamicQuestions.isSelected
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {roomSettings.islamicQuestions.isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  </div>

                  {roomSettings.islamicQuestions.isSelected ? (
                    <div className="p-2.5 rounded-2xl bg-amber-100/60 border border-amber-200/70 text-xs font-bold text-amber-900 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {roomSettings.islamicQuestions.topics.includes('all')
                              ? `${roomSettings.islamicQuestions.topicCounts['all'] || roomSettings.islamicQuestions.questionsCount || 5} أسئلة • جميع المواضيع`
                              : `${roomSettings.islamicQuestions.topics.reduce((sum, t) => sum + (roomSettings.islamicQuestions.topicCounts[t] || 0), 0)} أسئلة • ${roomSettings.islamicQuestions.topics.length} مواضيع`}
                          </span>
                        </span>
                        <span className="text-[10px] bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded-full font-black">
                          {roomSettings.islamicQuestions.categories?.length || 1} مجالات
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-800 flex items-center gap-1">
                        <span>المستويات:</span>
                        <span className="font-black">
                          {roomSettings.islamicQuestions.levels?.length === 3
                            ? 'كافة المستويات (١، ٢، ٣)'
                            : (roomSettings.islamicQuestions.levels || [1]).map(l => `المستوى ${l}`).join('، ')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 font-bold py-1">
                      غير مفعّل • انقر لتخصيص المواضيع والفئات
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openModal('islamic')}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    roomSettings.islamicQuestions.isSelected
                      ? 'bg-amber-500 text-white shadow-xs hover:bg-amber-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{roomSettings.islamicQuestions.isSelected ? 'تخصيص المواضيع ⚙️' : 'تفعيل وضبط الإعدادات ➕'}</span>
                </button>
              </div>

              {/* 4. بطاقة التحدي الصوتي */}
              {!systemSettings.hideAudioChallenge && (
                <div
                  className={`p-4 rounded-3xl border-2 transition-all flex flex-col justify-between gap-3 text-right relative overflow-hidden ${
                    roomSettings.audio?.isSelected
                      ? 'border-brand-emerald bg-brand-emerald/5 shadow-sm'
                      : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          roomSettings.audio?.isSelected ? 'bg-brand-emerald text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <Mic className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-800">التحدي الصوتي</h3>
                          <p className="text-[10px] text-slate-400 font-bold">تلاوة بداية الآيات بالصوت</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateModularSettings({
                            ...roomSettings,
                            audio: {
                              isSelected: !roomSettings.audio?.isSelected,
                              questionsCount: roomSettings.audio?.questionsCount || 5
                            }
                          });
                        }}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                          roomSettings.audio?.isSelected
                            ? 'bg-brand-emerald border-brand-emerald text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {roomSettings.audio?.isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    </div>

                    {roomSettings.audio?.isSelected ? (
                      <div className="p-2.5 rounded-2xl bg-brand-emerald/10 border border-brand-emerald/20 text-xs font-bold text-brand-emerald flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-brand-emerald" />
                          <span>{roomSettings.audio?.questionsCount || 5} أسئلة صوتية</span>
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-bold py-1">
                        غير مفعّل • انقر لضبط عدد الأسئلة
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openModal('audio')}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      roomSettings.audio?.isSelected
                        ? 'bg-brand-emerald text-white shadow-xs hover:bg-brand-emerald/90'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{roomSettings.audio?.isSelected ? 'تعديل عدد الأسئلة ⚙️' : 'تفعيل وضبط الإعدادات ➕'}</span>
                  </button>
                </div>
              )}

              {/* 5. بطاقة تحدي من أنا؟ */}
              <div
                className={`p-4 rounded-3xl border-2 transition-all flex flex-col justify-between gap-3 text-right relative overflow-hidden ${
                  roomSettings.whoAmI?.isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        roomSettings.whoAmI?.isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <HelpCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800">تحدي من أنا؟</h3>
                        <p className="text-[10px] text-slate-400 font-bold">تخمين الشخصيات بالتلميحات</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateModularSettings({
                          ...roomSettings,
                          whoAmI: {
                            isSelected: !roomSettings.whoAmI?.isSelected,
                            questionsCount: roomSettings.whoAmI?.questionsCount || 10,
                            categories: roomSettings.whoAmI?.categories || ['أنبياء ورسل'],
                            categoryCounts: roomSettings.whoAmI?.categoryCounts || { 'أنبياء ورسل': 10 }
                          }
                        });
                      }}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                        roomSettings.whoAmI?.isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {roomSettings.whoAmI?.isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  </div>

                  {roomSettings.whoAmI?.isSelected ? (
                    <div className="p-2.5 rounded-2xl bg-indigo-100/70 border border-indigo-200 text-xs font-bold text-indigo-950 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 truncate">
                        <Check className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                        <span className="truncate">
                          {roomSettings.whoAmI.categories.reduce((sum, c) => sum + (roomSettings.whoAmI?.categoryCounts[c] || 0), 0)} سؤال • {roomSettings.whoAmI.categories.length} فئات ({roomSettings.whoAmI.categories.join('، ')})
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 font-bold py-1">
                      غير مفعّل • انقر لاختيار الفئات والأسئلة
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openModal('who_am_i')}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    roomSettings.whoAmI?.isSelected
                      ? 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{roomSettings.whoAmI?.isSelected ? 'تخصيص الفئات ⚙️' : 'تفعيل وضبط الإعدادات ➕'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* تنبيه تحذيري عند وجود مانع في الشاشة الرئيسية لتحدي اسم السورة */}
          {roomSettings.surahName.isSelected && !savedSurahValidation.isValid && savedSurahValidation.errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 text-right text-xs sm:text-sm font-bold shadow-xs"
            >
              <div className="flex items-start gap-2.5 flex-1">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  {savedSurahValidation.errorMessage}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openModal('surah')}
                className="px-3 py-1 bg-amber-600 text-white rounded-xl text-xs font-black shrink-0 hover:bg-amber-700 cursor-pointer"
              >
                تعديل النطاق ⚙️
              </button>
            </motion.div>
          )}

          {/* المؤقت وطريقة الانتقال */}
          <div className="space-y-4 pt-2">
            {/* مؤقت الأسئلة */}
            <div className="text-right p-3.5 sm:p-4 bg-slate-50 border-2 border-slate-200/80 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-600">الوقت لكل سؤال</label>
                <button
                  type="button"
                  onClick={() => setV1Timer(!v1Timer)}
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                    v1Timer ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {v1Timer ? 'المؤقت مفعل ⚡' : 'المؤقت معطل'}
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min={0}
                  max={300}
                  disabled={!v1Timer}
                  value={v1Timer ? (v1TimePerQuestion || '') : ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setV1TimePerQuestion(isNaN(val) ? 0 : Math.max(0, Math.min(300, val)));
                  }}
                  placeholder={v1Timer ? 'اكتب الثواني (مثال: 20)' : 'المؤقت معطل (0)'}
                  className={`w-full pl-14 pr-4 py-3 rounded-2xl border-2 font-black text-sm text-right shadow-xs transition-all ${
                    v1Timer
                      ? 'border-orange-300 bg-white text-slate-800 focus:border-orange-500 focus:outline-none'
                      : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                  }`}
                />
                <span className="absolute left-3.5 text-xs font-black text-slate-400 pointer-events-none">
                  {v1Timer ? 'ثانية' : ''}
                </span>
              </div>
            </div>

            {/* طريقة الانتقال بين الأسئلة */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-2 border-slate-200/80 rounded-2xl shadow-xs space-y-3 text-right">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">طريقة الانتقال بين الأسئلة</span>
                <span className="text-[10px] font-black text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                  {v1TransitionMode === 'SYNC' ? 'متزامن (سؤال بسؤال)' : 'فردي (سباق حر)'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setV1TransitionMode('SYNC')}
                  className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    v1TransitionMode === 'SYNC'
                      ? 'border-brand-emerald bg-brand-emerald/10 text-brand-emerald'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-black">متزامن للجميع ⏳</span>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                    ينتظر الجميع نهاية وقت السؤال لينتقلوا سوياً.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setV1TransitionMode('ASYNC')}
                  className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    v1TransitionMode === 'ASYNC'
                      ? 'border-orange-500 bg-orange-50 text-orange-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-black">تلقائي فردي 🚀</span>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                    ينتقل كل لاعب فور إجابته دون انتظار البقية.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* أزرار الحفظ والإنشاء النهائية */}
          <div className="pt-2 space-y-3">
            {isEditMode ? (
              <>
                <button
                  type="button"
                  onClick={onSubmitEdit || handleCreateV1}
                  disabled={isSubmitDisabled}
                  className={`w-full py-3.5 md:py-4 rounded-2xl font-black text-base md:text-lg shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${
                    isSubmitDisabled
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-brand-emerald text-white shadow-brand-emerald/20 hover:bg-brand-emerald/90 hover:scale-[1.01] active:scale-95'
                  }`}
                >
                  {isSaving || isCreatingRoom ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>حفظ التعديلات ({totalQuestions} سؤال)</span>
                    </>
                  )}
                </button>

                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving || isCreatingRoom}
                    className="w-full py-2.5 text-slate-400 font-bold hover:text-slate-600 transition-colors text-xs md:text-sm cursor-pointer"
                  >
                    إلغاء
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCreateV1}
                  disabled={isSubmitDisabled}
                  className={`w-full py-3.5 md:py-4 rounded-2xl font-black text-base md:text-lg shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${
                    isSubmitDisabled
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-orange-500 text-white shadow-orange-500/20 hover:bg-orange-600 hover:scale-[1.01] active:scale-95'
                  }`}
                >
                  {isCreatingRoom ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ArrowLeft className="w-5 h-5" />
                      <span>أنشئ الغرفة الآن ({totalQuestions} سؤال)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setView('group_join')}
                  className="w-full py-2.5 text-slate-400 font-bold hover:text-slate-600 transition-colors text-xs md:text-sm cursor-pointer"
                >
                  رجوع لقائمة الغرف
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* النوافذ المنبثقة المستقلة (MODULAR MODALS) لكل مهارة */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-xl bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 text-right space-y-5 max-h-[90vh] overflow-y-auto"
              dir="rtl"
            >
              {/* ---------------- 1. نافذة تحدي إكمال الآية ---------------- */}
              {activeModal === 'complete' && (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800">إعدادات تحدي إكمال الآية</h3>
                        <p className="text-xs text-slate-400 font-bold">حدد نطاق الآيات وعدد الأسئلة المطلوبة</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* عدد الأسئلة */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-black text-slate-700">
                      <span>عدد الأسئلة المطلوبة:</span>
                      <span className="text-blue-600">{draftAyahCount} أسئلة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {[3, 5, 10, 15, 20].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setDraftAyahCount(cnt)}
                          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            draftAyahCount === cnt
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* مكون النطاق المستقل لإكمال الآية */}
                  <div className="pt-1">
                    <ScopeSelector
                      scopeMode={draftAyahScopeMode}
                      setScopeMode={setDraftAyahScopeMode}
                      selectedJuzs={draftAyahJuzs}
                      setSelectedJuzs={setDraftAyahJuzs}
                      selectedSurahs={draftAyahSurahs}
                      setSelectedSurahs={setDraftAyahSurahs}
                      surahSearch={draftAyahSearch}
                      setSurahSearch={setDraftAyahSearch}
                      title="نطاق أسئلة إكمال الآية"
                      description="حدد أجزاء أو سور معينة لحصر أسئلة إكمال الآية داخلها"
                    />
                  </div>

                  {/* أزرار الحفظ */}
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        updateModularSettings({
                          ...roomSettings,
                          ayahCompletion: {
                            isSelected: true,
                            questionsCount: Math.max(1, draftAyahCount),
                            scopeMode: draftAyahScopeMode,
                            selectedJuzRange: draftAyahJuzs,
                            selectedSurahs: draftAyahSurahs
                          }
                        });
                        setActiveModal(null);
                      }}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ الإعدادات وتفعيل المهارة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </>
              )}

              {/* ---------------- 2. نافذة تحدي اسم السورة مع قيود الذكاء ---------------- */}
              {activeModal === 'surah' && (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800">إعدادات تحدي تحديد اسم السورة</h3>
                        <p className="text-xs text-slate-400 font-bold">حدد نطاق السور وعدد الأسئلة مع قيود الذكاء</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* عدد الأسئلة */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-black text-slate-700">
                      <span>عدد الأسئلة المطلوبة:</span>
                      <span className="text-purple-600">{draftSurahCount} أسئلة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {[3, 5, 10, 15].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setDraftSurahCount(cnt)}
                          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            draftSurahCount === cnt
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* مكون النطاق المستقل لتحدي اسم السورة */}
                  <div className="pt-1">
                    <ScopeSelector
                      scopeMode={draftSurahScopeMode}
                      setScopeMode={setDraftSurahScopeMode}
                      selectedJuzs={draftSurahJuzs}
                      setSelectedJuzs={setDraftSurahJuzs}
                      selectedSurahs={draftSurahSurahs}
                      setSelectedSurahs={setDraftSurahSurahs}
                      surahSearch={draftSurahSearch}
                      setSurahSearch={setDraftSurahSearch}
                      title="نطاق سور التحدي (منفصل تماماً)"
                      description="اختر أجزاء أو سور لحصر أسئلة اسم السورة وتفعيل مكافأة الحُفّاظ"
                    />
                  </div>

                  {/* قيود الذكاء (تحذير وتنبيه فوري داخل النافذة) */}
                  {!draftSurahValidation.isValid && draftSurahValidation.errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 text-xs font-bold flex items-start gap-2.5 leading-relaxed"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        {draftSurahValidation.errorMessage}
                      </div>
                    </motion.div>
                  )}

                  {/* أزرار الحفظ مع التعطيل إذا كانت الشروط غير مستوفاة */}
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!draftSurahValidation.isValid}
                      onClick={() => {
                        if (!draftSurahValidation.isValid) return;
                        updateModularSettings({
                          ...roomSettings,
                          surahName: {
                            isSelected: true,
                            questionsCount: Math.max(1, draftSurahCount),
                            scopeMode: draftSurahScopeMode,
                            selectedJuzRange: draftSurahJuzs,
                            selectedSurahs: draftSurahSurahs
                          }
                        });
                        setActiveModal(null);
                      }}
                      className={`flex-1 py-3 rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        !draftSurahValidation.isValid
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ الإعدادات وتفعيل المهارة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </>
              )}

              {/* ---------------- 3. نافذة معلومات إسلامية (المكون المستقل المتطابق) ---------------- */}
              {activeModal === 'islamic' && (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800">إعدادات المعلومات الإسلامية</h3>
                        <p className="text-xs text-slate-400 font-bold">حدد المجالات الإسلامية ومستويات الصعوبة والمواضيع المطلوبة</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <IslamicInfoSettingsForm
                    settings={{
                      categories: draftIslamicCategories,
                      levels: draftIslamicLevels,
                      topics: draftIslamicTopics,
                      topicCounts: draftIslamicTopicCounts,
                      questionsCount: draftIslamicTopics.includes('all')
                        ? (draftIslamicTopicCounts['all'] || 5)
                        : draftIslamicTopics.reduce((sum, t) => sum + (draftIslamicTopicCounts[t] || 0), 0)
                    }}
                    onChange={(updated) => {
                      setDraftIslamicCategories(updated.categories);
                      setDraftIslamicLevels(updated.levels);
                      setDraftIslamicTopics(updated.topics);
                      setDraftIslamicTopicCounts(updated.topicCounts);
                    }}
                    onSave={() => {
                      const totalQ = draftIslamicTopics.includes('all')
                        ? (draftIslamicTopicCounts['all'] || 5)
                        : draftIslamicTopics.reduce((sum, t) => sum + (draftIslamicTopicCounts[t] || 0), 0);

                      updateModularSettings({
                        ...roomSettings,
                        islamicQuestions: {
                          isSelected: true,
                          questionsCount: Math.max(1, totalQ),
                          categories: draftIslamicCategories,
                          topics: draftIslamicTopics,
                          topicCounts: draftIslamicTopicCounts,
                          levels: draftIslamicLevels
                        }
                      });
                      setActiveModal(null);
                    }}
                    onCancel={() => setActiveModal(null)}
                    saveButtonText="حفظ الإعدادات وتفعيل المهارة"
                    showActionButtons={true}
                  />
                </>
              )}

              {/* ---------------- 4. نافذة التحدي الصوتي ---------------- */}
              {activeModal === 'audio' && (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Mic className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800">إعدادات التحدي الصوتي</h3>
                        <p className="text-xs text-slate-400 font-bold">حدد عدد الأسئلة الصوتية</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-black text-slate-700">
                      <span>عدد الأسئلة:</span>
                      <span className="text-brand-emerald">{draftAudioCount} أسئلة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {[3, 5, 10, 15].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setDraftAudioCount(cnt)}
                          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            draftAudioCount === cnt
                              ? 'bg-brand-emerald text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        updateModularSettings({
                          ...roomSettings,
                          audio: {
                            isSelected: true,
                            questionsCount: draftAudioCount
                          }
                        });
                        setActiveModal(null);
                      }}
                      className="flex-1 py-3 bg-brand-emerald hover:bg-brand-emerald/90 text-white rounded-2xl font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ الإعدادات وتفعيل المهارة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </>
              )}

              {/* ---------------- 5. نافذة تحدي من أنا؟ ---------------- */}
              {activeModal === 'who_am_i' && (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <HelpCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800">إعدادات تحدي من أنا؟</h3>
                        <p className="text-xs text-slate-400 font-bold">اختر الفئات وحدد عدد الأسئلة</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-700">اختر الفئات المطلوبة للتحدي:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['أنبياء ورسل', 'صحابة', 'أمهات المؤمنين', 'شخصيات إسلامية', 'غزوات ومعارك'].map(cat => {
                        const isSelected = draftWhoAmICategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (draftWhoAmICategories.length > 1) {
                                  setDraftWhoAmICategories(draftWhoAmICategories.filter(c => c !== cat));
                                }
                              } else {
                                setDraftWhoAmICategories([...draftWhoAmICategories, cat]);
                                setDraftWhoAmICategoryCounts(prev => ({ ...prev, [cat]: 5 }));
                              }
                            }}
                            className={`p-3 rounded-xl border-2 text-right transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-black'
                                : 'border-slate-200 bg-white text-slate-600 font-bold'
                            }`}
                          >
                            <span className="text-xs">{cat}</span>
                            {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        updateModularSettings({
                          ...roomSettings,
                          whoAmI: {
                            isSelected: true,
                            questionsCount: draftWhoAmICategories.reduce((sum, c) => sum + (draftWhoAmICategoryCounts[c] || 5), 0),
                            categories: draftWhoAmICategories,
                            categoryCounts: draftWhoAmICategoryCounts
                          }
                        });
                        setActiveModal(null);
                      }}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ الإعدادات وتفعيل المهارة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GroupCreatePage;
