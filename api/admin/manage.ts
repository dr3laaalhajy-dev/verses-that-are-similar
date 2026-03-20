import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

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

  // GET: List Admins
  if (req.method === 'GET') {
    try {
      const admins = await (prisma.admin as any).findMany({
        select: { id: true, username: true, isSuperAdmin: true }
      })
      return res.status(200).json(admins)
    } catch (error: any) {
      console.error('List Admins Error:', error)
      return res.status(500).json({ message: 'Failed to list admins' })
    }
  }

  // POST: Create Admin
  if (req.method === 'POST') {
    const { username, password, isSuperAdmin } = req.body
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' })
    }

    try {
      const existing = await prisma.admin.findUnique({ where: { username } })
      if (existing) {
        return res.status(409).json({ message: 'Username already exists' })
      }

      const hashedPassword = await bcrypt.hash(password, 10)
      const admin = await (prisma.admin as any).create({
        data: { 
          username, 
          password: hashedPassword,
          isSuperAdmin: !!isSuperAdmin
        }
      })

      return res.status(201).json({ id: admin.id, username: admin.username, isSuperAdmin: admin.isSuperAdmin })
    } catch (error: any) {
      console.error('Create Admin Error:', error)
      return res.status(500).json({ message: 'Failed to create admin' })
    }
  }

  // DELETE: Remove Admin
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ message: 'Admin ID required' })

    const adminId = parseInt(id as string)

    try {
      // Prevent deleting self (optional, let's just allow it for now but maybe warn in UI)
      await prisma.admin.delete({ where: { id: adminId } })
      return res.status(200).json({ message: 'Admin deleted successfully' })
    } catch (error: any) {
      console.error('Delete Admin Error:', error)
      return res.status(500).json({ message: 'Failed to delete admin' })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
