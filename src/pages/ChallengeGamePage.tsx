import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2, Users, AlertCircle, Trophy, CheckCircle2, XCircle } from 'lucide-react';
import { View } from '../types/challenges';
import { SkillsChallengeHeader } from '../components/challenge/SkillsChallengeHeader';
import { AudioChallengeUI } from '../components/challenge/AudioChallengeUI';
import { SurahChallengeUI } from '../components/challenge/SurahChallengeUI';
import { CompleteChallengeUI } from '../components/challenge/CompleteChallengeUI';
import { LiveReactionsOverlay } from '../components/LiveReactionsOverlay';
import { useApp } from '../contexts/AppContext';
import { router } from '../services/router';
import { supabase } from '../services/supabase';

export interface ChallengeGamePageProps {
  currentChallenge: any;
  setView: (view: View) => void;
  isSpeedMode: boolean;
  room: any;
  isFreezeActive: boolean;
  speedTimeLeft: number;
  freezeSecondsLeft: number;
  hasAnsweredCurrentQuestion: boolean;
  handleExecuteFreezeTime: () => void;
  freezeTimeCount: number;
  isPowerUpUsedThisQuestion: boolean;
  handleExecuteDeleteTwo: () => void;
  deleteTwoCount: number;
  eliminatedOptionIndices: number[];
  challengeMode: string;
  currentChallengeIndex: number;
  sessionCurrentIndex: number;
  challenges: any[];
  skillsType: any;
  setSkillsType: (type: any) => void;
  v1GameModes: any[];
  KEYWORD: string;
  totalPoints: number;
  handleSkip: () => void;
  isComplete: boolean;
  saveScore: (keyword: string, score: number) => void;
  score: number;
  setDailyCompleted: (completed: boolean) => void;
  updateStatsAfterWin: () => void;
  setChallengeMode: (mode: any) => void;
  isRoomLoading: boolean;
  systemSettings: any;
  targetVerses: any[];
  matchedIds: Set<string>;
  isListening: boolean;
  stopListening: () => void;
  startListening: () => void;
  keywordWordCount: number;
  wordStates: any;
  handlePromptNextChallenge: () => void;
  handleOpenTafsir: (surah: number, ayah: number, text: string) => void;
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
  setRoom: (room: any) => void;
  playerUsername: string | null;
  playerName: string | null;
  transcript: string;
}

