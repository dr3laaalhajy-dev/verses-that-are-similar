import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'
import jwt from 'jsonwebtoken'
import testersHandler from './_lib/testersHandler.js'
import versionControlHandler from './_lib/versionControlHandler.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const target = req.query.target as string | undefined;

  if (target === 'testers') {
    return testersHandler(req, res);
  }

  if (target === 'version-control') {
    return versionControlHandler(req, res);
  }

  // Public GET: Anyone (players / visitors) can fetch system settings
  if (req.method === 'GET') {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { id: 1 }
      })

      return res.status(200).json({
        hideAudioChallenge: setting?.hideAudioChallenge ?? false,
        hideCompletionChallenge: setting?.hideCompletionChallenge ?? false,
        hideSurahChallenge: setting?.hideSurahChallenge ?? false,
        hideIslamicVideos: setting?.hideIslamicVideos ?? false,
        updatedAt: setting?.updatedAt ?? null
      })
    } catch (error: any) {
      console.error('Fetch Settings Error:', error)
      return res.status(200).json({
        hideAudioChallenge: false,
        hideCompletionChallenge: false,
        hideSurahChallenge: false,
        hideIslamicVideos: false
      })
    }
  }

  // Protected POST / PUT / PATCH: ONLY Founder Alaa (ID: 5) can update settings
  if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'غير مصرح: يجب تسجيل الدخول كمؤسس' })
    }

    const token = authHeader.split(' ')[1]
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return res.status(401).json({ message: 'جلسة تسجيل الدخول غير صالحة' })
    }

    const currentAdmin = await prisma.admin.findUnique({ where: { id: decoded.adminId } })
    if (!currentAdmin) {
      return res.status(401).json({ message: 'المشرف غير موجود' })
    }

    // Restriction: Founder check
    const isFounder = currentAdmin.id === 5 || currentAdmin.role === 'FOUNDER' || currentAdmin.username === 'alaa'
    if (!isFounder) {
      return res.status(403).json({ message: 'فقط المؤسس علاء يملك صلاحية تعديل الإعدادات العامة' })
    }

    const {
      hideAudioChallenge,
      hideCompletionChallenge,
      hideSurahChallenge,
      hideIslamicVideos
    } = req.body || {}

    try {
      const updated = await prisma.systemSetting.upsert({
        where: { id: 1 },
        update: {
          hideAudioChallenge: hideAudioChallenge !== undefined ? Boolean(hideAudioChallenge) : undefined,
          hideCompletionChallenge: hideCompletionChallenge !== undefined ? Boolean(hideCompletionChallenge) : undefined,
          hideSurahChallenge: hideSurahChallenge !== undefined ? Boolean(hideSurahChallenge) : undefined,
          hideIslamicVideos: hideIslamicVideos !== undefined ? Boolean(hideIslamicVideos) : undefined
        },
        create: {
          id: 1,
          hideAudioChallenge: Boolean(hideAudioChallenge),
          hideCompletionChallenge: Boolean(hideCompletionChallenge),
          hideSurahChallenge: Boolean(hideSurahChallenge),
          hideIslamicVideos: Boolean(hideIslamicVideos)
        }
      })

      return res.status(200).json({
        success: true,
        message: 'تم تحديث الإعدادات بنجاح',
        settings: updated
      })
    } catch (error: any) {
      console.error('Update Settings Error:', error)
      return res.status(500).json({ message: 'فشل تحديث الإعدادات', error: error.message })
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' })
}
