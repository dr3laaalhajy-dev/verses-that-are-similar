import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../src/lib/prisma'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Authorization check (Admin only)
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET)
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' })
  }

  // Superadmin check
  if (!decoded.isSuperAdmin) {
    return res.status(403).json({ message: 'هذا الإجراء مسموح للمشرفين الرئيسيين فقط' })
  }

  // GET: List all codes
  if (req.method === 'GET') {
    try {
      const codes = await prisma.adminCode.findMany({
        orderBy: { createdAt: 'desc' }
      })
      return res.status(200).json(codes)
    } catch (error: any) {
      console.error('List Codes Error:', error)
      return res.status(500).json({ message: 'Failed to list invitation codes' })
    }
  }

  // POST: Generate new code
  if (req.method === 'POST') {
    const { role } = req.body
    const targetRole = role === 'SUPERADMIN' ? 'SUPERADMIN' : 'ADMIN'

    try {
      // Generate a short readable code (e.g., 8 characters)
      const code = uuidv4().substring(0, 8).toUpperCase()
      const newCode = await prisma.adminCode.create({
        data: { code, role: targetRole }
      })
      return res.status(201).json(newCode)
    } catch (error: any) {
      console.error('Generate Code Error:', error)
      return res.status(500).json({ message: 'Failed to generate invitation code' })
    }
  }

  // DELETE: Remove a code
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ message: 'Code ID required' })

    try {
      await prisma.adminCode.delete({
        where: { id: parseInt(id as string) }
      })
      return res.status(200).json({ message: 'Code deleted successfully' })
    } catch (error: any) {
      console.error('Delete Code Error:', error)
      return res.status(500).json({ message: 'Failed to delete invitation code' })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
