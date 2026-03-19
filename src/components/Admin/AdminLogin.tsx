import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, Loader2 } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (token: string) => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const responseText = await res.text();
      console.log('API Status:', res.status);
      console.log('API Response:', responseText);

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse JSON response:', responseText);
        throw new Error(`فشل في معالجة رد الخادم (Status: ${res.status}). راجع الـ console للمزيد.`);
      }

      if (!res.ok) throw new Error(data.message || `خطأ ${res.status}: بيانات الدخول غير صحيحة`);

      onLogin(data.token);
    } catch (err: any) {
      console.error('Login Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-md w-full"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-brand-emerald/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-brand-emerald" />
          </div>
          <h2 className="text-3xl font-black text-slate-800">لوحة التحكم</h2>
          <p className="text-slate-500 font-medium">تسجيل الدخول للمسؤول فقط</p>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-brand-emerald text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'دخول'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
