import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../src/lib/prisma'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const players = await prisma.player.findMany({
      take: 10,
      orderBy: [
        { cups: 'desc' },
        { points: 'desc' }
      ],
      select: {
        name: true,
        points: true,
        cups: true
      }
    })

    return res.status(200).json({ leaderboard: players })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
