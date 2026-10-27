import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    // STRICT PERMISSION: Only Founder Alaa (ID: 5)
    const isAlaaFounder = currentAdmin.id === 5 || 
      (currentAdmin.role === 'FOUNDER' && (currentAdmin.username.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء'))

    if (!isAlaaFounder) {
      return res.status(403).json({ message: 'خاص بالمؤسس: فقط المؤسس علاء (ID: 5) يملك صلاحية التحكم في ظهور التحديات' })
    }

    const { hideAudioChallenge, hideCompletionChallenge, hideSurahChallenge, hideIslamicVideos } = req.body

    try {
      const updated = await prisma.systemSetting.upsert({
        where: { id: 1 },
        update: {
          ...(typeof hideAudioChallenge === 'boolean' ? { hideAudioChallenge } : {}),
          ...(typeof hideCompletionChallenge === 'boolean' ? { hideCompletionChallenge } : {}),
          ...(typeof hideSurahChallenge === 'boolean' ? { hideSurahChallenge } : {}),
          ...(typeof hideIslamicVideos === 'boolean' ? { hideIslamicVideos } : {})
        },
        create: {
          id: 1,
          hideAudioChallenge: !!hideAudioChallenge,
          hideCompletionChallenge: !!hideCompletionChallenge,
          hideSurahChallenge: !!hideSurahChallenge,
          hideIslamicVideos: !!hideIslamicVideos
        }
      })

      return res.status(200).json({
        message: 'تم تحديث إعدادات ظهور التحديات بنجاح',
        settings: {
          hideAudioChallenge: updated.hideAudioChallenge,
          hideCompletionChallenge: updated.hideCompletionChallenge,
          hideSurahChallenge: updated.hideSurahChallenge,
          hideIslamicVideos: updated.hideIslamicVideos
        }
      })
    } catch (error: any) {
      console.error('Update Settings Error:', error)
      return res.status(500).json({ message: 'حدث خطأ أثناء حفظ الإعدادات', error: error.message })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
