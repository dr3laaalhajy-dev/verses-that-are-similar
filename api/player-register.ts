import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { handleCors } from './_lib/cors.js';
import { getOrGenerateUniquePlayerId } from './_lib/uniquePlayerId.js';
import {
  verifyPassword,
  hashPassword,
  toSafePlayer,
  isUsableLookupValue,
  escapeLikePattern,
  isAcceptableNewUsername,
  findPlayerRow,
  findUsernameOwnerId,
  stripAt,
  isPlayerBlocked,
  MIN_NEW_PASSWORD_LENGTH,
  NO_PASSWORD_MESSAGE,
  NEW_PASSWORD_TOO_SHORT_MESSAGE
} from './_lib/playerSecurity.js';
import {
  issuePlayerSession,
  authenticatePlayer,
  verifyPlayerSession,
  revokeAllPlayerSessions,
  revokeSessionByToken,
  extractBearerToken,
  type IssuedPlayerSession
} from './_lib/playerSession.js';
import { enforcePlayerActor, rejectUnlistedAction, type ActorSpec } from './_lib/playerAuth.js';

// POST actions that act for a player (REQUIRE_PLAYER_TOKEN on): the account is the token's
// player and these fields (the CURRENT identity) must match it. For update-profile,
// username/name are the new values, so only currentUsername/currentName are checked.
export const ACTOR_SPECS: Record<string, ActorSpec> = {
  'change-password': { fields: { username: 'username', name: 'name', currentUsername: 'username' } },
  'update-profile': { fields: { currentUsername: 'username', currentName: 'name' } },
  'delete-account': { fields: { username: 'username', name: 'name', currentUsername: 'username' } },
};

// POST actions that need no player token (GET is always public). A request without an action
// is a registration (old app). Anything else is refused when REQUIRE_PLAYER_TOKEN is on.
export const PUBLIC_ACTIONS: ReadonlySet<string> = new Set(['login', 'register', 'logout', 'check-session']);

const RESERVED_USERNAMES = ['alaa', 'علاء', 'founder', 'المؤسس', 'superadmin', 'admin', 'root', 'system'];

const INVALID_CHARS_MESSAGE = 'يحتوي الإدخال على رموز غير مسموحة';

/** Looks up a player by login identifier: username, legacy "@username", then exact display name. */
function findPlayerByIdentifier(identifier: string) {
  return findPlayerRow(supabaseAdmin, { username: identifier, name: identifier });
}

/**
 * Issues a session token, but never blocks login/register if that fails (e.g. the
 * player_sessions table is not created yet): tokens are not required in this phase.
 * Only a generic message is logged (no token, no hash).
 */
async function tryIssueSession(playerId: unknown): Promise<IssuedPlayerSession | null> {
  try {
    return await issuePlayerSession(Number(playerId));
  } catch (e: any) {
    console.error('[player-register] session not issued:', e?.message ?? 'unknown');
    return null;
  }
}

