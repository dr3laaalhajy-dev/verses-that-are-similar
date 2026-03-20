import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { code, player2Id } = req.body

  if (!code || !player2Id) {
    return res.status(400).json({ message: 'Missing code or player2Id' })
  }

  try {
    const room = await prisma.room.findUnique({
      where: { code },
      include: { player1: true }
    })

    if (!room) {
      return res.status(404).json({ message: 'الغرفة غير موجودة' })
    }

    if (room.status !== 'WAITING') {
      return res.status(400).json({ message: 'هذه اللعبة بدأت بالفعل أو انتهت' })
    }

    // Resolve deviceId to Player.id
    const player2 = await prisma.player.findUnique({
      where: { deviceId: player2Id }
    })
    if (!player2) {
      return res.status(404).json({ message: 'اللاعب غير مسجل' })
    }

    if (room.player1Id === player2.id) {
      return res.status(400).json({ message: 'لا يمكنك اللعب ضد نفسك' })
    }

    const updatedRoomData = await prisma.room.update({
      where: { id: room.id },
      data: {
        player2Id: player2.id,
        status: 'PLAYING'
      },
      include: {
        player1: true,
        player2: true
      }
    })

    // Fetch challenges
    const challenges = await prisma.challenge.findMany({
        where: { id: { in: updatedRoomData.challengeIds as number[] } }
    })

    // Return room with challenges
    const updatedRoom = {
        ...updatedRoomData,
        challenges
    }

    return res.status(200).json(updatedRoom)
  } catch (error: any) {
    console.error('Join Room Error:', error)
    return res.status(500).json({ 
      message: 'Failed to join room',
      error: error.message 
    })
  }
}
