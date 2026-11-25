import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { findPlayerRow, toSafePlayer, selectByAnyEq } from './_lib/playerSecurity.js'
import { enforcePlayerActor, enforceRoomOwner, getActingPlayer, rejectUnlistedAction, type ActorSpec } from './_lib/playerAuth.js'
import { ABSENT_WAIT_MS } from './_lib/roomRules.js'

// Actions that act on behalf of a player: with REQUIRE_PLAYER_TOKEN on, the acting player comes
// from the token; these fields (naming the actor, never another player) must match it.
export const ACTOR_SPECS: Record<string, ActorSpec> = (() => {
  const player: ActorSpec = { fields: { playerId: 'id', playerName: 'name', playerUsername: 'username' } }
  const specs: Record<string, ActorSpec> = {
    create: { fields: { player1Id: 'id', player1Name: 'name' } },
    join: {
      fields: { player2Id: 'id', player2Name: 'name', playerName: 'name' },
      headers: { 'x-player-id': 'id', 'x-player-username': 'username', 'x-player-name': 'name' },
    },
    poll: player,
    'check-active': player,
    'submit-answer': player,
    'advance-question': player,
    'submit-progress': player,
    presence: player,
    'cancel-room': player,
    reaction: player,
    'dnd-cooldown': { fields: { senderId: 'id' } },
    // Owner-only actions carry no identity; ownership is checked below.
    start: {},
  }
  for (const a of ['end-room', 'finish-room']) specs[a] = player
  for (const a of ['resign', 'withdraw', 'leaveRoom', 'leave']) {
    specs[a] = { fields: player.fields, headers: { 'x-player-id': 'id' } }
  }
  for (const a of ['kick', 'kick-player', 'kickPlayer']) {
    specs[a] = { fields: { hostId: 'id' }, headers: { 'x-player-id': 'id', 'x-player-username': 'username' } }
  }
  for (const a of ['update-settings', 'updateSettings', 'update-room']) specs[a] = {}
  for (const a of ['invite', 'send-invite', 'check-invite']) specs[a] = { fields: { senderId: 'id' } }
  for (const a of ['rematch', 'play-again', 'playAgain']) specs[a] = player
  for (const a of ['purchase-powerup', 'buy-powerup', 'purchasePowerup', 'buyPowerup']) specs[a] = player
  return specs
})()

const OWNER_ONLY_ACTIONS = new Set(['start', 'update-settings', 'updateSettings', 'update-room'])

// Actions that need no player token. Anything not here and not in ACTOR_SPECS is refused when
// REQUIRE_PLAYER_TOKEN is on (default deny).
export const PUBLIC_ACTIONS: ReadonlySet<string> = new Set(['list-rooms', 'available-counts', 'list-challenges'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.method === 'GET' ? req.query.action : req.body.action

  if (rejectUnlistedAction(action, ACTOR_SPECS, PUBLIC_ACTIONS, res)) return

  const spec = typeof action === 'string' && Object.prototype.hasOwnProperty.call(ACTOR_SPECS, action)
    ? ACTOR_SPECS[action]
    : null
  if (spec) {
    const gate = await enforcePlayerActor(req, res, spec)
    if (!gate) return
    if (gate.enforced && OWNER_ONLY_ACTIONS.has(action as string)) {
      if (!(await enforceRoomOwner(req.body?.roomId, gate.actor, res))) return
    }
  }

  switch (action) {
    case 'create': return handleCreate(req, res)
    case 'join': return handleJoin(req, res)
    case 'list-rooms': return handleListRooms(req, res)
    case 'available-counts': return handleAvailableCounts(req, res)
    case 'poll': return handlePoll(req, res)
    case 'start': return handleStart(req, res)
    case 'submit-answer': return handleSubmitAnswer(req, res)
    case 'advance-question': return handleAdvanceQuestion(req, res)
    case 'end-room':
    case 'finish-room':
      return handleEndRoom(req, res)
    case 'submit-progress': return handleSubmitProgress(req, res)
    case 'list-challenges': return handleListChallenges(req, res)
    case 'check-active': return handleCheckActive(req, res)
    case 'presence': return handlePresence(req, res)
    case 'cancel-room': return handleCancelRoom(req, res)
    case 'resign':
    case 'withdraw':
    case 'leaveRoom':
    case 'leave':
      return handleResign(req, res)
    case 'kick':
    case 'kick-player':
    case 'kickPlayer':
      return handleKickPlayer(req, res)
    case 'update-settings':
    case 'updateSettings':
    case 'update-room':
      return handleUpdateRoomSettings(req, res)
    case 'reaction': return handleReaction(req, res)
    case 'dnd-cooldown': return handleDndCooldown(req, res)
    case 'invite':
    case 'send-invite':
    case 'check-invite':
      return handleSendInviteAPI(req, res)
    case 'rematch':
    case 'play-again':
    case 'playAgain':
      return handleRematch(req, res)
    case 'purchase-powerup':
    case 'buy-powerup':
    case 'purchasePowerup':
    case 'buyPowerup':
      return handlePurchasePowerup(req, res)
    default:
      return res.status(400).json({ message: 'Invalid action' })
  }
}

const mapChallenges = (challenges: any[]) => 
  (challenges || []).map(c => ({ 
    ...c, 
    verseText: c.verseText || c.keyword || c.text || '',
    text: c.verseText || c.keyword || c.text || '' 
  }));

// ── SYNC question timing: the server clock is the reference ──
// Margin for network delay before a question counts as timed out on the server.
export const QUESTION_EXPIRY_SLACK_MS = 1500

/** True when the current SYNC question's time is over (server clock). Rooms without a timer: always true. */
export function isQuestionTimeUp(room: any, now: number = Date.now()): boolean {
  const seconds = Number(room?.timePerQuestion) || 0
  if (seconds <= 0) return true
  const startedAt = Number(room?.questionStartTime) || 0
  if (!startedAt) return true
  return now - startedAt >= seconds * 1000 + QUESTION_EXPIRY_SLACK_MS
}

/**
 * playersProgress holds players (keyed by player id) and room metadata: __lastReaction, __kicked,
 * __rematch (play again) and _firstCorrectUserId. Metadata is never a player.
 */
export function isRoomPlayerKey(key: string): boolean {
  return !String(key).startsWith('__') && key !== '_firstCorrectUserId'
}

/** The players of playersProgress (metadata removed). */
export function roomPlayerEntries(progress: any): [string, any][] {
  return Object.entries(progress || {}).filter(([k, v]) => isRoomPlayerKey(k) && v && typeof v === 'object' && !Array.isArray(v))
}

/**
 * SYNC: everyone present answered and the only players without an answer are away (presence
 * reported offline, playersProgress[id].isOnline === false). Once ABSENT_WAIT_MS has passed
 * (server clock) since the last answer and since they left, the room may move on; they simply
 * have no answer for this question and stay in the room. A player who comes back in time is no
 * longer away and is waited for. Needs at least one present player who answered.
 */
export function absentWaitIsOver(room: any, now: number = Date.now()): boolean {
  if (!room || room.transitionMode === 'ASYNC') return false
  const curQ = room.currentQuestionIndex || 0
  const answers: Record<string, any> = (room.currentAnswers as any) || {}
  const active = roomPlayerEntries(room.playersProgress)
    .filter(([, p]: [string, any]) => !p.hasLeft && !p.isResigned && !p.isAbandoned && p.status !== 'abandoned')
  const answerOf = (id: string) => {
    const a = answers[id]
    return a && (a.questionIndex === undefined || a.questionIndex === curQ) ? a : null
  }
  const answered = active.filter(([id]) => answerOf(id))
  const missing = active.filter(([id]) => !answerOf(id))
  if (missing.length === 0 || answered.length === 0) return false
  if (!missing.every(([, p]: [string, any]) => p.isOnline === false)) return false
  const lastAnswerAt = Math.max(...answered.map(([id]) => Number(answerOf(id).serverTime ?? answerOf(id).timestamp) || 0))
  const leftAt = Math.max(...missing.map(([, p]: [string, any]) => Number(p.awaySince ?? p.lastSeen) || 0))
  return now - Math.max(lastAnswerAt, leftAt) >= ABSENT_WAIT_MS
}

/** True when every non-withdrawn player has an answer stored for the current SYNC question. */
export function haveAllActivePlayersAnswered(room: any): boolean {
  const curQ = room?.currentQuestionIndex || 0
  const answers: Record<string, any> = (room?.currentAnswers as any) || {}
  const progress: Record<string, any> = (room?.playersProgress as any) || {}
  const active = roomPlayerEntries(progress).filter(([, p]: [string, any]) =>
    !p.hasLeft && !p.isResigned && !p.isAbandoned && p.status !== 'abandoned')
  return active.length > 0 && active.every(([id]) => {
    const a = answers[id]
    return Boolean(a && (a.questionIndex === undefined || a.questionIndex === curQ))
  })
}

// ── Play again: who leads the new room ──
// The leader of a room is rooms.player1Id (start / settings / cancel / kick all check it).
// The finished room keeps playersProgress.__rematch = { nextRoomId, playAgainUsers, originalHostId }.
// originalHostId is the finished room's leader. The first player to press "play again" creates the
// new room and leads it for now; as soon as originalHostId enters the new room (rematch or join),
// leadership moves to them. If they never come, the temporary leader stays.

/** The finished room's leader, who should lead the play-again room once they are in it. */
export function rematchOriginalHostId(oldRoom: any): string | null {
  const info = (oldRoom?.playersProgress as any)?.__rematch
  const id = info?.originalHostId ?? oldRoom?.player1Id
  return id === undefined || id === null ? null : String(id)
}

/** The finished room whose play-again room is `newRoomId` (or null). */
async function findRematchParent(newRoomId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('rooms')
      .select('id, player1Id, playersProgress')
      .eq('playersProgress->__rematch->>nextRoomId', newRoomId)
      .limit(1)
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  } catch {
    return null
  }
}

/**
 * The original leader is (back) in the play-again room: give them the lead. Only while the room
 * is still WAITING, and only if they are not leading already. Returns true when it moved.
 */
async function restoreRematchHost(newRoom: any, player: any, originalHostId: string | null): Promise<boolean> {
  if (!newRoom || !player || !originalHostId) return false
  if (String(player.id) !== String(originalHostId)) return false
  // Current row (the caller's copy may be older than its own join).
  const { data: current } = await supabaseAdmin.from('rooms').select('*').eq('id', newRoom.id).maybeSingle()
  newRoom = current || newRoom
  if (newRoom.status !== 'WAITING') return false
  if (String(newRoom.player1Id) === String(player.id)) return false

  const previousHostId = newRoom.player1Id
  const update: any = { player1Id: player.id }
  if (String(newRoom.player2Id) === String(player.id)) update.player2Id = previousHostId
  const { data: moved } = await supabaseAdmin
    .from('rooms')
    .update(update)
    .eq('id', newRoom.id)
    .eq('status', 'WAITING')
    .select('id')
  if (!Array.isArray(moved) || moved.length === 0) return false

  try {
    const full = await getFullRoom(newRoom.id)
    supabaseAdmin.channel(`room_sync_${newRoom.id}`).send({
      type: 'broadcast',
      event: 'host_changed',
      payload: { roomId: newRoom.id, player1Id: player.id, previousHostId, room: full }
    }).catch(() => {})
  } catch (_) {}
  return true
}

async function findPlayer(idOrUsernameOrName: any, nameFallback?: string) {
  if (!idOrUsernameOrName && !nameFallback) return null;
  const str = String(idOrUsernameOrName || '').trim();

  try {
    // Separate lookups instead of a string-built .or() filter (prevents filter injection).
    // Order: id -> uniquePlayerId -> username (case-insensitive, incl. legacy "@") -> name -> name fallback.
    const found = await findPlayerRow(supabaseAdmin, {
      id: idOrUsernameOrName,
      uniquePlayerId: str,
      username: str,
      name: str,
      usernameCaseInsensitive: true
    });
    if (found) return found;

    const fallback = (nameFallback || '').trim();
    if (fallback && fallback !== str) {
      return await findPlayerRow(supabaseAdmin, { name: fallback });
    }
    return null;
  } catch (err: any) {
    console.error('[findPlayer] catch:', err);
    return null;
  }
}

async function getFullRoom(roomId: string) {
  const { data: room, error: rErr } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (rErr || !room) return null;

  const progress: any = room.playersProgress || {};
  const playerIds: number[] = Object.keys(progress)
    .map(id => parseInt(id))
    .filter(id => !isNaN(id));

  if (room.player1Id && !playerIds.includes(room.player1Id)) {
    playerIds.push(room.player1Id);
  }
  if (room.player2Id && !playerIds.includes(room.player2Id)) {
    playerIds.push(room.player2Id);
  }

  let players: any[] = [];
  if (playerIds.length > 0) {
    const { data: pData } = await supabaseAdmin
      .from('players')
      .select('id, name, username, activeFrame, seerahCompleted, generalCompleted')
      .in('id', playerIds);
    players = pData || [];
  }

  const playerMap = new Map(players.map(p => [p.id, p]));

  let orderedChallenges: any[] = [];
  if (Array.isArray(room.challengeIds) && room.challengeIds.length > 0 && typeof room.challengeIds[0] === 'object') {
    orderedChallenges = room.challengeIds as any[];
  } else if (Array.isArray(room.challengeIds) && room.challengeIds.length > 0) {
    const { data: challenges } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .in('id', room.challengeIds as number[]);
    const challengeMap = new Map((challenges || []).map(c => [c.id, c]));
    orderedChallenges = (room.challengeIds as number[])
      .map(id => challengeMap.get(id))
      .filter(Boolean);
  }

  const answers: Record<string, any> = (room.currentAnswers as any) || {};
  const curQIndex = room.currentQuestionIndex || 0;
  const validAnswers: Record<string, any> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (!isRoomPlayerKey(k)) continue // '_firstCorrectUserId' is not an answer
    if (v && (v.questionIndex === undefined || v.questionIndex === curQIndex)) {
      validAnswers[k] = v;
    }
  }

  const playersWithPresence = players.map(p => {
    const pProg = progress[String(p.id)] || {};
    const isAbandoned = Boolean(
      pProg.isAbandoned ||
      pProg.status === 'abandoned' ||
      pProg.isResigned ||
      pProg.hasLeft
    );
    return {
      ...p,
      activeFrame: (p.activeFrame === 'seerah' || p.activeFrame === 'general') ? p.activeFrame : null,
      isOnline: pProg.isOnline !== false,
      isAbandoned,
      status: isAbandoned ? 'abandoned' : (pProg.status || 'joined'),
      lastSeen: pProg.lastSeen || 0,
      score: pProg.score || 0
    };
  });

  const participantsCount = playersWithPresence.length || 1;
  const answeredCount = Object.keys(validAnswers).length;
  const onlineCount = playersWithPresence.filter(p => p.isOnline).length || 1;

  return {
    ...room,
    player1: playerMap.get(room.player1Id) || null,
    player2: room.player2Id ? playerMap.get(room.player2Id) || null : null,
    winner: room.winnerId ? playerMap.get(room.winnerId) || null : null,
    lastReaction: (room as any).lastReaction || progress.__lastReaction || null,
    transitionMode: (room as any).transitionMode || 'SYNC',
    currentQuestionIndex: room.currentQuestionIndex || 0,
    questionStartTime: Number(room.questionStartTime) || 0,
    answeredCount,
    onlineParticipantsCount: onlineCount,
    totalParticipants: participantsCount,
    currentAnswers: validAnswers,
    participants: playersWithPresence,
    players,
    challenges: mapChallenges(orderedChallenges),
    nextRoomId: (room as any).nextRoomId || progress.__rematch?.nextRoomId || null,
    playAgainUsers: (room as any).playAgainUsers || progress.__rematch?.playAgainUsers || []
  };
}

