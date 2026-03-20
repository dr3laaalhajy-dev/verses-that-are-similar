import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { player1Id } = req.body

  if (!player1Id) {
    return res.status(400).json({ message: 'Missing player1Id' })
  }

  try {
    // Generate a unique 6-character code
    let code = ''
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let isUnique = false
    while (!isUnique) {
      code = ''
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      const existing = await prisma.room.findUnique({ where: { code } })
      if (!existing) isUnique = true
    }

    // Resolve deviceId to Player.id
    const player1 = await prisma.player.findUnique({
        where: { deviceId: player1Id }
    })
    if (!player1) {
        return res.status(404).json({ message: 'Player not found' })
    }

    // Fetch 5 random challenges
    const allChallenges = await prisma.challenge.findMany()
    
    // Shuffle and pick 5
    const shuffled = allChallenges.sort(() => 0.5 - Math.random())
    const selectedChallenges = shuffled.slice(0, 5)
    const selectedIds = selectedChallenges.map(c => c.id)

    if (selectedIds.length === 0) {
      return res.status(400).json({ message: 'No challenges available to create a game' })
    }

    const roomData = await prisma.room.create({
      data: {
        code,
        player1Id: player1.id,
        challengeIds: selectedIds,
        status: 'WAITING'
      },
      include: {
        player1: true
      }
    })

    const room = {
        ...roomData,
        challenges: selectedChallenges
    }

    return res.status(201).json(room)
  } catch (error: any) {
    console.error('Create Room Error:', error)
    return res.status(500).json({ 
      message: 'Failed to create room',
      error: error.message 
    })
  }
}
