import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../src/lib/prisma'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { deviceId, points, cups } = req.body

  if (!deviceId) {
    return res.status(400).json({ message: 'Missing deviceId' })
  }

  try {
    const player = await prisma.player.update({
      where: { deviceId },
      data: {
        points: points || 0,
        cups: cups || 0
      }
    })

    return res.status(200).json(player)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
