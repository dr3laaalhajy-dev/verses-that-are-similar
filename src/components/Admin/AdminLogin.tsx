import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, Loader2, Key, ArrowRight, ShieldCheck, AtSign } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (token: string, isSuperAdmin?: boolean, role?: string, username?: string, adminId?: number, name?: string, canManageUsers?: boolean) => void;
  onBack: () => void;
}

export default function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Ensure @ is stripped when sending so backend receives clean handle
    const cleanUsername = username.replace(/@/g, '').trim();

    if (isRegistering) {
      if (!name.trim()) {
        setError('يرجى إدخال الاسم');
        setLoading(false);
        return;
      }
      if (!cleanUsername) {
        setError('يرجى إدخال اسم المستخدم');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'register', 
            name: name.trim(), 
            username: cleanUsername, 
            password, 
            code: inviteCode.trim() 
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل التسجيل');

        setSuccess('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
        setIsRegistering(false);
        setInviteCode('');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'login', 
          username: cleanUsername, 
          password 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'بيانات الدخول غير صحيحة');

      onLogin(data.token, data.isSuperAdmin, data.role, data.username, data.adminId, data.name, data.canManageUsers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 md:p-6 relative font-sans" dir="rtl">
      <motion.button
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-6 right-6 md:top-8 md:right-8 flex items-center gap-2 px-5 py-2.5 bg-white text-slate-500 rounded-2xl font-black text-sm border border-slate-100 shadow-sm hover:bg-slate-100 transition-all active:scale-95 group"
      >
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        <span>العودة للرئيسية</span>
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-md w-full"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-emerald/10 rounded-3xl flex items-center justify-center mx-auto mb-5 text-brand-emerald shadow-sm">
            {isRegistering ? <ShieldCheck className="w-8 h-8 md:w-10 md:h-10" /> : <Lock className="w-8 h-8 md:w-10 md:h-10" />}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800">
            {isRegistering ? 'تسجيل مشرف جديد' : 'لوحة التحكم'}
          </h2>
          <p className="text-slate-500 font-medium text-xs md:text-sm mt-1">
            {isRegistering ? 'أدخل بياناتك وكود الدعوة لإتمام إنشاء الحساب' : 'تسجيل الدخول للمسؤولين فقط'}
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs md:text-sm font-bold border border-red-100 text-center"
          >
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-xs md:text-sm font-bold border border-emerald-100 text-center"
          >
            {success}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* حقل الاسم (يظهر عند وقت ليس لدي حساب / التسجيل) */}
          <AnimatePresence>
            {isRegistering && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 overflow-hidden"
              >
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-brand-emerald" />
                  <span>الاسم</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-brand-emerald focus:bg-white transition-all outline-none font-bold text-sm text-slate-800"
                    required={isRegistering}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* حقل اسم المستخدم (مع @ مكتوبة تلقائياً وثابتة في البداية) */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-brand-emerald" />
                <span>اسم المستخدم</span>
              </span>
              <span className="text-[10px] text-brand-emerald font-bold bg-brand-emerald/10 px-2 py-0.5 rounded-md">
                تبدأ بـ @ تلقائياً
              </span>
            </label>
            <div className="relative flex items-center bg-slate-50 border-2 border-slate-100 focus-within:border-brand-emerald focus-within:bg-white rounded-2xl transition-all overflow-hidden">
              {/* @ مكتوبة لحالها تلقائياً بدون حاجة لكتابتها */}
              <span className="pr-4 pl-1 text-brand-emerald font-black text-xl select-none shrink-0">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  // إزالة أي رمز @ إذا كتبه المستخدم لمنع التكرار
                  const cleaned = e.target.value.replace(/@/g, '').trim();
                  setUsername(cleaned);
                }}
                placeholder="username"
                className="w-full py-3.5 pr-1 pl-4 bg-transparent outline-none font-bold text-sm text-slate-800 text-right"
                required
              />
            </div>
          </div>

          {/* حقل كلمة المرور */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>كلمة المرور</span>
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-brand-emerald focus:bg-white transition-all outline-none font-bold text-sm text-slate-800"
                required
              />
            </div>
          </div>

          {/* حقل كود الدعوة (خاص بالتسجيل) */}
          <AnimatePresence>
            {isRegistering && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 overflow-hidden"
              >
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>كود الدعوة</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="مثال: 4A2B-7C9D"
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-brand-emerald focus:bg-white transition-all outline-none font-mono font-black text-sm uppercase text-slate-800"
                    required={isRegistering}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 bg-brand-emerald text-white rounded-2xl font-black text-base shadow-xl shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isRegistering ? 'تسجيل الآن' : 'دخول')}
          </button>

          {/* زر التبديل بين تسجيل الدخول وليس لدي حساب */}
          <div className="pt-3 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
                setSuccess('');
              }}
              className="text-xs md:text-sm font-black text-slate-500 hover:text-brand-emerald transition-colors"
            >
              {isRegistering ? 'لديك حساب بالفعل؟ سجل دخول' : 'ليس لديك حساب؟ تسجيل جديد بكود دعوة'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
