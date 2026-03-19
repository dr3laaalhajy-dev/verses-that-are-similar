import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Save, X, BookOpen, 
  LayoutDashboard, Search, Sparkles, AlertCircle,
  Hash, List, ChevronDown, ChevronUp
} from 'lucide-react';
import { searchGroupedAyahsByStart, GroupedAyah } from '../../services/QuranRepository';

interface Verse {
  id: string;
  text: string;
  surah: string;
  number: string | number;
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
  const [verses, setVerses] = useState<Verse[]>([]);
  const [suggestions, setSuggestions] = useState<GroupedAyah[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  const handleFetchMatches = () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    try {
      const groupedMatches = searchGroupedAyahsByStart(keyword);
      setSuggestions(groupedMatches);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const addSuggestion = (s: GroupedAyah) => {
    // Check if already in list by text
    if (verses.some(v => v.text === s.text)) return;
    
    // Combine occurrences
    const surahNames = s.occurrences.map(o => o.surah).join('، ');
    const verseNumbers = s.occurrences.map(o => o.verseNumber).join('، ');
    
    setVerses([...verses, {
      id: s.occurrences[0].id, // Use first occurrence ID
      text: s.text,
      surah: surahNames,
      number: verseNumbers
    }]);
  };

  const removeVerse = (id: string) => {
    setVerses(verses.filter(v => v.id !== id));
  };

  const handleVerseChange = (index: number, field: keyof Verse, value: any) => {
    const updated = [...verses];
    updated[index] = { ...updated[index], [field]: value };
    setVerses(updated);
  };

  const addManualVerse = () => {
    setVerses([...verses, {
      id: `manual-${Date.now()}`,
      text: '',
      surah: '',
      number: ''
    }]);
  };

  const handleSave = async () => {
    if (!keyword.trim()) {
      alert('يرجى إدخال الكلمة المفتاحية');
      return;
    }
    if (verses.length === 0) {
      alert('يرجى إضافة آية واحدة على الأقل');
      return;
    }

    // التحقق من صحة البيانات
    const invalidVerses = verses.filter(v => !v.text.trim() || !v.surah.trim());
    if (invalidVerses.length > 0) {
      alert('يرجى التأكد من ملء نص الآية واسم السورة لجميع الآيات المضافة');
      return;
    }

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/challenges/${editingId}` : '/api/challenges';

    console.log(`Saving challenge: ${method} ${url}`, { keyword, versesCount: verses.length });

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ keyword, verses }),
      });

      const responseData = await res.json().catch(() => ({}));
      console.log('Save response status:', res.status, responseData);

      if (!res.ok) {
        throw new Error(responseData.message || `فشل الحفظ (كود الخطأ: ${res.status})`);
      }

      alert('تم حفظ التحدي بنجاح!');
      fetchChallenges();
      resetForm();
    } catch (err: any) {
      console.error('Save error detail:', err);
      alert(err.message || 'حدث خطأ غير متوقع أثناء الحفظ');
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
    setVerses([]);
    setSuggestions([]);
  };

  const startEdit = (c: Challenge) => {
    setEditingId(c.id);
    setKeyword(c.keyword);
    // Ensure verses is an array (backwards compat)
    setVerses(Array.isArray(c.verses) ? c.verses : []);
    setIsAdding(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      {/* Sidebar/Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-8 py-4 flex items-center justify-between shadow-sm">
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
              className="bg-white rounded-[3rem] shadow-2xl border border-slate-200 mb-10 overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <Edit2 className="w-5 h-5 text-brand-emerald" />
                  {editingId ? 'تعديل التحدي' : 'إضافة تحدي جديد'}
                </h3>
                <button onClick={resetForm} className="p-2 hover:bg-slate-200 rounded-full transition-all"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <div className="p-8 space-y-10">
                {/* Keyword & Search Suggestions */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-4">
                    <div className="relative">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">الكلمة المفتاحية (بداية الآيات)</label>
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="مثل: يا أيها الذين آمنوا"
                        className="w-full px-6 py-4 rounded-2xl bg-slate-100/50 border-2 border-transparent focus:border-brand-emerald focus:bg-white outline-none font-bold text-lg transition-all"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={handleFetchMatches}
                        disabled={!keyword.trim() || isSearching}
                        className="h-[60px] px-8 bg-brand-gold text-brand-emerald rounded-2xl font-black shadow-lg hover:shadow-brand-gold/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 flex items-center gap-3"
                      >
                        {isSearching ? <div className="w-4 h-4 border-2 border-brand-emerald border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        بحث عن تطابقات
                      </button>
                    </div>
                  </div>

                  {/* Suggestions List */}
                  {suggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-brand-emerald/5 border border-brand-emerald/10 rounded-2xl p-6"
                    >
                      <h4 className="text-sm font-black text-brand-emerald mb-4 flex items-center gap-2">
                        <List className="w-4 h-4" />
                        اقتراحات من المصحف الشريف ({suggestions.length})
                      </h4>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => addSuggestion(s)}
                            disabled={verses.some(v => v.text === s.text)}
                            className="px-4 py-2 bg-white border border-brand-emerald/20 text-slate-700 rounded-xl text-xs font-bold hover:bg-brand-emerald hover:text-white transition-all disabled:opacity-40 quran-text text-right"
                          >
                            <div className="font-bold mb-1 truncate max-w-[200px]">{s.text}</div>
                            <div className="text-[10px] opacity-60">
                              {s.occurrences.map(o => `${o.surah} (${o.verseNumber})`).join('، ')}
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Verses List */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      الآيات المضافة ({verses.length})
                    </h4>
                    <button 
                      onClick={addManualVerse}
                      className="text-xs font-black text-brand-emerald hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      إضافة آية يدوياً
                    </button>
                  </div>

                  <div className="space-y-4">
                    <AnimatePresence>
                      {verses.map((v, idx) => (
                        <motion.div
                          key={v.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group relative"
                        >
                          <button 
                            onClick={() => removeVerse(v.id)}
                            className="absolute -top-2 -left-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="grid grid-cols-1 lg:grid-cols-[1fr,200px,100px] gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2">نص الآية</label>
                                <textarea
                                  value={v.text}
                                  onChange={(e) => handleVerseChange(idx, 'text', e.target.value)}
                                  className="w-full h-24 px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-brand-emerald transition-all quran-text text-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2">اسم السورة</label>
                                <input
                                  type="text"
                                  value={v.surah}
                                  onChange={(e) => handleVerseChange(idx, 'surah', e.target.value)}
                                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-brand-emerald transition-all font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2">الرقم</label>
                                <input
                                  type="number"
                                  value={v.number}
                                  onChange={(e) => handleVerseChange(idx, 'number', parseInt(e.target.value) || 0)}
                                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-brand-emerald transition-all font-black tabular-nums"
                                />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    {verses.length === 0 && (
                      <div className="py-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                        <AlertCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 font-bold">لم يتم إضافة أي آيات بعد</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                <button onClick={resetForm} className="px-8 py-3 text-slate-500 font-black hover:text-slate-700 transition-all">إلغاء التعديلات</button>
                <button 
                  onClick={handleSave} 
                  className="flex items-center gap-3 px-12 py-4 bg-brand-emerald text-white rounded-2xl font-black shadow-2xl shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95"
                >
                  <Save className="w-5 h-5" />
                  حفظ التحدي بالكامل
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
