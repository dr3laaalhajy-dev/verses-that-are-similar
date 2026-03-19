import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../src/lib/prisma'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { deviceId, name } = req.body

  if (!deviceId || !name) {
    return res.status(400).json({ message: 'Missing deviceId or name' })
  }

  try {
    const player = await prisma.player.upsert({
      where: { deviceId },
      update: { name },
      create: { deviceId, name }
    })

    return res.status(200).json(player)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
