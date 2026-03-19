import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../src/lib/prisma'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  if (!id) return res.status(400).json({ message: 'Missing ID' })

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]
  try {
    jwt.verify(token, JWT_SECRET)
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' })
  }

  // Protected PUT
  if (req.method === 'PUT') {
    const { keyword, verses } = req.body
    try {
      const challenge = await prisma.challenge.update({
        where: { id: Number(id) },
        data: { keyword, verses }
      })
      return res.status(200).json(challenge)
    } catch (error: any) {
      console.error('Update Challenge Error:', error)
      return res.status(500).json({ 
        message: 'Failed to update challenge',
        error: error.message 
      })
    }
  }

  // Protected DELETE
  if (req.method === 'DELETE') {
    try {
      await prisma.challenge.delete({
        where: { id: Number(id) }
      })
      return res.status(204).end()
    } catch (error: any) {
      console.error('Delete Challenge Error:', error)
      return res.status(500).json({ 
        message: 'Failed to delete challenge',
        error: error.message 
      })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
