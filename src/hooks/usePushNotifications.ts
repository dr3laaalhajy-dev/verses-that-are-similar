import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { requestFCMToken, onForegroundMessage } from '../services/firebase';

export interface UsePushNotificationsReturn {
  fcmToken: string | null;
  permission: NotificationPermission;
  isLoading: boolean;
  isSupported: boolean;
  error: string | null;
  requestPermissionAndRegister: () => Promise<string | null>;
}

export function usePushNotifications(userId?: string | null, onNotificationReceived?: (payload: any) => void): UsePushNotificationsReturn {
  const [fcmToken, setFcmToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('fcm_device_token') || null;
    } catch {
      return null;
    }
  });

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

  /**
   * Save or update FCM token in database
   */
  const saveTokenToDatabase = useCallback(async (token: string, uId: string) => {
    const platform = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'web';

    // 1. Save in Supabase
    try {
      const { error: sbError } = await supabase
        .from('device_tokens')
        .upsert(
          {
            user_id: uId,
            fcm_token: token,
            platform,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'fcm_token' }
        );

      if (sbError) {
        console.warn('[PushNotifications] Supabase save warn:', sbError.message);
      } else {
        console.log('[PushNotifications] Token saved to Supabase successfully.');
      }
    } catch (err) {
      console.warn('[PushNotifications] Supabase exception:', err);
    }

    // 2. Fallback / Sync with API Route
    try {
      await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uId,
          fcmToken: token,
          platform
        })
      }).catch(() => {});
    } catch (apiErr) {
      // Ignore API fetch errors silently
    }
  }, []);

  /**
   * Request permission from browser and register device token
   */
  const requestPermissionAndRegister = useCallback(async (): Promise<string | null> => {
    if (!isSupported) {
      setError('المتصفح الحالي لا يدعم التنبيهات المباشرة');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await requestFCMToken();
      if (token) {
        setFcmToken(token);
        setPermission('granted');
        try {
          localStorage.setItem('fcm_device_token', token);
        } catch {}

        const activeUserId = userId || localStorage.getItem('player_name') || 'guest_user';
        await saveTokenToDatabase(token, activeUserId);
        return token;
      } else {
        if ('Notification' in window) {
          setPermission(Notification.permission);
        }
        return null;
      }
    } catch (err: any) {
      console.error('[PushNotifications] Error:', err);
      setError(err?.message || 'فشل تفعيل التنبيهات');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, userId, saveTokenToDatabase]);

  // Auto-sync token if permission is already granted
  useEffect(() => {
    if (typeof window === 'undefined' || !isSupported) return;

    if (Notification.permission === 'granted' && !fcmToken) {
      requestPermissionAndRegister().catch(() => {});
    }
  }, [isSupported, fcmToken, requestPermissionAndRegister]);

  // Listen for foreground FCM notifications
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    onForegroundMessage((payload) => {
      if (onNotificationReceived) {
        onNotificationReceived(payload);
      }
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [onNotificationReceived]);

  return {
    fcmToken,
    permission,
    isLoading,
    isSupported,
    error,
    requestPermissionAndRegister
  };
}
