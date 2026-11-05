import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseMessaging } from '../_lib/firebaseAdmin.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
const supabase = supabaseAdmin;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Allow GET (used by Vercel Cron) and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 2. Security Check (Vercel Cron Secret)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron-Wird] Unauthorized request rejected.');
    return res.status(401).json({
      success: false,
      message: 'غير مصرح: مفتاح CRON_SECRET غير صحيح أو مفقود'
    });
  }

  const isForce = req.query.force === 'true';
  const now = new Date();
  const todayDateStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
  const currentHourUtc = now.getUTCHours();
  const currentHourMecca = (currentHourUtc + 3) % 24;

  console.log(`[Cron-Wird] Running wird check at UTC: ${currentHourUtc}:00, Mecca: ${currentHourMecca}:00 (Force: ${isForce})`);

  try {
    // 3. Fetch active wird subscriptions exclusively from Supabase
    let activeWirds: any[] = [];
    try {
      const { data: sbWirds, error: sbErr } = await supabase
        .from('user_wird')
        .select('*')
        .eq('is_active', true);

      if (!sbErr && Array.isArray(sbWirds)) {
        activeWirds = sbWirds;
      }
    } catch (e) {
      console.warn('[Cron-Wird] Could not query Supabase user_wird:', e);
    }

    if (activeWirds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'لا توجد اشتراكات نشطة في الورد اليومي حالياً',
        processedCount: 0
      });
    }

    // 4. Filter users whose scheduled time matches the current window
    const eligibleUsers = activeWirds.filter((wird) => {
      // Don't notify twice on the same day unless forced
      if (!isForce && wird.last_notified_date === todayDateStr) {
        return false;
      }

      if (isForce) return true;

      // Parse notification time (e.g. "08:00" -> 8)
      const scheduledHour = parseInt((wird.notification_time || '08:00').split(':')[0], 10);
      return scheduledHour === currentHourMecca || scheduledHour === currentHourUtc;
    });

    console.log(`[Cron-Wird] Found ${eligibleUsers.length} eligible users to notify.`);

    const messaging = getFirebaseMessaging();
    let sentCount = 0;
    let failedCount = 0;
    const results: any[] = [];

    // 5. Process each eligible user
    for (const user of eligibleUsers) {
      const startPage = Math.max(1, Math.min(604, user.current_page || 1));
      const pagesCount = Math.max(1, user.pages_per_day || 4);
      const targetUrl = `/mushaf?page=${startPage}`;

      const notificationTitle = '📖 حان وقت وردك القرآني اليومي';
      const notificationBody = `وردك اليوم يبدأ من الصفحة ${startPage} (${pagesCount} صفحات). انقر لفتح المصحف مباشرة والبدء في القراءة.`;

      // Find user device tokens exclusively from Supabase
      const userTokens: string[] = [];
      try {
        const { data: sbTokens } = await supabase
          .from('device_tokens')
          .select('fcm_token')
          .eq('user_id', user.user_id);
        if (sbTokens && Array.isArray(sbTokens)) {
          sbTokens.forEach((t: any) => userTokens.push(t.fcm_token));
        }
      } catch {}

      // Send FCM push notification if token exists
      let fcmSent = false;
      const uniqueUserTokens = Array.from(new Set(userTokens)).filter(t => t && t.length > 20);

      if (messaging && uniqueUserTokens.length > 0) {
        try {
          const fcmResponse = await messaging.sendEachForMulticast({
            tokens: uniqueUserTokens,
            notification: {
              title: notificationTitle,
              body: notificationBody
            },
            data: {
              route: targetUrl,
              url: targetUrl,
              page: String(startPage),
              click_action: targetUrl,
              tag: `mateen_wird_${user.user_id}`
            },
            android: {
              priority: 'high',
              notification: {
                title: notificationTitle,
                body: notificationBody,
                icon: 'ic_stat_notification',
                color: '#10b981',
                tag: `mateen_wird_${user.user_id}`
              }
            },
            webpush: {
              headers: {
                Urgency: 'high'
              },
              fcmOptions: {
                link: targetUrl
              },
              notification: {
                title: notificationTitle,
                body: notificationBody,
                icon: '/logo.png',
                badge: '/logo-mark.png',
                dir: 'rtl',
                lang: 'ar',
                tag: `mateen_wird_${user.user_id}`
              }
            }
          });

          if (fcmResponse.successCount > 0) {
            fcmSent = true;
            sentCount += fcmResponse.successCount;
          } else {
            failedCount += fcmResponse.failureCount;
          }
        } catch (fcmErr) {
          console.error(`[Cron-Wird] FCM send error for user ${user.user_id}:`, fcmErr);
          failedCount++;
        }
      }

      // Also create an in-app notification entry for the user
      try {
        await supabase.from('notifications').insert({
          title: notificationTitle,
          body: notificationBody,
          sender_role: 'SYSTEM_WIRD',
          sender_name: 'الورد القرآني',
          metadata: {
            url: targetUrl,
            page: startPage,
            userId: user.user_id
          }
        });
      } catch {}

      // Calculate next day's current_page
      let nextPage = startPage + pagesCount;
      if (nextPage > 604) {
        nextPage = ((nextPage - 1) % 604) + 1;
      }

      // Update user_wird in Supabase
      try {
        await supabase
          .from('user_wird')
          .update({
            current_page: nextPage,
            last_notified_date: todayDateStr,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.user_id);
      } catch {}

      results.push({
        userId: user.user_id,
        sentPage: startPage,
        nextPage,
        pagesCount,
        fcmSent,
        tokensCount: userTokens.length
      });
    }

    return res.status(200).json({
      success: true,
      message: `تم إرسال تنبيهات الورد اليومي بنجاح (${eligibleUsers.length} مستخدم)`,
      processedCount: eligibleUsers.length,
      sentCount,
      failedCount,
      details: results,
      executedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron-Wird] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ غير متوقع أثناء معالجة الورد القرآني',
      error: error.message,
      details: error.message
    });
  }
}

