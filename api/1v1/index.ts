import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.method === 'GET' ? req.query.action : req.body.action

  switch (action) {
    case 'create':
      return handleCreate(req, res)
    case 'join':
      return handleJoin(req, res)
    case 'status':
      return handleStatus(req, res)
    case 'submit-progress':
      return handleSubmitProgress(req, res)
    default:
      return res.status(400).json({ message: 'Invalid action' })
  }
}

async function handleCreate(req: VercelRequest, res: VercelResponse) {
  const { player1Id } = req.body
  if (!player1Id) return res.status(400).json({ message: 'Missing player1Id' })

  try {
    let code = ''
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let isUnique = false
    while (!isUnique) {
      code = ''
      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
      const existing = await prisma.room.findUnique({ where: { code } })
      if (!existing) isUnique = true
    }

    const player1 = await prisma.player.findUnique({ where: { deviceId: player1Id } })
    if (!player1) return res.status(404).json({ message: 'Player not found' })

    const allChallenges = await prisma.challenge.findMany()
    const selectedChallenges = allChallenges.sort(() => 0.5 - Math.random()).slice(0, 5)
    const selectedIds = selectedChallenges.map(c => c.id)

    const roomData = await prisma.room.create({
      data: { code, player1Id: player1.id, challengeIds: selectedIds, status: 'WAITING' },
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

async function handleStatus(req: VercelRequest, res: VercelResponse) {
  const { roomId } = req.query
  try {
    const roomData = await prisma.room.findUnique({
      where: { id: roomId as string },
      include: { player1: true, player2: true, winner: true }
    })
    if (!roomData) return res.status(404).json({ message: 'Room not found' })

    const challenges = await prisma.challenge.findMany({ where: { id: { in: roomData.challengeIds as number[] } } })
    return res.status(200).json({ ...roomData, challenges })
  } catch (error) {
    return res.status(500).json({ message: 'Error' })
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
