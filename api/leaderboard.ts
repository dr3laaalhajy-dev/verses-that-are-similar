import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const players: any[] = await prisma.player.findMany({
      orderBy: [
        { cups: 'desc' },
        { points: 'desc' }
      ],
      select: {
        deviceId: true,
        name: true,
        username: true,
        points: true,
        cups: true,
        seerahCompleted: true,
        generalCompleted: true,
        quranCompleted: true,
        activeFrame: true
      } as any
    })

    // Deduplicate and merge by normalized player name so no achievements or cups are lost
    const playerMap = new Map<string, any>()

    for (const player of players) {
      const normalized = (player.name || '').trim().toLowerCase()
      if (!normalized) continue

      if (!playerMap.has(normalized)) {
        playerMap.set(normalized, { ...player })
      } else {
        const existing = playerMap.get(normalized)
        existing.cups = Math.max(existing.cups || 0, player.cups || 0)
        existing.points = Math.max(existing.points || 0, player.points || 0)
        existing.seerahCompleted = existing.seerahCompleted || player.seerahCompleted
        existing.generalCompleted = existing.generalCompleted || player.generalCompleted
        if (player.deviceId && !existing.deviceId) {
          existing.deviceId = player.deviceId
        }
        if (player.activeFrame) {
          existing.activeFrame = player.activeFrame
        }
        if (!existing.username && player.username) {
          existing.username = player.username
        }
      }
    }

    const uniqueLeaderboard = Array.from(playerMap.values())
      .sort((a, b) => (b.cups - a.cups) || (b.points - a.points))
      .slice(0, 10)

    return res.status(200).json({ leaderboard: uniqueLeaderboard })
  } catch (error: any) {
    console.error('Leaderboard Error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      code: error.code
    })
  }
}
