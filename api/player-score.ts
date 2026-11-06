import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { handleCors } from './_lib/cors.js'
import { getOrGenerateUniquePlayerId } from './_lib/uniquePlayerId.js'
import { compareLeaderboardUsers, LeaderboardUser } from './_lib/ranking.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  // Handle GET request to retrieve player stats or full leaderboard
  if (req.method === 'GET') {
    const { action, leaderboard, playerId, username, name, uniquePlayerId } = req.query;

    // 1. Leaderboard handler consolidated from /api/leaderboard
    if (action === 'leaderboard' || leaderboard !== undefined) {
      try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const players: any[] = await prisma.player.findMany({
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            username: true,
            uniquePlayerId: true,
            points: true,
            cups: true,
            streak: true,
            seerahCompleted: true,
            generalCompleted: true,
            quranCompleted: true,
            activeFrame: true,
            equippedNameColor: true
          } as any
        });

        const playerMap = new Map<string, LeaderboardUser>();

        for (const player of players) {
          const normalized = (player.name || '').trim().toLowerCase();
          if (!normalized) continue;

          const pPoints = player.points || 0;
          const pCups = player.cups || 0;
          const pStreak = player.streak || 0;

          if (!playerMap.has(normalized)) {
            playerMap.set(normalized, {
              id: player.id,
              name: player.name,
              username: player.username,
              uniquePlayerId: player.uniquePlayerId,
              totalPoints: pPoints,
              trophiesCount: pCups,
              streakCount: pStreak,
              points: pPoints,
              cups: pCups,
              streak: pStreak,
              seerahCompleted: player.seerahCompleted,
              generalCompleted: player.generalCompleted,
              quranCompleted: player.quranCompleted,
              activeFrame: (player.activeFrame === 'seerah' || player.activeFrame === 'general') ? player.activeFrame : null,
              equippedNameColor: player.equippedNameColor
            });
          } else {
            const existing = playerMap.get(normalized)!;
            if (!existing.uniquePlayerId && player.uniquePlayerId) {
              existing.uniquePlayerId = player.uniquePlayerId;
            }
            if (!existing.id && player.id) {
              existing.id = player.id;
            }
            existing.seerahCompleted = existing.seerahCompleted || player.seerahCompleted;
            existing.generalCompleted = existing.generalCompleted || player.generalCompleted;
            if (!existing.activeFrame && (player.activeFrame === 'seerah' || player.activeFrame === 'general')) {
              existing.activeFrame = player.activeFrame;
            }
            if (!existing.equippedNameColor && player.equippedNameColor) {
              existing.equippedNameColor = player.equippedNameColor;
            }
            if (!existing.username && player.username) {
              existing.username = player.username;
            }
          }
        }

        const allSorted = Array.from(playerMap.values()).sort(compareLeaderboardUsers);
        const totalUsers = allSorted.length;

        let userRank: number | null = null;
        if (name || username) {
          const qUser = typeof username === 'string' ? username.replace(/^@+/, '').trim().toLowerCase() : '';
          const qName = typeof name === 'string' ? name.trim().toLowerCase() : '';

          const idx = allSorted.findIndex((p: any) => {
            if (qUser && p.username && p.username.replace(/^@+/, '').trim().toLowerCase() === qUser) return true;
            if (qName && p.name && p.name.trim().toLowerCase() === qName) return true;
            return false;
          });

          if (idx !== -1) {
            userRank = idx + 1;
          }
        }

        const uniqueLeaderboard = allSorted.slice(0, 10);

        return res.status(200).json({
          leaderboard: uniqueLeaderboard,
          totalUsers,
          userRank
        });
      } catch (error: any) {
        console.error('Leaderboard Error in /api/player-score:', error);
        return res.status(500).json({ 
          message: 'Internal server error',
          error: error.message,
          code: error.code
        });
      }
    }

    const cleanU = String(username || '').trim().replace(/^@+/, '');
    const cleanN = String(name || '').trim();
    const cleanUnique = String(uniquePlayerId || '').trim().toUpperCase();
    const numId = Number(playerId);

    try {
      let player = await prisma.player.findFirst({
        where: {
          OR: [
            ...(cleanUnique ? [{ uniquePlayerId: cleanUnique }] : []),
            ...(cleanU ? [{ username: cleanU }, { username: '@' + cleanU }] : []),
            ...(cleanN ? [{ name: { equals: cleanN, mode: 'insensitive' as const } }] : []),
            ...(Number.isInteger(numId) && numId > 0 ? [{ id: numId }] : [])
          ] as any
        }
      });

      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }

      if (!player.uniquePlayerId) {
        try {
          const uid = await getOrGenerateUniquePlayerId(player.id);
          player.uniquePlayerId = uid;
        } catch (e) {
          console.error('Failed to set uniquePlayerId for player:', e);
        }
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

    // 1. Points handling: strictly 1 point per correct answer, never multiplied by 10
    const addedPoints = Number(points || 0);
    const explicitTotalPoints = req.body.totalPoints !== undefined ? Number(req.body.totalPoints) : null;
    const clientScore = req.body.score !== undefined ? Number(req.body.score) : null;
    const currentPts = Number(player.points || 0);

    if (addedPoints > 0) {
      // Direct 1-to-1 point increment (strictly 1 point per correct answer)
      const pointsToAward = Math.max(1, Math.min(addedPoints, 5));
      const nextTotal = explicitTotalPoints !== null && !isNaN(explicitTotalPoints)
        ? Math.max(currentPts + pointsToAward, explicitTotalPoints)
        : currentPts + pointsToAward;
      updateData.points = nextTotal;
    } else if (explicitTotalPoints !== null && !isNaN(explicitTotalPoints)) {
      updateData.points = Math.max(currentPts, explicitTotalPoints);
    } else if (clientScore !== null && !isNaN(clientScore)) {
      updateData.points = Math.max(currentPts, clientScore);
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
      updateData.cups = explicitTotalCups;
    }

    // 3. Streak handling:
    const explicitStreak = req.body.streakCount !== undefined ? Number(req.body.streakCount) : (req.body.streak !== undefined ? Number(req.body.streak) : null);
    if (explicitStreak !== null && !isNaN(explicitStreak)) {
      updateData.streak = explicitStreak;
    }

    if (seerahCompleted !== undefined) updateData.seerahCompleted = Boolean(seerahCompleted);
    if (generalCompleted !== undefined) updateData.generalCompleted = Boolean(generalCompleted);
    if (quranCompleted !== undefined) updateData.quranCompleted = Boolean(quranCompleted);
    if (activeFrame !== undefined) updateData.activeFrame = (activeFrame && activeFrame !== 'none' && activeFrame !== '') ? String(activeFrame) : null;
    if (req.body.equippedNameColor !== undefined) updateData.equippedNameColor = req.body.equippedNameColor ? String(req.body.equippedNameColor) : null;
    if (req.body.ownedCosmetics !== undefined && Array.isArray(req.body.ownedCosmetics)) updateData.ownedCosmetics = req.body.ownedCosmetics;
    if (req.body.powerUps !== undefined && typeof req.body.powerUps === 'object') updateData.powerUps = req.body.powerUps;

    if (Object.keys(updateData).length > 0) {
      const { data: updatedPlayer, error: updateErr } = await supabaseAdmin
        .from('players')
        .update(updateData)
        .eq('id', player.id)
        .select()
        .single();

      if (updateErr) {
        console.warn('Supabase update player score fallback to Prisma:', updateErr.message);
        const fallbackPlayer = await prisma.player.update({
          where: { id: player.id },
          data: updateData
        });
        return res.status(200).json(fallbackPlayer);
      }
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
