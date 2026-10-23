import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.method === 'GET' ? req.query.action : req.body.action

  switch (action) {
    case 'create': return handleCreate(req, res)
    case 'join': return handleJoin(req, res)
    case 'poll': return handlePoll(req, res)
    case 'start': return handleStart(req, res)
    case 'submit-progress': return handleSubmitProgress(req, res)
    case 'list-challenges': return handleListChallenges(req, res)
    case 'check-active': return handleCheckActive(req, res)
    case 'resign': return handleResign(req, res)
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

  return { 
    ...room, 
    participants: players, 
    challenges: mapChallenges(orderedChallenges) 
  }
}

async function handleCreate(req: VercelRequest, res: VercelResponse) {
    const { player1Id, player1Name, category, level, questionCount, questionIds, maxPlayers, gameMode, timePerQuestion, customChallenges } = req.body
    if (!player1Id && !player1Name) return res.status(400).json({ message: 'Missing player1Id' })

    const maxQuestions = Number(questionCount) || 5

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
      
      // Strict Category Filtering
      if (category && category !== "") {
        whereClause.category = category
      }

      // Strict Mode Filtering 
      if (gameMode === 'COMPLETION') {
        whereClause.type = 'COMPLETION'
      } else if (gameMode === 'SURAH') {
        whereClause.type = 'SURAH'
      } else if (gameMode === 'STANDARD' || gameMode === 'audio' || !gameMode) {
        whereClause.type = { in: ['STANDARD', 'AUDIO', ''] }
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
        player1Id: player1.id,
        challengeIds: selectedIds,
        status: 'WAITING',
        categoryFilter: category || "",
        questionCount: finalQuestionCount,
        maxPlayers: 999,
        gameMode: gameMode || "STANDARD",
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
  const { code, player2Id, playerName } = req.body
  if (!code || !player2Id) return res.status(400).json({ message: 'يرجى إدخال رمز الغرفة' })

  const cleanCode = String(code).trim().toUpperCase()

  try {
    const room = await prisma.room.findFirst({ 
      where: { 
        code: { equals: cleanCode, mode: 'insensitive' } 
      }, 
      include: { player1: true } 
    })
    
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة، تأكد من صحة الرمز المكون من 6 خانات' })
    
    // Status can be WAITING or PLAYING (allow late join if within maxPlayers)
    if (room.status === 'FINISHED') return res.status(400).json({ message: 'هذا التحدي انتهى بالفعل' })

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

async function handlePoll(req: VercelRequest, res: VercelResponse) {
  const { roomId } = req.query
  try {
    const fullRoom = await getFullRoom(roomId as string)
    if (!fullRoom) return res.status(404).json({ error: 'Room not found' })
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
      data: { status: 'PLAYING' }
    })
    const fullRoom = await getFullRoom(roomId as string)
    return res.status(200).json(fullRoom)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
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
    playersProgress[player.id].score = score || playersProgress[player.id].score || 0
    
    const updateData: any = { playersProgress }
    
    if (isFinished) {
      const finishTime = Date.now()
      playersProgress[player.id].finishTime = finishTime
      playersProgress[player.id].progress = 100

      // If everyone finished, set room status to FINISHED
      const allFinished = Object.values(playersProgress).every((p: any) => p.finishTime)
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

    const room = await prisma.room.findFirst({
      where: {
        status: 'PLAYING',
        OR: [
          { player1Id: player.id },
          { player2Id: player.id }
        ]
      },
      include: {
        player1: true,
        player2: true,
        winner: true
      },
      orderBy: { createdAt: 'desc' }
    })
    if (!room) return res.status(200).json(null)

    const fullRoom = await getFullRoom(room.id)
    return res.status(200).json(fullRoom)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
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
