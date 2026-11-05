import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './cors.js';
import { supabaseAdmin } from './supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { method } = req;

  // 1. GET: Fetch user's Quran Wird configuration
  if (method === 'GET') {
    const userId = (req.query.userId as string) || (req.query.user_id as string);
    if (!userId) {
      return res.status(400).json({ message: 'userId مطلوب' });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('user_wird')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[UserWird API] Supabase query error:', error.message);
      }

      if (!data) {
        // Return default settings for new user
        return res.status(200).json({
          success: true,
          wird: {
            user_id: userId,
            pages_per_day: 4,
            current_page: 1,
            notification_time: '08:00',
            is_active: true
          },
          isNew: true
        });
      }

      return res.status(200).json({
        success: true,
        wird: data
      });
    } catch (error: any) {
      console.error('[UserWird API] Error fetching wird:', error);
      return res.status(500).json({ message: 'حدث خطأ أثناء جلب الورد اليومي', error: error.message });
    }
  }

  // 2. POST: Upsert (Save/Update) Quran Wird configuration
  if (method === 'POST') {
    const {
      userId,
      user_id,
      pages_per_day,
      current_page,
      notification_time,
      is_active
    } = req.body || {};

    const activeUserId = userId || user_id;
    if (!activeUserId) {
      return res.status(400).json({ message: 'userId مطلوب' });
    }

    const pagesPerDay = parseInt(pages_per_day || '4', 10);
    const currentPage = parseInt(current_page || '1', 10);
    const notificationTime = notification_time || '08:00';
    const isActive = is_active !== undefined ? Boolean(is_active) : true;

    try {
      const { data: savedWird, error: sbErr } = await supabaseAdmin
        .from('user_wird')
        .upsert({
          user_id: activeUserId,
          pages_per_day: pagesPerDay,
          current_page: currentPage,
          notification_time: notificationTime,
          is_active: isActive,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (sbErr) {
        console.warn('[UserWird API] Supabase upsert error:', sbErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'تم حفظ إعدادات الورد اليومي بنجاح',
        wird: savedWird || {
          user_id: activeUserId,
          pages_per_day: pagesPerDay,
          current_page: currentPage,
          notification_time: notificationTime,
          is_active: isActive
        }
      });
    } catch (error: any) {
      console.error('[UserWird API] Error saving wird:', error);
      return res.status(500).json({ message: 'حدث خطأ أثناء حفظ الورد اليومي', error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}

