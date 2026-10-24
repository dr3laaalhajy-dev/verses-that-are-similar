import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || (req.body && req.body.action)

  // Actions that DON'T require auth
  if (req.method === 'POST' && action === 'login') {
    return handleLogin(req, res)
  }
  if (req.method === 'POST' && action === 'register') {
    return handleRegister(req, res)
  }

  // Authorization check for all other actions
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET)
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' })
  }

  // Fetch current admin directly from DB for verified and authoritative role
  const currentAdmin = await prisma.admin.findUnique({ where: { id: decoded.adminId } })
  if (!currentAdmin) {
    return res.status(401).json({ message: 'حساب المشرف غير موجود' })
  }

  // Auto-protect and ensure alaa is FOUNDER
  if ((currentAdmin.username.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء') && currentAdmin.role !== 'FOUNDER') {
    currentAdmin.role = 'FOUNDER'
    currentAdmin.isSuperAdmin = true
    await prisma.admin.update({
      where: { id: currentAdmin.id },
      data: { role: 'FOUNDER', isSuperAdmin: true }
    })
  }

  // General permission check: only FOUNDER or CO_FOUNDER can manage/invite/manage testers
  const isPrivileged = currentAdmin.role === 'FOUNDER' || currentAdmin.role === 'CO_FOUNDER'
  if ((action === 'invite' || action === 'manage' || action === 'change-password' || action === 'testers') && !isPrivileged) {
    return res.status(403).json({ message: 'هذا الإجراء مسموح للمؤسس ومساعدي المؤسس فقط' })
  }

  const isFounder = currentAdmin.role === 'FOUNDER' || currentAdmin.username.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء'
  const canManageUsers = isFounder || (currentAdmin.role === 'CO_FOUNDER' && currentAdmin.canManageUsers)

  if (action === 'users' && !canManageUsers) {
    return res.status(403).json({ message: 'ليس لديك صلاحية لإدارة المستخدمين' })
  }

  if (action === 'toggle-user-permission' && !isFounder) {
    return res.status(403).json({ message: 'تعديل صلاحيات إدارة المستخدمين متاح للمؤسس فقط' })
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
      })
    case 'invite':
      return handleInvite(req, res, currentAdmin)
    case 'manage':
      return handleManage(req, res, currentAdmin)
    case 'change-password':
      return handleChangePassword(req, res, currentAdmin)
    case 'users':
      return handleUsers(req, res, currentAdmin)
    case 'toggle-user-permission':
      return handleToggleUserPermission(req, res, currentAdmin)
    case 'testers':
      return handleTesters(req, res, currentAdmin)
    default:
      return res.status(400).json({ message: 'Invalid action' })
  }
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة' })

  const rawUsername = (username || '').trim()
  const cleanUsername = rawUsername.replace(/^@+/, '')

  try {
    let admin = await prisma.admin.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { username: `@${cleanUsername}` },
          { username: rawUsername }
        ]
      }
    })
    const adminCount = await prisma.admin.count()
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash(password, 10)
      admin = await prisma.admin.create({
        data: { username: cleanUsername, name: cleanUsername, password: hashedPassword, isSuperAdmin: true, role: 'FOUNDER' }
      })
    }

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' })
    }

    // Ensure 'alaa' / 'علاء' is always FOUNDER
    const isAlaa = admin.username.toLowerCase() === 'alaa' || admin.username === 'علاء' || cleanUsername.toLowerCase() === 'alaa' || cleanUsername === 'علاء'
    const effectiveRole = isAlaa ? 'FOUNDER' : (admin.role || 'ADMIN')
    const isSuper = effectiveRole === 'FOUNDER' || effectiveRole === 'CO_FOUNDER'

    if (isAlaa && admin.role !== 'FOUNDER') {
      await prisma.admin.update({ where: { id: admin.id }, data: { role: 'FOUNDER', isSuperAdmin: true } })
      admin.role = 'FOUNDER'
    }

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, isSuperAdmin: isSuper, role: effectiveRole },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(200).json({
      token,
      username: admin.username,
      name: admin.name || admin.username,
      adminId: admin.id,
      isSuperAdmin: isSuper,
      role: effectiveRole,
      canManageUsers: isAlaa || effectiveRole === 'FOUNDER' || !!admin.canManageUsers
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ message: 'حدث خطأ في تسجيل الدخول' })
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  const { username, password, code, name } = req.body
  if (!username || !password || !code) return res.status(400).json({ message: 'جميع الحقول مطلوبة' })

  const rawUsername = (username || '').trim()
  const cleanUsername = rawUsername.replace(/^@+/, '')

  try {
    const adminCode = await prisma.adminCode.findUnique({ where: { code: code.toUpperCase() } })
    if (!adminCode || adminCode.isUsed) return res.status(400).json({ message: 'كود التسجيل غير صحيح أو مستخدم' })

    const existing = await prisma.admin.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { username: `@${cleanUsername}` },
          { username: rawUsername }
        ]
      }
    })
    if (existing) return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' })

    const hashedPassword = await bcrypt.hash(password, 10)
    const assignedRole = adminCode.role === 'CO_FOUNDER' || adminCode.role === 'SUPERADMIN' ? 'CO_FOUNDER' : 'ADMIN'

    const admin = await prisma.admin.create({
      data: {
        username: cleanUsername,
        name: name?.trim() || cleanUsername,
        password: hashedPassword,
        isSuperAdmin: assignedRole === 'CO_FOUNDER',
        role: assignedRole
      }
    })
    await prisma.adminCode.update({ where: { id: adminCode.id }, data: { isUsed: true } })

    return res.status(201).json({ message: 'تم التسجيل بنجاح!', username: admin.username, name: admin.name, role: admin.role })
  } catch (error) {
    console.error('Register error:', error)
    return res.status(500).json({ message: 'حدث خطأ أثناء التسجيل' })
  }
}

