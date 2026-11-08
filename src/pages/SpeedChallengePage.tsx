import React from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertCircle, RotateCcw, Loader2, Users, Plus, ShoppingBag } from 'lucide-react';
import { View } from '../types/challenges';
import { SkillsChallengeHeader } from '../components/challenge/SkillsChallengeHeader';
import { AudioChallengeUI } from '../components/challenge/AudioChallengeUI';
import { SurahChallengeUI } from '../components/challenge/SurahChallengeUI';
import { CompleteChallengeUI } from '../components/challenge/CompleteChallengeUI';
import { LiveReactionsOverlay } from '../components/LiveReactionsOverlay';
import { useApp } from '../contexts/AppContext';

export interface SpeedChallengePageProps {
  speedTimeLeft: number;
  currentChallenge: any;
  speedTotalTimeSpent: number;
  isSpeedGameOver: boolean;
  handleStartSpeedChallenge: () => void;
  setView: (view: View) => void;
  room: any;
  hasAnsweredCurrentQuestion: boolean;
  handleExecuteFreezeTime: () => void;
  freezeTimeCount: number;
  isPowerUpUsedThisQuestion: boolean;
  isFreezeActive: boolean;
  handleExecuteDeleteTwo: () => void;
  deleteTwoCount: number;
  eliminatedOptionIndices: number[];
  skillsType: any;
  KEYWORD: string;
  totalPoints: number;
  targetVerses: any[];
  matchedIds: Set<string>;
  isListening: boolean;
  stopListening: () => void;
  startListening: () => void;
  keywordWordCount: number;
  wordStates: Record<string, Record<number, 'correct' | 'skipped'>>;
  surahInputs: string[];
  setSurahInputs: (inputs: string[]) => void;
  handleSubmitSurah: () => void;
  skillsFeedback: boolean;
  surahFeedbackData: any;
  skillsOptions: any[];
  selectedOption: any;
  handleOptionSelect: (option: any) => void;
  handleConfirmAnswer: () => void;
  skillsCorrectAnswer: any;
  playerUsername: string | null;
  playerName: string | null;
  handleSurahInputChange?: (idx: number, val: string) => void;
}