function sessionFields(session: IssuedPlayerSession | null) {
  return session ? { playerToken: session.token, playerTokenExpiresAt: session.expiresAt } : {};
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

  if (rejectUnlistedAction(action === undefined || action === null || action === '' ? 'register' : action, ACTOR_SPECS, PUBLIC_ACTIONS, res)) return;

  try {
    // ==========================================
    // 0. LOGOUT (إلغاء الجلسة الحالية)
    // ==========================================
    if (action === 'logout') {
      const token = extractBearerToken(req);
      if (token) {
        try {
          await revokeSessionByToken(token, 'logout');
        } catch (e: any) {
          console.error('[player-register] logout revoke failed:', e?.message ?? 'unknown');
        }
      }
      // Same answer whether or not a session existed (nothing to learn from it).
      return res.status(200).json({ success: true });
    }

    // ==========================================
    // 0b. CHECK-SESSION (فحص الجلسة عند فتح التطبيق أو العودة إليه)
    // ==========================================
    // Never enforces anything: a request without an Authorization header (old app) is fine.
    // With a header, the answer is exactly what requirePlayer would give.
    if (action === 'check-session') {
      res.setHeader('Cache-Control', 'no-store');
      if (!req.headers?.authorization) {
        return res.status(200).json({ ok: true, anonymous: true });
      }
      const check = await verifyPlayerSession(req);
      if (check.ok === false) {
        return res.status(401).json({ code: check.code });
      }
      return res.status(200).json({ ok: true });
    }

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

      if (isPlayerBlocked(player)) {
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

      const session = await tryIssueSession(player.id);

      return res.status(200).json({
        success: true,
        player: toSafePlayer(player),
        ...sessionFields(session)
      });
    }

    // ==========================================
    // 2. CHANGE PASSWORD MODE (تغيير كلمة المرور)
    // ==========================================
    if (action === 'change-password') {
      // REQUIRE_PLAYER_TOKEN on: the account is the token's player; these fields must match it.
      const gate = await enforcePlayerActor(req, res, ACTOR_SPECS['change-password']);
      if (!gate) return;

      const targetUser = String(username || name || currentUsername || '').trim();

      if (!gate.enforced && !stripAt(targetUser)) {
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

      const player = gate.enforced ? gate.actor.row : await findPlayerByIdentifier(targetUser);

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

      // Revoke every other session of this player. Keep the caller's own session only if the
      // request carries a valid token for THIS player; otherwise issue a fresh one.
      const current = await authenticatePlayer(req);
      const keepSessionId = current && current.playerId === Number(player.id) ? current.sessionId : undefined;
      try {
        await revokeAllPlayerSessions(Number(player.id), 'password_changed', { exceptSessionId: keepSessionId });
      } catch (e: any) {
        console.error('[player-register] revoke after password change failed:', e?.message ?? 'unknown');
      }
      const freshSession = keepSessionId ? null : await tryIssueSession(player.id);

      return res.status(200).json({
        success: true,
        message: 'تم تغيير كلمة المرور بنجاح',
        player: toSafePlayer(updated),
        ...sessionFields(freshSession)
      });
    }

    // ==========================================
    // 3. UPDATE PROFILE MODE (تغيير الاسم واسم المستخدم)
    // ==========================================
    if (action === 'update-profile') {
      // REQUIRE_PLAYER_TOKEN on: the account is the token's player. Only the CURRENT identity
      // fields are checked; username/name here are the new values.
      const gate = await enforcePlayerActor(req, res, ACTOR_SPECS['update-profile']);
      if (!gate) return;

      const targetUser = String(currentUsername || username || currentName || name || '').trim();

      if (!gate.enforced && !stripAt(targetUser)) {
        return res.status(400).json({ error: 'بيانات الحساب الحالي مطلوبة' });
      }

      // TEMPORARY (backward compatibility): current app versions do not send a password
      // with update-profile, so it is NOT required here. If a password IS sent it must be
      // correct; if none is sent the request is allowed as before.
      // TODO(next phase): update-profile must require a valid player session token.
      const curPass = String(currentPassword || password || '').trim();

      const player = gate.enforced ? gate.actor.row : await findPlayerByIdentifier(targetUser);

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
        if (!isUsableLookupValue(trimmedName)) {
          return res.status(400).json({ error: INVALID_CHARS_MESSAGE });
        }
        const { data: existingName } = await supabaseAdmin
          .from('players')
          .select('id')
          .ilike('name', escapeLikePattern(trimmedName))
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
      // REQUIRE_PLAYER_TOKEN on: the account is the token's player; these fields must match it.
      const gate = await enforcePlayerActor(req, res, ACTOR_SPECS['delete-account']);
      if (!gate) return;

      const rawIdentifier = String(username || name || currentUsername || '').trim();
      const inputPass = String(password || currentPassword || '').trim();

      if (!gate.enforced && !rawIdentifier) {
        return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم أو الاسم' });
      }

      if (!inputPass) {
        return res.status(400).json({ error: 'يرجى إدخال كلمة المرور لتأكيد الحذف' });
      }

      const player = gate.enforced ? gate.actor.row : await findPlayerByIdentifier(rawIdentifier);

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

      // Revoke all sessions first (the FK also deletes them with the player row).
      try {
        await revokeAllPlayerSessions(Number(player.id), 'account_deleted');
      } catch (e: any) {
        console.error('[player-register] revoke before account deletion failed:', e?.message ?? 'unknown');
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

    if (!isAcceptableNewUsername(cleanUsername) || !isUsableLookupValue(trimmedName)) {
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
      .ilike('name', escapeLikePattern(trimmedName))
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

    const session = await tryIssueSession(newPlayer?.id);

    return res.status(200).json({
      success: true,
      player: toSafePlayer(newPlayer),
      ...sessionFields(session)
    });
  } catch (error: any) {
    console.error('Player Auth Database Error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: 'حدث خطأ في الخادم'
    });
  }
}