async function handleInvite(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method === 'GET') {
    const codes = await prisma.adminCode.findMany({ orderBy: { createdAt: 'desc' } })
    return res.status(200).json(codes)
  }
  if (req.method === 'POST') {
    const { role } = req.body
    
    // Only FOUNDER can create CO_FOUNDER invite codes
    if (role === 'CO_FOUNDER' && currentAdmin.role !== 'FOUNDER') {
      return res.status(403).json({ message: 'فقط المؤسس يمكنه توليد كود دعوة لمساعد مؤسس' })
    }

    const code = uuidv4().substring(0, 8).toUpperCase()
    const newCode = await prisma.adminCode.create({
      data: {
        code,
        role: role === 'CO_FOUNDER' ? 'CO_FOUNDER' : 'ADMIN'
      }
    })
    return res.status(201).json(newCode)
  }
  if (req.method === 'DELETE') {
    const { id } = req.query
    await prisma.adminCode.delete({ where: { id: parseInt(id as string) } })
    return res.status(200).json({ message: 'Deleted' })
  }
}

async function handleManage(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method === 'GET') {
    const admins = await prisma.admin.findMany({
      select: { id: true, username: true, name: true, isSuperAdmin: true, role: true, canManageUsers: true },
      orderBy: { id: 'asc' }
    })
    // Ensure alaa is always shown as FOUNDER
    let mapped = admins.map(a => ({
      ...a,
      role: (a.username.toLowerCase() === 'alaa' || a.username === 'علاء') ? 'FOUNDER' : (a.role || 'ADMIN'),
      canManageUsers: (a.username.toLowerCase() === 'alaa' || a.username === 'علاء' || a.role === 'FOUNDER') ? true : !!a.canManageUsers
    }))

    // Only the Founder himself can see the Founder card
    const isCallerFounder = currentAdmin.role === 'FOUNDER' || currentAdmin.username.toLowerCase() === 'alaa' || currentAdmin.username === 'علاء'
    if (!isCallerFounder) {
      mapped = mapped.filter(a => a.role !== 'FOUNDER' && a.username.toLowerCase() !== 'alaa' && a.username !== 'علاء')
    }

    return res.status(200).json(mapped)
  }

  if (req.method === 'POST') {
    const { username, password, role: targetRole, isSuperAdmin, name } = req.body
    if (!username || !password) return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة' })

    const rawUsername = (username || '').trim()
    const cleanUsername = rawUsername.replace(/^@+/, '')

    const existing = await prisma.admin.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { username: `@${cleanUsername}` },
          { username: rawUsername }
        ]
      }
    })
    if (existing) return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' })

    // Role appointment permissions
    let assignedRole = 'ADMIN'
    if (targetRole === 'CO_FOUNDER') {
      if (currentAdmin.role !== 'FOUNDER') {
        return res.status(403).json({ message: 'فقط المؤسس (علاء) يمكنه تعيين مساعد مؤسس' })
      }
      assignedRole = 'CO_FOUNDER'
    } else if (targetRole === 'FOUNDER') {
      return res.status(403).json({ message: 'لا يمكن تعيين مؤسس إضافي' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const admin = await prisma.admin.create({
      data: {
        username: cleanUsername,
        name: name?.trim() || cleanUsername,
        password: hashedPassword,
        isSuperAdmin: assignedRole === 'CO_FOUNDER' || !!isSuperAdmin,
        role: assignedRole
      }
    })
    return res.status(201).json({ id: admin.id, username: admin.username, name: admin.name, role: admin.role, isSuperAdmin: admin.isSuperAdmin })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    const targetId = parseInt(id as string)
    const targetAdmin = await prisma.admin.findUnique({ where: { id: targetId } })
    if (!targetAdmin) return res.status(404).json({ message: 'المشرف غير موجود' })

    // 1. ABSOLUTE PROTECTION FOR FOUNDER: NOBODY CAN DELETE ALAA
    const isTargetFounder = targetAdmin.role === 'FOUNDER' || targetAdmin.username.toLowerCase() === 'alaa' || targetAdmin.username === 'علاء'
    if (isTargetFounder) {
      return res.status(403).json({ message: 'خط أحمر: لا يمكن حذف حساب المؤسس (علاء) نهائياً' })
    }

    // 2. Co-Founder cannot delete other Co-Founders or Founder
    if (targetAdmin.role === 'CO_FOUNDER') {
      if (currentAdmin.role !== 'FOUNDER') {
        return res.status(403).json({ message: 'فقط المؤسس يمكنه حذف مساعد المؤسس' })
      }
    }

    // 3. Regular admin cannot delete anyone
    if (currentAdmin.role !== 'FOUNDER' && currentAdmin.role !== 'CO_FOUNDER') {
      return res.status(403).json({ message: 'ليس لديك صلاحية لحذف المشرفين' })
    }

    await prisma.admin.delete({ where: { id: targetId } })
    return res.status(200).json({ message: 'تم حذف المشرف بنجاح' })
  }

  if (req.method === 'PATCH') {
    return handleChangePassword(req, res, currentAdmin)
  }
}

async function handleChangePassword(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  const { id, newPassword } = req.body
  if (!id || !newPassword) {
    return res.status(400).json({ message: 'معرف المشرف وكلمة المرور الجديدة مطلوبة' })
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 4 خانات' })
  }

  const targetId = parseInt(id.toString())
  const targetAdmin = await prisma.admin.findUnique({ where: { id: targetId } })
  if (!targetAdmin) return res.status(404).json({ message: 'المشرف غير موجود' })

  const isTargetFounder = targetAdmin.role === 'FOUNDER' || targetAdmin.username.toLowerCase() === 'alaa' || targetAdmin.username === 'علاء'

  // Founder password can ONLY be changed by Founder themselves
  if (isTargetFounder && currentAdmin.id !== targetAdmin.id) {
    return res.status(403).json({ message: 'لا يمكن تعديل كلمة مرور المؤسس إلا من قبل المؤسس نفسه' })
  }

  // Co-Founder password can only be changed by Founder or by the Co-Founder themselves
  if (targetAdmin.role === 'CO_FOUNDER' && currentAdmin.role !== 'FOUNDER' && currentAdmin.id !== targetAdmin.id) {
    return res.status(403).json({ message: 'فقط المؤسس يمكنه تعديل كلمة مرور مساعد المؤسس' })
  }

  // Co-Founder can change regular ADMIN passwords
  if (currentAdmin.role === 'CO_FOUNDER') {
    if (targetAdmin.role !== 'ADMIN' && currentAdmin.id !== targetAdmin.id) {
      return res.status(403).json({ message: 'مساعد المؤسس يمكنه تعديل كلمات مرور المشرفين العاديين فقط' })
    }
  } else if (currentAdmin.role !== 'FOUNDER' && currentAdmin.id !== targetAdmin.id) {
    return res.status(403).json({ message: 'ليس لديك صلاحية لتعديل كلمة مرور هذا المشرف' })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.admin.update({
    where: { id: targetId },
    data: { password: hashedPassword }
  })

  return res.status(200).json({ message: `تم تغيير كلمة المرور للمشرف (${targetAdmin.username}) بنجاح` })
}

async function handleUsers(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method === 'GET') {
    const search = (req.query.search as string || '').trim();
    const players = await prisma.player.findMany({
      where: search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } }
        ]
      } : undefined,
      orderBy: [
        { cups: 'desc' },
        { points: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        name: true,
        username: true,
        points: true,
        cups: true,
        isBlocked: true,
        activeFrame: true,
        seerahCompleted: true,
        generalCompleted: true,
        quranCompleted: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return res.status(200).json(players);
  }

  if (req.method === 'POST') {
    const { subAction, id, name, username, points, cups, newPassword, isBlocked } = req.body;
    if (!id) return res.status(400).json({ message: 'معرف المستخدم مطلوب' });

    const player = await prisma.player.findUnique({ where: { id: Number(id) } });
    if (!player) return res.status(404).json({ message: 'المستخدم غير موجود' });

    if (subAction === 'update-info') {
      const cleanU = (username || '').trim().replace(/^@+/, '');
      const cleanN = (name || '').trim();

      if (cleanU && cleanU !== player.username?.replace(/^@+/, '')) {
        const existing = await prisma.player.findFirst({
          where: {
            OR: [{ username: cleanU }, { username: '@' + cleanU }],
            NOT: { id: player.id }
          }
        });
        if (existing) {
          return res.status(400).json({ message: 'اسم المستخدم هذا مستخدم بالفعل لمستخدم آخر' });
        }
      }

      const updated = await prisma.player.update({
        where: { id: player.id },
        data: {
          ...(cleanN ? { name: cleanN } : {}),
          ...(cleanU ? { username: cleanU } : {}),
          ...(points !== undefined ? { points: Number(points) } : {}),
          ...(cups !== undefined ? { cups: Number(cups) } : {})
        }
      });
      return res.status(200).json({ success: true, message: 'تم تحديث بيانات المستخدم بنجاح', player: updated });
    }

    if (subAction === 'reset-password') {
      if (!newPassword || !String(newPassword).trim()) {
        return res.status(400).json({ message: 'كلمة المرور الجديدة مطلوبة' });
      }
      await prisma.player.update({
        where: { id: player.id },
        data: { password: String(newPassword).trim() }
      });
      return res.status(200).json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
    }

    if (subAction === 'toggle-block') {
      const updated = await prisma.player.update({
        where: { id: player.id },
        data: { isBlocked: Boolean(isBlocked) }
      });
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

    // Safely delete associated rooms
    await prisma.room.deleteMany({
      where: {
        OR: [
          { player1Id: id },
          { player2Id: id },
          { winnerId: id }
        ]
      }
    }).catch(() => {});

    await prisma.player.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'تم حذف حساب المستخدم نهائياً' });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

async function handleToggleUserPermission(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { adminId, canManageUsers } = req.body;
  if (!adminId) return res.status(400).json({ message: 'معرف المشرف مطلوب' });

  const targetAdmin = await prisma.admin.findUnique({ where: { id: Number(adminId) } });
  if (!targetAdmin) return res.status(404).json({ message: 'المشرف غير موجود' });

  const updated = await prisma.admin.update({
    where: { id: targetAdmin.id },
    data: { canManageUsers: Boolean(canManageUsers) }
  });

  return res.status(200).json({
    success: true,
    message: updated.canManageUsers ? 'تم منح صلاحية إدارة المستخدمين' : 'تم سحب صلاحية إدارة المستخدمين',
    admin: updated
  });
}

async function handleTesters(req: VercelRequest, res: VercelResponse, currentAdmin: any) {
  if (req.method === 'GET') {
    try {
      const testers = await (prisma as any).appTester.findMany({
        orderBy: { createdAt: 'desc' }
      });
      const approvedTesters = testers.filter((t: any) => t.status === 'APPROVED');
      const pendingTesters = testers.filter((t: any) => t.status === 'PENDING' || !t.status);
      const rejectedTesters = testers.filter((t: any) => t.status === 'REJECTED');
      const approvedEmails = approvedTesters.map((t: any) => t.email);

      return res.status(200).json({
        success: true,
        testers,
        stats: {
          total: testers.length,
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
        const updated = await (prisma as any).appTester.update({
          where: { id },
          data: { status: 'APPROVED', approvedAt: new Date() }
        });
        return res.status(200).json({ success: true, message: 'تم قبول طلب المختبر بنجاح', tester: updated });
      }

      if (subAction === 'reject') {
        const id = Number(testerId);
        if (!id) return res.status(400).json({ message: 'معرّف الطلب غير صالح' });
        const updated = await (prisma as any).appTester.update({
          where: { id },
          data: { status: 'REJECTED' }
        });
        return res.status(200).json({ success: true, message: 'تم رفض الطلب', tester: updated });
      }

      if (subAction === 'reset-status') {
        const id = Number(testerId);
        if (!id) return res.status(400).json({ message: 'معرّف الطلب غير صالح' });
        const updated = await (prisma as any).appTester.update({
          where: { id },
          data: { status: 'PENDING' }
        });
        return res.status(200).json({ success: true, message: 'تم إعادة حالة الطلب إلى قيد الانتظار', tester: updated });
      }

      if (subAction === 'delete') {
        const id = Number(testerId);
        if (!id) return res.status(400).json({ message: 'معرّف الطلب غير صالح' });
        await (prisma as any).appTester.delete({
          where: { id }
        });
        return res.status(200).json({ success: true, message: 'تم حذف الطلب بنجاح' });
      }

      if (subAction === 'approve-all') {
        await (prisma as any).appTester.updateMany({
          where: {
            OR: [
              { status: 'PENDING' },
              { status: null as any }
            ]
          },
          data: { status: 'APPROVED', approvedAt: new Date() }
        });
        return res.status(200).json({ success: true, message: 'تم قبول جميع الطلبات المعلقة بنجاح' });
      }

      if (subAction === 'add-manual') {
        const clean = (email || '').trim().toLowerCase();
        if (!clean || !clean.includes('@') || !clean.includes('.')) {
          return res.status(400).json({ message: 'يرجى إدخال بريد إلكتروني صحيح' });
        }
        const tester = await (prisma as any).appTester.upsert({
          where: { email: clean },
          update: { status: 'APPROVED', approvedAt: new Date() },
          create: { email: clean, status: 'APPROVED', approvedAt: new Date() }
        });
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

