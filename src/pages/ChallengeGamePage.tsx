import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2, Users, AlertCircle, Trophy, CheckCircle2, XCircle, Plus, ShoppingBag, Settings, LogOut, Trash2, X } from 'lucide-react';
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
  handleSurahInputChange?: (idx: number, val: string) => void;
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
  transcript,
  handleSurahInputChange
}) => {
  const app = useApp();
  const powerups = app?.powerups || { freeze: freezeTimeCount || 0, fiftyFifty: deleteTwoCount || 0 };
  const buyPowerup = app?.buyPowerup || ((_type: 'freeze' | 'fiftyFifty') => false);
  const appRef = useRef(app);
  useEffect(() => {
    appRef.current = app;
  });
  const [isEndingRoom, setIsEndingRoom] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const isMultiplayer = Boolean(room?.id || (room as any)?.room_code || room?.host_id || (room as any)?.participants?.length);

  const currentUserId = playerUsername || playerName;
  const isHost = Boolean(
    (room?.host_id && String(currentUserId) === String(room.host_id)) ||
    (room?.player1Id && (String(currentUserId) === String(room.player1Id) || String(currentUserId) === String(room.player1?.id))) ||
    (room?.hostName && playerName && room.hostName === playerName) ||
    (room?.hostUsername && playerUsername && room.hostUsername.toLowerCase() === playerUsername.toLowerCase()) ||
    (room?.player1?.name && playerName && room.player1.name === playerName) ||
    (room?.player1?.username && playerUsername && room.player1.username.toLowerCase() === playerUsername.toLowerCase())
  );

  // Supabase Presence: online IDs tracked in AppContext
  const roomPresenceOnlineIds: Set<string | number> = (app as any)?.roomPresenceOnlineIds || new Set();

  // Host migration: if original host is offline, first online non-host participant acts as effective host
  const presenceReady = roomPresenceOnlineIds.size > 0;
  const participants = room?.participants || [];

  const isParticipantOnlineFn = (p: any): boolean => {
    const isMe = p.name === playerName || p.username === playerUsername || String(p.id) === String(currentUserId);
    if (isMe) return true;
    if (p.isOnline === false) return false;
    if (!presenceReady) return true;
    return (
      (p.id != null && roomPresenceOnlineIds.has(String(p.id))) ||
      (p.name && roomPresenceOnlineIds.has(String(p.name).trim().toLowerCase())) ||
      (p.username && roomPresenceOnlineIds.has(String(p.username).trim().toLowerCase().replace(/^@+/, '')))
    );
  };

  const hostParticipant = participants.find((p: any) =>
    String(p.id) === String(room?.player1Id) ||
    (p.name && room?.player1?.name && p.name === room.player1.name) ||
    (p.username && room?.player1?.username && p.username === room.player1.username)
  );
  const hostIsOffline = presenceReady && hostParticipant ? !isParticipantOnlineFn(hostParticipant) : false;

  const onlineNonHostParticipants = participants.filter((p: any) =>
    !( String(p.id) === String(room?.player1Id) ||
       (p.name && room?.player1?.name && p.name === room.player1.name) ||
       (p.username && room?.player1?.username && p.username === room.player1.username) ) &&
    isParticipantOnlineFn(p)
  );
  const amIFirstOnline = Boolean(
    onlineNonHostParticipants[0] && (
      onlineNonHostParticipants[0].name === playerName ||
      onlineNonHostParticipants[0].username === playerUsername
    )
  );

  // isEffectiveHost = original host OR (host offline AND I am first online non-host)
  const isEffectiveHost = isHost || (hostIsOffline && amIFirstOnline);

  const isWhoAmI = Boolean(
    room?.gameMode === 'WHO_AM_I' ||
    room?.challenge_type === 'who_am_i' ||
    room?.challengeType === 'who_am_i' ||
    skillsType === 'who_am_i' ||
    (Array.isArray(v1GameModes) && v1GameModes.includes('who_am_i'))
  );

  const totalQuestions = room?.questionCount || challenges.length || room?.challenges?.length || 5;
  const currentQuestionIdx = room?.currentQuestionIndex ?? currentChallengeIndex;
  const isLastQuestion = currentQuestionIdx >= totalQuestions - 1;

  // Track advancing question state to avoid race conditions or double requests
  const advancingQuestionRef = useRef<number | null>(null);

  // Active online participants (excluding resigned/abandoned/left)
  const activeOnlineParticipants = participants.filter((p: any) => {
    const pProg = room?.playersProgress ? room.playersProgress[String(p.id)] : null;
    const isWithdrawn = Boolean(
      p.hasLeft || (pProg && pProg.hasLeft) ||
      p.isResigned || (pProg && pProg.isResigned) ||
      p.isAbandoned || (pProg && pProg.isAbandoned) ||
      p.status === 'abandoned' || (pProg && pProg.status === 'abandoned')
    );
    return !isWithdrawn && isParticipantOnlineFn(p);
  });

  const activeCount = activeOnlineParticipants.length;
  const currentAnswers = room?.currentAnswers || {};
  const validAnswersCount = activeOnlineParticipants.filter((p: any) => {
    const pId = String(p.id);
    const ans = currentAnswers[pId] || currentAnswers[p.username] || currentAnswers[p.name];
    const hasCurrentAnswer = Boolean(ans && (ans.questionIndex === undefined || ans.questionIndex === currentQuestionIdx));
    const pProg = room?.playersProgress ? (room.playersProgress[pId] || room.playersProgress[p.username] || room.playersProgress[p.name]) : null;
    const hasProgressAnswer = Boolean(pProg && ((pProg.playerCurrentQuestionIndex !== undefined && pProg.playerCurrentQuestionIndex > currentQuestionIdx) || (isLastQuestion && pProg.progress === 100)));
    return hasCurrentAnswer || hasProgressAnswer;
  }).length;

  const hasAllAnswered = activeCount > 0 && validAnswersCount >= activeCount;

  // Supabase Realtime Listener for room events:
  // Listens to status completion, question advancements, and player answers
  useEffect(() => {
    if (!room?.id) return;

    const handleRoomFinish = () => {
      app?.recordDailyGiftRoomMatch?.();
      router.push('/challenge/results');
      setView('group_game');
    };

    const handleRoomUpdate = (updated: any) => {
      if (!updated) return;
      if (updated.status === 'completed' || updated.status === 'FINISHED') {
        handleRoomFinish();
        return;
      }
      setRoom((prev: any) => prev ? ({ ...prev, ...updated }) : updated);
      if (updated.currentQuestionIndex !== undefined && updated.currentQuestionIndex > currentQuestionIdx) {
        advancingQuestionRef.current = null;
        app?.resetQuestionUIState?.(updated.currentQuestionIndex, updated);
      }
    };

    const channelName = `room_sync_${room.id}`;
    const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      try {
        supabase.removeChannel(existingChannel);
      } catch (_) {}
    }

    const channel = supabase.channel(channelName);
    channel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload: any) => {
        handleRoomUpdate(payload?.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Room', filter: `id=eq.${room.id}` }, (payload: any) => {
        handleRoomUpdate(payload?.new);
      })
      .on('broadcast', { event: 'room_completed' }, handleRoomFinish)
      .on('broadcast', { event: 'question_advanced' }, (payload: any) => {
        const advData = payload?.payload || payload;
        if (advData?.isFinished || advData?.room?.status === 'FINISHED' || advData?.room?.status === 'completed') {
          handleRoomFinish();
          return;
        }
        const nextQ = advData?.currentQuestionIndex;
        if (nextQ !== undefined && nextQ > currentQuestionIdx) {
          advancingQuestionRef.current = null;
          app?.resetQuestionUIState?.(nextQ, advData?.room);
          if (advData?.room) {
            setRoom(advData.room);
          }
        }
      })
      .on('broadcast', { event: 'player_answered' }, (payload: any) => {
        const ansData = payload?.payload || payload;
        if (ansData?.currentAnswers) {
          setRoom((prev: any) => prev ? ({
            ...prev,
            currentAnswers: ansData.currentAnswers,
            playersProgress: ansData.playersProgress || prev.playersProgress
          }) : prev);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[ChallengeGamePage] تم الاشتراك في قناة الغرفة بنجاح: ${channelName}`);
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [room?.id, setView, app, currentQuestionIdx, setRoom]);

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
      const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:room_sync_${room.id}`);
      if (existingChannel && existingChannel.state === 'joined') {
        existingChannel.send({
          type: 'broadcast',
          event: 'room_completed',
          payload: { roomId: room.id, status: 'completed' }
        }).catch(() => {});
      } else {
        const sendCh = supabase.channel(`room_sync_${room.id}`);
        sendCh.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            sendCh.send({
              type: 'broadcast',
              event: 'room_completed',
              payload: { roomId: room.id, status: 'completed' }
            }).finally(() => {
              try {
                supabase.removeChannel(sendCh);
              } catch (_) {}
            });
          }
        });
      }
    } catch (bErr) {
      console.warn('[ChallengeGamePage] Broadcast warning:', bErr);
    }

    appRef.current?.recordDailyGiftRoomMatch?.();
    router.push('/challenge/results');
    setView('group_game');
  };

  // ── Unified Question Transition & Finalization Logic ──
  // Triggers when all active participants have completed their answer for the current question
  const isTransitioningRef = useRef<boolean>(false);

  useEffect(() => {
    isTransitioningRef.current = false;
  }, [room?.id, currentQuestionIdx]);

  useEffect(() => {
    if (!room?.id || room.status !== 'PLAYING' || !hasAllAnswered || isWhoAmI) {
      return;
    }

    if (isTransitioningRef.current) return;

    if (isLastQuestion) {
      // ⚠️ هذا هو السؤال الأخير: يجب إنهاء التحدي وتوجيه الجميع لشاشة النتيجة
      const delay = isEffectiveHost ? 1500 : 2500;
      const timer = setTimeout(() => {
        if (isTransitioningRef.current) return;
        isTransitioningRef.current = true;
        handleEndRoom();
      }, delay);
      return () => clearTimeout(timer);
    } else {
      // الانتقال للسؤال التالي بشكل طبيعي
      if (advancingQuestionRef.current === currentQuestionIdx) return;
      const delay = isEffectiveHost ? 1000 : 2500;
      const timer = setTimeout(async () => {
        if (advancingQuestionRef.current === currentQuestionIdx || isTransitioningRef.current) return;
        advancingQuestionRef.current = currentQuestionIdx;
        isTransitioningRef.current = true;

        try {
          const res = await fetch('/api/1v1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'advance-question',
              roomId: room.id,
              playerId: playerUsername || playerName,
              questionIndex: currentQuestionIdx
            })
          });
          const data = await res.json();
          if (data) {
            if (data.status === 'completed' || data.status === 'FINISHED' || data.currentQuestionIndex >= totalQuestions) {
              handleEndRoom();
            } else if (data.currentQuestionIndex > currentQuestionIdx) {
              advancingQuestionRef.current = null;
              isTransitioningRef.current = false;
              appRef.current?.resetQuestionUIState?.(data.currentQuestionIndex, data);
              setRoom(data);
              try {
                supabase.channel(`room_sync_${room.id}`).send({
                  type: 'broadcast',
                  event: 'question_advanced',
                  payload: {
                    roomId: room.id,
                    currentQuestionIndex: data.currentQuestionIndex,
                    isFinished: false,
                    room: data
                  }
                }).catch(() => {});
              } catch (_) {}
            } else {
              advancingQuestionRef.current = null;
              isTransitioningRef.current = false;
            }
          }
        } catch (err) {
          console.error('[ChallengeGamePage] Error auto-advancing question:', err);
          advancingQuestionRef.current = null;
          isTransitioningRef.current = false;
        }
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [hasAllAnswered, room?.id, room?.status, isLastQuestion, isEffectiveHost, currentQuestionIdx, isWhoAmI, playerUsername, playerName, totalQuestions, setRoom]);
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

  const hasActiveTimer = Boolean(
    isSpeedMode ||
    (room && Number(room.timePerQuestion || 0) > 0) ||
    Boolean((room as any)?.hasTimer)
  );

  const isManualInputOrAudio = Boolean(
    skillsType === 'surah' ||
    skillsType === 'who_am_i' ||
    skillsType === 'audio' ||
    room?.gameMode === 'surah' ||
    room?.gameMode === 'who_am_i' ||
    (currentChallenge as any)?.type === 'SURAH'
  );

  const hasMultipleChoiceOptions = !isManualInputOrAudio && Boolean(
    skillsType === 'complete' ||
    challengeMode === 'daily' ||
    (Array.isArray(skillsOptions) && skillsOptions.length > 2) ||
    (Array.isArray(currentChallenge?.options) && currentChallenge.options.length > 2)
  );

  const showPowerUpsStore = hasActiveTimer || hasMultipleChoiceOptions;

  const renderChallengeMainContent = (isMultiplayerLayout = false) => {
    if (isRoomLoading) {
      return (
        <div className={`flex flex-col items-center justify-center ${isMultiplayerLayout ? 'py-10 bg-white/5 border-white/10 text-white' : 'py-28 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100'} rounded-3xl p-6 border shadow-xs text-center w-full max-w-md`}>
          <div className="w-10 h-10 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-3" />
          <h3 className="text-sm md:text-base font-black mb-1">
            جاري استعادة بيانات الغرفة ونوع التحدي...
          </h3>
          <p className="text-xs text-slate-400 font-bold">
            يرجى الانتظار لحظات لمزامنة الجولة الحالية
          </p>
        </div>
      );
    }

    if (skillsType === 'audio' && !systemSettings.hideAudioChallenge && challengeMode !== 'daily') {
      return (
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
          isHost={isEffectiveHost}
          isLastQuestion={isLastQuestion}
          onEndRoom={handleEndRoom}
          isEndingRoom={isEndingRoom}
        />
      );
    }

    if (skillsType === 'surah' && !systemSettings.hideSurahChallenge && challengeMode !== 'daily') {
      return (
        <SurahChallengeUI
          verseText={KEYWORD}
          inputs={surahInputs}
          onInputChange={(idx: number, val: string) => {
            if (isMultiplayer) {
              if (app?.handleSurahInputChangeBonus) {
                app.handleSurahInputChangeBonus(idx, val);
              } else if (handleSurahInputChange) {
                handleSurahInputChange(idx, val);
              } else if (app?.handleSurahInputChange) {
                app.handleSurahInputChange(idx, val);
              }
            } else {
              if (app?.handleSurahInputChangeSingle) {
                app.handleSurahInputChangeSingle(idx, val);
              } else if (handleSurahInputChange) {
                handleSurahInputChange(idx, val);
              } else {
                const newInputs = [...surahInputs];
                newInputs[idx] = val;
                setSurahInputs(newInputs);
              }
            }
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
          isRoom={isMultiplayer}
          isMultiplayer={isMultiplayer}
          isHost={isEffectiveHost}
          isLastQuestion={isLastQuestion}
          onEndRoom={handleEndRoom}
          isEndingRoom={isEndingRoom}
          hasBonusField={app?.hasBonusField}
          bonusInput={app?.surahBonusInput}
          onBonusInputChange={app?.handleSurahBonusInputChange}
        />
      );
    }

    if ((skillsType === 'complete' && !systemSettings.hideCompletionChallenge) || challengeMode === 'daily') {
      return (
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
          isHost={isEffectiveHost}
          isLastQuestion={isLastQuestion}
          onEndRoom={handleEndRoom}
          isEndingRoom={isEndingRoom}
          onFinishDaily={() => {
            setChallengeMode('normal');
            setView('home');
          }}
        />
      );
    }

    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center rounded-3xl p-6 border shadow-sm max-w-md mx-auto ${isMultiplayerLayout ? 'bg-white/5 border-white/10 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100'}`}>
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-black mb-1">حدث خطأ في مزامنة الغرفة</h3>
        <p className="text-xs text-slate-400 font-bold mb-5 leading-relaxed">
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
          className="px-6 py-2.5 rounded-2xl bg-brand-emerald text-white text-xs font-black shadow-md hover:bg-brand-emerald/90 transition-all cursor-pointer"
        >
          العودة لقائمة الغرف
        </button>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // 1. DEDICATED MULTIPLAYER VIEW: Mobile-First, Scroll-Free, Compact
  // ═══════════════════════════════════════════════════════════════════
  if (isMultiplayer) {
    return (
      <div
        key="group_challenge_game"
        className="fixed inset-0 z-40 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden select-none"
        dir="rtl"
      >
        {/* 1. Compact Top Header */}
        <header className="shrink-0 h-11 sm:h-12 px-3 sm:px-4 flex items-center justify-between border-b border-white/10 bg-slate-900/80 backdrop-blur-md relative z-30 pt-[env(safe-area-inset-top,0px)]">
          {/* Right: Settings/More Menu + Question Counter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSettingsMenuOpen(prev => !prev)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-slate-300 border border-white/10 transition-all cursor-pointer"
                title="خيارات وإعدادات الغرفة"
                aria-label="خيارات وإعدادات الغرفة"
              >
                <Settings className="w-4 h-4 text-slate-200" />
              </button>

              {/* Settings Dropdown Popover */}
              <AnimatePresence>
                {isSettingsMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsSettingsMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -5 }}
                      className="absolute right-0 top-10 z-50 w-52 p-2 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 text-xs font-black text-slate-300">
                        <span>خيارات التحدي</span>
                        <button
                          type="button"
                          onClick={() => setIsSettingsMenuOpen(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Resign Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSettingsMenuOpen(false);
                          app.setIsResignModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-500/20 active:scale-95 transition-all text-right cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" />
                        <span>الانسحاب من التحدي</span>
                      </button>

                      {/* Cancel Room Option (Leader/Host only) */}
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSettingsMenuOpen(false);
                            app.setIsCancelRoomModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all text-right cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                          <span>إلغاء الغرفة وإنهاؤها</span>
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Question Number */}
            <span className="text-xs sm:text-sm font-black text-white tabular-nums">
              سؤال {currentQuestionIdx + 1}
              <span className="text-slate-400 font-bold text-[10px] sm:text-xs">/{totalQuestions}</span>
            </span>
          </div>

          {/* Center: Timer Pill */}
          {hasActiveTimer && (
            <div className="flex items-center">
              <div
                className={`px-3 py-0.5 rounded-full border flex items-center gap-1.5 text-xs font-black tabular-nums transition-all ${
                  isFreezeActive
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 ring-1 ring-cyan-400/40 animate-pulse'
                    : speedTimeLeft <= 5
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300 ring-1 ring-rose-400/50 animate-bounce'
                    : 'bg-white/10 border-white/20 text-white'
                }`}
              >
                <span className="text-xs">{isFreezeActive ? '🧊' : '⚡'}</span>
                <span>{isFreezeActive ? `مجمّد (${freezeSecondsLeft}ث)` : `${speedTimeLeft}ث`}</span>
              </div>
            </div>
          )}

          {/* Left: Deduplicated Answered Indicator & Points Balance */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-full text-xs font-black text-amber-300">
              <span>🪙</span>
              <span className="tabular-nums">{totalPoints}</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
              <Users className="w-3 h-3 text-slate-400" />
              <span className="tabular-nums">{validAnswersCount}/{activeCount || 1}</span>
            </div>
          </div>
        </header>

        {/* Thin Animated Time / Progress Bar */}
        {hasActiveTimer && (
          <div className="w-full h-1 bg-white/10 relative overflow-hidden shrink-0">
            <motion.div
              className={`h-full transition-all duration-300 ${
                isFreezeActive
                  ? 'bg-cyan-400'
                  : speedTimeLeft <= 5
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-400'
              }`}
              style={{
                width: `${Math.min(100, Math.max(0, (speedTimeLeft / (room.timePerQuestion || 15)) * 100))}%`
              }}
            />
          </div>
        )}

        {/* Discreet Waiting Indicator after answer */}
        {room && room.transitionMode !== 'ASYNC' && hasAnsweredCurrentQuestion && (
          <div className="shrink-0 text-center py-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-black animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>تم تسجيل إجابتك • بانتظار باقي اللاعبين...</span>
            </span>
          </div>
        )}

        {/* Quick Inventory HUD & Store FAB Trigger */}
        {showPowerUpsStore && (
          <div className="flex items-center justify-center gap-2 py-1 shrink-0">
            {hasActiveTimer && (
              <button
                type="button"
                onClick={handleExecuteFreezeTime}
                disabled={isPowerUpUsedThisQuestion || isFreezeActive || hasAnsweredCurrentQuestion || (powerups.freeze || 0) <= 0}
                title="تجميد الوقت لمدة 10 ثوانٍ"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
                  isFreezeActive
                    ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400 ring-2 ring-cyan-300 animate-pulse'
                    : (powerups.freeze || 0) > 0
                    ? 'bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-800/50 text-slate-500 border-slate-700 opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-sm">🧊</span>
                <span>تجميد</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  (powerups.freeze || 0) > 0 ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'
                }`}>
                  {powerups.freeze || 0}
                </span>
              </button>
            )}

            {hasMultipleChoiceOptions && (
              <button
                type="button"
                onClick={handleExecuteDeleteTwo}
                disabled={isPowerUpUsedThisQuestion || hasAnsweredCurrentQuestion || eliminatedOptionIndices.length > 0 || (powerups.fiftyFifty || 0) <= 0}
                title="حذف إجابتين (50/50)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
                  eliminatedOptionIndices.length > 0
                    ? 'bg-amber-500/30 text-amber-200 border-amber-400 ring-2 ring-amber-300'
                    : (powerups.fiftyFifty || 0) > 0
                    ? 'bg-amber-950/80 hover:bg-amber-900/90 text-amber-300 border-amber-500/50'
                    : 'bg-slate-800/50 text-slate-500 border-slate-700 opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-sm">✂️</span>
                <span>حذف 2</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  (powerups.fiftyFifty || 0) > 0 ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-400'
                }`}>
                  {powerups.fiftyFifty || 0}
                </span>
              </button>
            )}

            {/* Store Modal Button 🛒 */}
            <button
              type="button"
              onClick={() => setIsStoreModalOpen(true)}
              title="متجر وسائل المساعدة"
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-400/30 text-xs font-black transition-all active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              <span>المتجر</span>
            </button>
          </div>
        )}

        {/* 2. Middle Content Area: Question & Options (Flex-1, Scroll-Free) */}
        <div className="flex-1 flex flex-col justify-center items-center px-2 sm:px-4 py-1 overflow-hidden w-full max-w-2xl mx-auto">
          {renderChallengeMainContent(true)}
        </div>

        {/* 3. Bottom Area: Compact Player Status Row + Reactions FAB */}
        <footer className="shrink-0 w-full px-3 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-between border-t border-white/10 bg-slate-900/90 backdrop-blur-md relative z-30">
          {/* Horizontal Avatars Row for Players */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 no-scrollbar max-w-[calc(100%-3.5rem)]">
            {(room.participants || []).map((p: any) => {
              const pId = String(p.id);
              const ans = room.currentAnswers?.[pId] || room.currentAnswers?.[p.username] || room.currentAnswers?.[p.name];
              const isMe = p.name === playerName || p.username === playerUsername || pId === String(currentUserId);
              const hasAns = Boolean(ans && (ans.questionIndex === undefined || ans.questionIndex === currentQuestionIdx));
              const isAnsCorrect = hasAns && Boolean(ans.isCorrect);
              const isOnline = isParticipantOnlineFn(p);

              const initial = (p.name || p.username || 'ل').trim().charAt(0);

              return (
                <div key={pId} className="relative flex flex-col items-center shrink-0" title={`${p.name || p.username}${isMe ? ' (أنت)' : ''}`}>
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs border relative transition-all ${
                      isMe ? 'ring-2 ring-emerald-400 border-white' : 'border-white/20'
                    } ${
                      !isOnline
                        ? 'bg-slate-800 text-slate-500 opacity-60'
                        : isAnsCorrect
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : hasAns
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    <span>{initial}</span>

                    {/* Status Badge in corner */}
                    <span
                      className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black border border-slate-900 ${
                        !isOnline
                          ? 'bg-slate-600 text-white'
                          : isAnsCorrect
                          ? 'bg-emerald-400 text-slate-900'
                          : hasAns
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-400 text-slate-900 animate-pulse'
                      }`}
                    >
                      {!isOnline ? '✕' : isAnsCorrect ? '✓' : hasAns ? '✕' : '⏳'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-300 max-w-[42px] truncate mt-0.5 leading-none">
                    {p.name || p.username || 'لاعب'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Reactions FAB Button */}
          <LiveReactionsOverlay
            roomId={room.id}
            playerId={playerUsername || playerName || undefined}
            playerName={playerName || undefined}
            incomingReaction={room.lastReaction || room.playersProgress?.__lastReaction}
            variant="fab"
            showBar={true}
          />
        </footer>

        {/* Store Modal */}
        <AnimatePresence>
          {isStoreModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                className="bg-slate-900 border border-white/15 rounded-3xl p-5 max-w-sm w-full shadow-2xl relative space-y-4"
                dir="rtl"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 text-sm font-black text-amber-300">
                    <ShoppingBag className="w-4 h-4 text-amber-400" />
                    <span>متجر وسائل المساعدة</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStoreModalOpen(false)}
                    className="w-7 h-7 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between bg-amber-500/10 border border-amber-400/20 px-3 py-2 rounded-xl text-xs font-bold text-amber-200">
                  <span>رصيدك الحالي:</span>
                  <span className="font-black text-sm">🪙 {totalPoints} نقطة</span>
                </div>

                <div className="space-y-2.5">
                  {hasActiveTimer && (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">🧊</span>
                        <div className="text-right">
                          <div className="text-xs font-black text-white">تجميد الوقت (10ث)</div>
                          <div className="text-[10px] text-cyan-300 font-bold">مخزونك: {powerups.freeze || 0}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => buyPowerup('freeze')}
                        disabled={totalPoints < 30}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                          totalPoints >= 30
                            ? 'bg-cyan-500 text-white hover:bg-cyan-400 active:scale-95 shadow-md'
                            : 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>30ن</span>
                      </button>
                    </div>
                  )}

                  {hasMultipleChoiceOptions && (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">✂️</span>
                        <div className="text-right">
                          <div className="text-xs font-black text-white">حذف إجابتين (50/50)</div>
                          <div className="text-[10px] text-amber-300 font-bold">مخزونك: {powerups.fiftyFifty || 0}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => buyPowerup('fiftyFifty')}
                        disabled={totalPoints < 50}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                          totalPoints >= 50
                            ? 'bg-amber-500 text-white hover:bg-amber-400 active:scale-95 shadow-md'
                            : 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>50ن</span>
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                  جميع الأدوات المشتراة تُحفظ في رصيدك ويمكنك استخدامها فوراً من الأزرار السريعة.
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Transcript Debug */}
        <AnimatePresence>
          {isListening && transcript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 glass bg-brand-gold/5 border-brand-gold/10 rounded-2xl text-slate-200 text-center quran-text text-base italic absolute bottom-14 inset-x-4 z-40"
            >
              "{transcript}"
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. SOLO / DAILY CHALLENGE VIEW
  // ═══════════════════════════════════════════════════════════════════
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

      {/* Power-ups HUD & Store (المخزون والمتجر) */}
      {showPowerUpsStore && (
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
      )}

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

      {renderChallengeMainContent(false)}

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

