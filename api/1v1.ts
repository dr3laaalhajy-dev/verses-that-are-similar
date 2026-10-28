import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'

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
    case 'submit-progress': return handleSubmitProgress(req, res)
    case 'list-challenges': return handleListChallenges(req, res)
    case 'check-active': return handleCheckActive(req, res)
    case 'presence': return handlePresence(req, res)
    case 'cancel-room': return handleCancelRoom(req, res)
    case 'resign': return handleResign(req, res)
    case 'reaction': return handleReaction(req, res)
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

  return await prisma.player.findFirst({
    where: {
      OR: [
        ...(cleanU ? [{ username: cleanU }, { username: '@' + cleanU }] : []),
        ...(str ? [{ name: { equals: str, mode: 'insensitive' as const } }] : []),
        ...(nameFallback ? [{ name: { equals: nameFallback.trim(), mode: 'insensitive' as const } }] : []),
        ...(Number.isInteger(numId) && numId > 0 ? [{ id: numId }] : [])
      ] as any
    }
  });
}

async function getFullRoom(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { player1: true, player2: true, winner: true }
  })
  if (!room) return null

  const progress: any = room.playersProgress || {}
  const playerIds = Object.keys(progress).map(id => parseInt(id)).filter(id => !isNaN(id))
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, name: true, username: true, activeFrame: true, seerahCompleted: true, generalCompleted: true }
  })

  let orderedChallenges: any[] = []
  if (Array.isArray(room.challengeIds) && room.challengeIds.length > 0 && typeof room.challengeIds[0] === 'object') {
    orderedChallenges = room.challengeIds as any[]
  } else {
    const challenges = await prisma.challenge.findMany({ 
      where: { id: { in: room.challengeIds as number[] } }
    })
    const challengeMap = new Map(challenges.map(c => [c.id, c]))
    orderedChallenges = (room.challengeIds as number[])
      .map(id => challengeMap.get(id))
      .filter(Boolean)
  }

  const answers: Record<string, any> = (room.currentAnswers as any) || {}
  const curQIndex = room.currentQuestionIndex || 0
  const validAnswers: Record<string, any> = {}
  for (const [k, v] of Object.entries(answers)) {
    if (v && (v.questionIndex === undefined || v.questionIndex === curQIndex)) {
      validAnswers[k] = v
    }
  }

  const playersWithPresence = players.map(p => {
    const pProg = progress[String(p.id)] || {}
    return {
      ...p,
      isOnline: pProg.isOnline !== false,
      lastSeen: pProg.lastSeen || 0,
      score: pProg.score || 0
    }
  })

  const participantsCount = playersWithPresence.length || 1
  const answeredCount = Object.keys(validAnswers).length
  const onlineCount = playersWithPresence.filter(p => p.isOnline).length || 1

  return { 
    ...room, 
    transitionMode: (room as any).transitionMode || 'SYNC',
    currentQuestionIndex: room.currentQuestionIndex || 0,
    questionStartTime: Number(room.questionStartTime) || 0,
    answeredCount,
    onlineParticipantsCount: onlineCount,
    totalParticipants: participantsCount,
    currentAnswers: validAnswers,
    participants: playersWithPresence, 
    challenges: mapChallenges(orderedChallenges) 
  }
}

