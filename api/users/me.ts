import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma.js';
import { handleCors } from '../_lib/cors.js';
import { getOrGenerateUniquePlayerId } from '../_lib/uniquePlayerId.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id, playerId, username, name, uniquePlayerId } = req.query;
  const targetId = Number(id || playerId);
  const cleanU = String(username || '').trim().replace(/^@+/, '');
  const cleanN = String(name || '').trim();
  const cleanUnique = String(uniquePlayerId || '').trim().toUpperCase();

  if (!targetId && !cleanU && !cleanN && !cleanUnique) {
    return res.status(400).json({ error: 'Missing user identifier' });
  }

  try {
    const player = await prisma.player.findFirst({
      where: {
        OR: [
          ...(Number.isInteger(targetId) && targetId > 0 ? [{ id: targetId }] : []),
          ...(cleanUnique ? [{ uniquePlayerId: cleanUnique }] : []),
          ...(cleanU ? [{ username: cleanU }, { username: '@' + cleanU }] : []),
          ...(cleanN ? [{ name: { equals: cleanN, mode: 'insensitive' as const } }] : [])
        ]
      },
      select: {
        id: true,
        name: true,
        username: true,
        uniquePlayerId: true,
        points: true,
        cups: true,
        streak: true,
        isBlocked: true,
        activeFrame: true,
        equippedNameColor: true,
        seerahCompleted: true,
        generalCompleted: true,
        quranCompleted: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!player) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!player.uniquePlayerId) {
      try {
        const uid = await getOrGenerateUniquePlayerId(player.id);
        player.uniquePlayerId = uid;
      } catch (e) {
        console.error('Failed to generate uniquePlayerId:', e);
      }
    }

    return res.status(200).json({
      success: true,
      user: player,
      player
    });
  } catch (err: any) {
    console.error('Error in /api/users/me:', err);
    return res.status(500).json({ error: 'Failed to fetch user', message: err.message });
  }
}

