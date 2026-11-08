import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_lib/cors.js';
import { getOrGenerateUniquePlayerId } from './_lib/uniquePlayerId.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// Surah metadata lookup helper for Quran page (1-604)
const SURAH_PAGES: Array<{ number: number; name: string; startPage: number; endPage: number }> = [
  { number: 1, name: "الفاتحة", startPage: 1, endPage: 1 },
  { number: 2, name: "البقرة", startPage: 2, endPage: 49 },
  { number: 3, name: "آل عمران", startPage: 50, endPage: 76 },
  { number: 4, name: "النساء", startPage: 77, endPage: 106 },
  { number: 5, name: "المائدة", startPage: 106, endPage: 127 },
  { number: 6, name: "الأنعام", startPage: 128, endPage: 150 },
  { number: 7, name: "الأعراف", startPage: 151, endPage: 176 },
  { number: 8, name: "الأنفال", startPage: 177, endPage: 186 },
  { number: 9, name: "التوبة", startPage: 187, endPage: 207 },
  { number: 10, name: "يونس", startPage: 208, endPage: 221 },
  { number: 11, name: "هود", startPage: 221, endPage: 235 },
  { number: 12, name: "يوسف", startPage: 235, endPage: 248 },
  { number: 13, name: "الرعد", startPage: 249, endPage: 255 },
  { number: 14, name: "إبراهيم", startPage: 255, endPage: 261 },
  { number: 15, name: "الحجر", startPage: 262, endPage: 267 },
  { number: 16, name: "النحل", startPage: 267, endPage: 281 },
  { number: 17, name: "الإسراء", startPage: 282, endPage: 293 },
  { number: 18, name: "الكهف", startPage: 293, endPage: 304 },
  { number: 19, name: "مريم", startPage: 305, endPage: 312 },
  { number: 20, name: "طه", startPage: 312, endPage: 321 },
  { number: 21, name: "الأنبياء", startPage: 322, endPage: 331 },
  { number: 22, name: "الحج", startPage: 332, endPage: 341 },
  { number: 23, name: "المؤمنون", startPage: 342, endPage: 349 },
  { number: 24, name: "النور", startPage: 350, endPage: 359 },
  { number: 25, name: "الفرقان", startPage: 359, endPage: 366 },
  { number: 26, name: "الشعراء", startPage: 367, endPage: 376 },
  { number: 27, name: "النمل", startPage: 377, endPage: 385 },
  { number: 28, name: "القصص", startPage: 385, endPage: 396 },
  { number: 29, name: "العنكبوت", startPage: 396, endPage: 404 },
  { number: 30, name: "الروم", startPage: 404, endPage: 410 },
  { number: 31, name: "لقمان", startPage: 411, endPage: 414 },
  { number: 32, name: "السجدة", startPage: 415, endPage: 417 },
  { number: 33, name: "الأحزاب", startPage: 418, endPage: 427 },
  { number: 34, name: "سبأ", startPage: 428, endPage: 434 },
  { number: 35, name: "فاطر", startPage: 434, endPage: 440 },
  { number: 36, name: "يس", startPage: 440, endPage: 445 },
  { number: 37, name: "الصافات", startPage: 446, endPage: 452 },
  { number: 38, name: "ص", startPage: 453, endPage: 458 },
  { number: 39, name: "الزمر", startPage: 458, endPage: 467 },
  { number: 40, name: "غافر", startPage: 467, endPage: 476 },
  { number: 41, name: "فصلت", startPage: 477, endPage: 482 },
  { number: 42, name: "الشورى", startPage: 483, endPage: 489 },
  { number: 43, name: "الزخرف", startPage: 489, endPage: 495 },
  { number: 44, name: "الدخان", startPage: 496, endPage: 498 },
  { number: 45, name: "الجاثية", startPage: 499, endPage: 502 },
  { number: 46, name: "الأحقاف", startPage: 502, endPage: 506 },
  { number: 47, name: "محمد", startPage: 507, endPage: 510 },
  { number: 48, name: "الفتح", startPage: 511, endPage: 515 },
  { number: 49, name: "الحجرات", startPage: 515, endPage: 517 },
  { number: 50, name: "ق", startPage: 518, endPage: 520 },
  { number: 51, name: "الذاريات", startPage: 520, endPage: 523 },
  { number: 52, name: "الطور", startPage: 523, endPage: 525 },
  { number: 53, name: "النجم", startPage: 526, endPage: 528 },
  { number: 54, name: "القمر", startPage: 528, endPage: 531 },
  { number: 55, name: "الرحمن", startPage: 531, endPage: 534 },
  { number: 56, name: "الواقعة", startPage: 534, endPage: 537 },
  { number: 57, name: "الحديد", startPage: 537, endPage: 541 },
  { number: 58, name: "المجادلة", startPage: 542, endPage: 545 },
  { number: 59, name: "الحشر", startPage: 545, endPage: 548 },
  { number: 60, name: "الممتحنة", startPage: 549, endPage: 551 },
  { number: 61, name: "الصف", startPage: 551, endPage: 552 },
  { number: 62, name: "الجمعة", startPage: 553, endPage: 554 },
  { number: 63, name: "المنافقون", startPage: 554, endPage: 555 },
  { number: 64, name: "التغابن", startPage: 556, endPage: 557 },
  { number: 65, name: "الطلاق", startPage: 558, endPage: 559 },
  { number: 66, name: "التحريم", startPage: 560, endPage: 561 },
  { number: 67, name: "الملك", startPage: 562, endPage: 564 },
  { number: 68, name: "القلم", startPage: 564, endPage: 566 },
  { number: 69, name: "الحاقة", startPage: 566, endPage: 568 },
  { number: 70, name: "المعارج", startPage: 568, endPage: 570 },
  { number: 71, name: "نوح", startPage: 570, endPage: 571 },
  { number: 72, name: "الجن", startPage: 572, endPage: 573 },
  { number: 73, name: "المزمل", startPage: 574, endPage: 575 },
  { number: 74, name: "المدثر", startPage: 575, endPage: 577 },
  { number: 75, name: "القيامة", startPage: 577, endPage: 578 },
  { number: 76, name: "الإنسان", startPage: 578, endPage: 580 },
  { number: 77, name: "المرسلات", startPage: 580, endPage: 581 },
  { number: 78, name: "النبأ", startPage: 582, endPage: 583 },
  { number: 79, name: "النازعات", startPage: 583, endPage: 584 },
  { number: 80, name: "عبس", startPage: 585, endPage: 586 },
  { number: 81, name: "التكوير", startPage: 586, endPage: 586 },
  { number: 82, name: "الانفطار", startPage: 587, endPage: 587 },
  { number: 83, name: "المطففين", startPage: 587, endPage: 589 },
  { number: 84, name: "الانشقاق", startPage: 589, endPage: 590 },
  { number: 85, name: "البروج", startPage: 590, endPage: 591 },
  { number: 86, name: "الطارق", startPage: 591, endPage: 591 },
  { number: 87, name: "الأعلى", startPage: 591, endPage: 592 },
  { number: 88, name: "الغاشية", startPage: 592, endPage: 593 },
  { number: 89, name: "الفجر", startPage: 593, endPage: 594 },
  { number: 90, name: "البلد", startPage: 594, endPage: 595 },
  { number: 91, name: "الشمس", startPage: 595, endPage: 595 },
  { number: 92, name: "الليل", startPage: 595, endPage: 596 },
  { number: 93, name: "الضحى", startPage: 596, endPage: 596 },
  { number: 94, name: "الشرح", startPage: 596, endPage: 596 },
  { number: 95, name: "التين", startPage: 596, endPage: 597 },
  { number: 96, name: "العلق", startPage: 597, endPage: 597 },
  { number: 97, name: "القدر", startPage: 598, endPage: 598 },
  { number: 98, name: "البينة", startPage: 598, endPage: 599 },
  { number: 99, name: "الزلزلة", startPage: 599, endPage: 599 },
  { number: 100, name: "العاديات", startPage: 599, endPage: 600 },
  { number: 101, name: "القارعة", startPage: 600, endPage: 600 },
  { number: 102, name: "التكاثر", startPage: 600, endPage: 600 },
  { number: 103, name: "العصر", startPage: 601, endPage: 601 },
  { number: 104, name: "الهمزة", startPage: 601, endPage: 601 },
  { number: 105, name: "الفيل", startPage: 601, endPage: 601 },
  { number: 106, name: "قريش", startPage: 602, endPage: 602 },
  { number: 107, name: "الماعون", startPage: 602, endPage: 602 },
  { number: 108, name: "الكوثر", startPage: 602, endPage: 602 },
  { number: 109, name: "الكافرون", startPage: 603, endPage: 603 },
  { number: 110, name: "النصر", startPage: 603, endPage: 603 },
  { number: 111, name: "المسد", startPage: 603, endPage: 603 },
  { number: 112, name: "الإخلاص", startPage: 604, endPage: 604 },
  { number: 113, name: "الفلق", startPage: 604, endPage: 604 },
  { number: 114, name: "الناس", startPage: 604, endPage: 604 },
];