async function handleCreate(req: VercelRequest, res: VercelResponse) {
    const { player1Id, player1Name, category, categories, categories_config, challenge_type, level, levels, questionCount, questionIds, maxPlayers, gameMode, gameModes, timePerQuestion, customChallenges, topics, roomName, name, isPrivate, password, transitionMode, transition_mode } = req.body
    if (!player1Id && !player1Name) return res.status(400).json({ message: 'Missing player1Id' })

    const maxQuestions = Number(questionCount) || 5
    const finalIsPrivate = Boolean(isPrivate)
    const finalPassword = finalIsPrivate ? (password ? String(password).trim() : '') : null
    if (finalIsPrivate && !finalPassword) {
      return res.status(400).json({ message: 'يرجى إدخال كلمة المرور للغرفة الخاصة' })
    }
    const finalRoomName = (name && String(name).trim()) || (roomName && String(roomName).trim()) || 'غرفة التحدي'
    const finalTransitionMode = (transitionMode === 'ASYNC' || transition_mode === 'ASYNC') ? 'ASYNC' : 'SYNC'

    try {
      const acting = getActingPlayer(req)
      let player1 = acting ? acting.row : await findPlayer(player1Id, player1Name)
      
      // Auto-register if not found (never when the player comes from the session token)
      if (!acting && !player1 && player1Name) {
        const { data: newP } = await supabaseAdmin
          .from('players')
          .insert({ name: player1Name })
          .select()
          .single();
        player1 = newP;
      }

      if (!player1) return res.status(400).json({ message: 'اللاعب غير مسجل (Player not found)' })

      let code = ''
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let isUnique = false
      while (!isUnique) {
        code = ''
        for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
        const { data: existing } = await supabaseAdmin
          .from('rooms')
          .select('id')
          .eq('code', code)
          .maybeSingle();
        if (!existing) isUnique = true
      }

      let selectedChallenges: any[] = []
      if (Array.isArray(customChallenges) && customChallenges.length > 0) {
        selectedChallenges = customChallenges
      } else if (Array.isArray(questionIds) && questionIds.length > 0) {
        if (questionIds.length !== maxQuestions) {
          return res.status(400).json({ message: `يجب اختيار ${maxQuestions} أسئلة بالضبط` })
        }
        const { data: challenges } = await supabaseAdmin
          .from('challenges')
          .select('*')
          .in('id', questionIds.map(id => Number(id)));
        selectedChallenges = challenges || [];
        if (selectedChallenges.length !== questionIds.length) {
          return res.status(400).json({ message: 'بعض الأسئلة المختارة غير موجودة' })
        }
      } else {
        let query = supabaseAdmin.from('challenges').select('id');
        
        // Multi-Category Filtering (WHERE category IN (...))
        const cats = Array.isArray(categories) && categories.length > 0 
          ? categories 
          : (category && category !== "" ? [category] : []);
        if (cats.length > 0) {
          query = query.in('category', cats);
        }

        // Multi-Level Filtering (WHERE level IN (...))
        const lvls = Array.isArray(levels) && levels.length > 0
          ? levels.map(Number).filter(n => !isNaN(n))
          : (level ? [Number(level)] : []);
        if (lvls.length > 0) {
          query = query.in('level', lvls);
        }

        // Multi-Mode Filtering (WHERE type IN (...))
        const modesList: string[] = Array.isArray(gameModes) && gameModes.length > 0 
          ? gameModes 
          : (gameMode ? [gameMode] : []);

        const typeConditions: string[] = [];
        for (const m of modesList) {
          const upper = String(m).toUpperCase();
          if (upper === 'COMPLETION' || upper === 'COMPLETE') typeConditions.push('COMPLETION');
          else if (upper === 'SURAH') typeConditions.push('SURAH');
          else if (upper === 'STANDARD' || upper === 'AUDIO') typeConditions.push('STANDARD', 'AUDIO', '');
        }

        if (typeConditions.length > 0) {
          query = query.in('type', Array.from(new Set(typeConditions)));
        }

        const { data: allMatching, error: matchErr } = await query;

        // No questions of the chosen types: say so. (The old fallback took any challenges, so a
        // "complete the verse" room could get audio questions; its result was also overwritten
        // below, leaving the room with no questions at all.)
        if (matchErr || !allMatching || allMatching.length === 0) {
          return res.status(400).json({
            message: 'لا توجد أسئلة كافية من الأنواع المختارة. يرجى تقليل العدد أو اختيار نوع آخر.'
          })
        }

        const shuffledIds = allMatching.map(c => c.id).sort(() => Math.random() - 0.5)
        const chosenIds = shuffledIds.slice(0, maxQuestions)

        const { data: fetchedChallenges } = await supabaseAdmin
          .from('challenges')
          .select('*')
          .in('id', chosenIds);
        const mapById = new Map((fetchedChallenges || []).map(c => [c.id, c]))
        selectedChallenges = chosenIds.map(id => mapById.get(id)).filter(Boolean) as any[]
      }

      const selectedIds = (Array.isArray(customChallenges) && customChallenges.length > 0)
        ? customChallenges
        : selectedChallenges.map(c => c.id)
      const finalQuestionCount = selectedChallenges.length

      const insertObj: any = {
        code,
        name: finalRoomName,
        isPrivate: finalIsPrivate,
        password: finalPassword,
        player1Id: player1.id,
        challengeIds: selectedIds,
        status: 'WAITING',
        surahFilters: categories_config || req.body?.surahFilters || (Array.isArray(categories) ? categories : []),
        categoryFilter: category || (Array.isArray(categories_config) ? categories_config.map((c: any) => c.category).join('، ') : ""),
        questionCount: finalQuestionCount,
        maxPlayers: 999,
        gameMode: gameMode || "STANDARD",
        transitionMode: finalTransitionMode,
        timePerQuestion: (timePerQuestion !== undefined && !isNaN(Number(timePerQuestion))) ? Number(timePerQuestion) : 0,
        playersProgress: { [String(player1.id)]: { progress: 0, name: player1.name, joinedAt: Date.now() } }
      };

      if (req.body?.selected_juz) insertObj.selected_juz = req.body.selected_juz;
      if (req.body?.selected_surahs) insertObj.selected_surahs = req.body.selected_surahs;
      if (req.body?.room_settings || req.body?.roomSettings) {
        insertObj.room_settings = req.body.room_settings || req.body.roomSettings;
      }

      let { data: roomData, error: createError } = await supabaseAdmin
        .from('rooms')
        .insert(insertObj)
        .select()
        .single();

      if (createError && (createError.message.includes('selected_') || createError.message.includes('room_settings'))) {
        delete insertObj.selected_juz;
        delete insertObj.selected_surahs;
        delete insertObj.room_settings;
        const retry = await supabaseAdmin.from('rooms').insert(insertObj).select().single();
        roomData = retry.data;
        createError = retry.error;
      }

      if (createError || !roomData) {
        console.error('Failed to create room in supabaseAdmin:', createError)
        return res.status(500).json({ message: 'Failed to create room', error: createError?.message })
      }

      const fullRoom = await getFullRoom(roomData.id)
      return res.status(201).json(fullRoom)
    } catch (error: any) {
      console.error('Failed to create room:', error)
      return res.status(500).json({ message: 'Failed to create room', error: error.message, stack: error.stack })
    }
  }

  async function handleJoin(req: VercelRequest, res: VercelResponse) {
    const { code, roomId, id, player2Id, playerName, password, isInvite, invitedUserId } = req.body || {}
    const targetId = String(roomId || id || '').trim()
    const cleanCode = String(code || '').trim()
    if (!targetId && !cleanCode) return res.status(400).json({ message: 'يرجى تحديد الغرفة' })

    const effectivePlayerId = player2Id || req.body?.player2Name || req.headers['x-player-id'] || req.headers['x-player-username']
    const effectivePlayerName = playerName || req.body?.player2Name || req.headers['x-player-name']
    if (!effectivePlayerId && !effectivePlayerName) return res.status(400).json({ message: 'Missing player2Id' })

    try {
      let query = supabaseAdmin.from('rooms').select('*');
      if (targetId) {
        query = query.eq('id', targetId);
      } else {
        query = query.ilike('code', cleanCode);
      }
      const { data: room, error: roomErr } = await query.maybeSingle();
      
      if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة' })
      
      // Status can be WAITING or PLAYING (allow late join if within maxPlayers)
      if (room.status === 'FINISHED') return res.status(400).json({ message: 'هذا التحدي انتهى بالفعل' })
      if (room.status === 'CANCELLED') return res.status(410).json({ message: 'تم إلغاء هذه الغرفة من قبل المضيف' })

      // Check 10-minute TTL for WAITING rooms
      const tenMinutesAgoMs = Date.now() - 10 * 60 * 1000
      const roomCreatedMs = room.createdAt ? new Date(room.createdAt).getTime() : 0
      if (room.status === 'WAITING' && roomCreatedMs < tenMinutesAgoMs) {
        await supabaseAdmin.from('rooms').update({ status: 'EXPIRED' }).eq('id', room.id)
        return res.status(410).json({ message: 'انتهت صلاحية هذه الغرفة (تجاوزت 10 دقائق دون بدء)' })
      }
      if (room.status === 'EXPIRED') {
        return res.status(410).json({ message: 'انتهت صلاحية هذه الغرفة' })
      }

      const acting = getActingPlayer(req)
      let player = acting ? acting.row : await findPlayer(effectivePlayerId, effectivePlayerName)
      
      // Auto-register player if not in database yet (never when the player comes from the token)
      if (acting) {
        // The token's player: no new player, no rename.
      } else if (!player) {
        const defaultName = (effectivePlayerName && String(effectivePlayerName).trim()) || 'متسابق جديد'
        const { data: newP } = await supabaseAdmin.from('players').insert({ name: defaultName }).select().single()
        player = newP
      } else if (effectivePlayerName && String(effectivePlayerName).trim() && player.name !== String(effectivePlayerName).trim()) {
        const { data: updatedP } = await supabaseAdmin.from('players').update({ name: String(effectivePlayerName).trim() }).eq('id', player.id).select().single()
        player = updatedP || player
      }

      const isHost = String(player.id) === String(room.player1Id)

      // Build player identifiers once — reused for kick check and invite check
      let playersProgress = (room.playersProgress as any) || {}
      const myIdentifiers = [
        String(player.id),
        String(player.name || '').trim().toLowerCase(),
        player.username ? String(player.username).trim().toLowerCase().replace(/^@+/, '') : null,
        player.uniquePlayerId ? String(player.uniquePlayerId).toUpperCase() : null
      ].filter(Boolean) as string[]

      // 1a. Determine if this player carries a valid direct invite from the room host
      //     An invite is valid when isInvite=true AND invitedUserId matches one of the player's identifiers.
      //     A host re-invite acts as an explicit pardon — it overrides any previous kick.
      const hasValidInvite = Boolean(
        isInvite && invitedUserId && myIdentifiers.some(ident =>
          String(invitedUserId).toLowerCase() === ident.toLowerCase() ||
          String(invitedUserId) === String(player.id)
        )
      )

      // 1b. Check if the player has been kicked from this room:
      const kickedList: string[] = Array.isArray(playersProgress.__kicked) ? playersProgress.__kicked : []
      const isKicked = myIdentifiers.some(ident => kickedList.includes(ident))

      if (isKicked && !isHost) {
        if (hasValidInvite) {
          // Host sent a new direct invite → pardon: remove all identifiers from the kicked list
          playersProgress.__kicked = kickedList.filter(k => !myIdentifiers.includes(k))
          // Persist the updated kick list immediately so the join can proceed
          await supabaseAdmin.from('rooms').update({ playersProgress }).eq('id', room.id)
        } else {
          return res.status(403).json({ message: 'تم إخراجك من هذه الغرفة من قِبل المنشئ ولا يمكنك الانضمام إليها مجدداً' })
        }
      }

      // 2. Check if the player is friend with the host:
      // 2. Check if the player is friend with the host:
      let isFriendWithHost = false
      try {
        const { data: friendship } = await supabaseAdmin
          .from('friendships')
          .select('id, status')
          .eq('status', 'ACCEPTED')
          .or(`and(user_id.eq.${player.id},friend_id.eq.${room.player1Id}),and(user_id.eq.${room.player1Id},friend_id.eq.${player.id})`)
          .maybeSingle()
        if (friendship) isFriendWithHost = true
      } catch (_) {}

      // hasValidInvite was computed above in the kick-check block
      // Private Room Password Verification (Host, Invited players, or Friends bypass password verification)
      if (room.isPrivate && !isHost && !hasValidInvite && !isFriendWithHost) {
        const enteredPass = password ? String(password).trim() : ''
        const actualPass = room.password ? String(room.password).trim() : ''
        if (!enteredPass || enteredPass !== actualPass) {
          return res.status(403).json({ message: 'غير مصرح لك بالدخول أو الدعوة غير صالحة' })
        }
      }

      // Requirement 3: Backend Re-join Logic
      const existingParticipant = playersProgress[player.id]
      if (!existingParticipant) {
        playersProgress[player.id] = { 
          progress: 0, 
          joinedAt: Date.now(),
          name: player.name,
          status: 'joined',
          isAbandoned: false,
          isResigned: false,
          isDisqualified: false,
          hasLeft: false,
          isOnline: true
        }
      } else {
        // Re-activate existing record without creating duplicate entries
        playersProgress[player.id] = {
          ...existingParticipant,
          name: player.name || existingParticipant.name,
          status: 'joined',
          isAbandoned: false,
          isResigned: false,
          isDisqualified: false,
          hasLeft: false,
          isOnline: true,
          rejoinedAt: Date.now()
        }
      }

      await supabaseAdmin.from('rooms').update({
        playersProgress,
        // Keep player2Id compatibility for 1v1 if needed, but primary is playersProgress
        player2Id: room.player2Id || (room.player1Id !== player.id ? player.id : room.player2Id)
      }).eq('id', room.id)

      // Broadcast player_joined so all waiting clients update their participants list immediately
      supabaseAdmin.channel(`room_sync_${room.id}`).send({
        type: 'broadcast',
        event: 'player_joined',
        payload: {
          playerId: player.id,
          playerName: player.name,
          playerUsername: player.username || null,
          roomId: room.id,
          timestamp: Date.now()
        }
      }).catch(e => console.warn('[Join] Broadcast player_joined error:', e))

      // Play again: the finished room's leader entering its play-again room takes the lead back.
      if (room.status === 'WAITING' && String(room.player1Id) !== String(player.id)) {
        const parent = await findRematchParent(room.id)
        if (parent) await restoreRematchHost(room, player, rematchOriginalHostId(parent))
      }

      const fullRoom = await getFullRoom(room.id)
      return res.status(200).json(fullRoom)
    } catch (error: any) {
      console.error('Error in handleJoin:', error)
      return res.status(500).json({ message: 'فشل الانضمام للغرفة', error: error.message })
    }
  }

  async function handleListRooms(req: VercelRequest, res: VercelResponse) {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      // Automatically mark orphaned WAITING rooms older than 10 minutes as EXPIRED
      await supabaseAdmin
        .from('rooms')
        .update({ status: 'EXPIRED' })
        .eq('status', 'WAITING')
        .lt('createdAt', tenMinutesAgo);

      // Only return active WAITING rooms created within the last 10 minutes
      const { data: rooms, error: roomsErr } = await supabaseAdmin
        .from('rooms')
        .select('*')
        .eq('status', 'WAITING')
        .gte('createdAt', tenMinutesAgo)
        .order('createdAt', { ascending: false })
        .limit(40);

      if (roomsErr) {
        console.error('Error fetching rooms:', roomsErr);
        return res.status(500).json({ message: 'فشل جلب قائمة الغرف', error: roomsErr.message });
      }

      // Orphan play-again rooms (left by the old create-then-delete code): cancelled and hidden.
      const orphanIds = await findOrphanRematchRooms(rooms || [])
      if (orphanIds.size > 0) {
        await supabaseAdmin.from('rooms').update({ status: 'CANCELLED' }).in('id', [...orphanIds]).eq('status', 'WAITING')
      }
      const visibleRooms = (rooms || []).filter(r => !orphanIds.has(String(r.id)))

      const hostIds = Array.from(new Set(visibleRooms.map(r => r.player1Id).filter(Boolean)));
      let hostMap = new Map<number, any>();
      if (hostIds.length > 0) {
        const { data: hosts } = await supabaseAdmin
          .from('players')
          .select('id, name, username')
          .in('id', hostIds);
        (hosts || []).forEach(h => hostMap.set(h.id, h));
      }

      const formattedRooms = visibleRooms.map(r => {
        const progress = (r.playersProgress as any) || {}
        const participantCount = Object.keys(progress).filter(isRoomPlayerKey).length || 1
        const host = hostMap.get(r.player1Id)
        return {
          id: r.id,
          name: r.name || 'غرفة التحدي',
          isPrivate: Boolean(r.isPrivate),
          status: r.status,
          questionCount: r.questionCount,
          timePerQuestion: r.timePerQuestion,
          gameMode: r.gameMode,
          transitionMode: (r as any).transitionMode || 'SYNC',
          participantCount,
          hostId: r.player1Id,
          hostName: host?.name || 'مجهول',
          hostUsername: host?.username || null,
          createdAt: r.createdAt
        }
      })

      return res.status(200).json({ rooms: formattedRooms })
    } catch (err: any) {
      console.error('Error in handleListRooms:', err)
      return res.status(500).json({ message: 'فشل جلب قائمة الغرف', error: err.message })
    }
  }

  async function handleAvailableCounts(req: VercelRequest, res: VercelResponse) {
    try {
      const [audioRes, completeRes, surahRes] = await Promise.all([
        supabaseAdmin.from('challenges').select('*', { count: 'exact', head: true }).in('type', ['STANDARD', 'AUDIO', '']),
        supabaseAdmin.from('challenges').select('*', { count: 'exact', head: true }).eq('type', 'COMPLETION'),
        supabaseAdmin.from('challenges').select('*', { count: 'exact', head: true }).eq('type', 'SURAH')
      ]);

      return res.status(200).json({
        counts: {
          audio: audioRes.count || 0,
          complete: Math.max(100, completeRes.count || 0),
          surah: Math.max(24, surahRes.count || 0)
        }
      });
    } catch (err: any) {
      console.error('Error in handleAvailableCounts:', err)
      return res.status(500).json({ message: 'فشل جلب الأعداد المتاحة', error: err.message })
    }
  }

