import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, Loader2, Key, CheckCircle, ArrowRight, Home } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (token: string, isSuperAdmin?: boolean) => void;
  onBack: () => void;
}

export default function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
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

    if (isRegistering) {
      handleRegister();
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'بيانات الدخول غير صحيحة');

      onLogin(data.token, data.isSuperAdmin);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', username, password, code: inviteCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل التسجيل');

      setSuccess(data.message);
      setIsRegistering(false);
      setInviteCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 relative">
      <motion.button
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-8 right-8 flex items-center gap-2 px-5 py-2.5 bg-white text-slate-500 rounded-2xl font-black text-sm border border-slate-100 shadow-sm hover:bg-slate-100 transition-all active:scale-95 group"
      >
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        <span>العودة للرئيسية</span>
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-md w-full"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-brand-emerald/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-brand-emerald" />
          </div>
          <h2 className="text-3xl font-black text-slate-800">
            {isRegistering ? 'تسجيل مشرف جديد' : 'لوحة التحكم'}
          </h2>
          <p className="text-slate-500 font-medium">
            {isRegistering ? 'أدخل كود الدعوة لإتمام التسجيل' : 'تسجيل الدخول للمسؤول فقط'}
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 mr-2">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute right-5 top-5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-6 pr-14 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-brand-emerald focus:bg-white transition-all outline-none font-bold"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 mr-2">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-5 top-5 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-6 pr-14 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-brand-emerald focus:bg-white transition-all outline-none font-bold"
                required
              />
            </div>
          </div>

          {isRegistering && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 mr-2">كود الدعوة</label>
              <div className="relative">
                <Key className="absolute right-5 top-5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="EX: 4A2B-7C9D"
                  className="w-full pl-6 pr-14 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-brand-emerald focus:bg-white transition-all outline-none font-bold uppercase"
                  required={isRegistering}
                />
              </div>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-brand-emerald text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (isRegistering ? 'تسجيل الآن' : 'دخول')}
          </button>

          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
                setSuccess('');
              }}
              className="text-sm font-black text-slate-400 hover:text-brand-emerald transition-colors"
            >
              {isRegistering ? 'لديك حساب؟ سجل دخول' : 'ليس لديك حساب؟ اطلب كود دعوة'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
