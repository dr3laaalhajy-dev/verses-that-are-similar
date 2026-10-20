import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  User,
  AtSign,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Award,
  Trophy,
  Star,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Calendar,
  Sparkles,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';

interface SettingsViewProps {
  playerName: string | null;
  playerUsername: string | null;
  deviceId: string;
  totalPoints: number;
  cups: number;
  activeFrame: string | null;
  showProfileDecoration: boolean;
  setShowProfileDecoration: (val: boolean) => void;
  userCertificates: { category: string; date: string; name: string }[];
  onOpenCertificate: (category: 'seerah' | 'general') => void;
  onActivateFrameAndCertificate: (category: 'seerah' | 'general') => void;
  onSelectFrame?: (frame: 'seerah' | 'general' | null) => void;
  onLogout: () => void;
  onBackToHome: () => void;
  onUpdatePlayer: (name: string, username: string) => void;
  onStartQuizCategory?: (category: 'seerah' | 'general') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  playerName,
  playerUsername,
  deviceId,
  totalPoints,
  cups,
  activeFrame,
  showProfileDecoration,
  setShowProfileDecoration,
  userCertificates,
  onOpenCertificate,
  onActivateFrameAndCertificate,
  onSelectFrame,
  onLogout,
  onBackToHome,
  onUpdatePlayer,
  onStartQuizCategory
}) => {
  // 1. Profile State
  const [nameInput, setNameInput] = useState(playerName || '');
  const [usernameInput, setUsernameInput] = useState(playerUsername ? playerUsername.replace(/^@+/, '') : '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Collapsible Accordion Sections ("برداية")
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    profile: false,
    password: false,
    frames: false,
    certificates: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Owner Account Detection (alaa)
  const isOwner = useMemo(() => {
    const cleanU = (playerUsername || '').toLowerCase().trim().replace(/^@+/, '');
    const cleanN = (playerName || '').toLowerCase().trim();
    const cleanInputU = usernameInput.toLowerCase().trim().replace(/^@+/, '');
    const cleanInputN = nameInput.toLowerCase().trim();
    return (
      cleanU === 'alaa' ||
      cleanN === 'alaa' ||
      cleanN.includes('علاء') ||
      cleanU.includes('alaa') ||
      cleanInputU === 'alaa' ||
      cleanInputN === 'alaa' ||
      cleanInputN.includes('علاء') ||
      localStorage.getItem('quran_is_owner') === 'true'
    );
  }, [playerUsername, playerName, usernameInput, nameInput]);

  // Frame Unlocked Checks
  const isSeerahUnlocked = useMemo(() => {
    if (isOwner) return true;
    if (userCertificates.some(c => c.category === 'seerah')) return true;
    try {
      const p = JSON.parse(localStorage.getItem('quran_quiz_progress_seerah') || '{}');
      return Boolean(p.easy >= 3 || p.hard >= 3);
    } catch {
      return false;
    }
  }, [isOwner, userCertificates]);

  const isGeneralUnlocked = useMemo(() => {
    if (isOwner) return true;
    if (userCertificates.some(c => c.category === 'general')) return true;
    try {
      const p = JSON.parse(localStorage.getItem('quran_quiz_progress_general') || '{}');
      return Boolean(p.easy >= 5 || p.hard >= 5);
    } catch {
      return false;
    }
  }, [isOwner, userCertificates]);

  // 30-Day Username Change Confirmation Modal
  const [showUsernameConfirmModal, setShowUsernameConfirmModal] = useState(false);

  // Check 30-day restriction from local storage or server
  const usernameLastChangedAt = localStorage.getItem('quran_username_changed_at');
  const daysRemainingForUsernameChange = useMemo(() => {
    if (!usernameLastChangedAt) return 0;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(usernameLastChangedAt).getTime();
    if (elapsed < thirtyDaysMs) {
      return Math.ceil((thirtyDaysMs - elapsed) / (1000 * 60 * 60 * 24));
    }
    return 0;
  }, [usernameLastChangedAt]);

  // 2. Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle Profile Update Submission
  const handleSaveProfileClick = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    const cleanNew = usernameInput.trim().replace(/^@+/, '');
    const cleanOld = (playerUsername || '').trim().replace(/^@+/, '');

    // If username is changing, check 30 days restriction
    if (cleanNew !== cleanOld) {
      if (daysRemainingForUsernameChange > 0) {
        setProfileMsg({
          type: 'error',
          text: `لا يمكنك تغيير اسم المستخدم إلا بعد مرور 30 يوماً من آخر تغيير (متبقي ${daysRemainingForUsernameChange} يوم).`
        });
        return;
      }
      // Trigger confirmation modal
      setShowUsernameConfirmModal(true);
      return;
    }

    // If only name is changing
    executeProfileUpdate();
  };

  const executeProfileUpdate = async () => {
    setIsUpdatingProfile(true);
    setProfileMsg(null);
    setShowUsernameConfirmModal(false);

    const cleanNew = usernameInput.trim().replace(/^@+/, '');
    const cleanOld = (playerUsername || '').trim().replace(/^@+/, '');
    const isUsernameChanging = cleanNew !== cleanOld;

    try {
      const res = await fetch('/api/player-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-profile',
          deviceId,
          name: nameInput.trim(),
          username: cleanNew
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ type: 'error', text: data.error || 'فشل تحديث البيانات' });
        setIsUpdatingProfile(false);
        return;
      }

      // Update parent and localStorage
      onUpdatePlayer(nameInput.trim(), cleanNew);
      if (isUsernameChanging) {
        localStorage.setItem('quran_username_changed_at', new Date().toISOString());
      }

      setProfileMsg({ type: 'success', text: 'تم تحديث بيانات الحساب بنجاح!' });
      setTimeout(() => setProfileMsg(null), 4000);
    } catch {
      setProfileMsg({ type: 'error', text: 'حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً.' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle Password Change Submission
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!currentPassword.trim()) {
      setPasswordMsg({ type: 'error', text: 'يرجى إدخال كلمة المرور الحالية.' });
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setPasswordMsg({ type: 'error', text: 'كلمة المرور الجديدة يجب أن تتكون من 4 خانات على الأقل.' });
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setPasswordMsg({ type: 'error', text: 'كلمة المرور الجديدة وتأكيدها غير متطابقين.' });
      return;
    }

    setIsChangingPass(true);

    try {
      const res = await fetch('/api/player-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-password',
          deviceId,
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg({ type: 'error', text: data.error || 'فشل تغيير كلمة المرور' });
        setIsChangingPass(false);
        return;
      }

      setPasswordMsg({ type: 'success', text: 'تم تغيير كلمة المرور بنجاح!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch {
      setPasswordMsg({ type: 'error', text: 'حدث خطأ أثناء تغيير كلمة المرور، يرجى المحاولة ثانية.' });
    } finally {
      setIsChangingPass(false);
    }
  };

  // All 3 available certificates definitions
  const allCertificatesMeta = [
    {
      id: 'seerah',
      category: 'seerah' as const,
      title: 'شهادة إتقان السيرة النبوية',
      description: 'تُمنح لمن أتم جميع مجموعات تحدي السيرة النبوية العطرة بنجاح.',
      icon: '🕌',
      badgeColor: 'from-emerald-600 to-teal-700',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30'
    },
    {
      id: 'general',
      category: 'general' as const,
      title: 'شهادة الثقافة والأسئلة العامة',
      description: 'تُمنح لإتمام مراحل مسابقة المعارف والعلوم الإسلامية العامة.',
      icon: '✨',
      badgeColor: 'from-blue-600 via-sky-600 to-indigo-700',
      bgColor: 'bg-blue-500/10 border-blue-500/30'
    }
  ];

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-6 relative text-right"
      dir="rtl"
    >
      {/* Top Breadcrumb & Return Bar */}
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <User className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
              إعدادات الحساب والأمان
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-bold mt-0.5">
              إدارة بياناتك، كلمة المرور، واستعراض شهاداتك التكريمية
            </p>
          </div>
        </div>

        <button
          onClick={onBackToHome}
          className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <span>الرئيسية</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* ================================================= */}
        {/* SECTION 1: PROFILE & USERNAME                     */}
        {/* ================================================= */}
        <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden transition-all duration-200 hover:border-emerald-300">
          <button
            type="button"
            onClick={() => toggleSection('profile')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-right cursor-pointer hover:bg-slate-50/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm sm:text-base">
                  البيانات الشخصية واسم الحساب
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  {nameInput || playerName || 'المستخدم'} {playerUsername ? `(@${playerUsername.replace(/^@+/, '')})` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {playerUsername && (
                <span className="hidden sm:inline text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-full">
                  @{playerUsername.replace(/^@+/, '')}
                </span>
              )}
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openSections.profile ? 'rotate-180 text-emerald-600' : ''}`} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSections.profile && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden border-t border-slate-100"
              >
                <div className="p-4 sm:p-6 bg-slate-50/30">
                  <form onSubmit={handleSaveProfileClick} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Display Name Input */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          الاسم الكامل / الظاهر:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="أدخل اسمك"
                            className="w-full pl-3 pr-10 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl font-bold text-xs sm:text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                          />
                          <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Username Input */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                          <span>اسم المستخدم الفريد (المعرف):</span>
                          {daysRemainingForUsernameChange > 0 && (
                            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                              متاح التغيير بعد {daysRemainingForUsernameChange} يوم
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            disabled={daysRemainingForUsernameChange > 0}
                            placeholder="username"
                            className="w-full pl-3 pr-10 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl font-mono font-bold text-xs sm:text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            dir="ltr"
                          />
                          <AtSign className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Note on 30-day username rule */}
                    <div className="p-3 bg-white border border-slate-200/80 rounded-2xl text-[11px] sm:text-xs text-slate-600 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>
                        <strong>تنبيه:</strong> اسم المستخدم هو هويتك الفريدة في اللعبة ولوحة المتصدرين. عند تغييره لن تتمكن من تغييره مجدداً إلا بعد مرور <strong>30 يوماً</strong>.
                      </span>
                    </div>

                    {/* Feedback Message */}
                    {profileMsg && (
                      <div
                        className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                          profileMsg.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {profileMsg.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span>{profileMsg.text}</span>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isUpdatingProfile}
                        className="px-6 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md shadow-emerald-700/20 disabled:opacity-50 cursor-pointer"
                      >
                        {isUpdatingProfile ? 'جاري الحفظ...' : 'حفظ البيانات الشخصية'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ================================================= */}
        {/* SECTION 2: PASSWORD CHANGE                        */}
        {/* ================================================= */}
        <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden transition-all duration-200 hover:border-amber-300">
          <button
            type="button"
            onClick={() => toggleSection('password')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-right cursor-pointer hover:bg-slate-50/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm sm:text-base">
                  تغيير كلمة المرور والأمان
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  تحديث كلمة سر الدخول وحماية الحساب
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-full">
                حماية الحساب
              </span>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openSections.password ? 'rotate-180 text-amber-600' : ''}`} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSections.password && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden border-t border-slate-100"
              >
                <div className="p-4 sm:p-6 bg-slate-50/30">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Current Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          كلمة المرور الحالية:
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPass ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-3 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl font-bold text-xs sm:text-sm text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                          >
                            {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          كلمة المرور الجديدة:
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPass ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-3 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl font-bold text-xs sm:text-sm text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPass(!showNewPass)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                          >
                            {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm New Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          تأكيد كلمة المرور الجديدة:
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPass ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-3 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl font-bold text-xs sm:text-sm text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPass(!showConfirmPass)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                          >
                            {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Password Feedback Message */}
                    {passwordMsg && (
                      <div
                        className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                          passwordMsg.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {passwordMsg.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span>{passwordMsg.text}</span>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isChangingPass}
                        className="flex items-center gap-2 px-6 py-2.5 sm:py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 text-amber-300" />
                        <span>{isChangingPass ? 'جاري التحديث...' : 'تحديث كلمة المرور'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ================================================= */}
        {/* SECTION 3: AVATAR FRAMES SHOWCASE & SELECTOR      */}
        {/* ================================================= */}
        <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden transition-all duration-200 hover:border-amber-300">
          <button
            type="button"
            onClick={() => toggleSection('frames')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-right cursor-pointer hover:bg-slate-50/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                  <span>إطارات الإنجاز واختيار المظهر</span>
                  <Award className="w-4 h-4 text-brand-gold" />
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  تخصيص الإطار المحيط بصورتك الرمزية في لوحة المتصدرين
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full">
                {activeFrame === 'seerah' ? 'السيرة النبوية 🕌' : activeFrame === 'general' ? 'الأسئلة العامة 💎' : 'بدون إطار'}
              </span>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openSections.frames ? 'rotate-180 text-amber-600' : ''}`} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSections.frames && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden border-t border-slate-100"
              >
                <div className="p-4 sm:p-6 bg-slate-50/30">
                  <p className="text-xs text-slate-500 font-bold mb-4">
                    اختر الإطار المحيط بصورتك الرمزية الذي يظهر للجميع في لوحة المتصدرين. الإطارات المغلقة 🔒 تتطلب إتمام التحدي المخصص لفتحها:
                  </p>
                  {/* Frames Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* 1. SEERAH FRAME */}
            <div
              className={`rounded-3xl p-5 border transition-all flex flex-col justify-between relative overflow-hidden ${
                activeFrame === 'seerah'
                  ? 'border-2 border-amber-500 bg-amber-500/5 shadow-md shadow-amber-500/10 ring-2 ring-amber-300/50'
                  : isSeerahUnlocked
                  ? 'border-slate-200 bg-white hover:border-amber-300 hover:shadow-md'
                  : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              {activeFrame === 'seerah' && (
                <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-600 to-yellow-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-20">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>مفعّل حالياً</span>
                </div>
              )}

              <div>
                {/* Avatar Preview with Frame */}
                <div className="w-24 h-24 mx-auto relative flex items-center justify-center my-2">
                  <div className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-xl bg-gradient-to-br from-brand-emerald to-emerald-700 border-2 border-white/40 shadow-md">
                    {(playerName || '').trim().charAt(0).toUpperCase() || 'ع'}
                  </div>

                  {/* Frame Image */}
                  <div className="absolute -inset-1 rounded-full pointer-events-none z-10 bg-[url('/golden_seerah_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />

                  {/* Badge */}
                  <div className="absolute -bottom-1 -left-1 z-20 w-6 h-6 flex items-center justify-center drop-shadow-md">
                    <img src="/icons/seerah.png" className="w-full h-full object-contain" alt="Badge" />
                  </div>

                  {/* Lock Overlay if Locked */}
                  {!isSeerahUnlocked && (
                    <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-[2px] rounded-full z-30 flex flex-col items-center justify-center text-white">
                      <Lock className="w-6 h-6 text-amber-400 mb-0.5 drop-shadow" />
                      <span className="text-[10px] font-black tracking-wide text-amber-200">مغلق</span>
                    </div>
                  )}
                </div>

                <div className="text-center mt-3 mb-4">
                  <h3 className="font-black text-slate-800 text-sm sm:text-base flex items-center justify-center gap-1.5">
                    <span>إطار السيرة النبوية الذهبي</span>
                    {isSeerahUnlocked ? (
                      <span className="text-amber-500">✨</span>
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    إطار ملكي مذهّب ومزخرف، يُمنح لأبطال تحدي السيرة النبوية العطرة.
                  </p>
                  <div className="mt-2">
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full inline-block bg-amber-50 text-amber-700 border border-amber-200">
                      لون الاسم: تدرج ذهبي برونزي
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                {activeFrame === 'seerah' ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-emerald-600 text-white flex items-center justify-center gap-1.5 shadow-sm opacity-95 cursor-default"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>الإطار النشط حالياً</span>
                  </button>
                ) : isSeerahUnlocked ? (
                  <button
                    type="button"
                    onClick={() => onSelectFrame?.('seerah')}
                    className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 active:scale-95 text-white flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/20 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>تفعيل هذا الإطار</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onStartQuizCategory ? onStartQuizCategory('seerah') : onBackToHome()}
                    className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>ابدأ تحدي السيرة لفتحه</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. GENERAL FRAME */}
            <div
              className={`rounded-3xl p-5 border transition-all flex flex-col justify-between relative overflow-hidden ${
                activeFrame === 'general'
                  ? 'border-2 border-blue-500 bg-blue-500/5 shadow-md shadow-blue-500/10 ring-2 ring-sky-300/50'
                  : isGeneralUnlocked
                  ? 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                  : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              {activeFrame === 'general' && (
                <div className="absolute top-3 left-3 bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-20">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>مفعّل حالياً</span>
                </div>
              )}

              <div>
                {/* Avatar Preview with Frame */}
                <div className="w-24 h-24 mx-auto relative flex items-center justify-center my-2">
                  <div className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-xl bg-gradient-to-br from-brand-emerald to-emerald-700 border-2 border-white/40 shadow-md">
                    {(playerName || '').trim().charAt(0).toUpperCase() || 'ع'}
                  </div>

                  {/* Frame Image */}
                  <div className="absolute -inset-1 rounded-full pointer-events-none z-10 bg-[url('/golden_general_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />

                  {/* Badge */}
                  <div className="absolute -bottom-1 -left-1 z-20 w-6 h-6 flex items-center justify-center drop-shadow-md">
                    <img src="/icons/general.png" className="w-full h-full object-contain" alt="Badge" />
                  </div>

                  {/* Lock Overlay if Locked */}
                  {!isGeneralUnlocked && (
                    <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-[2px] rounded-full z-30 flex flex-col items-center justify-center text-white">
                      <Lock className="w-6 h-6 text-sky-400 mb-0.5 drop-shadow" />
                      <span className="text-[10px] font-black tracking-wide text-sky-200">مغلق</span>
                    </div>
                  )}
                </div>

                <div className="text-center mt-3 mb-4">
                  <h3 className="font-black text-slate-800 text-sm sm:text-base flex items-center justify-center gap-1.5">
                    <span>إطار الأسئلة العامة الملكي</span>
                    {isGeneralUnlocked ? (
                      <span className="text-blue-500">💎</span>
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    إطار أزرق ملكي فاخر، يُمنح لأبطال مسابقة المعارف والعلوم الإسلامية.
                  </p>
                  <div className="mt-2">
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full inline-block bg-blue-50 text-blue-700 border border-blue-200">
                      لون الاسم: تدرج أزرق ملكي
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                {activeFrame === 'general' ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-blue-600 text-white flex items-center justify-center gap-1.5 shadow-sm opacity-95 cursor-default"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>الإطار النشط حالياً</span>
                  </button>
                ) : isGeneralUnlocked ? (
                  <button
                    type="button"
                    onClick={() => onSelectFrame?.('general')}
                    className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 active:scale-95 text-white flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>تفعيل هذا الإطار</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onStartQuizCategory ? onStartQuizCategory('general') : onBackToHome()}
                    className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 hover:border-blue-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>ابدأ مسابقة العامة لفتحه</span>
                  </button>
                )}
              </div>
            </div>

            {/* 3. NO FRAME OPTION */}
            <div
              className={`rounded-3xl p-5 border transition-all flex flex-col justify-between relative overflow-hidden ${
                !activeFrame || activeFrame === 'none'
                  ? 'border-2 border-slate-500 bg-slate-50 shadow-md ring-2 ring-slate-300/50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {(!activeFrame || activeFrame === 'none') && (
                <div className="absolute top-3 left-3 bg-slate-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-20">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>المظهر الحالي</span>
                </div>
              )}

              <div>
                {/* Avatar Preview without Frame */}
                <div className="w-24 h-24 mx-auto relative flex items-center justify-center my-2">
                  <div className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-xl bg-gradient-to-br from-brand-emerald to-emerald-700 border-2 border-white/40 shadow-md">
                    {(playerName || '').trim().charAt(0).toUpperCase() || 'ع'}
                  </div>
                </div>

                <div className="text-center mt-3 mb-4">
                  <h3 className="font-black text-slate-800 text-sm sm:text-base">
                    <span>بدون إطار</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    المظهر الافتراضي البسيط للصورة الرمزية بدون أي إطار محيط أو زخارف خاصة.
                  </p>
                  <div className="mt-2">
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full inline-block bg-slate-100 text-slate-600 border border-slate-200">
                      لون الاسم: أبيض افتراضي
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                {!activeFrame || activeFrame === 'none' ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-slate-700 text-white flex items-center justify-center gap-1.5 shadow-sm opacity-95 cursor-default"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>المظهر النشط حالياً</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectFrame?.(null)}
                    className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>استخدام بدون إطار</span>
                  </button>
                )}
              </div>
            </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ================================================= */}
        {/* SECTION 4: MY CERTIFICATES & ACHIEVEMENTS         */}
        {/* ================================================= */}
        <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden transition-all duration-200 hover:border-amber-300">
          <button
            type="button"
            onClick={() => toggleSection('certificates')}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-right cursor-pointer hover:bg-slate-50/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                  <span>لوحة شهاداتي وإنجازاتي</span>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  الأوسمة والشهادات التقديرية المعتمدة التي حققتها في المسابقة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>{cups} كأس</span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-700">{totalPoints} نقطة</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openSections.certificates ? 'rotate-180 text-amber-600' : ''}`} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSections.certificates && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden border-t border-slate-100"
              >
                <div className="p-4 sm:p-6 bg-slate-50/30">
                  {/* Quick Stats Ribbon */}
                  <div className="flex items-center gap-2 sm:gap-3 bg-white border border-amber-200/60 px-3.5 py-2 rounded-2xl shadow-xs justify-around mb-6">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-700">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>{cups} كأس</span>
                    </div>
                    <span className="text-slate-200">|</span>
                    <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                      <Star className="w-4 h-4 text-emerald-500 fill-emerald-500" />
                      <span>{totalPoints} نقطة</span>
                    </div>
                    <span className="text-slate-200">|</span>
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                      <Award className="w-4 h-4 text-amber-600" />
                      <span>{userCertificates.length}/2 شهادات</span>
                    </div>
                  </div>


          {/* VIP Owner Control Panel - Only visible for @alaa */}
          {isOwner && (
            <div className="mb-6 p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/15 via-yellow-400/20 to-amber-600/15 border-2 border-amber-400/80 shadow-lg shadow-amber-500/10 text-right relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-amber-300/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
                    <Sparkles className="w-5 h-5 text-yellow-100" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-amber-950 flex items-center gap-2">
                      <span>لوحة تحكّم المطور والمالك (علاء)</span>
                      <span className="text-[10px] bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                        خاص بحسابك
                      </span>
                    </h3>
                    <p className="text-[11px] sm:text-xs text-amber-900/90 font-bold mt-0.5">
                      تفعيل الإطار وعرض الشهادة الخاصة بكل قسم بضغطة زر واحدة لحسابك:
                    </p>
                  </div>
                </div>

                {activeFrame && (
                  <div className="text-[11px] font-bold text-amber-950 bg-white/90 border border-amber-300 px-3 py-1 rounded-xl shadow-xs self-start sm:self-auto">
                    الإطار المفعّل حالياً: <span className="font-black text-emerald-800">{activeFrame === 'seerah' ? 'السيرة النبوية 🕌' : activeFrame === 'general' ? 'الأسئلة العامة ✨' : 'بدون إطار'}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. السيرة النبوية */}
                <button
                  type="button"
                  onClick={() => onActivateFrameAndCertificate('seerah')}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer ${
                    activeFrame === 'seerah'
                      ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white border-amber-600 shadow-md shadow-amber-600/30 ring-2 ring-amber-300'
                      : 'bg-white hover:bg-amber-50 text-slate-800 border-amber-300/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🕌</span>
                    <div className="text-right">
                      <span className="block font-black text-xs">السيرة النبوية</span>
                      <span className={`text-[10px] ${activeFrame === 'seerah' ? 'text-amber-100' : 'text-slate-400'}`}>الإطار الذهبي والشهادة</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${activeFrame === 'seerah' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                    تفعيل وعرض
                  </span>
                </button>

                {/* 2. الأسئلة العامة */}
                <button
                  type="button"
                  onClick={() => onActivateFrameAndCertificate('general')}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer ${
                    activeFrame === 'general'
                      ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-700 text-white border-blue-500 shadow-md shadow-blue-600/30 ring-2 ring-sky-300'
                      : 'bg-white hover:bg-blue-50 text-slate-800 border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✨</span>
                    <div className="text-right">
                      <span className="block font-black text-xs">الأسئلة العامة</span>
                      <span className={`text-[10px] ${activeFrame === 'general' ? 'text-blue-100' : 'text-slate-400'}`}>الإطار الأزرق والشهادة</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${activeFrame === 'general' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'}`}>
                    تفعيل وعرض
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Certificates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {allCertificatesMeta.map((certMeta) => {
              const claimed = userCertificates.find((c) => c.category === certMeta.category);

              return (
                <div
                  key={certMeta.id}
                  className={`rounded-2xl p-4 sm:p-5 border transition-all duration-300 flex flex-col justify-between ${
                    claimed
                      ? 'bg-white border-amber-300/80 shadow-md shadow-amber-500/10 hover:border-amber-400'
                      : 'bg-slate-50/70 border-slate-200/70 opacity-90'
                  }`}
                >
                  <div>
                    {/* Top Status Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{certMeta.icon}</span>
                      {claimed ? (
                        <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>مُكتسبة ومُعتمدة</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold bg-slate-200/80 text-slate-600 px-2.5 py-0.5 rounded-full">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>قيد القفل</span>
                        </span>
                      )}
                    </div>

                    {/* Certificate Title & Info */}
                    <h3 className="font-black text-slate-800 text-sm sm:text-base leading-snug mb-1">
                      {certMeta.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed mb-4">
                      {certMeta.description}
                    </p>
                  </div>

                  {/* Bottom Action Area */}
                  <div className="pt-3 border-t border-slate-100 mt-2">
                    {claimed ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 font-bold">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>تاريخ الإنجاز:</span>
                          </span>
                          <span className="text-slate-600">{claimed.date}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenCertificate(certMeta.category)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm shadow-amber-600/20 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة وتحميل الشهادة</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (onStartQuizCategory) {
                            onStartQuizCategory(certMeta.category);
                          } else {
                            onBackToHome();
                          }
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-200 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer group"
                      >
                        <Trophy className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-300 transition-colors" />
                        <span>ابدأ التحدي لفتح الشهادة</span>
                      </button>
                    )}

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => onActivateFrameAndCertificate(certMeta.category)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 mt-2 bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 text-amber-900 border border-amber-300/80 rounded-xl font-black text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>تفعيل الإطار وعرض الشهادة (خاص بالمالك)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>

        {/* ================================================= */}
        {/* SECTION 5: ACCOUNT LOGOUT                         */}
        {/* ================================================= */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 font-black text-xs sm:text-sm transition-all active:scale-95 w-full sm:w-auto justify-center cursor-pointer border border-red-200/50"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج / تبديل الحساب</span>
          </button>

          <div className="text-center sm:text-right text-xs text-slate-400 font-bold">
            معرف الجهاز: <span className="font-mono text-slate-500">{deviceId.slice(0, 16)}...</span>
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* 30-DAY USERNAME CHANGE CONFIRMATION MODAL         */}
      {/* ================================================= */}
      <AnimatePresence>
        {showUsernameConfirmModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-amber-200 text-center relative overflow-hidden"
            >
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-600 border border-amber-200">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2">
                تأكيد تغيير اسم المستخدم
              </h3>

              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl mb-5 text-right">
                <p className="text-xs sm:text-sm font-bold text-amber-950 leading-relaxed">
                  هل أنت متأكد من تغيير اسم المستخدم؟
                </p>
                <p className="text-xs font-semibold text-amber-900/90 mt-2 leading-relaxed">
                  إذا ضغطت على <strong>نعم</strong>، فلن يمكنك تغيير اسم المستخدم إلا بعد <strong>30 يوماً</strong>.
                </p>
                <div className="mt-3 pt-2 border-t border-amber-200/60 text-xs font-bold text-slate-700">
                  الاسم الجديد سيكون: <span className="text-emerald-700 font-mono" dir="ltr">@{usernameInput.trim().replace(/^@+/, '')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={executeProfileUpdate}
                  disabled={isUpdatingProfile}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-black text-xs sm:text-sm transition-all shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingProfile ? 'جاري التغيير...' : 'نعم، متأكد وتغيير'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUsernameConfirmModal(false)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer"
                >
                  إلغاء وتراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SettingsView;
