import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || (req.body && req.body.action);

  // Actions that DON'T require auth
  if (req.method === 'POST' && action === 'login') {
    return handleLogin(req, res);
  }
  if (req.method === 'POST' && action === 'register') {
    return handleRegister(req, res);
  }

  // Authorization check for all other actions
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  // Fetch current admin directly from Supabase
  const { data: currentAdmin, error: adminErr } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('id', decoded.adminId)
    .maybeSingle();

  if (adminErr || !currentAdmin) {
    return res.status(401).json({ message: 'حساب المشرف غير موجود' });
  }

  // Auto-protect and ensure alaa is FOUNDER
  if ((currentAdmin.username.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء') && currentAdmin.role !== 'FOUNDER') {
    currentAdmin.role = 'FOUNDER';
    currentAdmin.isSuperAdmin = true;
    await supabaseAdmin
      .from('admins')
      .update({ role: 'FOUNDER', isSuperAdmin: true })
      .eq('id', currentAdmin.id);
  }

  const isPrivileged = currentAdmin.role === 'FOUNDER' || currentAdmin.role === 'CO_FOUNDER';
  if ((action === 'invite' || action === 'manage' || action === 'change-password' || action === 'testers') && !isPrivileged) {
    return res.status(403).json({ message: 'هذا الإجراء مسموح للمؤسس ومساعدي المؤسس فقط' });
  }

  const isFounder = currentAdmin.role === 'FOUNDER' || currentAdmin.username.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء';
  const canManageUsers = isFounder || (currentAdmin.role === 'CO_FOUNDER' && currentAdmin.canManageUsers);

  if (action === 'users' && !canManageUsers) {
    return res.status(403).json({ message: 'ليس لديك صلاحية لإدارة المستخدمين' });
  }

  if (action === 'toggle-user-permission' && !isFounder) {
    return res.status(403).json({ message: 'تعديل صلاحيات إدارة المستخدمين متاح للمؤسس فقط' });
  }

  switch (action) {
    case 'me':
      return res.status(200).json({
        id: currentAdmin.id,
        username: currentAdmin.username,
        name: currentAdmin.name,
        role: (currentAdmin.username.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء') ? 'FOUNDER' : (currentAdmin.role || 'ADMIN'),
        isSuperAdmin: currentAdmin.isSuperAdmin,
        canManageUsers: !!canManageUsers
      });
    case 'invite':
      return handleInvite(req, res, currentAdmin);
    case 'manage':
      return handleManage(req, res, currentAdmin);
    case 'change-password':
      return handleChangePassword(req, res, currentAdmin);
    case 'users':
      return handleUsers(req, res, currentAdmin);
    case 'toggle-user-permission':
      return handleToggleUserPermission(req, res, currentAdmin);
    case 'testers':
      return handleTesters(req, res, currentAdmin);
    default:
      return res.status(400).json({ message: 'Invalid action' });
  }
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة' });

  const rawUsername = (username || '').trim();
  const cleanUsername = rawUsername.replace(/^@+/, '');

  try {
    let { data: admin } = await supabaseAdmin
      .from('admins')
      .select('*')
      .or(`username.eq.${cleanUsername},username.eq.@${cleanUsername},username.eq.${rawUsername}`)
      .limit(1)
      .maybeSingle();

    const { count: adminCount } = await supabaseAdmin
      .from('admins')
      .select('*', { count: 'exact', head: true });

    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const { data: newAdmin } = await supabaseAdmin
        .from('admins')
        .insert({ username: cleanUsername, name: cleanUsername, password: hashedPassword, isSuperAdmin: true, role: 'FOUNDER' })
        .select()
        .single();
      admin = newAdmin;
    }

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isAlaa = admin.username.toLowerCase() === 'alaa' || admin.username === 'علاء' || cleanUsername.toLowerCase() === 'alaa' || cleanUsername === 'علاء';
    const effectiveRole = isAlaa ? 'FOUNDER' : (admin.role || 'ADMIN');
    const isSuper = effectiveRole === 'FOUNDER' || effectiveRole === 'CO_FOUNDER';

    if (isAlaa && admin.role !== 'FOUNDER') {
      await supabaseAdmin.from('admins').update({ role: 'FOUNDER', isSuperAdmin: true }).eq('id', admin.id);
      admin.role = 'FOUNDER';
    }

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, isSuperAdmin: isSuper, role: effectiveRole },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      username: admin.username,
      name: admin.name || admin.username,
      adminId: admin.id,
      isSuperAdmin: isSuper,
      role: effectiveRole,
      canManageUsers: isAlaa || effectiveRole === 'FOUNDER' || !!admin.canManageUsers
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'حدث خطأ في تسجيل الدخول' });
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  const { username, password, code, name } = req.body;
  if (!username || !password || !code) return res.status(400).json({ message: 'جميع الحقول مطلوبة' });

  const rawUsername = (username || '').trim();
  const cleanUsername = rawUsername.replace(/^@+/, '');

  try {
    const { data: adminCode } = await supabaseAdmin
      .from('admin_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (!adminCode || adminCode.isUsed) return res.status(400).json({ message: 'كود التسجيل غير صحيح أو مستخدم' });

    const { data: existing } = await supabaseAdmin
      .from('admins')
      .select('id')
      .or(`username.eq.${cleanUsername},username.eq.@${cleanUsername},username.eq.${rawUsername}`)
      .limit(1)
      .maybeSingle();

    if (existing) return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = adminCode.role === 'CO_FOUNDER' || adminCode.role === 'SUPERADMIN' ? 'CO_FOUNDER' : 'ADMIN';

    const { data: admin, error: createErr } = await supabaseAdmin
      .from('admins')
      .insert({
        username: cleanUsername,
        name: name?.trim() || cleanUsername,
        password: hashedPassword,
        isSuperAdmin: assignedRole === 'CO_FOUNDER',
        role: assignedRole
      })
      .select()
      .single();

    if (createErr) throw createErr;

    await supabaseAdmin
      .from('admin_codes')
      .update({ isUsed: true, usedAt: new Date().toISOString() })
      .eq('id', adminCode.id);

    return res.status(201).json({ message: 'تم التسجيل بنجاح!', username: admin.username, name: admin.name, role: admin.role });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'حدث خطأ أثناء التسجيل' });
  }
}

