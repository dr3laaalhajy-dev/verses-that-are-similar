import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { handleCors } from './_lib/cors.js';
import { getOrGenerateUniquePlayerId } from './_lib/uniquePlayerId.js';
import {
  verifyPassword,
  hashPassword,
  toSafePlayer,
  isSafeFilterValue,
  isAcceptableNewUsername,
  findPlayerRow,
  findUsernameOwnerId,
  stripAt,
  MIN_NEW_PASSWORD_LENGTH,
  NO_PASSWORD_MESSAGE,
  NEW_PASSWORD_TOO_SHORT_MESSAGE
} from './_lib/playerSecurity.js';

const RESERVED_USERNAMES = ['alaa', 'علاء', 'founder', 'المؤسس', 'superadmin', 'admin', 'root', 'system'];

const INVALID_CHARS_MESSAGE = 'يحتوي الإدخال على رموز غير مسموحة';

/** Looks up a player by login identifier: username, legacy "@username", then exact display name. */
function findPlayerByIdentifier(identifier: string) {
  return findPlayerRow(supabaseAdmin, { username: identifier, name: identifier });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  // Handle GET request: retrieve player by id, username, uniquePlayerId, or name
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { id, playerId, username, name, uniquePlayerId } = req.query;
    const targetId = Number(id || playerId);
    const cleanU = stripAt(username);
    const cleanN = String(name || '').trim();
    const cleanUnique = String(uniquePlayerId || '').trim().toUpperCase();

    if (!targetId && !cleanU && !cleanN && !cleanUnique) {
      return res.status(400).json({ error: 'Missing user identifier' });
    }

    try {
      const player = await findPlayerRow(supabaseAdmin, {
        id: targetId,
        uniquePlayerId: cleanUnique,
        username: cleanU,
        name: cleanN
      });

      if (!player) {
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

      const safePlayer = toSafePlayer(player);
      return res.status(200).json({
        success: true,
        user: safePlayer,
        player: safePlayer
      });
    } catch (err: any) {
      console.error('Error fetching player in /api/player-register:', err);
      return res.status(500).json({ error: 'Failed to fetch user' });
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
      const rawIdentifier = String(username || name || '').trim();
      const inputPass = String(password || '').trim();

      if (!rawIdentifier || !inputPass) {
        return res.status(400).json({
          error: 'يرجى إدخال اسم المستخدم وكلمة المرور'
        });
      }

      const player = await findPlayerByIdentifier(rawIdentifier);

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

      const check = await verifyPassword(inputPass, player.password);

      if (check.noPassword) {
        return res.status(401).json({ error: NO_PASSWORD_MESSAGE });
      }

      if (!check.ok) {
        return res.status(401).json({
          error: 'كلمة المرور غير صحيحة'
        });
      }

      // Progressive upgrade: legacy plaintext password matched -> re-save as bcrypt hash
      if (check.needsUpgrade) {
        try {
          const hashed = await hashPassword(inputPass);
          await supabaseAdmin.from('players').update({ password: hashed }).eq('id', player.id);
        } catch (migrateErr) {
          console.error('Password hash upgrade error:', migrateErr);
        }
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
        player: toSafePlayer(player)
      });
    }

    // ==========================================
    // 2. CHANGE PASSWORD MODE (تغيير كلمة المرور)
    // ==========================================
    if (action === 'change-password') {
      const targetUser = String(username || name || currentUsername || '').trim();

      if (!stripAt(targetUser)) {
        return res.status(400).json({ error: 'اسم المستخدم مطلوب لتغيير كلمة المرور' });
      }

      const curPass = String(currentPassword || '').trim();
      const newPass = String(newPassword || '').trim();

      if (!curPass) {
        return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية' });
      }
      if (!newPass || newPass.length < MIN_NEW_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `كلمة المرور الجديدة يجب أن تتكون من ${MIN_NEW_PASSWORD_LENGTH} خانات على الأقل` });
      }

      const player = await findPlayerByIdentifier(targetUser);

      if (!player) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب اللاعب' });
      }

      const check = await verifyPassword(curPass, player.password);
      if (check.noPassword) {
        return res.status(400).json({ error: NO_PASSWORD_MESSAGE });
      }
      if (!check.ok) {
        return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
      }

      const hashedNew = await hashPassword(newPass);
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('players')
        .update({ password: hashedNew, updatedAt: new Date().toISOString() })
        .eq('id', player.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return res.status(200).json({
        success: true,
        message: 'تم تغيير كلمة المرور بنجاح',
        player: toSafePlayer(updated)
      });
    }

    // ==========================================
    // 3. UPDATE PROFILE MODE (تغيير الاسم واسم المستخدم)
    // ==========================================
    if (action === 'update-profile') {
      const targetUser = String(currentUsername || username || currentName || name || '').trim();

      if (!stripAt(targetUser)) {
        return res.status(400).json({ error: 'بيانات الحساب الحالي مطلوبة' });
      }

      // TEMPORARY (backward compatibility): current app versions do not send a password
      // with update-profile, so it is NOT required here. If a password IS sent it must be
      // correct; if none is sent the request is allowed as before.
      // TODO(next phase): update-profile must require a valid player session token.
      const curPass = String(currentPassword || password || '').trim();

      const player = await findPlayerByIdentifier(targetUser);

      if (!player) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب اللاعب' });
      }

      if (curPass) {
        const check = await verifyPassword(curPass, player.password);
        if (check.noPassword) {
          return res.status(400).json({ error: NO_PASSWORD_MESSAGE });
        }
        if (!check.ok) {
          return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
        }
      }

      const trimmedName = String(name || '').trim();
      const cleanNewUsername = stripAt(username);

      if (cleanNewUsername && !isAcceptableNewUsername(cleanNewUsername)) {
        return res.status(400).json({ error: INVALID_CHARS_MESSAGE });
      }

      if (cleanNewUsername && RESERVED_USERNAMES.includes(cleanNewUsername.toLowerCase())) {
        return res.status(400).json({ error: 'اسم مستخدم غير متاح أو محجوز' });
      }

      const updateData: any = {};

      // 1. Check Display Name
      if (trimmedName && trimmedName !== player.name) {
        if (!isSafeFilterValue(trimmedName)) {
          return res.status(400).json({ error: INVALID_CHARS_MESSAGE });
        }
        const { data: existingName } = await supabaseAdmin
          .from('players')
          .select('id')
          .ilike('name', trimmedName)
          .neq('id', player.id)
          .limit(1)
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

        const existingUsernameId = await findUsernameOwnerId(supabaseAdmin, cleanNewUsername, player.id);

        if (existingUsernameId) {
          return res.status(400).json({ error: 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم آخر' });
        }

        updateData.username = cleanNewUsername;
        updateData.usernameChangedAt = new Date().toISOString();
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(200).json({
          success: true,
          message: 'لم يتم إجراء أي تغييرات',
          player: toSafePlayer(player)
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
        player: toSafePlayer(updated)
      });
    }

    // ==========================================
    // 4. DELETE ACCOUNT MODE (حذف الحساب والبيانات)
    // ==========================================
    if (action === 'delete-account') {
      const rawIdentifier = String(username || name || currentUsername || '').trim();
      const inputPass = String(password || currentPassword || '').trim();

      if (!rawIdentifier) {
        return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم أو الاسم' });
      }

      if (!inputPass) {
        return res.status(400).json({ error: 'يرجى إدخال كلمة المرور لتأكيد الحذف' });
      }

      const player = await findPlayerByIdentifier(rawIdentifier);

      if (!player) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب بهذا الاسم أو اسم المستخدم' });
      }

      const check = await verifyPassword(inputPass, player.password);
      if (check.noPassword) {
        return res.status(401).json({ error: NO_PASSWORD_MESSAGE });
      }
      if (!check.ok) {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      }

      // Delete associated records
      try {
        await supabaseAdmin
          .from('rooms')
          .delete()
          .or(`player1Id.eq.${player.id},player2Id.eq.${player.id},winnerId.eq.${player.id}`);
      } catch (_) {}

      try {
        await supabaseAdmin.from('challenge_progress').delete().eq('user_id', player.id);
        await supabaseAdmin.from('certificates').delete().eq('user_id', player.id);
      } catch (_) {}

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
    const trimmedName = String(name || '').trim();
    const cleanUsername = stripAt(username);
    const userPass = String(password || '').trim();

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

    if (!isAcceptableNewUsername(cleanUsername) || !isSafeFilterValue(trimmedName)) {
      return res.status(400).json({
        error: INVALID_CHARS_MESSAGE
      });
    }

    if (RESERVED_USERNAMES.includes(cleanUsername.toLowerCase())) {
      return res.status(400).json({
        error: 'اسم مستخدم غير متاح أو محجوز'
      });
    }

    if (userPass.length < MIN_NEW_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: NEW_PASSWORD_TOO_SHORT_MESSAGE
      });
    }

    // 1. Check if the username is already taken
    const existingPlayerWithUsername = await findUsernameOwnerId(supabaseAdmin, cleanUsername);

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

    const hashedPass = await hashPassword(userPass);

    const { data: newPlayer, error: insertError } = await supabaseAdmin
      .from('players')
      .insert({
        name: trimmedName,
        username: cleanUsername,
        password: hashedPass,
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
      player: toSafePlayer(newPlayer)
    });
  } catch (error: any) {
    console.error('Player Auth Database Error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: 'حدث خطأ في الخادم'
    });
  }
}
