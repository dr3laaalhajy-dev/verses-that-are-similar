import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Check, ShoppingBag, Palette, Award, Shield, AlertCircle, CheckCircle } from 'lucide-react';

export interface CosmeticItemDef {
  id: string;
  title: string;
  description: string;
  type: 'border' | 'nameColor' | 'title';
  currency: 'points' | 'streak';
  price: number;
  value: string; // CSS color, frame asset, or title text
}

export const COSMETIC_ITEMS: CosmeticItemDef[] = [
  // 1. ألوان الأسماء (Name Colors)
  {
    id: 'color_gold',
    title: 'الذهب الملكي',
    description: 'يمنح اسمك لوناً ذهبياً متألقاً في لوحة المتصدرين والغرف',
    type: 'nameColor',
    currency: 'points',
    price: 150,
    value: '#EAB308'
  },
  {
    id: 'color_emerald',
    title: 'الزمرد الأخضر',
    description: 'لون أخضر إسلامي مميز مستوحى من واحة الحفاظ',
    type: 'nameColor',
    currency: 'points',
    price: 120,
    value: '#10B981'
  },
  {
    id: 'color_ruby',
    title: 'الياقوت القرمزي',
    description: 'لون أحمر ناري يبرز حماسك وشغفك بالتحدي',
    type: 'nameColor',
    currency: 'streak',
    price: 7,
    value: '#EF4444'
  },
  {
    id: 'color_sky',
    title: 'الأزرق السماوي',
    description: 'لون هادئ ووقور يعكس سكينة القرآن الكريم',
    type: 'nameColor',
    currency: 'points',
    price: 100,
    value: '#0284C7'
  },
  {
    id: 'color_purple',
    title: 'البنفسجي الإمبراطوري',
    description: 'لون الملوك والأوائل الذين تصدروا القمم',
    type: 'nameColor',
    currency: 'streak',
    price: 10,
    value: '#9333EA'
  },

  // 2. ألقاب الشرف (Honor Titles)
  {
    id: 'title_aqidah_champion',
    title: 'بطل العقيدة',
    description: 'لقب فخري لحماة التوحيد وأصحاب البصيرة',
    type: 'title',
    currency: 'points',
    price: 200,
    value: 'بطل العقيدة'
  },
  {
    id: 'title_quran_ambassador',
    title: 'سفير القرآن',
    description: 'لقب تكريمي لحاملي كتاب الله في قلوبهم وأعمالهم',
    type: 'title',
    currency: 'streak',
    price: 14,
    value: 'سفير القرآن'
  },
  {
    id: 'title_motashabehat_knight',
    title: 'فارس المتشابهات',
    description: 'لقب المتمرسين في ضبط وتفريق آيات القرآن المتشابهة',
    type: 'title',
    currency: 'points',
    price: 250,
    value: 'فارس المتشابهات'
  },
  {
    id: 'title_hafiz',
    title: 'حافظ متقن',
    description: 'وسام العزيمة والإتقان الراسخ في الحفظ والتثبيت',
    type: 'title',
    currency: 'points',
    price: 180,
    value: 'حافظ متقن'
  },
  {
    id: 'title_flame_master',
    title: 'شعلة الهمة',
    description: 'دليل على الالتزام اليومي المستمر دون انقطاع',
    type: 'title',
    currency: 'streak',
    price: 20,
    value: 'شعلة الهمة'
  },

  // 3. إطارات الصور (Borders)
  {
    id: 'border_seerah',
    title: 'إطار السيرة النبوية الذهبي',
    description: 'إطار أندلسي ذهبي فاخر يحيط بصورتك الشخصية',
    type: 'border',
    currency: 'points',
    price: 300,
    value: 'seerah'
  },
  {
    id: 'border_general',
    title: 'إطار الثقافة الإسلامية الملكي',
    description: 'إطار مزخرف بنقوش إسلامية راقية وألوان براقة',
    type: 'border',
    currency: 'points',
    price: 300,
    value: 'general'
  },
  {
    id: 'border_emerald_glow',
    title: 'إطار الزمرد المشع',
    description: 'هالة خضراء متوهجة ونبضات ضوئية حول الصورة',
    type: 'border',
    currency: 'streak',
    price: 15,
    value: 'emerald'
  }
];

interface CosmeticStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalPoints: number;
  setTotalPoints: React.Dispatch<React.SetStateAction<number>>;
  streakCount: number;
  setStreakCount: React.Dispatch<React.SetStateAction<number>>;
  ownedCosmetics: string[];
  setOwnedCosmetics: React.Dispatch<React.SetStateAction<string[]>>;
  equippedBorder: string | null;
  setEquippedBorder: React.Dispatch<React.SetStateAction<string | null>>;
  equippedNameColor: string | null;
  setEquippedNameColor: React.Dispatch<React.SetStateAction<string | null>>;
  equippedTitle: string | null;
  setEquippedTitle: React.Dispatch<React.SetStateAction<string | null>>;
  onSaveToServer?: () => void;
}

