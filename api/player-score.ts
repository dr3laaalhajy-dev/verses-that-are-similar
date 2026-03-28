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
      await prisma.player.update({
        where: { deviceId },
        data: {
          points: { increment: points || 0 },
          cups: { increment: 1 },
          completedChallengeIds: [...completedIds, Number(challengeId)]
        }
      })
      const updatedPlayer = await prisma.player.findUnique({ where: { deviceId } })
      return res.status(200).json(updatedPlayer)
    }

    // Handle generic point/cup updates if provided (e.g. for penalties or sync)
    if (points !== undefined || req.body.cups !== undefined || req.body.totalPoints !== undefined || req.body.totalCups !== undefined) {
      const updateData: any = {};
      if (req.body.totalPoints !== undefined) updateData.points = Number(req.body.totalPoints);
      else if (points !== undefined) updateData.points = { increment: Number(points) };
      
      if (req.body.totalCups !== undefined) updateData.cups = Number(req.body.totalCups);
      else if (req.body.cups !== undefined) updateData.cups = { increment: Number(req.body.cups) };

      const updatedPlayer = await prisma.player.update({
        where: { deviceId },
        data: updateData
      });
      return res.status(200).json(updatedPlayer);
    }

    // If no updates needed, just return current player
    return res.status(200).json(player)
  } catch (error: any) {
    console.error('Score Update Error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message
    })
  }
}