async function handleCreate(req: VercelRequest, res: VercelResponse) {
    const { player1Id, player1Name, category, categories, level, levels, questionCount, questionIds, maxPlayers, gameMode, gameModes, timePerQuestion, customChallenges, topics, roomName, name, isPrivate, password, transitionMode, transition_mode } = req.body
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
        player1 = await prisma.player.create({
          data: { name: player1Name }
        })
      }

      if (!player1) return res.status(400).json({ message: 'اللاعب غير مسجل (Player not found)' })

    let code = ''
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let isUnique = false
    while (!isUnique) {
      code = ''
      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
      const existing = await prisma.room.findUnique({ where: { code } })
      if (!existing) isUnique = true
    }

    let selectedChallenges: any[] = []
    if (Array.isArray(customChallenges) && customChallenges.length > 0) {
      selectedChallenges = customChallenges
    } else if (Array.isArray(questionIds) && questionIds.length > 0) {
      if (questionIds.length !== maxQuestions) {
        return res.status(400).json({ message: `يجب اختيار ${maxQuestions} أسئلة بالضبط` })
      }
      selectedChallenges = await prisma.challenge.findMany({
        where: { id: { in: questionIds.map(id => Number(id)) } }
      })
      if (selectedChallenges.length !== questionIds.length) {
        return res.status(400).json({ message: 'بعض الأسئلة المختارة غير موجودة' })
      }
    } else {
      let whereClause: any = {}
      
      // Multi-Category Filtering (WHERE category IN (...))
      const cats = Array.isArray(categories) && categories.length > 0 
        ? categories 
        : (category && category !== "" ? [category] : []);
      if (cats.length > 0) {
        whereClause.category = { in: cats };
      }

      // Multi-Level Filtering (WHERE level IN (...))
      const lvls = Array.isArray(levels) && levels.length > 0
        ? levels.map(Number).filter(n => !isNaN(n))
        : (level ? [Number(level)] : []);
      if (lvls.length > 0) {
        whereClause.level = { in: lvls };
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
        whereClause.type = { in: Array.from(new Set(typeConditions)) };
      }

      // In group/room challenges, select randomly from ALL matching challenges
      // so all players get the exact same questions and it's not restricted by player history.
      const allMatching = await prisma.challenge.findMany({
        where: whereClause,
        select: { id: true }
      })

      if (allMatching.length === 0) {
        return res.status(400).json({ 
          message: 'لا توجد تحديات متوفرة تطابق هذا التصنيف أو النمط. يرجى اختيار تصنيف آخر.' 
        })
      }

      const shuffledIds = allMatching.map(c => c.id).sort(() => Math.random() - 0.5)
      const chosenIds = shuffledIds.slice(0, maxQuestions)

      const fetchedChallenges = await prisma.challenge.findMany({
        where: { id: { in: chosenIds } }
      })
      const mapById = new Map(fetchedChallenges.map(c => [c.id, c]))
      selectedChallenges = chosenIds.map(id => mapById.get(id)).filter(Boolean) as any[]
    }

    const selectedIds = (Array.isArray(customChallenges) && customChallenges.length > 0)
      ? customChallenges
      : selectedChallenges.map(c => c.id)
    const finalQuestionCount = selectedChallenges.length

    const roomData = await prisma.room.create({
      data: {
        code,
        name: finalRoomName,
        isPrivate: finalIsPrivate,
        password: finalPassword,
        player1Id: player1.id,
        challengeIds: selectedIds,
        status: 'WAITING',
        categoryFilter: category || "",
        questionCount: finalQuestionCount,
        maxPlayers: 999,
        gameMode: gameMode || "STANDARD",
        transitionMode: finalTransitionMode,
        timePerQuestion: (timePerQuestion !== undefined && !isNaN(Number(timePerQuestion))) ? Number(timePerQuestion) : 0,
        playersProgress: { [String(player1.id)]: { progress: 0, name: player1.name, joinedAt: Date.now() } }
      } as any,
      include: { player1: true }
    })

    const fullRoom = await getFullRoom(roomData.id)
    return res.status(201).json(fullRoom)
  } catch (error: any) {
    console.error('Failed to create room:', error)
    return res.status(500).json({ message: 'Failed to create room', error: error.message, stack: error.stack })
  }
}

