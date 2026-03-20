import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة' })
  }

  try {
    console.log('Login attempt for:', username)
    let admin = await prisma.admin.findUnique({
      where: { username }
    })

    // SEEDING
    const adminCount = await prisma.admin.count()
    console.log('Current admin count:', adminCount)
    if (adminCount === 0) {
      console.log('No admins found. Creating first admin...')
      const hashedPassword = await bcrypt.hash(password, 10)
      admin = await prisma.admin.create({
        data: { username, password: hashedPassword, isSuperAdmin: true } as any
      }) as any
    }

    if (!admin) {
      console.log('Admin not found:', username)
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' })
    }

    console.log('Admin found, comparing passwords...')
    const isMatch = await bcrypt.compare(password, admin.password)
    console.log('Password match:', isMatch)

    if (!isMatch) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' })
    }

    const adminData = admin as any;
    const token = jwt.sign(
      { adminId: adminData.id, isSuperAdmin: adminData.isSuperAdmin },
      JWT_SECRET,
      { expiresIn: '1d' }
    )
    return res.status(200).json({
      token,
      username: adminData.username,
      isSuperAdmin: adminData.isSuperAdmin
    })
  } catch (error: any) {
    console.error('Admin Login Error:', error)
    // Return detailed error only in development, otherwise generic message
    return res.status(500).json({
      message: 'حدث خطأ في الخادم أثناء تسجيل الدخول',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