function calculateResults(room: any, playersProgress: Record<string, any>) {
  const totalQuestions = room.questionCount || room.totalQuestions || 1
  const updatedProgress: Record<string, any> = { ...playersProgress }

  // 1. Enforce Strict Zero Reward Policy:
  // player.answersCount === room.totalQuestions (or roundHistory.length === totalQuestions or progress === 100)
  // Any player marked as abandoned, resigned, or who did not complete all questions is disqualified: 0 cups, 0 points!
  for (const [pIdStr, pData] of Object.entries(updatedProgress)) {
    if (!isRoomPlayerKey(pIdStr) || !pData || typeof pData !== 'object') continue

    const isAbandoned = Boolean(
      pData.status === 'abandoned' ||
      pData.isAbandoned === true ||
      pData.isResigned === true ||
      pData.hasLeft === true ||
      pData.isDisqualified === true
    )

    const answersCount = typeof pData.answersCount === 'number'
      ? pData.answersCount
      : (Array.isArray(pData.roundHistory) ? pData.roundHistory.length : (pData.progress === 100 ? totalQuestions : 0))

    if (isAbandoned) {
      // Disqualified from rankings: 0 cups and 0 points ONLY for genuine explicit abandonment/resignation
      pData.isDisqualified = true
      pData.isAbandoned = true
      pData.status = 'abandoned'
      pData.score = 0
      pData.finalTotalScore = 0
      pData.basePoints = 0
      pData.bonusPoints = 0
      pData.speedBonusCount = 0
      pData.accuracyBonus = 0
      pData.completionBonus = 0
      pData.trophiesAwarded = 0
      continue
    }

    const correctCount = typeof pData.correctCount === 'number' ? pData.correctCount : 0
    const speedBonusCount = typeof pData.speedBonusCount === 'number' ? pData.speedBonusCount : 0
    const basePoints = typeof pData.basePoints === 'number'
      ? pData.basePoints
      : (typeof pData.score === 'number' ? pData.score : (correctCount * 1))
    const bonusPoints = typeof pData.bonusPoints === 'number' ? pData.bonusPoints : 0
    const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) : 0
    const accuracyBonus = accuracy > 0.90 ? 15 : 0 // Bonus +15 for >90% accuracy

    pData.basePoints = basePoints
    pData.bonusPoints = bonusPoints
    pData.speedBonusCount = speedBonusCount
    pData.accuracyBonus = accuracyBonus
    pData.accuracy = Math.round(accuracy * 100)
    pData.completionBonus = 0
  }

  // 2. Award Conditional Early Completion Bonus (+10 pts)
  // Strictly to the first qualified (non-disqualified) finisher with accuracy > 70%
  const finishers = Object.entries(updatedProgress)
    .filter(([pIdStr, p]) => isRoomPlayerKey(pIdStr) && p && !p.isDisqualified && !p.isAbandoned && p.finishTime && typeof p.finishTime === 'number')
    .sort(([_, a], [__, b]) => (a.finishTime || 0) - (b.finishTime || 0))

  for (const [_, p] of finishers) {
    const correctCount = typeof p.correctCount === 'number' ? p.correctCount : 0
    const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) : 0
    if (accuracy > 0.70) {
      p.completionBonus = 10
      break // Only the first eligible finisher gets the completion bonus
    }
  }

  // 3. Compute final total score
  for (const [pIdStr, pData] of Object.entries(updatedProgress)) {
    if (!isRoomPlayerKey(pIdStr) || !pData || typeof pData !== 'object') continue
    if (pData.isDisqualified || pData.isAbandoned) {
      pData.score = 0
      pData.finalTotalScore = 0
      pData.basePoints = 0
      pData.bonusPoints = 0
      pData.trophiesAwarded = 0
      continue
    }
    // Unified score: basePoints + bonusPoints
    const basePts = typeof pData.basePoints === 'number' ? pData.basePoints : (typeof pData.correctCount === 'number' ? pData.correctCount : 0)
    const bonusPts = typeof pData.bonusPoints === 'number' ? pData.bonusPoints : 0
    pData.score = basePts + bonusPts
    pData.finalTotalScore = basePts + bonusPts + (pData.speedBonusCount || 0) + (pData.accuracyBonus || 0) + (pData.completionBonus || 0)
  }

  // 4. Determine winner by highest final total score among qualified players only!
  const ranked = Object.entries(updatedProgress)
    .filter(([pIdStr, p]) => isRoomPlayerKey(pIdStr) && p && !p.isDisqualified && !p.isAbandoned && p.status !== 'abandoned')
    .map(([id, p]: [string, any]) => ({
      id: parseInt(id),
      score: p.finalTotalScore || p.score || 0,
      finishTime: p.finishTime || Infinity
    }))
    .sort((a, b) => b.score - a.score || a.finishTime - b.finishTime)

  const winnerId = ranked.length > 0 ? ranked[0].id : null

  // 5. Award trophies strictly to qualified finishers in Top 4 positions: 1st (+4), 2nd (+3), 3rd (+2), 4th (+1), 5th+ (0)
  const TROPHY_REWARDS = [4, 3, 2, 1]
  for (let i = 0; i < Math.min(4, ranked.length); i++) {
    const pIdStr = String(ranked[i].id)
    if (updatedProgress[pIdStr]) {
      updatedProgress[pIdStr].trophiesAwarded = TROPHY_REWARDS[i]
    }
  }

  // Ensure all disqualified or abandoned players have 0 trophies and 0 score
  for (const [pIdStr, pData] of Object.entries(updatedProgress)) {
    if (!isRoomPlayerKey(pIdStr) || !pData || typeof pData !== 'object') continue
    if (pData.isDisqualified || pData.isAbandoned || pData.status === 'abandoned') {
      pData.trophiesAwarded = 0
      pData.score = 0
      pData.finalTotalScore = 0
      pData.basePoints = 0
      pData.bonusPoints = 0
    }
  }

  return { updatedProgress, winnerId }
}

const finalizeRoomScores = calculateResults

async function applyRoomTrophies(_tx: any, room: any, progress: Record<string, any>) {
  if (room && (room.rewardsDistributed || room.isRewardsApplied)) return;
  if (room) room.rewardsDistributed = true;

  const totalQuestions = room.questionCount || room.totalQuestions || 1;
  const ranked = Object.entries(progress)
    .filter(([id, p]: [string, any]) => {
      if (!isRoomPlayerKey(id) || !p || typeof p !== 'object') return false;
      const isAbandoned = Boolean(
        p.status === 'abandoned' ||
        p.isAbandoned === true ||
        p.isResigned === true ||
        p.hasLeft === true ||
        p.isDisqualified === true
      );
      if (isAbandoned) return false;
      const answersCount = typeof p.answersCount === 'number'
        ? p.answersCount
        : (Array.isArray(p.roundHistory) ? p.roundHistory.length : (p.progress === 100 ? totalQuestions : 0));
      return answersCount >= totalQuestions || p.progress === 100;
    })
    .map(([id, p]: [string, any]) => ({
      id: parseInt(id),
      score: p.finalTotalScore || p.score || 0,
      finishTime: p.finishTime || Infinity
    }))
    .filter(p => !isNaN(p.id) && p.id > 0)
    .sort((a, b) => b.score - a.score || a.finishTime - b.finishTime);

  // Anti-Farming Condition & Rank-based Rewards Distribution:
  // Total players check: Rooms are eligible for bonus points ONLY if total players > 5 (6+ players)
  // Rank 1 (Index 0): Trophy (+1) + Base Points + 50 Bonus Points (if totalPlayers > 5)
  // Rank 2 (Index 1): Trophy (0)  + Base Points + 30 Bonus Points (if totalPlayers > 5)
  // Rank 3 (Index 2): Trophy (0)  + Base Points + 15 Bonus Points (if totalPlayers > 5)
  // Rank 4+ (Index 3+): Trophy (0) + Base Points only (0 Bonus Points)
  // Note: 1st place always earns the Trophy (+1) regardless of player count
  const totalPlayers = ranked.length;
  const isEligibleForBonus = totalPlayers > 5;

  for (let index = 0; index < ranked.length; index++) {
    const player = ranked[index];
    const targetId = player.id;
    let earnedTrophy = 0;
    let bonusPoints = 0;

    if (index === 0) {
      earnedTrophy = 1; // الكأس للمركز الأول دائماً
      if (isEligibleForBonus) bonusPoints = 50;
    } else if (index === 1 && isEligibleForBonus) {
      bonusPoints = 30;
    } else if (index === 2 && isEligibleForBonus) {
      bonusPoints = 15;
    }

    const pKey = String(targetId);
    if (progress[pKey]) {
      progress[pKey].rank = index + 1;
      progress[pKey].earnedTrophies = earnedTrophy;
      progress[pKey].rankBonus = bonusPoints;
      progress[pKey].isEligibleForBonus = isEligibleForBonus;
      progress[pKey].finalTotalPoints = (player.score || 0) + bonusPoints;
    }

    try {
      const { data: p } = await supabaseAdmin
        .from('players')
        .select('cups, points')
        .eq('id', targetId)
        .maybeSingle();

      if (p) {
        const updateData: any = {};
        if (earnedTrophy > 0) {
          updateData.cups = (p.cups || 0) + earnedTrophy;
        }
        if (bonusPoints > 0) {
          updateData.points = (p.points || 0) + bonusPoints;
        }
        if (Object.keys(updateData).length > 0) {
          await supabaseAdmin.from('players').update(updateData).eq('id', targetId);
        }
      }
    } catch (e) {
      console.error(`Failed to update rank-based rewards for player ${targetId}:`, e);
    }
  }
}

