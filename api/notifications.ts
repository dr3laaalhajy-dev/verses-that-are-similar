import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_lib/cors.js';
import sendHandler from './_lib/sendNotification.js';
import cronWirdHandler from './_lib/cronWird.js';
import cronFridayHandler from './_lib/cronFriday.js';
import cronAdhkarHandler from './_lib/cronAdhkar.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
const supabase = supabaseAdmin;

const isValidUuid = (val: any): boolean => {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (handleCors(req, res)) return;

  try {
    const action = (req.query.action as string) || (req.body && req.body.action);
    const job = (req.query.job as string) || (action === 'cron' ? (req.query.type as string || req.body?.type) : '');

    // 1. Cron Job Actions consolidated from /api/cron
    if (job === 'wird' || job === 'cron-wird') {
      return await cronWirdHandler(req, res);
    }
    if (job === 'friday' || job === 'cron-friday') {
      return await cronFridayHandler(req, res);
    }
    if (job === 'adhkar' || job === 'cron-adhkar') {
      return await cronAdhkarHandler(req, res);
    }

    // 2. Send Notification Action (Delegates to send handler)
    if (action === 'send' || req.query.send !== undefined) {
      return await sendHandler(req, res);
    }

    // 2.5 Mark as Read Actions
    if (action === 'mark-read') {
      const id = (req.query.id as string) || req.body?.id;
      if (!id || id === 'undefined' || id === 'null') {
        return res.status(400).json({ error: 'Missing notification id' });
      }
      try {
        await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', id);
        return res.status(200).json({ success: true, message: 'Notification marked as read' });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to mark as read', details: err?.message });
      }
    }

    if (action === 'mark-all-read') {
      const { ids, userId, receiverId } = req.body || {};
      const targetUserId = userId || receiverId || (req.query.userId as string);
      try {
        const cleanIds = Array.isArray(ids) ? ids.filter(i => Boolean(i) && i !== 'undefined' && i !== 'null') : [];
        if (cleanIds.length > 0) {
          await supabaseAdmin.from('notifications').update({ is_read: true }).in('id', cleanIds);
        }
        if (targetUserId) {
          try {
            await supabaseAdmin.from('notifications').update({ is_read: true }).eq('receiver_id', String(targetUserId)).eq('is_read', false);
          } catch (_) {}
          if (isValidUuid(String(targetUserId))) {
            try {
              await supabaseAdmin.from('notifications').update({ is_read: true }).eq('user_id', String(targetUserId)).eq('is_read', false);
            } catch (_) {}
          }
        }
        return res.status(200).json({ success: true, message: 'All notifications marked as read' });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to mark all as read', details: err?.message });
      }
    }

    // 3. Register FCM Device Token
    if (req.method === 'POST' && (action === 'register-token' || req.body?.fcmToken)) {
      const { userId, fcmToken, platform } = req.body || {};
      if (!fcmToken) {
        return res.status(400).json({ error: 'بيانات غير مكتملة', details: 'fcmToken is required' });
      }

      const cleanUser = String(userId || 'guest_user').trim();
      const cleanToken = String(fcmToken).trim();
      const cleanPlatform = String(platform || 'web').trim();

      try {
        // Upsert exclusively in Supabase with strict deduplication per user
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanUser);
          const safeUserId = isUuid ? cleanUser : cleanUser;

          // If a known user is registering a token, remove their older different tokens
          if (safeUserId && safeUserId !== 'guest_user') {
            await supabase
              .from('device_tokens')
              .delete()
              .eq('user_id', safeUserId)
              .neq('token', cleanToken);
            await supabase
              .from('device_tokens')
              .delete()
              .eq('user_id', safeUserId)
              .neq('fcm_token', cleanToken);
          }

          let { error: sbErr } = await supabase
            .from('device_tokens')
            .upsert({
              user_id: safeUserId,
              token: cleanToken,
              fcm_token: cleanToken,
              platform: cleanPlatform
            }, { onConflict: 'token' });

          if (sbErr && (sbErr.code === '42703' || sbErr.code === 'PGRST204' || sbErr.message?.includes('token'))) {
            await supabase
              .from('device_tokens')
              .upsert({
                user_id: safeUserId,
                fcm_token: cleanToken,
                platform: cleanPlatform
              }, { onConflict: 'fcm_token' });
          }
        } catch (sbErr: any) {
          console.warn('[Notifications] Supabase token upsert warning:', sbErr?.message);
        }

        return res.status(200).json({ success: true, message: 'Device token registered successfully' });
      } catch (err: any) {
        console.error('[Notifications] Register token error:', err);
        return res.status(500).json({
          error: 'فشل تسجيل رمز الجهاز',
          details: err?.message || 'Unknown registration error'
        });
      }
    }

    // 4. GET: Fetch list of recent notifications exclusively from Supabase
    if (req.method === 'GET') {
      try {
        const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
        const receiverId = (req.query.receiverId as string) || (req.query.receiver_id as string) || (req.query.userId as string);

        let query = supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (receiverId) {
          query = query.eq('receiver_id', String(receiverId));
        }

        const { data, error } = await query;

        if (error) {
          console.warn('[Notifications] Supabase fetch warning:', error.message);
        }

        return res.status(200).json({ success: true, notifications: data || [] });
      } catch (err: any) {
        console.error('[Notifications] Fetch error:', err);
        return res.status(500).json({
          error: 'فشل جلب قائمة الإشعارات',
          details: err?.message || 'Database query error'
        });
      }
    }

    // 5. DELETE: Delete Notification exclusively in Supabase
    if (req.method === 'DELETE' || action === 'delete') {
      const id = (req.query.id as string) || req.body?.id;
      if (!id) {
        return res.status(400).json({ error: 'بيانات غير مكتملة', details: 'Notification ID is required' });
      }

      try {
        const { error: sbErr } = await supabase.from('notifications').delete().eq('id', id);
        if (sbErr) {
          console.warn('[Notifications] Supabase delete warning:', sbErr.message);
        }

        return res.status(200).json({ success: true, message: 'Notification deleted successfully' });
      } catch (err: any) {
        console.error('[Notifications] Delete error:', err);
        return res.status(500).json({
          error: 'فشل حذف الإشعار',
          details: err?.message || 'Delete operation error'
        });
      }
    }

    // 6. UPDATE: Edit Notification exclusively in Supabase
    if (req.method === 'PUT' || req.method === 'PATCH' || action === 'update') {
      const { id, title, body, target_url, targetUrl } = req.body || {};
      const notificationId = id || (req.query.id as string);
      if (!notificationId) {
        return res.status(400).json({ error: 'بيانات غير مكتملة', details: 'Notification ID is required' });
      }
      if (!title?.trim() || !body?.trim()) {
        return res.status(400).json({ error: 'بيانات غير مكتملة', details: 'Title and body are required' });
      }

      const cleanTitle = title.trim();
      const cleanBody = body.trim();
      const cleanTargetUrl = target_url !== undefined ? (target_url ? target_url.trim() : null) : (targetUrl ? targetUrl.trim() : null);
      const nowIso = new Date().toISOString();

      try {
        const { error: sbErr } = await supabase
          .from('notifications')
          .update({
            title: cleanTitle,
            body: cleanBody,
            target_url: cleanTargetUrl,
            updated_at: nowIso
          })
          .eq('id', notificationId);

        if (sbErr) {
          console.warn('[Notifications] Supabase update warning:', sbErr.message);
        }

        return res.status(200).json({
          success: true,
          message: 'Notification updated successfully',
          notification: {
            id: notificationId,
            title: cleanTitle,
            body: cleanBody,
            target_url: cleanTargetUrl,
            updated_at: nowIso
          }
        });
      } catch (err: any) {
        console.error('[Notifications] Update error:', err);
        return res.status(500).json({
          error: 'فشل تحديث الإشعار',
          details: err?.message || 'Update operation error'
        });
      }
    }

    return res.status(404).json({ error: 'المسار غير موجود', details: 'Endpoint not found' });
  } catch (globalErr: any) {
    console.error('[Notifications API Handler] Uncaught global error:', globalErr);
    return res.status(500).json({
      error: 'حدث خطأ في الخادم أثناء معالجة الإشعارات',
      details: globalErr?.message || 'Internal Server Error'
    });
  }
}
