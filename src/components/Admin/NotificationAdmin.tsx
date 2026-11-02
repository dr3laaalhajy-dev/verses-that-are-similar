import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Send, CheckCircle2, AlertCircle, Loader2, Users, Smartphone,
  Radio, Clock, ShieldCheck, RefreshCw, Sparkles, MessageSquare,
  Pencil, Trash2, X, Save
} from 'lucide-react';
import { supabase } from '../../services/supabase';

export interface NotificationAdminProps {
  token: string;
  isFounder: boolean;
  isCoFounder: boolean;
}

interface NotificationHistoryItem {
  id: string;
  title: string;
  body: string;
  sender_role?: string;
  sender_name?: string;
  created_at: string;
}

export interface NotificationTemplate {
  title: string;
  body: string;
}

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    title: 'يوم الجمعة المبارك ✨',
    body: 'لا تنسَ قراءة سورة الكهف، والإكثار من الصلاة على النبي ﷺ، والدعاء في ساعة الاستجابة.'
  },
  {
    title: 'موسم طاعة مستمر 🌙',
    body: 'تذكير بصيام هذا اليوم المبارك، تقبل الله منا ومنكم صالح الأعمال.'
  },
  {
    title: 'وردك اليومي 📖',
    body: 'لا تنسَ قراءة وردك اليومي من القرآن الكريم وأذكار المسلم المتاحة داخل التطبيق.'
  },
  {
    title: 'تحدي جديد بانتظارك 🏆',
    body: 'تمت إضافة أسئلة جديدة في تحدي "من أنا؟". ادخل الآن واختبر معلوماتك الإسلامية!'
  },
  {
    title: 'جدد نيتك 🌟',
    body: 'دقائق قليلة من وقتك في رحاب التطبيق قد تكون سبباً في رفع درجاتك. بادر الآن!'
  }
];