function evaluateQuestionScores(
  playersProgress: Record<string, any>,
  currentAnswers: Record<string, { playerId: number; name: string; isCorrect: boolean; timestamp: number; pointsEarned?: number; basePoints?: number; bonusPoints?: number; score?: number }>,
  firstCorrectUserId?: number | null
) {
  // 1. Filter only correct answers and sort by timestamp ascending (fastest first)
  const correctSubmissions = Object.values(currentAnswers)
    .filter(ans => ans && (ans as any).isCorrect === true && typeof (ans as any).playerId === 'number')
    .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))

  // The speed bonus is strictly awarded ONLY to the single first player who answered correctly
  const effectiveFirstCorrectUserId = firstCorrectUserId ?? (correctSubmissions.length > 0 ? correctSubmissions[0].playerId : null)

  const updatedProgress: Record<string, any> = { ...playersProgress }

  for (const [pIdStr, pData] of Object.entries(updatedProgress)) {
    if (!isRoomPlayerKey(pIdStr) || !pData || typeof pData !== 'object') continue
    const numId = parseInt(pIdStr)
    const ans = currentAnswers[pIdStr]

    if (typeof pData.score !== 'number') pData.score = 0
    if (typeof pData.correctCount !== 'number') pData.correctCount = 0
    if (typeof pData.speedBonusCount !== 'number') pData.speedBonusCount = 0
    if (typeof pData.basePoints !== 'number') pData.basePoints = 0
    if (typeof pData.bonusPoints !== 'number') pData.bonusPoints = 0
    if (!Array.isArray(pData.roundHistory)) pData.roundHistory = []
    pData.answersCount = (pData.answersCount || 0) + 1

    let roundPoints = 0
    let earnedSpeedBonus = false

    if (ans && (ans.isCorrect || (typeof ans.pointsEarned === 'number' && ans.pointsEarned > 0))) {
      const qBasePoints = typeof ans.basePoints === 'number' ? ans.basePoints : (ans.isCorrect ? 1 : 0)
      const qBonusPoints = typeof ans.bonusPoints === 'number' ? ans.bonusPoints : 0
      const qPointsEarned = typeof ans.pointsEarned === 'number' ? ans.pointsEarned : (qBasePoints + qBonusPoints)

      roundPoints = qPointsEarned
      if (ans.isCorrect) {
        pData.correctCount += 1
      }
      pData.basePoints += qBasePoints
      pData.bonusPoints += qBonusPoints

      // Speed bonus: إحصائية للسرعة مع الحفاظ على النقاط كنقطة واحدة (+1)
      if (effectiveFirstCorrectUserId !== null && numId === effectiveFirstCorrectUserId) {
        earnedSpeedBonus = true
        pData.speedBonusCount += 1
      }
    }

    pData.score += roundPoints
    pData.lastRoundPoints = roundPoints
    pData.lastRoundBonus = earnedSpeedBonus
    pData.roundHistory.push({
      roundPoints,
      earnedSpeedBonus,
      isCorrect: ans ? Boolean(ans.isCorrect) : false,
      basePoints: ans ? ans.basePoints : 0,
      bonusPoints: ans ? ans.bonusPoints : 0,
      timestamp: ans ? ans.timestamp : null
    })
  }

  return updatedProgress
}

async function advanceRoomToNextQuestionTx(_tx: any, room: any, currentAnswers: Record<string, any>) {
  const playersProgress = (room.playersProgress as any) || {}
  const now = Date.now()

  // Requirement 3: Default Wrong Answer for all registered participants without an answer
  // (including disconnected/offline players) so their records remain synchronized.
  const completeAnswers: Record<string, any> = { ...currentAnswers }
  for (const [pIdStr, pData] of roomPlayerEntries(playersProgress)) {
    if (!completeAnswers[pIdStr]) {
      completeAnswers[pIdStr] = {
        playerId: parseInt(pIdStr),
        name: (pData as any)?.name || 'متسابق',
        isCorrect: false,
        timestamp: now,
        questionIndex: room.currentQuestionIndex || 0,
        isDefaulted: true
      }
    }
    // Update playerCurrentQuestionIndex so when they reconnect, they resume on the new question
    if (pData) {
      (pData as any).playerCurrentQuestionIndex = (room.currentQuestionIndex || 0) + 1
    }
  }

  const firstCorrectId = (room.currentAnswers as any)?._firstCorrectUserId || (completeAnswers as any)?._firstCorrectUserId;
  const updatedProgress = evaluateQuestionScores(playersProgress, completeAnswers, firstCorrectId)

  const nextIndex = (room.currentQuestionIndex || 0) + 1
  const isFinished = nextIndex >= room.questionCount

  let finalProgress = updatedProgress
  let winnerId = room.winnerId

  if (isFinished) {
    for (const [pIdStr, ans] of Object.entries(completeAnswers)) {
      if (isRoomPlayerKey(pIdStr) && finalProgress[pIdStr]) {
        finalProgress[pIdStr].finishTime = Number(ans?.timestamp) || now
        finalProgress[pIdStr].progress = 100
      }
    }
    const finalized = finalizeRoomScores(room, finalProgress)
    finalProgress = finalized.updatedProgress
    winnerId = finalized.winnerId

    await applyRoomTrophies(null, room, finalProgress)
  }

  const { data: updatedRoom } = await supabaseAdmin.from('rooms').update({
    currentQuestionIndex: nextIndex,
    questionStartTime: Date.now(),
    currentAnswers: {}, // Clear answers for new question
    playersProgress: finalProgress,
    status: isFinished ? 'completed' : 'PLAYING',
    winnerId
  }).eq('id', room.id).select().single()

  // Broadcast question_advanced to all players in the room immediately
  try {
    supabaseAdmin.channel(`room_sync_${room.id}`).send({
      type: 'broadcast',
      event: 'question_advanced',
      payload: {
        roomId: room.id,
        currentQuestionIndex: nextIndex,
        isFinished,
        winnerId,
        questionStartTime: Date.now(),
        room: updatedRoom || room
      }
    }).catch(e => console.warn('[AdvanceQuestion] Broadcast error:', e))
  } catch (_) {}

  if (isFinished) {
    try {
      supabaseAdmin.channel(`room_sync_${room.id}`).send({
        type: 'broadcast',
        event: 'room_completed',
        payload: { roomId: room.id, status: 'completed' }
      }).catch(() => {});
    } catch (_) {}
  }

  return updatedRoom || room
}

async function advanceRoomToNextQuestion(room: any, currentAnswers: Record<string, any>) {
  const updatedRoom = await advanceRoomToNextQuestionTx(null, room, currentAnswers)
  return await getFullRoom(updatedRoom.id)
}

async function handlePoll(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId } = req.query
  try {
    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', roomId as string).maybeSingle()
    if (!room) return res.status(404).json({ error: 'Room not found' })

    if (room.status === 'CANCELLED') {
      const fullRoom = await getFullRoom(room.id)
      return res.status(200).json(fullRoom)
    }

    const playersProgress: any = (room.playersProgress as any) || {}
    // No heartbeat write here any more: poll now runs every few seconds from every player, and
    // writing back this (possibly stale) copy of playersProgress could erase answers / scores
    // written in between. Presence comes from Supabase Presence and the 'presence' action.

    // In SYNC mode: Check if timer expired on server side OR all online players answered
    if (room.status === 'PLAYING' && (room as any).transitionMode !== 'ASYNC') {
      const curQ = room.currentQuestionIndex || 0
      const isTimerExpired = room.timePerQuestion > 0 && room.questionStartTime &&
        ((Date.now() - Number(room.questionStartTime)) / 1000 >= (room.timePerQuestion + 1.5))

      // Per player, not a count: currentAnswers also holds '_firstCorrectUserId', which used to be
      // counted as an answer (2 players, the first correct answer => "everyone answered").
      // Everyone answered, or the only ones missing are away and ABSENT_WAIT_MS has passed.
      const allActiveAnswered = haveAllActivePlayersAnswered(room) || absentWaitIsOver(room)
      const totalQ = room.questionCount || 5
      const isLastQuestion = curQ >= totalQ - 1

      if (isTimerExpired || allActiveAnswered) {
        try {
          const { data: freshRoom } = await supabaseAdmin.from('rooms').select('*').eq('id', room.id).maybeSingle()
          if (freshRoom && freshRoom.status === 'PLAYING' && freshRoom.currentQuestionIndex === curQ) {
            await advanceRoomToNextQuestionTx(null, freshRoom, (freshRoom.currentAnswers as any) || {})
          }
        } catch (err) {
          console.error('Error auto-advancing in poll:', err)
        }
      }
    }

    const fullRoom = await getFullRoom(roomId as string)
    return res.status(200).json(fullRoom)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

async function handleStart(req: VercelRequest, res: VercelResponse) {
  const { roomId } = req.body
  try {
    await supabaseAdmin.from('rooms').update({ 
      status: 'PLAYING',
      currentQuestionIndex: 0,
      questionStartTime: Date.now(),
      currentAnswers: {}
    }).eq('id', roomId as string)
    const fullRoom = await getFullRoom(roomId as string)
    return res.status(200).json(fullRoom)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

async function handleSubmitAnswer(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId, questionIndex, timestamp, score } = req.body
  if (!roomId || !playerId || questionIndex === undefined) {
    return res.status(400).json({ message: 'Missing fields' })
  }
  // The page stayed hidden longer than AWAY_NO_SCORE_MS during this question: it scores zero
  // (no points, not correct, no speed bonus). Nothing else happens; the next questions count.
  const away = req.body?.awayFlag === true
  const isCorrect = away ? false : req.body?.isCorrect
  const pointsEarned = away ? 0 : req.body?.pointsEarned
  const basePoints = away ? 0 : req.body?.basePoints
  const bonusPoints = away ? 0 : req.body?.bonusPoints

  try {
    const player = await findPlayer(playerId)
    if (!player) return res.status(404).json({ message: 'Player not found' })

    const pIdStr = String(player.id)
    const subTime = Number(timestamp) || Date.now()

    const qBase = typeof basePoints === 'number' ? basePoints : (typeof pointsEarned === 'number' ? pointsEarned : (Boolean(isCorrect) ? 1 : 0))
    const qBonus = typeof bonusPoints === 'number' ? bonusPoints : 0
    const qTotal = typeof pointsEarned === 'number' ? pointsEarned : (qBase + qBonus)

    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', roomId as string).maybeSingle()
    if (!room || room.status !== 'PLAYING') {
      const fullRoom = await getFullRoom(roomId as string)
      return res.status(200).json(fullRoom)
    }

    const isAsync = (room as any).transitionMode === 'ASYNC'

    if (isAsync) {
      // ASYNC MODE
      const currentAnswers = (room.currentAnswers as any) || {}
      const qKey = String(questionIndex)
      currentAnswers[qKey] = currentAnswers[qKey] || {}

      const playersProgress = (room.playersProgress as any) || {}
      if (!playersProgress[pIdStr]) {
        playersProgress[pIdStr] = { name: player.name, score: 0, correctCount: 0, speedBonusCount: 0, basePoints: 0, bonusPoints: 0 }
      }
      const pData = playersProgress[pIdStr]

      if (!currentAnswers[qKey][pIdStr]) {
        currentAnswers[qKey][pIdStr] = {
          playerId: player.id,
          name: player.name,
          isCorrect: Boolean(isCorrect),
          timestamp: subTime,
          questionIndex: Number(questionIndex),
          pointsEarned: qTotal,
          basePoints: qBase,
          bonusPoints: qBonus,
          ...(away ? { away: true, wasCorrect: Boolean(req.body?.isCorrect) } : {}),
          serverTime: Date.now()
        }

        if (Boolean(isCorrect) || qTotal > 0) {
          if (Boolean(isCorrect)) {
            pData.correctCount = (pData.correctCount || 0) + 1
          }
          pData.basePoints = (pData.basePoints || 0) + qBase
          pData.bonusPoints = (pData.bonusPoints || 0) + qBonus
          pData.score = typeof score === 'number' ? score : ((pData.basePoints || 0) + (pData.bonusPoints || 0))

          // Track firstCorrectUserId per question on server
          if (Boolean(isCorrect) && !currentAnswers[qKey]._firstCorrectUserId) {
            currentAnswers[qKey]._firstCorrectUserId = player.id;
            pData.speedBonusCount = (pData.speedBonusCount || 0) + 1;
          }
        } else {
          pData.basePoints = pData.basePoints || 0
          pData.bonusPoints = pData.bonusPoints || 0
          pData.score = typeof score === 'number' ? score : ((pData.basePoints || 0) + (pData.bonusPoints || 0))
        }

        const qNum = Number(questionIndex)
        pData.answersCount = (pData.answersCount || 0) + 1
        pData.progress = Math.round(((qNum + 1) / room.questionCount) * 100)
        pData.playerCurrentQuestionIndex = qNum + 1
        pData.lastSeen = Date.now()
        pData.isOnline = true

        if (qNum + 1 >= room.questionCount) {
          pData.finishTime = pData.finishTime || subTime
          pData.progress = 100
        }
      }

      const asyncPlayers = roomPlayerEntries(playersProgress)
      const allFinished = asyncPlayers.length > 0 &&
        asyncPlayers.every(([, p]: [string, any]) => p.finishTime || p.isAbandoned || p.status === 'abandoned' || p.isResigned)

      const { updatedProgress, winnerId } = finalizeRoomScores(room, playersProgress)

      if (allFinished) {
        await applyRoomTrophies(null, room, updatedProgress)
      }

      await supabaseAdmin.from('rooms').update({
        currentAnswers,
        playersProgress: updatedProgress,
        status: allFinished ? 'FINISHED' : 'PLAYING',
        winnerId: allFinished ? winnerId : room.winnerId
      }).eq('id', room.id)
    } else {
      // SYNC MODE:
      // Only accept answers for the active question. A late answer is refused explicitly so the
      // client re-syncs to the room's real question (it used to be dropped silently).
      if (Number(questionIndex) !== room.currentQuestionIndex) {
        const fullRoom = await getFullRoom(roomId as string)
        return res.status(409).json({ accepted: false, code: 'STALE_QUESTION', room: fullRoom })
      }

      const currentAnswers: Record<string, any> = (room.currentAnswers as any) || {}
      if (!currentAnswers[pIdStr]) {
        currentAnswers[pIdStr] = {
          playerId: player.id,
          name: player.name,
          isCorrect: Boolean(isCorrect),
          timestamp: subTime,
          questionIndex: Number(questionIndex),
          pointsEarned: qTotal,
          basePoints: qBase,
          bonusPoints: qBonus,
          ...(away ? { away: true, wasCorrect: Boolean(req.body?.isCorrect) } : {}),
          serverTime: Date.now()
        }

        if (Boolean(isCorrect) && !currentAnswers._firstCorrectUserId) {
          currentAnswers._firstCorrectUserId = player.id;
        }
      }

      const playersProgress = (room.playersProgress as any) || {}
      if (!playersProgress[pIdStr]) {
        playersProgress[pIdStr] = { name: player.name, score: 0, basePoints: 0, bonusPoints: 0 }
      }
      if (typeof score === 'number') {
        playersProgress[pIdStr].score = score
      }
      playersProgress[pIdStr].isOnline = true
      playersProgress[pIdStr].lastSeen = Date.now()

      await supabaseAdmin.from('rooms').update({
        currentAnswers,
        playersProgress
      }).eq('id', room.id)

      // Broadcast player_answered so all players in the room update answers immediately
      try {
        supabaseAdmin.channel(`room_sync_${room.id}`).send({
          type: 'broadcast',
          event: 'player_answered',
          payload: {
            roomId: room.id,
            playerId: player.id,
            pIdStr,
            questionIndex: Number(questionIndex),
            isCorrect: Boolean(isCorrect),
            pointsEarned: qTotal,
            basePoints: qBase,
            bonusPoints: qBonus,
            score: playersProgress[pIdStr]?.score,
            currentAnswers,
            playersProgress
          }
        }).catch(e => console.warn('[SubmitAnswer] Broadcast error:', e))
      } catch (_) {}

      // Check if all active online players have now answered the current question
      const curQ = Number(questionIndex)
      const validAnswers = Object.entries(currentAnswers).filter(([k, a]: [string, any]) => {
        if (!isRoomPlayerKey(k)) return false
        return a && (a.questionIndex === undefined || a.questionIndex === curQ)
      })

      const activePlayers = roomPlayerEntries(playersProgress).filter(([, p]: [string, any]) => {
        return !p.hasLeft && !p.isResigned && !p.isAbandoned && p.status !== 'abandoned'
      })

      const allActiveAnswered = activePlayers.length > 0 && validAnswers.length >= activePlayers.length

      if (allActiveAnswered) {
        // Automatically advance to next question OR finalize room if it's the last question
        await advanceRoomToNextQuestionTx(
          null,
          { ...room, currentAnswers, playersProgress },
          currentAnswers
        )
      }
    }

    const fullRoom = await getFullRoom(roomId as string)
    return res.status(200).json(fullRoom)
  } catch (error: any) {
    console.error('Error in handleSubmitAnswer:', error)
    return res.status(500).json({ message: 'Failed to submit answer', error: error.message })
  }
}

async function handleAdvanceQuestion(req: VercelRequest, res: VercelResponse) {
  const { roomId, questionIndex, playerId } = req.body
  if (!roomId || questionIndex === undefined) {
    return res.status(400).json({ message: 'Missing fields' })
  }

  try {
    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', roomId as string).maybeSingle()
    if (!room || room.status !== 'PLAYING') {
      const fullRoom = await getFullRoom(roomId as string)
      return res.status(200).json(fullRoom)
    }

    // Validate caller is a participant of this room
    if (playerId) {
      const player = await findPlayer(playerId)
      if (player) {
        const participants = Array.isArray(room.participants) ? room.participants : []
        // rooms has no participants column: players are the keys of playersProgress (and player2Id).
        const progressKeys = Object.keys((room.playersProgress as any) || {})
        const isParticipant = (player.id === room.player1Id) || String(player.id) === String(room.player2Id) ||
          progressKeys.includes(String(player.id)) || participants.some((p: any) =>
          String(p.id) === String(player.id) ||
          p.name === player.name ||
          (p.username && player.username && p.username.toLowerCase() === player.username.toLowerCase())
        )

        if (!isParticipant) {
          console.warn(`Non-participant player ${playerId} attempted to advance question`)
          const fullRoom = await getFullRoom(roomId as string)
          return res.status(200).json(fullRoom)
        }
      }
    }

    // Guard against race conditions / double advancement:
    if (Number(questionIndex) !== room.currentQuestionIndex) {
      const fullRoom = await getFullRoom(roomId as string)
      return res.status(200).json(fullRoom)
    }

    // SYNC: any player may ask, but only once everyone answered or the question's time is over
    // (server clock). Nobody is skipped earlier because they look offline.
    if ((room as any).transitionMode !== 'ASYNC' && !isQuestionTimeUp(room) && !haveAllActivePlayersAnswered(room) && !absentWaitIsOver(room)) {
      const fullRoom = await getFullRoom(roomId as string)
      return res.status(409).json({ accepted: false, code: 'TOO_EARLY', room: fullRoom })
    }

    const currentAnswers = (room.currentAnswers as any) || {}
    await advanceRoomToNextQuestionTx(null, room, currentAnswers)

    const fullRoom = await getFullRoom(roomId as string)
    return res.status(200).json(fullRoom)
  } catch (error: any) {
    console.error('Error in handleAdvanceQuestion:', error)
    return res.status(500).json({ message: 'Failed to advance question', error: error.message })
  }
}

async function handleEndRoom(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId } = req.body
  if (!roomId) {
    return res.status(400).json({ message: 'Missing roomId' })
  }

  try {
    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', roomId as string).maybeSingle()
    if (!room) {
      return res.status(404).json({ message: 'Room not found' })
    }

    if (room.status === 'FINISHED' || (room.status as string) === 'completed') {
      const fullRoom = await getFullRoom(room.id)
      return res.status(200).json(fullRoom)
    }

    // Host / Participant validation
    if (playerId) {
      const player = await findPlayer(playerId)
      if (player && player.id !== room.player1Id) {
        const totalQ = room.questionCount || 5
        const isAtLastQuestion = (room.currentQuestionIndex || 0) >= totalQ - 1
        const participants = Array.isArray(room.participants) ? room.participants : []
        const isParticipant = participants.some((p: any) =>
          String(p.id) === String(player.id) ||
          p.name === player.name ||
          (p.username && player.username && p.username.toLowerCase() === player.username.toLowerCase())
        )

        if (!isAtLastQuestion && !isParticipant) {
          console.warn(`Non-participant player ${playerId} attempted to end room prematurely`)
          return res.status(403).json({ message: 'Only host can end the room' })
        }
      }
    }

    // SYNC: the room only ends once every non-withdrawn player answered or the question's time is
    // over (server clock), like advance-question.
    if (room.status === 'PLAYING' && (room as any).transitionMode !== 'ASYNC' && !isQuestionTimeUp(room) && !haveAllActivePlayersAnswered(room)) {
      const fullRoom = await getFullRoom(room.id)
      return res.status(409).json({ accepted: false, code: 'TOO_EARLY', room: fullRoom })
    }

    const currentAnswers = (room.currentAnswers as any) || {}
    const playersProgress = (room.playersProgress as any) || {}
    const now = Date.now()

    // Ensure all players have an answer entry for the final question
    const completeAnswers: Record<string, any> = { ...currentAnswers }
    for (const [pIdStr, pData] of Object.entries(playersProgress)) {
      if (!isRoomPlayerKey(pIdStr)) continue
      if (!completeAnswers[pIdStr]) {
        completeAnswers[pIdStr] = {
          playerId: parseInt(pIdStr),
          name: (pData as any)?.name || 'متسابق',
          isCorrect: false,
          timestamp: now,
          questionIndex: room.currentQuestionIndex || 0,
          isDefaulted: true
        }
      }
    }

    const firstCorrectId = (room.currentAnswers as any)?._firstCorrectUserId || (completeAnswers as any)?._firstCorrectUserId
    const updatedProgress = evaluateQuestionScores(playersProgress, completeAnswers, firstCorrectId)

    for (const [pIdStr, ans] of Object.entries(completeAnswers)) {
      if (!isRoomPlayerKey(pIdStr)) continue
      if (updatedProgress[pIdStr]) {
        updatedProgress[pIdStr].finishTime = Number(ans?.timestamp) || now
        updatedProgress[pIdStr].progress = 100
      }
    }

    const finalized = finalizeRoomScores(room, updatedProgress)
    const finalProgress = finalized.updatedProgress
    const winnerId = finalized.winnerId

    await applyRoomTrophies(null, room, finalProgress)
    await supabaseAdmin.from('rooms').update({
      playersProgress: finalProgress,
      status: 'completed',
      winnerId
    }).eq('id', room.id)

    // Broadcast room_completed so all players navigate to results
    try {
      supabaseAdmin.channel(`room_sync_${room.id}`).send({
        type: 'broadcast',
        event: 'room_completed',
        payload: { roomId: room.id, status: 'completed' }
      }).catch(() => {});
    } catch (_) {}

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json(fullRoom)
  } catch (error: any) {
    console.error('Error in handleEndRoom:', error)
    return res.status(500).json({ message: 'Failed to end room', error: error.message })
  }
}

async function handleSubmitProgress(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId, progress, isFinished, score } = req.body
  if (!roomId || !playerId || progress === undefined) return res.status(400).json({ message: 'Missing fields' })

  try {
    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', roomId as string).maybeSingle()
    if (!room || room.status === 'FINISHED') return res.status(404).json({ message: 'Room not found or finished' })

    const player = await findPlayer(playerId)
    if (!player) return res.status(404).json({ message: 'Player not found' })

    // Safe read-modify-write: never erases other keys written meanwhile (__rematch, answers...).
    let finishedNow = false
    let winner: any = null
    const saved = await updatePlayersProgress(room.id, (playersProgress, fresh) => {
      if (!playersProgress[player.id]) playersProgress[player.id] = { name: player.name }
      playersProgress[player.id].progress = progress
      if (typeof score === 'number') {
        playersProgress[player.id].score = score
      }
      finishedNow = false
      winner = null
      if (isFinished) {
        playersProgress[player.id].finishTime = playersProgress[player.id].finishTime || Date.now()
        playersProgress[player.id].progress = 100
        playersProgress[player.id].answersCount = fresh.questionCount || 5
        finishedNow = roomPlayerEntries(playersProgress)
          .every(([_, p]: [string, any]) => p && (p.finishTime || p.isAbandoned || p.status === 'abandoned' || p.isResigned))
        const { updatedProgress, winnerId } = calculateResults(fresh, playersProgress)
        Object.assign(playersProgress, updatedProgress)
        winner = winnerId
      }
    }, () => ({
      ...(finishedNow ? { status: 'FINISHED' } : {}),
      ...(winner ? { winnerId: winner } : {})
    }))
    if (saved && finishedNow) {
      await applyRoomTrophies(null, saved.room, saved.progress)
    }

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json(fullRoom)
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed', error: error.message })
  }
}

