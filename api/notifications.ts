import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { handleCors } from './_lib/cors.js';
import sendHandler from './_lib/sendNotification.js';
import cronWirdHandler from './_lib/cronWird.js';
import cronFridayHandler from './_lib/cronFriday.js';
import cronAdhkarHandler from './_lib/cronAdhkar.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hexxbopfvbuliakufejj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhleHhib3BmdmJ1bGlha3VmZWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMzA1MjYsImV4cCI6MjEwODgwNjUyNn0.-JG3tJo4PJrxtaHI9MC9fXQKR1AZ60GY5b-OJOFNSZo';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const action = (req.query.action as string) || (req.body && req.body.action);
  const job = (req.query.job as string) || (action === 'cron' ? (req.query.type as string || req.body?.type) : '');

  // 1. Cron Job Actions consolidated from /api/cron
  if (job === 'wird' || job === 'cron-wird') {
    return cronWirdHandler(req, res);
  }
  if (job === 'friday' || job === 'cron-friday') {
    return cronFridayHandler(req, res);
  }
  if (job === 'adhkar' || job === 'cron-adhkar') {
    return cronAdhkarHandler(req, res);
  }

  // 2. Send Notification Action (Delegates to send handler)
  if (action === 'send' || req.query.send !== undefined) {
    return sendHandler(req, res);
  }

  // 2. Register FCM Device Token
  if (req.method === 'POST' && (action === 'register-token' || req.body?.fcmToken)) {
    const { userId, fcmToken, platform } = req.body || {};
    if (!fcmToken) {
      return res.status(400).json({ message: 'fcmToken is required' });
    }

    const cleanUser = String(userId || 'guest_user').trim();
    const cleanToken = String(fcmToken).trim();
    const cleanPlatform = String(platform || 'web').trim();

    try {
      // Upsert in Prisma
      try {
        await (prisma as any).deviceToken.upsert({
          where: { fcm_token: cleanToken },
          update: {
            user_id: cleanUser,
            platform: cleanPlatform,
            updated_at: new Date()
          },
          create: {
            user_id: cleanUser,
            fcm_token: cleanToken,
            platform: cleanPlatform
          }
        });
      } catch (prismaErr) {
        console.warn('[Notifications] Prisma token upsert warning:', prismaErr);
      }

      // Upsert in Supabase
      try {
        await supabase
          .from('device_tokens')
          .upsert({
            user_id: cleanUser,
            fcm_token: cleanToken,
            platform: cleanPlatform,
            updated_at: new Date().toISOString()
          }, { onConflict: 'fcm_token' });
      } catch (sbErr) {
        console.warn('[Notifications] Supabase token upsert warning:', sbErr);
      }

      return res.status(200).json({ success: true, message: 'Device token registered successfully' });
    } catch (err: any) {
      console.error('[Notifications] Register token error:', err);
      return res.status(500).json({ message: 'Failed to register device token', error: err.message });
    }
  }

  // 3. GET: Fetch list of recent notifications
  if (req.method === 'GET') {
    try {
      const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

      // Try Supabase first
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          return res.status(200).json({ success: true, notifications: data });
        }
      } catch (e) {}

      // Fallback to Prisma
      const notifications = await (prisma as any).notification.findMany({
        orderBy: { created_at: 'desc' },
        take: limit
      });

      return res.status(200).json({ success: true, notifications });
    } catch (err: any) {
      console.error('[Notifications] Fetch error:', err);
      return res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
    }
  }

  // 4. DELETE: Delete Notification
  if (req.method === 'DELETE' || action === 'delete') {
    const id = (req.query.id as string) || req.body?.id;
    if (!id) {
      return res.status(400).json({ message: 'Notification ID is required' });
    }

    try {
      // 1. Delete in Supabase
      try {
        await supabase.from('notifications').delete().eq('id', id);
      } catch (sbErr) {
        console.warn('[Notifications] Supabase delete warning:', sbErr);
      }

      // 2. Delete in Prisma
      try {
        await (prisma as any).notification.delete({
          where: { id }
        });
      } catch (prismaErr) {
        console.warn('[Notifications] Prisma delete warning:', prismaErr);
      }

      return res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    } catch (err: any) {
      console.error('[Notifications] Delete error:', err);
      return res.status(500).json({ message: 'Failed to delete notification', error: err.message });
    }
  }

  // 5. UPDATE: Edit Notification
  if (req.method === 'PUT' || req.method === 'PATCH' || action === 'update') {
    const { id, title, body, target_url, targetUrl } = req.body || {};
    const notificationId = id || (req.query.id as string);
    if (!notificationId) {
      return res.status(400).json({ message: 'Notification ID is required' });
    }
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ message: 'Title and body are required' });
    }

    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const cleanTargetUrl = target_url !== undefined ? (target_url ? target_url.trim() : null) : (targetUrl ? targetUrl.trim() : null);
    const nowIso = new Date().toISOString();

    try {
      // 1. Update in Supabase (with updated_at = now)
      try {
        await supabase
          .from('notifications')
          .update({
            title: cleanTitle,
            body: cleanBody,
            target_url: cleanTargetUrl,
            updated_at: nowIso
          })
          .eq('id', notificationId);
      } catch (sbErr) {
        console.warn('[Notifications] Supabase update warning:', sbErr);
      }

      // 2. Update in Prisma (with updated_at = now)
      try {
        await (prisma as any).notification.update({
          where: { id: notificationId },
          data: {
            title: cleanTitle,
            body: cleanBody,
            target_url: cleanTargetUrl,
            updated_at: new Date(nowIso)
          }
        });
      } catch (prismaErr) {
        console.warn('[Notifications] Prisma update warning:', prismaErr);
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
      return res.status(500).json({ message: 'Failed to update notification', error: err.message });
    }
  }

  return res.status(404).json({ message: 'Endpoint not found' });
}

