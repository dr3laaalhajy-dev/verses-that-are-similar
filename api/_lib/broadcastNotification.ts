import { prisma } from './prisma.js';
import { getFirebaseMessaging } from './firebaseAdmin.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hexxbopfvbuliakufejj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhleHhib3BmdmJ1bGlha3VmZWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMzA1MjYsImV4cCI6MjEwODgwNjUyNn0.-JG3tJo4PJrxtaHI9MC9fXQKR1AZ60GY5b-OJOFNSZo';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  metadata = {}
}: BroadcastNotificationParams): Promise<BroadcastNotificationResult> {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const cleanTargetUrl = targetUrl ? targetUrl.trim() : null;
  const resolvedFullUrl = fullUrl ? fullUrl.trim() : resolveFullUrl(cleanTargetUrl);

  let savedNotification: any = null;

  // 1. Prisma / Neon database persistence
  try {
    savedNotification = await (prisma as any).notification.create({
      data: {
        title: cleanTitle,
        body: cleanBody,
        target_url: cleanTargetUrl,
        sender_role: senderRole,
        sender_name: senderName,
        metadata: metadata || {}
      }
    });
  } catch (prismaErr) {
    console.warn('[Broadcast] Prisma save warning:', prismaErr);
  }

  // 2. Supabase persistence (triggers Supabase Realtime in-app bell instantly)
  try {
    const { data: sbData, error: sbErr } = await supabase
      .from('notifications')
      .insert({
        title: cleanTitle,
        body: cleanBody,
        target_url: cleanTargetUrl,
        sender_role: senderRole,
        sender_name: senderName,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (sbErr) {
      console.warn('[Broadcast] Supabase Realtime insert warning:', sbErr.message);
    } else if (!savedNotification && sbData) {
      savedNotification = sbData;
    }
  } catch (sbEx) {
    console.warn('[Broadcast] Supabase insert exception:', sbEx);
  }

  // 3. Gather all FCM Device Tokens (from both Prisma and Supabase)
  const tokenSet = new Set<string>();

  try {
    const dbTokens = await (prisma as any).deviceToken.findMany({
      select: { fcm_token: true }
    });
    dbTokens.forEach((t: any) => {
      if (t.fcm_token) tokenSet.add(t.fcm_token);
    });
  } catch (e) {
    console.warn('[Broadcast] Could not query Prisma device tokens:', e);
  }

  try {
    const { data: sbTokens } = await supabase
      .from('device_tokens')
      .select('fcm_token');
    if (sbTokens && Array.isArray(sbTokens)) {
      sbTokens.forEach((t: any) => {
        if (t.fcm_token) tokenSet.add(t.fcm_token);
      });
    }
  } catch (e) {
    console.warn('[Broadcast] Could not query Supabase device tokens:', e);
  }

  const allTokens = Array.from(tokenSet);
  console.log(`[Broadcast] Total active device tokens retrieved: ${allTokens.length}`);

  // 4. Send FCM Push Notifications via Firebase Admin SDK
  const messaging = getFirebaseMessaging();
  let successCount = 0;
  let failureCount = 0;
  const staleTokens: string[] = [];

  if (messaging && allTokens.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < allTokens.length; i += chunkSize) {
      const chunk = allTokens.slice(i, i + chunkSize);
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
            ...(metadata || {})
          },
          webpush: {
            fcmOptions: {
              link: resolvedFullUrl || '/'
            },
            notification: {
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
        await supabase
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
      totalTokens: allTokens.length,
      pushSuccessCount: successCount,
      pushFailureCount: failureCount,
      fcmConfigured: !!messaging
    }
  };
}