async function handleListChallenges(req: VercelRequest, res: VercelResponse) {
  const { type } = req.query
  try {
    let query = supabaseAdmin.from('challenges').select('id, keyword, category, level, type, options, correctText, verses');
    if (type === 'COMPLETION') query = query.eq('type', 'COMPLETION');
    else if (type === 'SURAH') query = query.eq('type', 'SURAH');
    else if (type === 'STANDARD' || !type) query = query.in('type', ['STANDARD', 'AUDIO', '']);

    const { data: challenges, error } = await query.order('keyword', { ascending: true });
    if (error) {
      console.error('Error fetching challenges:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(mapChallenges(challenges || []))
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

async function handleCheckActive(req: VercelRequest, res: VercelResponse) {
  const { playerId } = req.query
  if (!playerId) return res.status(400).json({ error: 'Player ID required' })

  try {
    const player = await findPlayer(playerId)
    if (!player) return res.status(404).json({ error: 'Player not found' })

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    // 1. Check if user is host or participant of an active WAITING room (< 10 mins old)
    const { data: waitingRooms } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('status', 'WAITING')
      .gte('createdAt', tenMinutesAgo)
      .order('createdAt', { ascending: false })
      .limit(10);

    const pIdStr = String(player.id);
    const activeWaitingRoom = (waitingRooms || []).find(r => {
      if (r.player1Id === player.id) return true;
      const participants = Array.isArray(r.participants) ? r.participants : [];
      return participants.some((p: any) =>
        String(p.id) === pIdStr ||
        p.name === player.name ||
        (p.username && player.username && p.username.toLowerCase() === player.username.toLowerCase())
      );
    });

    if (activeWaitingRoom) {
      const fullRoom = await getFullRoom(activeWaitingRoom.id);
      return res.status(200).json(fullRoom);
    }

    // 2. Check if user is participant or host of an ongoing PLAYING room (< 2 hours old)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: rooms } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('status', 'PLAYING')
      .gte('createdAt', twoHoursAgo)
      .order('createdAt', { ascending: false })
      .limit(25);

    const activeRoom = (rooms || []).find(r => {
      const progress = (r.playersProgress as any) || {};
      const pData = progress[pIdStr];

      // إذا كان اللاعب قد انسحب (hasLeft أو isResigned) أو أنهى التحدي في هذه الغرفة، يتم استبعادها فوراً
      if (pData && (pData.hasLeft || pData.isResigned || pData.isAbandoned || pData.status === 'abandoned' || pData.finishTime)) {
        return false;
      }

      if (r.player1Id === player.id) {
        return true;
      }

      const participants = Array.isArray(r.participants) ? r.participants : [];
      const inParticipants = participants.some((p: any) =>
        String(p.id) === pIdStr ||
        p.name === player.name ||
        (p.username && player.username && p.username.toLowerCase() === player.username.toLowerCase())
      );
      if (inParticipants) {
        return true;
      }

      if (pData) {
        return !pData.finishTime && !pData.hasLeft && !pData.isResigned;
      }
      return false;
    });

    if (activeRoom) {
      const fullRoom = await getFullRoom(activeRoom.id);
      return res.status(200).json(fullRoom);
    }

    // 3. Fallback: check room_participants table for active rooms
    // Separate parameterized .eq() lookups instead of a string-built .or() containing the player name
    const participantRecords = await selectByAnyEq(
      supabaseAdmin,
      'room_participants',
      'room_id',
      [['user_id', player.id], ['name', player.name]],
      5,
      'room_id'
    );

    if (participantRecords && participantRecords.length > 0) {
      for (const rec of participantRecords) {
        if (!rec.room_id) continue;
        const { data: r } = await supabaseAdmin.from('rooms').select('*').eq('id', rec.room_id).maybeSingle();
        if (r && (r.status === 'PLAYING' || r.status === 'WAITING')) {
          const progress = (r.playersProgress as any) || {};
          const pData = progress[pIdStr];
          if (!pData || (!pData.hasLeft && !pData.isResigned && !pData.finishTime)) {
            const fullRoom = await getFullRoom(r.id);
            return res.status(200).json(fullRoom);
          }
        }
      }
    }

    return res.status(200).json(null);
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

async function handlePresence(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId, isOnline } = req.body
  if (!roomId || !playerId) return res.status(400).json({ message: 'Missing roomId or playerId' })

  try {
    const player = await findPlayer(playerId)
    if (!player) return res.status(404).json({ message: 'Player not found' })

    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', String(roomId)).maybeSingle()
    if (!room) return res.status(404).json({ message: 'Room not found' })

    const pIdStr = String(player.id)
    const onlineStatus = isOnline !== false
    // Safe read-modify-write: never erases other keys written meanwhile (__rematch, answers...).
    await updatePlayersProgress(room.id, (playersProgress) => {
      if (!playersProgress[pIdStr]) {
        playersProgress[pIdStr] = { name: player.name }
      }
      // awaySince (server clock): when the player became away; the absent-player wait counts from it.
      if (!onlineStatus && playersProgress[pIdStr].isOnline !== false) playersProgress[pIdStr].awaySince = Date.now()
      if (onlineStatus) delete playersProgress[pIdStr].awaySince
      playersProgress[pIdStr].isOnline = onlineStatus
      playersProgress[pIdStr].lastSeen = Date.now()
    })

    // Note: Do NOT cancel WAITING rooms if the host goes offline!
    // Rooms are only cancelled when the host explicitly clicks "إلغاء الغرفة"
    // or when the 10-minute TTL expires while in WAITING status.
    // Temporary window blur / tab switches / app pauses do NOT advance or forfeit the round.
    // Progression is strictly governed by all active participants answering OR timer expiration.

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json(fullRoom)
  } catch (err: any) {
    console.error('Error in handlePresence:', err)
    return res.status(500).json({ message: 'Failed to update presence', error: err.message })
  }
}

async function handleCancelRoom(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId } = req.body
  if (!roomId || !playerId) return res.status(400).json({ message: 'Missing roomId or playerId' })

  try {
    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', String(roomId)).maybeSingle()
    // Idempotent: a room that no longer exists is already "cancelled".
    if (!room) return res.status(200).json({ success: true, alreadyGone: true })

    const player = await findPlayer(playerId)
    if (!player) return res.status(404).json({ message: 'Player not found' })

    // Security check: Only the host can cancel the room
    if (player.id !== room.player1Id) {
      return res.status(403).json({ message: 'غير مصرح لك بإلغاء الغرفة. المضيف فقط يمكنه الإلغاء.' })
    }

    await supabaseAdmin.from('rooms').update({ status: 'CANCELLED' }).eq('id', room.id)

    // Clean up "Who am I" data of this room (was done from the browser before). Best effort.
    await Promise.allSettled([
      supabaseAdmin.from('who_am_i_submissions').delete().eq('room_id', String(room.id)),
      supabaseAdmin.from('who_am_i_answers').delete().eq('room_id', String(room.id)),
      supabaseAdmin.from('who_am_i_rounds').delete().eq('room_id', String(room.id)),
    ])

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json(fullRoom)
  } catch (err: any) {
    console.error('Error in handleCancelRoom:', err)
    return res.status(500).json({ message: 'Failed to cancel room', error: err.message })
  }
}

async function handleResign(req: VercelRequest, res: VercelResponse) {
  const { roomId, id, playerId, playerUsername, playerName } = req.body || {}
  const targetRoomId = String(roomId || id || '').trim()
  const targetPlayerId = playerId || playerUsername || playerName || req.headers['x-player-id']
  if (!targetRoomId || !targetPlayerId) {
    return res.status(400).json({ error: 'Room ID and Player ID required' })
  }

  try {
    const player = await findPlayer(targetPlayerId, playerName)
    if (!player) return res.status(404).json({ error: 'Player not found' })

    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', targetRoomId).maybeSingle()
    if (!room) return res.status(404).json({ error: 'Room not found' })

    // If room is already FINISHED or CANCELLED, return current state
    if (room.status === 'FINISHED' || room.status === 'CANCELLED') {
      const fullRoom = await getFullRoom(room.id)
      return res.status(200).json(fullRoom)
    }

    let playersProgress = (room.playersProgress as any) || {}
    const isHost = player.id === room.player1Id

    // -------------------------------------------------------------------------
    // 1. قبل بدء التحدي (status === 'WAITING'):
    // إذا انسحب المالك، يتم نقل القيادة (Host Migration) لأول متسابق متبقٍ
    // وتظل الغرفة في حالة WAITING لتستمر قاعة الانتظار بدون توقف.
    // إذا لم يتبق أي متسابق آخر في الغرفة، يتم إلغاؤها.
    // -------------------------------------------------------------------------
    if (room.status === 'WAITING') {
      // حذف اللاعب المنسحب من مصفوفة التقدم والمشاركين
      delete playersProgress[String(player.id)]
      delete playersProgress[player.id]

      await supabaseAdmin.from('room_participants').delete().match({ room_id: room.id, user_id: player.id })
      await supabaseAdmin.from('room_participants').delete().match({ room_id: room.id, name: player.name })

      const remainingGuestIds = Object.keys(playersProgress)
        .map(gid => parseInt(gid))
        .filter(gid => !isNaN(gid) && gid !== player.id)

      if (isHost) {
        if (remainingGuestIds.length === 0) {
          await supabaseAdmin.from('rooms').update({ status: 'CANCELLED' }).eq('id', room.id)
          const fullRoom = await getFullRoom(room.id)
          return res.status(200).json(fullRoom)
        }

        // تدوير القيادة (Host Migration): نقل قيادة الغرفة إلى اللاعب التالي
        const newHostId = remainingGuestIds[0]
        const newPlayer2Id = remainingGuestIds.length > 1 ? remainingGuestIds[1] : null

        const leaveNotification = {
          type: 'LEAVE',
          action: 'player_left',
          playerId: player.id,
          playerName: player.name,
          timestamp: Date.now()
        }
        playersProgress.__lastReaction = leaveNotification

        await supabaseAdmin.from('rooms').update({
          playersProgress,
          player1Id: newHostId,
          player2Id: newPlayer2Id,
          status: 'WAITING',
          lastReaction: leaveNotification
        }).eq('id', room.id)

        const fullRoom = await getFullRoom(room.id)
        return res.status(200).json(fullRoom)
      } else {
        // إعادة ضبط player2Id إذا كان الضيف هو player2
        let newPlayer2Id = room.player2Id
        if (room.player2Id === player.id) {
          newPlayer2Id = remainingGuestIds.length > 0 ? remainingGuestIds[0] : null
        }

        // إشعار المتواجدين بحدث خروج المتسابق (Socket/Realtime Event)
        const leaveNotification = {
          type: 'LEAVE',
          action: 'player_left',
          playerId: player.id,
          playerName: player.name,
          timestamp: Date.now()
        }
        playersProgress.__lastReaction = leaveNotification

        // الحفاظ على حالة الغرفة كـ WAITING حصراً وعدم إنهائها أبداً
        await supabaseAdmin.from('rooms').update({
          playersProgress,
          player2Id: newPlayer2Id,
          status: 'WAITING',
          lastReaction: leaveNotification
        }).eq('id', room.id)

        const fullRoom = await getFullRoom(room.id)
        return res.status(200).json(fullRoom)
      }
    }

    // -------------------------------------------------------------------------
    // 2. أثناء التحدي (status === 'PLAYING'):
    // إذا انسحب أي لاعب، يُحوّل إلى abandoned (منسحب) ولا يُنهى التحدي للبقية.
    // قانون الحرمان الصارم من الجوائز (Zero Reward Policy):
    // 0 كؤوس و 0 نقاط واستبعاد تام من الترتيب، ومنع ثغرة تجميع النقاط والهروب.
    // التحدي ينتهي فقط عندما ينهي اللاعبون المتبقون جميع الأسئلة.
    // -------------------------------------------------------------------------
    const abandonTime = Date.now()
    playersProgress[player.id] = {
      ...(playersProgress[player.id] || {}),
      name: player.name,
      isAbandoned: true,
      status: 'abandoned',
      isResigned: true,
      hasLeft: true,
      isOnline: false,
      isDisqualified: true,
      finishTime: abandonTime,
      score: 0,
      finalTotalScore: 0,
      basePoints: 0,
      speedBonusCount: 0,
      accuracyBonus: 0,
      completionBonus: 0,
      trophiesAwarded: 0
    }

    // إشعار المتواجدين بانسحاب اللاعب أثناء اللعب
    const abandonNotification = {
      type: 'ABANDON',
      action: 'player_abandoned',
      playerId: player.id,
      playerName: player.name,
      timestamp: abandonTime
    }
    playersProgress.__lastReaction = abandonNotification

    // حذف السجل من جدول room_participants
    await supabaseAdmin.from('room_participants').delete().match({ room_id: room.id, user_id: player.id })
    await supabaseAdmin.from('room_participants').delete().match({ room_id: room.id, name: player.name })

    // فحص اللاعبين النشطين المتبقين (الذين لم ينسحبوا)
    const remainingActivePlayers = roomPlayerEntries(playersProgress).filter(([id, p]: [string, any]) => {
      if (id === String(player.id)) return false
      const isPlayerAbandoned = Boolean(
        p?.isAbandoned ||
        p?.status === 'abandoned' ||
        p?.isResigned ||
        p?.hasLeft
      )
      return !isPlayerAbandoned
    })

    const updateData: any = {
      playersProgress,
      lastReaction: abandonNotification
    }

    // التحدي ينتهي فقط إذا لم يتبق أي لاعب نشط
    if (remainingActivePlayers.length === 0) {
      updateData.status = 'FINISHED'
      const finalized = calculateResults(room, playersProgress)
      updateData.playersProgress = finalized.updatedProgress
      updateData.winnerId = finalized.winnerId
    } else {
      // لا ننهي التحدي للبقية أبداً ويستمر اللعب
      updateData.status = 'PLAYING'

      // تدوير القيادة (Host Migration): إذا كان المنسحب هو المضيف، نقل القيادة لأول لاعب نشط متبقٍ
      if (isHost && remainingActivePlayers.length > 0) {
        const firstActiveId = parseInt(remainingActivePlayers[0][0])
        if (!isNaN(firstActiveId)) {
          updateData.player1Id = firstActiveId
        }
      }

      // في وضع التزامن SYNC: إذا كان باقي اللاعبين النشطين قد أجابوا بالفعل على السؤال الحالي،
      // ننتقل فوراً للسؤال التالي دون تركهم معلقين بانتظار المنسحب
      if ((room as any).transitionMode !== 'ASYNC') {
        const curQ = room.currentQuestionIndex || 0
        const totalQ = room.questionCount || 5
        const isLastQuestion = curQ >= totalQ - 1
        const curAnswers: Record<string, any> = (room.currentAnswers as any) || {}

        const allRemainingAnswered = remainingActivePlayers.length > 0 && remainingActivePlayers.every(([id]) => {
          const a = curAnswers[id]
          return a && (a.questionIndex === undefined || a.questionIndex === curQ)
        })

        if (allRemainingAnswered) {
          await supabaseAdmin.from('rooms').update(updateData).eq('id', room.id)
          const { data: freshRoom } = await supabaseAdmin.from('rooms').select('*').eq('id', room.id).maybeSingle()
          if (freshRoom && freshRoom.status === 'PLAYING') {
            await advanceRoomToNextQuestionTx(null, freshRoom, curAnswers)
          }
          const fullRoom = await getFullRoom(room.id)
          return res.status(200).json(fullRoom)
        }
      }
    }

    await supabaseAdmin.from('rooms').update(updateData).eq('id', room.id)

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json(fullRoom)
  } catch (err: any) {
    console.error('Error in handleResign:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function handleKickPlayer(req: VercelRequest, res: VercelResponse) {
  const { roomId, hostId, targetPlayerId, targetPlayerName } = req.body || {}
  const targetRoomId = String(roomId || '').trim()
  const targetHostId = hostId || req.headers['x-player-id'] || req.headers['x-player-username']

  if (!targetRoomId || !targetHostId || (!targetPlayerId && !targetPlayerName)) {
    return res.status(400).json({ error: 'Room ID, host ID, and target player ID required' })
  }

  try {
    // Load room first so we can verify host by player1Id directly
    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', targetRoomId).maybeSingle()
    if (!room) return res.status(404).json({ error: 'Room not found' })

    // Resolve host player (supports numeric id, username, name, uniquePlayerId)
    const host = await findPlayer(targetHostId)
    if (!host) {
      console.warn('[Kick] Host not found for hostId:', targetHostId)
      return res.status(404).json({ error: 'Host not found' })
    }

    // Security check: Only room creator / host can kick players
    // Use loose string comparison to handle type mismatches (number vs string from JSON)
    if (String(host.id) !== String(room.player1Id)) {
      console.warn('[Kick] Host mismatch — host.id:', host.id, 'room.player1Id:', room.player1Id)
      return res.status(403).json({ error: 'فقط منشئ الغرفة يمتلك صلاحية طرد اللاعبين' })
    }

    // Resolve target player
    const targetPlayer = await findPlayer(targetPlayerId, targetPlayerName)
    if (!targetPlayer) {
      console.warn('[Kick] Target player not found — targetPlayerId:', targetPlayerId, 'targetPlayerName:', targetPlayerName)
      return res.status(404).json({ error: 'Target player not found' })
    }

    // Cannot kick the host
    if (String(targetPlayer.id) === String(room.player1Id)) {
      return res.status(400).json({ error: 'لا يمكن طرد منشئ الغرفة' })
    }

    let playersProgress = (room.playersProgress as any) || {}

    // 1. Remove kicked player from active progress entries
    delete playersProgress[String(targetPlayer.id)]
    delete playersProgress[targetPlayer.id]
    if (targetPlayer.name) delete playersProgress[targetPlayer.name]

    // 2. Add all identifiers to __kicked ban-list so they can never rejoin
    const kickedList: string[] = Array.isArray(playersProgress.__kicked) ? playersProgress.__kicked : []
    const newIdentifiers: string[] = [
      String(targetPlayer.id),
      String(targetPlayer.name || '').trim().toLowerCase(),
      targetPlayer.username ? String(targetPlayer.username).trim().toLowerCase().replace(/^@+/, '') : null,
      targetPlayer.uniquePlayerId ? String(targetPlayer.uniquePlayerId).toUpperCase() : null
    ].filter(Boolean) as string[]
    playersProgress.__kicked = Array.from(new Set([...kickedList, ...newIdentifiers]))

    // 3. Reassign player2Id if the kicked player was occupying that slot
    let newPlayer2Id = room.player2Id
    if (room.player2Id != null && String(room.player2Id) === String(targetPlayer.id)) {
      const remainingGuestIds = Object.keys(playersProgress)
        .map(gid => parseInt(gid))
        .filter(gid => !isNaN(gid) && String(gid) !== String(room.player1Id))
      newPlayer2Id = remainingGuestIds.length > 0 ? remainingGuestIds[0] : null
    }

    const kickEventPayload = {
      type: 'KICK',
      action: 'player_kicked',
      event: 'player_kicked',
      roomId: room.id,
      playerId: targetPlayer.id,
      targetPlayerId: targetPlayer.id,
      playerName: targetPlayer.name,
      playerUsername: targetPlayer.username,
      timestamp: Date.now()
    }
    playersProgress.__lastReaction = kickEventPayload

    // 4. Persist updated room state
    const { error: updateError } = await supabaseAdmin
      .from('rooms')
      .update({ playersProgress, player2Id: newPlayer2Id, lastReaction: kickEventPayload })
      .eq('id', room.id)

    if (updateError) {
      console.error('[Kick] Failed to update room:', updateError.message)
      return res.status(500).json({ error: 'فشل تحديث بيانات الغرفة', message: updateError.message })
    }

    // 5a. Clean up auxiliary tables — errors here are non-fatal
    await Promise.allSettled([
      supabaseAdmin.from('room_participants').delete().eq('room_id', room.id).eq('user_id', String(targetPlayer.id)),
      supabaseAdmin.from('room_participants').delete().eq('room_id', room.id).eq('player_id', String(targetPlayer.id)),
    ]).catch(e => console.warn('[Kick] Cleanup room_participants error:', e))

    // 5b. Invalidate any pending room-invite notifications for the kicked player
    try {
      const { error: nErr } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', targetPlayer.id)
        .like('data', `%"roomId":"${room.id}"%`)
      if (nErr) console.warn('[Kick] Notification cleanup error:', nErr.message)
    } catch (e) {
      console.warn('[Kick] Notification cleanup catch:', e)
    }

    // 5c. Broadcast kick event over all relevant Realtime channels
    const broadcastKick = async () => {
      const channels = [
        `room_sync_${room.id}`,
        `room_sync_app_${room.id}`
      ]
      const targetIdent = (targetPlayer.username || targetPlayer.name || '').toLowerCase().replace(/^@+/, '')
      if (targetIdent) channels.push(`player-invites:${targetIdent}`)

      await Promise.allSettled(
        channels.map(ch =>
          supabaseAdmin.channel(ch).send({
            type: 'broadcast',
            event: 'player_kicked',
            payload: kickEventPayload
          })
        )
      )
    }
    broadcastKick().catch(e => console.warn('[Kick] Broadcast error:', e))

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json({ success: true, message: 'تم طرد اللاعب بنجاح', room: fullRoom })

  } catch (error: any) {
    console.error('[Kick] Unhandled error in handleKickPlayer:', error)
    return res.status(500).json({ error: 'فشل طرد اللاعب', message: error?.message || String(error) })
  }
}

async function handleUpdateRoomSettings(req: VercelRequest, res: VercelResponse) {
  const { roomId, updatePayload } = req.body || {}
  if (!roomId || !updatePayload) {
    return res.status(400).json({ error: 'Missing roomId or updatePayload' })
  }

  try {
    let { error: updateErr } = await supabaseAdmin
      .from('rooms')
      .update(updatePayload)
      .eq('id', roomId);

    if (updateErr && (updateErr.message.includes('selected_') || updateErr.message.includes('room_settings'))) {
      const safePayload = { ...updatePayload };
      delete safePayload.selected_juz;
      delete safePayload.selected_surahs;
      delete safePayload.scopeMode;
      delete safePayload.room_settings;
      delete safePayload.roomSettings;
      const retry = await supabaseAdmin.from('rooms').update(safePayload).eq('id', roomId);
      updateErr = retry.error;
    }

    if (updateErr) {
      console.error('Failed to update room settings in supabaseAdmin:', updateErr)
      return res.status(500).json({ error: updateErr.message })
    }

    const fullRoom = await getFullRoom(roomId)
    return res.status(200).json({ success: true, room: fullRoom })
  } catch (err: any) {
    console.error('Error in handleUpdateRoomSettings:', err)
    return res.status(500).json({ error: err?.message || String(err) })
  }
}

async function handleReaction(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId, playerName, emoji, type, textLine1, textLine2 } = req.body || {}
  if (!roomId || (!emoji && !type)) {
    return res.status(400).json({ error: 'Missing roomId or reaction payload' })
  }

  try {
    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', String(roomId)).maybeSingle()
    if (!room) return res.status(404).json({ error: 'Room not found' })

    const reactionData = {
      senderId: String(playerId || ''),
      senderName: String(playerName || 'متسابق'),
      emoji: emoji ? String(emoji) : '',
      type: type ? String(type) : 'emoji',
      textLine1: textLine1 ? String(textLine1) : '',
      textLine2: textLine2 ? String(textLine2) : '',
      timestamp: Date.now()
    }

    // Safe read-modify-write: never erases other keys written meanwhile (__rematch, answers...).
    await updatePlayersProgress(room.id, (playersProgress) => {
      playersProgress.__lastReaction = reactionData
    })

    return res.status(200).json({ success: true, reaction: reactionData })
  } catch (err: any) {
    console.error('Reaction error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// In-memory cache for Do Not Disturb cooldowns: `${senderId}_${receiverId}` => expiry timestamp
const dndCooldowns: Map<string, number> = new Map()

export function setDndCooldown(senderId: string | number, receiverId: string | number, durationSeconds: number = 300) {
  const cleanSender = String(senderId || '').trim().toLowerCase()
  const cleanReceiver = String(receiverId || '').trim().toLowerCase()
  if (!cleanSender || !cleanReceiver) return
  const key = `${cleanSender}_${cleanReceiver}`
  dndCooldowns.set(key, Date.now() + durationSeconds * 1000)
}

export function isDndActive(senderId: string | number, receiverId: string | number): { active: boolean; remainingSeconds: number } {
  const cleanSender = String(senderId || '').trim().toLowerCase()
  const cleanReceiver = String(receiverId || '').trim().toLowerCase()
  const key = `${cleanSender}_${cleanReceiver}`
  const expiry = dndCooldowns.get(key)
  if (!expiry) return { active: false, remainingSeconds: 0 }
  const diff = expiry - Date.now()
  if (diff <= 0) {
    dndCooldowns.delete(key)
    return { active: false, remainingSeconds: 0 }
  }
  return { active: true, remainingSeconds: Math.ceil(diff / 1000) }
}

async function handleDndCooldown(req: VercelRequest, res: VercelResponse) {
  const { senderId, receiverId, durationSeconds = 300 } = req.body || req.query || {}
  if (!senderId || !receiverId) {
    return res.status(400).json({ message: 'Missing senderId or receiverId' })
  }

  const senderPlayer = await findPlayer(senderId).catch(() => null)
  const receiverPlayer = await findPlayer(receiverId).catch(() => null)

  const senderKeys = [
    String(senderId),
    senderPlayer?.id ? String(senderPlayer.id) : null,
    senderPlayer?.username ? senderPlayer.username.toLowerCase().replace(/^@+/, '') : null,
    senderPlayer?.uniquePlayerId ? senderPlayer.uniquePlayerId.toUpperCase() : null
  ].filter(Boolean) as string[]

  const receiverKeys = [
    String(receiverId),
    receiverPlayer?.id ? String(receiverPlayer.id) : null,
    receiverPlayer?.username ? receiverPlayer.username.toLowerCase().replace(/^@+/, '') : null,
    receiverPlayer?.uniquePlayerId ? receiverPlayer.uniquePlayerId.toUpperCase() : null
  ].filter(Boolean) as string[]

  const expiry = Date.now() + Number(durationSeconds) * 1000
  for (const s of senderKeys) {
    for (const r of receiverKeys) {
      dndCooldowns.set(`${s.toLowerCase()}_${r.toLowerCase()}`, expiry)
    }
  }

  return res.status(200).json({ success: true, message: 'DND cooldown recorded' })
}

async function handleSendInviteAPI(req: VercelRequest, res: VercelResponse) {
  const { senderId, receiverId, friendId, targetId, roomId } = req.body || req.query || {}
  const targetReceiver = receiverId || friendId || targetId
  if (!senderId || !targetReceiver) {
    return res.status(400).json({ message: 'Missing senderId or receiverId' })
  }

  const senderPlayer = await findPlayer(senderId).catch(() => null)
  const receiverPlayer = await findPlayer(targetReceiver).catch(() => null)

  const senderKeys = [
    String(senderId),
    senderPlayer?.id ? String(senderPlayer.id) : null,
    senderPlayer?.username ? senderPlayer.username.toLowerCase().replace(/^@+/, '') : null,
    senderPlayer?.uniquePlayerId ? senderPlayer.uniquePlayerId.toUpperCase() : null
  ].filter(Boolean) as string[]

  const receiverKeys = [
    String(targetReceiver),
    receiverPlayer?.id ? String(receiverPlayer.id) : null,
    receiverPlayer?.username ? receiverPlayer.username.toLowerCase().replace(/^@+/, '') : null,
    receiverPlayer?.uniquePlayerId ? receiverPlayer.uniquePlayerId.toUpperCase() : null
  ].filter(Boolean) as string[]

  for (const s of senderKeys) {
    for (const r of receiverKeys) {
      const key = `${s.toLowerCase()}_${r.toLowerCase()}`
      const expiry = dndCooldowns.get(key)
      if (expiry) {
        const remaining = Math.ceil((expiry - Date.now()) / 1000)
        if (remaining > 0) {
          return res.status(429).json({
            message: 'اللاعب مفعّل لوضع عدم الإزعاج حالياً، لا يمكن إرسال دعوة له.',
            cooldownRemaining: remaining,
            doNotDisturb: true
          })
        } else {
          dndCooldowns.delete(key)
        }
      }
    }
  }

  // If a roomId is provided and the sender is the room host, pardon the receiver
  // from any previous kick ban so the new invite takes effect immediately.
  if (roomId && senderPlayer?.id && receiverPlayer?.id) {
    try {
      const { data: room } = await supabaseAdmin.from('rooms').select('id, player1Id, playersProgress').eq('id', String(roomId)).maybeSingle()
      if (room && String(room.player1Id) === String(senderPlayer.id)) {
        const prog: any = (room.playersProgress as any) || {}
        const kickedList: string[] = Array.isArray(prog.__kicked) ? prog.__kicked : []

        // Build all identifiers for the invited (receiver) player
        const receiverIdentifiers = [
          String(receiverPlayer.id),
          String(receiverPlayer.name || '').trim().toLowerCase(),
          receiverPlayer.username ? String(receiverPlayer.username).trim().toLowerCase().replace(/^@+/, '') : null,
          receiverPlayer.uniquePlayerId ? String(receiverPlayer.uniquePlayerId).toUpperCase() : null
        ].filter(Boolean) as string[]

        const wasKicked = receiverIdentifiers.some(ident => kickedList.includes(ident))
        if (wasKicked) {
          // Host is re-inviting a previously kicked player → pardon them
          await updatePlayersProgress(room.id, (progress) => {
            const list: string[] = Array.isArray(progress.__kicked) ? progress.__kicked : []
            progress.__kicked = list.filter(k => !receiverIdentifiers.includes(k))
          })
          console.log(`[Invite] Pardoned kicked player ${receiverPlayer.id} from room ${room.id} via host re-invite`)
        }
      }
    } catch (e) {
      // Non-fatal: pardon attempt failure should not block the invite
      console.warn('[Invite] Could not pardon kicked player:', e)
    }
  }

  return res.status(200).json({ success: true, message: 'Invite allowed' })
}

async function handleRematch(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId, playerName } = req.body;
  if (!roomId) {
    return res.status(400).json({ message: 'Missing roomId' });
  }

  try {
    const { data: room, error: fetchErr } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', roomId as string)
      .maybeSingle();

    if (fetchErr || !room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    let player = await findPlayer(playerId, playerName);
    if (!player && playerName) {
      const { data: newP } = await supabaseAdmin
        .from('players')
        .insert({ name: playerName })
        .select()
        .single();
      player = newP;
    }

    if (!player) {
      return res.status(400).json({ message: 'Player not found' });
    }

    const userInfo = {
      id: player.id,
      name: player.name,
      username: player.username || null,
      avatar: (player as any).avatar || null,
      timestamp: Date.now()
    };

    const roomProgress = (room.playersProgress as any) || {};
    let nextRoomId = (room as any).nextRoomId || roomProgress.__rematch?.nextRoomId || null;
    let playAgainUsers: any[] = Array.isArray((room as any).playAgainUsers)
      ? (room as any).playAgainUsers
      : (Array.isArray(roomProgress.__rematch?.playAgainUsers) ? roomProgress.__rematch.playAgainUsers : []);

    // ─────────────────────────────────────────────────────────────────
    // CASE A: Next Room Already Exists (Join Next Room)
    // A play-again room that is gone (everyone left: CANCELLED, or EXPIRED / already played) is
    // replaced by a new one below instead of sending everyone to a dead room.
    // ─────────────────────────────────────────────────────────────────
    let deadNextRoomId: string | null = null;
    if (nextRoomId) {
      const { data: nextRow } = await supabaseAdmin.from('rooms').select('id, status').eq('id', nextRoomId).maybeSingle();
      if (!nextRow) {
        // Claimed but not inserted yet: the winner is creating it right now. Wait for it.
        return await joinWinnerRematchRoom(room.id, player, userInfo, res);
      }
      if (nextRow.status === 'WAITING') {
        return await joinExistingRematchRoom(nextRoomId, room, player, userInfo, res);
      }
      deadNextRoomId = String(nextRoomId);
      playAgainUsers = [];
    }

    // ─────────────────────────────────────────────────────────────────
    // CASE B: First Player Clicks — Create Brand New Rematch Room
    // ─────────────────────────────────────────────────────────────────
    // The new round has exactly the types and counts of the round that just finished (the host's
    // choice). The old code queried the challenges table by gameMode: for a mixed room ('MIXED')
    // there was no type filter at all, and with no match it fell back to any challenges, mostly
    // audio (STANDARD).
    const selectedIds = await buildRematchQuestions(room);
    if (selectedIds.length === 0) {
      return res.status(409).json({ success: false, message: 'تعذّر تجهيز أسئلة الجولة الجديدة، يرجى إنشاء غرفة جديدة' });
    }

    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let isUnique = false;
    while (!isUnique) {
      code = '';
      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      const { data: existing } = await supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('code', code)
        .maybeSingle();
      if (!existing) isUnique = true;
    }

    const baseName = (room.name || 'غرفة التحدي').replace(/\s*\(جولة.*?\)/, '').trim();
    const originalHostId = rematchOriginalHostId(room);

    // Claim the finished room FIRST (atomic: the update only matches while nobody else has set
    // __rematch, or while it still points to the dead room we replace), with the new room's id
    // chosen here. Only the winner creates a room; everyone else joins it. (The old code created
    // a room per press and deleted the losers' rooms afterwards; when that delete failed (its
    // error was never checked, supabase-js does not throw) the losers' rooms stayed as orphans.)
    const newRoomId = randomUUID();
    playAgainUsers = [userInfo];
    const claimedProgress = {
      ...roomProgress,
      __rematch: { nextRoomId: newRoomId, playAgainUsers, originalHostId },
      __v: randomUUID() // writers that read before this claim must re-read (updatePlayersProgress)
    };
    let claim = supabaseAdmin.from('rooms').update({ playersProgress: claimedProgress }).eq('id', room.id);
    claim = deadNextRoomId
      ? claim.eq('playersProgress->__rematch->>nextRoomId', deadNextRoomId)
      : claim.is('playersProgress->__rematch', null);
    const { data: claimed } = await claim.select('id');
    if (!Array.isArray(claimed) || claimed.length === 0) {
      return await joinWinnerRematchRoom(room.id, player, userInfo, res);
    }

    const newRoomInsert: any = {
      id: newRoomId,
      code,
      name: `${baseName} (جولة جديدة)`,
      isPrivate: Boolean(room.isPrivate),
      password: room.password || null,
      player1Id: player.id,
      challengeIds: selectedIds,
      status: 'WAITING',
      surahFilters: room.surahFilters || [],
      categoryFilter: room.categoryFilter || "",
      questionCount: selectedIds.length,
      maxPlayers: 999,
      gameMode: room.gameMode || "STANDARD",
      transitionMode: room.transitionMode || "SYNC",
      timePerQuestion: Number(room.timePerQuestion || 0),
      playersProgress: {
        [String(player.id)]: {
          progress: 0,
          name: player.name,
          joinedAt: Date.now(),
          isOnline: true,
          status: 'joined'
        }
      }
    };

    const { data: newRoom, error: createError } = await supabaseAdmin
      .from('rooms')
      .insert(newRoomInsert)
      .select()
      .single();

    if (createError || !newRoom) {
      console.error('Failed to create rematch room:', createError);
      // Give the claim back (only if it is still ours) so the next press can try again.
      const { __rematch: _ours, ...withoutClaim } = claimedProgress as any;
      const restored = roomProgress.__rematch ? { ...withoutClaim, __rematch: roomProgress.__rematch } : withoutClaim;
      await supabaseAdmin.from('rooms').update({ playersProgress: restored })
        .eq('id', room.id).eq('playersProgress->__rematch->>nextRoomId', newRoomId);
      return res.status(500).json({ message: 'Failed to create rematch room', error: createError?.message });
    }

    try {
      supabaseAdmin.channel(`room_sync_${room.id}`).send({
        type: 'broadcast',
        event: 'rematch_created',
        payload: {
          roomId: room.id,
          nextRoomId: newRoom.id,
          playAgainUsers,
          creator: userInfo
        }
      }).catch(() => {});
    } catch (_) {}

    const fullNewRoom = await getFullRoom(newRoom.id);
    return res.status(200).json({
      success: true,
      isCreator: true,
      nextRoomId: newRoom.id,
      room: fullNewRoom,
      playAgainUsers
    });
  } catch (err: any) {
    console.error('Error in handleRematch:', err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
}

/** A play-again room this old with nobody really in it is an orphan. */
export const ORPHAN_REMATCH_AGE_MS = 60_000

/**
 * Orphan play-again rooms among `waitingRooms`. Deliberately narrow, so no real room is touched:
 *  - a play-again room (named "... (جولة جديدة)"), still WAITING, older than ORPHAN_REMATCH_AGE_MS;
 *  - and nobody is really in it: no players, or every player listed in it is also a player of
 *    another WAITING / PLAYING room with MORE players (they went to the room everyone joined).
 *    Two one-player rooms of the same player are both kept (we cannot tell which one is real).
 * A host waiting alone in their own play-again room is NOT an orphan (they are in no other room).
 */
export async function findOrphanRematchRooms(waitingRooms: any[], now: number = Date.now()): Promise<Set<string>> {
  const candidates = (waitingRooms || []).filter((r: any) =>
    r && r.status === 'WAITING' &&
    /\(جولة جديدة\)\s*$/.test(String(r.name || '')) &&
    r.createdAt && now - new Date(r.createdAt).getTime() > ORPHAN_REMATCH_AGE_MS)
  const orphans = new Set<string>()
  if (candidates.length === 0) return orphans

  const activePlayers = (r: any) => roomPlayerEntries(r.playersProgress)
    .filter(([, p]: [string, any]) => !p.hasLeft && !p.isResigned && !p.isAbandoned && p.status !== 'abandoned')
    .map(([id]) => id)

  const since = new Date(now - 30 * 60 * 1000).toISOString()
  const { data: active } = await supabaseAdmin
    .from('rooms')
    .select('id, status, playersProgress')
    .in('status', ['WAITING', 'PLAYING'])
    .gte('createdAt', since)
    .limit(500)
  for (const r of candidates) {
    const ids = activePlayers(r)
    const inBiggerRoom = (pid: string) => (active || []).some((o: any) => {
      if (String(o.id) === String(r.id)) return false
      const others = activePlayers(o)
      return others.includes(pid) && others.length > ids.length
    })
    if (ids.every(inBiggerRoom)) orphans.add(String(r.id))
  }
  return orphans
}

/**
 * Read-modify-write of rooms.playersProgress that never erases another writer's change (for example
 * __rematch, the play-again link): compare-and-set on playersProgress.__v (metadata), re-read and
 * re-apply on conflict. `mutate` changes the fresh copy (return false to write nothing); `extra`
 * adds other columns to the same update. Returns the written progress, or null.
 */
export async function updatePlayersProgress(
  roomId: string,
  mutate: (progress: any, room: any) => void | false,
  extra?: (room: any, progress: any) => Record<string, any>
): Promise<{ room: any; progress: any } | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', String(roomId)).maybeSingle()
    if (!room) return null
    const current = (room.playersProgress as any) || {}
    const version = current.__v ?? null
    const next = JSON.parse(JSON.stringify(current))
    if (mutate(next, room) === false) return { room, progress: current }
    next.__v = randomUUID()
    let write = supabaseAdmin.from('rooms').update({ ...(extra ? extra(room, next) : {}), playersProgress: next }).eq('id', room.id)
    write = version === null ? write.is('playersProgress->__v', null) : write.eq('playersProgress->>__v', version)
    const { data: written } = await write.select('id')
    if (Array.isArray(written) && written.length > 0) return { room: { ...room, playersProgress: next }, progress: next }
    await new Promise((r) => setTimeout(r, 10 + Math.floor(Math.random() * 40)))
  }
  return null
}

/** Question type family: the types a room's question can be shown as. */
export function questionTypeFamily(q: any): string {
  const t = String(q?.type ?? '').toUpperCase()
  if (t === 'STANDARD' || t === 'AUDIO' || t === '') return 'AUDIO'
  return t
}

const shuffled = <T,>(list: T[]): T[] => [...list].sort(() => Math.random() - 0.5)

/**
 * Questions for a "play again" round: the same types and the same count per type as the room's
 * previous round, never another type. Fresh questions of the same type come from the challenges
 * table where that is safe (audio; "complete the verse" / "surah name" only when the room has no
 * juz/surah scope, which the server cannot apply); the rest are the previous round's questions of
 * that type, reshuffled. Returns question objects (getFullRoom serves them as they are).
 */
export async function buildRematchQuestions(room: any): Promise<any[]> {
  // The previous round's questions (objects as the app built them, or ids of the challenges table).
  let previous: any[] = Array.isArray(room?.challengeIds) ? room.challengeIds : []
  if (previous.length > 0 && typeof previous[0] !== 'object') {
    const { data } = await supabaseAdmin.from('challenges').select('*').in('id', previous as any[])
    const byId = new Map((data || []).map((c: any) => [String(c.id), c]))
    previous = previous.map((id: any) => byId.get(String(id))).filter(Boolean)
  }
  previous = previous.filter((q: any) => q && typeof q === 'object')
  if (previous.length === 0) return []

  const filters: any = room?.surahFilters && typeof room.surahFilters === 'object' && !Array.isArray(room.surahFilters) ? room.surahFilters : {}
  const scopeActive = (Array.isArray(filters.selected_surahs) && filters.selected_surahs.length > 0) ||
    (Array.isArray(filters.selected_juz) && filters.selected_juz.length > 0 && filters.selected_juz.length < 30)
  const freshTypes: Record<string, string[]> = { AUDIO: ['STANDARD', 'AUDIO'] }
  if (!scopeActive) {
    freshTypes.COMPLETION = ['COMPLETION']
    freshTypes.SURAH = ['SURAH']
  }

  const groups = new Map<string, any[]>()
  for (const q of previous) {
    const family = questionTypeFamily(q)
    if (!groups.has(family)) groups.set(family, [])
    groups.get(family)!.push(q)
  }

  const usedIds = new Set(previous.map((q: any) => String(q.id)))
  const result: any[] = []
  for (const [family, list] of groups) {
    const count = list.length
    let fresh: any[] = []
    if (freshTypes[family]) {
      const { data } = await supabaseAdmin.from('challenges').select('*').in('type', freshTypes[family])
      fresh = shuffled((data || []).filter((c: any) => questionTypeFamily(c) === family && !usedIds.has(String(c.id)))).slice(0, count)
    }
    fresh.forEach((c: any) => usedIds.add(String(c.id)))
    result.push(...fresh, ...shuffled(list).slice(0, count - fresh.length))
  }
  return shuffled(result)
}

/** How long a player who lost the claim waits for the winner's room to appear. */
export const REMATCH_WAIT = { tries: 12, delayMs: 250 }

/**
 * Someone else claimed the finished room: join their play-again room, waiting briefly while it is
 * being created. Never creates a room.
 */
async function joinWinnerRematchRoom(oldRoomId: string, player: any, userInfo: any, res: VercelResponse) {
  for (let attempt = 0; attempt < REMATCH_WAIT.tries; attempt++) {
    const { data: oldRow } = await supabaseAdmin.from('rooms').select('*').eq('id', oldRoomId).maybeSingle()
    const winnerId = (oldRow?.playersProgress as any)?.__rematch?.nextRoomId
    if (winnerId) {
      const { data: winnerRoom } = await supabaseAdmin.from('rooms').select('id, status').eq('id', winnerId).maybeSingle()
      if (winnerRoom) {
        if (winnerRoom.status !== 'WAITING') {
          return res.status(409).json({ success: false, message: 'بدأت الجولة الجديدة بالفعل' })
        }
        return await joinExistingRematchRoom(winnerId, oldRow, player, userInfo, res)
      }
    }
    await new Promise((r) => setTimeout(r, REMATCH_WAIT.delayMs))
  }
  return res.status(409).json({ success: false, message: 'حاول مرة أخرى' })
}

async function joinExistingRematchRoom(
  targetNextRoomId: string,
  oldRoom: any,
  player: any,
  userInfo: any,
  res: VercelResponse
) {
  const { data: existingNextRoom } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .eq('id', targetNextRoomId)
    .maybeSingle();

  if (!existingNextRoom || existingNextRoom.status === 'CANCELLED') {
    return res.status(404).json({ success: false, message: 'غرفة إعادة اللعب غير متاحة' });
  }

  const roomProgress = (oldRoom.playersProgress as any) || {};
  let playAgainUsers: any[] = Array.isArray((oldRoom as any).playAgainUsers)
    ? (oldRoom as any).playAgainUsers
    : (Array.isArray(roomProgress.__rematch?.playAgainUsers) ? roomProgress.__rematch.playAgainUsers : []);

  const alreadyInList = playAgainUsers.some(
    (u: any) => String(u.id) === String(player.id) || u.name === player.name
  );
  if (!alreadyInList) {
    playAgainUsers.push(userInfo);
    // Safe read-modify-write on the finished room: add this player to the list, keep the link.
    const saved = await updatePlayersProgress(oldRoom.id, (progress) => {
      const info = progress.__rematch || {}
      if (info.nextRoomId && String(info.nextRoomId) !== String(targetNextRoomId)) return false
      const list: any[] = Array.isArray(info.playAgainUsers) ? info.playAgainUsers : []
      if (list.some((u: any) => String(u.id) === String(player.id))) return false
      progress.__rematch = { ...info, nextRoomId: targetNextRoomId, playAgainUsers: [...list, userInfo], originalHostId: info.originalHostId ?? rematchOriginalHostId(oldRoom) }
    });
    if (saved?.progress?.__rematch?.playAgainUsers) playAgainUsers = saved.progress.__rematch.playAgainUsers;

    try {
      supabaseAdmin.channel(`room_sync_${oldRoom.id}`).send({
        type: 'broadcast',
        event: 'play_again_updated',
        payload: {
          roomId: oldRoom.id,
          nextRoomId: targetNextRoomId,
          playAgainUsers,
          player: userInfo
        }
      }).catch(() => {});
    } catch (_) {}
  }

  // Add the player with a compare-and-set on playersProgress.__v (a version stamp; metadata,
  // never a player): players joining at the same moment would otherwise each write the whole
  // playersProgress and drop one another. A write that lost the race matches no row: re-read, retry.
  let joinedNow = false;
  let current: any = existingNextRoom;
  for (let attempt = 0; attempt < 8; attempt++) {
    const prog = { ...((current?.playersProgress as any) || {}) };
    if (prog[player.id]) break;
    const version = prog.__v ?? null;
    prog[player.id] = {
      progress: 0,
      name: player.name,
      joinedAt: Date.now(),
      status: 'joined',
      isOnline: true
    };
    prog.__v = randomUUID();
    let write = supabaseAdmin.from('rooms').update({
      playersProgress: prog,
      player2Id: current.player2Id || (current.player1Id !== player.id ? player.id : current.player2Id)
    }).eq('id', existingNextRoom.id);
    write = version === null ? write.is('playersProgress->__v', null) : write.eq('playersProgress->>__v', version);
    const { data: written } = await write.select('id');
    if (Array.isArray(written) && written.length > 0) {
      joinedNow = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 20 + Math.floor(Math.random() * 60)));
    const { data: reread } = await supabaseAdmin.from('rooms').select('*').eq('id', existingNextRoom.id).maybeSingle();
    current = reread || current;
  }
  if (joinedNow) {
    try {
      supabaseAdmin.channel(`room_sync_${existingNextRoom.id}`).send({
        type: 'broadcast',
        event: 'player_joined',
        payload: {
          playerId: player.id,
          playerName: player.name,
          playerUsername: player.username || null,
          roomId: existingNextRoom.id
        }
      }).catch(() => {});
    } catch (_) {}
  }

  // The finished room's leader is back: they lead the play-again room again.
  await restoreRematchHost(existingNextRoom, player, rematchOriginalHostId(oldRoom));

  const fullNextRoom = await getFullRoom(existingNextRoom.id);
  return res.status(200).json({
    success: true,
    isCreator: false,
    nextRoomId: existingNextRoom.id,
    room: fullNextRoom,
    playAgainUsers
  });
}

async function handlePurchasePowerup(req: VercelRequest, res: VercelResponse) {
  const { playerId, playerName, playerUsername, powerupType, roomId } = req.body;

  if (!powerupType || (powerupType !== 'freeze' && powerupType !== 'fiftyFifty')) {
    return res.status(400).json({ success: false, message: 'نوع وسيلة المساعدة غير صالح' });
  }

  // Authoritative server-side pricing
  const cost = powerupType === 'freeze' ? 30 : 50;

  try {
    const player = await findPlayer(playerId || playerUsername, playerName);
    if (!player) {
      return res.status(404).json({ success: false, message: 'اللاعب غير مسجل (Player not found)' });
    }

    const currentPoints = Number(player.points) || 0;
    if (currentPoints < cost) {
      return res.status(400).json({
        success: false,
        message: `نقاطك غير كافية لإتمام الشراء! رصيدك الحالي ${currentPoints} نقطة وتكلفة الأداة ${cost} نقطة`,
        currentPoints,
        cost
      });
    }

    const remainingPoints = Math.max(0, currentPoints - cost);

    // 1. Immediate DB update to players table
    const { data: updatedPlayer, error: updateErr } = await supabaseAdmin
      .from('players')
      .update({ points: remainingPoints })
      .eq('id', player.id)
      .select('id, name, points, cups')
      .single();

    if (updateErr) {
      console.error('[PurchasePowerup] DB update error:', updateErr);
      return res.status(500).json({
        success: false,
        message: 'فشل خصم النقاط من قاعدة البيانات',
        error: updateErr.message
      });
    }

    // 2. If roomId provided, record spentPoints in room progress
    if (roomId) {
      try {
        const { data: room } = await supabaseAdmin
          .from('rooms')
          .select('id, playersProgress')
          .eq('id', roomId)
          .maybeSingle();

        if (room && room.playersProgress) {
          // Safe read-modify-write: never erases other keys written meanwhile.
          await updatePlayersProgress(room.id, (progress) => {
            const pProg = progress[player.id] || progress[String(player.id)] || {};
            pProg.spentPoints = (pProg.spentPoints || 0) + cost;
            progress[player.id] = pProg;
          });
        }
      } catch (rErr) {
        console.warn('[PurchasePowerup] Room spentPoints update warning:', rErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'تم خصم النقاط بنجاح من قاعدة البيانات',
      powerupType,
      cost,
      remainingPoints,
      player: updatedPlayer || toSafePlayer({ ...player, points: remainingPoints })
    });
  } catch (err: any) {
    console.error('Error in handlePurchasePowerup:', err);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم أثناء الشراء',
      error: err.message
    });
  }
}
