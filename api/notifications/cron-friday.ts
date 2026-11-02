import type { VercelRequest, VercelResponse } from '@vercel/node';
import { broadcastNotification } from '../_lib/broadcastNotification.js';

// القالب الثابت ليوم الجمعة المبارك
const FRIDAY_TEMPLATE = {
  title: 'يوم الجمعة المبارك ✨',
  body: 'لا تنسَ قراءة سورة الكهف، والإكثار من الصلاة على النبي ﷺ، والدعاء في ساعة الاستجابة.'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Allow GET (used by Vercel Cron) and POST (for testing / manual invocations)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 2. Security Check (Vercel Cron Secret Header)
  // According to Vercel documentation, Vercel invokes Cron jobs with header:
  // Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron-Friday] Unauthorized cron trigger attempt rejected.');
    return res.status(401).json({
      success: false,
      message: 'غير مصرح: مفتاح CRON_SECRET غير صحيح أو مفقود'
    });
  }

  console.log('[Cron-Friday] Triggering Friday scheduled notification...');

  try {
    // 3. Broadcast notification to Supabase (Realtime in-app bell) and Firebase Admin (FCM push)
    const result = await broadcastNotification({
      title: FRIDAY_TEMPLATE.title,
      body: FRIDAY_TEMPLATE.body,
      senderRole: 'SYSTEM_CRON',
      senderName: 'تذكير الجمعة الآلي',
      metadata: {
        type: 'FRIDAY_CRON',
        scheduled: true,
        sentAt: new Date().toISOString()
      }
    });

    console.log('[Cron-Friday] Friday notification broadcasted successfully:', result.stats);

    return res.status(200).json({
      success: true,
      message: 'تم إرسال تذكير يوم الجمعة المبارك بنجاح',
      template: FRIDAY_TEMPLATE,
      stats: result.stats,
      sentAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron-Friday] Error executing Friday cron notification:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تنفيذ التنبيه المجدول ليوم الجمعة',
      error: error.message
    });
  }
}

