import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit2, Trash2, Save, X, BookOpen, LayoutDashboard } from 'lucide-react';

interface Verse {
  id: string;
  text: string;
  surah: string;
  number: number;
}

interface Challenge {
  id: number;
  keyword: string;
  verses: Verse[];
}

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
}

export default function AdminDashboard({ token, onLogout }: AdminDashboardProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [keyword, setKeyword] = useState('');
  const [versesJson, setVersesJson] = useState('[]');

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch challenges: ${text.substring(0, 100)}`);
      }
      const data = await res.json();
      setChallenges(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const verses = JSON.parse(versesJson);
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/challenges/${editingId}` : '/api/challenges';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ keyword, verses }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed: ${text.substring(0, 100)}`);
      }

      fetchChallenges();
      resetForm();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;

    try {
      const res = await fetch(`/api/challenges/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Delete failed: ${text.substring(0, 100)}`);
      }

      fetchChallenges();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setKeyword('');
    setVersesJson('[]');
  };

  const startEdit = (c: Challenge) => {
    setEditingId(c.id);
    setKeyword(c.keyword);
    setVersesJson(JSON.stringify(c.verses, null, 2));
    setIsAdding(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      {/* Sidebar/Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-brand-emerald p-2.5 rounded-2xl shadow-lg shadow-brand-emerald/20">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">إدارة المتشابهات</h1>
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">لوحة التحكم المركزية</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-emerald text-white rounded-2xl font-black text-sm shadow-xl shadow-brand-emerald/10 hover:bg-brand-emerald/90 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            إضافة تحدي
          </button>
          <button onClick={onLogout} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">خروج</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 mb-10 overflow-hidden"
            >
              <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <Edit2 className="w-5 h-5 text-brand-emerald" />
                {editingId ? 'تعديل التحدي' : 'إضافة تحدي جديد'}
              </h3>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 mr-2">الكلمة المفتاحية (Keyword)</label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-brand-emerald outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 mr-2">بيانات الآيات (JSON)</label>
                  <textarea
                    value={versesJson}
                    onChange={(e) => setVersesJson(e.target.value)}
                    dir="ltr"
                    className="w-full h-48 px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-brand-emerald outline-none font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button onClick={resetForm} className="px-6 py-2.5 text-slate-500 font-bold">إلغاء</button>
                <button onClick={handleSave} className="flex items-center gap-2 px-8 py-3 bg-brand-emerald text-white rounded-2xl font-black shadow-lg hover:bg-brand-emerald/90 transition-all">
                  <Save className="w-4 h-4" />
                  حفظ البيانات
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-bold">جاري تحميل البيانات...</div>
          ) : challenges.map(c => (
            <motion.div
              key={c.id}
              layout
              className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-brand-emerald/5 px-4 py-1.5 rounded-full text-brand-emerald text-xs font-black">ID: {c.id}</div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(c)} className="p-2 text-slate-400 hover:text-brand-emerald transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2 quran-text">{c.keyword}</h3>
              <p className="text-xs text-slate-400 font-bold">{c.verses.length} آيات موجودة</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