function getSurahFromPage(page: number): string {
  const p = Math.max(1, Math.min(604, page));
  const found = SURAH_PAGES.find(s => p >= s.startPage && p <= s.endPage);
  return found ? found.name : "الفاتحة";
}

async function resolvePlayer(identifier?: string | number): Promise<any | null> {
  if (!identifier) return null;
  const str = String(identifier).trim();
  if (!str || str === 'undefined' || str === 'null') return null;

  const cleanU = str.replace(/^@+/, '');
  const numId = Number(str);

  // 1. By Numeric ID
  if (Number.isInteger(numId) && numId > 0) {
    const { data } = await supabaseAdmin.from('players').select('*').eq('id', numId).maybeSingle();
    if (data) return data;
  }

  // 2. By Unique Player ID (MT-XXXX)
  if (/^MT-[A-Z0-9]{4}$/i.test(str)) {
    const { data } = await supabaseAdmin.from('players').select('*').ilike('uniquePlayerId', str).maybeSingle();
    if (data) return data;
  }

  // 3. By Username
  const { data: byUser } = await supabaseAdmin
    .from('players')
    .select('*')
    .or(`username.eq.${cleanU},username.eq.@${cleanU}`)
    .maybeSingle();
  if (byUser) return byUser;

  // 4. By Name
  const { data: byName } = await supabaseAdmin
    .from('players')
    .select('*')
    .ilike('name', str)
    .maybeSingle();
  if (byName) return byName;

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const action = (req.query.action || req.body?.action || 'list') as string;

  try {
    // ========================================================
    // 1. SEARCH PLAYERS
    // ========================================================
    if (action === 'search') {
      const q = String(req.query.q || req.body?.q || '').trim();
      const viewerId = req.query.viewerId || req.body?.viewerId;
      const viewer = await resolvePlayer(viewerId);

      if (!q) {
        return res.status(200).json({ results: [] });
      }

      const cleanQ = q.replace(/^@+/, '');
      let query = supabaseAdmin
        .from('players')
        .select('id, name, username, uniquePlayerId, points, cups, streak, activeFrame, equippedNameColor, seerahCompleted, generalCompleted, quranCompleted')
        .eq('isBlocked', false);

      if (viewer) {
        query = query.neq('id', viewer.id);
      }

      if (/^MT-[A-Z0-9]{4}$/i.test(q)) {
        query = query.ilike('uniquePlayerId', q);
      } else {
        query = query.or(`username.ilike.%${cleanQ}%,name.ilike.%${q}%`);
      }

      const { data: players, error } = await query.limit(15);
      if (error) {
        console.warn('[Friends Search] Error:', error.message);
        return res.status(200).json({ results: [] });
      }

      // Check friendship status for each result with the viewer
      const friendshipMap = new Map<number, string>();
      if (viewer && players && players.length > 0) {
        const playerIds = players.map(p => p.id);
        const { data: friendships } = await supabaseAdmin
          .from('friendships')
          .select('*')
          .or(`user_id.eq.${viewer.id},friend_id.eq.${viewer.id}`);

        if (friendships) {
          for (const f of friendships) {
            const reqId = Number(f.user_id || f.requesterId);
            const addId = Number(f.friend_id || f.addresseeId);
            if (f.status === 'ACCEPTED') {
              const otherId = reqId === viewer.id ? addId : reqId;
              if (playerIds.includes(otherId)) friendshipMap.set(otherId, 'ACCEPTED');
            } else if (f.status === 'PENDING') {
              if (reqId === viewer.id && playerIds.includes(addId)) {
                friendshipMap.set(addId, 'PENDING_SENT');
              } else if (addId === viewer.id && playerIds.includes(reqId)) {
                friendshipMap.set(reqId, 'PENDING_RECEIVED');
              }
            }
          }
        }
      }

      const results = (players || []).map(p => ({
        ...p,
        status: friendshipMap.get(p.id) || 'NONE'
      }));

      return res.status(200).json({ results });
    }

    // ========================================================
    // 2. SEND FRIEND REQUEST
    // ========================================================
    if (action === 'send-request') {
      const { requesterId, targetId } = req.body || {};
      const requester = await resolvePlayer(requesterId);
      const target = await resolvePlayer(targetId);

      if (!requester || !target) {
        return res.status(404).json({ error: 'لم يتم العثور على اللاعب المطلوب' });
      }

      if (requester.id === target.id) {
        return res.status(400).json({ error: 'لا يمكنك إرسال طلب صداقة لنفسك' });
      }

      // Check existing relationship
      const { data: existingList } = await supabaseAdmin
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${requester.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${requester.id})`);

      const existing = existingList && existingList.length > 0 ? existingList[0] : null;

      if (existing) {
        if (existing.status === 'ACCEPTED') {
          return res.status(200).json({ success: true, message: 'أنتم أصدقاء بالفعل', status: 'ACCEPTED' });
        }
        if (existing.status === 'PENDING') {
          const reqId = Number(existing.user_id || existing.requesterId);
          const addId = Number(existing.friend_id || existing.addresseeId);
          // If the target had already sent request to me, auto-accept!
          if (reqId === target.id && addId === requester.id) {
            const { data: accepted } = await supabaseAdmin
              .from('friendships')
              .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
              .eq('id', existing.id)
              .select()
              .single();
            return res.status(200).json({ success: true, message: 'تم قبول طلب الصداقة المتبادل', status: 'ACCEPTED', friendship: accepted });
          }
          return res.status(200).json({ success: true, message: 'تم إرسال الطلب مسبقاً', status: 'PENDING_SENT' });
        }

        // If DECLINED, reactivate
        const { data: updated } = await supabaseAdmin
          .from('friendships')
          .update({
            user_id: String(requester.id),
            friend_id: String(target.id),
            status: 'PENDING',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        return res.status(200).json({ success: true, message: 'تم إرسال طلب الصداقة بنجاح', status: 'PENDING_SENT', friendship: updated });
      }

      const { data: created, error } = await supabaseAdmin
        .from('friendships')
        .insert({
          user_id: String(requester.id),
          friend_id: String(target.id),
          status: 'PENDING'
        })
        .select()
        .single();

      if (error) {
        console.error('[Friends] Send request error:', error.message);
        return res.status(500).json({ error: 'فشل إرسال طلب الصداقة' });
      }

      return res.status(200).json({
        success: true,
        message: 'تم إرسال طلب الصداقة بنجاح',
        status: 'PENDING_SENT',
        friendship: created
      });
    }

    // ========================================================
    // 3. RESPOND TO FRIEND REQUEST (Accept or Decline)
    // ========================================================
    if (action === 'respond-request') {
      const { viewerId, requesterId, friendshipId, response } = req.body || {};
      const viewer = await resolvePlayer(viewerId);

      if (!viewer) {
        return res.status(401).json({ error: 'المستخدم غير موجود' });
      }

      let friendshipRecord = null;
      if (friendshipId) {
        const { data } = await supabaseAdmin.from('friendships').select('*').eq('id', friendshipId).maybeSingle();
        friendshipRecord = data;
      } else if (requesterId) {
        const otherPlayer = await resolvePlayer(requesterId);
        if (otherPlayer) {
          const { data } = await supabaseAdmin
            .from('friendships')
            .select('*')
            .eq('user_id', String(otherPlayer.id))
            .eq('friend_id', String(viewer.id))
            .eq('status', 'PENDING')
            .maybeSingle();
          friendshipRecord = data;
        }
      }

      const recAddressee = Number(friendshipRecord?.friend_id || friendshipRecord?.addresseeId);
      if (!friendshipRecord || recAddressee !== viewer.id) {
        return res.status(404).json({ error: 'طلب الصداقة غير موجود أو تم معالجته بالفعل' });
      }

      if (response === 'ACCEPT') {
        const { data: updated } = await supabaseAdmin
          .from('friendships')
          .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
          .eq('id', friendshipRecord.id)
          .select()
          .single();
        return res.status(200).json({ success: true, message: 'تم قبول طلب الصداقة', status: 'ACCEPTED', friendship: updated });
      } else {
        await supabaseAdmin
          .from('friendships')
          .delete()
          .eq('id', friendshipRecord.id);
        return res.status(200).json({ success: true, message: 'تم رفض طلب الصداقة', status: 'DECLINED' });
      }
    }

    // ========================================================
    // 4. REMOVE FRIENDSHIP
    // ========================================================
    if (action === 'remove-friend') {
      const { viewerId, friendId } = req.body || {};
      const viewer = await resolvePlayer(viewerId);
      const friend = await resolvePlayer(friendId);

      if (!viewer || !friend) {
        return res.status(404).json({ error: 'اللاعب غير موجود' });
      }

      await supabaseAdmin
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${viewer.id},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${viewer.id})`);

      return res.status(200).json({ success: true, message: 'تمت إزالة الصداقة بنجاح' });
    }

    // ========================================================
    // 5. LIST FRIENDS & PENDING REQUESTS (Fully Hydrated)
    // ========================================================
    if (action === 'list') {
      const viewerId = req.query.viewerId || req.body?.viewerId;
      const viewer = await resolvePlayer(viewerId);

      if (!viewer) {
        return res.status(200).json({ friends: [], incomingRequests: [], outgoingRequests: [] });
      }

      // Query friendships where user is either side
      const { data: friendships, error: fErr } = await supabaseAdmin
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${viewer.id},friend_id.eq.${viewer.id}`)
        .order('created_at', { ascending: false });

      if (fErr) {
        console.warn('[Friends List] Supabase error:', fErr.message);
        return res.status(200).json({ friends: [], incomingRequests: [], outgoingRequests: [] });
      }

      // Collect all other player IDs to hydrate their profiles in a single query
      const otherPlayerIds = new Set<number>();
      for (const f of (friendships || [])) {
        const reqId = Number(f.user_id || f.requesterId);
        const addId = Number(f.friend_id || f.addresseeId);
        if (reqId) otherPlayerIds.add(reqId);
        if (addId) otherPlayerIds.add(addId);
      }

      const playerMap = new Map<number, any>();
      if (otherPlayerIds.size > 0) {
        const { data: players } = await supabaseAdmin
          .from('players')
          .select('id, name, username, uniquePlayerId, points, cups, streak, activeFrame, equippedNameColor, seerahCompleted, generalCompleted, quranCompleted, createdAt')
          .in('id', Array.from(otherPlayerIds));

        (players || []).forEach(p => playerMap.set(p.id, p));
      }

      const friends: any[] = [];
      const incomingRequests: any[] = [];
      const outgoingRequests: any[] = [];
      const seenFriendIds = new Set<number>();

      for (const f of (friendships || [])) {
        const reqId = Number(f.user_id || f.requesterId);
        const addId = Number(f.friend_id || f.addresseeId);
        const requesterData = playerMap.get(reqId) || { id: reqId, name: 'لاعب' };
        const addresseeData = playerMap.get(addId) || { id: addId, name: 'لاعب' };

        if (f.status === 'ACCEPTED') {
          const friendData = reqId === viewer.id ? addresseeData : requesterData;
          if (friendData.id && !seenFriendIds.has(friendData.id) && friendData.id !== viewer.id) {
            seenFriendIds.add(friendData.id);
            friends.push({
              ...friendData,
              friendshipId: f.id,
              since: f.createdAt || f.created_at
            });
          }
        } else if (f.status === 'PENDING') {
          if (addId === viewer.id) {
            incomingRequests.push({
              ...requesterData,
              friendshipId: f.id,
              requestedAt: f.createdAt || f.created_at
            });
          } else if (reqId === viewer.id) {
            outgoingRequests.push({
              ...addresseeData,
              friendshipId: f.id,
              requestedAt: f.createdAt || f.created_at
            });
          }
        }
      }

      return res.status(200).json({
        uniquePlayerId: viewer.uniquePlayerId,
        friends,
        incomingRequests,
        outgoingRequests
      });
    }

    // ========================================================
    // 6. PUBLIC PLAYER PROFILE
    // ========================================================
    if (action === 'profile') {
      const targetId = req.query.targetId || req.body?.targetId;
      const viewerId = req.query.viewerId || req.body?.viewerId;

      const target = await resolvePlayer(targetId);
      if (!target) {
        return res.status(404).json({ error: 'لم يتم العثور على اللاعب' });
      }

      const viewer = viewerId ? await resolvePlayer(viewerId) : null;

      // Check friendship status
      let friendshipStatus = 'NONE';
      let friendshipId: string | number | null = null;
      if (viewer && viewer.id !== target.id) {
        const { data: existingFriendships } = await supabaseAdmin
          .from('friendships')
          .select('*')
          .or(`and(user_id.eq.${viewer.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${viewer.id})`)
          .limit(1);

        const friendship = existingFriendships && existingFriendships.length > 0 ? existingFriendships[0] : null;
        if (friendship) {
          friendshipId = friendship.id;
          const status = String(friendship.status || '').toUpperCase();
          if (status === 'ACCEPTED') {
            friendshipStatus = 'ACCEPTED';
          } else if (status === 'PENDING') {
            const reqId = Number(friendship.user_id || friendship.requesterId);
            friendshipStatus = reqId === viewer.id ? 'PENDING_SENT' : 'PENDING_RECEIVED';
          }
        }
      }

      // Quran Wird stats from user_wird table in Supabase
      let wirdStats = {
        hasWird: false,
        currentPage: 1,
        pagesPerDay: 4,
        currentSurah: 'الفاتحة',
        completionPercentage: 0,
        isActive: false
      };

      try {
        const uIdVariants = [
          String(target.id),
          target.uniquePlayerId,
          target.username,
          target.username ? target.username.replace(/^@+/, '') : null,
          target.name
        ].filter(Boolean);

        const { data: wirdList } = await supabaseAdmin
          .from('user_wird')
          .select('*')
          .in('user_id', uIdVariants)
          .limit(1);

        const wird = wirdList && wirdList.length > 0 ? wirdList[0] : null;
        if (wird) {
          const curPage = wird.current_page || 1;
          const percentage = Math.min(100, Math.round((curPage / 604) * 100));
          wirdStats = {
            hasWird: true,
            currentPage: curPage,
            pagesPerDay: wird.pages_per_day || 4,
            currentSurah: getSurahFromPage(curPage),
            completionPercentage: percentage,
            isActive: Boolean(wird.is_active)
          };
        }
      } catch (e) {
        console.error('[Friends Profile] Error fetching wird stats:', e);
      }

      // Calculate earned certificates strictly based on actual progress (100% completion only)
      const completedIds = Array.isArray(target.completedChallengeIds) ? target.completedChallengeIds : [];
      const earnedCertificates: any[] = [];

      let ayahCount = 0;
      let surahCount = 0;
      if (completedIds.length > 0) {
        try {
          const { data: challengesRows } = await supabaseAdmin
            .from('challenges')
            .select('id, type')
            .in('id', completedIds);

          if (challengesRows && Array.isArray(challengesRows)) {
            challengesRows.forEach((ch: any) => {
              const chType = String(ch.type || '').toUpperCase();
              if (chType === 'SURAH' || chType === 'SURAH_NAME') {
                surahCount++;
              } else if (chType === 'COMPLETION' || chType === 'STANDARD') {
                ayahCount++;
              }
            });
          }
        } catch (err) {
          console.error('[Friends Profile] Error querying challenges:', err);
        }
      }

      // Query correct answers from user_answers
      let seerahCount = 0;
      let fiqhCount = 0;
      try {
        const candidateUserIds = [
          target.uniquePlayerId,
          target.username,
          target.name,
          target.id ? String(target.id) : null
        ].filter(Boolean) as string[];

        const { data: answers } = await supabaseAdmin
          .from('user_answers')
          .select('category, question_id, is_correct')
          .in('user_id', candidateUserIds)
          .eq('is_correct', true);

        if (answers && Array.isArray(answers)) {
          const seerahSet = new Set();
          const fiqhSet = new Set();
          answers.forEach((a: any) => {
            const cat = String(a.category || '').toLowerCase();
            if (cat === 'seerah' || cat === 'seerah_60' || cat === 'sirah') {
              seerahSet.add(a.question_id);
            } else if (cat === 'figh' || cat === 'figh_quiz' || cat === 'fiqh' || cat === 'general') {
              fiqhSet.add(a.question_id);
            }
          });
          seerahCount = seerahSet.size;
          fiqhCount = fiqhSet.size;
        }
      } catch (err) {
        console.error('[Friends Profile] Error querying user_answers:', err);
      }

      // Strict Validation: userProgress >= targetGoal
      if (ayahCount >= 100) {
        earnedCertificates.push({
          id: 'ayah_100',
          title: 'إتمام 100 سؤال في تحدي إكمال الآية',
          category: 'علوم القرآن',
          scope: 'كامل القرآن الكريم',
          score: '100%',
          icon: '📖',
          serial: `MTN-AY-${target.id}-100`
        });
      }

      if (surahCount >= 50) {
        earnedCertificates.push({
          id: 'surah_50',
          title: 'إتمام 50 سؤالاً في تحدي تحديد اسم السورة',
          category: 'متشابهات السور',
          scope: 'أجزاء عم وتبارك والمفصل',
          score: '100%',
          icon: '🕌',
          serial: `MTN-SRH50-${target.id}-50`
        });
      }

      if (seerahCount >= 60) {
        earnedCertificates.push({
          id: 'seerah_60',
          title: 'إتمام 60 سؤالاً في السيرة النبوية الشريفة',
          category: 'السيرة النبوية',
          scope: 'العهد المكي والمدني والغزوات',
          score: '100%',
          icon: '📜',
          serial: `MTN-SRH-${target.id}-60`
        });
      }

      if (fiqhCount >= 100) {
        earnedCertificates.push({
          id: 'figh_quiz',
          title: 'ختم مسابقة الفقه والمعلومات الإسلامية',
          category: 'الفقه الإسلامي',
          scope: 'العبادات والمعاملات',
          score: '100%',
          icon: '⚖️',
          serial: `MTN-FQ-${target.id}-100`
        });
      }

      if ((target.streak || 0) >= 30) {
        earnedCertificates.push({
          id: 'daily_streak_30',
          title: 'سلسلة 30 يوماً متتالية في التحدي اليومي',
          category: 'المثابرة والهمة',
          scope: 'الشهر القرآني المبارك',
          score: 'سلسلة 30 يوماً',
          icon: '🔥',
          serial: `MTN-ST-${target.id}-30`
        });
      }

      if ((target.points || 0) >= 1000) {
        earnedCertificates.push({
          id: 'speed_1000',
          title: 'المركز الأول و1000 نقطة في تحدي السرعة',
          category: 'تحديات الصدارة',
          scope: 'سرعة البديهة في المتشابهات',
          score: '1,000 نقطة',
          icon: '⚡',
          serial: `MTN-SP-${target.id}-1000`
        });
      }

      return res.status(200).json({
        player: {
          id: target.id,
          name: target.name || 'لاعب',
          username: target.username,
          uniquePlayerId: target.uniquePlayerId,
          points: target.points || 0,
          cups: target.cups || 0,
          streak: target.streak || 0,
          activeFrame: target.activeFrame,
          equippedNameColor: target.equippedNameColor,
          seerahCompleted: target.seerahCompleted || false,
          generalCompleted: target.generalCompleted || false,
          quranCompleted: target.quranCompleted || false,
          completedChallengeIds: completedIds,
          createdAt: target.createdAt || target.created_at
        },
        wird: wirdStats,
        earnedCertificates,
        friendshipStatus,
        friendshipId,
        isSelf: viewer?.id === target.id
      });
    }

    return res.status(400).json({ error: 'الإجراء غير معروف' });
  } catch (error: any) {
    console.error('Friends API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في معالجة طلب الأصدقاء', details: error.message });
  }
}
