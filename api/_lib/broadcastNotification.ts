import { getFirebaseMessaging } from './firebaseAdmin.js';
import { supabaseAdmin } from './supabaseAdmin.js';

export function resolveFullUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const relativePath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  let baseUrl = process.env.VITE_APP_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  if (!baseUrl && process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
  if (!baseUrl && process.env.VERCEL_PROJECT_PRODUCTION_URL) baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (!baseUrl) baseUrl = 'https://mateen-quran.vercel.app';
  return `${baseUrl.replace(/\/+$/, '')}${relativePath}`;
}

export interface BroadcastNotificationParams {
  title: string;
  body: string;
  targetUrl?: string | null;
  fullUrl?: string | null;
  senderRole?: string;
  senderName?: string;
  savedNotification?: any;
  receiverId?: string | null;
  metadata?: Record<string, any>;
}

export interface BroadcastNotificationResult {
  savedNotification: any;
  stats: {
    totalTokens: number;
    pushSuccessCount: number;
    pushFailureCount: number;
    fcmConfigured: boolean;
  };
}

export async function broadcastNotification({
  title,
  body,
  targetUrl = null,
  fullUrl = null,
  senderRole = 'SYSTEM',
  senderName = 'تطبيق متين',
  savedNotification: initialSavedNotification = null,
  receiverId = null,
  metadata = {}
}: BroadcastNotificationParams): Promise<BroadcastNotificationResult> {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const cleanTargetUrl = targetUrl ? targetUrl.trim() : null;
  const resolvedFullUrl = fullUrl ? fullUrl.trim() : resolveFullUrl(cleanTargetUrl);
  const cleanReceiverId = receiverId && String(receiverId).trim() ? String(receiverId).trim() : null;
  
  let savedNotification: any = initialSavedNotification || null;

  // 1. Mandatory Supabase persistence (Force save)
  if (!savedNotification) {
    try {
      const insertData: any = {
        title: cleanTitle,
        body: cleanBody,
        receiver_id: cleanReceiverId
      };
      if (cleanTargetUrl) insertData.target_url = cleanTargetUrl;
      if (senderRole) insertData.sender_role = senderRole;
      if (senderName) insertData.sender_name = senderName;

      const { data: sbData, error: sbErr } = await supabaseAdmin
        .from('notifications')
        .insert(insertData)
        .select();

      if (sbErr) {
        console.error('[Broadcast] Critical Supabase Insert Error:', sbErr);
        // Force simple insert if schema mismatch
        const retry = await supabaseAdmin
          .from('notifications')
          .insert({ title: cleanTitle, body: cleanBody, receiver_id: cleanReceiverId })
          .select();
        if (retry.data && retry.data.length > 0) savedNotification = retry.data[0];
      } else if (sbData && sbData.length > 0) {
        savedNotification = sbData[0];
      }

      if (savedNotification) {
        try {
          await supabaseAdmin.channel('realtime_public_notifications').send({
            type: 'broadcast',
            event: 'NOTIFICATION_UPDATED',
            payload: savedNotification
          });
        } catch (chanErr) {
          console.warn('[Broadcast] Realtime broadcast warning:', chanErr);
        }
      }
    } catch (sbEx: any) {
      console.error('[Broadcast] Exception saving notification:', sbEx?.message || sbEx);
    }
  }

  // 2. Strict Deduplication by Token string AND by User ID
  const uniqueTokensSet = new Set<string>();
  const seenUserIds = new Set<string>();
  const staleTokenIds = new Set<string>();

  try {
    let tokenQuery = supabaseAdmin
      .from('device_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    // إذا كان الإشعار موجهاً لمستخدم محدد، نقوم بجلب التوكنز التابعة له فقط
    if (cleanReceiverId) {
      tokenQuery = tokenQuery.eq('user_id', cleanReceiverId);
    }

    const { data: sbTokens, error: tokenErr } = await tokenQuery;

    if (tokenErr) {
      console.warn('[Broadcast] Error fetching tokens from Supabase:', tokenErr.message);
    } else if (sbTokens && Array.isArray(sbTokens)) {
      for (const t of sbTokens) {
        const tokenVal = (t.token || t.fcm_token || t.device_token || '').trim();
        
        // Skip invalid / corrupted token strings
        if (!tokenVal || tokenVal.length < 20) {
          if (t.id) staleTokenIds.add(t.id);
          continue;
        }

        const uId = t.user_id ? String(t.user_id).trim() : null;

        // If this exact token is already in our set, this row is a duplicate
        if (uniqueTokensSet.has(tokenVal)) {
          if (t.id) staleTokenIds.add(t.id);
          continue;
        }

        // If this user already has a newer token registered, mark this older one as stale
        if (uId && seenUserIds.has(uId)) {
          if (t.id) staleTokenIds.add(t.id);
          continue;
        }

        if (uId) {
          seenUserIds.add(uId);
        }
        uniqueTokensSet.add(tokenVal);
      }
    }

    // Immediately remove duplicate/stale rows from Supabase
    if (staleTokenIds.size > 0) {
      const idsToDelete = Array.from(staleTokenIds);
      try {
        await supabaseAdmin.from('device_tokens').delete().in('id', idsToDelete);
        console.log(`[Broadcast] Cleaned up ${idsToDelete.length} stale/duplicate device token records from Supabase.`);
      } catch (delErr) {
        console.warn('[Broadcast] Warning deleting stale tokens:', delErr);
      }
    }
  } catch (err) {
    console.warn('[Broadcast] Exception during token deduplication:', err);
  }

  // Pure strict deduplicated array
  const finalTokensToPush = Array.from(uniqueTokensSet);
  console.log(`[Broadcast] Sending push to ${finalTokensToPush.length} strictly unique device tokens.`);

  // 3. Send FCM Push Notifications with unified, non-duplicated payload
  const messaging = getFirebaseMessaging();
  let successCount = 0;
  let failureCount = 0;
  const invalidTokensToDelete = new Set<string>();

  if (messaging && finalTokensToPush.length > 0) {
    const chunkSize = 500;
    const notificationTag = `mateen_${Date.now()}`;

    // Clean metadata without duplicating title or body
    const cleanData: Record<string, string> = {
      url: resolvedFullUrl || '/',
      full_url: resolvedFullUrl || '/',
      relative_url: cleanTargetUrl || '/',
      click_action: resolvedFullUrl || '/',
      route: String(metadata?.route || cleanTargetUrl || '/'),
      target_url: cleanTargetUrl || '/',
      tag: notificationTag
    };

    if (metadata && typeof metadata === 'object') {
      for (const [k, v] of Object.entries(metadata)) {
        if (k !== 'title' && k !== 'body' && v !== undefined && v !== null) {
          cleanData[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
        }
      }
    }

    for (let i = 0; i < finalTokensToPush.length; i += chunkSize) {
      const chunk = finalTokensToPush.slice(i, i + chunkSize);
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: chunk,
          // Visible notification handled exclusively by notification payload (to prevent duplicate background renders)
          notification: {
            title: cleanTitle,
            body: cleanBody
          },
          // Data payload holds only routing and metadata - NO title/body duplicates
          data: cleanData,
          android: {
            priority: 'high',
            notification: {
              title: cleanTitle,
              body: cleanBody,
              icon: 'ic_stat_notification',
              color: '#10b981',
              channelId: 'mateen_general',
              tag: notificationTag
            }
          },
          webpush: {
            headers: {
              Urgency: 'high'
            },
            fcmOptions: {
              link: resolvedFullUrl || '/'
            },
            notification: {
              title: cleanTitle,
              body: cleanBody,
              icon: '/logo.png',
              badge: '/logo-mark.png',
              dir: 'rtl',
              lang: 'ar',
              tag: notificationTag
            }
          }
        });
        
        successCount += response.successCount;
        failureCount += response.failureCount;
        
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error && (
            resp.error.code === 'messaging/invalid-registration-token' ||
            resp.error.code === 'messaging/registration-token-not-registered'
          )) {
            invalidTokensToDelete.add(chunk[idx]);
          }
        });
      } catch (fcmErr) {
        console.error('[Broadcast] FCM chunk error:', fcmErr);
        failureCount += chunk.length;
      }
    }

    // 4. Cleanup any unregistered/expired tokens reported by FCM
    if (invalidTokensToDelete.size > 0) {
      const invalidArray = Array.from(invalidTokensToDelete);
      try {
        await supabaseAdmin.from('device_tokens').delete().in('token', invalidArray);
        await supabaseAdmin.from('device_tokens').delete().in('fcm_token', invalidArray);
        console.log(`[Broadcast] Cleaned up ${invalidArray.length} unregistered FCM tokens.`);
      } catch (e) {
        console.warn('[Broadcast] Error deleting invalid FCM tokens:', e);
      }
    }
  }

  return {
    savedNotification: savedNotification || { title: cleanTitle, body: cleanBody },
    stats: {
      totalTokens: finalTokensToPush.length,
      pushSuccessCount: successCount,
      pushFailureCount: failureCount,
      fcmConfigured: !!messaging
    }
  };
}
