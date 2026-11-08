import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, Plus, Edit2, Trash2, Search, Filter, FolderPlus,
  Sparkles, Users, BookOpen, Shield, ChevronDown, Check, X,
  AlertCircle, RefreshCw, Layers, CheckCircle2, MessageSquare, Info
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  count: number;
}

interface Question {
  id: string;
  category: string;
  hint_1: string;
  hint_2: string;
  answer: string;
  created_at: string;
}

interface WhoAmIAdminProps {
  onNotify?: (msg: string, type?: 'success' | 'error') => void;
}

export default function WhoAmIAdmin({ onNotify }: WhoAmIAdminProps) {
  // Tabs: 'questions' | 'categories'
  const [subTab, setSubTab] = useState<'questions' | 'categories'>('questions');

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<{ id?: string; name: string; description: string; icon: string }>({
    name: '',
    description: '',
    icon: 'HelpCircle'
  });

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionForm, setQuestionForm] = useState<{ id?: string; category: string; hint_1: string; hint_2: string; answer: string }>({
    category: '',
    hint_1: '',
    hint_2: '',
    answer: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'category' | 'question';
    id: string;
    title: string;
  } | null>(null);

  // Body scroll lock when any modal is open
  useEffect(() => {
    const isAnyModalOpen = isCategoryModalOpen || isQuestionModalOpen || Boolean(deleteConfirm?.isOpen);
    if (isAnyModalOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isCategoryModalOpen, isQuestionModalOpen, deleteConfirm?.isOpen]);

  // Load Categories
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/who-am-i?action=categories');
      const data = await res.json();
      if (data.categories) {
        setCategories(data.categories);
        if (!questionForm.category && data.categories.length > 0) {
          setQuestionForm(prev => ({ ...prev, category: data.categories[0].name }));
        }
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  // Load Questions
  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ action: 'questions' });
      if (selectedCategoryFilter !== 'ALL') {
        params.append('category', selectedCategoryFilter);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      const res = await fetch(`/api/who-am-i?${params.toString()}`);
      const data = await res.json();
      if (data.questions) {
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error('Failed to load questions', err);
      notify('فشل تحميل الأسئلة', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [selectedCategoryFilter, searchQuery]);

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (onNotify) {
      onNotify(msg, type);
    } else {
      alert(msg);
    }
  };

  // ---------------- Category Handlers ----------------
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      notify('يرجى إدخال اسم الفئة', 'error');
      return;
    }

    try {
      const isEditing = Boolean(categoryForm.id);
      const res = await fetch('/api/who-am-i', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEditing ? 'update-category' : 'add-category',
          id: categoryForm.id,
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
          icon: categoryForm.icon.trim() || 'HelpCircle'
        })
      });

      const data = await res.json();
      if (res.ok) {
        notify(isEditing ? 'تم تحديث الفئة بنجاح' : 'تمت إضافة الفئة بنجاح');
        setIsCategoryModalOpen(false);
        setCategoryForm({ name: '', description: '', icon: 'HelpCircle' });
        await fetchCategories();
      } else {
        notify(data.error || 'حدث خطأ أثناء حفظ الفئة', 'error');
      }
    } catch (err) {
      notify('فشل الاتصال بالخادم', 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await fetch('/api/who-am-i', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-category', id })
      });
      if (res.ok) {
        notify('تم حذف الفئة بنجاح');
        setDeleteConfirm(null);
        await fetchCategories();
        await fetchQuestions();
      } else {
        notify('فشل حذف الفئة', 'error');
      }
    } catch (err) {
      notify('فشل الاتصال بالخادم', 'error');
    }
  };

  // ---------------- Question Handlers ----------------
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionForm.hint_1.trim() || !questionForm.hint_2.trim() || !questionForm.answer.trim()) {
      notify('يرجى ملء جميع حقول السؤال (التلميحين والإجابة)', 'error');
      return;
    }

    const catName = questionForm.category || (categories[0]?.name ?? 'الصحابة');

    try {
      const isEditing = Boolean(questionForm.id);
      const res = await fetch('/api/who-am-i', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEditing ? 'update-question' : 'add-question',
          id: questionForm.id,
          category: catName,
          hint_1: questionForm.hint_1.trim(),
          hint_2: questionForm.hint_2.trim(),
          answer: questionForm.answer.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        notify(isEditing ? 'تم تحديث السؤال بنجاح' : 'تمت إضافة السؤال بنجاح');
        setIsQuestionModalOpen(false);
        setQuestionForm({
          category: categories[0]?.name || 'الصحابة',
          hint_1: '',
          hint_2: '',
          answer: ''
        });
        await fetchQuestions();
        await fetchCategories(); // refresh question counts
      } else {
        notify(data.error || 'حدث خطأ أثناء حفظ السؤال', 'error');
      }
    } catch (err) {
      notify('فشل الاتصال بالخادم', 'error');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      const res = await fetch('/api/who-am-i', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-question', id })
      });
      if (res.ok) {
        notify('تم حذف السؤال بنجاح');
        setDeleteConfirm(null);
        await fetchQuestions();
        await fetchCategories();
      } else {
        notify('فشل حذف السؤال', 'error');
      }
    } catch (err) {
      notify('فشل الاتصال بالخادم', 'error');
    }
  };

  const totalQuestionsCount = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.count || 0), 0);
  }, [categories]);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white p-6 md:p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <HelpCircle className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl md:text-2xl font-black">إدارة تحدي "من أنا؟"</h2>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200">
                  نظام التلميحات المتدرجة
                </span>
              </div>
              <p className="text-xs md:text-sm text-indigo-200/80 font-medium mt-1">
                التحكم الكامل بالفئات المتعددة، وبنك الأسئلة والتلميحات الذكية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
              <span className="text-[11px] text-indigo-200 block font-bold">إجمالي الأسئلة</span>
              <span className="text-xl font-black text-white">{totalQuestionsCount}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
              <span className="text-[11px] text-indigo-200 block font-bold">الفئات النشطة</span>
              <span className="text-xl font-black text-indigo-300">{categories.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 md:p-4 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSubTab('questions')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs md:text-sm transition-all cursor-pointer ${
              subTab === 'questions'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>بنك الأسئلة</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black">
              {questions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('categories')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs md:text-sm transition-all cursor-pointer ${
              subTab === 'categories'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>إدارة الفئات</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black">
              {categories.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {subTab === 'categories' ? (
            <button
              type="button"
              onClick={() => {
                setCategoryForm({ name: '', description: '', icon: 'HelpCircle' });
                setIsCategoryModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs md:text-sm shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>إضافة فئة جديدة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setQuestionForm({
                  category: selectedCategoryFilter !== 'ALL' ? selectedCategoryFilter : (categories[0]?.name || 'الصحابة'),
                  hint_1: '',
                  hint_2: '',
                  answer: ''
                });
                setIsQuestionModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs md:text-sm shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سؤال جديد</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              fetchCategories();
              fetchQuestions();
            }}
            title="تحديث البيانات"
            className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: QUESTIONS MANAGEMENT                              */}
      {/* ======================================================== */}
      {subTab === 'questions' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث في نص التلميحات أو الإجابة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm font-medium focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                <option value="ALL">جميع الفئات ({totalQuestionsCount})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.count || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Questions List */}
          {isLoading ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">جاري تحميل بنك الأسئلة...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-300">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-black text-slate-700">لا توجد أسئلة مطابقة</h3>
              <p className="text-slate-400 text-xs mt-1">
                {searchQuery ? 'جرّب البحث بكلمات أخرى أو اختر فئة مختلفة' : 'ابدأ بإضافة أول سؤال في هذا التصنيف'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-indigo-300 transition-all shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black">
                        {q.category}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                        <span>الإجابة:</span>
                        <span>{q.answer}</span>
                      </div>
                    </div>

                    {/* Hint 1 */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-700 mb-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        <span>التلميح الأول (الصعب - المرحلة الأولى 10 نقاط):</span>
                      </div>
                      <p className="text-xs md:text-sm text-slate-700 font-medium leading-relaxed">
                        {q.hint_1}
                      </p>
                    </div>

                    {/* Hint 2 */}
                    <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/80">
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-blue-700 mb-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        <span>التلميح الثاني (السهل - المرحلة الثانية 5 نقاط):</span>
                      </div>
                      <p className="text-xs md:text-sm text-slate-700 font-medium leading-relaxed">
                        {q.hint_2}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center md:flex-col gap-2 shrink-0 justify-end md:justify-start pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setQuestionForm({
                          id: q.id,
                          category: q.category,
                          hint_1: q.hint_1,
                          hint_2: q.hint_2,
                          answer: q.answer
                        });
                        setIsQuestionModalOpen(true);
                      }}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-all cursor-pointer"
                      title="تعديل السؤال"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirm({
                          isOpen: true,
                          type: 'question',
                          id: q.id,
                          title: `السؤال الخاص بـ: "${q.answer}"`
                        });
                      }}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-all cursor-pointer"
                      title="حذف السؤال"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CATEGORIES MANAGEMENT                            */}
      {/* ======================================================== */}
      {subTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-indigo-300 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryForm({
                          id: cat.id,
                          name: cat.name,
                          description: cat.description || '',
                          icon: cat.icon || 'HelpCircle'
                        });
                        setIsCategoryModalOpen(true);
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-all cursor-pointer"
                      title="تعديل الفئة"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirm({
                          isOpen: true,
                          type: 'category',
                          id: cat.id,
                          title: `الفئة: "${cat.name}"`
                        });
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-all cursor-pointer"
                      title="حذف الفئة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="text-base font-black text-slate-800">{cat.name}</h4>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  {cat.description || 'لا يوجد وصف مضاف لهذه الفئة'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">الأسئلة المتوفرة:</span>
                <span className="px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black">
                  {cat.count || 0} سؤال
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT CATEGORY                               */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-6 md:p-8 shadow-2xl border border-slate-100 text-right max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FolderPlus className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">
                    {categoryForm.id ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    اسم الفئة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الصحابة، الأنبياء، العلماء، الغزوات..."
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    الوصف (اختياري)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="وصف مختصر يوضح محتوى الأسئلة في هذه الفئة..."
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 transition-all resize-none"
                  />
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    {categoryForm.id ? 'حفظ التعديلات' : 'إضافة الفئة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT QUESTION                               */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isQuestionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 md:p-8 shadow-2xl border border-slate-100 text-right max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">
                    {questionForm.id ? 'تعديل السؤال' : 'إضافة سؤال جديد'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveQuestion} className="space-y-4">
                {/* Category Dropdown */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    الفئة <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={questionForm.category}
                    onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hint 1 */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    التلميح الأول (الصعب - المرحلة الأولى 10 نقاط) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="مثال: أسلم في السنة السادسة للبعثة بعد أن ضرب أبا جهل بقوسه، واستشهد في أحد..."
                    value={questionForm.hint_1}
                    onChange={(e) => setQuestionForm({ ...questionForm, hint_1: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 transition-all resize-none"
                  />
                </div>

                {/* Hint 2 */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    التلميح الثاني (السهل - المرحلة الثانية 5 نقاط) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="مثال: هو عم النبي ﷺ وأخوه في الرضاعة، ولقبه 'أسد الله'..."
                    value={questionForm.hint_2}
                    onChange={(e) => setQuestionForm({ ...questionForm, hint_2: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 transition-all resize-none"
                  />
                </div>

                {/* Answer */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    الإجابة الصحيحة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: حمزة بن عبد المطلب"
                    value={questionForm.answer}
                    onChange={(e) => setQuestionForm({ ...questionForm, answer: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                  <span className="text-[10px] text-slate-400 font-medium block mt-1">
                    * يقوم النظام تلقائياً بتطبيع الحروف العربية وإزالة التشكيل والأل التعريفية عند المقارنة.
                  </span>
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    {questionForm.id ? 'حفظ التعديلات' : 'إضافة السؤال'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQuestionModalOpen(false)}
                    className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* CONFIRM DELETE MODAL                                     */}
      {/* ======================================================== */}
      <AnimatePresence>
        {deleteConfirm?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-slate-100 text-center max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-800 mb-1">تأكيد عملية الحذف</h4>
              <p className="text-xs text-slate-500 font-medium mb-5">
                هل أنت متأكد من رغبتك في حذف {deleteConfirm.title}؟ لا يمكن التراجع عن هذا الإجراء.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (deleteConfirm.type === 'category') {
                      handleDeleteCategory(deleteConfirm.id);
                    } else {
                      handleDeleteQuestion(deleteConfirm.id);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md shadow-red-600/20 transition-all cursor-pointer"
                >
                  نعم، احذف
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