export const NotificationAdmin: React.FC<NotificationAdminProps> = ({
  token,
  isFounder,
  isCoFounder
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    stats?: any;
  } | null>(null);

  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [tokensCount, setTokensCount] = useState<number | null>(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<NotificationHistoryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenEdit = (item: NotificationHistoryItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditBody(item.body);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editTitle.trim() || !editBody.trim()) return;

    setIsUpdating(true);
    try {
      const updatedData = {
        id: editingItem.id,
        title: editTitle.trim(),
        body: editBody.trim()
      };

      // 1. Send UPDATE to Supabase
      const { error: sbErr } = await supabase
        .from('notifications')
        .update({ title: updatedData.title, body: updatedData.body })
        .eq('id', editingItem.id);

      // 2. Fallback to API route if needed
      if (sbErr) {
        await fetch('/api/notifications', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedData)
        });
      }

      // 3. Broadcast Realtime event across Supabase channel
      const channel = supabase.channel('realtime_public_notifications');
      channel.send({
        type: 'broadcast',
        event: 'NOTIFICATION_UPDATED',
        payload: updatedData
      });

      // 4. Update local state
      setHistory(prev => prev.map(n => n.id === editingItem.id ? { ...n, ...updatedData } : n));
      setEditingItem(null);
      setResultMessage({
        type: 'success',
        text: 'تم تعديل الإشعار وبث التحديث لحظياً لجميع المستخدمين بنجاح.'
      });
    } catch (err: any) {
      alert('فشل حفظ التعديلات: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (item: NotificationHistoryItem) => {
    if (!window.confirm(`هل أنت متأكد من حذف التنبيه: "${item.title}"؟\nسيتم حذفه وبث أمر إزالته فوراً من نوافذ جميع المستخدمين دون تحديث الصفحة.`)) {
      return;
    }

    setDeletingId(item.id);
    try {
      // 1. Send DELETE to Supabase
      const { error: sbErr } = await supabase
        .from('notifications')
        .delete()
        .eq('id', item.id);

      // 2. Fallback to API route if needed
      if (sbErr) {
        await fetch(`/api/notifications?action=delete&id=${item.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      // 3. Broadcast Realtime event to delete notification instantly across all clients
      const channel = supabase.channel('realtime_public_notifications');
      channel.send({
        type: 'broadcast',
        event: 'NOTIFICATION_DELETED',
        payload: { id: item.id }
      });

      // 4. Update local state
      setHistory(prev => prev.filter(n => n.id !== item.id));
      setResultMessage({
        type: 'success',
        text: 'تم حذف التنبيه وبث أمر إزالته فوراً من نوافذ جميع المستخدمين.'
      });
    } catch (err: any) {
      alert('فشل حذف التنبيه: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTemplateIndex(val);
    if (val !== '' && NOTIFICATION_TEMPLATES[Number(val)]) {
      const template = NOTIFICATION_TEMPLATES[Number(val)];
      setTitle(template.title);
      setBody(template.body);
    }
  };

  // Fetch sent notifications and device tokens count
  const fetchHistoryAndStats = async () => {
    setIsLoadingHistory(true);
    try {
      // 1. Fetch recent notifications from Supabase
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (!error && data) {
        setHistory(data);
      } else {
        // Fallback to API
        const res = await fetch('/api/notifications?limit=15');
        const json = await res.json();
        if (res.ok && json.notifications) {
          setHistory(json.notifications);
        }
      }

      // 2. Query device tokens count
      const { count } = await supabase
        .from('device_tokens')
        .select('*', { count: 'exact', head: true });

      if (count !== null) {
        setTokensCount(count);
      }
    } catch (err) {
      console.warn('[NotificationAdmin] Fetch history warning:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistoryAndStats();
  }, []);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !body.trim()) {
      setResultMessage({
        type: 'error',
        text: 'يرجى كتابة عنوان التنبيه ونصه بالكامل قبل الإرسال.'
      });
      return;
    }

    if (!isFounder && !isCoFounder) {
      setResultMessage({
        type: 'error',
        text: 'عذراً، إرسال التنبيهات متاح حصرياً للمؤسس ومساعد المؤسس.'
      });
      return;
    }

    setIsSending(true);
    setResultMessage(null);

    try {
      // 1. Send via Vercel Serverless Function
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          metadata: {
            sentAt: new Date().toISOString()
          }
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResultMessage({
          type: 'success',
          text: data.message || 'تم إرسال التنبيه بنجاح لجميع المستخدمين والهواتف المسجلة.',
          stats: data.stats
        });
        setTitle('');
        setBody('');
        setSelectedTemplateIndex('');
        fetchHistoryAndStats();
      } else {
        // Fallback: If API had an issue, directly try inserting in Supabase for in-app realtime
        try {
          const { error: sbErr } = await supabase.from('notifications').insert({
            title: title.trim(),
            body: body.trim(),
            sender_role: isFounder ? 'FOUNDER' : 'CO_FOUNDER',
            sender_name: isFounder ? 'المؤسس' : 'مساعد المؤسس'
          });

          if (!sbErr) {
            setResultMessage({
              type: 'success',
              text: 'تم نشر التنبيه لحظياً في جرس التطبيق الداخلي لجميع المستخدمين المتصلين.'
            });
            setTitle('');
            setBody('');
            setSelectedTemplateIndex('');
            fetchHistoryAndStats();
            return;
          }
        } catch {}

        setResultMessage({
          type: 'error',
          text: data.message || 'فشل إرسال التنبيه، يرجى المحاولة مرة أخرى.'
        });
      }
    } catch (err: any) {
      console.error('[NotificationAdmin] Send error:', err);
      setResultMessage({
        type: 'error',
        text: err?.message || 'حدث خطأ في الاتصال بالخادم.'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-600/10 border border-amber-300/60 rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
                  إرسال التنبيهات الشاملة (Push & In-App)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                  <span>خاص بالمؤسسين</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                بث التنبيهات المباشرة لجميع المستخدمين فوراً عبر Supabase Realtime وإشعارات هواتف Firebase (FCM).
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <Smartphone className="w-4 h-4 text-orange-500" />
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block leading-tight">الأجهزة المسجلة:</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-100 tabular-nums">
                {tokensCount !== null ? `${tokensCount} جهاز` : 'جاري الحساب...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Compose Form (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-150 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
              <h3 className="font-black text-base text-slate-800 dark:text-slate-100">
                إنشاء تنبيه فوري جديد
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              يصل للجرس وللهواتف المقفلة
            </span>
          </div>

          {resultMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl mb-5 flex items-start gap-3 text-xs sm:text-sm font-bold border ${
                resultMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {resultMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <p>{resultMessage.text}</p>
                {resultMessage.stats && (
                  <div className="text-[11px] opacity-80 flex flex-wrap gap-3 pt-1">
                    <span>إجمالي الأجهزة: {resultMessage.stats.totalTokens}</span>
                    <span>تم تسليم FCM: {resultMessage.stats.pushSuccessCount}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSendNotification} className="space-y-4">
            {/* اختيار قالب جاهز */}
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                <span>اختر قالباً جاهزاً (اختياري)</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  قوالب إسلامية جاهزة
                </span>
              </label>
              <select
                value={selectedTemplateIndex}
                onChange={handleTemplateChange}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 font-bold text-sm text-slate-800 dark:text-slate-100 transition-all cursor-pointer"
              >
                <option value="">-- كتابة إشعار جديد --</option>
                {NOTIFICATION_TEMPLATES.map((tmpl, index) => (
                  <option key={index} value={index}>
                    {tmpl.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                عنوان التنبيه <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="مثال: تحدي سورة البقرة متاح الآن! 🌟"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 font-bold text-sm text-slate-800 dark:text-slate-100 transition-all"
                required
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                {title.length}/100 حرف
              </span>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                نص التنبيه <span className="text-red-500">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={350}
                placeholder="مثال: انضم إلى قاعة الانتظار وتنافس مع زملائك على صدارة المتصدرين..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 font-bold text-sm text-slate-800 dark:text-slate-100 transition-all leading-relaxed"
                required
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                {body.length}/350 حرف
              </span>
            </div>

            {/* Quick Templates */}
            <div className="pt-1">
              <span className="text-[10px] font-black text-slate-400 block mb-2">
                نماذج جاهزة سريعة:
              </span>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateIndex(String(idx));
                      setTitle(tmpl.title);
                      setBody(tmpl.body);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-colors cursor-pointer ${
                      selectedTemplateIndex === String(idx)
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 hover:text-amber-900 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSending || !title.trim() || !body.trim()}
                className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-black text-sm sm:text-base shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري إرسال وبث التنبيه...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 rotate-180" />
                    <span>إرسال التنبيه لجميع المشتركين 🚀</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Sent Notifications History (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="font-black text-base text-slate-800 dark:text-slate-100">
                سجل التنبيهات السابقة
              </h3>
            </div>
            <button
              type="button"
              onClick={fetchHistoryAndStats}
              disabled={isLoadingHistory}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="تحديث السجل"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="py-12 text-center text-slate-400 font-bold text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
              <span>جاري تحميل السجل...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 px-4">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">لم يتم إرسال أي تنبيهات بعد</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-amber-200 transition-all text-right space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 leading-snug">
                      {item.title}
                    </h4>
                    <span className="text-[9px] font-bold text-slate-400 shrink-0">
                      {new Date(item.created_at).toLocaleDateString('ar-SA', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {item.body}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      بواسطة: {item.sender_name || (item.sender_role === 'FOUNDER' ? 'المؤسس' : 'مساعد المؤسس')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {/* زر تعديل */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-300/60 dark:border-amber-700/60 rounded-xl flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                        title="تعديل هذا التنبيه"
                      >
                        <Pencil className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>تعديل</span>
                      </button>

                      {/* زر حذف */}
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="px-2.5 py-1 text-[11px] font-bold text-red-700 dark:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-300/60 dark:border-red-700/60 rounded-xl flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        title="حذف هذا التنبيه"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                        )}
                        <span>حذف</span>
                      </button>

                      {/* زر إعادة استخدام */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplateIndex('');
                          setTitle(item.title);
                          setBody(item.body);
                        }}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:underline px-1 cursor-pointer"
                        title="إعادة تعبئة حقول الإرسال"
                      >
                        إعادة استخدام
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Notification Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-right space-y-4 relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-800 dark:text-slate-100">
                      تعديل التنبيه وبث التحديث
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400">
                      سيتم تحديث النص فوراً لدى جميع المستخدمين المتصلين دون تحديث الصفحة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    عنوان التنبيه <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={100}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-amber-500 font-bold text-sm text-slate-800 dark:text-slate-100 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    نص التنبيه <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={4}
                    maxLength={350}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-amber-500 font-bold text-sm text-slate-800 dark:text-slate-100 transition-all leading-relaxed"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-150 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    disabled={isUpdating}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating || !editTitle.trim() || !editBody.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري حفظ التعديل...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>حفظ التعديلات والبث اللحظي</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationAdmin;

