import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { handleCors } from './_lib/cors.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hexxbopfvbuliakufejj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhleHhib3BmdmJ1bGlha3VmZWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMzA1MjYsImV4cCI6MjEwODgwNjUyNn0.-JG3tJo4PJrxtaHI9MC9fXQKR1AZ60GY5b-OJOFNSZo';
const supabase = createClient(supabaseUrl, supabaseKey);

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
      // Try Prisma first
      let wird = await (prisma as any).userWird.findUnique({
        where: { user_id: userId }
      });

      // Fallback to Supabase if not found in Prisma
      if (!wird) {
        const { data, error } = await supabase
          .from('user_wird')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data) {
          wird = data;
        }
      }

      if (!wird) {
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
        wird
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
      let savedWird: any = null;

      // 1. Save in Prisma / Neon
      try {
        savedWird = await (prisma as any).userWird.upsert({
          where: { user_id: activeUserId },
          create: {
            user_id: activeUserId,
            pages_per_day: pagesPerDay,
            current_page: currentPage,
            notification_time: notificationTime,
            is_active: isActive
          },
          update: {
            pages_per_day: pagesPerDay,
            current_page: currentPage,
            notification_time: notificationTime,
            is_active: isActive
          }
        });
      } catch (prismaErr) {
        console.warn('[UserWird API] Prisma upsert warn:', prismaErr);
      }

      // 2. Save in Supabase
      try {
        const { data: sbData, error: sbErr } = await supabase
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
          console.warn('[UserWird API] Supabase upsert warn:', sbErr.message);
        } else if (!savedWird && sbData) {
          savedWird = sbData;
        }
      } catch (sbEx) {
        console.warn('[UserWird API] Supabase exception:', sbEx);
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

