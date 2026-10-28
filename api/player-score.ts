import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  // Handle GET request to retrieve player stats
  if (req.method === 'GET') {
    const { playerId, username, name } = req.query;
    const cleanU = String(username || '').trim().replace(/^@+/, '');
    const cleanN = String(name || '').trim();
    const numId = Number(playerId);

    try {
      let player = await prisma.player.findFirst({
        where: {
          OR: [
            ...(cleanU ? [{ username: cleanU }, { username: '@' + cleanU }] : []),
            ...(cleanN ? [{ name: { equals: cleanN, mode: 'insensitive' as const } }] : []),
            ...(Number.isInteger(numId) && numId > 0 ? [{ id: numId }] : [])
          ] as any
        }
      });

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

  const { roomId, playerId, score, points, challengeId, seerahCompleted, generalCompleted, quranCompleted, activeFrame, name, username } = req.body

  // 1. Handle Room-based Score Update
  if (roomId) {
    if (!playerId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields: roomId, playerId, or score' });
    }

    try {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const cleanP = String(playerId).trim().replace(/^@+/, '');
      const numId = Number(playerId);

      const player = await prisma.player.findFirst({
        where: {
          OR: [
            { username: cleanP },
            { username: '@' + cleanP },
            { name: { equals: String(playerId), mode: 'insensitive' as const } },
            ...(Number.isInteger(numId) && numId > 0 ? [{ id: numId }] : [])
          ] as any
        }
      });

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

  // 2. Single-player Score Update
  const cleanU = (username || '').trim().replace(/^@+/, '');
  const cleanN = (name || '').trim();
  const numId = Number(playerId);

  if (!cleanU && !cleanN && (!numId || isNaN(numId))) {
    return res.status(400).json({ message: 'Missing username or name' })
  }

  try {
    let player = await prisma.player.findFirst({
      where: {
        OR: [
          ...(cleanU ? [{ username: cleanU }, { username: '@' + cleanU }] : []),
          ...(cleanN ? [{ name: { equals: cleanN, mode: 'insensitive' as const } }] : []),
          ...(Number.isInteger(numId) && numId > 0 ? [{ id: numId }] : [])
        ] as any
      }
    });

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

    // 1. Points handling:
    const addedPoints = Number(points || 0);
    const explicitTotalPoints = req.body.totalPoints !== undefined ? Number(req.body.totalPoints) : null;
    const clientScore = req.body.score !== undefined ? Number(req.body.score) : null;

    if (addedPoints > 0) {
      updateData.points = { increment: addedPoints };
    } else if (explicitTotalPoints !== null && !isNaN(explicitTotalPoints)) {
      updateData.points = Math.max(player.points || 0, explicitTotalPoints);
    } else if (clientScore !== null && !isNaN(clientScore) && clientScore > (player.points || 0)) {
      updateData.points = clientScore;
    }

    // 2. Cups handling:
    const addedCups = req.body.cups !== undefined ? Number(req.body.cups) : 0;
    const explicitTotalCups = req.body.totalCups !== undefined ? Number(req.body.totalCups) : (req.body.trophiesCount !== undefined ? Number(req.body.trophiesCount) : null);

    let isNewChallenge = false;
    if (challengeId !== undefined && challengeId !== null) {
      const cId = Number(challengeId);
      if (!isNaN(cId) && !completedIds.includes(cId)) {
        isNewChallenge = true;
        updateData.completedChallengeIds = [...completedIds, cId];
      }
    }

    if (addedCups > 0) {
      updateData.cups = { increment: addedCups };
    } else if (isNewChallenge) {
      updateData.cups = { increment: 1 };
    } else if (explicitTotalCups !== null && !isNaN(explicitTotalCups)) {
      updateData.cups = Math.max(player.cups || 0, explicitTotalCups);
    }

    // 3. Streak handling:
    const explicitStreak = req.body.streakCount !== undefined ? Number(req.body.streakCount) : (req.body.streak !== undefined ? Number(req.body.streak) : null);
    if (explicitStreak !== null && !isNaN(explicitStreak)) {
      updateData.streak = Math.max(player.streak || 0, explicitStreak);
    }

    if (seerahCompleted !== undefined) updateData.seerahCompleted = Boolean(seerahCompleted);
    if (generalCompleted !== undefined) updateData.generalCompleted = Boolean(generalCompleted);
    if (quranCompleted !== undefined) updateData.quranCompleted = Boolean(quranCompleted);
    if (activeFrame !== undefined) updateData.activeFrame = activeFrame ? String(activeFrame) : null;
    if (req.body.equippedTitle !== undefined) updateData.equippedTitle = req.body.equippedTitle ? String(req.body.equippedTitle) : null;
    if (req.body.equippedNameColor !== undefined) updateData.equippedNameColor = req.body.equippedNameColor ? String(req.body.equippedNameColor) : null;
    if (req.body.ownedCosmetics !== undefined && Array.isArray(req.body.ownedCosmetics)) updateData.ownedCosmetics = req.body.ownedCosmetics;
    if (req.body.powerUps !== undefined && typeof req.body.powerUps === 'object') updateData.powerUps = req.body.powerUps;

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
