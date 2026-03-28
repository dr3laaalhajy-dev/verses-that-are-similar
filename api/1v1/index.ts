import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.method === 'GET' ? req.query.action : req.body.action

  switch (action) {
    case 'create': return handleCreate(req, res)
    case 'join': return handleJoin(req, res)
    case 'poll': return handlePoll(req, res)
    case 'submit-progress': return handleSubmitProgress(req, res)
    case 'list-challenges': return handleListChallenges(req, res)
    case 'check-active': return handleCheckActive(req, res)
    case 'resign': return handleResign(req, res)
    default:
      return res.status(400).json({ message: 'Invalid action' })
  }
}

async function handleCreate(req: VercelRequest, res: VercelResponse) {
  const { player1Id, category, level, questionCount, questionIds, maxPlayers, gameMode, timePerQuestion } = req.body
  if (!player1Id) return res.status(400).json({ message: 'Missing player1Id' })

  const maxQuestions = Number(questionCount) || 5

  try {
    const player1 = await prisma.player.findUnique({ where: { deviceId: player1Id } })
    if (!player1) return res.status(404).json({ message: 'Player not found' })

    let code = ''
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let isUnique = false
    while (!isUnique) {
      code = ''
      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
      const existing = await prisma.room.findUnique({ where: { code } })
      if (!existing) isUnique = true
    }

    // No-Repeat Filtering logic
    let seenIds: number[] = []
    if (Array.isArray(player1.completedChallengeIds)) {
      seenIds = player1.completedChallengeIds as number[]
    }

    let selectedChallenges = []
    if (Array.isArray(questionIds) && questionIds.length > 0) {
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
      // Priority Fallback Logic: New Questions first, then Fallback to seen
      let whereClause: any = {}
      if (gameMode === 'COMPLETION') whereClause.type = 'COMPLETION'
      else if (gameMode === 'SURAH') whereClause.type = 'SURAH'
      else whereClause.type = { in: ['STANDARD', 'AUDIO', ''] }

      // 1. Fetch new questions (not in seenIds)
      let selectedChallenges = await prisma.challenge.findMany({
        where: {
          ...whereClause,
          id: { notIn: seenIds }
        },
        take: maxQuestions
      })

      // 2. If deficit, fetch more from seen pool randomly
      if (selectedChallenges.length < maxQuestions) {
        const deficit = maxQuestions - selectedChallenges.length
        const fallbackChallenges = await prisma.challenge.findMany({
          where: {
            ...whereClause,
            id: { in: seenIds }
          },
          take: deficit
        })
        selectedChallenges = [...selectedChallenges, ...fallbackChallenges]
      }

      // If still no challenges found (e.g. database empty), return error
      if (selectedChallenges.length === 0) {
        return res.status(400).json({ message: 'لا توجد تحديات متوفرة لهذا النوع' })
      }

      // 3. Shuffle the combined list to mix new and old questions
      selectedChallenges = selectedChallenges.sort(() => 0.5 - Math.random())
    }

    const selectedIds = selectedChallenges.map(c => c.id)

    // Update player1's completedChallengeIds with the new ones immediately to prevent repeat if they create another room
    const newSeenIds = Array.from(new Set([...seenIds, ...selectedIds]))
    await prisma.player.update({
      where: { id: player1.id },
      data: { completedChallengeIds: newSeenIds }
    })

    const finalQuestionCount = selectedChallenges.length

    const roomData = await prisma.room.create({
      data: {
        code,
        player1Id: player1.id,
        challengeIds: selectedIds,
        status: 'WAITING',
        categoryFilter: category || "",
        questionCount: finalQuestionCount,
        maxPlayers: Number(maxPlayers) || 2,
        gameMode: gameMode || "STANDARD",
        timePerQuestion: Number(timePerQuestion) || 20,
        playersProgress: { [player1.id]: 0 }
      } as any,
      include: { player1: true }
    })

    return res.status(201).json({ ...roomData, challenges: selectedChallenges })
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to create room', error: error.message })
  }
}

