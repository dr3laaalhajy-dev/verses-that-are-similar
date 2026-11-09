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
    if (typeof window !== 'undefined') {
      if (window.AndroidBridge?.isNotificationPermissionGranted?.()) {
        return 'granted';
      }
      if ('Notification' in window) {
        return Notification.permission;
      }
    }
    return 'default';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSupported = typeof window !== 'undefined' && (Boolean(window.AndroidBridge) || ('Notification' in window && 'serviceWorker' in navigator));

  /**
   * Save or update FCM token in database
   */
  const saveTokenToDatabase = useCallback(async (token: string, uId: string, overridePlatform?: string) => {
    const cleanToken = (token || '').trim();
    if (!cleanToken) return;

    const platform = overridePlatform || (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'web');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uId || '');
    const safeUserId = isUuid ? uId : null;

    // 1. Save in Supabase with explicit upsert deduplication on token
    try {
      let { error: sbError } = await supabase
        .from('device_tokens')
        .upsert(
          {
            user_id: safeUserId,
            token: cleanToken
          },
          { onConflict: 'token' }
        );

      if (sbError && (sbError.code === '42703' || sbError.code === 'PGRST204' || sbError.message?.includes('token'))) {
        // Fallback: in case column is named 'fcm_token' in some migrations
        const retryRes = await supabase
          .from('device_tokens')
          .upsert(
            {
              user_id: safeUserId,
              fcm_token: cleanToken,
              platform,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'fcm_token' }
          );
        sbError = retryRes.error;
      }

      if (sbError) {
        console.warn('[PushNotifications] Supabase save warn:', sbError.message);
      } else {
        console.log('[PushNotifications] Token saved to Supabase successfully via upsert.');
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
          fcmToken: cleanToken,
          platform
        })
      }).catch(() => {});
    } catch (apiErr) {
      // Ignore API fetch errors silently
    }
  }, []);

  /**
   * Request permission from browser or native Android bridge and register device token
   */
  const requestPermissionAndRegister = useCallback(async (): Promise<string | null> => {
    // 1. فحص بيئة تطبيق الأندرويد واستدعاء الجسر البرمجي إذا كان متاحاً
    if (typeof window !== 'undefined' && window.AndroidBridge) {
      if (window.AndroidBridge.requestNotificationPermission) {
        window.AndroidBridge.requestNotificationPermission();
      }
      if (window.AndroidBridge.getFcmToken) {
        window.AndroidBridge.getFcmToken();
      }
      return null;
    }

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

  // استماع لنتيجة صلاحيات الإشعارات القادمة من جسر الأندرويد (AndroidBridge)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAndroidPermission = async (event: any) => {
      const granted = Boolean(event?.detail?.granted);
      if (granted) {
        setPermission('granted');
        // جلب التوكن الأصلي فور منح الصلاحية
        if (window.AndroidBridge?.getFcmToken) {
          window.AndroidBridge.getFcmToken();
        }
      } else {
        setPermission('denied');
      }
    };

    window.addEventListener('androidNotificationPermissionResult', handleAndroidPermission);
    return () => {
      window.removeEventListener('androidNotificationPermissionResult', handleAndroidPermission);
    };
  }, []);

  // استماع للتوكن الأصلي القادم من نظام أندرويد (Native Android FCM Token)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAndroidToken = async (event: any) => {
      const nativeToken = event?.detail?.token;
      if (nativeToken && typeof nativeToken === 'string' && nativeToken.trim().length > 10) {
        const cleanToken = nativeToken.trim();
        console.log('[PushNotifications] Native FCM Token received from Android:', cleanToken.substring(0, 15) + '...');
        setFcmToken(cleanToken);
        setPermission('granted');
        try {
          localStorage.setItem('fcm_device_token', cleanToken);
        } catch {}

        const activeUserId = userId || localStorage.getItem('player_name') || 'guest_user';
        await saveTokenToDatabase(cleanToken, activeUserId, 'android');
      }
    };

    window.addEventListener('androidFcmTokenReceived', handleAndroidToken);

    // إذا كنا داخل تطبيق الأندرويد، اطلب التوكن الأصلي فور تحميل الصفحة
    if (window.AndroidBridge?.getFcmToken) {
      window.AndroidBridge.getFcmToken();
    }

    return () => {
      window.removeEventListener('androidFcmTokenReceived', handleAndroidToken);
    };
  }, [userId, saveTokenToDatabase]);

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

