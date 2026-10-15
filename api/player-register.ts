import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { action, deviceId, name, username, password } = req.body || {};

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

      // Check password (default password for existing users without password is '1234')
      const effectivePassword = player.password || '1234';
      if (effectivePassword !== inputPass) {
        return res.status(401).json({
          error: 'كلمة المرور غير صحيحة'
        });
      }

      // If logging in from this device, bind deviceId to current player
      let targetPlayer = player;
      if (deviceId && player.deviceId !== deviceId) {
        // Handle deviceId uniqueness constraint: displace conflicting record if any
        const conflict = await prisma.player.findUnique({ where: { deviceId } });
        if (conflict && conflict.id !== player.id) {
          await prisma.player.update({
            where: { id: conflict.id },
            data: { deviceId: `dev_${conflict.id}_${Date.now()}` }
          });
        }

        targetPlayer = await prisma.player.update({
          where: { id: player.id },
          data: { deviceId }
        });
      }

      return res.status(200).json({
        success: true,
        player: targetPlayer
      });
    }

    // ==========================================
    // 2. REGISTER MODE (إنشاء حساب جديد للاعب)
    // ==========================================
    const trimmedName = (name || '').trim();
    const cleanUsername = (username || '').trim().replace(/^@+/, '');
    const userPass = (password || '').trim() || '1234';

    if (!deviceId || !trimmedName) {
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

    // Check if the username is already taken by a DIFFERENT player
    const existingPlayerWithUsername = await prisma.player.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { username: '@' + cleanUsername }
        ],
        NOT: { deviceId }
      }
    });

    if (existingPlayerWithUsername) {
      return res.status(400).json({
        message: 'USERNAME_TAKEN',
        error: 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم مستخدم آخر'
      });
    }

    // Check if the display name is already taken by a DIFFERENT device
    const existingPlayerWithName = await prisma.player.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        NOT: { deviceId }
      }
    });

    if (existingPlayerWithName) {
      return res.status(400).json({
        message: 'NAME_TAKEN',
        error: 'هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر'
      });
    }

    const player = await prisma.player.upsert({
      where: { deviceId },
      update: {
        name: trimmedName,
        username: cleanUsername,
        password: userPass
      },
      create: {
        deviceId,
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
