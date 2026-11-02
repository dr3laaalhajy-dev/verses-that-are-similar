import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma.js';
import { handleCors } from '../_lib/cors.js';
import { broadcastNotification } from '../_lib/broadcastNotification.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
    const result = await broadcastNotification({
      title: cleanTitle,
      body: cleanBody,
      senderRole,
      senderName,
      metadata: {
        ...(metadata || {}),
        sentByAdminId: currentAdmin.id,
        sentAt: new Date().toISOString()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'تم إرسال التنبيه بنجاح لجميع المشتركين',
      notification: result.savedNotification,
      stats: result.stats
    });
  } catch (error: any) {
    console.error('[Notifications] Error sending notification:', error);
    return res.status(500).json({
      message: 'حدث خطأ غير متوقع أثناء إرسال التنبيه',
      error: error.message
    });
  }
}
