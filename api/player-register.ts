import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { deviceId, name } = req.body
  console.log('Registration attempt:', { deviceId, name })

  if (!deviceId || !name) {
    return res.status(400).json({ 
      message: 'Missing deviceId or name',
      received: { deviceId: !!deviceId, name: !!name, body: req.body }
    })
  }

  try {
    console.log('Database operation starting for:', deviceId);
    const start = Date.now();
    const player = await prisma.player.upsert({
      where: { deviceId },
      update: { name },
      create: { deviceId, name }
    });
    console.log('Database operation successful in', Date.now() - start, 'ms');

    return res.status(200).json(player)
  } catch (error: any) {
    console.error('Registration Database Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      deviceId
    });
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      code: error.code
    })
  }
}
