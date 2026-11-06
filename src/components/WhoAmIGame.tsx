import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { router } from '../services/router';
import { isAnswerCorrect } from '../utils/normalizeArabic';
import './WhoAmIGame.css';

const PHASE_SECONDS = 20;
const TOTAL_SECONDS = 40;
// Unified Global Points System: 1 correct answer = 1 skill point
const POINTS: Record<number, number> = { 1: 1, 2: 1 };

export interface Player {
  id: string;
  name: string;
  score?: number;
}

export interface WhoAmIGameProps {
  roomId: string;
  currentUser: { id: string; name: string };
  isLeader: boolean;
  players: Player[];
  category?: string;
  categoriesConfig?: Array<{ category: string; count: number }>;
  totalRounds?: number;
  onExit?: () => void;
  onCancelRoom?: () => void;
  onWithdraw?: () => void;
}

export default function WhoAmIGame({
  roomId,
  currentUser,
  isLeader,
  players,
  category = 'الصحابة',
  categoriesConfig,
  totalRounds = 10,
  onExit,
  onCancelRoom,
  onWithdraw,
}: WhoAmIGameProps) {
  const [rounds, setRounds] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [question, setQuestion] = useState<any>(null);
  const [offset, setOffset] = useState(0); // فرق الساعة بين الجهاز والخادم
  const [now, setNow] = useState(Date.now());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isRoomCompleted, setIsRoomCompleted] = useState(false);
  const revealingRef = useRef<string | null>(null);
  const queueRef = useRef<any[]>([]);

  const round = rounds[rounds.length - 1] || null;
  const roundId = round?.id;

  // ---------- تحميل البيانات ----------
  const refresh = useCallback(async () => {
    try {
      const [r, a, s] = await Promise.all([
        supabase.from('who_am_i_rounds').select('*').eq('room_id', roomId).order('round_no'),
        supabase.from('who_am_i_answers').select('*').eq('room_id', roomId),
        supabase.from('who_am_i_submissions').select('*').eq('room_id', roomId),
      ]);
      setRounds(r.data || []);
      setAnswers(a.data || []);
      setSubs(s.data || []);
    } catch (err) {
      console.error('[WhoAmIGame] Refresh error:', err);
    }
  }, [roomId]);

  useEffect(() => {
    (async () => {
      try {
        const t0 = Date.now();
        const { data, error } = await supabase.rpc('server_now');
        const t1 = Date.now();
        if (data && !error) setOffset(new Date(data).getTime() - (t0 + t1) / 2);
      } catch (e) {
        console.warn('[WhoAmIGame] server_now fallback:', e);
      }
    })();
    refresh();

    const filter = `room_id=eq.${roomId}`;
    const channelName = `who-am-i-${roomId}`;
    const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existingChannel) {
      try {
        supabase.removeChannel(existingChannel);
      } catch (_) {}
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload: any) => {
        if (payload?.new?.status === 'completed' || payload?.new?.status === 'FINISHED') {
          setIsRoomCompleted(true);
          router.push('/challenge/results');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Room', filter: `id=eq.${roomId}` }, (payload: any) => {
        if (payload?.new?.status === 'completed' || payload?.new?.status === 'FINISHED') {
          setIsRoomCompleted(true);
          router.push('/challenge/results');
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'who_am_i_rounds', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'who_am_i_answers', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'who_am_i_submissions', filter }, refresh)
      .on('broadcast', { event: 'room_completed' }, () => {
        setIsRoomCompleted(true);
        router.push('/challenge/results');
      })
      .subscribe((status, err) => {
        if (err) console.error('[WhoAmIGame Realtime Error]:', err);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsReconnecting(true);
        } else if (status === 'SUBSCRIBED') {
          setIsReconnecting(false);
        }
      });

    const handleOffline = () => setIsReconnecting(true);
    const handleOnline = () => {
      setIsReconnecting(false);
      refresh();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [roomId, refresh]);

  // السؤال الحالي
  useEffect(() => {
    if (!round?.question_id) {
      setQuestion(null);
      return;
    }
    supabase
      .from('who_am_i_questions')
      .select('*')
      .eq('id', round.question_id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('[WhoAmIGame] Error loading question:', error);
        setQuestion(data);
      });
    setInput('');
  }, [round?.question_id]);

  // مؤقت
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // ---------- الحسابات ----------
  const elapsed = round ? Math.max(0, (now + offset - Date.parse(round.started_at)) / 1000) : 0;
  const phase = elapsed < PHASE_SECONDS ? 1 : 2;
  const timeUp = elapsed >= TOTAL_SECONDS;
  const revealed = round?.status === 'revealed';
  const remaining = Math.max(0, Math.ceil((phase === 1 ? PHASE_SECONDS : TOTAL_SECONDS) - elapsed));

  const roundSubs = useMemo(() => subs.filter((s) => s.round_id === roundId), [subs, roundId]);
  const roundAnswers = useMemo(() => answers.filter((a) => a.round_id === roundId), [answers, roundId]);
  const myAnswer = roundAnswers.find((a) => String(a.user_id) === String(currentUser.id));
  const iSubmitted = !!myAnswer || roundSubs.some((s) => String(s.user_id) === String(currentUser.id));

  const scores = useMemo(() => {
    const revealedIds = new Set(rounds.filter((r) => r.status === 'revealed').map((r) => r.id));
    const map: Record<string, number> = {};
    answers.forEach((a) => {
      if (revealedIds.has(a.round_id)) {
        const uId = String(a.user_id);
        map[uId] = (map[uId] || 0) + (a.points || 0);
      }
    });
    return players
      .map((p) => ({ ...p, score: map[String(p.id)] || 0 }))
      .sort((x, y) => (y.score || 0) - (x.score || 0));
  }, [answers, rounds, players]);

  const finished = isRoomCompleted;

  // ---------- الكشف التلقائي (القائد) ----------
  useEffect(() => {
    if (!isLeader || !round || round.status !== 'active') return;
    const allIn = players.length > 0 && roundSubs.length >= players.length;
    if ((allIn || timeUp) && revealingRef.current !== round.id) {
      revealingRef.current = round.id;
      supabase
        .from('who_am_i_rounds')
        .update({ status: 'revealed' })
        .eq('id', round.id)
        .eq('status', 'active')
        .then(refresh);
    }
  }, [isLeader, round, roundSubs.length, players.length, timeUp, refresh]);

  // ---------- الإجراءات ----------
  // تحميل وخلط الأسئلة الموزعة حسب الفئات
  const loadMixedQueue = async (): Promise<any[]> => {
    if (queueRef.current.length > 0) return queueRef.current;

    if (categoriesConfig && categoriesConfig.length > 0) {
      try {
        const res = await fetch('/api/who-am-i', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-mixed-questions', categories_config: categoriesConfig }),
        });
        const d = await res.json();
        if (d.questions && d.questions.length > 0) {
          queueRef.current = d.questions;
          return d.questions;
        }
      } catch (err) {
        console.warn('[WhoAmIGame] API get-mixed-questions fallback:', err);
      }

      // Fallback: Supabase مباشر
      let collected: any[] = [];
      for (const item of categoriesConfig) {
        const { data } = await supabase
          .from('who_am_i_questions')
          .select('id, category')
          .eq('category', item.category);
        if (data && data.length > 0) {
          const shuffled = [...data].sort(() => Math.random() - 0.5);
          collected.push(...shuffled.slice(0, item.count));
        }
      }
      const finalShuffled = collected.sort(() => Math.random() - 0.5);
      queueRef.current = finalShuffled;
      return finalShuffled;
    }
    return [];
  };

  const startNext = async () => {
    const used = new Set(rounds.map((r) => r.question_id));
    let nextQuestionId: string | null = null;

    if (categoriesConfig && categoriesConfig.length > 0) {
      const qList = await loadMixedQueue();
      const available = qList.find((item) => !used.has(item.id));
      if (available) {
        nextQuestionId = available.id;
      }
    }

    if (!nextQuestionId) {
      // تفريغ أو اختيار من الفئة الافتراضية
      let q = supabase.from('who_am_i_questions').select('id');
      if (category && (!categoriesConfig || categoriesConfig.length === 0)) {
        q = q.eq('category', category);
      }
      if (used.size > 0) {
        q = q.not('id', 'in', `(${Array.from(used).join(',')})`);
      }
      const { data, error } = await q;
      if (error) console.error('[WhoAmIGame] Questions query error:', error);
      if (!data?.length) {
        alert('لا توجد أسئلة إضافية متاحة');
        return;
      }
      const pick = data[Math.floor(Math.random() * data.length)];
      nextQuestionId = pick.id;
    }

    const { error: insErr } = await supabase.from('who_am_i_rounds').insert({
      room_id: roomId,
      question_id: nextQuestionId,
      round_no: rounds.length + 1,
    });
    if (insErr) console.error('[WhoAmIGame] Error inserting round:', insErr);
    refresh();
  };

  const submit = async () => {
    const text = input.trim();
    if (!text || iSubmitted || !round || !question || revealed || timeUp || busy) return;
    setBusy(true);
    const ph = (Date.now() + offset - Date.parse(round.started_at)) / 1000 < PHASE_SECONDS ? 1 : 2;
    const correct = isAnswerCorrect(text, question.answer);
    const pts = correct ? (POINTS[ph] || 0) : 0;

    const { error } = await supabase.from('who_am_i_answers').insert({
      room_id: roomId,
      round_id: round.id,
      user_id: currentUser.id,
      player_name: currentUser.name,
      answer_text: text,
      phase: ph,
      is_correct: correct,
      points: pts,
    });
    if (error) console.error('[WhoAmIGame] Error inserting answer:', error);

    // Fallback insertion for submissions table
    try {
      await supabase.from('who_am_i_submissions').insert({
        round_id: round.id,
        room_id: roomId,
        user_id: currentUser.id,
        player_name: currentUser.name,
      });
    } catch (_) {}

    setBusy(false);
    refresh();
  };

  // نظام VAR: اعتماد الإجابة (للقائد فقط)
  const override = async (a: any) => {
    if (!isLeader) return;
    const pts = POINTS[a.phase] || 1;
    const { error } = await supabase
      .from('who_am_i_answers')
      .update({ is_correct: true, points: pts, overridden: true })
      .eq('id', a.id);
    if (error) console.error('[WhoAmIGame] Error in VAR override:', error);
    refresh();
  };

  // ---------- الواجهة ----------
  if (!round) {
    return (
      <div className="wai" dir="rtl">
        <h2>🕵️ تحدي "من أنا؟"</h2>
        <p className="wai-muted" style={{ marginTop: 4, marginBottom: 12 }}>
          {category ? `الفئات المحددة: ${category}` : 'تحدي التلميحات المتدرجة'}
        </p>
        {isLeader ? (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
            <button className="wai-btn" onClick={startNext}>
              ابدأ التحدي
            </button>
            <button
              type="button"
              className="wai-btn"
              onClick={onCancelRoom || onExit}
              style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
            >
              إلغاء الغرفة
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <p className="wai-muted">بانتظار القائد لبدء التحدي...</p>
            <button
              type="button"
              className="wai-btn"
              onClick={onWithdraw || onExit}
              style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', width: 'auto', padding: '6px 14px' }}
            >
              الانسحاب
            </button>
          </div>
        )}
      </div>
    );
  }

  if (finished) {
    return (
      <div className="wai" dir="rtl">
        <h2>🏆 النتيجة النهائية</h2>
        <Scoreboard scores={scores} meId={currentUser.id} />
        {onExit && (
          <button className="wai-btn" onClick={onExit} style={{ marginTop: 16 }}>
            خروج
          </button>
        )}
      </div>
    );
  }

  const barPct = revealed ? 100 : Math.min(100, (elapsed / TOTAL_SECONDS) * 100);

  return (
    <div className="wai" dir="rtl">
      <div className="wai-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>
            السؤال {round.round_no} / {totalRounds}
          </span>
          {question?.category && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: '#e0e7ff',
                color: '#3730a3',
                border: '1px solid #c7d2fe',
              }}
            >
              {question.category}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLeader ? (
            <button
              type="button"
              onClick={onCancelRoom || onExit}
              className="wai-btn-leave"
              style={{
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              title="إلغاء الغرفة"
            >
              إلغاء الغرفة
            </button>
          ) : (
            <button
              type="button"
              onClick={onWithdraw || onExit}
              className="wai-btn-leave"
              style={{
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              title="الانسحاب من التحدي"
            >
              الانسحاب
            </button>
          )}
          {!revealed && <span className={`wai-timer ph${phase}`}>{remaining}s</span>}
        </div>
      </div>
      <div className="wai-bar">
        <div className={`wai-bar-fill ph${phase}`} style={{ width: `${barPct}%` }} />
      </div>

      {!question ? (
        <p className="wai-muted">جارٍ التحميل...</p>
      ) : (
        <>
          <div className="wai-hint">
            <small>التلميح الأول {!revealed && phase === 1 && '· 10 نقاط'}</small>
            <p>{question.hint_1}</p>
          </div>
          {(phase === 2 || revealed) && (
            <div className="wai-hint easy">
              <small>التلميح الثاني · 5 نقاط</small>
              <p>{question.hint_2}</p>
            </div>
          )}

          {!revealed && !iSubmitted && !timeUp && (
            <div className="wai-input">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="اكتب إجابتك..."
                autoFocus
              />
              <button className="wai-btn" onClick={submit} disabled={busy || !input.trim()}>
                إرسال
              </button>
            </div>
          )}
          {!revealed && iSubmitted && <p className="wai-muted">✓ تم إرسال إجابتك، بانتظار البقية...</p>}

          <ul className="wai-players">
            {players.map((p) => {
              const pIdStr = String(p.id);
              const sub = roundSubs.some((s) => String(s.user_id) === pIdStr);
              const ans = roundAnswers.find((a) => String(a.user_id) === pIdStr);

              if (!revealed) {
                // حالة الإخفاء: اسم رمادي + (✓) بدون النص
                return (
                  <li key={p.id} className={`wai-player neutral ${sub ? 'done' : ''}`}>
                    <span>{p.name}</span>
                    {sub && <span className="tick">✓</span>}
                  </li>
                );
              }
              // حالة الكشف
              if (!ans) {
                return (
                  <li key={p.id} className="wai-player neutral">
                    <span>{p.name}</span>
                    <span className="wai-muted">لم يجب</span>
                  </li>
                );
              }
              return (
                <li key={p.id} className={`wai-player ${ans.is_correct ? 'correct' : 'wrong'}`}>
                  <span>{p.name}</span>
                  <span className="ans">{ans.answer_text}</span>
                  <span className="pts">{ans.points > 0 ? `+${ans.points}` : ''}</span>
                  {ans.overridden && <span className="badge">VAR</span>}
                  {isLeader && !ans.is_correct && (
                    <button className="wai-var" onClick={() => override(ans)}>
                      اعتماد الإجابة ✓
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {revealed && (
            <>
              <p className="wai-answer">
                الإجابة الصحيحة: <b>{question.answer.split('|')[0]}</b>
              </p>
              <Scoreboard scores={scores} meId={currentUser.id} />
              {isLeader ? (
                <button
                  className="wai-btn"
                  onClick={async () => {
                    if (rounds.length >= totalRounds) {
                      try {
                        await Promise.allSettled([
                          supabase.from('rooms').update({ status: 'completed' }).eq('id', roomId),
                          supabase.from('Room').update({ status: 'completed' }).eq('id', roomId)
                        ]);
                      } catch (_) {}
                      try {
                        const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:who-am-i-${roomId}`);
                        if (existingChannel && existingChannel.state === 'joined') {
                          existingChannel.send({
                            type: 'broadcast',
                            event: 'room_completed',
                            payload: { roomId }
                          }).catch(() => {});
                        } else {
                          const ch = supabase.channel(`who-am-i-${roomId}`);
                          ch.subscribe((status) => {
                            if (status === 'SUBSCRIBED') {
                              ch.send({
                                type: 'broadcast',
                                event: 'room_completed',
                                payload: { roomId }
                              }).finally(() => {
                                try {
                                  supabase.removeChannel(ch);
                                } catch (_) {}
                              });
                            }
                          });
                        }
                      } catch (_) {}
                      setIsRoomCompleted(true);
                      router.push('/challenge/results');
                    } else {
                      startNext();
                    }
                  }}
                  style={{ marginTop: 16 }}
                >
                  {rounds.length >= totalRounds ? 'إنهاء الغرفة' : 'السؤال التالي'}
                </button>
              ) : (
                rounds.length >= totalRounds ? (
                  <p className="wai-muted" style={{ fontWeight: 800, color: '#d97706', marginTop: 12 }}>
                    في انتظار القائد لإنهاء التحدي
                  </p>
                ) : (
                  <p className="wai-muted">بانتظار القائد للانتقال...</p>
                )
              )}
            </>
          )}
        </>
      )}

      {isReconnecting && (
        <div className="wai-reconnecting-overlay">
          <div className="wai-reconnecting-card">
            <div className="wai-reconnecting-spinner" />
            <h3 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '6px' }}>جاري إعادة الاتصال...</h3>
            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>انقطع الاتصال اللحظي، جاري المزامنة مع الغرفة...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Scoreboard({ scores, meId }: { scores: Player[]; meId: string }) {
  return (
    <ol className="wai-score">
      {scores.map((p) => (
        <li key={p.id} className={String(p.id) === String(meId) ? 'me' : ''}>
          <span>{p.name}</span>
          <b>{p.score || 0}</b>
        </li>
      ))}
    </ol>
  );
}

