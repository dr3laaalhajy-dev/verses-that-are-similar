import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { handleCors } from './_lib/cors.js';
import { getOrGenerateUniquePlayerId } from './_lib/uniquePlayerId.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  // Handle GET request: retrieve player by id, username, uniquePlayerId, or name
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { id, playerId, username, name, uniquePlayerId } = req.query;
    const targetId = Number(id || playerId);
    const cleanU = String(username || '').trim().replace(/^@+/, '');
    const cleanN = String(name || '').trim();
    const cleanUnique = String(uniquePlayerId || '').trim().toUpperCase();

    if (!targetId && !cleanU && !cleanN && !cleanUnique) {
      return res.status(400).json({ error: 'Missing user identifier' });
    }

    try {
      const orParts: string[] = [];
      if (Number.isInteger(targetId) && targetId > 0) orParts.push(`id.eq.${targetId}`);
      if (cleanUnique) orParts.push(`uniquePlayerId.eq.${cleanUnique}`);
      if (cleanU) {
        orParts.push(`username.eq.${cleanU}`);
        orParts.push(`username.eq.@${cleanU}`);
      }
      if (cleanN) orParts.push(`name.ilike.${cleanN}`);

      const { data: player, error } = await supabaseAdmin
        .from('players')
        .select('*')
        .or(orParts.join(','))
        .limit(1)
        .maybeSingle();

      if (error || !player) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!player.uniquePlayerId) {
        try {
          const uid = await getOrGenerateUniquePlayerId(player.id);
          player.uniquePlayerId = uid;
        } catch (e) {
          console.error('Failed to generate uniquePlayerId:', e);
        }
      }

      return res.status(200).json({
        success: true,
        user: player,
        player
      });
    } catch (err: any) {
      console.error('Error fetching player in /api/player-register:', err);
      return res.status(500).json({ error: 'Failed to fetch user', message: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
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

      const { data: player, error } = await supabaseAdmin
        .from('players')
        .select('*')
        .or(`username.eq.${cleanIdentifier},username.eq.@${cleanIdentifier},username.eq.${rawIdentifier},name.ilike.${rawIdentifier}`)
        .limit(1)
        .maybeSingle();

      if (error || !player) {
        return res.status(401).json({
          error: 'لم يتم العثور على حساب بهذا الاسم أو اسم المستخدم'
        });
      }

      if ((player as any).isBlocked) {
        return res.status(403).json({
          error: 'تم حظر هذا الحساب من تسجيل الدخول من قِبل إدارة التطبيق'
        });
      }

      const effectivePassword = player.password || '1234';
      if (effectivePassword !== inputPass) {
        return res.status(401).json({
          error: 'كلمة المرور غير صحيحة'
        });
      }

      if (!player.uniquePlayerId) {
        try {
          const uid = await getOrGenerateUniquePlayerId(player.id);
          player.uniquePlayerId = uid;
        } catch (e) {
          console.error('Failed to set uniquePlayerId for player:', e);
        }
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

      const { data: player, error } = await supabaseAdmin
        .from('players')
        .select('*')
        .or(`username.eq.${cleanUser},username.eq.@${cleanUser},name.ilike.${targetUser}`)
        .limit(1)
        .maybeSingle();

      if (error || !player) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب اللاعب' });
      }

      const effectivePassword = player.password || '1234';
      if (effectivePassword !== curPass) {
        return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
      }

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('players')
        .update({ password: newPass, updatedAt: new Date().toISOString() })
        .eq('id', player.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

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

      const { data: player, error } = await supabaseAdmin
        .from('players')
        .select('*')
        .or(`username.eq.${cleanTarget},username.eq.@${cleanTarget},name.ilike.${targetUser}`)
        .limit(1)
        .maybeSingle();

      if (error || !player) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب اللاعب' });
      }

      const trimmedName = (name || '').trim();
      const cleanNewUsername = (username || '').trim().replace(/^@+/, '');

      const updateData: any = {};

      // 1. Check Display Name
      if (trimmedName && trimmedName !== player.name) {
        const { data: existingName } = await supabaseAdmin
          .from('players')
          .select('id')
          .ilike('name', trimmedName)
          .neq('id', player.id)
          .maybeSingle();

        if (existingName) {
          return res.status(400).json({ error: 'هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر' });
        }
        updateData.name = trimmedName;
      }

      // 2. Check Username
      if (cleanNewUsername && cleanNewUsername !== player.username) {
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

        const { data: existingUsername } = await supabaseAdmin
          .from('players')
          .select('id')
          .or(`username.eq.${cleanNewUsername},username.eq.@${cleanNewUsername}`)
          .neq('id', player.id)
          .maybeSingle();

        if (existingUsername) {
          return res.status(400).json({ error: 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم آخر' });
        }

        updateData.username = cleanNewUsername;
        updateData.usernameChangedAt = new Date().toISOString();
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(200).json({
          success: true,
          message: 'لم يتم إجراء أي تغييرات',
          player
        });
      }

      updateData.updatedAt = new Date().toISOString();
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('players')
        .update(updateData)
        .eq('id', player.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

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

      const { data: player, error } = await supabaseAdmin
        .from('players')
        .select('*')
        .or(`username.eq.${cleanIdentifier},username.eq.@${cleanIdentifier},username.eq.${rawIdentifier},name.ilike.${rawIdentifier}`)
        .limit(1)
        .maybeSingle();

      if (error || !player) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب بهذا الاسم أو اسم المستخدم' });
      }

      const effectivePassword = player.password || '1234';
      if (effectivePassword !== inputPass) {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      }

      // Delete associated rooms first
      await supabaseAdmin
        .from('rooms')
        .delete()
        .or(`player1Id.eq.${player.id},player2Id.eq.${player.id},winnerId.eq.${player.id}`);

      // Delete player
      const { error: delErr } = await supabaseAdmin
        .from('players')
        .delete()
        .eq('id', player.id);

      if (delErr) throw delErr;

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

    // 1. Check if the username is already taken
    const { data: existingPlayerWithUsername } = await supabaseAdmin
      .from('players')
      .select('id')
      .or(`username.eq.${cleanUsername},username.eq.@${cleanUsername}`)
      .limit(1)
      .maybeSingle();

    if (existingPlayerWithUsername) {
      return res.status(400).json({
        message: 'USERNAME_TAKEN',
        error: 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم مستخدم آخر'
      });
    }

    // 2. Check if the display name is already taken
    const { data: existingPlayerWithName } = await supabaseAdmin
      .from('players')
      .select('id')
      .ilike('name', trimmedName)
      .limit(1)
      .maybeSingle();

    if (existingPlayerWithName) {
      return res.status(400).json({
        message: 'NAME_TAKEN',
        error: 'هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر'
      });
    }

    let newUniqueId: string | undefined;
    try {
      newUniqueId = await getOrGenerateUniquePlayerId();
    } catch (e) {
      console.error('Failed to generate uniquePlayerId:', e);
    }

    const { data: newPlayer, error: insertError } = await supabaseAdmin
      .from('players')
      .insert({
        name: trimmedName,
        username: cleanUsername,
        password: userPass,
        uniquePlayerId: newUniqueId,
        points: 0,
        cups: 0,
        streak: 0,
        completedChallengeIds: [],
        seerahCompleted: false,
        generalCompleted: false,
        quranCompleted: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Player insert error in Supabase:', insertError);
      throw insertError;
    }

    return res.status(200).json({
      success: true,
      player: newPlayer
    });
  } catch (error: any) {
    console.error('Player Auth Database Error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message || 'حدث خطأ في الخادم'
    });
  }
}
