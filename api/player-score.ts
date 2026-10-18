import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  // Handle GET request to retrieve player stats
  if (req.method === 'GET') {
    const { deviceId, playerId, username, name } = req.query;
    const targetId = (deviceId || playerId) as string | undefined;

    try {
      let player = targetId ? await prisma.player.findUnique({
        where: { deviceId: targetId }
      }) : null;

      if (!player && (username || name)) {
        const cleanU = String(username || '').trim().replace(/^@+/, '');
        const cleanN = String(name || '').trim();
        player = await prisma.player.findFirst({
          where: {
            OR: [
              ...(cleanU ? [{ username: cleanU }, { username: '@' + cleanU }] : []),
              ...(cleanN ? [{ name: { equals: cleanN, mode: 'insensitive' as const } }] : [])
            ] as any
          }
        });
      }

      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }

      return res.status(200).json(player);
    } catch (err: any) {
      console.error('Player Fetch Error:', err);
      return res.status(500).json({ error: 'Failed to fetch player stats', message: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { roomId, playerId, score, deviceId, points, challengeId, seerahCompleted, generalCompleted, quranCompleted, activeFrame, name, username } = req.body

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
  if (!targetId && !username && !name) {
    return res.status(400).json({ message: 'Missing deviceId, username, or name' })
  }

  try {
    let player = targetId ? await prisma.player.findUnique({
      where: { deviceId: targetId }
    }) : null;

    if (!player && (username || name)) {
      const cleanU = (username || '').trim().replace(/^@+/, '');
      const cleanN = (name || '').trim();
      player = await prisma.player.findFirst({
        where: {
          OR: [
            ...(cleanU ? [{ username: cleanU }, { username: '@' + cleanU }] : []),
            ...(cleanN ? [{ name: { equals: cleanN, mode: 'insensitive' as const } }] : [])
          ] as any
        }
      });
      if (player && targetId) {
        await prisma.player.update({
          where: { id: player.id },
          data: { deviceId: targetId }
        });
      }
    }

    if (!player) {
      return res.status(404).json({ message: 'Player not found' })
    }

    if ((player as any).isBlocked) {
      return res.status(403).json({ error: 'تم حظر هذا الحساب من قِبل إدارة التطبيق' })
    }

    // Ensure we handle the Json field correctly
    let completedIds: number[] = []
    if (Array.isArray(player.completedChallengeIds)) {
      completedIds = player.completedChallengeIds as number[]
    }

    const updateData: any = {};

    // 1. If challengeId is provided and NOT already completed
    if (challengeId !== undefined && challengeId !== null && !completedIds.includes(Number(challengeId))) {
      updateData.points = { increment: points || 0 };
      updateData.cups = { increment: 1 };
      updateData.completedChallengeIds = [...completedIds, Number(challengeId)];
    } else {
      if (req.body.totalPoints !== undefined) {
        const incPoints = Number(req.body.totalPoints);
        if (!isNaN(incPoints)) {
          updateData.points = Math.max(player.points || 0, incPoints);
        }
      } else if (points !== undefined) {
        updateData.points = { increment: Number(points) };
      }
      
      if (req.body.totalCups !== undefined) {
        const incCups = Number(req.body.totalCups);
        if (!isNaN(incCups)) {
          updateData.cups = Math.max(player.cups || 0, incCups);
        }
      } else if (req.body.cups !== undefined) {
        updateData.cups = { increment: Number(req.body.cups) };
      }
    }

    if (seerahCompleted !== undefined) updateData.seerahCompleted = Boolean(seerahCompleted);
    if (generalCompleted !== undefined) updateData.generalCompleted = Boolean(generalCompleted);
    if (quranCompleted !== undefined) updateData.quranCompleted = Boolean(quranCompleted);
    if (activeFrame !== undefined) updateData.activeFrame = activeFrame ? String(activeFrame) : null;

    if (Object.keys(updateData).length > 0) {
      const updatedPlayer = await prisma.player.update({
        where: { id: player.id },
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
