import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { roomId, playerId, progress } = req.body

  if (!roomId || !playerId || progress === undefined) {
    return res.status(400).json({ message: 'Missing fields' })
  }

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    })

    if (!room) {
      return res.status(404).json({ message: 'Room not found' })
    }

    if (room.status === 'FINISHED') {
      return res.status(400).json({ message: 'Game already finished' })
    }

    // Resolve deviceId to Player.id
    const player = await prisma.player.findUnique({
      where: { deviceId: playerId }
    })
    if (!player) {
      return res.status(404).json({ message: 'Player not found' })
    }

    const isPlayer1 = room.player1Id === player.id
    const isPlayer2 = room.player2Id === player.id

    if (!isPlayer1 && !isPlayer2) {
      return res.status(403).json({ message: 'Not a player in this room' })
    }

    const { isWinner } = req.body

    const updateData: any = {}
    if (isPlayer1) updateData.player1Progress = progress
    else updateData.player2Progress = progress

    // Check if finished
    if (isWinner && room.status !== 'FINISHED') {
      updateData.status = 'FINISHED'
      updateData.winnerId = player.id
    }

    const updatedRoomData = await prisma.room.update({
      where: { id: roomId },
      data: updateData,
      include: {
        player1: true,
        player2: true,
        winner: true
      }
    })

    // Fetch challenges
    const challenges = await prisma.challenge.findMany({
        where: { id: { in: updatedRoomData.challengeIds as number[] } }
    })

    return res.status(200).json({
        ...updatedRoomData,
        challenges
    })
  } catch (error: any) {
    console.error('Submit Progress Error:', error)
    return res.status(500).json({ 
      message: 'Failed to submit progress',
      error: error.message 
    })
  }
}
