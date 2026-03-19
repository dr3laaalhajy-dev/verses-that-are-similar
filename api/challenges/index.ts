import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../src/lib/prisma'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Public GET
  if (req.method === 'GET') {
    try {
      const challenges = await prisma.challenge.findMany({
        orderBy: { createdAt: 'desc' }
      })
      return res.status(200).json(challenges)
    } catch (error: any) {
      console.error('Fetch Challenges Error:', error)
      return res.status(500).json({ 
        message: 'Failed to fetch challenges',
        error: error.message 
      })
    }
  }

  // Protected POST (Admin only)
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1]
    try {
      jwt.verify(token, JWT_SECRET) // Simply verify if it's a valid admin token
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const { keyword, verses } = req.body
    if (!keyword || !verses) {
      return res.status(400).json({ message: 'Missing fields' })
    }

    try {
      // Check if keyword already exists
      const existing = await prisma.challenge.findUnique({
        where: { keyword }
      })
      if (existing) {
        return res.status(409).json({ message: 'هذه الكلمة المفتاحية موجودة مسبقاً في تحدي آخر' })
      }

      const challenge = await prisma.challenge.create({
        data: { keyword, verses }
      })
      return res.status(201).json(challenge)
    } catch (error: any) {
      console.error('Create Challenge Error:', error)
      return res.status(500).json({ 
        message: 'Failed to create challenge',
        error: error.message 
      })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
