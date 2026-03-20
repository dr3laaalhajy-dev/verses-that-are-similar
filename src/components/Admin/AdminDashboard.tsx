import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Save, X, BookOpen,
  LayoutDashboard, Search, Sparkles, AlertCircle,
  Hash, List, ChevronDown, ChevronUp, Users, Shield, UserPlus, Key, Loader2, Home
} from 'lucide-react';
import { searchGroupedAyahsByStart, GroupedAyah } from '../../services/QuranRepository';
import ConfirmModal from '../ConfirmModal';

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

interface Admin {
  id: number;
  username: string;
  isSuperAdmin: boolean;
}

interface AdminDashboardProps {
  token: string;
  isSuperAdmin: boolean;
  onLogout: () => void;
  onBackHome: () => void;
}

export default function AdminDashboard({ token, isSuperAdmin, onLogout, onBackHome }: AdminDashboardProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'challenges' | 'admins'>('challenges');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [isSavingChallenge, setIsSavingChallenge] = useState(false);
  const [isDeletingChallenge, setIsDeletingChallenge] = useState(null as number | null);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(null as number | null);

  // Admin form states
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminIsSuper, setNewAdminIsSuper] = useState(false);
  
  // Custom Modal States
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    isAlert: false,
    onConfirm: () => {}
  });

  const showAlert = (title: string, message: string) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isAlert: true,
      onConfirm: () => {}
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isAlert: false,
      onConfirm
    });
  };

  // Form states
  const [keyword, setKeyword] = useState('');
  const [verses, setVerses] = useState<Verse[]>([]);
  const [suggestions, setSuggestions] = useState<GroupedAyah[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchChallenges();
    fetchAdmins();
    if (isSuperAdmin) fetchInviteCodes();
  }, [isSuperAdmin]);

  const fetchInviteCodes = async () => {
    setInviteLoading(true);
    try {
      const res = await fetch('/api/admin?action=invite', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInviteCodes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInviteLoading(false);
    }
  };

  const generateInviteCode = async (role: 'ADMIN' | 'SUPERADMIN' = 'ADMIN') => {
    if (inviteLoading) return;
    setInviteLoading(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ action: 'invite', role })
      });
      if (res.ok) fetchInviteCodes();
    } catch (err) {
      console.error(err);
    } finally {
      setInviteLoading(false);
    }
  };

  const deleteInviteCode = async (id: number) => {
    showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف كود الدعوة هذا؟', async () => {
      setInviteLoading(true);
      try {
        const res = await fetch(`/api/admin?action=invite&id=${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) fetchInviteCodes();
      } catch (err) {
        console.error(err);
      } finally {
        setInviteLoading(false);
      }
    });
  };

  const fetchAdmins = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin?action=manage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch admins');
      const data = await res.json();
      setAdmins(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setAdminLoading(false);
    }
  };

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
      showAlert('خطأ', err.message || 'حدث خطأ أثناء تحميل البيانات');
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
      showAlert('تنبيه', 'يرجى إدخال الكلمة المفتاحية');
      return;
    }
    if (verses.length === 0) {
      showAlert('تنبيه', 'يرجى إضافة آية واحدة على الأقل');
      return;
    }

    const invalidVerses = verses.filter(v => !v.text.trim() || !v.surah.trim());
    if (invalidVerses.length > 0) {
      showAlert('تنبيه', 'يرجى التأكد من ملء نص الآية واسم السورة لجميع الآيات المضافة');
      return;
    }

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/challenges/${editingId}` : '/api/challenges';

    setIsSavingChallenge(true);
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
      if (!res.ok) {
        throw new Error(responseData.message || `فشل الحفظ (كود الخطأ: ${res.status})`);
      }

      showAlert('نجاح', 'تم حفظ التحدي بنجاح!');
      fetchChallenges();
      resetForm();
    } catch (err: any) {
      console.error('Save error detail:', err);
      showAlert('خطأ', err.message || 'حدث خطأ غير متوقع أثناء الحفظ');
    } finally {
      setIsSavingChallenge(false);
    }
  };

  const handleDelete = async (id: number) => {
    showConfirm('تأكيد الحذف', 'هل أنت متأكد من الحذف؟', async () => {
      setIsDeletingChallenge(id);
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
        showAlert('خطأ', err.message || 'حدث خطأ أثناء الحذف');
      } finally {
        setIsDeletingChallenge(null);
      }
    });
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) {
      showAlert('تنبيه', 'يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsAddingAdmin(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          action: 'manage',
          username: newAdminUsername, 
          password: newAdminPassword,
          isSuperAdmin: newAdminIsSuper
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'فشل إضافة المشرف');
      }

      showAlert('نجاح', 'تم إضافة المشرف بنجاح!');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setNewAdminIsSuper(false);
      fetchAdmins();
    } catch (err: any) {
      showAlert('خطأ', err.message);
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id: number) => {
    showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذا المشرف؟', async () => {
      setIsDeletingAdmin(id);
      try {
        const res = await fetch(`/api/admin?action=manage&id=${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('فشل حذف المشرف');
        fetchAdmins();
      } catch (err: any) {
        showAlert('خطأ', err.message);
      } finally {
        setIsDeletingAdmin(null);
      }
    });
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
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50 px-4 md:px-8 py-3 md:py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="bg-brand-emerald p-2 rounded-2xl shadow-lg shadow-brand-emerald/20 flex-shrink-0">
                <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-black text-slate-800 truncate leading-tight">إدارة المتشابهات</h1>
                <p className="text-[9px] md:text-[10px] uppercase font-black text-slate-400 tracking-widest truncate">لوحة التحكم المركزية</p>
              </div>
            </div>
            
            <button 
              onClick={onLogout} 
              className="md:hidden flex items-center justify-center w-10 h-10 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-90"
              title="خروج"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 w-full md:w-auto">
            <div className="flex bg-slate-100/80 p-1 rounded-2xl w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('challenges')}
                className={`flex-1 sm:flex-none px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-black transition-all ${activeTab === 'challenges' ? 'bg-white text-brand-emerald shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <List className="w-4 h-4" />
                  <span>التحديات</span>
                </div>
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => setActiveTab('admins')}
                  className={`flex-1 sm:flex-none px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-black transition-all ${activeTab === 'admins' ? 'bg-white text-brand-emerald shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>المشرفين</span>
                  </div>
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsAdding(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-emerald text-white rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-brand-emerald/10 hover:bg-brand-emerald/90 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة تحدي</span>
              </button>
              
              <button 
                onClick={onLogout} 
                className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-slate-50 text-slate-500 rounded-2xl font-black text-sm border border-slate-100 hover:bg-slate-100 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
                خروج
              </button>

              <button 
                onClick={onBackHome} 
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-emerald rounded-2xl font-black text-sm shadow-xl shadow-brand-gold/10 hover:bg-brand-gold/90 transition-all active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>الرئيسية</span>
              </button>
            </div>
          </div>
        </div>
      </header>


      <main className="max-w-6xl mx-auto p-8">
        {activeTab === 'challenges' ? (
          <>
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
                    <button onClick={resetForm} disabled={isSavingChallenge} className="px-8 py-3 text-slate-500 font-black hover:text-slate-700 transition-all disabled:opacity-30">إلغاء التعديلات</button>
                    <button 
                      onClick={handleSave} 
                      disabled={isSavingChallenge}
                      className="flex items-center gap-3 px-12 py-4 bg-brand-emerald text-white rounded-2xl font-black shadow-2xl shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSavingChallenge ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      حفظ التحدي بالكامل
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {loading ? (
                <div className="col-span-full py-20 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-emerald/20 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">جاري تحميل البيانات...</p>
                </div>
              ) : challenges.map(c => (
                <motion.div
                  key={c.id}
                  layout
                  whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                  className="bg-white p-5 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-brand-emerald/20 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-emerald/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-brand-emerald/10 transition-colors" />
                  
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex flex-col gap-1">
                      <div className="bg-slate-50 px-3 py-1 rounded-lg text-slate-400 text-[10px] font-black border border-slate-100">ID: {c.id}</div>
                      <div className="flex items-center gap-1.5 text-brand-emerald font-black text-[10px] uppercase tracking-wider">
                        <List className="w-3 h-3" />
                        <span>{c.verses.length} آيات</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => startEdit(c)} 
                        disabled={isDeletingChallenge !== null} 
                        className="p-2.5 text-slate-400 hover:text-brand-emerald hover:bg-brand-emerald/5 rounded-xl transition-all disabled:opacity-30 active:scale-90"
                        title="تعديل"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(c.id)} 
                        disabled={isDeletingChallenge !== null}
                        className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 active:scale-90"
                        title="حذف"
                      >
                        {isDeletingChallenge === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="text-lg md:text-xl font-black text-slate-800 mb-2 quran-text leading-relaxed relative z-10 min-h-[3rem] line-clamp-2">
                    {c.keyword}
                  </h3>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 relative z-10">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">تحدي المتشابهات</span>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-brand-emerald group-hover:text-white transition-all">
                      <ChevronDown className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

          </>
        ) : (
          <div className="space-y-10">
            {/* Add Admin Form */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200 max-w-2xl mx-auto"
            >
              <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <UserPlus className="w-6 h-6 text-brand-emerald" />
                إضافة مشرف جديد
              </h3>
              <form onSubmit={handleAddAdmin} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mr-2">اسم المستخدم</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="text"
                        value={newAdminUsername}
                        onChange={(e) => setNewAdminUsername(e.target.value)}
                        className="w-full px-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-emerald transition-all font-bold"
                        placeholder="admin_new"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mr-2">كلمة المرور</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        className="w-full px-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-emerald transition-all font-bold"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={newAdminIsSuper}
                    onChange={(e) => setNewAdminIsSuper(e.target.checked)}
                    className="w-5 h-5 accent-brand-emerald rounded-lg"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-700">منح صلاحيات مشرف رئيسي (Superadmin)</span>
                    <span className="text-[10px] text-slate-500 font-bold">سيتمكن هذا الحساب من إضافة وحذف المشرفين الآخرين</span>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={isAddingAdmin || !newAdminUsername || !newAdminPassword}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isAddingAdmin ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : 'تأكيد الإضافة'}
                </button>
              </form>
            </motion.div>

            {/* Admins List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminLoading ? (
                <div className="col-span-full py-10 text-center text-slate-400 font-bold">جاري تحميل المشرفين...</div>
              ) : admins.map(admin => (
                <motion.div
                  key={admin.id}
                  layout
                  className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-brand-emerald" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{admin.username}</div>
                      <div className="text-[10px] font-black text-brand-emerald opacity-60">
                        {admin.isSuperAdmin ? 'SUPERADMIN ROLE' : 'ADMIN ROLE'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAdmin(admin.id)}
                    disabled={isDeletingAdmin !== null}
                    className="p-3 text-slate-300 hover:text-red-500 transition-colors bg-slate-50 rounded-xl disabled:opacity-30"
                  >
                    {isDeletingAdmin === admin.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Invite Codes Section */}
            {isSuperAdmin && (
              <div className="mt-20 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <Key className="w-6 h-6 text-brand-emerald" />
                    أكواد الدعوة (Invitation Codes)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => generateInviteCode('ADMIN')}
                      disabled={inviteLoading}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      كود مشرف عادي
                    </button>
                    <button
                      onClick={() => generateInviteCode('SUPERADMIN')}
                      disabled={inviteLoading}
                      className="flex items-center gap-2 px-6 py-2.5 bg-brand-emerald text-white rounded-2xl font-black text-sm shadow-xl shadow-brand-emerald/10 hover:bg-brand-emerald/90 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      كود مشرف رئيسي
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-8 py-4">الكود</th>
                        <th className="px-8 py-4">الصلاحية</th>
                        <th className="px-8 py-4 text-center">الحالة</th>
                        <th className="px-8 py-4">تاريخ الإنشاء</th>
                        <th className="px-8 py-4">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {inviteCodes.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-bold italic">لا توجد أكواد مولدة بعد</td>
                        </tr>
                      ) : inviteCodes.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5 border-l border-slate-50/50">
                            <span className="font-mono font-black text-brand-emerald bg-brand-emerald/5 px-4 py-1.5 rounded-xl border border-brand-emerald/10 select-all">
                              {c.code}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${c.role === 'SUPERADMIN' ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-slate-100 text-slate-500'}`}>
                              {c.role === 'SUPERADMIN' ? 'SUPERADMIN' : 'ADMIN'}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex justify-center">
                              {c.isUsed ? (
                                <span className="px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black rounded-full uppercase">تم استخدامه</span>
                              ) : (
                                <span className="px-3 py-1 bg-green-100 text-green-600 text-[10px] font-black rounded-full uppercase">متاح</span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-sm text-slate-500 font-medium">
                            {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="px-8 py-5">
                            <button
                              onClick={() => deleteInviteCode(c.id)}
                              disabled={inviteLoading}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30"
                            >
                              {inviteLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        isAlert={modalConfig.isAlert}
      />
    </div>
  );
}
