import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_URL || import.meta.env?.NEXT_PUBLIC_SUPABASE_URL)) ||
  'https://hexxbopfvbuliakufejj.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_ANON_KEY ||
      import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) ||
  'sb_publishable_1cax-8DlGIbIxuqSMYxP6Q_VResi3RQ';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase Config Warning] VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY غير معرّف في ملف .env!\n' +
    'يرجى التأكد من إضافة المتغيرين في .env ليعمل التزامن اللحظي للتفاعلات (Realtime).'
  );
} else {
  console.log('[Supabase Config] تم تهيئة عميل Supabase بنجاح:', supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export default supabase;
