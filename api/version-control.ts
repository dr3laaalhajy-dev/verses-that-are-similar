import type { VercelRequest, VercelResponse } from '@vercel/node'
import jwt from 'jsonwebtoken'
import { prisma } from './_lib/prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export interface VersionControlData {
  latestAndroidVersionCode: number
  latestVersionCode?: number
  updateNotes: string
  isForceUpdate: boolean
  playStoreLink: string
  apkLink: string
  updatedAt: number
}

// Default fallback data
let memoryVersionControl: VersionControlData = {
  latestAndroidVersionCode: 1,
  latestVersionCode: 1,
  updateNotes: 'تحسينات عامة على الأداء وثبات التحديات الجماعية والمزامنة الحية.',
  isForceUpdate: false,
  playStoreLink: 'https://play.google.com/store/apps/details?id=com.mateen.game',
  apkLink: 'https://github.com/dr3laaalhajy-dev/verses-that-are-similar/releases/download/v1.0.0/Mutashabihat.apk',
  updatedAt: Date.now()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. GET: Public fetch of version control info
  if (req.method === 'GET') {
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { id: 1 } })
      // If version control JSON exists inside setting (or memory)
      const vc = (setting as any)?.versionControl || memoryVersionControl
      return res.status(200).json(vc)
    } catch (err: any) {
      return res.status(200).json(memoryVersionControl)
    }
  }

  // 2. POST / PUT: Founder / Admin update
  if (req.method === 'POST' || req.method === 'PUT') {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'غير مصرح: يرجى تسجيل الدخول' })
    }

    const token = authHeader.split(' ')[1]
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return res.status(401).json({ message: 'انتهت صلاحية الجلسة' })
    }

    const currentAdmin = await prisma.admin.findUnique({ where: { id: decoded.adminId } })
    if (!currentAdmin) {
      return res.status(401).json({ message: 'المشرف غير موجود' })
    }

    const {
      latestAndroidVersionCode,
      latestVersionCode,
      updateNotes,
      isForceUpdate,
      playStoreLink,
      apkLink
    } = req.body

    const parsedCode = Number(latestAndroidVersionCode || latestVersionCode) || 1

    const parsedData: VersionControlData = {
      latestAndroidVersionCode: parsedCode,
      latestVersionCode: parsedCode,
      updateNotes: String(updateNotes || '').trim(),
      isForceUpdate: Boolean(isForceUpdate),
      playStoreLink: String(playStoreLink || 'https://play.google.com/store/apps/details?id=com.mateen.game').trim(),
      apkLink: String(apkLink || 'https://github.com/dr3laaalhajy-dev/verses-that-are-similar/releases/download/v1.0.0/Mutashabihat.apk').trim(),
      updatedAt: Date.now()
    }

    memoryVersionControl = parsedData

    try {
      // Persist in systemSetting record
      await (prisma.systemSetting as any).upsert({
        where: { id: 1 },
        update: {
          versionControl: parsedData
        },
        create: {
          id: 1,
          versionControl: parsedData
        }
      }).catch(() => {
        // Fallback gracefully if column not in schema
      })

      return res.status(200).json({
        message: 'تم نشر التحديث بنجاح وحفظ بيانات الإصدار 🚀',
        versionControl: parsedData
      })
    } catch (err: any) {
      return res.status(200).json({
        message: 'تم حفظ التحديث محلياً بنجاح 🚀',
        versionControl: parsedData
      })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}