async function handleJoin(req: VercelRequest, res: VercelResponse) {
  const { code, roomId, id, player2Id, playerName, password } = req.body
  const targetId = String(roomId || id || '').trim()
  const cleanCode = String(code || '').trim()
  if (!targetId && !cleanCode) return res.status(400).json({ message: 'يرجى تحديد الغرفة' })
  if (!player2Id && !playerName) return res.status(400).json({ message: 'Missing player2Id' })

  try {
    const room = await prisma.room.findFirst({ 
      where: targetId 
        ? { id: targetId } 
        : { code: { equals: cleanCode, mode: 'insensitive' } }, 
      include: { player1: true } 
    })
    
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة أو تم إغلاقها' })
    
    // Status can be WAITING or PLAYING (allow late join if within maxPlayers)
    if (room.status === 'FINISHED') return res.status(400).json({ message: 'هذا التحدي انتهى بالفعل' })
    if (room.status === 'CANCELLED') return res.status(410).json({ message: 'تم إلغاء هذه الغرفة من قبل المضيف' })

    // Check 10-minute TTL for WAITING rooms
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    if (room.status === 'WAITING' && room.createdAt < tenMinutesAgo) {
      await prisma.room.update({
        where: { id: room.id },
        data: { status: 'EXPIRED' }
      }).catch(() => {})
      return res.status(410).json({ message: 'انتهت صلاحية هذه الغرفة (تجاوزت 10 دقائق دون بدء)' })
    }
    if (room.status === 'EXPIRED') {
      return res.status(410).json({ message: 'انتهت صلاحية هذه الغرفة' })
    }

    let player = await findPlayer(player2Id, playerName)
    
    // Auto-register player if not in database yet
    if (!player) {
      const defaultName = (playerName && String(playerName).trim()) || 'متسابق جديد'
      player = await prisma.player.create({
        data: {
          name: defaultName
        }
      })
    } else if (playerName && String(playerName).trim() && player.name !== String(playerName).trim()) {
      player = await prisma.player.update({
        where: { id: player.id },
        data: { name: String(playerName).trim() }
      })
    }

    const isHost = player.id === room.player1Id

    // Private Room Password Verification (Host bypasses password verification)
    if (room.isPrivate && !isHost) {
      const enteredPass = password ? String(password).trim() : ''
      const actualPass = room.password ? String(room.password).trim() : ''
      if (!enteredPass || enteredPass !== actualPass) {
        return res.status(403).json({ message: 'كلمة المرور غير صحيحة، يرجى كتابة كلمة المرور الصحيحة للغرفة' })
      }
    }

    let playersProgress = (room.playersProgress as any) || {}

    // Add player if not already in
    if (!playersProgress[player.id]) {
      playersProgress[player.id] = { 
        progress: 0, 
        joinedAt: Date.now(),
        name: player.name
      }
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { 
        playersProgress,
        // Keep player2Id compatibility for 1v1 if needed, but primary is playersProgress
        player2Id: room.player2Id || (room.player1Id !== player.id ? player.id : room.player2Id)
      }
    })

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json(fullRoom)
  } catch (error: any) {
    console.error('Error in handleJoin:', error)
    return res.status(500).json({ message: 'فشل الانضمام للغرفة', error: error.message })
  }
}

