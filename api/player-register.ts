import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'
import { handleCors } from './_lib/cors.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const {
    action,
    name,
    username,
    currentUsername,
    currentName,
    password,
    currentPassword,
    newPassword
  } = req.body || {};

  try {
    // ==========================================
    // 1. LOGIN MODE (تسجيل الدخول لحساب موجود)
    // ==========================================
    if (action === 'login') {
      const rawIdentifier = (username || name || '').trim();
      const cleanIdentifier = rawIdentifier.replace(/^@+/, '');
      const inputPass = (password || '').trim();

      if (!rawIdentifier || !inputPass) {
        return res.status(400).json({
          error: 'يرجى إدخال اسم المستخدم وكلمة المرور'
        });
      }

      // Find player by username (with or without @) or display name
      const player = await prisma.player.findFirst({
        where: {
          OR: [
            { username: cleanIdentifier },
            { username: '@' + cleanIdentifier },
            { username: rawIdentifier },
            { name: { equals: rawIdentifier, mode: 'insensitive' } }
          ]
        }
      });

      if (!player) {
        return res.status(401).json({
          error: 'لم يتم العثور على حساب بهذا الاسم أو اسم المستخدم'
        });
      }

      if ((player as any).isBlocked) {
        return res.status(403).json({
          error: 'تم حظر هذا الحساب من تسجيل الدخول من قِبل إدارة التطبيق'
        });
      }

      // Check password (default password for legacy users without password is '1234')
      const effectivePassword = player.password || '1234';
      if (effectivePassword !== inputPass) {
        return res.status(401).json({
          error: 'كلمة المرور غير صحيحة'
        });
      }

      return res.status(200).json({
        success: true,
        player
      });
    }

    // ==========================================
    // 2. CHANGE PASSWORD MODE (تغيير كلمة المرور)
    // ==========================================
    if (action === 'change-password') {
      const targetUser = (username || name || currentUsername || '').trim();
      const cleanUser = targetUser.replace(/^@+/, '');

      if (!cleanUser) {
        return res.status(400).json({ error: 'اسم المستخدم مطلوب لتغيير كلمة المرور' });
      }

      const curPass = (currentPassword || '').trim();
      const newPass = (newPassword || '').trim();

      if (!curPass) {
        return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية' });
      }
      if (!newPass || newPass.length < 4) {
        return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تتكون من 4 خانات على الأقل' });
      }

      const player = await prisma.player.findFirst({
        where: {
          OR: [
            { username: cleanUser },
            { username: '@' + cleanUser },
            { name: { equals: targetUser, mode: 'insensitive' } }
          ]
        }
      });

      if (!player) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب اللاعب' });
      }

      const effectivePassword = player.password || '1234';
      if (effectivePassword !== curPass) {
        return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
      }

      const updated = await prisma.player.update({
        where: { id: player.id },
        data: { password: newPass }
      });

      return res.status(200).json({
        success: true,
        message: 'تم تغيير كلمة المرور بنجاح',
        player: updated
      });
    }

    // ==========================================
    // 3. UPDATE PROFILE MODE (تغيير الاسم واسم المستخدم)
    // ==========================================
    if (action === 'update-profile') {
      const targetUser = (currentUsername || username || currentName || name || '').trim();
      const cleanTarget = targetUser.replace(/^@+/, '');

      if (!cleanTarget) {
        return res.status(400).json({ error: 'بيانات الحساب الحالي مطلوبة' });
      }

      const player = await prisma.player.findFirst({
        where: {
          OR: [
            { username: cleanTarget },
            { username: '@' + cleanTarget },
            { name: { equals: targetUser, mode: 'insensitive' } }
          ]
        }
      });

      if (!player) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب اللاعب' });
      }

      const trimmedName = (name || '').trim();
      const cleanNewUsername = (username || '').trim().replace(/^@+/, '');

      const updateData: any = {};

      // 1. Check Display Name
      if (trimmedName && trimmedName !== player.name) {
        const existingName = await prisma.player.findFirst({
          where: {
            name: { equals: trimmedName, mode: 'insensitive' },
            NOT: { id: player.id }
          }
        });
        if (existingName) {
          return res.status(400).json({ error: 'هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر' });
        }
        updateData.name = trimmedName;
      }

      // 2. Check Username
      if (cleanNewUsername && cleanNewUsername !== player.username) {
        // Enforce 30-day rule for username changes
        const changedAt = (player as any).usernameChangedAt;
        if (changedAt) {
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          const elapsed = Date.now() - new Date(changedAt).getTime();
          if (elapsed < thirtyDaysMs) {
            const daysRemaining = Math.ceil((thirtyDaysMs - elapsed) / (1000 * 60 * 60 * 24));
            return res.status(400).json({
              error: `لا يمكنك تغيير اسم المستخدم إلا بعد مرور 30 يوماً من آخر تغيير (متبقي ${daysRemaining} يوم).`,
              daysRemaining
            });
          }
        }

        // Check if username taken by another player
        const existingUsername = await prisma.player.findFirst({
          where: {
            OR: [
              { username: cleanNewUsername },
              { username: '@' + cleanNewUsername }
            ],
            NOT: { id: player.id }
          }
        });

        if (existingUsername) {
          return res.status(400).json({ error: 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم آخر' });
        }

        updateData.username = cleanNewUsername;
        updateData.usernameChangedAt = new Date();
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(200).json({
          success: true,
          message: 'لم يتم إجراء أي تغييرات',
          player
        });
      }

      const updated = await prisma.player.update({
        where: { id: player.id },
        data: updateData
      });

      return res.status(200).json({
        success: true,
        message: 'تم تحديث بيانات الحساب بنجاح',
        player: updated
      });
    }

    // ==========================================
    // 4. DELETE ACCOUNT MODE (حذف الحساب والبيانات)
    // ==========================================
    if (action === 'delete-account') {
      const rawIdentifier = (username || name || currentUsername || '').trim();
      const cleanIdentifier = rawIdentifier.replace(/^@+/, '');
      const inputPass = (password || currentPassword || '').trim();

      if (!rawIdentifier) {
        return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم أو الاسم' });
      }

      if (!inputPass) {
        return res.status(400).json({ error: 'يرجى إدخال كلمة المرور لتأكيد الحذف' });
      }

      // Find player
      const player = await prisma.player.findFirst({
        where: {
          OR: [
            { username: cleanIdentifier },
            { username: '@' + cleanIdentifier },
            { username: rawIdentifier },
            { name: { equals: rawIdentifier, mode: 'insensitive' } }
          ]
        }
      });

      if (!player) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب بهذا الاسم أو اسم المستخدم' });
      }

      // Verify password
      const effectivePassword = player.password || '1234';
      if (effectivePassword !== inputPass) {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      }

      // Delete associated rooms first to satisfy foreign key constraints
      await prisma.room.deleteMany({
        where: {
          OR: [
            { player1Id: player.id },
            { player2Id: player.id },
            { winnerId: player.id }
          ]
        }
      });

      // Delete the player
      await prisma.player.delete({
        where: { id: player.id }
      });

      return res.status(200).json({
        success: true,
        message: 'تم حذف حسابك وكافة البيانات المرتبطة به نهائياً وبنجاح'
      });
    }

    // ==========================================
    // 5. REGISTER MODE (إنشاء حساب جديد للاعب)
    // ==========================================
    const trimmedName = (name || '').trim();
    const cleanUsername = (username || '').trim().replace(/^@+/, '');
    const userPass = (password || '').trim() || '1234';

    if (!trimmedName) {
      return res.status(400).json({
        error: 'يرجى إدخال الاسم'
      });
    }

    if (!cleanUsername) {
      return res.status(400).json({
        error: 'يرجى إدخال اسم المستخدم'
      });
    }

    if (!userPass) {
      return res.status(400).json({
        error: 'يرجى إدخال كلمة المرور'
      });
    }

    // Check if the username is already taken
    const existingPlayerWithUsername = await prisma.player.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { username: '@' + cleanUsername }
        ]
      }
    });

    if (existingPlayerWithUsername) {
      return res.status(400).json({
        message: 'USERNAME_TAKEN',
        error: 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم مستخدم آخر'
      });
    }

    // Check if the display name is already taken
    const existingPlayerWithName = await prisma.player.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' }
      }
    });

    if (existingPlayerWithName) {
      return res.status(400).json({
        message: 'NAME_TAKEN',
        error: 'هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر'
      });
    }

    const player = await prisma.player.create({
      data: {
        name: trimmedName,
        username: cleanUsername,
        password: userPass
      }
    });

    return res.status(200).json({
      success: true,
      player
    });
  } catch (error: any) {
    console.error('Player Auth Database Error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message || 'حدث خطأ في الخادم'
    });
  }
}
