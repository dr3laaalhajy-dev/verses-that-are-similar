import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import bcrypt from 'bcryptjs';
import { signAdminToken, verifyAdminToken } from './_lib/jwt.js';
import { v4 as uuidv4 } from 'uuid';
import {
  hashPassword,
  isUsableLookupValue,
  escapeLikePattern,
  searchContains,
  isAcceptableNewUsername,
  findUsernameOwnerId,
  toSafePlayer,
  toSafeAdmin,
  MIN_NEW_PASSWORD_LENGTH,
  NEW_PASSWORD_TOO_SHORT_MESSAGE
} from './_lib/playerSecurity.js';

const RESERVED_USERNAMES = ['alaa', 'علاء', 'founder', 'المؤسس', 'superadmin', 'admin', 'root', 'system'];

/**
 * Finds an admin by username without filter injection:
 * exact .eq() first, then a case-insensitive .ilike() with wildcards escaped (literal match).
 */
async function findAdminByUsername(username: string, columns: string) {
  const clean = (username || '').trim();
  if (!clean) return null;
  const { data: exact } = await supabaseAdmin
    .from('admins')
    .select(columns)
    .eq('username', clean)
    .limit(1)
    .maybeSingle();
  if (exact) return exact as any;
  if (!isUsableLookupValue(clean)) return null;
  const { data: ci } = await supabaseAdmin
    .from('admins')
    .select(columns)
    .ilike('username', escapeLikePattern(clean))
    .limit(1)
    .maybeSingle();
  return (ci as any) || null;
}

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
    decoded = verifyAdminToken(token);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  // Fetch current admin directly from Supabase
  const { data: currentAdmin, error: adminErr } = await supabaseAdmin
    .from('admins')
    .select('id, username, name, role, isSuperAdmin, canManageUsers')
    .eq('id', decoded.adminId)
    .maybeSingle();

  if (adminErr || !currentAdmin) {
    return res.status(401).json({ message: 'حساب المشرف غير موجود' });
  }

  const isFounder = currentAdmin.role === 'FOUNDER';
  const isPrivileged = isFounder || currentAdmin.role === 'CO_FOUNDER';

  // Privileged actions restriction (change-password is open to any authenticated admin to change their own password)
  if ((action === 'invite' || action === 'manage' || action === 'testers') && !isPrivileged) {
    return res.status(403).json({ message: 'هذا الإجراء مسموح للمؤسس ومساعدي المؤسس فقط' });
  }

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
        role: currentAdmin.role || 'ADMIN',
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
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة' });

  const rawUsername = String(username || '').trim();
  const cleanUsername = rawUsername.replace(/^@+/, '');

  try {
    const admin = await findAdminByUsername(cleanUsername, 'id, username, name, password, role, isSuperAdmin, canManageUsers');

    if (!admin || typeof admin.password !== 'string' || !admin.password || !(await bcrypt.compare(String(password), admin.password))) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const effectiveRole = admin.role || 'ADMIN';
    const isSuper = effectiveRole === 'FOUNDER' || effectiveRole === 'CO_FOUNDER' || !!admin.isSuperAdmin;

    const token = signAdminToken(
      { adminId: admin.id, username: admin.username, isSuperAdmin: isSuper, role: effectiveRole },
      '7d'
    );

    return res.status(200).json({
      token,
      username: admin.username,
      name: admin.name || admin.username,
      adminId: admin.id,
      isSuperAdmin: isSuper,
      role: effectiveRole,
      canManageUsers: effectiveRole === 'FOUNDER' || !!admin.canManageUsers
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'حدث خطأ في تسجيل الدخول' });
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  const { username, password, code, name } = req.body || {};
  if (!username || !password || !code) return res.status(400).json({ message: 'جميع الحقول مطلوبة' });

  const rawUsername = String(username || '').trim();
  const cleanUsername = rawUsername.replace(/^@+/, '');

  if (!isAcceptableNewUsername(cleanUsername)) {
    return res.status(400).json({ message: 'اسم المستخدم يحتوي على رموز غير مسموحة' });
  }

  if (RESERVED_USERNAMES.includes(cleanUsername.toLowerCase())) {
    return res.status(400).json({ message: 'اسم مستخدم غير متاح أو محجوز' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 8 خانات' });
  }

  try {
    const cleanCode = String(code).trim().toUpperCase();
    const { data: adminCode } = await supabaseAdmin
      .from('admin_codes')
      .select('*')
      .eq('code', cleanCode)
      .eq('isUsed', false)
      .maybeSingle();

    if (!adminCode) return res.status(400).json({ message: 'كود التسجيل غير صحيح أو تم استخدامه مسبقاً' });

    const existing = await findAdminByUsername(cleanUsername, 'id');

    if (existing) return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' });

    // Atomically mark code as used to prevent concurrency race conditions
    const { data: updatedCode, error: codeErr } = await supabaseAdmin
      .from('admin_codes')
      .update({ isUsed: true, usedAt: new Date().toISOString() })
      .eq('id', adminCode.id)
      .eq('isUsed', false)
      .select()
      .maybeSingle();

    if (codeErr || !updatedCode) {
      return res.status(400).json({ message: 'كود التسجيل مستخدم بالفعل أو انتهت صلاحيته' });
    }

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
      .select('id, username, name, role, isSuperAdmin, canManageUsers, createdAt')
      .single();

    if (createErr) {
      console.error('Create admin error:', createErr);
      return res.status(500).json({ message: 'حدث خطأ أثناء إنشاء حساب المشرف' });
    }

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
    const { role } = req.body || {};
    
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

    if (error) {
      console.error('Invite code creation error:', error);
      return res.status(500).json({ message: 'فشل في توليد كود الدعوة' });
    }
    return res.status(201).json(newCode);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    await supabaseAdmin.from('admin_codes').delete().eq('id', parseInt(id as string));
    return res.status(200).json({ message: 'Deleted' });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

async function handleManage(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method === 'GET') {
    const { data: admins } = await supabaseAdmin
      .from('admins')
      .select('id, username, name, isSuperAdmin, role, canManageUsers')
      .order('id', { ascending: true });

    let mapped = (admins || []).map(a => ({
      ...a,
      role: a.role || 'ADMIN',
      canManageUsers: a.role === 'FOUNDER' ? true : !!a.canManageUsers
    }));

    const isCallerFounder = currentAdmin.role === 'FOUNDER';
    if (!isCallerFounder) {
      mapped = mapped.filter(a => a.role !== 'FOUNDER');
    }

    return res.status(200).json(mapped);
  }

  if (req.method === 'POST') {
    const { username, password, role: targetRole, isSuperAdmin, name } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة' });

    const rawUsername = String(username || '').trim();
    const cleanUsername = rawUsername.replace(/^@+/, '');

    if (!isAcceptableNewUsername(cleanUsername)) {
      return res.status(400).json({ message: 'اسم المستخدم يحتوي على رموز غير مسموحة' });
    }

    if (RESERVED_USERNAMES.includes(cleanUsername.toLowerCase())) {
      return res.status(400).json({ message: 'اسم مستخدم غير متاح أو محجوز' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 8 خانات' });
    }

    const existing = await findAdminByUsername(cleanUsername, 'id');

    if (existing) return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' });

    let assignedRole = 'ADMIN';
    if (targetRole === 'CO_FOUNDER') {
      if (currentAdmin.role !== 'FOUNDER') {
        return res.status(403).json({ message: 'فقط المؤسس يمكنه تعيين مساعد مؤسس' });
      }
      assignedRole = 'CO_FOUNDER';
    } else if (targetRole === 'FOUNDER') {
      return res.status(403).json({ message: 'لا يمكن تعيين مؤسس إضافي' });
    }

    // isSuperAdmin can only be explicitly granted by the FOUNDER
    const canAssignSuper = currentAdmin.role === 'FOUNDER';
    const assignedSuper = canAssignSuper ? (assignedRole === 'CO_FOUNDER' || Boolean(isSuperAdmin)) : false;

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .insert({
        username: cleanUsername,
        name: name?.trim() || cleanUsername,
        password: hashedPassword,
        isSuperAdmin: assignedSuper,
        role: assignedRole
      })
      .select('id, username, name, role, isSuperAdmin, canManageUsers, createdAt')
      .single();

    if (error) {
      console.error('Manage create admin error:', error);
      return res.status(500).json({ message: 'فشل إنشاء المشرف' });
    }
    return res.status(201).json({ id: admin.id, username: admin.username, name: admin.name, role: admin.role, isSuperAdmin: admin.isSuperAdmin });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const targetId = parseInt(id as string);

    const { data: targetAdmin } = await supabaseAdmin
      .from('admins')
      .select('id, username, role')
      .eq('id', targetId)
      .maybeSingle();

    if (!targetAdmin) return res.status(404).json({ message: 'المشرف غير موجود' });

    if (targetAdmin.role === 'FOUNDER') {
      return res.status(403).json({ message: 'خط أحمر: لا يمكن حذف حساب المؤسس نهائياً' });
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

  return res.status(405).json({ message: 'Method not allowed' });
}

async function handleChangePassword(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  const { id, newPassword } = req.body || {};
  if (!id || !newPassword) {
    return res.status(400).json({ message: 'معرف المشرف وكلمة المرور الجديدة مطلوبة' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 8 خانات' });
  }

  const targetId = parseInt(id.toString());
  const { data: targetAdmin } = await supabaseAdmin
    .from('admins')
    .select('id, username, role')
    .eq('id', targetId)
    .maybeSingle();

  if (!targetAdmin) return res.status(404).json({ message: 'المشرف غير موجود' });

  // 1. Target is FOUNDER: only founder can change their own password
  if (targetAdmin.role === 'FOUNDER' && currentAdmin.id !== targetAdmin.id) {
    return res.status(403).json({ message: 'لا يمكن تعديل كلمة مرور المؤسس إلا من قبل المؤسس نفسه' });
  }

  // 2. Target is CO_FOUNDER: founder can change, or co-founder themselves
  if (targetAdmin.role === 'CO_FOUNDER' && currentAdmin.role !== 'FOUNDER' && currentAdmin.id !== targetAdmin.id) {
    return res.status(403).json({ message: 'فقط المؤسس يمكنه تعديل كلمة مرور مساعد المؤسس' });
  }

  // 3. Regular admin: founder or co-founder or admin themselves can change
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
    const search = String(req.query.search || '').trim();
    const baseQuery = () => supabaseAdmin
      .from('players')
      .select('id, name, username, points, cups, isBlocked, activeFrame, seerahCompleted, generalCompleted, quranCompleted, createdAt, updatedAt')
      .order('cups', { ascending: false })
      .order('points', { ascending: false })
      .order('createdAt', { ascending: false });

    let players: any[] | null = null;
    let error: any = null;
    if (search) {
      // Separate escaped .ilike() searches instead of a string-built .or(); re-sorted like the base query
      try {
        players = (await searchContains(baseQuery, ['name', 'username'], search)).sort((a, b) =>
          (Number(b.cups) || 0) - (Number(a.cups) || 0)
          || (Number(b.points) || 0) - (Number(a.points) || 0)
          || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );
      } catch (e: any) {
        error = e;
      }
    } else {
      const r = await baseQuery();
      players = r.data;
      error = r.error;
    }
    if (error) {
      console.error('[Admin handleUsers GET error]:', error);
      return res.status(500).json({ message: 'فشل جلب المستخدمين' });
    }
    return res.status(200).json((players || []).map(toSafePlayer));
  }

  if (req.method === 'POST') {
    const { subAction, id, name, username, points, cups, newPassword, isBlocked } = req.body || {};
    if (!id) return res.status(400).json({ message: 'معرف المستخدم مطلوب' });

    const { data: player, error: fetchErr } = await supabaseAdmin
      .from('players')
      .select('id, name, username')
      .eq('id', Number(id))
      .maybeSingle();

    if (fetchErr || !player) return res.status(404).json({ message: 'المستخدم غير موجود' });

    if (subAction === 'update-info') {
      const cleanU = String(username || '').trim().replace(/^@+/, '');
      const cleanN = String(name || '').trim();

      if (cleanU && !isAcceptableNewUsername(cleanU)) {
        return res.status(400).json({ message: 'اسم المستخدم يحتوي على رموز غير مسموحة' });
      }

      if (cleanU && cleanU !== player.username?.replace(/^@+/, '')) {
        const existing = await findUsernameOwnerId(supabaseAdmin, cleanU, player.id);
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
        .select('id, name, username, points, cups, isBlocked, activeFrame, seerahCompleted, generalCompleted, quranCompleted, createdAt, updatedAt')
        .single();

      if (updateErr) {
        console.error('[Admin update-info error]:', updateErr);
        return res.status(500).json({ message: 'فشل تحديث بيانات المستخدم' });
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.status(200).json({ success: true, message: 'تم تحديث بيانات المستخدم بنجاح', player: toSafePlayer(updated) });
    }

    if (subAction === 'reset-password') {
      const trimmedPass = String(newPassword || '').trim();
      if (!trimmedPass || trimmedPass.length < MIN_NEW_PASSWORD_LENGTH) {
        return res.status(400).json({ message: NEW_PASSWORD_TOO_SHORT_MESSAGE });
      }
      const hashedReset = await hashPassword(trimmedPass);
      const { error: resetErr } = await supabaseAdmin
        .from('players')
        .update({ password: hashedReset, updatedAt: new Date().toISOString() })
        .eq('id', player.id);

      if (resetErr) {
        console.error('[Admin reset password error]:', resetErr);
        return res.status(500).json({ message: 'فشل إعادة تعيين كلمة المرور' });
      }
      return res.status(200).json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
    }

    if (subAction === 'toggle-block') {
      const { data: updated, error: blockErr } = await supabaseAdmin
        .from('players')
        .update({ isBlocked: Boolean(isBlocked), updatedAt: new Date().toISOString() })
        .eq('id', player.id)
        .select('id, name, username, points, cups, isBlocked, activeFrame, seerahCompleted, generalCompleted, quranCompleted, createdAt, updatedAt')
        .single();

      if (blockErr) {
        console.error('[Admin toggle block error]:', blockErr);
        return res.status(500).json({ message: 'فشل تغيير حالة الحظر' });
      }

      return res.status(200).json({
        success: true,
        message: updated.isBlocked ? 'تم حظر المستخدم ومنعه من تسجيل الدخول' : 'تم إلغاء حظر المستخدم بنجاح',
        player: toSafePlayer(updated)
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

    try {
      await supabaseAdmin
        .from('challenge_progress')
        .delete()
        .eq('user_id', id);
    } catch (_) {}

    try {
      await supabaseAdmin
        .from('certificates')
        .delete()
        .eq('user_id', id);
    } catch (_) {}

    const { error: delErr } = await supabaseAdmin
      .from('players')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error('[Admin delete player error]:', delErr);
      return res.status(500).json({ message: 'فشل حذف حساب المستخدم' });
    }
    return res.status(200).json({ success: true, message: 'تم حذف حساب المستخدم نهائياً' });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

async function handleToggleUserPermission(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { adminId, canManageUsers } = req.body || {};
  if (!adminId) return res.status(400).json({ message: 'معرف المشرف مطلوب' });

  const { data: targetAdmin } = await supabaseAdmin
    .from('admins')
    .select('id, username')
    .eq('id', Number(adminId))
    .maybeSingle();

  if (!targetAdmin) return res.status(404).json({ message: 'المشرف غير موجود' });

  const { data: updated, error } = await supabaseAdmin
    .from('admins')
    .update({ canManageUsers: Boolean(canManageUsers), updatedAt: new Date().toISOString() })
    .eq('id', targetAdmin.id)
    .select('id, username, name, role, isSuperAdmin, canManageUsers, updatedAt')
    .single();

  if (error) {
    console.error('Toggle permission error:', error);
    return res.status(500).json({ message: 'فشل تعديل صلاحيات المشرف' });
  }

  return res.status(200).json({
    success: true,
    message: updated.canManageUsers ? 'تم منح صلاحية إدارة المستخدمين' : 'تم سحب صلاحية إدارة المستخدمين',
    admin: toSafeAdmin(updated)
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
      return res.status(500).json({ message: 'حدث خطأ أثناء معالجة الطلب' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}