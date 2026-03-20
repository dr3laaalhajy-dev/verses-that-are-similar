import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { deviceId, points, challengeId } = req.body

  if (!deviceId) {
    return res.status(400).json({ message: 'Missing deviceId' })
  }

  try {
    const player = await prisma.player.findUnique({
      where: { deviceId }
    })

    if (!player) {
      return res.status(404).json({ message: 'Player not found' })
    }

    // Ensure we handle the Json field correctly
    let completedIds: number[] = []
    if (Array.isArray(player.completedChallengeIds)) {
      completedIds = player.completedChallengeIds as number[]
    }

    // Logical check: If challengeId is provided and NOT already completed
    if (challengeId !== undefined && challengeId !== null && !completedIds.includes(Number(challengeId))) {
      const updatedPlayer = await prisma.player.update({
        where: { deviceId },
        data: {
          points: { increment: points || 0 },
          cups: { increment: 1 },
          completedChallengeIds: [...completedIds, Number(challengeId)]
        }
      })
      return res.status(200).json(updatedPlayer)
    }

    // If challenge was already completed OR no challengeId provided, just return current player
    // This satisfies the requirement "no duplicate cups/points"
    return res.status(200).json(player)
  } catch (error: any) {
    console.error('Score Update Error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message
    })
  }
}
