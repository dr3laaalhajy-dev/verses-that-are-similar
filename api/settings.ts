import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAdminToken } from './_lib/jwt.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import testersHandler from './_lib/testersHandler.js'
import versionControlHandler from './_lib/versionControlHandler.js'
import wirdHandler from './_lib/wirdHandler.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const target = req.query.target as string | undefined;

  if (target === 'wird') {
    return wirdHandler(req, res);
  }

  if (target === 'testers') {
    return testersHandler(req, res);
  }

  if (target === 'version-control') {
    return versionControlHandler(req, res);
  }

  // Public GET: Anyone (players / visitors) can fetch system settings
  if (req.method === 'GET') {
    try {
      const { data: setting } = await supabaseAdmin
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()

      return res.status(200).json({
        hideAudioChallenge: setting?.hideAudioChallenge ?? setting?.hide_audio_challenge ?? false,
        hideCompletionChallenge: setting?.hideCompletionChallenge ?? setting?.hide_completion_challenge ?? false,
        hideSurahChallenge: setting?.hideSurahChallenge ?? setting?.hide_surah_challenge ?? false,
        hideIslamicVideos: setting?.hideIslamicVideos ?? setting?.hide_islamic_videos ?? false,
        updatedAt: setting?.updatedAt ?? setting?.updated_at ?? null
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
      decoded = verifyAdminToken(token)
    } catch (err) {
      return res.status(401).json({ message: 'جلسة تسجيل الدخول غير صالحة' })
    }

    const { data: currentAdmin } = await supabaseAdmin
      .from('admins')
      .select('id, username, role')
      .eq('id', decoded.adminId)
      .maybeSingle()

    if (!currentAdmin) {
      return res.status(401).json({ message: 'المشرف غير موجود' })
    }

    // Restriction: Founder check based strictly on database role
    const isFounder = currentAdmin.role === 'FOUNDER'
    if (!isFounder) {
      return res.status(403).json({ message: 'فقط المؤسس يملك صلاحية تعديل الإعدادات العامة' })
    }

    const {
      hideAudioChallenge,
      hideCompletionChallenge,
      hideSurahChallenge,
      hideIslamicVideos
    } = req.body || {}

    try {
      const payload: any = {
        id: 1,
        updated_at: new Date().toISOString()
      };
      if (hideAudioChallenge !== undefined) payload.hideAudioChallenge = Boolean(hideAudioChallenge);
      if (hideCompletionChallenge !== undefined) payload.hideCompletionChallenge = Boolean(hideCompletionChallenge);
      if (hideSurahChallenge !== undefined) payload.hideSurahChallenge = Boolean(hideSurahChallenge);
      if (hideIslamicVideos !== undefined) payload.hideIslamicVideos = Boolean(hideIslamicVideos);

      const { data: updated, error } = await supabaseAdmin
        .from('system_settings')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .maybeSingle()

      if (error) {
        throw error;
      }

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
