import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../src/lib/prisma'
import bcrypt from 'bcryptjs'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { username, password, code } = req.body

  if (!username || !password || !code) {
    return res.status(400).json({ message: 'جميع الحقول مطلوبة (اسم المستخدم، كلمة المرور، والكود)' })
  }

  try {
    // 1. Verify code
    const adminCode = await prisma.adminCode.findUnique({
      where: { code: code.toUpperCase() }
    })

    if (!adminCode) {
      return res.status(400).json({ message: 'كود التسجيل غير صحيح' })
    }

    if (adminCode.isUsed) {
      return res.status(400).json({ message: 'هذا الكود تم استخدامه مسبقاً' })
    }

    // 2. Check if username taken
    const existing = await prisma.admin.findUnique({
      where: { username }
    })

    if (existing) {
      return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' })
    }

    // 3. Create admin
    const hashedPassword = await bcrypt.hash(password, 10)
    const admin = await prisma.admin.create({
      data: { 
        username, 
        password: hashedPassword,
        isSuperAdmin: adminCode.role === 'SUPERADMIN'
      }
    })

    // 4. Mark code as used
    await prisma.adminCode.update({
      where: { id: adminCode.id },
      data: { isUsed: true }
    })

    return res.status(201).json({ 
      message: 'تم التسجيل بنجاح! يمكنك الآن تسجيل الدخول.',
      username: admin.username 
    })
  } catch (error: any) {
    console.error('Registration Error:', error)
    return res.status(500).json({ message: 'حدث خطأ أثناء التسجيل' })
  }
}
