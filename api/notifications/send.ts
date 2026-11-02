import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma.js';
import { handleCors } from '../_lib/cors.js';
import { getFirebaseMessaging } from '../_lib/firebaseAdmin.js';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Supabase client for Serverless function
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hexxbopfvbuliakufejj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhleHhib3BmdmJ1bGlha3VmZWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMzA1MjYsImV4cCI6MjEwODgwNjUyNn0.-JG3tJo4PJrxtaHI9MC9fXQKR1AZ60GY5b-OJOFNSZo';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 1. Authorization: Verify Admin JWT Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'غير مصرح: يجب تسجيل الدخول كمشرف' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'رمز الجلسة غير صالح أو منتهي الصلاحية' });
  }

  // 2. Fetch authoritative admin record from database
  const currentAdmin = await (prisma as any).admin.findUnique({
    where: { id: decoded.adminId }
  });

  if (!currentAdmin) {
    return res.status(401).json({ message: 'حساب المشرف غير موجود' });
  }

  // Check if founder or co-founder
  const isFounder = currentAdmin.role === 'FOUNDER' || currentAdmin.username?.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء';
  const isCoFounder = currentAdmin.role === 'CO_FOUNDER';

  if (!isFounder && !isCoFounder) {
    return res.status(403).json({
      message: 'غير مصرح: إرسال التنبيهات الشاملة مقتصر على المؤسس ومساعد المؤسس فقط.'
    });
  }

  // 3. Extract and validate notification payload
  const { title, body, metadata } = req.body || {};
  if (!title || !title.trim() || !body || !body.trim()) {
    return res.status(400).json({ message: 'يرجى إدخال عنوان الإشعار ونصه بالكامل' });
  }

  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const senderRole = isFounder ? 'FOUNDER' : 'CO_FOUNDER';
  const senderName = currentAdmin.name || currentAdmin.username;

  try {
    // 4. Insert into database (Prisma and Supabase)
    let savedNotification: any = null;

    // Prisma / Neon
    try {
      savedNotification = await (prisma as any).notification.create({
        data: {
          title: cleanTitle,
          body: cleanBody,
          sender_role: senderRole,
          sender_name: senderName,
          metadata: metadata || {}
        }
      });
    } catch (prismaErr) {
      console.warn('[Notifications] Prisma save warning:', prismaErr);
    }

    // Supabase (Triggers Supabase Realtime bell automatically)
    try {
      const { data: sbData, error: sbErr } = await supabase
        .from('notifications')
        .insert({
          title: cleanTitle,
          body: cleanBody,
          sender_role: senderRole,
          sender_name: senderName,
          metadata: metadata || {}
        })
        .select()
        .single();

      if (sbErr) {
        console.warn('[Notifications] Supabase Realtime table insert warning:', sbErr.message);
      } else if (!savedNotification && sbData) {
        savedNotification = sbData;
      }
    } catch (sbEx) {
      console.warn('[Notifications] Supabase insert exception:', sbEx);
    }

    // 5. Gather all FCM Device Tokens
    const tokenSet = new Set<string>();

    // From Prisma
    try {
      const dbTokens = await (prisma as any).deviceToken.findMany({
        select: { fcm_token: true }
      });
      dbTokens.forEach((t: any) => {
        if (t.fcm_token) tokenSet.add(t.fcm_token);
      });
    } catch (e) {
      console.warn('[Notifications] Could not query Prisma device tokens:', e);
    }

    // From Supabase
    try {
      const { data: sbTokens } = await supabase
        .from('device_tokens')
        .select('fcm_token');
      if (sbTokens && Array.isArray(sbTokens)) {
        sbTokens.forEach((t: any) => {
          if (t.fcm_token) tokenSet.add(t.fcm_token);
        });
      }
    } catch (e) {
      console.warn('[Notifications] Could not query Supabase device tokens:', e);
    }

    const allTokens = Array.from(tokenSet);
    console.log(`[Notifications] Total active device tokens retrieved: ${allTokens.length}`);

    // 6. Broadcast external push notifications using Firebase Admin SDK
    const messaging = getFirebaseMessaging();
    let successCount = 0;
    let failureCount = 0;
    const staleTokens: string[] = [];

    if (messaging && allTokens.length > 0) {
      // Chunk tokens into batches of 500 (FCM limit)
      const chunkSize = 500;
      for (let i = 0; i < allTokens.length; i += chunkSize) {
        const chunk = allTokens.slice(i, i + chunkSize);
        try {
          const response = await messaging.sendEachForMulticast({
            tokens: chunk,
            notification: {
              title: cleanTitle,
              body: cleanBody
            },
            data: {
              title: cleanTitle,
              body: cleanBody,
              click_action: '/',
              ...(metadata || {})
            },
            webpush: {
              fcmOptions: {
                link: '/'
              },
              notification: {
                icon: '/logo.png',
                badge: '/logo-mark.png',
                dir: 'rtl',
                lang: 'ar'
              }
            }
          });

          successCount += response.successCount;
          failureCount += response.failureCount;

          // Collect stale / invalid tokens for automatic cleanup
          response.responses.forEach((resp, idx) => {
            if (!resp.success && resp.error) {
              const code = resp.error.code;
              if (
                code === 'messaging/invalid-registration-token' ||
                code === 'messaging/registration-token-not-registered'
              ) {
                staleTokens.push(chunk[idx]);
              }
            }
          });
        } catch (fcmErr) {
          console.error('[Notifications] FCM batch send error:', fcmErr);
          failureCount += chunk.length;
        }
      }

      // Cleanup stale tokens from database
      if (staleTokens.length > 0) {
        try {
          await (prisma as any).deviceToken.deleteMany({
            where: { fcm_token: { in: staleTokens } }
          });
        } catch (_) {}

        try {
          await supabase
            .from('device_tokens')
            .delete()
            .in('fcm_token', staleTokens);
        } catch (_) {}

        console.log(`[Notifications] Cleaned up ${staleTokens.length} stale FCM tokens.`);
      }
    } else if (!messaging) {
      console.log('[Notifications] Firebase Admin not configured with credentials in .env. Realtime in-app notification recorded.');
    }

    return res.status(200).json({
      success: true,
      message: 'تم إرسال التنبيه بنجاح لجميع المشتركين',
      notification: savedNotification || {
        title: cleanTitle,
        body: cleanBody,
        sender_role: senderRole,
        created_at: new Date().toISOString()
      },
      stats: {
        totalTokens: allTokens.length,
        pushSuccessCount: successCount,
        pushFailureCount: failureCount,
        fcmConfigured: !!messaging
      }
    });
  } catch (error: any) {
    console.error('[Notifications] Error sending notification:', error);
    return res.status(500).json({
      message: 'حدث خطأ غير متوقع أثناء إرسال التنبيه',
      error: error.message
    });
  }
}
