import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { handleCors } from './_lib/cors.js';
import { getOrGenerateUniquePlayerId } from './_lib/uniquePlayerId.js';
import { compareLeaderboardUsers, LeaderboardUser } from './_lib/ranking.js';
import { findPlayerRow, toSafePlayer } from './_lib/playerSecurity.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  // Handle GET request to retrieve player stats or full leaderboard
  if (req.method === 'GET') {
    const { action, leaderboard, playerId, username, name, uniquePlayerId } = req.query;

    // 1. Leaderboard handler
    if (action === 'leaderboard' || leaderboard !== undefined) {
      try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const { data: players, error } = await supabaseAdmin
          .from('players')
          .select('id, name, username, uniquePlayerId, points, cups, streak, seerahCompleted, generalCompleted, quranCompleted, activeFrame, equippedNameColor, isBlocked')
          .order('updatedAt', { ascending: false });

        if (error) throw error;

        const playerMap = new Map<string, LeaderboardUser>();

        for (const player of (players || [])) {
          if (player.isBlocked) continue;
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
          error: error.message
        });
      }
    }

    // 2. Fetch single player
    const cleanU = String(username || '').trim().replace(/^@+/, '');
    const cleanN = String(name || '').trim();
    const cleanUnique = String(uniquePlayerId || '').trim().toUpperCase();
    const numId = Number(playerId);

    try {
      if (!cleanUnique && !cleanU && !cleanN && !(Number.isInteger(numId) && numId > 0)) {
        return res.status(400).json({ message: 'Missing search parameter' });
      }

      const player = await findPlayerRow(supabaseAdmin, {
        id: numId,
        uniquePlayerId: cleanUnique,
        username: cleanU,
        name: cleanN
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

      return res.status(200).json(toSafePlayer(player));
    } catch (err: any) {
      console.error('Player Fetch Error:', err);
      return res.status(500).json({ error: 'Failed to fetch player stats', message: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { roomId, playerId, score, points, challengeId, seerahCompleted, generalCompleted, quranCompleted, activeFrame, name, username } = req.body;

  // 1. Handle Room-based Score Update
  if (roomId) {
    if (!playerId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields: roomId, playerId, or score' });
    }

    try {
      const { data: room, error: roomErr } = await supabaseAdmin
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();

      if (roomErr || !room) return res.status(404).json({ error: 'Room not found' });

      const player = await findPlayerRow(supabaseAdmin, {
        id: playerId,
        username: playerId,
        name: playerId
      });

      if (!player) return res.status(404).json({ error: 'Player not found' });

      let playersProgress = (room.playersProgress as any) || {};
      if (!playersProgress[player.id]) {
        playersProgress[player.id] = { name: player.name, joinedAt: Date.now() };
      }
      
      playersProgress[player.id].score = score;
      
      const { data: updatedRoom, error: updateRoomErr } = await supabaseAdmin
        .from('rooms')
        .update({ playersProgress })
        .eq('id', roomId)
        .select()
        .single();

      if (updateRoomErr) throw updateRoomErr;

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
    return res.status(400).json({ message: 'Missing username or name' });
  }

  try {
    const player = await findPlayerRow(supabaseAdmin, {
      id: numId,
      username: cleanU,
      name: cleanN
    });

    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    if (player.isBlocked) {
      return res.status(403).json({ error: 'تم حظر هذا الحساب من قِبل إدارة التطبيق' });
    }

    let completedIds: number[] = [];
    if (Array.isArray(player.completedChallengeIds)) {
      completedIds = player.completedChallengeIds as number[];
    }

    const updateData: any = {};

    // 1. Points handling: strictly 1 point per correct answer for quizzes, full reward for gifts/chests
    const isReward = Boolean(
      req.body.isReward ||
      req.body.source === 'mystery_gift' ||
      req.body.source === 'daily_gift' ||
      req.body.rewardPoints !== undefined ||
      req.body.action === 'reward'
    );
    const rewardPointsVal = Number(req.body.rewardPoints || 0);
    const addedPoints = Number(points || rewardPointsVal || 0);
    const explicitTotalPoints = req.body.totalPoints !== undefined ? Number(req.body.totalPoints) : null;
    const clientScore = req.body.score !== undefined ? Number(req.body.score) : null;
    const currentPts = Number(player.points || 0);

    if (addedPoints > 0) {
      const pointsToAward = isReward ? addedPoints : Math.max(1, Math.min(addedPoints, 5));
      const nextTotal = explicitTotalPoints !== null && !isNaN(explicitTotalPoints)
        ? Math.max(currentPts + pointsToAward, explicitTotalPoints)
        : currentPts + pointsToAward;
      updateData.points = nextTotal;
    } else if (explicitTotalPoints !== null && !isNaN(explicitTotalPoints)) {
      updateData.points = Math.max(currentPts, explicitTotalPoints);
    } else if (clientScore !== null && !isNaN(clientScore)) {
      updateData.points = Math.max(currentPts, clientScore);
    }

    // 2. Cups handling
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

    const currentCups = Number(player.cups || 0);
    if (addedCups > 0) {
      updateData.cups = currentCups + addedCups;
    } else if (isNewChallenge) {
      updateData.cups = currentCups + 1;
    } else if (explicitTotalCups !== null && !isNaN(explicitTotalCups)) {
      updateData.cups = explicitTotalCups;
    }

    // 3. Streak handling
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
      updateData.updatedAt = new Date().toISOString();
      const { data: updatedPlayer, error: updateErr } = await supabaseAdmin
        .from('players')
        .update(updateData)
        .eq('id', player.id)
        .select()
        .single();

      if (updateErr) {
        console.error('Supabase update player score error:', updateErr.message);
        return res.status(500).json({ error: 'Failed to update score', message: updateErr.message });
      }
      return res.status(200).json(toSafePlayer(updatedPlayer));
    }

    // If no updates needed, return current player
    return res.status(200).json(toSafePlayer(player));
  } catch (error: any) {
    console.error('Score Update Error:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message
    });
  }
}