async function handleInvite(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method === 'GET') {
    const { data: codes } = await supabaseAdmin
      .from('admin_codes')
      .select('*')
      .order('createdAt', { ascending: false });
    return res.status(200).json(codes || []);
  }

  if (req.method === 'POST') {
    const { role } = req.body;
    
    if (role === 'CO_FOUNDER' && currentAdmin.role !== 'FOUNDER') {
      return res.status(403).json({ message: 'فقط المؤسس يمكنه توليد كود دعوة لمساعد مؤسس' });
    }

    const code = uuidv4().substring(0, 8).toUpperCase();
    const { data: newCode, error } = await supabaseAdmin
      .from('admin_codes')
      .insert({
        code,
        role: role === 'CO_FOUNDER' ? 'CO_FOUNDER' : 'ADMIN',
        createdBy: currentAdmin.username
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(newCode);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    await supabaseAdmin.from('admin_codes').delete().eq('id', parseInt(id as string));
    return res.status(200).json({ message: 'Deleted' });
  }
}

async function handleManage(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method === 'GET') {
    const { data: admins } = await supabaseAdmin
      .from('admins')
      .select('id, username, name, isSuperAdmin, role, canManageUsers')
      .order('id', { ascending: true });

    let mapped = (admins || []).map(a => ({
      ...a,
      role: (a.username.toLowerCase() === 'alaa' || a.username === 'علاء') ? 'FOUNDER' : (a.role || 'ADMIN'),
      canManageUsers: (a.username.toLowerCase() === 'alaa' || a.username === 'علاء' || a.role === 'FOUNDER') ? true : !!a.canManageUsers
    }));

    const isCallerFounder = currentAdmin.role === 'FOUNDER' || currentAdmin.username.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء';
    if (!isCallerFounder) {
      mapped = mapped.filter(a => a.role !== 'FOUNDER' && a.username.toLowerCase() !== 'alaa' && a.username !== 'علاء');
    }

    return res.status(200).json(mapped);
  }

  if (req.method === 'POST') {
    const { username, password, role: targetRole, isSuperAdmin, name } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة' });

    const rawUsername = (username || '').trim();
    const cleanUsername = rawUsername.replace(/^@+/, '');

    const { data: existing } = await supabaseAdmin
      .from('admins')
      .select('id')
      .or(`username.eq.${cleanUsername},username.eq.@${cleanUsername},username.eq.${rawUsername}`)
      .limit(1)
      .maybeSingle();

    if (existing) return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' });

    let assignedRole = 'ADMIN';
    if (targetRole === 'CO_FOUNDER') {
      if (currentAdmin.role !== 'FOUNDER') {
        return res.status(403).json({ message: 'فقط المؤسس (علاء) يمكنه تعيين مساعد مؤسس' });
      }
      assignedRole = 'CO_FOUNDER';
    } else if (targetRole === 'FOUNDER') {
      return res.status(403).json({ message: 'لا يمكن تعيين مؤسس إضافي' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .insert({
        username: cleanUsername,
        name: name?.trim() || cleanUsername,
        password: hashedPassword,
        isSuperAdmin: assignedRole === 'CO_FOUNDER' || !!isSuperAdmin,
        role: assignedRole
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ id: admin.id, username: admin.username, name: admin.name, role: admin.role, isSuperAdmin: admin.isSuperAdmin });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const targetId = parseInt(id as string);

    const { data: targetAdmin } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();

    if (!targetAdmin) return res.status(404).json({ message: 'المشرف غير موجود' });

    const isTargetFounder = targetAdmin.role === 'FOUNDER' || targetAdmin.username.toLowerCase() === 'alaa' || targetAdmin.username === 'علاء';
    if (isTargetFounder) {
      return res.status(403).json({ message: 'خط أحمر: لا يمكن حذف حساب المؤسس (علاء) نهائياً' });
    }

    if (targetAdmin.role === 'CO_FOUNDER' && currentAdmin.role !== 'FOUNDER') {
      return res.status(403).json({ message: 'فقط المؤسس يمكنه حذف مساعد المؤسس' });
    }

    if (currentAdmin.role !== 'FOUNDER' && currentAdmin.role !== 'CO_FOUNDER') {
      return res.status(403).json({ message: 'ليس لديك صلاحية لحذف المشرفين' });
    }

    await supabaseAdmin.from('admins').delete().eq('id', targetId);
    return res.status(200).json({ message: 'تم حذف المشرف بنجاح' });
  }

  if (req.method === 'PATCH') {
    return handleChangePassword(req, res, currentAdmin);
  }
}

async function handleChangePassword(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  const { id, newPassword } = req.body;
  if (!id || !newPassword) {
    return res.status(400).json({ message: 'معرف المشرف وكلمة المرور الجديدة مطلوبة' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 4 خانات' });
  }

  const targetId = parseInt(id.toString());
  const { data: targetAdmin } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('id', targetId)
    .maybeSingle();

  if (!targetAdmin) return res.status(404).json({ message: 'المشرف غير موجود' });

  const isTargetFounder = targetAdmin.role === 'FOUNDER' || targetAdmin.username.toLowerCase() === 'alaa' || targetAdmin.username === 'علاء';

  if (isTargetFounder && currentAdmin.id !== targetAdmin.id) {
    return res.status(403).json({ message: 'لا يمكن تعديل كلمة مرور المؤسس إلا من قبل المؤسس نفسه' });
  }

  if (targetAdmin.role === 'CO_FOUNDER' && currentAdmin.role !== 'FOUNDER' && currentAdmin.id !== targetAdmin.id) {
    return res.status(403).json({ message: 'فقط المؤسس يمكنه تعديل كلمة مرور مساعد المؤسس' });
  }

  if (currentAdmin.role === 'CO_FOUNDER') {
    if (targetAdmin.role !== 'ADMIN' && currentAdmin.id !== targetAdmin.id) {
      return res.status(403).json({ message: 'مساعد المؤسس يمكنه تعديل كلمات مرور المشرفين العاديين فقط' });
    }
  } else if (currentAdmin.role !== 'FOUNDER' && currentAdmin.id !== targetAdmin.id) {
    return res.status(403).json({ message: 'ليس لديك صلاحية لتعديل كلمة مرور هذا المشرف' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await supabaseAdmin
    .from('admins')
    .update({ password: hashedPassword, updatedAt: new Date().toISOString() })
    .eq('id', targetId);

  return res.status(200).json({ message: `تم تغيير كلمة المرور للمشرف (${targetAdmin.username}) بنجاح` });
}

async function handleUsers(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method === 'GET') {
    const search = (req.query.search as string || '').trim();
    let query = supabaseAdmin
      .from('players')
      .select('id, name, username, points, cups, isBlocked, activeFrame, seerahCompleted, generalCompleted, quranCompleted, createdAt, updatedAt')
      .order('cups', { ascending: false })
      .order('points', { ascending: false })
      .order('createdAt', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { data: players, error } = await query;
    if (error) {
      console.error('[Admin handleUsers GET error]:', error);
      return res.status(500).json({ message: 'فشل جلب المستخدمين', error: error.message });
    }
    return res.status(200).json(players || []);
  }

  if (req.method === 'POST') {
    const { subAction, id, name, username, points, cups, newPassword, isBlocked } = req.body;
    if (!id) return res.status(400).json({ message: 'معرف المستخدم مطلوب' });

    const { data: player, error: fetchErr } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();

    if (fetchErr || !player) return res.status(404).json({ message: 'المستخدم غير موجود' });

    if (subAction === 'update-info') {
      const cleanU = (username || '').trim().replace(/^@+/, '');
      const cleanN = (name || '').trim();

      if (cleanU && cleanU !== player.username?.replace(/^@+/, '')) {
        const { data: existing } = await supabaseAdmin
          .from('players')
          .select('id')
          .or(`username.eq.${cleanU},username.eq.@${cleanU}`)
          .neq('id', player.id)
          .maybeSingle();
        if (existing) {
          return res.status(400).json({ message: 'اسم المستخدم هذا مستخدم بالفعل لمستخدم آخر' });
        }
      }

      const parsedPoints = (points !== undefined && points !== null && !isNaN(Number(points)))
        ? Math.max(0, parseInt(String(points), 10))
        : undefined;
      const parsedCups = (cups !== undefined && cups !== null && !isNaN(Number(cups)))
        ? Math.max(0, parseInt(String(cups), 10))
        : undefined;

      const updateData: any = {};
      if (cleanN) updateData.name = cleanN;
      if (cleanU) updateData.username = cleanU;
      if (parsedPoints !== undefined) updateData.points = parsedPoints;
      if (parsedCups !== undefined) updateData.cups = parsedCups;

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('players')
        .update(updateData)
        .eq('id', player.id)
        .select()
        .single();

      if (updateErr) {
        console.error('[Admin update-info error]:', updateErr);
        return res.status(500).json({ message: 'فشل تحديث بيانات المستخدم', error: updateErr.message });
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.status(200).json({ success: true, message: 'تم تحديث بيانات المستخدم بنجاح', player: updated });
    }

    if (subAction === 'reset-password') {
      if (!newPassword || !String(newPassword).trim()) {
        return res.status(400).json({ message: 'كلمة المرور الجديدة مطلوبة' });
      }
      const { error: resetErr } = await supabaseAdmin
        .from('players')
        .update({ password: String(newPassword).trim(), updatedAt: new Date().toISOString() })
        .eq('id', player.id);

      if (resetErr) {
        return res.status(500).json({ message: 'فشل إعادة تعيين كلمة المرور', error: resetErr.message });
      }
      return res.status(200).json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
    }

    if (subAction === 'toggle-block') {
      const { data: updated, error: blockErr } = await supabaseAdmin
        .from('players')
        .update({ isBlocked: Boolean(isBlocked), updatedAt: new Date().toISOString() })
        .eq('id', player.id)
        .select()
        .single();

      if (blockErr) {
        return res.status(500).json({ message: 'فشل تغيير حالة الحظر', error: blockErr.message });
      }
      return res.status(200).json({
        success: true,
        message: updated.isBlocked ? 'تم حظر المستخدم ومنعه من تسجيل الدخول' : 'تم إلغاء حظر المستخدم بنجاح',
        player: updated
      });
    }

    return res.status(400).json({ message: 'إجراء غير معروف' });
  }

  if (req.method === 'DELETE') {
    const id = Number(req.query.id);
    if (!id) return res.status(400).json({ message: 'معرف المستخدم مطلوب' });

    try {
      await supabaseAdmin
        .from('rooms')
        .delete()
        .or(`player1Id.eq.${id},player2Id.eq.${id},winnerId.eq.${id}`);
    } catch (_) {}

    const { error: delErr } = await supabaseAdmin
      .from('players')
      .delete()
      .eq('id', id);

    if (delErr) {
      return res.status(500).json({ message: 'فشل حذف حساب المستخدم', error: delErr.message });
    }
    return res.status(200).json({ success: true, message: 'تم حذف حساب المستخدم نهائياً' });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

async function handleToggleUserPermission(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { adminId, canManageUsers } = req.body;
  if (!adminId) return res.status(400).json({ message: 'معرف المشرف مطلوب' });

  const { data: targetAdmin } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('id', Number(adminId))
    .maybeSingle();

  if (!targetAdmin) return res.status(404).json({ message: 'المشرف غير موجود' });

  const { data: updated, error } = await supabaseAdmin
    .from('admins')
    .update({ canManageUsers: Boolean(canManageUsers), updatedAt: new Date().toISOString() })
    .eq('id', targetAdmin.id)
    .select()
    .single();

  if (error) throw error;

  return res.status(200).json({
    success: true,
    message: updated.canManageUsers ? 'تم منح صلاحية إدارة المستخدمين' : 'تم سحب صلاحية إدارة المستخدمين',
    admin: updated
  });
}

async function handleTesters(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method === 'GET') {
    try {
      const { data: testers } = await supabaseAdmin
        .from('app_testers')
        .select('*')
        .order('createdAt', { ascending: false });

      const allTesters = testers || [];
      const approvedTesters = allTesters.filter((t: any) => t.status === 'APPROVED');
      const pendingTesters = allTesters.filter((t: any) => t.status === 'PENDING' || !t.status);
      const rejectedTesters = allTesters.filter((t: any) => t.status === 'REJECTED');
      const approvedEmails = approvedTesters.map((t: any) => t.email);

      return res.status(200).json({
        success: true,
        testers: allTesters,
        stats: {
          total: allTesters.length,
          pending: pendingTesters.length,
          approved: approvedTesters.length,
          rejected: rejectedTesters.length
        },
        approvedCommaSeparated: approvedEmails.join(', ')
      });
    } catch (err: any) {
      console.error('Fetch testers error:', err);
      return res.status(500).json({ message: 'فشل في جلب طلبات المختبرين' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { subAction, testerId, email } = req.body || {};

      if (subAction === 'approve') {
        const id = Number(testerId);
        if (!id) return res.status(400).json({ message: 'معرّف الطلب غير صالح' });
        const { data: updated, error } = await supabaseAdmin
          .from('app_testers')
          .update({ status: 'APPROVED', updatedAt: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'تم قبول طلب المختبر بنجاح', tester: updated });
      }

      if (subAction === 'reject') {
        const id = Number(testerId);
        if (!id) return res.status(400).json({ message: 'معرّف الطلب غير صالح' });
        const { data: updated, error } = await supabaseAdmin
          .from('app_testers')
          .update({ status: 'REJECTED', updatedAt: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'تم رفض الطلب', tester: updated });
      }

      if (subAction === 'reset-status') {
        const id = Number(testerId);
        if (!id) return res.status(400).json({ message: 'معرّف الطلب غير صالح' });
        const { data: updated, error } = await supabaseAdmin
          .from('app_testers')
          .update({ status: 'PENDING', updatedAt: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'تم إعادة حالة الطلب إلى قيد الانتظار', tester: updated });
      }

      if (subAction === 'delete') {
        const id = Number(testerId);
        if (!id) return res.status(400).json({ message: 'معرّف الطلب غير صالح' });
        await supabaseAdmin.from('app_testers').delete().eq('id', id);
        return res.status(200).json({ success: true, message: 'تم حذف الطلب بنجاح' });
      }

      if (subAction === 'approve-all') {
        await supabaseAdmin
          .from('app_testers')
          .update({ status: 'APPROVED', updatedAt: new Date().toISOString() })
          .or('status.eq.PENDING,status.is.null');
        return res.status(200).json({ success: true, message: 'تم قبول جميع الطلبات المعلقة بنجاح' });
      }

      if (subAction === 'clear-approved' || subAction === 'mark-copied') {
        const { data: resData } = await supabaseAdmin
          .from('app_testers')
          .update({ status: 'EXPORTED', updatedAt: new Date().toISOString() })
          .eq('status', 'APPROVED')
          .select();
        const count = resData?.length || 0;
        return res.status(200).json({
          success: true,
          message: `تم نسخ وإزالة ${count} إيميل من قائمة المقبولين بنجاح حتى لا تتكرر في Google Play`,
          count
        });
      }

      if (subAction === 'delete-approved') {
        const { data: resData } = await supabaseAdmin
          .from('app_testers')
          .delete()
          .or('status.eq.APPROVED,status.eq.EXPORTED,status.eq.ADDED')
          .select();
        const count = resData?.length || 0;
        return res.status(200).json({
          success: true,
          message: `تم حذف ${count} مختبر نهائياً من قاعدة البيانات`,
          count
        });
      }

      if (subAction === 'reset-to-approved') {
        const id = Number(testerId);
        if (!id) return res.status(400).json({ message: 'معرّف الطلب غير صالح' });
        const { data: updated, error } = await supabaseAdmin
          .from('app_testers')
          .update({ status: 'APPROVED', updatedAt: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'تمت إعادة الطلب إلى قائمة المقبولين للنسخ', tester: updated });
      }

      if (subAction === 'add-manual') {
        const clean = (email || '').trim().toLowerCase();
        if (!clean || !clean.includes('@') || !clean.includes('.')) {
          return res.status(400).json({ message: 'يرجى إدخال بريد إلكتروني صحيح' });
        }
        const { data: tester, error } = await supabaseAdmin
          .from('app_testers')
          .upsert({ email: clean, name: clean.split('@')[0], status: 'APPROVED', updatedAt: new Date().toISOString() }, { onConflict: 'email' })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'تمت إضافة البريد واعتماده بنجاح', tester });
      }

      return res.status(400).json({ message: 'إجراء غير معروف' });
    } catch (err: any) {
      console.error('Testers action error:', err);
      return res.status(500).json({ message: err.message || 'حدث خطأ أثناء معالجة الطلب' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