async function handleJoin(req: VercelRequest, res: VercelResponse) {
  const { code, player2Id } = req.body
  if (!code || !player2Id) return res.status(400).json({ message: 'Missing fields' })

  try {
    const room = await prisma.room.findUnique({ where: { code }, include: { player1: true } })
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة' })
    if (room.status !== 'WAITING') return res.status(400).json({ message: 'هذه اللعبة بدأت بالفعل أو انتهت' })

    const player2 = await prisma.player.findUnique({ where: { deviceId: player2Id } })
    if (!player2) return res.status(404).json({ message: 'اللاعب غير مسجل' })
    if (room.player1Id === player2.id) return res.status(400).json({ message: 'لا يمكنك اللعب ضد نفسك' })

    const updatedRoomData = await prisma.room.update({
      where: { id: room.id },
      data: { player2Id: player2.id, status: 'PLAYING' },
      include: { player1: true, player2: true }
    })

    const challenges = await prisma.challenge.findMany({ where: { id: { in: updatedRoomData.challengeIds as number[] } } })
    return res.status(200).json({ ...updatedRoomData, challenges })
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to join room', error: error.message })
  }
}

async function handlePoll(req: VercelRequest, res: VercelResponse) {
  const { roomId } = req.query
  try {
    const roomData = await prisma.room.findUnique({
      where: { id: roomId as string },
      include: { player1: true, player2: true, winner: true }
    })
    if (!roomData) return res.status(404).json({ error: 'Room not found' })

    const challenges = await prisma.challenge.findMany({ where: { id: { in: roomData.challengeIds as number[] } } })
    return res.status(200).json({ ...roomData, challenges })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

async function handleSubmitProgress(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId, progress, isWinner } = req.body
  if (!roomId || !playerId || progress === undefined) return res.status(400).json({ message: 'Missing fields' })

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room || room.status === 'FINISHED') return res.status(404).json({ message: 'Room not found or finished' })

    const player = await prisma.player.findUnique({ where: { deviceId: playerId } })
    if (!player) return res.status(404).json({ message: 'Player not found' })

    const updateData: any = {}
    if (room.player1Id === player.id) updateData.player1Progress = progress
    else if (room.player2Id === player.id) updateData.player2Progress = progress
    else return res.status(403).json({ message: 'Not a player' })

    if (isWinner && room.status !== 'FINISHED') {
      updateData.status = 'FINISHED'
      updateData.winnerId = player.id
    }

    const updatedRoomData = await prisma.room.update({
      where: { id: roomId },
      data: updateData,
      include: { player1: true, player2: true, winner: true }
    })

    const challenges = await prisma.challenge.findMany({ where: { id: { in: updatedRoomData.challengeIds as number[] } } })
    return res.status(200).json({ ...updatedRoomData, challenges })
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
    return res.status(200).json(challenges)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

async function handleCheckActive(req: VercelRequest, res: VercelResponse) {
  const { playerId } = req.query
  if (!playerId) return res.status(400).json({ error: 'Player ID required' })

  try {
    const player = await prisma.player.findUnique({ where: { deviceId: String(playerId) } })
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

    const challenges = await prisma.challenge.findMany({ where: { id: { in: room.challengeIds as number[] } } })
    return res.status(200).json({ ...room, challenges })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

async function handleResign(req: VercelRequest, res: VercelResponse) {
  const { roomId, playerId } = req.body
  if (!roomId || !playerId) return res.status(400).json({ error: 'Room ID and Player ID required' })

  try {
    const player = await prisma.player.findUnique({ where: { deviceId: String(playerId) } })
    if (!player) return res.status(404).json({ error: 'Player not found' })

    const room = await prisma.room.findUnique({
      where: { id: String(roomId) }
    })
    if (!room) return res.status(404).json({ error: 'Room not found' })

    const winnerId = room.player1Id === player.id ? room.player2Id : room.player1Id
    if (!winnerId) return res.status(400).json({ error: 'Opponent not found' })

    const updatedRoom = await prisma.room.update({
      where: { id: String(roomId) },
      data: {
        status: 'FINISHED',
        winnerId: winnerId
      } as any,
      include: {
        player1: true,
        player2: true,
        winner: true
      }
    })
    return res.status(200).json(updatedRoom)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
