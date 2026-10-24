import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { handleCors } from './_lib/cors.js';

const INTERNAL_TEST_URL = 'https://play.google.com/apps/internaltest/4700647113151529861';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  // GET: Fetch list of registered tester emails
  if (req.method === 'GET') {
    try {
      const testers = await (prisma as any).appTester.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200
      });
      return res.status(200).json({
        success: true,
        count: testers.length,
        testers: testers.map((t: any) => t.email),
        internalTestUrl: INTERNAL_TEST_URL
      });
    } catch (error: any) {
      console.error('Fetch testers error:', error);
      return res.status(500).json({ error: 'Failed to fetch testers' });
    }
  }

  // POST: Register a new tester email
  if (req.method === 'POST') {
    try {
      const { email } = req.body || {};
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return res.status(400).json({
          error: 'يرجى إدخال بريد إلكتروني صحيح (Gmail)'
        });
      }

      // Upsert tester email so if already registered, it doesn't fail
      await (prisma as any).appTester.upsert({
        where: { email: cleanEmail },
        update: {},
        create: { email: cleanEmail }
      });

      return res.status(200).json({
        success: true,
        message: 'تم إضافة بريدك بنجاح إلى قائمة المختبرين!',
        internalTestUrl: INTERNAL_TEST_URL
      });
    } catch (error: any) {
      console.error('Register tester error:', error);
      return res.status(500).json({
        error: error.message || 'حدث خطأ أثناء حفظ البريد الإلكتروني'
      });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
