import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../src/lib/prisma'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { credential } = req.body

  if (!credential) {
    return res.status(400).json({ message: 'Missing credential' })
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Invalid token payload' })
    }

    const { email, name, sub: googleId } = payload

    // Find user by googleId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email }
        ]
      }
    })

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          name: name || 'User',
          googleId,
          totalPoints: 0,
          cups: 0,
        },
      })
    } else if (!user.googleId) {
      // Link existing email account to Google
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      })
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        totalPoints: user.totalPoints,
        cups: user.cups,
      },
    })
  } catch (error) {
    console.error('Google Auth Error:', error)
    return res.status(500).json({ message: 'Authentication failed' })
  }
}
