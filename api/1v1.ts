import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.method === 'GET' ? req.query.action : req.body.action

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
    case 'reaction': return handleReaction(req, res)
    case 'dnd-cooldown': return handleDndCooldown(req, res)
    case 'invite':
    case 'send-invite':
    case 'check-invite':
      return handleSendInviteAPI(req, res)
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

async function findPlayer(idOrUsernameOrName: any, nameFallback?: string) {
  if (!idOrUsernameOrName && !nameFallback) return null;
  const str = String(idOrUsernameOrName || '').trim();
  const cleanU = str.replace(/^@+/, '');
  const numId = Number(idOrUsernameOrName);

  const orConditions: string[] = [];
  if (Number.isInteger(numId) && numId > 0) {
    orConditions.push(`id.eq.${numId}`);
  }
  if (str) {
    orConditions.push(`uniquePlayerId.eq.${str.toUpperCase()}`);
    orConditions.push(`name.ilike.${str}`);
  }
  if (cleanU) {
    orConditions.push(`username.ilike.${cleanU}`);
  }
  if (nameFallback && nameFallback.trim()) {
    orConditions.push(`name.ilike.${nameFallback.trim()}`);
  }

  if (orConditions.length === 0) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('players')
      .select('*')
      .or(orConditions.join(','))
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[findPlayer] Supabase query error:', error.message);
      return null;
    }
    return data;
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
    challenges: mapChallenges(orderedChallenges)
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
      let player1 = await findPlayer(player1Id, player1Name)
      
      // Auto-register if not found
      if (!player1 && player1Name) {
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

        if (matchErr || !allMatching || allMatching.length === 0) {
          return res.status(400).json({ 
            message: 'لا توجد تحديات متوفرة تطابق هذا التصنيف أو النمط. يرجى اختيار تصنيف آخر.' 
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

      const { data: roomData, error: createError } = await supabaseAdmin
        .from('rooms')
        .insert({
          code,
          name: finalRoomName,
          isPrivate: finalIsPrivate,
          password: finalPassword,
          player1Id: player1.id,
          challengeIds: selectedIds,
          status: 'WAITING',
          surahFilters: categories_config || (Array.isArray(categories) ? categories : []),
          categoryFilter: category || (Array.isArray(categories_config) ? categories_config.map((c: any) => c.category).join('، ') : ""),
          questionCount: finalQuestionCount,
          maxPlayers: 999,
          gameMode: gameMode || "STANDARD",
          transitionMode: finalTransitionMode,
          timePerQuestion: (timePerQuestion !== undefined && !isNaN(Number(timePerQuestion))) ? Number(timePerQuestion) : 0,
          playersProgress: { [String(player1.id)]: { progress: 0, name: player1.name, joinedAt: Date.now() } }
        })
        .select()
        .single();

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

      let player = await findPlayer(effectivePlayerId, effectivePlayerName)
      
      // Auto-register player if not in database yet
      if (!player) {
        const defaultName = (effectivePlayerName && String(effectivePlayerName).trim()) || 'متسابق جديد'
        const { data: newP } = await supabaseAdmin.from('players').insert({ name: defaultName }).select().single()
        player = newP
      } else if (effectivePlayerName && String(effectivePlayerName).trim() && player.name !== String(effectivePlayerName).trim()) {
        const { data: updatedP } = await supabaseAdmin.from('players').update({ name: String(effectivePlayerName).trim() }).eq('id', player.id).select().single()
        player = updatedP || player
      }

      const isHost = player.id === room.player1Id

      // 1. Check if the player has been kicked from this room:
      let playersProgress = (room.playersProgress as any) || {}
      const kickedList: string[] = Array.isArray(playersProgress.__kicked) ? playersProgress.__kicked : []
      const myIdentifiers = [
        String(player.id),
        String(player.name || '').trim().toLowerCase(),
        player.username ? String(player.username).trim().toLowerCase().replace(/^@+/, '') : null,
        player.uniquePlayerId ? String(player.uniquePlayerId).toUpperCase() : null
      ].filter(Boolean) as string[]

      const isKicked = myIdentifiers.some(ident => kickedList.includes(ident))
      if (isKicked) {
        return res.status(403).json({ message: 'تم إخراجك من هذه الغرفة من قِبل المنشئ ولا يمكنك الانضمام إليها مجدداً' })
      }

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

      // Check if the player is invited to this room:
      const isInvited = Boolean(
        isInvite ||
        (invitedUserId && (
          String(invitedUserId) === String(player.id) ||
          String(invitedUserId).toLowerCase() === String(player.username || '').toLowerCase().replace(/^@+/, '') ||
          String(invitedUserId).toUpperCase() === String(player.uniquePlayerId || '').toUpperCase() ||
          String(invitedUserId).toLowerCase() === String(player.name || '').toLowerCase()
        ))
      )

      // Private Room Password Verification (Host, Invited players, or Friends bypass password verification)
      if (room.isPrivate && !isHost && !isInvited && !isFriendWithHost) {
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

      const hostIds = Array.from(new Set((rooms || []).map(r => r.player1Id).filter(Boolean)));
      let hostMap = new Map<number, any>();
      if (hostIds.length > 0) {
        const { data: hosts } = await supabaseAdmin
          .from('players')
          .select('id, name, username')
          .in('id', hostIds);
        (hosts || []).forEach(h => hostMap.set(h.id, h));
      }

      const formattedRooms = (rooms || []).map(r => {
        const progress = (r.playersProgress as any) || {}
        const participantCount = Object.keys(progress).length || 1
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
          complete: completeRes.count || 0,
          surah: surahRes.count || 0
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
    if (pIdStr === '__lastReaction' || !pData || typeof pData !== 'object') continue

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

    const completedAllQuestions = !isAbandoned && (answersCount >= totalQuestions || pData.progress === 100)

    if (isAbandoned || !completedAllQuestions) {
      // Disqualified from rankings: 0 cups and 0 points
      pData.isDisqualified = true
      pData.isAbandoned = true
      pData.status = isAbandoned ? 'abandoned' : 'incomplete'
      pData.score = 0
      pData.finalTotalScore = 0
      pData.basePoints = 0
      pData.speedBonusCount = 0
      pData.accuracyBonus = 0
      pData.completionBonus = 0
      pData.trophiesAwarded = 0
      continue
    }

    const correctCount = typeof pData.correctCount === 'number' ? pData.correctCount : 0
    const speedBonusCount = typeof pData.speedBonusCount === 'number' ? pData.speedBonusCount : 0
    const basePoints = correctCount * 1 // Strictly 1 point per correct answer
    const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) : 0
    const accuracyBonus = accuracy > 0.90 ? 15 : 0 // Bonus +15 for >90% accuracy

    pData.basePoints = basePoints
    pData.speedBonusCount = speedBonusCount
    pData.accuracyBonus = accuracyBonus
    pData.accuracy = Math.round(accuracy * 100)
    pData.completionBonus = 0
  }

  // 2. Award Conditional Early Completion Bonus (+10 pts)
  // Strictly to the first qualified (non-disqualified) finisher with accuracy > 70%
  const finishers = Object.entries(updatedProgress)
    .filter(([pIdStr, p]) => pIdStr !== '__lastReaction' && !p.isDisqualified && !p.isAbandoned && p.finishTime && typeof p.finishTime === 'number')
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
    if (pIdStr === '__lastReaction' || !pData || typeof pData !== 'object') continue
    if (pData.isDisqualified || pData.isAbandoned) {
      pData.score = 0
      pData.finalTotalScore = 0
      pData.trophiesAwarded = 0
      continue
    }
    // Unified score: score strictly represents the actual correct answers (1 point per correct answer, no multiplier)
    const basePts = typeof pData.basePoints === 'number' ? pData.basePoints : (typeof pData.correctCount === 'number' ? pData.correctCount : 0)
    pData.score = basePts
    pData.finalTotalScore = basePts + (pData.speedBonusCount || 0) + (pData.accuracyBonus || 0) + (pData.completionBonus || 0)
  }

  // 4. Determine winner by highest final total score among qualified players only!
  const ranked = Object.entries(updatedProgress)
    .filter(([pIdStr, p]) => pIdStr !== '__lastReaction' && !p.isDisqualified && !p.isAbandoned && p.status !== 'abandoned')
    .map(([id, p]: [string, any]) => ({
      id: parseInt(id),
      score: p.finalTotalScore || 0,
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
    if (pIdStr === '__lastReaction' || !pData || typeof pData !== 'object') continue
    if (pData.isDisqualified || pData.isAbandoned || pData.status === 'abandoned') {
      pData.trophiesAwarded = 0
      pData.score = 0
      pData.finalTotalScore = 0
    }
  }

  return { updatedProgress, winnerId }
}

const finalizeRoomScores = calculateResults

async function applyRoomTrophies(_tx: any, room: any, progress: Record<string, any>) {
  const totalQuestions = room.questionCount || room.totalQuestions || 1
  const ranked = Object.entries(progress)
    .filter(([id, p]: [string, any]) => {
      if (id === '__lastReaction' || !p || typeof p !== 'object') return false
      const isAbandoned = Boolean(
        p.status === 'abandoned' ||
        p.isAbandoned === true ||
        p.isResigned === true ||
        p.hasLeft === true ||
        p.isDisqualified === true
      )
      if (isAbandoned) return false
      const answersCount = typeof p.answersCount === 'number'
        ? p.answersCount
        : (Array.isArray(p.roundHistory) ? p.roundHistory.length : (p.progress === 100 ? totalQuestions : 0))
      return answersCount >= totalQuestions || p.progress === 100
    })
    .map(([id, p]: [string, any]) => ({
      id: parseInt(id),
      score: p.finalTotalScore || p.score || 0,
      finishTime: p.finishTime || Infinity
    }))
    .filter(p => !isNaN(p.id) && p.id > 0)
    .sort((a, b) => b.score - a.score || a.finishTime - b.finishTime)

  // Exclusive group room cups distribution: 1st (4), 2nd (3), 3rd (2), 4th (1), 5th+ (0)
  // Awarded exclusively to qualified finishers who completed all questions
  const rewards = [4, 3, 2, 1]
  for (let i = 0; i < Math.min(4, ranked.length); i++) {
    const targetId = ranked[i].id
    const cups = rewards[i]
    try {
      const { data: p } = await supabaseAdmin.from('players').select('cups').eq('id', targetId).maybeSingle();
      if (p) {
        await supabaseAdmin.from('players').update({ cups: (p.cups || 0) + cups }).eq('id', targetId);
      }
    } catch (e) {
      console.error(`Failed to award ${cups} trophies to player ${targetId}:`, e)
    }
  }
}

function evaluateQuestionScores(
  playersProgress: Record<string, any>,
  currentAnswers: Record<string, { playerId: number; name: string; isCorrect: boolean; timestamp: number }>,
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
    const numId = parseInt(pIdStr)
    const ans = currentAnswers[pIdStr]

    if (typeof pData.score !== 'number') pData.score = 0
    if (typeof pData.correctCount !== 'number') pData.correctCount = 0
    if (typeof pData.speedBonusCount !== 'number') pData.speedBonusCount = 0
    if (typeof pData.basePoints !== 'number') pData.basePoints = 0
    if (!Array.isArray(pData.roundHistory)) pData.roundHistory = []
    pData.answersCount = (pData.answersCount || 0) + 1

    let roundPoints = 0
    let earnedSpeedBonus = false

    if (ans && ans.isCorrect) {
      roundPoints = 1 // نقطة واحدة فقط لكل إجابة صحيحة
      pData.correctCount += 1
      pData.basePoints += 1

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
  for (const [pIdStr, pData] of Object.entries(playersProgress)) {
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
      if (finalProgress[pIdStr]) {
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
    status: isFinished ? 'FINISHED' : 'PLAYING',
    winnerId
  }).eq('id', room.id).select().single()

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

    let playersProgress: any = (room.playersProgress as any) || {}
    let needUpdate = false

    // Update polling player's presence heartbeat
    if (playerId) {
      const pIdStr = String(playerId)
      if (playersProgress[pIdStr]) {
        playersProgress[pIdStr].isOnline = true
        playersProgress[pIdStr].lastSeen = Date.now()
        needUpdate = true
      }
    }

    // In SYNC mode: Check if timer expired on server side OR all online players answered
    if (room.status === 'PLAYING' && (room as any).transitionMode !== 'ASYNC') {
      const curQ = room.currentQuestionIndex || 0
      const curAnswers: Record<string, any> = (room.currentAnswers as any) || {}
      const validAnswers = Object.entries(curAnswers).filter(([_, a]: [string, any]) => {
        return a && (a.questionIndex === undefined || a.questionIndex === curQ)
      })

      const onlinePlayers = Object.entries(playersProgress).filter(([_, p]: [string, any]) => {
        return p && p.isOnline !== false
      })

      const isTimerExpired = room.timePerQuestion > 0 && room.questionStartTime &&
        ((Date.now() - Number(room.questionStartTime)) / 1000 >= (room.timePerQuestion + 1.5))

      const allOnlineAnswered = onlinePlayers.length > 0 && validAnswers.length >= onlinePlayers.length
      const totalQ = room.questionCount || 5
      const isLastQuestion = curQ >= totalQ - 1

      if (!isLastQuestion && (isTimerExpired || allOnlineAnswered)) {
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

    if (needUpdate) {
      await supabaseAdmin.from('rooms').update({ playersProgress }).eq('id', room.id)
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
  const { roomId, playerId, questionIndex, isCorrect, timestamp } = req.body
  if (!roomId || !playerId || questionIndex === undefined) {
    return res.status(400).json({ message: 'Missing fields' })
  }

  try {
    const player = await findPlayer(playerId)
    if (!player) return res.status(404).json({ message: 'Player not found' })

    const pIdStr = String(player.id)
    const subTime = Number(timestamp) || Date.now()

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
        playersProgress[pIdStr] = { name: player.name, score: 0, correctCount: 0, speedBonusCount: 0 }
      }
      const pData = playersProgress[pIdStr]

      if (!currentAnswers[qKey][pIdStr]) {
        currentAnswers[qKey][pIdStr] = {
          playerId: player.id,
          name: player.name,
          isCorrect: Boolean(isCorrect),
          timestamp: subTime,
          questionIndex: Number(questionIndex)
        }

        if (Boolean(isCorrect)) {
          pData.correctCount = (pData.correctCount || 0) + 1
          pData.basePoints = (pData.correctCount || 0) * 1

          // Track firstCorrectUserId per question on server
          if (!currentAnswers[qKey]._firstCorrectUserId) {
            currentAnswers[qKey]._firstCorrectUserId = player.id;
            pData.speedBonusCount = (pData.speedBonusCount || 0) + 1;
          }
        } else {
          pData.basePoints = (pData.correctCount || 0) * 1
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

      const totalParticipants = Object.keys(playersProgress).filter(k => k !== '__lastReaction').length
      const allFinished = totalParticipants > 0 &&
        Object.values(playersProgress).every((p: any) => p && (p.finishTime || p.isAbandoned || p.status === 'abandoned' || p.isResigned))

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
      // Only accept answers for the active question
      if (Number(questionIndex) !== room.currentQuestionIndex) {
        const fullRoom = await getFullRoom(roomId as string)
        return res.status(200).json(fullRoom)
      }

      const currentAnswers: Record<string, any> = (room.currentAnswers as any) || {}
      if (!currentAnswers[pIdStr]) {
        currentAnswers[pIdStr] = {
          playerId: player.id,
          name: player.name,
          isCorrect: Boolean(isCorrect),
          timestamp: subTime,
          questionIndex: Number(questionIndex)
        }

        if (Boolean(isCorrect) && !currentAnswers._firstCorrectUserId) {
          currentAnswers._firstCorrectUserId = player.id;
        }
      }

      const playersProgress = (room.playersProgress as any) || {}
      if (!playersProgress[pIdStr]) {
        playersProgress[pIdStr] = { name: player.name }
      }
      playersProgress[pIdStr].isOnline = true
      playersProgress[pIdStr].lastSeen = Date.now()

      await supabaseAdmin.from('rooms').update({
        currentAnswers,
        playersProgress
      }).eq('id', room.id)
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

    // Host validation
    if (playerId) {
      const player = await findPlayer(playerId)
      if (player && player.id !== room.player1Id) {
        console.warn(`Non-host player ${playerId} attempted to advance question`)
        const fullRoom = await getFullRoom(roomId as string)
        return res.status(200).json(fullRoom)
      }
    }

    // Guard against race conditions / double advancement:
    if (Number(questionIndex) !== room.currentQuestionIndex) {
      const fullRoom = await getFullRoom(roomId as string)
      return res.status(200).json(fullRoom)
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

    // Host validation
    if (playerId) {
      const player = await findPlayer(playerId)
      if (player && player.id !== room.player1Id) {
        console.warn(`Non-host player ${playerId} attempted to end room`)
        return res.status(403).json({ message: 'Only host can end the room' })
      }
    }

    const currentAnswers = (room.currentAnswers as any) || {}
    const playersProgress = (room.playersProgress as any) || {}
    const now = Date.now()

    // Ensure all players have an answer entry for the final question
    const completeAnswers: Record<string, any> = { ...currentAnswers }
    for (const [pIdStr, pData] of Object.entries(playersProgress)) {
      if (pIdStr === '__lastReaction') continue
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
      if (pIdStr === '__lastReaction') continue
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

    let playersProgress = room.playersProgress as any || {}
    if (!playersProgress[player.id]) playersProgress[player.id] = { name: player.name }
    
    playersProgress[player.id].progress = progress
    if (typeof score === 'number') {
      playersProgress[player.id].score = score
    }
    
    const updateData: any = { playersProgress }
    
    if (isFinished) {
      const finishTime = Date.now()
      playersProgress[player.id].finishTime = playersProgress[player.id].finishTime || finishTime
      playersProgress[player.id].progress = 100
      playersProgress[player.id].answersCount = room.questionCount || 5

      const allFinished = Object.entries(playersProgress)
        .filter(([k]) => k !== '__lastReaction')
        .every(([_, p]: [string, any]) => p && (p.finishTime || p.isAbandoned || p.status === 'abandoned' || p.isResigned))
      const { updatedProgress, winnerId } = calculateResults(room, playersProgress)
      updateData.playersProgress = updatedProgress

      if (allFinished) {
        updateData.status = 'FINISHED'
        await applyRoomTrophies(null, room, updatedProgress)
      }
      if (winnerId) {
        updateData.winnerId = winnerId
      }
    }

    await supabaseAdmin.from('rooms').update(updateData).eq('id', room.id)

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

    // 1. Check if user is the host of an active WAITING room (< 10 mins old)
    const { data: hostWaitingRoom } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('player1Id', player.id)
      .eq('status', 'WAITING')
      .gte('createdAt', tenMinutesAgo)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hostWaitingRoom) {
      const fullRoom = await getFullRoom(hostWaitingRoom.id)
      return res.status(200).json(fullRoom)
    }

    // 2. Check if user is participant or host of an ongoing PLAYING room (< 2 hours old)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: rooms } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('status', 'PLAYING')
      .gte('createdAt', twoHoursAgo)
      .order('createdAt', { ascending: false })
      .limit(20);

    const pIdStr = String(player.id)
    const activeRoom = (rooms || []).find(r => {
      const progress = (r.playersProgress as any) || {}
      const pData = progress[pIdStr]

      // إذا كان اللاعب قد انسحب (hasLeft أو isResigned) أو أنهى التحدي في هذه الغرفة، يتم استبعادها فوراً
      if (pData && (pData.hasLeft || pData.isResigned || pData.finishTime)) {
        return false
      }

      if (r.player1Id === player.id) {
        return true
      }

      if (pData) {
        return !pData.finishTime && !pData.hasLeft && !pData.isResigned
      }
      return false
    })

    if (!activeRoom) return res.status(200).json(null)

    const fullRoom = await getFullRoom(activeRoom.id)
    return res.status(200).json(fullRoom)
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
    const playersProgress = (room.playersProgress as any) || {}
    if (!playersProgress[pIdStr]) {
      playersProgress[pIdStr] = { name: player.name }
    }

    const onlineStatus = isOnline !== false
    playersProgress[pIdStr].isOnline = onlineStatus
    playersProgress[pIdStr].lastSeen = Date.now()

    // Note: Do NOT cancel WAITING rooms if the host goes offline!
    // Rooms are only cancelled when the host explicitly clicks "إلغاء الغرفة"
    // or when the 10-minute TTL expires while in WAITING status.

    // Requirement 2 & 4: Disconnection Trigger in SYNC mode
    // When any player disconnects (isOnline === false), immediately check whether all REMAINING
    // online players have already submitted their answers. If so, advance question immediately!
    // This forces timer cancellation and transitions the question without delay.
    if (!onlineStatus && room.status === 'PLAYING' && (room as any).transitionMode !== 'ASYNC') {
      const curQ = room.currentQuestionIndex || 0
      const currentAnswers = (room.currentAnswers as any) || {}

      // Remaining online players (excluding the player who just went offline)
      const remainingOnlinePlayers = Object.entries(playersProgress).filter(([id, p]: [string, any]) => {
        return id !== pIdStr && p && p.isOnline !== false
      })

      // Check if all remaining online players have answered current question
      const totalQ = room.questionCount || 5
      const isLastQuestion = curQ >= totalQ - 1
      const allRemainingAnswered = remainingOnlinePlayers.length > 0 && remainingOnlinePlayers.every(([id]) => {
        const a = currentAnswers[id]
        return a && (a.questionIndex === undefined || a.questionIndex === curQ)
      })

      if (!isLastQuestion && allRemainingAnswered) {
        const { data: freshRoom } = await supabaseAdmin.from('rooms').select('*').eq('id', room.id).maybeSingle()
        if (freshRoom && freshRoom.status === 'PLAYING' && freshRoom.currentQuestionIndex === curQ) {
          const freshProgress = (freshRoom.playersProgress as any) || {}
          if (freshProgress[pIdStr]) {
            freshProgress[pIdStr].isOnline = false
            freshProgress[pIdStr].lastSeen = Date.now()
          }
          await advanceRoomToNextQuestionTx(null, { ...freshRoom, playersProgress: freshProgress }, (freshRoom.currentAnswers as any) || {})
        }
        const fullRoom = await getFullRoom(room.id)
        return res.status(200).json(fullRoom)
      }
    }

    await supabaseAdmin.from('rooms').update({ playersProgress }).eq('id', room.id)

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
    const player = await findPlayer(playerId)
    if (!player) return res.status(404).json({ message: 'Player not found' })

    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', String(roomId)).maybeSingle()
    if (!room) return res.status(404).json({ message: 'Room not found' })

    // Security check: Only the host can cancel the room
    if (player.id !== room.player1Id) {
      return res.status(403).json({ message: 'غير مصرح لك بإلغاء الغرفة. المضيف فقط يمكنه الإلغاء.' })
    }

    await supabaseAdmin.from('rooms').update({ status: 'CANCELLED' }).eq('id', room.id)

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
    // إذا انسحب المالك، تُلغى الغرفة.
    // إذا انسحب ضيف (ليس المالك)، يُحذف فقط من الغرفة والمشاركين،
    // ويُبلّغ المتواجدون، وتظل الغرفة في حالة WAITING دون إنهائها أبداً.
    // -------------------------------------------------------------------------
    if (room.status === 'WAITING') {
      if (isHost) {
        await supabaseAdmin.from('rooms').update({ status: 'CANCELLED' }).eq('id', room.id)
        const fullRoom = await getFullRoom(room.id)
        return res.status(200).json(fullRoom)
      } else {
        // حذف الضيف المنسحب من مصفوفة التقدم والمشاركين
        delete playersProgress[String(player.id)]
        delete playersProgress[player.id]

        // إعادة ضبط player2Id إذا كان الضيف هو player2
        let newPlayer2Id = room.player2Id
        if (room.player2Id === player.id) {
          const remainingGuestIds = Object.keys(playersProgress)
            .map(gid => parseInt(gid))
            .filter(gid => !isNaN(gid) && gid !== room.player1Id)
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

    // فحص اللاعبين النشطين المتبقين (الذين لم ينسحبوا)
    const remainingActivePlayers = Object.entries(playersProgress).filter(([id, p]: [string, any]) => {
      if (id === '__lastReaction' || id === String(player.id)) return false
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

        if (!isLastQuestion && allRemainingAnswered) {
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
    const host = await findPlayer(targetHostId)
    if (!host) return res.status(404).json({ error: 'Host not found' })

    const { data: room } = await supabaseAdmin.from('rooms').select('*').eq('id', targetRoomId).maybeSingle()
    if (!room) return res.status(404).json({ error: 'Room not found' })

    // Security check: Only room creator / host can kick players
    if (host.id !== room.player1Id) {
      return res.status(403).json({ error: 'فقط منشئ الغرفة يمتلك صلاحية طرد اللاعبين' })
    }

    const targetPlayer = await findPlayer(targetPlayerId, targetPlayerName)
    if (!targetPlayer) return res.status(404).json({ error: 'Target player not found' })

    if (targetPlayer.id === room.player1Id) {
      return res.status(400).json({ error: 'لا يمكن طرد منشئ الغرفة' })
    }

    let playersProgress = (room.playersProgress as any) || {}

    // 1. Remove from active participants & progress
    delete playersProgress[String(targetPlayer.id)]
    delete playersProgress[targetPlayer.id]
    delete playersProgress[targetPlayer.name]

    // 2. Add to banned/kicked list so they can never rejoin
    const kickedList: string[] = Array.isArray(playersProgress.__kicked) ? playersProgress.__kicked : []
    const newIdentifiers = [
      String(targetPlayer.id),
      String(targetPlayer.name || '').trim().toLowerCase(),
      targetPlayer.username ? String(targetPlayer.username).trim().toLowerCase().replace(/^@+/, '') : null,
      targetPlayer.uniquePlayerId ? String(targetPlayer.uniquePlayerId).toUpperCase() : null
    ].filter(Boolean) as string[]

    playersProgress.__kicked = Array.from(new Set([...kickedList, ...newIdentifiers]))

    // 3. Reset player2Id if the kicked player was player2
    let newPlayer2Id = room.player2Id
    if (room.player2Id === targetPlayer.id) {
      const remainingGuestIds = Object.keys(playersProgress)
        .map(gid => parseInt(gid))
        .filter(gid => !isNaN(gid) && gid !== room.player1Id)
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

    // 4. Update room in DB
    await supabaseAdmin.from('rooms').update({
      playersProgress,
      player2Id: newPlayer2Id,
      lastReaction: kickEventPayload
    }).eq('id', room.id)

    // 5. Clean up in Supabase:
    // a) Remove from room_participants table
    try {
      await Promise.allSettled([
        supabaseAdmin.from('room_participants').delete().match({ room_id: room.id, user_id: String(targetPlayer.id) }),
        supabaseAdmin.from('room_participants').delete().match({ room_id: room.id, user_id: targetPlayer.name }),
        supabaseAdmin.from('room_participants').delete().match({ room_id: room.id, name: targetPlayer.name }),
        supabaseAdmin.from('who_am_i_submissions').delete().match({ room_id: room.id, user_id: String(targetPlayer.id) }),
        supabaseAdmin.from('who_am_i_answers').delete().match({ room_id: room.id, user_id: String(targetPlayer.id) })
      ])
    } catch (e) {
      console.warn('[Kick] Error cleaning room_participants:', e)
    }

    // b) Invalidate invitation in notifications table
    try {
      await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', targetPlayer.id)
        .like('data', `%"roomId":"${room.id}"%`)
    } catch (e) {
      console.warn('[Kick] Error invalidating notifications:', e)
    }

    // c) Broadcast Realtime event so client exits immediately
    try {
      await supabaseAdmin.channel(`room_sync_${room.id}`).send({
        type: 'broadcast',
        event: 'player_kicked',
        payload: kickEventPayload
      })
      await supabaseAdmin.channel(`room_sync_app_${room.id}`).send({
        type: 'broadcast',
        event: 'player_kicked',
        payload: kickEventPayload
      })
      const targetIdent = (targetPlayer.username || targetPlayer.name || '').toLowerCase().replace(/^@+/, '')
      if (targetIdent) {
        await supabaseAdmin.channel(`player-invites:${targetIdent}`).send({
          type: 'broadcast',
          event: 'player_kicked',
          payload: kickEventPayload
        })
      }
    } catch (e) {
      console.warn('[Kick] Error broadcasting kick event:', e)
    }

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json({ success: true, message: 'تم طرد اللاعب بنجاح', room: fullRoom })
  } catch (error: any) {
    console.error('Error in handleKickPlayer:', error)
    return res.status(500).json({ error: 'فشل طرد اللاعب', message: error.message })
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

    const playersProgress: any = (room.playersProgress as any) || {}
    playersProgress.__lastReaction = reactionData

    const updateData: any = {
      playersProgress
    }

    await supabaseAdmin.from('rooms').update(updateData).eq('id', String(roomId))

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
  const { senderId, receiverId, friendId, targetId } = req.body || req.query || {}
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

  return res.status(200).json({ success: true, message: 'Invite allowed' })
}
