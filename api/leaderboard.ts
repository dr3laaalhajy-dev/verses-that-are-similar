import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'
import { compareLeaderboardUsers, LeaderboardUser } from './_lib/ranking.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const players: any[] = await prisma.player.findMany({
      select: {
        name: true,
        username: true,
        points: true,
        cups: true,
        streak: true,
        seerahCompleted: true,
        generalCompleted: true,
        quranCompleted: true,
        activeFrame: true,
        equippedTitle: true,
        equippedNameColor: true
      } as any
    })

    // Deduplicate and merge by normalized player name so no achievements, cups, or streaks are lost
    const playerMap = new Map<string, LeaderboardUser>()

    for (const player of players) {
      const normalized = (player.name || '').trim().toLowerCase()
      if (!normalized) continue

      const pPoints = player.points || 0
      const pCups = player.cups || 0
      const pStreak = player.streak || 0

      if (!playerMap.has(normalized)) {
        playerMap.set(normalized, {
          name: player.name,
          username: player.username,
          totalPoints: pPoints,
          trophiesCount: pCups,
          streakCount: pStreak,
          points: pPoints,
          cups: pCups,
          streak: pStreak,
          seerahCompleted: player.seerahCompleted,
          generalCompleted: player.generalCompleted,
          quranCompleted: player.quranCompleted,
          activeFrame: player.activeFrame,
          equippedTitle: player.equippedTitle,
          equippedNameColor: player.equippedNameColor
        })
      } else {
        const existing = playerMap.get(normalized)!
        existing.totalPoints = Math.max(existing.totalPoints || 0, pPoints)
        existing.points = existing.totalPoints
        existing.trophiesCount = Math.max(existing.trophiesCount || 0, pCups)
        existing.cups = existing.trophiesCount
        existing.streakCount = Math.max(existing.streakCount || 0, pStreak)
        existing.streak = existing.streakCount
        existing.seerahCompleted = existing.seerahCompleted || player.seerahCompleted
        existing.generalCompleted = existing.generalCompleted || player.generalCompleted
        if (player.activeFrame) {
          existing.activeFrame = player.activeFrame
        }
        if (player.equippedTitle) {
          existing.equippedTitle = player.equippedTitle
        }
        if (player.equippedNameColor) {
          existing.equippedNameColor = player.equippedNameColor
        }
        if (!existing.username && player.username) {
          existing.username = player.username
        }
      }
    }

    // Sort using the Hidden Weighted Ranking Algorithm and Tie-Breakers
    const allSorted = Array.from(playerMap.values()).sort(compareLeaderboardUsers)

    const totalUsers = allSorted.length

    // Calculate current user's rank across all users
    const { name, username } = req.query
    let userRank: number | null = null

    if (name || username) {
      const qUser = typeof username === 'string' ? username.replace(/^@+/, '').trim().toLowerCase() : ''
      const qName = typeof name === 'string' ? name.trim().toLowerCase() : ''

      const idx = allSorted.findIndex((p: any) => {
        if (qUser && p.username && p.username.replace(/^@+/, '').trim().toLowerCase() === qUser) return true
        if (qName && p.name && p.name.trim().toLowerCase() === qName) return true
        return false
      })

      if (idx !== -1) {
        userRank = idx + 1
      }
    }

    const uniqueLeaderboard = allSorted.slice(0, 10)

    return res.status(200).json({
      leaderboard: uniqueLeaderboard,
      totalUsers,
      userRank
    })
  } catch (error: any) {
    console.error('Leaderboard Error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      code: error.code
    })
  }
}
