import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { roomId } = req.query

  try {
    const roomData = await prisma.room.findUnique({
      where: { id: roomId as string },
      include: {
        player1: true,
        player2: true,
        winner: true
      }
    })
    
    if (!roomData) return res.status(404).json({ message: 'Room not found' })

    // Fetch challenges
    const challenges = await prisma.challenge.findMany({
        where: { id: { in: roomData.challengeIds as number[] } }
    })

    return res.status(200).json({
        ...roomData,
        challenges
    })
  } catch (error: any) {
  }
}
