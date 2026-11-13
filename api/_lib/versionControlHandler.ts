import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAdminToken } from './jwt.js'
import { supabaseAdmin } from './supabaseAdmin.js'

export interface VersionControlData {
  latestAndroidVersionCode: number
  latestVersionCode?: number
  updateNotes: string
  isForceUpdate: boolean
  isUpdateActive: boolean
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
  isUpdateActive: true,
  playStoreLink: 'https://play.google.com/store/apps/details?id=com.mateen.game',
  apkLink: '',
  updatedAt: Date.now()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. GET: Public fetch of version control info
  if (req.method === 'GET') {
    try {
      const { data: setting } = await supabaseAdmin
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()

      // If version control JSON exists inside setting (or memory)
      const vc = setting?.version_control || setting?.versionControl || memoryVersionControl
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
      decoded = verifyAdminToken(token)
    } catch (err) {
      return res.status(401).json({ message: 'انتهت صلاحية الجلسة' })
    }

    const { data: currentAdmin } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', decoded.adminId)
      .maybeSingle()

    if (!currentAdmin) {
      return res.status(401).json({ message: 'المشرف غير موجود' })
    }

    const {
      latestAndroidVersionCode,
      latestVersionCode,
      updateNotes,
      isForceUpdate,
      isUpdateActive,
      playStoreLink,
      apkLink
    } = req.body

    const parsedCode = Number(latestAndroidVersionCode || latestVersionCode || memoryVersionControl.latestAndroidVersionCode) || 1
    const activeState = isUpdateActive !== undefined ? Boolean(isUpdateActive) : (memoryVersionControl.isUpdateActive !== false)

    const parsedData: VersionControlData = {
      latestAndroidVersionCode: parsedCode,
      latestVersionCode: parsedCode,
      updateNotes: String(updateNotes !== undefined ? updateNotes : memoryVersionControl.updateNotes).trim(),
      isForceUpdate: isForceUpdate !== undefined ? Boolean(isForceUpdate) : memoryVersionControl.isForceUpdate,
      isUpdateActive: activeState,
      playStoreLink: String(playStoreLink || memoryVersionControl.playStoreLink).trim(),
      apkLink: String(apkLink || memoryVersionControl.apkLink).trim(),
      updatedAt: Date.now()
    }

    memoryVersionControl = parsedData

    try {
      // Persist in system_settings record in Supabase
      await supabaseAdmin
        .from('system_settings')
        .upsert({
          id: 1,
          version_control: parsedData,
          versionControl: parsedData,
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

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

