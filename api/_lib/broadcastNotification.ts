import { prisma } from './prisma.js';
import { getFirebaseMessaging } from './firebaseAdmin.js';
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Resolves a full absolute URL for push notifications payload (FCM).
 * If targetUrl starts with '/' (relative path), it prepends the site base URL.
 */
export function resolveFullUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  // If already an absolute URL (http:// or https://)
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Ensure relative path starts with /
  const relativePath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // Extract Base URL from environment variables
  let baseUrl =
    process.env.VITE_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    '';

  if (!baseUrl && process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  }
  if (!baseUrl && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (!baseUrl) {
    baseUrl = 'https://mateen-quran.vercel.app';
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}${relativePath}`;
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

/**
 * Reusable function to broadcast in-app realtime notifications and FCM web/mobile push
 */
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

  // 1. Mandatory Supabase persistence (Single Source of Truth) if not already saved by caller
  if (!savedNotification) {
    try {
      const payloadToInsert: any = {
        title: cleanTitle,
        body: cleanBody,
        target_url: cleanTargetUrl,
        sender_role: senderRole,
        sender_name: senderName
      };

      let { data: sbData, error: sbErr } = await supabaseAdmin
        .from('notifications')
        .insert(payloadToInsert)
        .select();

      // In case target_url, sender_role, or sender_name columns are not yet in Supabase schema cache
      if (sbErr && (sbErr.code === 'PGRST204' || sbErr.message?.includes('column') || sbErr.code === '42703')) {
        console.warn('[Broadcast] Schema column mismatch on notifications table, retrying with core columns:', sbErr.message);
        const corePayload: any = {
          title: cleanTitle,
          body: cleanBody
        };
        const retry = await supabaseAdmin
          .from('notifications')
          .insert(corePayload)
          .select();
        sbData = retry.data;
        sbErr = retry.error;
      }

      if (sbErr) {
        console.error('Failed to save notification to Supabase:', sbErr);
      } else if (sbData && sbData.length > 0) {
        savedNotification = sbData[0];
        // Realtime Broadcast
        try {
          await supabaseAdmin.channel('realtime_public_notifications').send({
            type: 'broadcast',
            event: 'NOTIFICATION_UPDATED',
            payload: sbData[0]
          });
        } catch (bcErr) {
          console.warn('[Broadcast] Realtime channel broadcast warning:', bcErr);
        }
      }
    } catch (sbEx: any) {
      console.error('[Broadcast] Exception saving notification in Supabase:', sbEx?.message || sbEx);
    }
  }

  // 2. Gather and Strictly Deduplicate Device Tokens
  const rawTokens: string[] = [];

  try {
    const { data: sbTokens, error: tokenErr } = await supabaseAdmin
      .from('device_tokens')
      .select('*');

    if (sbTokens && Array.isArray(sbTokens)) {
      for (const t of sbTokens) {
        const val = (t.token || t.fcm_token || t.device_token || '').trim();
        if (val && val.length > 20) {
          rawTokens.push(val);
        }
      }
    }
    if (tokenErr) {
      console.warn('[Broadcast] Supabase device_tokens query warning:', tokenErr.message);
    }
  } catch (err: any) {
    console.warn('[Broadcast] Could not query Supabase device tokens:', err?.message || err);
  }

  try {
    const dbTokens = await (prisma as any).deviceToken.findMany({
      select: { fcm_token: true }
    });
    if (dbTokens && Array.isArray(dbTokens)) {
      for (const t of dbTokens) {
        const val = (t.fcm_token || '').trim();
        if (val && val.length > 20) {
          rawTokens.push(val);
        }
      }
    }
  } catch (_) {}

  // Strict Deduplication using Set (prevents duplicate push notifications on lock screen)
  const uniqueTokens = Array.from(new Set(rawTokens.map(t => t.trim()))).filter(t => Boolean(t) && t.length > 20);

  console.log(`[Broadcast] Total raw tokens: ${rawTokens.length}, Unique device tokens: ${uniqueTokens.length}`);

  // 4. Send FCM Push Notifications via Firebase Admin SDK
  const messaging = getFirebaseMessaging();
  let successCount = 0;
  let failureCount = 0;
  const staleTokens: string[] = [];

  if (messaging && uniqueTokens.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < uniqueTokens.length; i += chunkSize) {
      const chunk = uniqueTokens.slice(i, i + chunkSize);
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: {
            title: cleanTitle,
            body: cleanBody
          },
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

        // Collect stale or invalid tokens
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const code = resp.error.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              staleTokens.push(chunk[idx]);
            }
          }
        });
      } catch (fcmErr) {
        console.error('[Broadcast] FCM batch send error:', fcmErr);
        failureCount += chunk.length;
      }
    }

    // Automatically prune stale tokens from database
    if (staleTokens.length > 0) {
      try {
        await (prisma as any).deviceToken.deleteMany({
          where: { fcm_token: { in: staleTokens } }
        });
      } catch (_) {}

      try {
        await supabaseAdmin
          .from('device_tokens')
          .delete()
          .in('token', staleTokens);
      } catch (_) {}

      try {
        await supabaseAdmin
          .from('device_tokens')
          .delete()
          .in('fcm_token', staleTokens);
      } catch (_) {}

      console.log(`[Broadcast] Cleaned up ${staleTokens.length} stale FCM tokens.`);
    }
  } else if (!messaging) {
    console.log('[Broadcast] Firebase Admin messaging not configured. In-app realtime notification recorded.');
  }

  return {
    savedNotification: savedNotification || {
      title: cleanTitle,
      body: cleanBody,
      sender_role: senderRole,
      sender_name: senderName,
      created_at: new Date().toISOString()
    },
    stats: {
      totalTokens: uniqueTokens.length,
      pushSuccessCount: successCount,
      pushFailureCount: failureCount,
      fcmConfigured: !!messaging
    }
  };
}

