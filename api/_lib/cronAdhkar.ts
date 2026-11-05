import type { VercelRequest, VercelResponse } from '@vercel/node';
import { broadcastNotification } from '../_lib/broadcastNotification.js';

// نماذج أذكار الصباح مع الفضائل
const MORNING_ADHKAR_TEMPLATES = [
  {
    title: '☀️ أذكار الصباح | ابدأ يومك بحفظ الله',
    body: '«أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ» • أذكار الصباح حصنك الحصين وسبب لانشراح صدرك وتيسير يومك.'
  },
  {
    title: '🌅 أشرقت أنوار الصباح | أذكار الصباح',
    body: '«اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا» • من قالها حين يصبح كفاه الله ما أهمه وبارَك في رزقه.'
  },
  {
    title: '🌿 حرز وبركة | أذكار الصباح',
    body: '«بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ» • من قالها ثلاثاً حين يصبح لم يضره شيء حتى يمسي.'
  },
  {
    title: '✨ سيد الاستغفار | أذكار الصباح',
    body: '«اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ» • من قالها موقناً بها حين يصبح فمات من يومه دخل الجنة.'
  }
];

// نماذج أذكار المساء مع الفضائل
const EVENING_ADHKAR_TEMPLATES = [
  {
    title: '🌙 أذكار المساء | حصنك ليلتك',
    body: '«أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ» • أقبل الليل فحصّن نفسك وأهلك بأذكار المساء لتنعم بالسكينة والأمان.'
  },
  {
    title: '✨ سكينة وطمأنينة | أذكار المساء',
    body: '«أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ» • من قالها ثلاثاً حين يمسي لم يضره مكروه في ليلته.'
  },
  {
    title: '🌆 ختام اليوم بطاعة | أذكار المساء',
    body: '«اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ فَمِنْكَ وَحْدَكَ» • من قالها حين يمسي فقد أدّى شكر ليلته.'
  },
  {
    title: '🛡️ أذكار المساء | حرز وأمان',
    body: '«حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ» • من قالها سبع مرات حين يمسي كفاه الله ما أهمه.'
  }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Allow GET (used by Vercel Cron) and POST (manual triggers)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 2. Security Check (Vercel Cron Secret Header or Query param)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret : null;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    console.warn('[Cron-Adhkar] Unauthorized cron trigger attempt rejected.');
    return res.status(401).json({
      success: false,
      message: 'غير مصرح: مفتاح CRON_SECRET غير صحيح أو مفقود'
    });
  }

  // 3. Determine Morning vs Evening
  const now = new Date();
  const utcHours = now.getUTCHours();
  // Makkah is UTC+3
  const makkahHour = (utcHours + 3) % 24;

  const typeParam = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : null;
  // If explicitly specified in query, use it; otherwise check Makkah hour:
  // 03:00 to 14:59 Makkah time (morning), 15:00 to 02:59 Makkah time (evening)
  const isMorning = typeParam === 'morning' ? true : typeParam === 'evening' ? false : (makkahHour >= 3 && makkahHour < 15);

  const templates = isMorning ? MORNING_ADHKAR_TEMPLATES : EVENING_ADHKAR_TEMPLATES;
  // Select template based on day of month to rotate daily
  const selectedIndex = now.getDate() % templates.length;
  const template = templates[selectedIndex];

  const timePeriodLabel = isMorning ? 'أذكار الصباح' : 'أذكار المساء';
  console.log(`[Cron-Adhkar] Triggering scheduled notification for ${timePeriodLabel} (Makkah Hour: ${makkahHour}:00, UTC: ${utcHours}:00)...`);

  try {
    const adhkarRoute = isMorning ? '/adhkar/morning' : '/adhkar/evening';

    // 4. Broadcast notification:
    // - Persists in Supabase 'notifications' table (triggers in-app bell)
    // - Fetches all fcm_token from Supabase 'device_tokens' (and Prisma)
    // - Sends FCM multicast push notifications via Firebase Admin
    // - Directs target_url & route to specific adhkar category
    const result = await broadcastNotification({
      title: template.title,
      body: template.body,
      targetUrl: adhkarRoute,
      senderRole: 'SYSTEM_CRON',
      senderName: timePeriodLabel,
      metadata: {
        type: isMorning ? 'MORNING_ADHKAR' : 'EVENING_ADHKAR',
        timePeriod: isMorning ? 'morning' : 'evening',
        route: adhkarRoute,
        extra: { route: adhkarRoute },
        scheduled: true,
        makkahHour,
        sentAt: now.toISOString()
      }
    });

    console.log(`[Cron-Adhkar] ${timePeriodLabel} broadcast completed successfully:`, result.stats);

    return res.status(200).json({
      success: true,
      message: `تم إرسال تذكير ${timePeriodLabel} بنجاح`,
      timePeriod: isMorning ? 'morning' : 'evening',
      makkahHour,
      template,
      stats: result.stats,
      sentAt: now.toISOString()
    });
  } catch (error: any) {
    console.error('[Cron-Adhkar] Error executing scheduled adhkar notification:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إرسال تذكير الأذكار المجدول',
      error: error.message,
      details: error.message
    });
  }
}

