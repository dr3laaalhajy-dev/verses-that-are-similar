import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.method === 'GET' || req.method === 'DELETE' ? req.query : req.body

  // Actions that DON'T require auth
  if (req.method === 'POST' && action === 'login') {
    return handleLogin(req, res)
  }
  if (req.method === 'POST' && action === 'register') {
    return handleRegister(req, res)
  }

  // Authorization check for all other actions
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

  // Superadmin check for invite/manage
  if (action === 'invite' || action === 'manage') {
    if (!decoded.isSuperAdmin) {
      return res.status(403).json({ message: 'هذا الإجراء مسموح للمشرفين الرئيسيين فقط' })
    }
  }

  switch (action) {
    case 'invite':
      return handleInvite(req, res)
    case 'manage':
      return handleManage(req, res)
    default:
      return res.status(400).json({ message: 'Invalid action' })
  }
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة' })

  try {
    let admin = await prisma.admin.findUnique({ where: { username } })
    const adminCount = await prisma.admin.count()
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash(password, 10)
      admin = await prisma.admin.create({
        data: { username, password: hashedPassword, isSuperAdmin: true }
      })
    }

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' })
    }

    const token = jwt.sign({ adminId: admin.id, isSuperAdmin: admin.isSuperAdmin }, JWT_SECRET, { expiresIn: '1d' })
    return res.status(200).json({ token, username: admin.username, isSuperAdmin: admin.isSuperAdmin })
  } catch (error) {
    return res.status(500).json({ message: 'حدث خطأ في تسجيل الدخول' })
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  const { username, password, code } = req.body
  if (!username || !password || !code) return res.status(400).json({ message: 'جميع الحقول مطلوبة' })

  try {
    const adminCode = await prisma.adminCode.findUnique({ where: { code: code.toUpperCase() } })
    if (!adminCode || adminCode.isUsed) return res.status(400).json({ message: 'كود التسجيل غير صحيح أو مستخدم' })

    const existing = await prisma.admin.findUnique({ where: { username } })
    if (existing) return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' })

    const hashedPassword = await bcrypt.hash(password, 10)
    const admin = await prisma.admin.create({
      data: { username, password: hashedPassword, isSuperAdmin: adminCode.role === 'SUPERADMIN' }
    })
    await prisma.adminCode.update({ where: { id: adminCode.id }, data: { isUsed: true } })

    return res.status(201).json({ message: 'تم التسجيل بنجاح!', username: admin.username })
  } catch (error) {
    return res.status(500).json({ message: 'حدث خطأ أثناء التسجيل' })
  }
}

async function handleInvite(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const codes = await prisma.adminCode.findMany({ orderBy: { createdAt: 'desc' } })
    return res.status(200).json(codes)
  }
  if (req.method === 'POST') {
    const { role } = req.body
    const code = uuidv4().substring(0, 8).toUpperCase()
    const newCode = await prisma.adminCode.create({ data: { code, role: role === 'SUPERADMIN' ? 'SUPERADMIN' : 'ADMIN' }})
    return res.status(201).json(newCode)
  }
  if (req.method === 'DELETE') {
    const { id } = req.query
    await prisma.adminCode.delete({ where: { id: parseInt(id as string) } })
    return res.status(200).json({ message: 'Deleted' })
  }
}

async function handleManage(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const admins = await prisma.admin.findMany({ select: { id: true, username: true, isSuperAdmin: true } })
    return res.status(200).json(admins)
  }
  if (req.method === 'POST') {
    const { username, password, isSuperAdmin } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)
    const admin = await prisma.admin.create({ data: { username, password: hashedPassword, isSuperAdmin: !!isSuperAdmin } })
    return res.status(201).json(admin)
  }
  if (req.method === 'DELETE') {
    const { id } = req.query
    await prisma.admin.delete({ where: { id: parseInt(id as string) } })
    return res.status(200).json({ message: 'Deleted' })
  }
}
