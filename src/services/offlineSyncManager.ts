import { supabase } from './supabase';

export interface OfflineSyncItem {
  id: string;
  type: 'GROUP_PROGRESS' | 'CERTIFICATE' | 'PLAYER_CHALLENGE';
  payload: any;
  createdAt: string;
  retryCount: number;
}

const SYNC_QUEUE_KEY = 'quran_offline_sync_queue';

/**
 * فحص حالة الاتصال بالإنترنت
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * جلب عناصر طابور المزامنة المعلقة من التخزين المحلي
 */
export function getPendingQueue(): OfflineSyncItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[OfflineSync] Failed to read sync queue:', e);
    return [];
  }
}

/**
 * حفظ طابور المزامنة في التخزين المحلي
 */
function saveQueue(queue: OfflineSyncItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: { count: queue.length } }));
  } catch (e) {
    console.error('[OfflineSync] Failed to persist sync queue:', e);
  }
}

/**
 * إضافة عنصر جديد إلى طابور المزامنة عند انقطاع الإنترنت أو فشل السيرفر
 */
export function enqueueSyncItem(
  type: 'GROUP_PROGRESS' | 'CERTIFICATE' | 'PLAYER_CHALLENGE',
  payload: any
): OfflineSyncItem {
  const queue = getPendingQueue();
  const newItem: OfflineSyncItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0
  };

  // تفادي تكرار نفس العنصر
  const filtered = queue.filter(item => {
    if (item.type === type) {
      if (type === 'GROUP_PROGRESS') {
        return !(
          item.payload.user_id === payload.user_id &&
          item.payload.category === payload.category &&
          item.payload.group_num === payload.group_num &&
          item.payload.level_num === payload.level_num
        );
      }
      if (type === 'CERTIFICATE') {
        return !(
          item.payload.user_id === payload.user_id &&
          item.payload.category === payload.category
        );
      }
    }
    return true;
  });

  filtered.push(newItem);
  saveQueue(filtered);
  console.log(`[OfflineSync] Enqueued ${type} item. Total pending: ${filtered.length}`);
  return newItem;
}

/**
 * إرسال ومزامنة كافة البيانات المعلقة في الطابور دفعة واحدة إلى Supabase
 */
export async function syncOfflineData(): Promise<{ syncedCount: number; errors: any[] }> {
  if (!isOnline()) {
    console.log('[OfflineSync] Still offline, skipping sync.');
    return { syncedCount: 0, errors: [] };
  }

  const queue = getPendingQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, errors: [] };
  }

  console.log(`[OfflineSync] Starting auto-sync for ${queue.length} pending items...`);
  const remainingQueue: OfflineSyncItem[] = [];
  let syncedCount = 0;
  const errors: any[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'GROUP_PROGRESS') {
        const { error } = await supabase
          .from('challenge_progress')
          .upsert(item.payload, { onConflict: 'user_id,category,group_num,level_num' });

        if (error) throw error;
        syncedCount++;
      } else if (item.type === 'CERTIFICATE') {
        // مزامنة جدول الشهادات
        const { error: certErr } = await supabase
          .from('certificates')
          .upsert(item.payload.certificate, { onConflict: 'user_id,category' });

        if (certErr) throw certErr;

        // مزامنة حالة اللاعب في جدول players
        if (item.payload.playerUpdate && item.payload.playerIdFilter) {
          const { error: playerErr } = await supabase
            .from('players')
            .update(item.payload.playerUpdate)
            .or(item.payload.playerIdFilter);

          if (playerErr) console.warn('[OfflineSync] Player certificate flag update notice:', playerErr);
        }

        syncedCount++;
      } else if (item.type === 'PLAYER_CHALLENGE') {
        let q = supabase.from('players').update(item.payload.updateData);
        if (item.payload.filter) {
          q = q.or(item.payload.filter);
        }
        const { error } = await q;
        if (error) throw error;
        syncedCount++;
      }
    } catch (err: any) {
      console.warn(`[OfflineSync] Failed to sync item ${item.id} (${item.type}):`, err);
      item.retryCount = (item.retryCount || 0) + 1;
      errors.push(err);
      // الاحتفاظ بالعنصر للمحاولة القادمة إذا لم يتجاوز 10 محاولات
      if (item.retryCount < 10) {
        remainingQueue.push(item);
      }
    }
  }

  saveQueue(remainingQueue);

  if (syncedCount > 0) {
    console.log(`[OfflineSync] Successfully synced ${syncedCount} items. Remaining: ${remainingQueue.length}`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('milestones_updated'));
      window.dispatchEvent(new CustomEvent('quran_certificates_updated'));
      window.dispatchEvent(new CustomEvent('offline_sync_completed', { detail: { syncedCount } }));
    }
  }

  return { syncedCount, errors };
}

/**
 * تهيئة مستمعات الأحداث التلقائية للمزامنة عند عودة الاتصال
 */
export function initOfflineSyncManager(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    console.log('[OfflineSync] Network status: ONLINE. Initiating sync...');
    syncOfflineData();
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && isOnline()) {
      syncOfflineData();
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  // تشغيل المزامنة فوراً عند بدء التطبيق إذا كان متصلاً
  if (isOnline()) {
    setTimeout(() => {
      syncOfflineData();
    }, 2000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

