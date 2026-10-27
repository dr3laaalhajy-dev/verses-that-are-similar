import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { handleCors } from './_lib/cors.js';

const INTERNAL_TEST_URL = 'https://play.google.com/apps/testing/com.mateen.game';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  // GET: Check status of an email (e.g. ?email=user@gmail.com)
  if (req.method === 'GET') {
    try {
      const email = req.query.email as string;
      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const tester = await (prisma as any).appTester.findUnique({
          where: { email: cleanEmail }
        });
        if (!tester) {
          return res.status(200).json({
            success: true,
            registered: false,
            status: 'NOT_FOUND'
          });
        }
        const isApproved = tester.status === 'APPROVED' || tester.status === 'EXPORTED' || tester.status === 'ADDED';
        return res.status(200).json({
          success: true,
          registered: true,
          status: isApproved ? 'APPROVED' : (tester.status || 'PENDING'),
          internalTestUrl: isApproved ? INTERNAL_TEST_URL : null,
          createdAt: tester.createdAt,
          approvedAt: tester.approvedAt
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Google Play Testing Registration Endpoint'
      });
    } catch (error: any) {
      console.error('Fetch tester status error:', error);
      return res.status(500).json({ error: 'Failed to fetch tester status' });
    }
  }

  // POST: Submit request to join beta test
  if (req.method === 'POST') {
    try {
      const { email } = req.body || {};
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return res.status(400).json({
          error: 'يرجى إدخال بريد إلكتروني صحيح (Gmail)'
        });
      }

      // Check if already registered
      const existing = await (prisma as any).appTester.findUnique({
        where: { email: cleanEmail }
      });

      if (existing) {
        const isApproved = existing.status === 'APPROVED' || existing.status === 'EXPORTED' || existing.status === 'ADDED';
        if (isApproved) {
          return res.status(200).json({
            success: true,
            status: 'APPROVED',
            message: 'تهانينا! بريدك الإلكتروني معتمد ومقبول بالفعل في قائمة المختبرين.',
            internalTestUrl: INTERNAL_TEST_URL
          });
        }
        if (existing.status === 'REJECTED') {
          await (prisma as any).appTester.update({
            where: { id: existing.id },
            data: { status: 'PENDING' }
          });
          return res.status(200).json({
            success: true,
            status: 'PENDING',
            message: 'تم إعادة إرسال طلب انضمامك للتجربة بنجاح! طلبك قيد المراجعة حالياً من قبل الإدارة.'
          });
        }
        return res.status(200).json({
          success: true,
          status: 'PENDING',
          message: 'طلبك مسجل مسبقاً وهو قيد المراجعة حالياً من قبل الإدارة. سيتم تفعيله قريباً.'
        });
      }

      // Create new pending tester request
      await (prisma as any).appTester.create({
        data: {
          email: cleanEmail,
          status: 'PENDING'
        }
      });

      return res.status(200).json({
        success: true,
        status: 'PENDING',
        message: 'تم إرسال طلب انضمامك للتجربة بنجاح! سيتم مراجعة الطلب والموافقة عليه من قبل الإدارة قريباً.'
      });
    } catch (error: any) {
      console.error('Register tester request error:', error);
      return res.status(500).json({
        error: error.message || 'حدث خطأ أثناء حفظ طلب الانضمام'
      });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
