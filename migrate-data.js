/**
 * سكربت ترحيل البيانات من Neon إلى Supabase
 * Script: migrate-data.js
 * 
 * ينقل جميع البيانات القديمة (المستخدمين، التحديات، الرموز، الغرف، الإعدادات، وغيرها)
 * من Neon القديم إلى Supabase الجديد مع الحفاظ على المعرفات وتجنب التعارض.
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحميل متغيرات البيئة من .env أو .env.local
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

const NEON_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_dZcw62PJbqhM@ep-green-salad-an54u1bs-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://hexxbopfvbuliakufejj.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhleHhib3BmdmJ1bGlha3VmZWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMzA1MjYsImV4cCI6MjEwODgwNjUyNn0.-JG3tJo4PJrxtaHI9MC9fXQKR1AZ60GY5b-OJOFNSZo';

console.log('====================================================');
console.log('🚀 بدء عملية ترحيل البيانات من Neon إلى Supabase...');
console.log('====================================================');
console.log(`📌 مصدر البيانات (Neon): ep-green-salad-an54u1bs...`);
console.log(`📌 الوجهة (Supabase): ${SUPABASE_URL}`);
console.log('----------------------------------------------------');

const prisma = new PrismaClient({
  datasourceUrl: NEON_DATABASE_URL
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const report = [];

async function migrateChunk(tableName, rows, onConflict = 'id') {
  if (!rows || rows.length === 0) return 0;
  
  let successCount = 0;
  const chunkSize = 50;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from(tableName)
      .upsert(chunk, { onConflict, ignoreDuplicates: false })
      .select();

    if (error) {
      console.warn(`⚠️ [${tableName}] تحذير أثناء الدفعة ${i / chunkSize + 1}:`, error.message);
      // محاولة الإدخال الفردي لتفادي توقف الدفعة بالكامل
      for (const row of chunk) {
        const { error: singleErr } = await supabase
          .from(tableName)
          .upsert(row, { onConflict, ignoreDuplicates: true });
        if (!singleErr) successCount++;
        else console.warn(`   ↳ تعذر إدخال صف: ${singleErr.message}`);
      }
    } else {
      successCount += (data ? data.length : chunk.length);
    }
  }

  return successCount;
}

async function runMigration() {
  const startTime = Date.now();

  try {
    // 1. ترحيل إعدادات النظام (system_settings)
    console.log('⏳ جاري ترحيل إعدادات النظام (system_settings)...');
    try {
      const settings = await prisma.systemSetting.findMany();
      const adapted = settings.map(s => ({
        ...s,
        version_control: s.versionControl
      }));
      const count = await migrateChunk('system_settings', adapted, 'id');
      report.push({ table: 'system_settings (إعدادات النظام)', neon: settings.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في system_settings:', e.message);
      report.push({ table: 'system_settings', neon: 0, migrated: 0, error: e.message });
    }

    // 2. ترحيل المشرفين (admins)
    console.log('⏳ جاري ترحيل المشرفين (admins)...');
    try {
      const admins = await prisma.admin.findMany();
      // تنظيف المشرفين المؤقتين ذوي المعرف 1 إن وجدوا
      await supabase.from('admins').delete().eq('id', 1);
      const count = await migrateChunk('admins', admins, 'id');
      report.push({ table: 'admins (المشرفون والإدارة)', neon: admins.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في admins:', e.message);
      report.push({ table: 'admins', neon: 0, migrated: 0, error: e.message });
    }

    // 3. ترحيل أكواد المشرفين (admin_codes)
    console.log('⏳ جاري ترحيل أكواد المشرفين (admin_codes)...');
    try {
      const codes = await prisma.adminCode.findMany();
      const count = await migrateChunk('admin_codes', codes, 'id');
      report.push({ table: 'admin_codes (أكواد التسجيل)', neon: codes.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في admin_codes:', e.message);
      report.push({ table: 'admin_codes', neon: 0, migrated: 0, error: e.message });
    }

    // 4. ترحيل مختبري التطبيق (app_testers)
    console.log('⏳ جاري ترحيل مختبري Google Play (app_testers)...');
    try {
      const testers = await prisma.appTester.findMany();
      const adapted = testers.map(t => ({
        ...t,
        approved_at: t.approvedAt
      }));
      const count = await migrateChunk('app_testers', adapted, 'email');
      report.push({ table: 'app_testers (مختبرو جوجل بلاي)', neon: testers.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في app_testers:', e.message);
      report.push({ table: 'app_testers', neon: 0, migrated: 0, error: e.message });
    }

    // 5. ترحيل الورد القرآني (user_wird)
    console.log('⏳ جاري ترحيل إعدادات الورد اليومي (user_wird)...');
    try {
      const wirds = await prisma.userWird.findMany();
      const count = await migrateChunk('user_wird', wirds, 'user_id');
      report.push({ table: 'user_wird (الورد القرآني)', neon: wirds.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في user_wird:', e.message);
      report.push({ table: 'user_wird', neon: 0, migrated: 0, error: e.message });
    }

    // 6. ترحيل رموز الأجهزة (device_tokens)
    console.log('⏳ جاري ترحيل رموز الأجهزة (device_tokens)...');
    try {
      const tokens = await prisma.deviceToken.findMany();
      const adapted = tokens.map(t => ({
        id: t.id,
        token: t.fcm_token,
        fcm_token: t.fcm_token,
        created_at: t.created_at || t.createdAt
      }));
      const count = await migrateChunk('device_tokens', adapted, 'token');
      report.push({ table: 'device_tokens (توكنات الإشعارات)', neon: tokens.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في device_tokens:', e.message);
      report.push({ table: 'device_tokens', neon: 0, migrated: 0, error: e.message });
    }

    // 7. ترحيل سجل الإشعارات (notifications)
    console.log('⏳ جاري ترحيل سجل الإشعارات (notifications)...');
    try {
      const notifications = await prisma.notification.findMany();
      const adapted = notifications.map(n => ({
        id: n.id,
        title: n.title,
        body: n.body,
        created_at: n.created_at || n.createdAt,
        is_read: false
      }));
      const count = await migrateChunk('notifications', adapted, 'id');
      report.push({ table: 'notifications (سجل الإشعارات)', neon: notifications.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في notifications:', e.message);
      report.push({ table: 'notifications', neon: 0, migrated: 0, error: e.message });
    }

    // 8. ترحيل بنك الأسئلة والتحديات (challenges)
    console.log('⏳ جاري ترحيل التحديات القرآنية (challenges)...');
    try {
      const challenges = await prisma.challenge.findMany();
      const count = await migrateChunk('challenges', challenges, 'id');
      report.push({ table: 'challenges (التحديات القرآنية)', neon: challenges.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في challenges:', e.message);
      report.push({ table: 'challenges', neon: 0, migrated: 0, error: e.message });
    }

    // 9. ترحيل اللاعبين والمستخدمين (players)
    console.log('⏳ جاري ترحيل حسابات اللاعبين (players)...');
    try {
      const players = await prisma.player.findMany();
      const count = await migrateChunk('players', players, 'id');
      report.push({ table: 'players (المستخدمون واللاعبون)', neon: players.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في players:', e.message);
      report.push({ table: 'players', neon: 0, migrated: 0, error: e.message });
    }

    // 10. ترحيل الصداقات (friendships)
    console.log('⏳ جاري ترحيل علاقات الصداقة (friendships)...');
    try {
      const friendships = await prisma.friendship.findMany();
      let fCount = 0;
      for (const f of friendships) {
        const payload = {
          user_id: String(f.requesterId),
          friend_id: String(f.addresseeId),
          requesterId: f.requesterId,
          addresseeId: f.addresseeId,
          status: f.status,
          created_at: f.createdAt,
          updated_at: f.updatedAt
        };
        const { error } = await supabase.from('friendships').insert(payload);
        if (!error) fCount++;
      }
      report.push({ table: 'friendships (قائمة الصداقات)', neon: friendships.length, migrated: fCount });
    } catch (e) {
      console.warn('⚠️ خطأ في friendships:', e.message);
      report.push({ table: 'friendships', neon: 0, migrated: 0, error: e.message });
    }

    // 11. ترحيل الغرف والتحديات الحية (rooms)
    console.log('⏳ جاري ترحيل الغرف والتحديات (rooms)...');
    try {
      const rooms = await prisma.room.findMany();
      const count = await migrateChunk('rooms', rooms, 'id');
      report.push({ table: 'rooms (غرف التحدي والمباريات)', neon: rooms.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في rooms:', e.message);
      report.push({ table: 'rooms', neon: 0, migrated: 0, error: e.message });
    }

    // 12. ترحيل تصنيفات مسابقة من أنا (who_am_i_categories)
    console.log('⏳ جاري ترحيل تصنيفات مسابقة من أنا (who_am_i_categories)...');
    try {
      const cats = await prisma.whoAmICategory.findMany();
      const count = await migrateChunk('who_am_i_categories', cats, 'name');
      report.push({ table: 'who_am_i_categories (تصنيفات من أنا)', neon: cats.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في who_am_i_categories:', e.message);
      report.push({ table: 'who_am_i_categories', neon: 0, migrated: 0, error: e.message });
    }

    // 13. ترحيل أسئلة مسابقة من أنا (who_am_i_questions)
    console.log('⏳ جاري ترحيل أسئلة مسابقة من أنا (who_am_i_questions)...');
    try {
      const questions = await prisma.whoAmIQuestion.findMany();
      const count = await migrateChunk('who_am_i_questions', questions, 'id');
      report.push({ table: 'who_am_i_questions (أسئلة من أنا)', neon: questions.length, migrated: count });
    } catch (e) {
      console.warn('⚠️ خطأ في who_am_i_questions:', e.message);
      report.push({ table: 'who_am_i_questions', neon: 0, migrated: 0, error: e.message });
    }

  } finally {
    await prisma.$disconnect();
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n====================================================');
  console.log('📊 تقرير الترحيل النهائي (Migration Summary Report)');
  console.log('====================================================');
  console.table(
    report.map(r => ({
      'الجدول': r.table,
      'صفوف Neon الأصلية': r.neon,
      'تم نقلها إلى Supabase': r.migrated,
      'الحالة': r.migrated >= r.neon ? '✅ مكتمل 100%' : '⚠️ فحص مطلوب'
    }))
  );

  const totalNeon = report.reduce((sum, r) => sum + (r.neon || 0), 0);
  const totalMigrated = report.reduce((sum, r) => sum + (r.migrated || 0), 0);

  console.log(`⏱️ استغرقت العملية: ${durationSec} ثانية`);
  console.log(`🎉 إجمالي الصفوف المنقولة بنجاح: ${totalMigrated} من أصل ${totalNeon}`);
  console.log('====================================================\n');
}

runMigration().catch(err => {
  console.error('❌ خطأ فادح أثناء الترحيل:', err);
  process.exit(1);
});