export const ChallengeGamePage: React.FC<ChallengeGamePageProps> = ({
  currentChallenge,
  setView,
  isSpeedMode,
  room,
  isFreezeActive,
  speedTimeLeft,
  freezeSecondsLeft,
  hasAnsweredCurrentQuestion,
  handleExecuteFreezeTime,
  freezeTimeCount,
  isPowerUpUsedThisQuestion,
  handleExecuteDeleteTwo,
  deleteTwoCount,
  eliminatedOptionIndices,
  challengeMode,
  currentChallengeIndex,
  sessionCurrentIndex,
  challenges,
  skillsType,
  setSkillsType,
  v1GameModes,
  KEYWORD,
  totalPoints,
  handleSkip,
  isComplete,
  saveScore,
  score,
  setDailyCompleted,
  updateStatsAfterWin,
  setChallengeMode,
  isRoomLoading,
  systemSettings,
  targetVerses,
  matchedIds,
  isListening,
  stopListening,
  startListening,
  keywordWordCount,
  wordStates,
  handlePromptNextChallenge,
  handleOpenTafsir,
  surahInputs,
  setSurahInputs,
  handleSubmitSurah,
  skillsFeedback,
  surahFeedbackData,
  skillsOptions,
  selectedOption,
  handleOptionSelect,
  handleConfirmAnswer,
  skillsCorrectAnswer,
  setRoom,
  playerUsername,
  playerName,
  transcript
}) => {
  const app = useApp();
  const [isEndingRoom, setIsEndingRoom] = useState(false);

  const currentUserId = playerUsername || playerName;
  const isHost = Boolean(
    (room?.host_id && String(currentUserId) === String(room.host_id)) ||
    (room?.player1Id && (String(currentUserId) === String(room.player1Id) || String(currentUserId) === String(room.player1?.id))) ||
    (room?.hostName && playerName && room.hostName === playerName) ||
    (room?.hostUsername && playerUsername && room.hostUsername.toLowerCase() === playerUsername.toLowerCase()) ||
    (room?.player1?.name && playerName && room.player1.name === playerName) ||
    (room?.player1?.username && playerUsername && room.player1.username.toLowerCase() === playerUsername.toLowerCase())
  );

  const totalQuestions = room?.questionCount || challenges.length || room?.challenges?.length || 5;
  const currentQuestionIdx = room?.currentQuestionIndex ?? currentChallengeIndex;
  const isLastQuestion = currentQuestionIdx >= totalQuestions - 1;

  // Supabase Realtime Listener for room completion:
  // When host ends room or status becomes 'completed'/'FINISHED', instantly route all players
  useEffect(() => {
    if (!room?.id) return;

    const handleRoomFinish = () => {
      app?.recordDailyGiftRoomMatch?.();
      router.push('/challenge/results');
      setView('group_game');
    };

    const channel = supabase
      .channel(`room_sync_${room.id}`)
      .on('broadcast', { event: 'room_completed' }, handleRoomFinish)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload: any) => {
        if (payload?.new?.status === 'completed' || payload?.new?.status === 'FINISHED') {
          handleRoomFinish();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Room', filter: `id=eq.${room.id}` }, (payload: any) => {
        if (payload?.new?.status === 'completed' || payload?.new?.status === 'FINISHED') {
          handleRoomFinish();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, setView, app]);

  const handleEndRoom = async () => {
    if (isEndingRoom || !room?.id) return;
    setIsEndingRoom(true);

    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end-room',
          roomId: room.id,
          playerId: playerUsername || playerName
        })
      });
      const data = await res.json();
      if (data && (data.id || data.status)) {
        setRoom(data);
      }
    } catch (e) {
      console.error('[ChallengeGamePage] Error calling end-room:', e);
    }

    try {
      await Promise.allSettled([
        supabase.from('rooms').update({ status: 'completed' }).eq('id', room.id),
        supabase.from('Room').update({ status: 'completed' }).eq('id', room.id)
      ]);
    } catch (sbErr) {
      console.warn('[ChallengeGamePage] Supabase rooms update warning:', sbErr);
    }

    try {
      const channel = supabase.channel(`room_sync_${room.id}`);
      channel.send({
        type: 'broadcast',
        event: 'room_completed',
        payload: { roomId: room.id, status: 'completed' }
      }).catch(() => {});
    } catch (bErr) {
      console.warn('[ChallengeGamePage] Broadcast warning:', bErr);
    }

    app?.recordDailyGiftRoomMatch?.();
    router.push('/challenge/results');
    setView('group_game');
  };
  if (!currentChallenge) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-brand-emerald font-black animate-pulse">جاري التحميل...</p>
      </div>
    );
  }

  if (currentChallenge && !currentChallenge.verseText && !currentChallenge.text) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#fee', color: '#c00', direction: 'ltr', zIndex: 9999, position: 'relative', borderRadius: '2rem', margin: '40px auto', maxWidth: '800px' }} className="glass border-red-200 shadow-2xl">
        <h3 className="text-2xl font-black mb-4">Debug: Missing Verse Data</h3>
        <p className="mb-4 font-bold text-slate-700">The currentChallenge object exists but lacks 'verseText' or 'text' keys.</p>
        <pre className="bg-white/80 p-6 rounded-xl overflow-auto max-h-[400px] border border-red-100 shadow-inner text-sm">{JSON.stringify(currentChallenge, null, 2)}</pre>
        <button onClick={() => setView('home')} className="mt-8 px-8 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg hover:bg-red-700 transition-all">العودة للرئيسية (Back to Home)</button>
      </div>
    );
  }

  return (
    <div key="game" className="space-y-2 md:space-y-4 max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-2 md:px-4 pt-1 md:pt-4">
      {/* Floating Timer UI for Speed Mode or Multiplayer Room with Timer */}
      {(isSpeedMode || (room && (room.timePerQuestion || 0) > 0)) && (
        <div className="flex justify-center mb-2 sticky top-2 z-50">
          <motion.div
            animate={{
              scale: isFreezeActive ? 1.05 : speedTimeLeft <= 5 ? [1, 1.05, 1] : 1,
              backgroundColor: isFreezeActive ? '#e0f2fe' : speedTimeLeft <= 5 ? '#fee2e2' : '#ffffff'
            }}
            transition={{ repeat: speedTimeLeft <= 5 && !isFreezeActive ? Infinity : 0, duration: 0.5 }}
            className={`glass px-3.5 md:px-4 py-1 rounded-full shadow-md border flex items-center gap-2 ${
              isFreezeActive ? 'border-cyan-400 ring-2 ring-cyan-300' : speedTimeLeft <= 5 ? 'border-red-500' : 'border-brand-emerald/20'
            }`}
          >
            <div className={`p-1 rounded-lg ${isFreezeActive ? 'bg-cyan-500 text-white' : speedTimeLeft <= 5 ? 'bg-red-500 text-white' : 'bg-brand-emerald text-white'}`}>
              {isFreezeActive ? <span className="text-xs">🧊</span> : <Zap className="w-3.5 h-3.5" />}
            </div>
            <div className="text-right flex items-center gap-1.5">
              <span className={`text-xs md:text-sm font-black tabular-nums ${isFreezeActive ? 'text-cyan-700' : speedTimeLeft <= 5 ? 'text-red-600' : 'text-slate-800'}`}>
                {isFreezeActive ? `مجمّد! (${freezeSecondsLeft}ث)` : `${speedTimeLeft} ثانية`}
              </span>
              {isSpeedMode && currentChallenge?.level && (
                <span className={`text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  (currentChallenge.level === 'hard' || currentChallenge.level === 'صعب') ? 'bg-rose-100 text-rose-700' :
                  (currentChallenge.level === 'easy' || currentChallenge.level === 'سهل') ? 'bg-emerald-100 text-emerald-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {(currentChallenge.level === 'hard' || currentChallenge.level === 'صعب') ? 'صعب (20ث)' :
                   (currentChallenge.level === 'easy' || currentChallenge.level === 'سهل') ? 'سهل (10ث)' :
                   'متوسط (15ث)'}
                </span>
              )}
            </div>
          </motion.div>
        </div>
      )}

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
              أجاب {room.answeredCount ?? 0} من {room.onlineParticipantsCount ?? room.totalParticipants ?? room.participants?.length ?? 1} لاعبين
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

      {/* Tactical Power-ups HUD (🧊 Freeze Time & ✂️ Delete Two) */}
      <div className="flex items-center justify-center gap-2.5 sm:gap-4 my-2 sm:my-3">
        <button
          type="button"
          onClick={handleExecuteFreezeTime}
          disabled={freezeTimeCount <= 0 || isPowerUpUsedThisQuestion || isFreezeActive || hasAnsweredCurrentQuestion}
          title="تجميد الوقت لمدة 10 ثوانٍ"
          className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl border text-xs sm:text-sm font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
            isFreezeActive
              ? 'bg-cyan-100 text-cyan-800 border-cyan-400 ring-2 ring-cyan-300 animate-pulse'
              : freezeTimeCount > 0 && !isPowerUpUsedThisQuestion && !hasAnsweredCurrentQuestion
              ? 'bg-white hover:bg-cyan-50 text-cyan-700 border-cyan-200 hover:border-cyan-400'
              : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
          }`}
        >
          <span className="text-base leading-none">🧊</span>
          <span>تجميد الوقت</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${freezeTimeCount > 0 ? 'bg-cyan-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
            {freezeTimeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={handleExecuteDeleteTwo}
          disabled={deleteTwoCount <= 0 || isPowerUpUsedThisQuestion || hasAnsweredCurrentQuestion || eliminatedOptionIndices.length > 0}
          title="حذف إجابتين خاطئتين"
          className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl border text-xs sm:text-sm font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
            eliminatedOptionIndices.length > 0
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : deleteTwoCount > 0 && !isPowerUpUsedThisQuestion && !hasAnsweredCurrentQuestion
              ? 'bg-white hover:bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'
              : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
          }`}
        >
          <span className="text-base leading-none">✂️</span>
          <span>حذف إجابتين (50/50)</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${deleteTwoCount > 0 ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
            {deleteTwoCount}
          </span>
        </button>
      </div>

      <SkillsChallengeHeader
        index={challengeMode === 'daily' ? 0 : (currentChallengeIndex)}
        total={challengeMode === 'daily' ? 1 : (challenges.length > 50 ? 20 : Math.max(challenges.length, 1))}
        mode={challengeMode === 'daily' ? 'complete' : skillsType}
        title={challengeMode === 'daily' ? 'التحدي اليومي: إكمال الآية' : (room?.gameMode === 'ISLAMIC' || v1GameModes.includes('islamic') ? 'تحدي معلومات إسلامية' : undefined)}
        verseText={KEYWORD}
        totalPoints={totalPoints}
        onSkip={challengeMode !== 'daily' ? handleSkip : undefined}
        isComplete={isComplete}
        level={currentChallenge?.level}
        isDaily={challengeMode === 'daily'}
        onFinishDaily={() => {
          saveScore(KEYWORD, score);
          const todayStr = new Date().toISOString().split('T')[0];
          localStorage.setItem('quran_daily_completed', todayStr);
          setDailyCompleted(true);
          updateStatsAfterWin();
          setChallengeMode('normal');
          setView('home');
        }}
      />

      {isRoomLoading ? (
        <div className="flex flex-col items-center justify-center py-28 text-center bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-12 h-12 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100 mb-1">
            جاري استعادة بيانات الغرفة ونوع التحدي...
          </h3>
          <p className="text-xs text-slate-400 font-bold">
            يرجى الانتظار لحظات لمزامنة الجولة الحالية
          </p>
        </div>
      ) : skillsType === 'audio' && !systemSettings.hideAudioChallenge && challengeMode !== 'daily' ? (
        <AudioChallengeUI
          targetVerses={targetVerses}
          matchedIds={matchedIds}
          isListening={isListening}
          onToggleListening={isListening ? stopListening : startListening}
          keyword={KEYWORD}
          keywordWordCount={keywordWordCount}
          wordStates={wordStates}
          onSkip={handleSkip}
          isComplete={isComplete}
          challengeMode={challengeMode}
          saveScore={saveScore}
          KEYWORD={KEYWORD}
          score={score}
          setDailyCompleted={setDailyCompleted}
          updateStatsAfterWin={updateStatsAfterWin}
          handlePromptNextChallenge={handlePromptNextChallenge}
          onViewTafsir={handleOpenTafsir}
          isRoom={!!room}
          isHost={isHost}
          isLastQuestion={isLastQuestion}
          onEndRoom={handleEndRoom}
          isEndingRoom={isEndingRoom}
        />
      ) : skillsType === 'surah' && !systemSettings.hideSurahChallenge && challengeMode !== 'daily' ? (
        <SurahChallengeUI
          verseText={KEYWORD}
          inputs={surahInputs}
          onInputChange={(idx: number, val: string) => {
            const newInputs = [...surahInputs];
            newInputs[idx] = val;
            setSurahInputs(newInputs);
          }}
          onSubmit={handleSubmitSurah}
          feedback={skillsFeedback}
          onSkip={handleSkip}
          isComplete={isComplete}
          challengeMode={challengeMode}
          saveScore={saveScore}
          KEYWORD={KEYWORD}
          score={score}
          setDailyCompleted={setDailyCompleted}
          updateStatsAfterWin={updateStatsAfterWin}
          handlePromptNextChallenge={handlePromptNextChallenge}
          onViewTafsir={handleOpenTafsir}
          currentChallenge={currentChallenge}
          surahFeedbackData={surahFeedbackData}
          isRoom={!!room}
          isHost={isHost}
          isLastQuestion={isLastQuestion}
          onEndRoom={handleEndRoom}
          isEndingRoom={isEndingRoom}
        />
      ) : ((skillsType === 'complete' && !systemSettings.hideCompletionChallenge) || challengeMode === 'daily') ? (
        <CompleteChallengeUI
          verseText={KEYWORD}
          options={skillsOptions || []}
          selectedOption={selectedOption}
          onOptionSelect={handleOptionSelect}
          onConfirm={handleConfirmAnswer}
          feedback={skillsFeedback}
          correctText={skillsCorrectAnswer || currentChallenge?.correctText}
          onSkip={challengeMode !== 'daily' ? handleSkip : undefined}
          isComplete={isComplete}
          challengeMode={challengeMode}
          saveScore={saveScore}
          KEYWORD={KEYWORD}
          score={score}
          setDailyCompleted={setDailyCompleted}
          updateStatsAfterWin={updateStatsAfterWin}
          handlePromptNextChallenge={handlePromptNextChallenge}
          onViewTafsir={handleOpenTafsir}
          currentChallenge={currentChallenge}
          eliminatedIndices={eliminatedOptionIndices}
          isRoom={!!room}
          isHost={isHost}
          isLastQuestion={isLastQuestion}
          onEndRoom={handleEndRoom}
          isEndingRoom={isEndingRoom}
          onFinishDaily={() => {
            setChallengeMode('normal');
            setView('home');
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">حدث خطأ في مزامنة الغرفة</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-5 leading-relaxed">
            تعذر تحديد نوع التحدي للغرفة أو تم تعطيل هذا التحدي في إعدادات التطبيق.
          </p>
          <button
            type="button"
            onClick={() => {
              setRoom(null);
              setSkillsType(null);
              localStorage.removeItem('activeRoomId');
              setView('group_join');
            }}
            className="px-6 py-2.5 rounded-2xl bg-brand-emerald text-white text-xs font-black shadow-md shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all cursor-pointer"
          >
            العودة لقائمة الغرف
          </button>
        </div>
      )}

      {/* Participants Answer Status for the active question in room mode */}
      {room && (hasAnsweredCurrentQuestion || skillsFeedback || (room.transitionMode !== 'ASYNC' && speedTimeLeft <= 0)) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 sm:p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 my-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-emerald" />
              <span>إجابات اللاعبين {isLastQuestion ? '(السؤال الأخير 🏁)' : ''}</span>
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              {room.answeredCount ?? Object.keys(room.currentAnswers || {}).filter(k => k !== '_firstCorrectUserId' && k !== '__lastReaction').length} من {(room.participants || []).length || 1} أجابوا
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {(room.participants || []).map((p: any) => {
              const pId = String(p.id);
              const ans = room.currentAnswers?.[pId] || room.currentAnswers?.[p.username] || room.currentAnswers?.[p.name];
              const isMe = p.name === playerName || p.username === playerUsername || pId === String(currentUserId);
              const hasAns = Boolean(ans && (ans.questionIndex === undefined || ans.questionIndex === currentQuestionIdx));
              const isAnsCorrect = hasAns && Boolean(ans.isCorrect);

              return (
                <div
                  key={pId}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                    !hasAns
                      ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                      : isAnsCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-bold'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{p.name || p.username || 'لاعب'}</span>
                    {isMe && <span className="text-[10px] opacity-75">(أنت)</span>}
                  </span>
                  <span className="shrink-0 flex items-center gap-1 text-[11px]">
                    {!hasAns ? (
                      <span className="text-slate-400 font-normal">بانتظار الإجابة...</span>
                    ) : isAnsCorrect ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>أصاب (+1)</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>أخطأ</span>
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* End Room Action for Host / Waiting state for players on the final question */}
      {room && isLastQuestion && (hasAnsweredCurrentQuestion || skillsFeedback || (room.transitionMode !== 'ASYNC' && speedTimeLeft <= 0)) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-brand-emerald/10 to-teal-500/10 border-2 border-brand-emerald/30 shadow-md text-center space-y-3 mt-4"
        >
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
              اكتملت جميع أسئلة التحدي! 🏁
            </h4>
          </div>

          {isHost ? (
            <button
              type="button"
              onClick={handleEndRoom}
              disabled={isEndingRoom}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-brand-emerald to-teal-600 hover:from-brand-emerald/90 hover:to-teal-700 text-white font-black text-sm sm:text-base shadow-lg shadow-brand-emerald/30 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isEndingRoom ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري إنهاء التحدي والانتقال للنتائج...</span>
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5 text-amber-300" />
                  <span>إنهاء الغرفة وإظهار النتائج</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-amber-200 dark:border-amber-700/40 text-amber-800 dark:text-amber-200 text-xs sm:text-sm font-black">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span>في انتظار القائد لإنهاء التحدي</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Live Reactions in Challenge / Room Game */}
      {room && (
        <LiveReactionsOverlay
          roomId={room.id}
          playerId={playerUsername || playerName || undefined}
          playerName={playerName || undefined}
          incomingReaction={room.lastReaction || room.playersProgress?.__lastReaction}
        />
      )}

      {/* Transcript Debug */}
      <AnimatePresence>
        {isListening && transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 md:p-8 glass bg-brand-gold/5 border-brand-gold/10 rounded-2xl md:rounded-3xl text-slate-700 text-center quran-text text-lg md:text-xl italic mt-6"
          >
            "{transcript}"
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChallengeGamePage;