async function handleListRooms(req: VercelRequest, res: VercelResponse) {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    // Automatically mark orphaned WAITING rooms older than 10 minutes as EXPIRED
    await prisma.room.updateMany({
      where: {
        status: 'WAITING',
        createdAt: { lt: tenMinutesAgo }
      },
      data: {
        status: 'EXPIRED'
      }
    }).catch(e => console.error('Error auto-expiring old rooms:', e))

    // Only return active WAITING rooms created within the last 10 minutes
    const rooms = await prisma.room.findMany({
      where: {
        status: 'WAITING',
        createdAt: { gte: tenMinutesAgo }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 40,
      include: {
        player1: {
          select: { id: true, name: true, username: true }
        }
      }
    })

    const formattedRooms = rooms.map(r => {
      const progress = (r.playersProgress as any) || {}
      const participantCount = Object.keys(progress).length || 1
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
        hostName: r.player1?.name || 'مجهول',
        hostUsername: r.player1?.username || null,
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
    const [audio, complete, surah] = await Promise.all([
      prisma.challenge.count({ where: { type: { in: ['STANDARD', 'AUDIO', ''] } } }),
      prisma.challenge.count({ where: { type: 'COMPLETION' } }),
      prisma.challenge.count({ where: { type: 'SURAH' } })
    ])
    return res.status(200).json({
      counts: {
        audio: audio || 0,
        complete: complete || 0,
        surah: surah || 0
      }
    })
  } catch (err: any) {
    console.error('Error in handleAvailableCounts:', err)
    return res.status(500).json({ message: 'فشل جلب الأعداد المتاحة', error: err.message })
  }
}

function finalizeRoomScores(room: any, playersProgress: Record<string, any>) {
  const totalQuestions = room.questionCount || 1
  const updatedProgress: Record<string, any> = { ...playersProgress }

  // 1. Calculate base points, accuracy, and high accuracy bonus (> 90%)
  for (const [pIdStr, pData] of Object.entries(updatedProgress)) {
    const correctCount = typeof pData.correctCount === 'number' ? pData.correctCount : 0
    const speedBonusCount = typeof pData.speedBonusCount === 'number' ? pData.speedBonusCount : 0
    const basePoints = correctCount * 10 // 10 points per correct answer
    const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) : 0
    const accuracyBonus = accuracy > 0.90 ? 15 : 0 // Bonus +15 for >90% accuracy

    pData.basePoints = basePoints
    pData.speedBonusCount = speedBonusCount
    pData.accuracyBonus = accuracyBonus
    pData.accuracy = Math.round(accuracy * 100)
    pData.completionBonus = 0
  }

  // 2. Award Conditional Early Completion Bonus (+10 pts)
  // The first player to finish with accuracy > 70% gets +10 points.
  // If the fastest player's accuracy <= 70%, bonus passes to the next fastest with accuracy > 70%.
  const finishers = Object.entries(updatedProgress)
    .filter(([_, p]) => p.finishTime && typeof p.finishTime === 'number')
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
  for (const [_, pData] of Object.entries(updatedProgress)) {
    const total = (pData.basePoints || 0) + (pData.speedBonusCount || 0) + (pData.accuracyBonus || 0) + (pData.completionBonus || 0)
    pData.score = total
    pData.finalTotalScore = total
  }

  // 4. Determine winner by highest final total score (tie-break by finishTime)
  const ranked = Object.entries(updatedProgress)
    .map(([id, p]: [string, any]) => ({
      id: parseInt(id),
      score: p.finalTotalScore || 0,
      finishTime: p.finishTime || Infinity
    }))
    .sort((a, b) => b.score - a.score || a.finishTime - b.finishTime)

  const winnerId = ranked.length > 0 ? ranked[0].id : null

  return { updatedProgress, winnerId }
}

function evaluateQuestionScores(
  playersProgress: Record<string, any>,
  currentAnswers: Record<string, { playerId: number; name: string; isCorrect: boolean; timestamp: number }>
) {
  // 1. Filter only correct answers and sort by timestamp ascending (fastest first)
  const correctSubmissions = Object.values(currentAnswers)
    .filter(ans => ans.isCorrect === true)
    .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))

  // 2. Top 4 fastest correct answers receive the speed bonus point (+1)!
  const top4PlayerIds = new Set(correctSubmissions.slice(0, 4).map(s => s.playerId))

  const updatedProgress: Record<string, any> = { ...playersProgress }

  for (const [pIdStr, pData] of Object.entries(updatedProgress)) {
    const numId = parseInt(pIdStr)
    const ans = currentAnswers[pIdStr]

    if (typeof pData.score !== 'number') pData.score = 0
    if (typeof pData.correctCount !== 'number') pData.correctCount = 0
    if (typeof pData.speedBonusCount !== 'number') pData.speedBonusCount = 0
    if (typeof pData.basePoints !== 'number') pData.basePoints = 0
    if (!Array.isArray(pData.roundHistory)) pData.roundHistory = []

    let roundPoints = 0
    let earnedSpeedBonus = false

    if (ans && ans.isCorrect) {
      roundPoints += 10 // 10 base points per correct answer
      pData.correctCount += 1
      pData.basePoints += 10

      if (top4PlayerIds.has(numId)) {
        roundPoints += 1 // Speed bonus point (+1) for top 4 correct
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

async function advanceRoomToNextQuestionTx(tx: any, room: any, currentAnswers: Record<string, any>) {
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

  const updatedProgress = evaluateQuestionScores(playersProgress, completeAnswers)

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
  }

  const updatedRoom = await tx.room.update({
    where: { id: room.id },
    data: {
      currentQuestionIndex: nextIndex,
      questionStartTime: Date.now(),
      currentAnswers: {}, // Clear answers for new question
      playersProgress: finalProgress,
      status: isFinished ? 'FINISHED' : 'PLAYING',
      winnerId
    }
  })

  return updatedRoom
}

async function advanceRoomToNextQuestion(room: any, currentAnswers: Record<string, any>) {
  const updatedRoom = await advanceRoomToNextQuestionTx(prisma, room, currentAnswers)
  return await getFullRoom(updatedRoom.id)
}

async function handlePoll(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId } = req.query
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId as string } })
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

      if (isTimerExpired || allOnlineAnswered) {
        await prisma.$transaction(async (tx) => {
          const freshRoom = await tx.room.findUnique({ where: { id: room.id } })
          if (freshRoom && freshRoom.status === 'PLAYING' && freshRoom.currentQuestionIndex === curQ) {
            await advanceRoomToNextQuestionTx(tx, freshRoom, (freshRoom.currentAnswers as any) || {})
          }
        }).catch(err => console.error('Error auto-advancing in poll:', err))
      }
    }

    if (needUpdate) {
      await prisma.room.update({
        where: { id: room.id },
        data: { playersProgress }
      })
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
    await prisma.room.update({
      where: { id: roomId as string },
      data: { 
        status: 'PLAYING',
        currentQuestionIndex: 0,
        questionStartTime: Date.now(),
        currentAnswers: {}
      }
    })
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

    // Requirement 2: ATOMIC TRANSACTION
    // Guarantees no answer is dropped or overwritten by concurrent submissions
    await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId as string } })
      if (!room || room.status !== 'PLAYING') return

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
            pData.basePoints = (pData.correctCount || 0) * 10

            const qCorrect = Object.values(currentAnswers[qKey])
              .filter((a: any) => a.isCorrect === true)
              .sort((a: any, b: any) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))

            const isTop4 = qCorrect.slice(0, 4).some((a: any) => a.playerId === player.id)
            if (isTop4) {
              pData.speedBonusCount = (pData.speedBonusCount || 0) + 1
            }
          } else {
            pData.basePoints = (pData.correctCount || 0) * 10
          }

          const qNum = Number(questionIndex)
          pData.progress = Math.round(((qNum + 1) / room.questionCount) * 100)
          pData.playerCurrentQuestionIndex = qNum + 1
          pData.lastSeen = Date.now()
          pData.isOnline = true

          if (qNum + 1 >= room.questionCount) {
            pData.finishTime = pData.finishTime || subTime
            pData.progress = 100
          }
        }

        const totalParticipants = Object.keys(playersProgress).length
        const allFinished = totalParticipants > 0 &&
          Object.values(playersProgress).every((p: any) => p.finishTime)

        const { updatedProgress, winnerId } = finalizeRoomScores(room, playersProgress)

        await tx.room.update({
          where: { id: room.id },
          data: {
            currentAnswers,
            playersProgress: updatedProgress,
            status: allFinished ? 'FINISHED' : 'PLAYING',
            winnerId: allFinished ? winnerId : room.winnerId
          }
        })
      } else {
        // SYNC MODE:
        // Only accept answers for the active question
        if (Number(questionIndex) !== room.currentQuestionIndex) {
          return
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
        }

        const playersProgress = (room.playersProgress as any) || {}
        if (!playersProgress[pIdStr]) {
          playersProgress[pIdStr] = { name: player.name }
        }
        playersProgress[pIdStr].isOnline = true
        playersProgress[pIdStr].lastSeen = Date.now()

        // Requirement 1: Host-Only Transition Validation
        // Save the answer atomically. Do NOT advance question here.
        // The Host's device (or server timeout fallback) will validate and trigger the transition.
        await tx.room.update({
          where: { id: room.id },
          data: {
            currentAnswers,
            playersProgress
          }
        })
      }
    })

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
    await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId as string } })
      if (!room || room.status !== 'PLAYING') return

      // Requirement 1: Host validation
      if (playerId) {
        const player = await findPlayer(playerId)
        if (player && player.id !== room.player1Id) {
          console.warn(`Non-host player ${playerId} attempted to advance question`)
          return
        }
      }

      // Guard against race conditions / double advancement:
      if (Number(questionIndex) !== room.currentQuestionIndex) {
        return
      }

      const currentAnswers = (room.currentAnswers as any) || {}
      await advanceRoomToNextQuestionTx(tx, room, currentAnswers)
    })

    const fullRoom = await getFullRoom(roomId as string)
    return res.status(200).json(fullRoom)
  } catch (error: any) {
    console.error('Error in handleAdvanceQuestion:', error)
    return res.status(500).json({ message: 'Failed to advance question', error: error.message })
  }
}

