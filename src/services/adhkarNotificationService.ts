/**
 * Adhkar Notification Scheduling Service
 * Manages scheduling for Morning and Evening Adhkar notifications with route payloads
 */

export interface AdhkarNotificationOptions {
  type: 'morning' | 'evening';
  hour?: number;
  minute?: number;
}

export async function scheduleAdhkarNotification(options: AdhkarNotificationOptions): Promise<boolean> {
  const isMorning = options.type === 'morning';
  const route = isMorning ? '/adhkar/morning' : '/adhkar/evening';
  const title = isMorning ? '☀️ أذكار الصباح | ابدأ يومك بحفظ الله' : '🌙 أذكار المساء | حصنك ليلتك';
  const body = isMorning
    ? '«أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ» • أذكار الصباح حصنك الحصين وسبب لانشراح صدرك وتيسير يومك.'
    : '«أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ» • أقبل الليل فحصّن نفسك وأهلك بأذكار المساء لتنعم بالسكينة والأمان.';

  const notifId = isMorning ? 1001 : 1002;
  const targetHour = options.hour ?? (isMorning ? 7 : 17);
  const targetMinute = options.minute ?? 0;

  // 1. Capacitor LocalNotifications (Mobile Native)
  try {
    const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
    const localPlugin = cap?.Plugins?.LocalNotifications;
    if (localPlugin && typeof localPlugin.schedule === 'function') {
      await localPlugin.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            schedule: {
              on: {
                hour: targetHour,
                minute: targetMinute
              },
              allowWhileIdle: true
            },
            extra: {
              route,
              type: options.type
            },
            data: {
              route,
              type: options.type
            }
          }
        ]
      });
      console.log(`[AdhkarNotificationService] Scheduled local ${options.type} notification for ${targetHour}:${targetMinute} with route: ${route}`);
      return true;
    }
  } catch (err) {
    console.warn('[AdhkarNotificationService] Failed to schedule via Capacitor LocalNotifications:', err);
  }

  return false;
}

