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
  metadata = {}
}: BroadcastNotificationParams): Promise<BroadcastNotificationResult> {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const cleanTargetUrl = targetUrl ? targetUrl.trim() : null;
  const resolvedFullUrl = fullUrl ? fullUrl.trim() : resolveFullUrl(cleanTargetUrl);
  
  let savedNotification: any = initialSavedNotification || null;

  // 1. Mandatory Supabase persistence (Force save)
  if (!savedNotification) {
    try {
      const { data: sbData, error: sbErr } = await supabaseAdmin
        .from('notifications')
        .insert({
          title: cleanTitle,
          body: cleanBody,
          target_url: cleanTargetUrl,
          sender_role: senderRole,
          sender_name: senderName
        })
        .select();

      if (sbErr) {
        console.error('[Broadcast] Critical Supabase Insert Error:', sbErr);
        // Force simple insert if schema mismatch
        const retry = await supabaseAdmin
          .from('notifications')
          .insert({ title: cleanTitle, body: cleanBody })
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

  // 2. Strict Deduplication by User ID (not just Token string)
  const uniqueTokensMap = new Map<string, string>(); // Key: User ID (or token if no ID), Value: Token
  const allStaleTokens = new Set<string>();

  try {
    const { data: sbTokens } = await supabaseAdmin.from('device_tokens').select('*');
    if (sbTokens && Array.isArray(sbTokens)) {
      for (const t of sbTokens) {
        const val = (t.token || t.fcm_token || t.device_token || '').trim();
        if (val && val.length > 20) {
          // If user_id exists, only keep ONE token per user!
          const key = t.user_id ? `user_${t.user_id}` : val;
          // If a token already exists for this user, mark the old one as stale (to be deleted later)
          if (t.user_id && uniqueTokensMap.has(key)) {
            allStaleTokens.add(uniqueTokensMap.get(key)!);
          }
          uniqueTokensMap.set(key, val);
        }
      }
    }
  } catch (err) {
    console.warn('[Broadcast] Error fetching tokens from Supabase:', err);
  }

  const finalTokensToPush = Array.from(uniqueTokensMap.values());
  console.log(`[Broadcast] Sending push to ${finalTokensToPush.length} unique users/devices.`);

  // 3. Send FCM Push Notifications
  const messaging = getFirebaseMessaging();
  let successCount = 0;
  let failureCount = 0;
  
  if (messaging && finalTokensToPush.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < finalTokensToPush.length; i += chunkSize) {
      const chunk = finalTokensToPush.slice(i, i + chunkSize);
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: { title: cleanTitle, body: cleanBody },
          data: {
            title: cleanTitle,
            body: cleanBody,
            url: resolvedFullUrl || '/',
            full_url: resolvedFullUrl || '/',
            relative_url: cleanTargetUrl || '/',
            click_action: resolvedFullUrl || '/',
            route: String(metadata?.route || cleanTargetUrl || '/'),
            target_url: cleanTargetUrl || '/',
            ...Object.fromEntries(
              Object.entries(metadata || {}).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])
            )
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
              lang: 'ar'
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
            allStaleTokens.add(chunk[idx]);
          }
        });
      } catch (fcmErr) {
        failureCount += chunk.length;
      }
    }

    // 4. Aggressive Cleanup of Stale & Duplicate Tokens
    if (allStaleTokens.size > 0) {
      const staleArray = Array.from(allStaleTokens);
      try {
        await supabaseAdmin.from('device_tokens').delete().in('token', staleArray);
        await supabaseAdmin.from('device_tokens').delete().in('fcm_token', staleArray);
        console.log(`[Broadcast] Cleaned up ${staleArray.length} stale/duplicate FCM tokens.`);
      } catch (e) {
        console.warn('[Broadcast] Cleanup error:', e);
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