async function handleSubmitProgress(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId, progress, isFinished, score } = req.body
  if (!roomId || !playerId || progress === undefined) return res.status(400).json({ message: 'Missing fields' })

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId as string } })
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

      // If everyone finished, set room status to FINISHED and run final scoring
      const allFinished = Object.values(playersProgress).every((p: any) => p.finishTime)
      const { updatedProgress, winnerId } = finalizeRoomScores(room, playersProgress)
      updateData.playersProgress = updatedProgress

      if (allFinished) {
        updateData.status = 'FINISHED'
      }
      if (winnerId) {
        updateData.winnerId = winnerId
      }
    }

    await prisma.room.update({
      where: { id: room.id },
      data: updateData
    })

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json(fullRoom)
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed', error: error.message })
  }
}

async function handleListChallenges(req: VercelRequest, res: VercelResponse) {
  const { type } = req.query
  try {
    let whereClause: any = {}
    if (type === 'COMPLETION') whereClause.type = 'COMPLETION'
    else if (type === 'SURAH') whereClause.type = 'SURAH'
    else if (type === 'STANDARD' || !type) whereClause.type = { in: ['STANDARD', 'AUDIO', ''] }

    const challenges = await prisma.challenge.findMany({
      where: whereClause,
      select: { 
        id: true, 
        keyword: true, 
        category: true, 
        level: true, 
        type: true,
        options: true,
        correctText: true,
        verses: true
      } as any,
      orderBy: { keyword: 'asc' }
    })
    return res.status(200).json(mapChallenges(challenges))
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

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    // 1. Check if user is the host of an active WAITING room (< 10 mins old)
    const hostWaitingRoom = await prisma.room.findFirst({
      where: {
        player1Id: player.id,
        status: 'WAITING',
        createdAt: { gte: tenMinutesAgo }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (hostWaitingRoom) {
      const fullRoom = await getFullRoom(hostWaitingRoom.id)
      return res.status(200).json(fullRoom)
    }

    // 2. Check if user is participant or host of an ongoing PLAYING room (< 2 hours old)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const rooms = await prisma.room.findMany({
      where: {
        status: 'PLAYING',
        createdAt: { gte: twoHoursAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    const pIdStr = String(player.id)
    const activeRoom = rooms.find(r => {
      if (r.player1Id === player.id) {
        return true
      }
      const progress = (r.playersProgress as any) || {}
      if (progress[pIdStr]) {
        // Only active if player hasn't finished yet
        return !progress[pIdStr].finishTime
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

    const room = await prisma.room.findUnique({ where: { id: String(roomId) } })
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
      const allRemainingAnswered = remainingOnlinePlayers.length > 0 && remainingOnlinePlayers.every(([id]) => {
        const a = currentAnswers[id]
        return a && (a.questionIndex === undefined || a.questionIndex === curQ)
      })

      if (allRemainingAnswered) {
        await prisma.$transaction(async (tx) => {
          const freshRoom = await tx.room.findUnique({ where: { id: room.id } })
          if (freshRoom && freshRoom.status === 'PLAYING' && freshRoom.currentQuestionIndex === curQ) {
            const freshProgress = (freshRoom.playersProgress as any) || {}
            if (freshProgress[pIdStr]) {
              freshProgress[pIdStr].isOnline = false
              freshProgress[pIdStr].lastSeen = Date.now()
            }
            await advanceRoomToNextQuestionTx(tx, { ...freshRoom, playersProgress: freshProgress }, (freshRoom.currentAnswers as any) || {})
          }
        })
        const fullRoom = await getFullRoom(room.id)
        return res.status(200).json(fullRoom)
      }
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { playersProgress }
    })

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

    const room = await prisma.room.findUnique({ where: { id: String(roomId) } })
    if (!room) return res.status(404).json({ message: 'Room not found' })

    // Security check: Only the host can cancel the room
    if (player.id !== room.player1Id) {
      return res.status(403).json({ message: 'غير مصرح لك بإلغاء الغرفة. المضيف فقط يمكنه الإلغاء.' })
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { status: 'CANCELLED' }
    })

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json(fullRoom)
  } catch (err: any) {
    console.error('Error in handleCancelRoom:', err)
    return res.status(500).json({ message: 'Failed to cancel room', error: err.message })
  }
}

async function handleResign(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId } = req.body
  if (!roomId || !playerId) return res.status(400).json({ error: 'Room ID and Player ID required' })

  try {
    const player = await findPlayer(playerId)
    if (!player) return res.status(404).json({ error: 'Player not found' })

    const room = await prisma.room.findUnique({
      where: { id: String(roomId) }
    })
    if (!room) return res.status(404).json({ error: 'Room not found' })

    let playersProgress = (room.playersProgress as any) || {}
    if (!playersProgress[player.id]) {
      playersProgress[player.id] = { name: player.name }
    }

    playersProgress[player.id].progress = 100
    playersProgress[player.id].score = 0
    playersProgress[player.id].finishTime = Date.now()
    playersProgress[player.id].isResigned = true

    const updateData: any = { playersProgress }

    // If everyone finished or resigned, set room status to FINISHED
    const allFinished = Object.values(playersProgress).every((p: any) => !!p.finishTime)
    if (allFinished) {
      updateData.status = 'FINISHED'
    }

    // Set winnerId to the player with the highest score
    const finishedPlayers = Object.entries(playersProgress)
      .map(([id, p]: [string, any]) => ({ id: parseInt(id), score: p.score || 0, finishTime: p.finishTime }))
      .sort((a, b) => b.score - a.score || (a.finishTime || 0) - (b.finishTime || 0))

    if (finishedPlayers.length > 0) {
      updateData.winnerId = finishedPlayers[0].id
    }

    await prisma.room.update({
      where: { id: String(roomId) },
      data: updateData
    })
    const fullRoom = await getFullRoom(String(roomId))
    return res.status(200).json(fullRoom)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

async function handleReaction(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId, playerName, emoji } = req.body || {}
  if (!roomId || !emoji) {
    return res.status(400).json({ error: 'Missing roomId or emoji' })
  }

  try {
    const room = await prisma.room.findUnique({ where: { id: String(roomId) } })
    if (!room) return res.status(404).json({ error: 'Room not found' })

    const playersProgress: any = (room.playersProgress as any) || {}
    playersProgress.__lastReaction = {
      senderId: String(playerId || ''),
      senderName: String(playerName || 'متسابق'),
      emoji: String(emoji),
      timestamp: Date.now()
    }

    await prisma.room.update({
      where: { id: String(roomId) },
      data: { playersProgress }
    })

    return res.status(200).json({ success: true, reaction: playersProgress.__lastReaction })
  } catch (err: any) {
    console.error('Reaction error:', err)
    return res.status(500).json({ error: err.message })
  }
}
