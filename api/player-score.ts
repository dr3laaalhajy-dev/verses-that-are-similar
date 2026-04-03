import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { roomId, playerId, score, deviceId, points, challengeId, seerahCompleted, generalCompleted, quranCompleted } = req.body

  // 1. Handle Room-based Score Update
  if (roomId) {
    if (!playerId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields: roomId, playerId, or score' });
    }

    try {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const player = await prisma.player.findUnique({ where: { deviceId: playerId } });
      if (!player) return res.status(404).json({ error: 'Player not found' });

      let playersProgress = room.playersProgress as any || {};
      if (!playersProgress[player.id]) {
        playersProgress[player.id] = { name: player.name, joinedAt: Date.now() };
      }
      
      playersProgress[player.id].score = score;
      
      const updatedRoom = await prisma.room.update({
        where: { id: roomId },
        data: { playersProgress },
        include: { player1: true, player2: true }
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Score updated successfully',
        room: updatedRoom 
      });
    } catch (err: any) {
      console.error('Room Score Update Error:', err);
      return res.status(500).json({ error: 'Failed to update room score', message: err.message });
    }
  }

  // 2. Fallback to existing Single-player Score Update (using deviceId)
  const targetId = deviceId || playerId;
  if (!targetId) {
    return res.status(400).json({ message: 'Missing deviceId or playerId' })
  }

  try {
    const player = await prisma.player.findUnique({
      where: { deviceId: targetId }
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
        where: { deviceId: targetId },
        data: {
          points: { increment: points || 0 },
          cups: { increment: 1 },
          completedChallengeIds: [...completedIds, Number(challengeId)]
        }
      })
      const updatedPlayer = await prisma.player.findUnique({ where: { deviceId: targetId } })
      return res.status(200).json(updatedPlayer)
    }

    // Handle generic point/cup updates if provided (e.g. for penalties or sync)
    if (points !== undefined || req.body.cups !== undefined || req.body.totalPoints !== undefined || req.body.totalCups !== undefined) {
      const updateData: any = {};
      if (req.body.totalPoints !== undefined) updateData.points = Number(req.body.totalPoints);
      else if (points !== undefined) updateData.points = { increment: Number(points) };
      
      if (req.body.totalCups !== undefined) updateData.cups = Number(req.body.totalCups);
      else if (req.body.cups !== undefined) updateData.cups = { increment: Number(req.body.cups) };

      if (seerahCompleted !== undefined) updateData.seerahCompleted = Boolean(seerahCompleted);
      if (generalCompleted !== undefined) updateData.generalCompleted = Boolean(generalCompleted);
      if (quranCompleted !== undefined) updateData.quranCompleted = Boolean(quranCompleted);

      const updatedPlayer = await prisma.player.update({
        where: { deviceId: targetId },
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
