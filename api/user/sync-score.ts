import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../src/lib/prisma'
import { authenticate } from '../auth-helper'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const userId = authenticate(req)
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const { totalPoints, cups } = req.body

  if (totalPoints === undefined || cups === undefined) {
    return res.status(400).json({ message: 'Missing fields' })
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        totalPoints: Number(totalPoints),
        cups: Number(cups),
      },
    })

    return res.status(200).json({
      message: 'Score synced successfully',
      user: {
        totalPoints: user.totalPoints,
        cups: user.cups,
      },
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
