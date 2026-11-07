import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Globe, Lock, Eye, EyeOff, Mic, CheckCircle, BookOpen, Sparkles, HelpCircle,
  Check, ArrowLeft, Settings, X, Loader2, AlertTriangle
} from 'lucide-react';
import { View } from '../types/challenges';
import { WhoAmIInfoAlert } from '../components/WhoAmISettings';
import { islamicCategoriesList } from '../data/islamicCategories';
import { ScopeSelector } from '../components/challenge/ScopeSelector';
import { useApp } from '../contexts/AppContext';
import { validateSurahChallengeScope } from '../services/JuzRepository';

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
  roomSurahSearch,
  setRoomSurahSearch
}) => {
  const isEditMode = mode === 'edit';

  const [localScopeMode, setLocalScopeMode] = useState<'juz' | 'surah'>('juz');
  const [localSelectedJuzs, setLocalSelectedJuzs] = useState<number[]>([]);
  const [localSelectedSurahs, setLocalSelectedSurahs] = useState<string[]>([]);
  const [localSurahSearch, setLocalSurahSearch] = useState<string>('');

  const activeScopeMode = roomScopeMode ?? localScopeMode;
  const activeSetScopeMode = setRoomScopeMode ?? setLocalScopeMode;
  const activeSelectedJuzs = roomSelectedJuzs ?? localSelectedJuzs;
  const activeSetSelectedJuzs = setRoomSelectedJuzs ?? setLocalSelectedJuzs;
  const activeSelectedSurahs = roomSelectedSurahs ?? localSelectedSurahs;
  const activeSetSelectedSurahs = setRoomSelectedSurahs ?? setLocalSelectedSurahs;
  const activeSurahSearch = roomSurahSearch ?? localSurahSearch;
  const activeSetSurahSearch = setRoomSurahSearch ?? setLocalSurahSearch;

  const { allChallenges } = useApp();

  const isSurahSelected = v1GameModes.includes('surah');
  const surahRoomValidation = useMemo(() => {
    if (!isSurahSelected) return { isValid: true, errorMessage: null };
    const requestedCount = Math.max(1, skillQuestionCounts.surah || 5);
    return validateSurahChallengeScope(
      allChallenges,
      {
        scopeMode: activeScopeMode,
        selectedJuzs: activeSelectedJuzs,
        selectedSurahs: activeSelectedSurahs
      },
      requestedCount
    );
  }, [isSurahSelected, allChallenges, activeScopeMode, activeSelectedJuzs, activeSelectedSurahs, skillQuestionCounts.surah]);

  const isSubmitDisabled =
    isSaving ||
    isCreatingRoom ||
    hasCountValidationErrors ||
    totalConfiguredQuestions <= 0 ||
    (isSurahSelected && !surahRoomValidation.isValid);

  return (
    <motion.div
      key={isEditMode ? "group_edit" : "group_create"}
      initial={{ opacity: 0, scale: 0.95 }}
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
                <p className="text-xs text-slate-400 font-bold">تحديث فوري لجميع المتسابقين في القاعة</p>
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
          <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 text-center">إعدادات التحدي الجماعي</h2>
        )}

        <div className="space-y-5 sm:space-y-6">
          {/* 1. اسم الغرفة */}
          <div className="text-right">
            <label className="block text-xs font-black text-slate-600 mb-2">
              اسم الغرفة
            </label>
            <input
              type="text"
              maxLength={40}
              value={v1RoomName}
              onChange={(e) => setV1RoomName(e.target.value)}
              placeholder="اكتب اسماً مميزاً للغرفة (مثال: سباق الحفاظ، تحدي الأصدقاء)"
              className="w-full px-4 py-3 sm:py-3.5 rounded-2xl border-2 border-slate-100 focus:border-orange-500 focus:outline-none bg-white text-slate-800 font-bold text-sm text-right transition-all shadow-xs"
            />
          </div>

          {/* 2. نوع الغرفة (عامة / خاصة) */}
          <div className="text-right">
            <label className="block text-xs font-black text-slate-600 mb-2">
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

          {/* الظهور الشرطي لحقل كلمة المرور */}
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
              <p className="text-[10px] text-orange-700/80 font-bold">
                🔒 لن يتمكن أي متسابق من الدخول للغرفة إلا بعد إدخال هذه الكلمة.
              </p>
            </motion.div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3 text-right">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                اختر مهارات التحدي (يمكنك اختيار أكثر من مهارة)
              </label>
              <span className="text-[10px] font-black bg-brand-emerald/10 text-brand-emerald px-2.5 py-0.5 rounded-full border border-brand-emerald/20">
                تم اختيار ({v1GameModes.filter(m => !(m === 'audio' && systemSettings.hideAudioChallenge) && !(m === 'complete' && systemSettings.hideCompletionChallenge) && !(m === 'surah' && systemSettings.hideSurahChallenge)).length})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
              {[
                { id: 'audio', label: 'التحدي الصوتي', icon: Mic, color: 'emerald', bg: 'bg-brand-emerald/10', desc: 'تحدى نفسك بقراءة بداية الآيات', hidden: systemSettings.hideAudioChallenge },
                { id: 'complete', label: 'تحدي إكمال الآية', icon: CheckCircle, color: 'blue', bg: 'bg-blue-600/10', desc: 'توقع الكلمات المفقودة في الآية', hidden: systemSettings.hideCompletionChallenge },
                { id: 'surah', label: 'تحديد اسم السورة', icon: BookOpen, color: 'purple', bg: 'bg-purple-600/10', desc: 'تعرف على اسم السورة من الآية', hidden: systemSettings.hideSurahChallenge },
                { id: 'islamic', label: 'تحدي معلومات إسلامية', icon: Sparkles, color: 'amber', bg: 'bg-amber-500/10', desc: 'أسئلة في العقيدة، الفقه، والتفسير', hidden: false },
                { id: 'who_am_i', label: 'تحدي من أنا؟', icon: HelpCircle, color: 'indigo', bg: 'bg-indigo-600/10', desc: 'تحدي الشخصيات بالتلميحات المتدرجة وفئات متعددة', hidden: false }
              ].filter(m => !m.hidden).map(mode => {
                const isSelected = v1GameModes.includes(mode.id as any);
                const skillKey = mode.id as 'audio' | 'complete' | 'surah';
                const maxAvail = mode.id === 'who_am_i' ? 50 : (availableSkillCounts[skillKey] || 0);
                const currentVal = mode.id === 'who_am_i' ? whoAmIQuestionCount : (skillQuestionCounts[skillKey] || 0);
                const isExceeded = isSelected && mode.id !== 'islamic' && mode.id !== 'who_am_i' && maxAvail > 0 && currentVal > maxAvail;

                return (
                  <div
                    key={mode.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex flex-col justify-between relative overflow-hidden ${
                      isSelected
                        ? (mode.id === 'who_am_i' ? 'border-indigo-600 bg-indigo-50/60 shadow-md' : 'border-brand-emerald bg-brand-emerald/5 shadow-md')
                        : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {/* Clickable Header for Multi-select Toggle */}
                    <div
                      onClick={() => {
                        if (mode.id === 'who_am_i') {
                          if (isSelected) {
                            setV1GameModes(['complete']);
                          } else {
                            // الاستبعاد المتبادل: اختيار "من أنا؟" يفرغ المهارات الأخرى
                            setV1GameModes(['who_am_i']);
                          }
                          return;
                        }

                        // إذا كان "من أنا؟" محدداً وتم اختيار مهارة أخرى، يتم إلغاء "من أنا؟"
                        if (v1GameModes.includes('who_am_i')) {
                          setV1GameModes([mode.id as any]);
                          if (mode.id !== 'islamic' && (skillQuestionCounts[mode.id as 'audio' | 'complete' | 'surah'] || 0) <= 0) {
                            setSkillQuestionCounts(prev => ({ ...prev, [mode.id]: 5 }));
                          }
                          if (mode.id === 'islamic') {
                            setShowIslamicConfigModal(true);
                          }
                          return;
                        }

                        if (isSelected) {
                          const activeNonHidden = v1GameModes.filter(m => !(m === 'audio' && systemSettings.hideAudioChallenge) && !(m === 'complete' && systemSettings.hideCompletionChallenge) && !(m === 'surah' && systemSettings.hideSurahChallenge) && m !== 'who_am_i');
                          if (activeNonHidden.length <= 1) {
                            alert('يجب اختيار مهارة واحدة على الأقل');
                            return;
                          }
                          setV1GameModes(v1GameModes.filter(m => m !== mode.id));
                        } else {
                          setV1GameModes([...v1GameModes, mode.id as any]);
                          if (mode.id !== 'islamic' && (skillQuestionCounts[mode.id as 'audio' | 'complete' | 'surah'] || 0) <= 0) {
                            setSkillQuestionCounts(prev => ({ ...prev, [mode.id]: 5 }));
                          }
                          if (mode.id === 'islamic') {
                            setShowIslamicConfigModal(true);
                          }
                        }
                      }}
                      className="flex flex-col items-center text-center gap-1.5 cursor-pointer select-none"
                    >
                      <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center mb-0.5 shadow-sm ${
                        isSelected 
                          ? (mode.id === 'who_am_i' ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-brand-emerald text-white shadow-brand-emerald/20')
                          : 'bg-slate-50 text-slate-400'
                      }`}>
                        <mode.icon className="w-5 h-5 md:w-5.5 md:h-5.5" />
                      </div>
                      <div className={`text-xs md:text-sm font-black ${isSelected ? (mode.id === 'who_am_i' ? 'text-indigo-700' : 'text-brand-emerald') : 'text-slate-700'}`}>
                        {mode.label}
                      </div>
                      <div className="text-[9px] md:text-[10px] text-slate-400 font-bold leading-tight line-clamp-2">
                        {mode.desc}
                      </div>
                      {/* Checkbox indicator */}
                      <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                        isSelected ? (mode.id === 'who_am_i' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-brand-emerald text-white shadow-xs') : 'border border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Dynamic Numeric Input for Selected Skill */}
                    {isSelected && mode.id !== 'islamic' && mode.id !== 'who_am_i' && (
                      <div className="mt-2.5 pt-2 border-t border-brand-emerald/20 flex flex-col gap-1 w-full text-right">
                        <div className="flex items-center justify-between text-[10px] font-black">
                          <span className="text-slate-600">عدد الأسئلة:</span>
                          <span className="text-slate-400 font-bold">المتاح: {maxAvail}</span>
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={maxAvail || 100}
                          value={currentVal || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                            setSkillQuestionCounts(prev => ({
                              ...prev,
                              [skillKey]: isNaN(val) ? 0 : Math.max(0, val)
                            }));
                          }}
                          placeholder="عدد الأسئلة"
                          className={`w-full px-2.5 py-2 rounded-xl border-2 font-black text-xs text-center bg-white shadow-xs transition-all focus:outline-none ${
                            isExceeded || currentVal === 0
                              ? 'border-red-400 text-red-600 bg-red-50/40 focus:border-red-500'
                              : 'border-slate-200 focus:border-brand-emerald text-slate-800'
                          }`}
                        />
                        {isExceeded && (
                          <span className="text-[9px] text-red-500 font-black text-center leading-tight">
                            عذراً، أقصى عدد متاح هو {maxAvail}
                          </span>
                        )}
                        {currentVal === 0 && (
                          <span className="text-[9px] text-amber-600 font-bold text-center leading-tight">
                            أدخل 1 على الأقل
                          </span>
                        )}
                      </div>
                    )}

                    {/* Dynamic Summary for Who Am I */}
                    {isSelected && mode.id === 'who_am_i' && (
                      <div className="mt-2.5 pt-2 border-t border-indigo-200 flex flex-col gap-1 w-full text-right">
                        <div className="flex items-center justify-between text-[10px] font-black">
                          <span className="text-indigo-900">الفئات المحددة:</span>
                          <span className="text-indigo-600 font-bold">{selectedWhoAmICategories.length} فئة ({totalConfiguredQuestions} أسئلة)</span>
                        </div>
                        <div className="text-[10px] text-indigo-700 font-bold bg-indigo-100/70 py-1 px-2 rounded-lg truncate text-center">
                          {selectedWhoAmICategories.length > 0 ? selectedWhoAmICategories.join('، ') : 'لم يتم تحديد فئات'}
                        </div>
                      </div>
                    )}

                    {/* Dynamic Indicator for Islamic Quiz */}
                    {isSelected && mode.id === 'islamic' && (
                      <div className="mt-2.5 pt-2 border-t border-brand-emerald/20 flex flex-col gap-1 w-full text-right">
                        <div className="flex items-center justify-between text-[10px] font-black">
                          <span className="text-amber-800">الأسئلة:</span>
                          <span className="text-amber-600 font-bold">
                            {islamicRoomTopics.includes('all') 
                              ? `${islamicTopicQuestionCounts['all'] || 0} سؤال`
                              : `${islamicRoomTopics.reduce((s, t) => s + (islamicTopicQuestionCounts[t] || 0), 0)} سؤال`
                            }
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowIslamicConfigModal(true)}
                          className="w-full py-1.5 text-[10px] font-black bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-xs cursor-pointer"
                        >
                          تخصيص الأسئلة ⚙️
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Islamic Quiz Active Config Banner */}
            {v1GameModes.includes('islamic') && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3.5 p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between text-right gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-amber-900 truncate">
                      {islamicRoomCategories.map(catId => islamicCategoriesList.find(c => c.id === catId)?.title || catId).join('، ')}
                      <span className="mx-1 text-amber-400">•</span>
                      المستوى {islamicRoomLevels.slice().sort().join('، ')}
                      <span className="mx-1 text-amber-400">•</span>
                      {islamicRoomTopics.includes('all') 
                        ? `جميع الموضوعات (${islamicTopicQuestionCounts['all'] || 0} سؤال)` 
                        : `${islamicRoomTopics.length} موضوع (${islamicRoomTopics.reduce((s, t) => s + (islamicTopicQuestionCounts[t] || 0), 0)} سؤال)`
                      }
                    </div>
                    <div className="text-[10px] font-bold text-amber-700/80 mt-0.5">
                      تم تخصيص عدد الأسئلة والمجالات للتحدي الإسلامي بدقة
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIslamicConfigModal(true)}
                  className="px-3.5 py-2 bg-white text-amber-800 text-xs font-black rounded-xl border border-amber-300 shadow-xs hover:bg-amber-100 transition-all shrink-0 cursor-pointer text-center"
                >
                  تخصيص الأسئلة ⚙️
                </button>
              </motion.div>
            )}

            {/* Scope Selector for Quran Challenges (Complete & Surah) in Rooms */}
            {(v1GameModes.includes('complete') || v1GameModes.includes('surah')) && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3.5"
              >
                <ScopeSelector
                  scopeMode={activeScopeMode}
                  setScopeMode={activeSetScopeMode}
                  selectedJuzs={activeSelectedJuzs}
                  setSelectedJuzs={activeSetSelectedJuzs}
                  selectedSurahs={activeSelectedSurahs}
                  setSelectedSurahs={activeSetSelectedSurahs}
                  surahSearch={activeSurahSearch}
                  setSurahSearch={activeSetSurahSearch}
                  title="نطاق أسئلة القرآن (الأجزاء أو السور)"
                  description="حدد أجزاء أو سور معينة لحصر أسئلة التحدي داخلها، وتفعيل مكافأة الحُفّاظ للآيات المتشابهة"
                />

                {/* تنبيه تحذيري عند عدم استيفاء شروط تحدي اسم السورة في الغرفة */}
                {isSurahSelected && !surahRoomValidation.isValid && surahRoomValidation.errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-right text-xs sm:text-sm font-bold shadow-xs"
                  >
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed">
                      {surahRoomValidation.errorMessage}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>

          {v1GameModes.includes('who_am_i') ? (
            <div className="space-y-4 pt-1 text-right" dir="rtl">
              {/* Categories Selection & Customization Box */}
              <div className="p-4 sm:p-5 bg-white border-2 border-indigo-100 rounded-3xl shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-indigo-950">تخصيص فئات وعدد أسئلة التحدي</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                        {selectedWhoAmICategories.length} فئة محددة
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                      اختر فئة واحدة أو عدة فئات وحدد عدد الأسئلة المطلوبة من كل فئة بدقة
                    </p>
                  </div>

                  {/* Random Mixed Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const allCats = whoAmIAvailableCategories.map(c => c.name);
                      setSelectedWhoAmICategories(allCats);
                      const newCounts: Record<string, number> = {};
                      allCats.forEach(c => {
                        newCounts[c] = whoAmICategoryCounts[c] ?? 3;
                      });
                      setWhoAmICategoryCounts(newCounts);
                    }}
                    className="px-3.5 py-2 bg-linear-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <span>🎲 متنوع / مخلط (الكل)</span>
                  </button>
                </div>

                {/* Categories Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1 custom-scrollbar">
                  {whoAmIAvailableCategories.map((cat) => {
                    const isChecked = selectedWhoAmICategories.includes(cat.name);
                    const currentCount = whoAmICategoryCounts[cat.name] ?? 3;

                    return (
                      <div
                        key={cat.name}
                        className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-2.5 ${
                          isChecked
                            ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                            : 'border-slate-100 bg-slate-50/60 opacity-80 hover:opacity-100'
                        }`}
                      >
                        {/* Header with Checkbox */}
                        <div
                          onClick={() => {
                            setSelectedWhoAmICategories(prev => {
                              if (prev.includes(cat.name)) {
                                if (prev.length <= 1) return prev;
                                return prev.filter(c => c !== cat.name);
                              }
                              return [...prev, cat.name];
                            });
                          }}
                          className="flex items-center justify-between cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                              isChecked ? 'bg-indigo-600 text-white shadow-xs' : 'border border-slate-300 bg-white'
                            }`}>
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div>
                              <span className={`text-xs md:text-sm font-black ${isChecked ? 'text-indigo-950' : 'text-slate-700'}`}>
                                {cat.name}
                              </span>
                              {cat.count !== undefined && (
                                <span className="text-[10px] text-slate-400 block font-bold">
                                  المتاح في البنك: {cat.count} سؤال
                                </span>
                              )}
                            </div>
                          </div>

                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            isChecked ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/60 text-slate-500'
                          }`}>
                            {isChecked ? 'محددة ✅' : 'إضافة +'}
                          </span>
                        </div>

                        {/* Number input for question count per category */}
                        {isChecked && (
                          <div className="pt-2.5 border-t border-indigo-200/60 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-black text-indigo-900">عدد الأسئلة:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setWhoAmICategoryCounts(prev => ({
                                    ...prev,
                                    [cat.name]: Math.max(1, (prev[cat.name] ?? 3) - 1)
                                  }));
                                }}
                                className="w-7 h-7 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-black text-sm flex items-center justify-center transition-all cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={cat.count && cat.count > 0 ? cat.count : 50}
                                value={currentCount}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setWhoAmICategoryCounts(prev => ({
                                    ...prev,
                                    [cat.name]: isNaN(val) ? 1 : Math.max(1, val)
                                  }));
                                }}
                                className="w-14 text-center py-1 rounded-lg border-2 border-indigo-200 font-black text-xs text-slate-800 focus:outline-none focus:border-indigo-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setWhoAmICategoryCounts(prev => ({
                                    ...prev,
                                    [cat.name]: (prev[cat.name] ?? 3) + 1
                                  }));
                                }}
                                className="w-7 h-7 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-black text-sm flex items-center justify-center transition-all cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reactive Total Summary */}
              <div className="text-right flex flex-col justify-between p-4 bg-slate-50 border-2 border-indigo-100 rounded-3xl shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-slate-700">إجمالي عدد الأسئلة النهائي في الغرفة</span>
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    توزيع ديناميكي مخلوط 🎲
                  </span>
                </div>
                <div className="flex items-baseline gap-2 my-1">
                  <span className="text-2xl font-black text-indigo-700">
                    {totalConfiguredQuestions}
                  </span>
                  <span className="text-xs font-black text-slate-400">سؤال إجمالي</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500 mt-1">
                  {selectedWhoAmICategories.map(cat => (
                    <span key={cat} className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-indigo-900 font-black">
                      {cat}: {whoAmICategoryCounts[cat] ?? 3}
                    </span>
                  ))}
                </div>
              </div>

              {/* Alert Info */}
              <WhoAmIInfoAlert />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5 pt-1">
                {/* 3. إجمالي عدد الأسئلة التلقائي (Reactive Total Counter) */}
                <div className="text-right flex flex-col justify-between p-3.5 sm:p-4 bg-slate-50 border-2 border-slate-200/80 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-700">إجمالي عدد الأسئلة</span>
                    <span className="text-[10px] font-black text-brand-emerald bg-brand-emerald/10 px-2 py-0.5 rounded-full border border-brand-emerald/20">
                      عداد تلقائي ⚡
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 my-1">
                    <span className={`text-2xl font-black ${hasCountValidationErrors || totalConfiguredQuestions === 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {totalConfiguredQuestions}
                    </span>
                    <span className="text-xs font-black text-slate-400">سؤال إجمالي</span>
                  </div>
                  {totalConfiguredQuestions === 0 && (
                    <p className="text-[10px] font-black text-red-500 mt-1.5">
                      ⚠️ يرجى تحديد عدد الأسئلة لمهارة واحدة على الأقل
                    </p>
                  )}
                  {hasCountValidationErrors && totalConfiguredQuestions > 0 && (
                    <p className="text-[10px] font-black text-red-500 mt-1.5">
                      ⚠️ هناك مهارات أو مواضيع تتجاوز العدد الأقصى المتاح من الأسئلة
                    </p>
                  )}
                </div>

                {/* 4. المؤقت - إدخال حر بالثواني */}
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
                  <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400 font-bold px-1">
                    <span>{v1Timer ? 'الوقت بالثواني المتاح لكل سؤال' : 'انقر على الزر لتفعيل المؤقت'}</span>
                    {v1Timer && <span>(مثال: 15، 30، 60)</span>}
                  </div>
                </div>
              </div>

              {/* 5. طريقة الانتقال بين الأسئلة (Question Transition Mode) */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-2 border-slate-200/80 rounded-2xl shadow-xs space-y-3 text-right">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔄</span>
                    <span className="text-xs font-black text-slate-800">طريقة الانتقال بين الأسئلة</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                    {v1TransitionMode === 'SYNC' ? 'متزامن (سؤال بسؤال)' : 'فردي (سباق حر)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: SYNC */}
                  <button
                    type="button"
                    onClick={() => setV1TransitionMode('SYNC')}
                    className={`p-3.5 sm:p-4 rounded-xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      v1TransitionMode === 'SYNC'
                        ? 'border-orange-500 bg-orange-50/70 shadow-xs ring-2 ring-orange-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${v1TransitionMode === 'SYNC' ? 'text-orange-900' : 'text-slate-800'}`}>
                        متزامن - انتظار الجميع ⏳
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${v1TransitionMode === 'SYNC' ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>
                        {v1TransitionMode === 'SYNC' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                      ينتقل جميع اللاعبين معاً سؤالاً بسؤال عند إجابة الجميع أو انتهاء المؤقت.
                    </p>
                  </button>

                  {/* Option 2: ASYNC */}
                  <button
                    type="button"
                    onClick={() => setV1TransitionMode('ASYNC')}
                    className={`p-3.5 sm:p-4 rounded-xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      v1TransitionMode === 'ASYNC'
                        ? 'border-orange-500 bg-orange-50/70 shadow-xs ring-2 ring-orange-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${v1TransitionMode === 'ASYNC' ? 'text-orange-900' : 'text-slate-800'}`}>
                        تلقائي فردي 🚀
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${v1TransitionMode === 'ASYNC' ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>
                        {v1TransitionMode === 'ASYNC' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                      ينتقل كل لاعب فور إجابته دون انتظار البقية، في سباق سرعة ودقة مستقل.
                    </p>
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="pt-4 space-y-3">
            {isEditMode ? (
              <>
                <button
                  type="button"
                  onClick={onSubmitEdit || handleCreateV1}
                  disabled={isSubmitDisabled}
                  className={`w-full py-3.5 md:py-4 rounded-2xl font-black text-base md:text-lg shadow-xl transition-all flex items-center justify-center gap-3 group/btn ${
                    isSubmitDisabled
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-brand-emerald text-white shadow-brand-emerald/20 hover:bg-brand-emerald/90 hover:scale-[1.01] active:scale-95 cursor-pointer'
                  }`}
                >
                  {isSaving || isCreatingRoom ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
                      <span>حفظ التعديلات</span>
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
                  onClick={handleCreateV1}
                  disabled={isSubmitDisabled}
                  className={`w-full py-3.5 md:py-4 rounded-2xl font-black text-base md:text-lg shadow-xl transition-all flex items-center justify-center gap-3 group/btn ${
                    isSubmitDisabled
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-orange-500 text-white shadow-orange-500/20 hover:bg-orange-600 hover:scale-[1.01] active:scale-95 cursor-pointer'
                  }`}
                >
                  {isCreatingRoom ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : (
                    <>
                      <ArrowLeft className="w-5 h-5 transition-transform group-hover/btn:-translate-x-1" />
                      <span>أنشئ الغرفة الآن</span>
                    </>
                  )}
                </button>

                <button
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
    </motion.div>
  );
};

export default GroupCreatePage;

