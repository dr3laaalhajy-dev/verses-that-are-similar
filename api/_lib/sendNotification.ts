import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors.js';
import { broadcastNotification, resolveFullUrl } from '../_lib/broadcastNotification.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (handleCors(req, res)) return;

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'الطريقة غير مسموحة', details: 'Method Not Allowed' });
    }

    // 1. Authorization: Verify Admin JWT Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'غير مصرح', details: 'يجب تسجيل الدخول كمشرف' });
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      return res.status(401).json({ error: 'غير مصرح', details: 'رمز الجلسة غير صالح أو منتهي الصلاحية' });
    }

    // 2. Fetch authoritative admin record from Supabase (with fallback to decoded token)
    let currentAdmin: any = null;
    try {
      const { data: adminRecord } = await supabaseAdmin
        .from('admins')
        .select('*')
        .eq('id', decoded.adminId)
        .maybeSingle();
      if (adminRecord) {
        currentAdmin = adminRecord;
      }
    } catch (dbErr: any) {
      console.warn('[sendNotification] Supabase admin lookup warning, falling back to token claims:', dbErr?.message);
    }

    if (!currentAdmin) {
      if (decoded.role === 'FOUNDER' || decoded.role === 'CO_FOUNDER' || decoded.username?.toLowerCase() === 'alaa' || decoded.username === 'علاء') {
        currentAdmin = decoded;
      } else {
        return res.status(401).json({ error: 'غير مصرح', details: 'حساب المشرف غير موجود أو لا يملك صلاحيات' });
      }
    }

    // Check if founder or co-founder
    const isFounder = currentAdmin.role === 'FOUNDER' || currentAdmin.username?.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء';
    const isCoFounder = currentAdmin.role === 'CO_FOUNDER';

    if (!isFounder && !isCoFounder) {
      return res.status(403).json({
        error: 'صلاحيات غير كافية',
        details: 'إرسال التنبيهات الشاملة مقتصر على المؤسس ومساعد المؤسس فقط.'
      });
    }

    // 3. Extract and validate notification payload
    const { title, body, target_url, targetUrl, metadata } = req.body || {};
    if (!title || !title.trim() || !body || !body.trim()) {
      return res.status(400).json({ error: 'بيانات ناقصة', details: 'يرجى إدخال عنوان الإشعار ونصه بالكامل' });
    }

    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const cleanTargetUrl = (target_url || targetUrl || '').trim() || null;
    // If target_url starts with '/' (relative path), resolve it to full URL using base URL
    const fullTargetUrl = resolveFullUrl(cleanTargetUrl);
    const senderRole = isFounder ? 'FOUNDER' : 'CO_FOUNDER';
    const senderName = currentAdmin.name || currentAdmin.username || (isFounder ? 'المؤسس' : 'مساعد المؤسس');

    // 4. Mandatory Supabase persistence using Service Role client (Single Source of Truth)
    let savedNotification: any = null;
    try {
      const { data, error } = await supabaseAdmin.from('notifications').insert({
        title: cleanTitle,
        body: cleanBody,
        target_url: cleanTargetUrl || null,
        sender_role: senderRole || 'ADMIN',
        sender_name: senderName || 'الأدمن'
      }).select();

      if (error) {
        console.error('Failed to save notification to Supabase:', error);
        // Schema fallback in case target_url, sender_role, or sender_name columns are not yet in Supabase schema
        if (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('column')) {
          console.warn('[sendNotification] Schema column mismatch on notifications table, retrying with core columns {title, body}...');
          const retry = await supabaseAdmin.from('notifications').insert({
            title: cleanTitle,
            body: cleanBody
          }).select();
          if (retry.error) {
            console.error('Failed to save notification to Supabase (core retry):', retry.error);
          } else if (retry.data && retry.data.length > 0) {
            savedNotification = retry.data[0];
          }
        }
      } else if (data && data.length > 0) {
        savedNotification = data[0];
      }
    } catch (dbEx: any) {
      console.error('[sendNotification] Exception saving notification in Supabase:', dbEx?.message || dbEx);
    }

    // Realtime broadcast via Supabase channel if record was created
    if (savedNotification) {
      try {
        await supabaseAdmin.channel('realtime_public_notifications').send({
          type: 'broadcast',
          event: 'NOTIFICATION_UPDATED',
          payload: savedNotification
        });
      } catch (bcErr) {
        console.warn('[sendNotification] Realtime broadcast warning:', bcErr);
      }
    }

    // 5. Broadcast FCM Push Notifications
    const result = await broadcastNotification({
      title: cleanTitle,
      body: cleanBody,
      targetUrl: cleanTargetUrl,
      fullUrl: fullTargetUrl,
      senderRole,
      senderName,
      savedNotification,
      metadata: {
        ...(metadata || {}),
        fullUrl: fullTargetUrl,
        sentByAdminId: currentAdmin.id || decoded.adminId,
        sentAt: new Date().toISOString()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'تم إرسال التنبيه وحفظه بنجاح لجميع المشتركين',
      notification: savedNotification || result.savedNotification,
      stats: result.stats
    });
  } catch (error: any) {
    console.error('[sendNotification] Error sending notification:', error);
    return res.status(500).json({
      error: 'حدث خطأ أثناء إرسال التنبيه',
      details: error?.message || 'خطأ داخلي غير معروف في الخادم'
    });
  }
}
