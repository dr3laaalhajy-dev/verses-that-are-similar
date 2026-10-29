import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_URL || import.meta.env?.NEXT_PUBLIC_SUPABASE_URL)) ||
  'https://hexxbopfvbuliakufejj.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_ANON_KEY ||
      import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhleHhib3BmdmJ1bGlha3VmZWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMzA1MjYsImV4cCI6MjEwODgwNjUyNn0.-JG3tJo4PJrxtaHI9MC9fXQKR1AZ60GY5b-OJOFNSZo';

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