export const CosmeticStoreModal: React.FC<CosmeticStoreModalProps> = ({
  isOpen,
  onClose,
  totalPoints,
  setTotalPoints,
  streakCount,
  setStreakCount,
  ownedCosmetics,
  setOwnedCosmetics,
  equippedBorder,
  setEquippedBorder,
  equippedNameColor,
  setEquippedNameColor,
  equippedTitle,
  setEquippedTitle,
  onSaveToServer
}) => {
  const [activeTab, setActiveTab] = useState<'nameColor' | 'title' | 'border'>('nameColor');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback(prev => (prev?.text === text ? null : prev));
    }, 3500);
  };

  if (!isOpen) return null;

  const filteredItems = COSMETIC_ITEMS.filter(item => item.type === activeTab);

  const isEquipped = (item: CosmeticItemDef) => {
    if (item.type === 'border') return equippedBorder === item.value;
    if (item.type === 'nameColor') return equippedNameColor === item.value;
    if (item.type === 'title') return equippedTitle === item.value;
    return false;
  };

  const isOwned = (item: CosmeticItemDef) => {
    return ownedCosmetics.includes(item.id);
  };

  const handleBuy = (item: CosmeticItemDef) => {
    if (item.currency === 'points') {
      if (totalPoints < item.price) {
        showNotification('error', `نقاطك غير كافية! تحتاج ${item.price} نقطة ورصيدك الحالي ${totalPoints}`);
        return;
      }
      setTotalPoints(prev => {
        const next = Math.max(0, prev - item.price);
        localStorage.setItem('quran_total_points', next.toString());
        return next;
      });
    } else {
      if (streakCount < item.price) {
        showNotification('error', `عدد شعلاتك غير كافٍ! تحتاج ${item.price} شعلة ورصيدك الحالي ${streakCount}`);
        return;
      }
      setStreakCount(prev => {
        const next = Math.max(0, prev - item.price);
        localStorage.setItem('quran_streak', next.toString());
        return next;
      });
    }

    const newOwned = [...ownedCosmetics, item.id];
    setOwnedCosmetics(newOwned);
    localStorage.setItem('quran_owned_cosmetics', JSON.stringify(newOwned));
    showNotification('success', `مبارك! تم شراء "${item.title}" بنجاح 🎉`);

    // Auto-equip on purchase
    handleEquip(item);
  };

  const handleEquip = (item: CosmeticItemDef) => {
    if (item.type === 'border') {
      const next = equippedBorder === item.value ? null : item.value;
      setEquippedBorder(next);
      localStorage.setItem('quran_active_frame', next || 'none');
    } else if (item.type === 'nameColor') {
      const next = equippedNameColor === item.value ? null : item.value;
      setEquippedNameColor(next);
      if (next) localStorage.setItem('quran_equipped_name_color', next);
      else localStorage.removeItem('quran_equipped_name_color');
    } else if (item.type === 'title') {
      const next = equippedTitle === item.value ? null : item.value;
      setEquippedTitle(next);
      if (next) localStorage.setItem('quran_equipped_title', next);
      else localStorage.removeItem('quran_equipped_title');
    }

    if (onSaveToServer) onSaveToServer();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div className="text-right">
                <h3 className="font-black text-base sm:text-lg leading-tight">متجر التميز والألقاب</h3>
                <p className="text-[11px] text-white/80 font-bold">خصص مظهرك في المتصدرين وغرف التحدي</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Balances Bar */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-black shrink-0">
            <span className="text-slate-500 dark:text-slate-400">رصيدك المتاح:</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-xl border border-amber-200/70 dark:border-amber-800/60">
                <span>⭐️</span>
                <span>{totalPoints} نقطة</span>
              </div>
              <div className="flex items-center gap-1 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-xl border border-orange-200/70 dark:border-orange-800/60">
                <span>🔥</span>
                <span>{streakCount} شعلة</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-3 p-2 gap-1.5 bg-slate-100 dark:bg-slate-800/80 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('nameColor')}
              className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'nameColor'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>ألوان الأسماء</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('title')}
              className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'title'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>ألقاب الشرف</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('border')}
              className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'border'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>إطارات الصور</span>
            </button>
          </div>

          {/* Feedback message banner */}
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mx-3 sm:mx-4 mt-2.5 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{feedback.text}</span>
            </motion.div>
          )}

          {/* Items List */}
          <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 min-h-[300px]">
            {filteredItems.map(item => {
              const owned = isOwned(item);
              const equipped = isEquipped(item);

              return (
                <div
                  key={item.id}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    equipped
                      ? 'border-brand-emerald bg-brand-emerald/5 dark:bg-emerald-950/20 shadow-xs'
                      : 'border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Visual Preview */}
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                      {item.type === 'nameColor' && (
                        <div
                          className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center font-black text-xs text-white"
                          style={{ backgroundColor: item.value }}
                        >
                          Aa
                        </div>
                      )}
                      {item.type === 'title' && (
                        <span className="text-xl">🏅</span>
                      )}
                      {item.type === 'border' && (
                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-amber-400 flex items-center justify-center text-[10px] font-black text-amber-600">
                          👑
                        </div>
                      )}
                    </div>

                    <div className="text-right min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="font-black text-xs sm:text-sm truncate"
                          style={item.type === 'nameColor' ? { color: item.value } : undefined}
                        >
                          {item.title}
                        </span>
                        {item.type === 'title' && (
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            {item.value}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0">
                    {equipped ? (
                      <button
                        type="button"
                        onClick={() => handleEquip(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-brand-emerald text-white font-black text-xs shadow-xs hover:bg-emerald-600 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>مُجهّز</span>
                      </button>
                    ) : owned ? (
                      <button
                        type="button"
                        onClick={() => handleEquip(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-black text-xs border border-blue-200 transition-colors cursor-pointer"
                      >
                        تجهيز
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBuy(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs shadow-xs shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>{item.price}</span>
                        <span>{item.currency === 'points' ? '⭐️' : '🔥'}</span>
                        <span>شراء</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 text-center text-[11px] text-slate-400 font-bold border-t border-slate-100 dark:border-slate-800 shrink-0">
            العناصر المجهزة تظهر لجميع المتسابقين في لوحة الأبطال وغرف التحدي 🌟
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