export const SpeedChallengePage: React.FC<SpeedChallengePageProps> = ({
  speedTimeLeft,
  currentChallenge,
  speedTotalTimeSpent,
  isSpeedGameOver,
  handleStartSpeedChallenge,
  setView,
  room,
  hasAnsweredCurrentQuestion,
  handleExecuteFreezeTime,
  freezeTimeCount,
  isPowerUpUsedThisQuestion,
  isFreezeActive,
  handleExecuteDeleteTwo,
  deleteTwoCount,
  eliminatedOptionIndices,
  skillsType,
  KEYWORD,
  totalPoints,
  targetVerses,
  matchedIds,
  isListening,
  stopListening,
  startListening,
  keywordWordCount,
  wordStates,
  surahInputs,
  setSurahInputs,
  handleSurahInputChange,
  handleSubmitSurah,
  skillsFeedback,
  surahFeedbackData,
  skillsOptions,
  selectedOption,
  handleOptionSelect,
  handleConfirmAnswer,
  skillsCorrectAnswer,
  playerUsername,
  playerName
}) => {
  const app = useApp();
  const powerups = app?.powerups || { freeze: freezeTimeCount || 0, fiftyFifty: deleteTwoCount || 0 };
  const buyPowerup = app?.buyPowerup || ((_type: 'freeze' | 'fiftyFifty') => false);

  const hasActiveTimer = true;
  const isManualInputOrAudio = skillsType === 'surah' || skillsType === 'audio' || room?.gameMode === 'surah';
  const hasMultipleChoiceOptions = !isManualInputOrAudio && Boolean(
    skillsType === 'complete' ||
    (Array.isArray(skillsOptions) && skillsOptions.length > 2) ||
    (Array.isArray(currentChallenge?.options) && currentChallenge.options.length > 2)
  );

  return (
    <motion.div
      key="speed_challenge"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-6 max-w-3xl mx-auto py-4 md:py-6 px-4 min-h-[60vh]"
    >
      {/* Floating Timer UI */}
      <div className="flex justify-center mb-4 sticky top-4 z-50">
        <motion.div
          animate={{
            scale: speedTimeLeft <= 10 ? [1, 1.05, 1] : 1,
            backgroundColor: speedTimeLeft <= 10 ? '#fee2e2' : '#ffffff'
          }}
          transition={{ repeat: speedTimeLeft <= 10 ? Infinity : 0, duration: 0.5 }}
          className={`glass px-5 md:px-7 py-2 md:py-2.5 rounded-full shadow-xl border-2 flex items-center gap-3 md:gap-4 ${speedTimeLeft <= 10 ? 'border-red-500' : 'border-brand-emerald/20'}`}
        >
          <div className={`p-1.5 md:p-2 rounded-xl ${speedTimeLeft <= 10 ? 'bg-red-500 text-white' : 'bg-brand-emerald text-white'}`}>
            <Zap className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="text-right">
            <span className={`text-base md:text-xl font-black block tabular-nums ${speedTimeLeft <= 10 ? 'text-red-600' : 'text-slate-800'}`}>
              {speedTimeLeft} ثانية
            </span>
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">
              الوقت المتبقي للآية ({
                (currentChallenge?.level === 'hard' || currentChallenge?.level === 'صعب') ? 'صعب: 20ث' :
                (currentChallenge?.level === 'easy' || currentChallenge?.level === 'سهل') ? 'سهل: 10ث' :
                'متوسط: 15ث'
              })
            </span>
          </div>
          <div className="w-px h-7 bg-slate-100 mx-1" />
          <div className="text-right">
            <span className="text-sm md:text-base font-black text-brand-emerald block tabular-nums">
              {Math.floor(speedTotalTimeSpent / 60)}:{String(speedTotalTimeSpent % 60).padStart(2, '0')}
            </span>
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">إجمالي الوقت</span>
          </div>
        </motion.div>
      </div>

      {isSpeedGameOver ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-6 md:p-8 rounded-3xl text-center border-red-200 shadow-xl relative overflow-hidden my-6 max-w-md mx-auto"
        >
          <div className="absolute inset-0 bg-red-50/50" />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">انتهى الوقت!</h2>
            <p className="text-sm md:text-base text-slate-600 font-bold mb-6 leading-relaxed">
              لا بأس، استعن بالله وعاود المحاولة
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleStartSpeedChallenge}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-sm md:text-base shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                كرر المحاولة
              </button>
              <button
                onClick={() => setView('home')}
                className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-500 rounded-xl font-bold text-sm md:text-base hover:bg-slate-50 transition-all"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-2 md:px-4 pt-2 md:pt-4">
          {/* Multiplayer Real-time Question Counter & Speed Bonus Indicator */}
          {room && room.transitionMode !== 'ASYNC' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 md:p-3.5 bg-linear-to-r from-slate-900/90 to-slate-800/90 text-white rounded-2xl border border-white/10 shadow-lg mb-4 text-xs font-bold"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-white font-black text-xs md:text-sm">
                  أجاب {room.answeredCount ?? 0} من {room.totalParticipants ?? room.participants?.length ?? 1} لاعبين
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-xl border border-amber-400/30 text-[11px] font-black">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>أول 4 إجابات صحيحة تنال بونص سرعة (+1) ⚡</span>
              </div>
            </motion.div>
          )}

          {room && room.transitionMode === 'ASYNC' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-2.5 p-3 md:p-3.5 bg-linear-to-r from-slate-900/90 to-slate-800/90 text-white rounded-2xl border border-white/10 shadow-lg mb-4 text-xs font-bold"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🚀</span>
                <span className="text-white font-black text-xs md:text-sm">
                  سباق فردي سريع (أجب بأقصى سرعة ودقة!)
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-xl border border-amber-400/30 text-[11px] font-black">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>أول 4 إجابات صحيحة تنال بونص سرعة (+1) ⚡</span>
              </div>
            </motion.div>
          )}

          {/* Multiplayer Waiting State after answering - Placed ABOVE the question (Only in SYNC mode) */}
          {room && room.transitionMode !== 'ASYNC' && hasAnsweredCurrentQuestion && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="mb-4 p-3.5 md:p-4 rounded-2xl bg-linear-to-r from-amber-50 via-orange-50/80 to-amber-50 border-2 border-amber-300 shadow-md text-center space-y-2"
            >
              <div className="flex items-center justify-center gap-2.5">
                <div className="w-7 h-7 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <h4 className="text-sm md:text-base font-black text-amber-900">
                  تم تسجيل إجابتك بنجاح، بانتظار باقي المتسابقين...
                </h4>
              </div>
              <p className="text-[11px] md:text-xs text-amber-700 font-bold max-w-lg mx-auto leading-relaxed">
                سينتقل الجميع تلقائياً إلى السؤال التالي فور اكتمال إجابات اللاعبين أو انتهاء وقت السؤال.
              </p>
              <div className="inline-flex items-center gap-2 bg-white px-3.5 py-1 rounded-full border border-amber-200 text-[11px] font-black text-amber-800 shadow-xs">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>أجاب ({room.answeredCount ?? 0} من {room.onlineParticipantsCount ?? room.totalParticipants ?? room.participants?.length ?? 1})</span>
              </div>
            </motion.div>
          )}

          {/* Power-ups HUD & Store (المخزون والمتجر) */}
          <div className="w-full max-w-lg mx-auto my-2 px-1 space-y-2">
            {/* Top Action Buttons (Usage from Inventory) */}
            <div className="flex items-center justify-center gap-2.5 sm:gap-4">
              {/* Freeze Time Action Button */}
              {hasActiveTimer && (
                <button
                  type="button"
                  onClick={handleExecuteFreezeTime}
                  disabled={isPowerUpUsedThisQuestion || isFreezeActive || hasAnsweredCurrentQuestion}
                  title={
                    (powerups.freeze || 0) <= 0
                      ? 'رصيدك صفر، قم بالشراء من المتجر أدناه'
                      : 'تجميد الوقت لمدة 10 ثوانٍ'
                  }
                  className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl border text-xs sm:text-sm font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
                    isFreezeActive
                      ? 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border-cyan-400 ring-2 ring-cyan-300 animate-pulse'
                      : isPowerUpUsedThisQuestion || hasAnsweredCurrentQuestion
                      ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                      : (powerups.freeze || 0) > 0
                      ? 'bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700 hover:border-cyan-400'
                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-60'
                  }`}
                >
                  <span className="text-base leading-none">🧊</span>
                  <span>تجميد الوقت</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-black transition-all ${
                      (powerups.freeze || 0) > 0
                        ? 'bg-cyan-500 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    {powerups.freeze || 0}
                  </span>
                </button>
              )}

              {/* 50/50 Delete Two Action Button */}
              {hasMultipleChoiceOptions && (
                <button
                  type="button"
                  onClick={handleExecuteDeleteTwo}
                  disabled={
                    isPowerUpUsedThisQuestion ||
                    hasAnsweredCurrentQuestion ||
                    eliminatedOptionIndices.length > 0
                  }
                  title={
                    (powerups.fiftyFifty || 0) <= 0
                      ? 'رصيدك صفر، قم بالشراء من المتجر أدناه'
                      : 'حذف إجابتين خاطئتين'
                  }
                  className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl border text-xs sm:text-sm font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
                    eliminatedOptionIndices.length > 0
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-400 ring-2 ring-amber-300'
                      : isPowerUpUsedThisQuestion || hasAnsweredCurrentQuestion
                      ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                      : (powerups.fiftyFifty || 0) > 0
                      ? 'bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:border-amber-400'
                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-60'
                  }`}
                >
                  <span className="text-base leading-none">✂️</span>
                  <span>حذف إجابتين (50/50)</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-black transition-all ${
                      (powerups.fiftyFifty || 0) > 0
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    {powerups.fiftyFifty || 0}
                  </span>
                </button>
              )}
            </div>

            {/* Store Bar (متجر الشراء للمخزون) */}
            <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-amber-500/10 dark:from-slate-800/80 dark:to-slate-800/80 p-2 sm:p-2.5 rounded-2xl border border-amber-500/20 backdrop-blur-md shadow-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400">
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                <span>متجر المساعدات:</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold hidden sm:inline">(اشترِ وخزّن في رصيدك)</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {hasActiveTimer && (
                  <button
                    type="button"
                    onClick={() => buyPowerup('freeze')}
                    title={`شراء 1 تجميد وقت وإضافته للمخزون بـ 30 نقطة (رصيدك: ${totalPoints})`}
                    disabled={totalPoints < 30}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-black transition-all cursor-pointer ${
                      totalPoints >= 30
                        ? 'bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700/60 active:scale-95 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span>تجميد وقت</span>
                    <span className="font-mono text-[10px] opacity-80">(-30ن)</span>
                  </button>
                )}

                {hasMultipleChoiceOptions && (
                  <button
                    type="button"
                    onClick={() => buyPowerup('fiftyFifty')}
                    title={`شراء 1 حذف إجابتين وإضافته للمخزون بـ 50 نقطة (رصيدك: ${totalPoints})`}
                    disabled={totalPoints < 50}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-black transition-all cursor-pointer ${
                      totalPoints >= 50
                        ? 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 active:scale-95 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>حذف إجابتين</span>
                    <span className="font-mono text-[10px] opacity-80">(-50ن)</span>
                  </button>
                )}

                <div className="flex items-center gap-1 bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black text-amber-700 dark:text-amber-300">
                  <span>🪙</span>
                  <span>{totalPoints}</span>
                </div>
              </div>
            </div>
          </div>
          <SkillsChallengeHeader
            mode={skillsType}
            verseText={KEYWORD}
            totalPoints={totalPoints}
            level={currentChallenge?.level}
          />

          {skillsType === 'audio' ? (
            <AudioChallengeUI
              targetVerses={targetVerses}
              matchedIds={matchedIds}
              isListening={isListening}
              onToggleListening={isListening ? stopListening : startListening}
              keyword={KEYWORD}
              keywordWordCount={keywordWordCount}
              wordStates={wordStates}
            />
          ) : skillsType === 'surah' ? (
            <SurahChallengeUI
              verseText={KEYWORD}
              inputs={surahInputs}
              onInputChange={handleSurahInputChange || ((idx: number, val: string) => {
                const newInputs = [...surahInputs];
                newInputs[idx] = val;
                setSurahInputs(newInputs);
              })}
              onSubmit={handleSubmitSurah}
              feedback={skillsFeedback}
              surahFeedbackData={surahFeedbackData}
            />
          ) : (
            <CompleteChallengeUI
              verseText={KEYWORD}
              options={skillsOptions || []}
              selectedOption={selectedOption}
              onOptionSelect={handleOptionSelect}
              onConfirm={handleConfirmAnswer}
              feedback={skillsFeedback}
              correctText={skillsCorrectAnswer || currentChallenge?.correctText}
              currentChallenge={currentChallenge}
              eliminatedIndices={eliminatedOptionIndices}
            />
          )}

          {/* Live Reactions in Group Game */}
          {room && (
            <LiveReactionsOverlay
              roomId={room.id}
              playerId={playerUsername || playerName || undefined}
              playerName={playerName || undefined}
              incomingReaction={room.lastReaction || room.playersProgress?.__lastReaction}
            />
          )}
        </div>
      )}
    </motion.div>
  );
};

export default SpeedChallengePage;

