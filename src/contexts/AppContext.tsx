import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import {
  Sparkles, Trophy, RotateCcw, X, Mic, MicOff, Search, BookOpen, CheckCircle, CheckCircle2,
  ChevronRight, ChevronLeft, LayoutGrid, Heart, History, Compass, Home, Plane, Award, Star,
  ListFilter, Sun, Moon, Calendar, Settings, Copy, Check, Lightbulb, ChevronDown, User, Users, Quote,
  ArrowRight, ArrowLeft, Zap, Lock, AlertCircle, Hash, XCircle, Eye, EyeOff, List, Loader2, Flame, ZoomIn, ZoomOut, Maximize2, LogOut,
  Info, HelpCircle, AtSign, Key, LogIn, UserPlus, Smartphone, Download, Share2, Mail, ExternalLink, Send,
  Clock, RefreshCw, Globe, Plus, Gamepad2, Trash2, Play, ShoppingBag
} from 'lucide-react';
import { quranData } from '../services/QuranRepository';
import { HADITHS, Hadith } from '../services/HadithRepository';
import { juzBoundaries, JUZ_NAMES_AR, ALL_QURAN_SURAHS, getJuzsForSurah } from '../services/JuzRepository';
import { getPageNumber, juzStartPages, surahStartPages } from '../services/PageRepository';
import { adhkarData, Dhikr } from '../services/AdhkarRepository';
import { normalizeArabicText, getSimilarity, convertArabicNumbersToEnglish } from '../utils/arabic';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../services/supabase';
import { friendsRealtimeService } from '../services/friendsRealtimeService';
import { getRandomIslamicRoomQuestions, getTargetedIslamicQuestions, getTotalIslamicAvailableCount, getIslamicTopicAvailableCount } from '../utils/islamicChallengeHelper';
import { islamicCategoriesList } from '../data/islamicCategories';
import { calculateStreakInfo, StreakInfo, getTodayLocalDateStr } from '../utils/streakManager';
import { LeaderboardUser, compareLeaderboardUsers, calculateHiddenRankingScore } from '../utils/leaderboardRanking';
import { generateCompletionChallenges } from '../services/challengeGenerator';
import { defaultChallenges } from '../data/defaultChallenges';
import {
  getHijriDate,
  getUpcomingOccasions,
  getNearestOccasion,
  syncAladhanHijri,
  HijriDateInfo,
  IslamicOccasion
} from '../services/IslamicOccasionsService';

import { useWindowSize } from "../hooks/useWindowSize";
import { View, VALID_VIEWS, Difficulty, Verse, VerseCardProps } from "../types/challenges";
import { getBestSubsequenceMatch, superNormalizeArabic, getSpeedQuestionDuration } from "../utils/challengeHelpers";
import { achievementStyles } from "../constants/appConstants";

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface DailyMysteryGift {
  id: string;
  date: string;
  isRevealed: boolean;
  type: 'reading_time' | 'room_challenge';
  title: string;
  description: string;
  target: number;
  currentProgress: number;
  isCompleted: boolean;
  isClaimed: boolean;
  rewardPoints: number;
}

type ToastListener = (t: ToastNotification) => void;
const toastListeners = new Set<ToastListener>();

export const toast = {
  success: (msg: string, ..._args: any[]) => {
    console.log(`SUCCESS: ${msg}`);
    const item: ToastNotification = { id: Date.now().toString() + Math.random(), type: 'success', message: msg };
    toastListeners.forEach(listener => listener(item));
  },
  error: (msg: string, ..._args: any[]) => {
    console.log(`ERROR: ${msg}`);
    const item: ToastNotification = { id: Date.now().toString() + Math.random(), type: 'error', message: msg };
    toastListeners.forEach(listener => listener(item));
  },
  info: (msg: string, ..._args: any[]) => {
    console.log(`INFO: ${msg}`);
    const item: ToastNotification = { id: Date.now().toString() + Math.random(), type: 'info', message: msg };
    toastListeners.forEach(listener => listener(item));
  }
};

const AppContext = createContext<any>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const MOTIVATIONAL_HADITHS = [
  "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
  "الَّذِي يَقْرَأُ الْقُرْآنَ وَهُوَ مَاهِرٌ بِهِ مَعَ السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ",
  "اقْرَؤُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ",
  "مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللَّهِ فَلَهُ بِهِ حَسَنَةٌ وَالْحَسَنَةُ بِعَشْرِ أَمْثَالِهَا",
  "يُقَالُ لِصَاحِبِ الْقُرْآنِ: اقْرَأْ وَارْتَقِ وَرَتِّلْ كَمَا كُنْتَ تُرَتِّلُ فِي الدُّنْيَا"
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view, setViewState] = useState<View>(() => {
    try {
      const saved = sessionStorage.getItem('current_app_view');
      if (saved && VALID_VIEWS.includes(saved as View)) {
        return saved as View;
      }
    } catch (e) { }
    return 'home';
  });

  const isPoppingRef = useRef(false);

  const setView = useCallback((next: View | ((prev: View) => View), pushToHistory = true) => {
    setViewState(prev => {
      const nextView = typeof next === 'function' ? next(prev) : next;
      if (nextView === prev) return prev;

      try {
        sessionStorage.setItem('current_app_view', nextView);
      } catch (e) { }

      if (typeof window !== 'undefined' && window.history) {
        const cleanPath = nextView === 'home' ? '/' : `/${nextView}`;
        if (pushToHistory && !isPoppingRef.current) {
          window.history.pushState({ view: nextView }, '', cleanPath);
        } else {
          window.history.replaceState({ view: nextView }, '', cleanPath);
        }
      }
      return nextView;
    });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.history) {
      if (!window.history.state || window.history.state.view !== view) {
        const cleanPath = view === 'home' ? '/' : `/${view}`;
        window.history.replaceState({ view }, '', cleanPath);
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      isPoppingRef.current = true;
      const targetView = (e.state && e.state.view && VALID_VIEWS.includes(e.state.view))
        ? (e.state.view as View)
        : 'home';

      try {
        sessionStorage.setItem('current_app_view', targetView);
      } catch (err) { }

      setViewState(targetView);

      setTimeout(() => {
        isPoppingRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('quran_admin_token'));
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(localStorage.getItem('quran_admin_super') === 'true');
  const [adminRole, setAdminRole] = useState<string>(() => localStorage.getItem('quran_admin_role') || '');
  const [adminUsername, setAdminUsername] = useState<string>(() => localStorage.getItem('quran_admin_username') || '');
  const [adminName, setAdminName] = useState<string>(() => localStorage.getItem('quran_admin_name') || '');
  const [canManageUsers, setCanManageUsers] = useState<boolean>(() => localStorage.getItem('quran_admin_can_manage_users') === 'true');
  const [adminId, setAdminId] = useState<number | null>(() => {
    const saved = localStorage.getItem('quran_admin_id');
    return saved ? parseInt(saved) : null;
  });

  const isNativeApp = typeof window !== 'undefined' && (
    !!(window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:'
  );

  const [shareCopied, setShareCopied] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const handleShareApp = useCallback(async () => {
    const downloadUrl = 'https://github.com/dr3laaalhajy-dev/verses-that-are-similar/releases/download/v1.0.0/Mutashabihat.apk';
    const shareData = {
      title: 'تطبيق متين للقرآن الكريم للأندرويد',
      text: 'حمّل تطبيق متين للأندرويد الآن واستمتع بكافة التحديات والمتشابهات والقرآن كاملاً بدون إنترنت!\nرابط تحميل التطبيق المباشر:',
      url: downloadUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      if (downloadUrl) {
        await navigator.clipboard.writeText(downloadUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      }
    } catch { }
  }, []);

  // Google Play Testers state & automatic real-time sync
  const [showGooglePlayModal, setShowGooglePlayModal] = useState(false);
  const [testerEmail, setTesterEmail] = useState(() => {
    try {
      return localStorage.getItem('mateen_tester_email') || '';
    } catch {
      return '';
    }
  });
  const [testerStatus, setTesterStatus] = useState<'idle' | 'loading' | 'pending' | 'approved' | 'rejected' | 'error'>('idle');
  const [testerMessage, setTesterMessage] = useState('');
  const [internalTestLink, setInternalTestLink] = useState('https://play.google.com/apps/testing/com.mateen.game');
  const [isCheckingSavedStatus, setIsCheckingSavedStatus] = useState(false);

  const checkTesterStatus = useCallback(async (emailToCheck: string, isSilent = false) => {
    const clean = (emailToCheck || '').trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.') || clean.indexOf('@') >= clean.lastIndexOf('.')) return;
    if (!isSilent) setIsCheckingSavedStatus(true);
    try {
      const res = await fetch(`/api/testers?email=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data.success && data.registered) {
        if (data.status === 'APPROVED') {
          setTesterStatus('approved');
          setTesterMessage('تهانينا! تمت الموافقة على طلبك بنجاح. يمكنك الآن فتح الرابط وتثبيت التطبيق.');
          if (data.internalTestUrl) setInternalTestLink(data.internalTestUrl);
        } else if (data.status === 'REJECTED') {
          setTesterStatus('rejected');
          setTesterMessage('طلبك قيد المراجعة أو تم رفضه. يمكنك إرسال طلب جديد.');
        } else {
          setTesterStatus('pending');
          setTesterMessage('طلبك قيد المراجعة حالياً من قبل الإدارة. سيتم تفعيل حسابك وإظهار رابط التثبيت تلقائياً فور الموافقة عليه.');
        }
      } else {
        if (!isSilent) {
          setTesterStatus('idle');
        }
      }
    } catch (err) {
      console.error('Error checking tester status:', err);
    } finally {
      if (!isSilent) setIsCheckingSavedStatus(false);
    }
  }, []);

  // Automatic real-time status polling for saved registered tester email
  useEffect(() => {
    const saved = localStorage.getItem('mateen_tester_email');
    if (!saved || !saved.includes('@') || !saved.includes('.')) return;

    // Immediate check
    checkTesterStatus(saved, true);

    if (testerStatus === 'approved') return;

    const timer = setInterval(() => {
      const currentSaved = localStorage.getItem('mateen_tester_email');
      if (currentSaved && currentSaved.includes('@') && currentSaved.includes('.')) {
        checkTesterStatus(currentSaved, true);
      }
    }, 8000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const currentSaved = localStorage.getItem('mateen_tester_email');
        if (currentSaved && currentSaved.includes('@') && currentSaved.includes('.')) {
          checkTesterStatus(currentSaved, true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [testerStatus, checkTesterStatus]);

  const handleRegisterTester = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = testerEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setTesterStatus('error');
      setTesterMessage('يرجى إدخال بريد إلكتروني صحيح (Gmail)');
      return;
    }
    setTesterStatus('loading');
    setTesterMessage('');
    try {
      const res = await fetch('/api/testers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'حدث خطأ أثناء إرسال الطلب');
      }
      try {
        localStorage.setItem('mateen_tester_email', clean);
      } catch { }
      if (data.status === 'APPROVED') {
        setTesterStatus('approved');
        setTesterMessage(data.message || 'تهانينا! تم قبول طلبك بنجاح.');
        if (data.internalTestUrl) setInternalTestLink(data.internalTestUrl);
      } else {
        setTesterStatus('pending');
        setTesterMessage(data.message || 'تم إرسال طلب انضمامك للتجربة بنجاح! بانتظار موافقة الإدارة.');
      }
    } catch (err: any) {
      setTesterStatus('error');
      setTesterMessage(err.message || 'تعذر إرسال الطلب، يرجى المحاولة لاحقاً');
    }
  };

  const handleResetTesterForm = () => {
    try {
      localStorage.removeItem('mateen_tester_email');
    } catch { }
    setTesterEmail('');
    setTesterStatus('idle');
    setTesterMessage('');
  };

  const [systemSettings, setSystemSettings] = useState<{
    hideAudioChallenge: boolean;
    hideCompletionChallenge: boolean;
    hideSurahChallenge: boolean;
    hideIslamicVideos: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('cached_system_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          hideAudioChallenge: parsed.hideAudioChallenge !== undefined ? !!parsed.hideAudioChallenge : true,
          hideCompletionChallenge: !!parsed.hideCompletionChallenge,
          hideSurahChallenge: !!parsed.hideSurahChallenge,
          hideIslamicVideos: !!parsed.hideIslamicVideos
        };
      }
    } catch { }
    return {
      hideAudioChallenge: true, // Hidden by founder default
      hideCompletionChallenge: false,
      hideSurahChallenge: false,
      hideIslamicVideos: false
    };
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const newSettings = {
          hideAudioChallenge: !!data.hideAudioChallenge,
          hideCompletionChallenge: !!data.hideCompletionChallenge,
          hideSurahChallenge: !!data.hideSurahChallenge,
          hideIslamicVideos: !!data.hideIslamicVideos
        };
        setSystemSettings(newSettings);
        try {
          localStorage.setItem('cached_system_settings', JSON.stringify(newSettings));
        } catch { }
      }
    } catch (e) {
      console.warn('Failed to fetch settings (offline fallback active):', e);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const fetchWhoAmICategories = useCallback(async () => {
    try {
      const res = await fetch('/api/who-am-i?action=categories');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setWhoAmIAvailableCategories(data.categories);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch who-am-i categories:', e);
    }
  }, []);

  useEffect(() => {
    fetchWhoAmICategories();
  }, [fetchWhoAmICategories]);


  const getInitialChallenges = (): any[] => {
    try {
      const saved = localStorage.getItem('cached_challenges');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return defaultChallenges;
  };

  const [challenges, setChallenges] = useState<any[]>(getInitialChallenges);
  const [completedChallengeIds, setCompletedChallengeIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('quran_completed_ids') || localStorage.getItem('quran_completed_challenges');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [activeListTab, setActiveListTab] = useState<'available' | 'completed'>('available');
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [challengesError, setChallengesError] = useState<string | null>(null);

  const [playerName, setPlayerName] = useState<string | null>(localStorage.getItem('quran_player_name'));
  const [playerUsername, setPlayerUsername] = useState<string | null>(localStorage.getItem('quran_player_username'));
  const [uniquePlayerId, setUniquePlayerId] = useState<string | null>(() => localStorage.getItem('quran_unique_player_id'));
  const [totalPoints, setTotalPoints] = useState<number>(() => Number(localStorage.getItem('quran_total_points')) || 0);
  const [cups, setCups] = useState(() => parseInt(localStorage.getItem('quran_total_cups') || localStorage.getItem('quran_cups') || '0'));

  // Friends & Profile State
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [selectedProfilePlayer, setSelectedProfilePlayer] = useState<any | null>(null);
  const [incomingRoomInvite, setIncomingRoomInvite] = useState<any | null>(null);

  // ==========================================
  // Daily Mystery Gift (صندوق الهدية اليومية والتحقق الذكي)
  // ==========================================
  const getTodayDateKey = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [dailyGift, setDailyGift] = useState<DailyMysteryGift>(() => {
    const todayKey = getTodayDateKey();
    try {
      const saved = localStorage.getItem('quran_daily_mystery_gift');
      if (saved) {
        const parsed: DailyMysteryGift = JSON.parse(saved);
        if (parsed && parsed.date === todayKey) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading quran_daily_mystery_gift from localStorage:', e);
    }

    const dayNum = new Date().getDate();
    // Alternating challenge: even days reading_time (300s = 5m), odd days room_challenge (1 match)
    const isReadingTime = dayNum % 2 === 0;

    return {
      id: `mystery_${todayKey}`,
      date: todayKey,
      isRevealed: false,
      type: isReadingTime ? 'reading_time' : 'room_challenge',
      title: isReadingTime ? 'اقرأ القرآن الكريم لمدة 5 دقائق' : 'أكمل تحدياً في غرف التنافس',
      description: isReadingTime
        ? 'عطّر وقتك بآيات الذكر الحكيم عبر تصفح وتدبر المصحف الشريف'
        : 'شارك في مسابقة جماعية داخل غرف التنافس وأكمل المباراة للنهاية',
      target: isReadingTime ? 300 : 1,
      currentProgress: 0,
      isCompleted: false,
      isClaimed: false,
      rewardPoints: isReadingTime ? 100 : 150,
    };
  });

  const dailyGiftRef = useRef(dailyGift);
  useEffect(() => {
    dailyGiftRef.current = dailyGift;
  }, [dailyGift]);

  // Periodic LocalStorage persistence every 5 seconds (safeguards against unexpected close)
  useEffect(() => {
    const timer = setInterval(() => {
      if (dailyGiftRef.current) {
        try {
          localStorage.setItem('quran_daily_mystery_gift', JSON.stringify(dailyGiftRef.current));
        } catch (e) {
          console.error('Failed to auto-save daily gift:', e);
        }
      }
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const revealDailyGift = useCallback(() => {
    setDailyGift(prev => {
      if (prev.isRevealed) return prev;
      const updated = { ...prev, isRevealed: true };
      try {
        localStorage.setItem('quran_daily_mystery_gift', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  }, []);

  const incrementDailyGiftReadingTime = useCallback((seconds: number = 1) => {
    setDailyGift(prev => {
      if (!prev.isRevealed || prev.type !== 'reading_time' || prev.isCompleted) return prev;
      const nextProgress = Math.min(prev.target, prev.currentProgress + seconds);
      const isCompleted = nextProgress >= prev.target;
      const updated = {
        ...prev,
        currentProgress: nextProgress,
        isCompleted
      };
      if (isCompleted) {
        try {
          localStorage.setItem('quran_daily_mystery_gift', JSON.stringify(updated));
        } catch (e) { }
      }
      return updated;
    });
  }, []);

  const recordDailyGiftRoomMatch = useCallback(() => {
    setDailyGift(prev => {
      if (!prev.isRevealed || prev.type !== 'room_challenge' || prev.isCompleted) return prev;
      const nextProgress = Math.min(prev.target, prev.currentProgress + 1);
      const isCompleted = nextProgress >= prev.target;
      const updated = {
        ...prev,
        currentProgress: nextProgress,
        isCompleted
      };
      try {
        localStorage.setItem('quran_daily_mystery_gift', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  }, []);

  const claimDailyGiftReward = useCallback(() => {
    setDailyGift(prev => {
      if (!prev.isCompleted || prev.isClaimed) return prev;
      const points = prev.rewardPoints || 100;

      setTotalPoints(current => {
        const nextPoints = current + points;
        try {
          localStorage.setItem('quran_total_points', String(nextPoints));
        } catch (e) { }
        return nextPoints;
      });

      toast.success(`🎉 مبارك! تم استلام مكافأة صندوق اليوم (+${points} نقطة)!`);

      const updated = {
        ...prev,
        isClaimed: true
      };
      try {
        localStorage.setItem('quran_daily_mystery_gift', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  }, []);

  // Islamic Occasions & Sunan (مواسم الطاعات وسنن الأيام)
  const [isOccasionsModalOpen, setIsOccasionsModalOpen] = useState(false);
  const [hijriDate, setHijriDate] = useState<HijriDateInfo>(() => getHijriDate());
  const [upcomingOccasions, setUpcomingOccasions] = useState<IslamicOccasion[]>(() => getUpcomingOccasions(15));
  const [nearestOccasion, setNearestOccasion] = useState<IslamicOccasion>(() => getNearestOccasion());

  useEffect(() => {
    const h = getHijriDate();
    setHijriDate(h);
    setUpcomingOccasions(getUpcomingOccasions(15));
    setNearestOccasion(getNearestOccasion());
    syncAladhanHijri().catch(() => { });
  }, []);
  const [showProfileDecoration, setShowProfileDecoration] = useState(() => localStorage.getItem('quran_show_decoration') !== 'false');
  const [userCertificates, setUserCertificates] = useState<{ category: string, date: string, name: string }[]>(() => JSON.parse(localStorage.getItem('quran_user_certificates') || '[]'));
  const [showCertificate, setShowCertificate] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'seerah' | 'general'>('seerah');

  // Game Gamification: Explicit Decoration State
  const [activeFrame, setActiveFrame] = useState<string | null>(() => localStorage.getItem('quran_active_frame'));
  const [isNameDecorated, setIsNameDecorated] = useState(() => localStorage.getItem('quran_name_decorated') === 'true');

  // Determine user's active achievement
  const getActiveAchievement = () => {
    // 1. Check Seerah (Full Completion: 3 groups)
    const seerahSaved = localStorage.getItem('quran_quiz_progress_seerah');
    if (seerahSaved) {
      try {
        const parsed = JSON.parse(seerahSaved);
        // Check for certificate or 3 levels reached
        const hasSeerahCert = userCertificates.some(c => c.category === 'seerah');
        if (hasSeerahCert || (parsed.easy >= 3 || parsed.hard >= 3)) return 'seerah';
      } catch { }
    }

    // 2. Check General (Full Completion: 5 groups)
    const generalSaved = localStorage.getItem('quran_quiz_progress_general');
    if (generalSaved) {
      try {
        const parsed = JSON.parse(generalSaved);
        const hasGeneralCert = userCertificates.some(c => c.category === 'general');
        if (hasGeneralCert || (parsed.easy >= 5 || parsed.hard >= 5)) return 'general';
      } catch { }
    }

    return 'none';
  };

  // Requirement 1: If user selects "no frame" (null or 'none'), do NOT fallback to achievements
  const userAchievement = (activeFrame === 'seerah' || activeFrame === 'general')
    ? activeFrame
    : (activeFrame === null || activeFrame === 'none' || activeFrame === '')
      ? 'none'
      : getActiveAchievement();
  const safeAchievement = userAchievement && achievementStyles[userAchievement] ? userAchievement : 'none';
  const currentStyle = achievementStyles[safeAchievement];
  const isElite = safeAchievement !== 'none';

  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('quran_leaderboard') || '[]');
      return Array.isArray(saved) ? saved.sort(compareLeaderboardUsers) : [];
    } catch {
      return [];
    }
  });

  const [totalUsersCount, setTotalUsersCount] = useState<number>(() => {
    return Number(localStorage.getItem('quran_total_users_count')) || 0;
  });

  const [userLeaderboardRank, setUserLeaderboardRank] = useState<number | null>(() => {
    const saved = localStorage.getItem('quran_user_leaderboard_rank');
    return saved ? Number(saved) : null;
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Power-ups state (Freeze Time 🧊 & 50/50 ✂️)
  const [freezeTimeCount, setFreezeTimeCount] = useState<number>(() => {
    return Number(localStorage.getItem('quran_freeze_count') ?? 3);
  });
  const [deleteTwoCount, setDeleteTwoCount] = useState<number>(() => {
    return Number(localStorage.getItem('quran_delete_two_count') ?? 3);
  });
  const [isFreezeActive, setIsFreezeActive] = useState(false);
  const [freezeSecondsLeft, setFreezeSecondsLeft] = useState(0);
  const [isPowerUpUsedThisQuestion, setIsPowerUpUsedThisQuestion] = useState(false);
  const [eliminatedOptionIndices, setEliminatedOptionIndices] = useState<number[]>([]);

  // Cosmetics State
  const [showCosmeticStore, setShowCosmeticStore] = useState(false);
  const [ownedCosmetics, setOwnedCosmetics] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('quran_owned_cosmetics') || '[]');
    } catch {
      return [];
    }
  });
  const [equippedNameColor, setEquippedNameColor] = useState<string | null>(() => {
    return localStorage.getItem('quran_equipped_name_color') || null;
  });
  const [equippedTitle, setEquippedTitle] = useState<string | null>(null);
  const [equippedEffect, setEquippedEffect] = useState<string | null>(null);
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [selectedAdhkarCategoryId, setSelectedAdhkarCategoryId] = useState<string | null>(null);
  const [adhkarProgress, setAdhkarProgress] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [adhkarSearchQuery, setAdhkarSearchQuery] = useState('');
  const [isSearchSubmitted, setIsSearchSubmitted] = useState(false);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);
  const [selectedSkillJuzs, setSelectedSkillJuzs] = useState<number[]>([]);
  const [selectedSkillSurahs, setSelectedSkillSurahs] = useState<string[]>([]);
  const [skillsScopeMode, setSkillsScopeMode] = useState<'juz' | 'surah'>('juz');
  const [skillSurahSearch, setSkillSurahSearch] = useState<string>('');
  const [selectedSkillCount, setSelectedSkillCount] = useState<number>(10);
  const [isJuzMenuOpen, setIsJuzMenuOpen] = useState(false);
  const [isSurahMenuOpen, setIsSurahMenuOpen] = useState(false);
  const [mushafZoomScale, setMushafZoomScale] = useState(1);
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'prev'>('next');
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null);

  const [librarySettings, setLibrarySettings] = useState<{ darkMode: boolean;[key: string]: any }>(() => {
    try {
      const saved = localStorage.getItem('quran_mushaf_settings');
      if (saved) return JSON.parse(saved);
      return { darkMode: false };
    } catch {
      return { darkMode: false };
    }
  });

  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isResignModalOpen, setIsResignModalOpen] = useState(false);
  const [isCancelRoomModalOpen, setIsCancelRoomModalOpen] = useState(false);
  const [isNextChallengeModalOpen, setIsNextChallengeModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRoomActionLoading, setIsRoomActionLoading] = useState(false);

  const [toastMessage, setToastMessage] = useState<ToastNotification | null>(null);
  const toastTimerRef = useRef<any>(null);

  useEffect(() => {
    const handleToast = (item: ToastNotification) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastMessage(item);
      toastTimerRef.current = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    };
    toastListeners.add(handleToast);
    return () => {
      toastListeners.delete(handleToast);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const [playerAuthMode, setPlayerAuthMode] = useState<'register' | 'login'>('login');
  const [nameInput, setNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [hasAgreedToPrivacy, setHasAgreedToPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyModalInitialTab, setPrivacyModalInitialTab] = useState<'privacy' | 'terms'>('privacy');

  // 1v1 State
  const roomRef = useRef<any>(null);
  const [room, _setRoom] = useState<any>(null);
  const setRoom = (val: any) => {
    roomRef.current = val;
    _setRoom(val);
    if (val && val.id) {
      try {
        localStorage.setItem('activeRoomId', String(val.id));
      } catch (e) { }
    } else if (!val) {
      try {
        localStorage.removeItem('activeRoomId');
      } catch (e) { }
    }
  };
  const prevParticipantsCount = useRef<number>(0);
  const prevRoomStatus = useRef<string>('WAITING');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [v1Error, setV1Error] = useState<string | null>(null);
  const [v1Polling, setV1Polling] = useState(false);
  const [v1GameModes, setV1GameModes] = useState<('audio' | 'complete' | 'surah' | 'islamic' | 'who_am_i')[]>(() => {
    try {
      const saved = localStorage.getItem('cached_system_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.hideCompletionChallenge) return ['complete'];
        if (!parsed.hideSurahChallenge) return ['surah'];
        if (!parsed.hideAudioChallenge) return ['audio'];
        return ['islamic'];
      }
    } catch { }
    return ['complete'];
  });
  const [whoAmIQuestionCount, setWhoAmIQuestionCount] = useState<number>(10);
  const [whoAmICategory, setWhoAmICategory] = useState<string>('الصحابة');
  const [whoAmIAvailableCategories, setWhoAmIAvailableCategories] = useState<{ id: string; name: string; count: number; icon?: string }[]>([
    { id: '1', name: 'الصحابة', count: 60, icon: 'Users' },
    { id: '2', name: 'الأنبياء', count: 0, icon: 'Sparkles' },
    { id: '3', name: 'العلماء', count: 0, icon: 'BookOpen' },
    { id: '4', name: 'الغزوات', count: 0, icon: 'Shield' }
  ]);
  const [selectedWhoAmICategories, setSelectedWhoAmICategories] = useState<string[]>(['الصحابة']);
  const [whoAmICategoryCounts, setWhoAmICategoryCounts] = useState<Record<string, number>>({
    'الصحابة': 5,
    'الأنبياء': 3,
    'العلماء': 2,
    'الغزوات': 2
  });
  const [islamicRoomCategories, setIslamicRoomCategories] = useState<string[]>(['akida']);
  const [islamicRoomLevels, setIslamicRoomLevels] = useState<(1 | 2 | 3)[]>([1]);
  const [islamicRoomTopics, setIslamicRoomTopics] = useState<string[]>(['all']);
  const [showIslamicConfigModal, setShowIslamicConfigModal] = useState<boolean>(false);
  const [v1Timer, setV1Timer] = useState(false);
  const [v1QuestionCount, setV1QuestionCount] = useState(10);
  const [skillQuestionCounts, setSkillQuestionCounts] = useState<Record<'audio' | 'complete' | 'surah', number>>({
    audio: 0,
    complete: 5,
    surah: 0
  });
  const [islamicTopicQuestionCounts, setIslamicTopicQuestionCounts] = useState<Record<string, number>>({
    all: 5
  });
  const [availableSkillCounts, setAvailableSkillCounts] = useState<Record<'audio' | 'complete' | 'surah', number>>({
    audio: 0,
    complete: 0,
    surah: 0
  });
  const [v1TimePerQuestion, setV1TimePerQuestion] = useState(20);
  const [v1TransitionMode, setV1TransitionMode] = useState<'SYNC' | 'ASYNC'>('SYNC');
  const [activeRunningRoom, setActiveRunningRoom] = useState<any | null>(null);
  const [v1RoomName, setV1RoomName] = useState<string>('');
  const [v1IsPrivate, setV1IsPrivate] = useState<boolean>(false);
  const [v1RoomPassword, setV1RoomPassword] = useState<string>('');
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(false);
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);
  const [privateRoomModal, setPrivateRoomModal] = useState<{ isOpen: boolean; room: any | null; password: string; error?: string }>({
    isOpen: false,
    room: null,
    password: '',
    error: undefined
  });
  const [v1IsStartingRoom, setV1IsStartingRoom] = useState(false);
  const [v1Category, setV1Category] = useState<string>('');
  const [skillsType, setSkillsType] = useState<'audio' | 'complete' | 'surah' | null>(null);
  const [isRoomLoading, setIsRoomLoading] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [skillsOptions, setSkillsOptions] = useState<any[]>([]);
  const [skillsCorrectAnswer, setSkillsCorrectAnswer] = useState<string>('');
  const [isSpeedMode, setIsSpeedMode] = useState(false);
  const [skillsFeedback, setSkillsFeedback] = useState(false);
  const [hasAnsweredCurrentQuestion, setHasAnsweredCurrentQuestion] = useState(false);

  // Speed Challenge State
  const [speedTimeLeft, setSpeedTimeLeft] = useState(30);
  const [speedTotalTimeSpent, setSpeedTotalTimeSpent] = useState(0);
  const [isSpeedGameOver, setIsSpeedGameOver] = useState(false);
  const [surahInputs, setSurahInputs] = useState<string[]>([]);
  const [surahFeedbackData, setSurahFeedbackData] = useState<{ isFullyCorrect: boolean; correctSurahs: string[] } | null>(null);
  const [speedStartTime, setSpeedStartTime] = useState<number | null>(null);

  // Quiz Session State
  const [dailyQuote, setDailyQuote] = useState('');

  const quotesArray = [
    "خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ",
    "اقْرَءُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ",
    "وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا",
    "إِنَّ هَذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ",
    "بَلْ هُوَ آيَاتٌ بَيِّنَاتٌ فِي صُدُورِ الَّذِينَ أُوتُوا الْعِلْمَ"
  ];

  useEffect(() => {
    const randomQuote = quotesArray[Math.floor(Math.random() * quotesArray.length)];
    setDailyQuote(randomQuote);
  }, []);

  const [questionsCount, setQuestionsCount] = useState(5);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionWrong, setSessionWrong] = useState(0);
  const [sessionMistakes, setSessionMistakes] = useState<any[]>([]);
  const [sessionCurrentIndex, setSessionCurrentIndex] = useState(0);
  const [showMistakes, setShowMistakes] = useState(false);
  const [allChallenges, setAllChallenges] = useState<any[]>(getInitialChallenges);

  const fetchChallenges = useCallback(async (type?: string, limit?: number, excludeIds?: number[], retryCount = 0): Promise<any[]> => {
    try {
      let url = '/api/challenges';
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (limit) params.append('limit', limit.toString());
      if (excludeIds && excludeIds.length > 0) params.append('excludeIds', excludeIds.join(','));

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (!type && !limit && (!excludeIds || excludeIds.length === 0)) {
          setAllChallenges(data);
          try {
            localStorage.setItem('cached_challenges', JSON.stringify(data));
          } catch { }
        }
        setChallenges(data);
        setChallengesError(null);
        return data;
      }
      return challenges;
    } catch (err: any) {
      if (retryCount > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return fetchChallenges(type, limit, excludeIds, retryCount - 1);
      }
      console.warn('Network offline or server unavailable, using local/cached challenges:', err);
      // Offline fallback: load from cached_challenges or defaultChallenges
      const fallback = getInitialChallenges();
      if (!type && !limit && (!excludeIds || excludeIds.length === 0)) {
        setAllChallenges(fallback);
      }
      setChallenges(fallback);
      setChallengesError(null);
      return fallback;
    } finally {
      setChallengesLoading(false);
    }
  }, []);

  const [dbCompletionChallenges, setDbCompletionChallenges] = useState<any[]>([]);

  const fetchCompletionChallenges = useCallback(async () => {
    try {
      const res = await fetch('/api/challenges?type=COMPLETION');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDbCompletionChallenges(data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch completion challenges for daily:', e);
    }
  }, []);

  // Fetch challenges from API
  useEffect(() => {
    fetchChallenges();
    fetchCompletionChallenges();
  }, [fetchChallenges, fetchCompletionChallenges]);

  const handleAdminLogin = (token: string, superAdmin?: boolean, role?: string, username?: string, id?: number, name?: string, canManageUsersFlag?: boolean) => {
    setAdminToken(token);
    setIsSuperAdmin(!!superAdmin);
    const resolvedRole = role || (superAdmin ? 'CO_FOUNDER' : 'ADMIN');
    setAdminRole(resolvedRole);
    setCanManageUsers(!!canManageUsersFlag);
    if (username) setAdminUsername(username);
    if (id) setAdminId(id);
    if (name) setAdminName(name);
    localStorage.setItem('quran_admin_token', token);
    localStorage.setItem('quran_admin_super', String(!!superAdmin));
    localStorage.setItem('quran_admin_role', resolvedRole);
    localStorage.setItem('quran_admin_can_manage_users', String(!!canManageUsersFlag));
    if (username) localStorage.setItem('quran_admin_username', username);
    if (id) localStorage.setItem('quran_admin_id', id.toString());
    if (name) localStorage.setItem('quran_admin_name', name);
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setIsSuperAdmin(false);
    setAdminRole('');
    setAdminUsername('');
    setAdminName('');
    setAdminId(null);
    setCanManageUsers(false);
    localStorage.removeItem('quran_admin_token');
    localStorage.removeItem('quran_admin_super');
    localStorage.removeItem('quran_admin_role');
    localStorage.removeItem('quran_admin_username');
    localStorage.removeItem('quran_admin_name');
    localStorage.removeItem('quran_admin_id');
    localStorage.removeItem('quran_admin_can_manage_users');
    fetchChallenges(); // Refresh data after admin work
    setView('home');
  };

  useEffect(() => {
    if (!adminToken) return;
    const verifyAdmin = async () => {
      try {
        const res = await fetch('/api/admin?action=me', {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.status === 401) {
          handleAdminLogout();
        } else if (res.ok) {
          const data = await res.json();
          const serverCanManage = Boolean(data.canManageUsers);
          setCanManageUsers(serverCanManage);
          localStorage.setItem('quran_admin_can_manage_users', String(serverCanManage));
          if (data.role) {
            setAdminRole(data.role);
            localStorage.setItem('quran_admin_role', data.role);
          }
          if (data.username) {
            setAdminUsername(data.username);
            localStorage.setItem('quran_admin_username', data.username);
          }
        }
      } catch {
        // ignore
      }
    };
    verifyAdmin();
  }, [adminToken]);

  const handlePlayerAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAgreedToPrivacy) {
      setRegistrationError('يرجى الموافقة على سياسة الخصوصية وشروط الاستخدام للمتابعة');
      return;
    }
    setIsRegistering(true);
    setRegistrationError(null);
    try {
      if (playerAuthMode === 'register') {
        const cleanName = nameInput.trim();
        const cleanUsername = usernameInput.trim().replace(/^@+/, '');
        const cleanPassword = passwordInput.trim();

        if (!cleanName) {
          setRegistrationError('يرجى إدخال اسمك');
          setIsRegistering(false);
          return;
        }
        if (!cleanUsername) {
          setRegistrationError('يرجى إدخال اسم المستخدم');
          setIsRegistering(false);
          return;
        }
        if (!cleanPassword) {
          setRegistrationError('يرجى إدخال كلمة المرور');
          setIsRegistering(false);
          return;
        }

        const res = await fetch('/api/player-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            name: cleanName,
            username: cleanUsername,
            password: cleanPassword
          })
        });

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (!res.ok) {
          setRegistrationError(data.error || data.message || 'فشلت عملية إنشاء الحساب');
          return;
        }

        const p = data.player;
        setPlayerName(p.name);
        setPlayerUsername(p.username);
        localStorage.setItem('quran_player_name', p.name);
        if (p.username) localStorage.setItem('quran_player_username', p.username);
        if (p.uniquePlayerId) {
          setUniquePlayerId(p.uniquePlayerId);
          localStorage.setItem('quran_unique_player_id', p.uniquePlayerId);
        }
      } else {
        // Login mode
        const cleanIdentifier = usernameInput.trim().replace(/^@+/, '');
        const cleanPassword = passwordInput.trim();

        if (!cleanIdentifier) {
          setRegistrationError('يرجى إدخال اسم المستخدم أو الاسم');
          setIsRegistering(false);
          return;
        }
        if (!cleanPassword) {
          setRegistrationError('يرجى إدخال كلمة المرور');
          setIsRegistering(false);
          return;
        }

        const res = await fetch('/api/player-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            username: cleanIdentifier,
            password: cleanPassword
          })
        });

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (!res.ok) {
          setRegistrationError(data.error || data.message || 'بيانات الدخول غير صحيحة');
          return;
        }

        const p = data.player;
        setPlayerName(p.name);
        setPlayerUsername(p.username);
        localStorage.setItem('quran_player_name', p.name);
        if (p.username) localStorage.setItem('quran_player_username', p.username);
        if (p.uniquePlayerId) {
          setUniquePlayerId(p.uniquePlayerId);
          localStorage.setItem('quran_unique_player_id', p.uniquePlayerId);
        }

        // Sync player stats from database
        if (p.points !== undefined) {
          setTotalPoints(p.points);
          localStorage.setItem('quran_total_points', p.points.toString());
        }
        if (p.cups !== undefined) {
          setCups(p.cups);
          localStorage.setItem('quran_total_cups', p.cups.toString());
          localStorage.setItem('quran_cups', p.cups.toString());
        }
        if (Array.isArray(p.completedChallengeIds)) {
          setCompletedChallengeIds(new Set(p.completedChallengeIds));
          localStorage.setItem('quran_completed_ids', JSON.stringify(p.completedChallengeIds));
          localStorage.setItem('quran_completed_challenges', JSON.stringify(p.completedChallengeIds));
        }

        if (p.activeFrame === 'seerah' || p.activeFrame === 'general') {
          setActiveFrame(p.activeFrame);
          setIsNameDecorated(true);
          setShowProfileDecoration(true);
          localStorage.setItem('quran_active_frame', p.activeFrame);
          localStorage.setItem('quran_name_decorated', 'true');
          localStorage.setItem('quran_show_decoration', 'true');
        } else {
          setActiveFrame(null);
          setIsNameDecorated(false);
          setShowProfileDecoration(false);
          localStorage.removeItem('quran_active_frame');
          localStorage.removeItem('quran_name_decorated');
          localStorage.removeItem('quran_show_decoration');
        }

        // Requirement 2: Sync completed challenges to certificates
        if (p.seerahCompleted || p.generalCompleted) {
          setUserCertificates(prev => {
            const certs = [...prev];
            if (p.seerahCompleted && !certs.some(c => c.category === 'seerah')) {
              certs.push({ category: 'seerah', date: 'مُعتمدة', name: p.name });
            }
            if (p.generalCompleted && !certs.some(c => c.category === 'general')) {
              certs.push({ category: 'general', date: 'مُعتمدة', name: p.name });
            }
            localStorage.setItem('quran_user_certificates', JSON.stringify(certs));
            return certs;
          });
        }
      }
    } catch (err: any) {
      console.error('Player auth failed:', err);
      setRegistrationError(err.message || 'تعذر الاتصال بالخادم');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStartSkillsSession = async (count: number, chosenJuzs?: number[], chosenSurahs?: string[]) => {
    setQuestionsCount(count);
    setSessionCorrect(0);
    setSessionWrong(0);
    setSessionMistakes([]);
    setShowMistakes(false);
    setCurrentChallengeIndex(0);
    setSessionCurrentIndex(0);
    setMatchedIds(new Set());
    setSpeedTimeLeft(skillsType === 'audio' ? 30 : 15);

    const dbType = skillsType === 'audio' ? 'STANDARD' : skillsType === 'complete' ? 'COMPLETION' : 'SURAH';
    const excludeIds = Array.from(completedChallengeIds);

    let pool: any[] = [];
    try {
      let result = await fetchChallenges(dbType, count, excludeIds);
      // RECYCLE LOOP: If zero new questions, recycle all original challenges
      if (!result || result.length === 0) {
        console.log('App: Recycling challenges for type:', dbType);
        result = await fetchChallenges(dbType, count, []);
        // Reset completed IDs for this mode so the cycle starts fresh
        setCompletedChallengeIds(prev => {
          const next = new Set(prev);
          if (allChallenges.length > 0) {
            allChallenges
              .filter(c => (dbType === 'STANDARD' ? (!c.type || c.type === 'STANDARD' || c.type === 'AUDIO') : c.type === dbType))
              .forEach(c => next.delete(c.id));
          } else {
            next.clear();
          }
          localStorage.setItem('quran_completed_ids', JSON.stringify(Array.from(next)));
          localStorage.setItem('quran_completed_challenges', JSON.stringify(Array.from(next)));
          return next;
        });
      }
      if (result && result.length > 0) {
        pool = result;
      }
    } catch (err) {
      console.warn('Network fetch error for skills session:', err);
    }

    // In-memory fallback if server didn't return items
    if (pool.length === 0 && allChallenges.length > 0) {
      const matchesType = (c: any) => {
        if (dbType === 'STANDARD') return c.type === 'STANDARD' || c.type === 'AUDIO' || !c.type;
        return c.type === dbType;
      };
      const uncompleted = allChallenges.filter(c => matchesType(c) && !completedChallengeIds.has(c.id));
      if (uncompleted.length > 0) {
        pool = uncompleted;
      } else {
        pool = allChallenges.filter(matchesType);
      }
    }

    // 1. If specific Surahs are chosen (e.g. for completion challenge)
    if (chosenSurahs && chosenSurahs.length > 0 && pool.length > 0) {
      const isSurahMatch = (c: any) => {
        const vSurah = Array.isArray(c.verses) && c.verses[0]?.surah ? String(c.verses[0].surah).replace(/^سورة\s+/, '').trim() : '';
        const cat = c.category || '';
        const kw = c.keyword || '';
        return chosenSurahs.some(s => {
          const cleanS = s.replace(/^سورة\s+/, '').trim();
          const cleanSNorm = cleanS.replace(/[أإآ]/g, 'ا');
          if (vSurah && (vSurah === cleanS || vSurah.replace(/[أإآ]/g, 'ا') === cleanSNorm)) return true;
          if (cat && (cat.includes(cleanS) || cat.replace(/[أإآ]/g, 'ا').includes(cleanSNorm))) return true;
          if (kw && (kw.includes(cleanS) || kw.replace(/[أإآ]/g, 'ا').includes(cleanSNorm))) return true;
          return false;
        });
      };

      let surahFiltered = pool.filter(isSurahMatch);
      // If not enough questions from database, generate from local Quran dataset for those exact surahs
      if (surahFiltered.length < count && dbType === 'COMPLETION') {
        try {
          const gen = generateCompletionChallenges(count, { surahs: chosenSurahs });
          const mappedGen = gen.map((g, idx) => ({
            id: 98000 + idx,
            type: 'COMPLETION',
            keyword: g.prompt,
            verseText: g.prompt,
            text: g.prompt,
            category: g.verseSource,
            level: 'medium',
            options: g.options.map(opt => ({
              text: opt,
              isCorrect: opt === g.options[g.correctIndex]
            })),
            correctText: g.options[g.correctIndex],
            verses: [{
              id: `gen-comp-surah-${idx}`,
              number: 1,
              text: g.prompt,
              surah: g.surah || '',
              juz: g.juz || 1
            }]
          }));
          surahFiltered = [...surahFiltered, ...mappedGen];
        } catch (e) {
          console.warn('Failed to generate extra completion challenges for surahs:', e);
        }
      }
      if (surahFiltered.length > 0) {
        pool = surahFiltered;
      }
    }

    // 2. If specific Juzs are chosen (e.g. for completion challenge)
    if (chosenJuzs && chosenJuzs.length > 0 && chosenJuzs.length < 30 && pool.length > 0) {
      const isJuzMatch = (c: any) => {
        const cJuz = Array.isArray(c.verses) && c.verses[0]?.juz ? Number(c.verses[0].juz) : null;
        if (cJuz && chosenJuzs.includes(cJuz)) return true;
        if (!c.category) return false;
        return chosenJuzs.some(j => {
          const arOrdinal = JUZ_NAMES_AR[j] || '';
          return (
            (arOrdinal && c.category.includes(arOrdinal)) ||
            c.category.includes(`الجزء ${j}`) ||
            c.category.includes(`جزء ${j}`)
          );
        });
      };

      let juzFiltered = pool.filter(isJuzMatch);
      // If not enough questions from database, generate from local Quran dataset for those exact juzs
      if (juzFiltered.length < count && dbType === 'COMPLETION') {
        try {
          const gen = generateCompletionChallenges(count, { juzs: chosenJuzs });
          const mappedGen = gen.map((g, idx) => ({
            id: 97000 + idx,
            type: 'COMPLETION',
            keyword: g.prompt,
            verseText: g.prompt,
            text: g.prompt,
            category: g.verseSource,
            level: 'medium',
            options: g.options.map(opt => ({
              text: opt,
              isCorrect: opt === g.options[g.correctIndex]
            })),
            correctText: g.options[g.correctIndex],
            verses: [{
              id: `gen-comp-juz-${idx}`,
              number: 1,
              text: g.prompt,
              surah: g.surah || '',
              juz: g.juz || 1
            }]
          }));
          juzFiltered = [...juzFiltered, ...mappedGen];
        } catch (e) {
          console.warn('Failed to generate extra completion challenges for juzs:', e);
        }
      }
      if (juzFiltered.length > 0) {
        pool = juzFiltered;
      }
    }

    if (pool && pool.length > 0) {
      // Ensure we only take up to `count` questions and shuffle for variety
      const finalSelection = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
      setChallenges(finalSelection);
      if (isSpeedMode) {
        setSpeedTimeLeft(getSpeedQuestionDuration(finalSelection[0]));
      } else {
        setSpeedTimeLeft(skillsType === 'audio' ? 30 : 15);
      }
      setView('challenge');
    } else {
      setChallengesError('قاعدة البيانات فارغة حالياً لهذا النوع من التحديات أو لم يتم العثور على أسئلة للأجزاء أو السور المختارة.');
    }
  };

  useEffect(() => {
    localStorage.setItem('quran_mushaf_settings', JSON.stringify(librarySettings));
    if (librarySettings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [librarySettings]);
  const [currentPage, setCurrentPage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('quran_last_read_page');
      return saved ? Math.max(1, Math.min(604, parseInt(saved, 10))) : 1;
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('quran_last_read_page', currentPage.toString());
    } catch {
      // ignore
    }
  }, [currentPage]);

  const [selectedAyah, setSelectedAyah] = useState<{ surah: number; ayah: number } | null>(null);

  useEffect(() => {
    setSelectedAyah(null);
  }, [currentPage]);

  const [pageInput, setPageInput] = useState(() => currentPage.toString());

  // Sync selectedSurahId with currentPage
  useEffect(() => {
    if (selectedSurahId) {
      setCurrentPage(surahStartPages[selectedSurahId] || 1);
    }
  }, [selectedSurahId]);

  const filteredSurahsList = useMemo(() => {
    if (!skillSurahSearch.trim()) return ALL_QURAN_SURAHS;
    const cleanSearch = skillSurahSearch.trim().replace(/^سورة\s+/, '');
    const normSearch = cleanSearch.replace(/[أإآ]/g, 'ا');
    return ALL_QURAN_SURAHS.filter(s => {
      const sName = s.name.replace(/^سورة\s+/, '');
      const sNorm = sName.replace(/[أإآ]/g, 'ا');
      return sName.includes(cleanSearch) || sNorm.includes(normSearch) || String(s.id).includes(cleanSearch);
    });
  }, [skillSurahSearch]);

  const [isPageModeActive, setIsPageModeActive] = useState(false);
  const [isMushafFeaturesModalOpen, setIsMushafFeaturesModalOpen] = useState(false);
  const [isMushafFullscreen, setIsMushafFullscreen] = useState(false);
  const [areFullscreenControlsVisible, setAreFullscreenControlsVisible] = useState(true);
  const fullscreenControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetFullscreenControlsTimer = useCallback(() => {
    if (fullscreenControlsTimeoutRef.current) {
      clearTimeout(fullscreenControlsTimeoutRef.current);
    }
    setAreFullscreenControlsVisible(true);
    fullscreenControlsTimeoutRef.current = setTimeout(() => {
      setAreFullscreenControlsVisible(false);
    }, 5000);
  }, []);

  const toggleFullscreenControls = useCallback(() => {
    setAreFullscreenControlsVisible(prev => {
      if (!prev) {
        if (fullscreenControlsTimeoutRef.current) clearTimeout(fullscreenControlsTimeoutRef.current);
        fullscreenControlsTimeoutRef.current = setTimeout(() => {
          setAreFullscreenControlsVisible(false);
        }, 5000);
        return true;
      } else {
        if (fullscreenControlsTimeoutRef.current) clearTimeout(fullscreenControlsTimeoutRef.current);
        return false;
      }
    });
  }, []);

  const enterMushafFullscreen = useCallback(() => {
    setIsPageModeActive(true);
    setIsMushafFullscreen(true);
    resetFullscreenControlsTimer();
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    } catch {
      // ignore
    }
  }, [resetFullscreenControlsTimer]);

  const exitMushafFullscreen = useCallback(() => {
    setIsMushafFullscreen(false);
    if (fullscreenControlsTimeoutRef.current) {
      clearTimeout(fullscreenControlsTimeoutRef.current);
    }
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsMushafFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isMushafFullscreen) {
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }
      return;
    }
    resetFullscreenControlsTimer();
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitMushafFullscreen();
      } else if (e.key === 'ArrowLeft') {
        if (currentPage < 604) {
          setPageTurnDirection('next');
          setCurrentPage(prev => Math.min(604, prev + 1));
          resetFullscreenControlsTimer();
        }
      } else if (e.key === 'ArrowRight') {
        if (currentPage > 1) {
          setPageTurnDirection('prev');
          setCurrentPage(prev => Math.max(1, prev - 1));
          resetFullscreenControlsTimer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }
    };
  }, [isMushafFullscreen, currentPage, exitMushafFullscreen, resetFullscreenControlsTimer]);

  const [challengeMode, setChallengeMode] = useState<'daily' | 'normal'>('normal');
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const completionChallenges = useMemo(() => {
    // 1. Prioritize completion challenges added by the user/admin in the database
    if (dbCompletionChallenges.length > 0) {
      return dbCompletionChallenges;
    }
    const fromAll = allChallenges.filter((c: any) => c.type === 'COMPLETION');
    if (fromAll.length > 0) {
      return fromAll;
    }
    // 2. Fallback: generated challenges from local Quran dataset if none added yet
    try {
      const generated = generateCompletionChallenges(50);
      return generated.map((c, idx) => ({
        id: 99000 + idx,
        type: 'COMPLETION',
        keyword: c.prompt,
        verseText: c.prompt,
        text: c.prompt,
        options: c.options.map(opt => ({
          text: opt,
          isCorrect: opt === c.options[c.correctIndex]
        })),
        correctText: c.options[c.correctIndex],
        verses: [{
          id: `gen-comp-${idx}`,
          number: 1,
          text: c.prompt,
          surah: c.verseSource
        }]
      }));
    } catch (e) {
      console.warn('Fallback generator failed:', e);
      return [];
    }
  }, [dbCompletionChallenges, allChallenges]);

  const dailyChallengeIndex = useMemo(() => {
    const pool = completionChallenges.length > 0 ? completionChallenges : challenges;
    if (pool.length === 0) return 0;
    const today = new Date();
    const daysSinceEpoch = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
    return Math.abs(daysSinceEpoch) % pool.length;
  }, [completionChallenges, challenges]);

  const [dailyChallengeOffset, setDailyChallengeOffset] = useState<number>(0);
  const [allTargetVerses, setAllTargetVerses] = useState<Verse[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wordStates, setWordStates] = useState<Record<string, Record<number, 'correct' | 'skipped'>>>({});
  const [score, setScore] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>((localStorage.getItem('quran_game_difficulty') as Difficulty) || 'medium');

  // AI Explanation State
  const [showExplanation, setShowExplanation] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationText, setExplanationText] = useState('');

  const { width, height } = useWindowSize();

  const { isListening, transcript, startListening, stopListening, resetTranscript, hasRecognition } = useSpeechRecognition();

  const currentChallenge = useMemo(() => {
    if (view === 'group_game') {
      return challenges[currentChallengeIndex];
    }
    if (challengeMode === 'daily') {
      const pool = completionChallenges.length > 0 ? completionChallenges : challenges;
      if (pool.length === 0) return null;
      return pool[(dailyChallengeIndex + dailyChallengeOffset) % pool.length];
    }
    if (challenges.length === 0) return null;
    return challenges[currentChallengeIndex];
  }, [view, challenges, room?.challenges, challengeMode, dailyChallengeIndex, dailyChallengeOffset, currentChallengeIndex, completionChallenges]);

  const KEYWORD = currentChallenge?.verseText || currentChallenge?.text || currentChallenge?.keyword || '';

  // Normalize DB gameMode (STANDARD/COMPLETION/SURAH) to frontend values (audio/complete/surah)
  const roomGameMode = useMemo((): 'audio' | 'complete' | 'surah' => {
    const qType = (currentChallenge?.type || '').toUpperCase();
    if (qType === 'SURAH') return 'surah';
    if (qType === 'COMPLETION') return 'complete';
    if (qType === 'STANDARD' || qType === 'AUDIO') return 'audio';

    const raw = (room?.gameMode || '').toUpperCase();
    if (raw === 'COMPLETION' || raw === 'ISLAMIC') return 'complete';
    if (raw === 'SURAH') return 'surah';
    return 'audio'; // STANDARD, AUDIO, or empty defaults to audio
  }, [room?.gameMode, currentChallenge?.type]);

  const targetVerses = useMemo(() => {
    let limit = allTargetVerses.length;
    if (difficulty === 'easy') limit = Math.min(3, allTargetVerses.length);
    else if (difficulty === 'medium') limit = Math.min(5, allTargetVerses.length);
    return allTargetVerses.slice(0, limit);
  }, [allTargetVerses, difficulty]);

  const isComplete = targetVerses.length > 0 && matchedIds.size === targetVerses.length;
  const progress = targetVerses.length > 0 ? (matchedIds.size / targetVerses.length) * 100 : 0;

  // const [totalPoints, setTotalPoints] = useState(0); // This line is removed as totalPoints is declared above
  const [streak, setStreak] = useState(0);
  const [lastPlayedDate, setLastPlayedDate] = useState('');
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [streakInfo, setStreakInfo] = useState<StreakInfo>(() => calculateStreakInfo(0, '', null));
  const [incompleteChallenge, setIncompleteChallenge] = useState<{ index: number, mode: 'daily' | 'normal', surah: string } | null>(null);
  const [motivationalQuote, setMotivationalQuote] = useState(() => {
    return MOTIVATIONAL_HADITHS[Math.floor(Math.random() * MOTIVATIONAL_HADITHS.length)];
  });

  const currentJuz = useMemo(() => {
    let juz = 1;
    for (let i = 1; i <= 30; i++) {
      if (currentPage >= (juzStartPages[i] || 1)) {
        juz = i;
      } else {
        break;
      }
    }
    return juz;
  }, [currentPage]);

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
      setCurrentPage(pageNum);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  useEffect(() => {
    const savedPoints = localStorage.getItem('quran_total_points');
    if (savedPoints) setTotalPoints(parseInt(savedPoints));

    const syncStreak = () => {
      const savedStreak = parseInt(localStorage.getItem('quran_streak') || '0');
      const lastPlayed = localStorage.getItem('quran_last_played') || '';
      const lastPlayedTimeStr = localStorage.getItem('quran_last_played_time');
      const info = calculateStreakInfo(savedStreak, lastPlayed, lastPlayedTimeStr);
      setStreak(info.streak);
      setLastPlayedDate(info.lastPlayedDate);
      setStreakInfo(info);
      if (info.streak === 0 && savedStreak > 0) {
        localStorage.setItem('quran_streak', '0');
      }
    };

    syncStreak();
    const interval = setInterval(syncStreak, 1000);

    const savedIncomplete = localStorage.getItem('quran_incomplete_challenge');
    if (savedIncomplete) {
      setIncompleteChallenge(JSON.parse(savedIncomplete));
    }

    setMotivationalQuote(MOTIVATIONAL_HADITHS[Math.floor(Math.random() * MOTIVATIONAL_HADITHS.length)]);
    return () => clearInterval(interval);
  }, []);

  const incrementStreak = useCallback(() => {
    const today = getTodayLocalDateStr();
    const nowTime = Date.now();
    const savedLastPlayed = localStorage.getItem('quran_last_played') || lastPlayedDate || '';
    const savedLastPlayedTimeStr = localStorage.getItem('quran_last_played_time');
    const currentStreakVal = parseInt(localStorage.getItem('quran_streak') || String(streak || 0), 10);

    const currentInfo = calculateStreakInfo(currentStreakVal, savedLastPlayed, savedLastPlayedTimeStr);

    let newStreak = currentInfo.streak;

    if (currentInfo.status === 'zero' || newStreak === 0) {
      newStreak = 1;
    } else if (currentInfo.status === 'warning') {
      newStreak = currentInfo.streak + 1;
    } else if (currentInfo.status === 'active') {
      if (savedLastPlayed !== today) {
        newStreak = currentInfo.streak + 1;
      }
    } else {
      newStreak = Math.max(1, currentStreakVal + 1);
    }

    setStreak(newStreak);
    setLastPlayedDate(today);
    setDailyCompleted(true);
    localStorage.setItem('quran_streak', newStreak.toString());
    localStorage.setItem('quran_last_played', today);
    localStorage.setItem('quran_last_played_time', nowTime.toString());
    localStorage.setItem('quran_daily_completed', today);

    const updatedInfo = calculateStreakInfo(newStreak, today, nowTime.toString());
    setStreakInfo(updatedInfo);

    if (playerUsername || playerName) {
      fetch('/api/player-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: playerUsername,
          name: playerName,
          streak: newStreak,
          streakCount: newStreak,
          totalPoints: totalPoints
        })
      }).catch(err => console.error('Failed to sync streak to backend:', err));
    }

    return newStreak;
  }, [streak, lastPlayedDate, playerUsername, playerName, totalPoints]);

  /**
   * Centralized point awarding function - strictly +1 point per correct answer across all challenges.
   */
  const addPoint = useCallback((metadata?: { challengeId?: number; roomId?: string }) => {
    let nextVal = 0;
    setTotalPoints(prev => {
      nextVal = prev + 1;
      try {
        localStorage.setItem('quran_total_points', String(nextVal));
      } catch (e) {}
      return nextVal;
    });

    if (playerUsername || playerName) {
      fetch('/api/player-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: playerUsername,
          name: playerName,
          points: 1, // Strictly 1 point
          totalPoints: nextVal,
          challengeId: metadata?.challengeId,
          roomId: metadata?.roomId
        })
      }).catch(err => console.error('Failed to sync point to backend:', err));
    }

    return nextVal;
  }, [playerUsername, playerName]);

  const updateStatsAfterWin = useCallback(() => {
    const today = getTodayLocalDateStr();
    const nowTime = Date.now();
    const savedLastPlayedTimeStr = localStorage.getItem('quran_last_played_time');
    const savedStreak = parseInt(localStorage.getItem('quran_streak') || streak.toString(), 10);

    const currentInfo = calculateStreakInfo(savedStreak, lastPlayedDate, savedLastPlayedTimeStr);

    let newStreak = currentInfo.streak;

    if (currentInfo.status === 'zero' || newStreak === 0) {
      newStreak = 1;
    } else if (currentInfo.status === 'warning') {
      // Completed within the 12-hour grace period! Restores & increases streak!
      newStreak = currentInfo.streak + 1;
    } else if (currentInfo.status === 'active') {
      if (lastPlayedDate !== today) {
        newStreak = currentInfo.streak + 1;
      }
    }

    setStreak(newStreak);
    setLastPlayedDate(today);
    localStorage.setItem('quran_streak', newStreak.toString());
    localStorage.setItem('quran_last_played', today);
    localStorage.setItem('quran_last_played_time', nowTime.toString());

    const updatedInfo = calculateStreakInfo(newStreak, today, nowTime.toString());
    setStreakInfo(updatedInfo);

    const hasSeerah = userCertificates.some(c => c.category === 'seerah');
    const hasGeneral = userCertificates.some(c => c.category === 'general');
    // Requirement 1: Keep null if user chose "no frame"
    const effectiveFrame = (activeFrame === 'seerah' || activeFrame === 'general')
      ? activeFrame
      : null;

    // Sync completion status with backend
    fetch('/api/player-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: playerUsername,
        name: playerName,
        score: totalPoints,
        totalPoints: totalPoints,
        streak: newStreak,
        streakCount: newStreak,
        totalCups: cups,
        trophiesCount: cups,
        seerahCompleted: hasSeerah,
        generalCompleted: hasGeneral,
        activeFrame: effectiveFrame
      })
    }).catch(err => console.error('Failed to sync quiz completion:', err));

    // Record completed challenge ID
    if (challengeMode === 'normal' || view === 'group_game') {
      const currentId = currentChallenge?.id;
      if (currentId && !completedChallengeIds.has(currentId)) {
        setCompletedChallengeIds(prev => {
          const newSet = new Set(prev);
          newSet.add(currentId);
          localStorage.setItem('quran_completed_ids', JSON.stringify(Array.from(newSet)));
          return newSet;
        });
      }
    }

    // Clear incomplete challenge
    setIncompleteChallenge(null);
    localStorage.removeItem('quran_incomplete_challenge');
  }, [streak, lastPlayedDate, totalPoints, score]);

  useEffect(() => {
    const todayStr = getTodayLocalDateStr();
    const savedDaily = localStorage.getItem('quran_daily_completed');
    if (savedDaily === todayStr) {
      setDailyCompleted(true);
    } else {
      setDailyCompleted(false);
    }
  }, [view]);

  // Check for 1v1 room ID in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetRoomId = params.get('roomId') || params.get('room') || params.get('code');

    if (targetRoomId && playerName) {
      handleJoinV1(targetRoomId);
    }
  }, [playerName]);

  // Deep Linking: Check for /mushaf, /challenges, /library, or other routes on mount and handle Service Worker messages
  useEffect(() => {
    const handleAppDeepLink = (urlOrParams?: string | URLSearchParams) => {
      let params: URLSearchParams;
      let path = window.location.pathname;

      if (typeof urlOrParams === 'string') {
        try {
          const parsed = new URL(urlOrParams, window.location.origin);
          params = parsed.searchParams;
          path = parsed.pathname;
        } catch {
          params = new URLSearchParams(window.location.search);
          path = urlOrParams.split('?')[0];
        }
      } else if (urlOrParams instanceof URLSearchParams) {
        params = urlOrParams;
      } else {
        params = new URLSearchParams(window.location.search);
      }

      const isExplicitMushaf = path === '/mushaf' || path.startsWith('/mushaf/') || params.get('view') === 'mushaf';

      if (isExplicitMushaf) {
        const pageParam = params.get('page');
        const pageNum = pageParam ? parseInt(pageParam, 10) : NaN;
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
          setCurrentPage(pageNum);
        }
        setIsPageModeActive(true);
        setView('mushaf', false);
        return;
      }

      // If user is at root '/', stay on home or saved view; do not force mushaf
      if (path === '/' || path === '') {
        const savedView = sessionStorage.getItem('current_app_view');
        if (savedView && VALID_VIEWS.includes(savedView as View) && savedView !== 'home') {
          setView(savedView as View, false);
        } else {
          setView('home', false);
        }
        if (window.location.search && !params.get('roomId') && !params.get('code')) {
          try {
            window.history.replaceState({ view: 'home' }, '', '/');
          } catch { }
        }
        return;
      }

      const cleanPath = path.replace(/^\//, '').split('?')[0].split('#')[0];
      const rootSegment = cleanPath.split('/')[0];

      if (rootSegment === 'leaderboard' || rootSegment === 'scores') {
        setShowScores(true);
        return;
      }

      if (rootSegment === 'settings') {
        setView('settings', false);
        return;
      }

      if (VALID_VIEWS.includes(rootSegment as View)) {
        setView(rootSegment as View, false);
      }
    };

    // 1. Check URL parameters immediately on mount
    handleAppDeepLink();

    // 2. Listen for deep link events from Service Worker, Window & popstate (when notification is clicked or history changes)
    const deepLinkListener = (event: MessageEvent) => {
      if (event.data?.type === 'DEEP_LINK_NAVIGATE') {
        handleAppDeepLink(event.data.url);
      }
    };

    const popstateListener = () => {
      handleAppDeepLink();
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', deepLinkListener);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('message', deepLinkListener);
      window.addEventListener('popstate', popstateListener);
    }

    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', deepLinkListener);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('message', deepLinkListener);
        window.removeEventListener('popstate', popstateListener);
      }
    };
  }, [setView]);

  const openWird = useCallback((pageNumber?: number) => {
    const target = pageNumber || currentPage || 1;
    const safePage = Math.max(1, Math.min(604, target));
    setCurrentPage(safePage);
    setIsPageModeActive(true);
    setView('mushaf', false);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ page: safePage, view: 'mushaf' }, '', `/mushaf?page=${safePage}`);
    }
  }, [currentPage, setView]);

  const fetchAvailableRooms = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingRooms(true);
    try {
      const res = await fetch('/api/1v1?action=list-rooms');
      const data = await res.json();
      if (res.ok && Array.isArray(data.rooms)) {
        setAvailableRooms(data.rooms);
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    } finally {
      if (showLoading) setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'group_join') {
      fetchAvailableRooms(true);
      const timer = setInterval(() => {
        fetchAvailableRooms(false);
      }, 3500);
      return () => clearInterval(timer);
    }
  }, [view, fetchAvailableRooms]);

  // تحديث البيانات في الخلفية عند السحب للتحديث (Background Pull to Refresh)
  const handlePullToRefresh = useCallback(async () => {
    try {
      const tasks: Promise<any>[] = [
        fetchSettings(),
        fetchChallenges(),
        fetchCompletionChallenges()
      ];
      if (view === 'group_join') {
        tasks.push(fetchAvailableRooms());
      }
      await Promise.allSettled(tasks);
    } catch (err) {
      console.warn('PullToRefresh background error:', err);
    }
  }, [fetchSettings, fetchChallenges, fetchCompletionChallenges, fetchAvailableRooms, view]);

  const fetchAvailableSkillCounts = useCallback(async () => {
    const audioLocal = allChallenges.filter(c => {
      const t = (c.type || '').toUpperCase();
      return t === 'STANDARD' || t === 'AUDIO' || t === '';
    }).length;
    const completeLocal = allChallenges.filter(c => (c.type || '').toUpperCase() === 'COMPLETION').length;
    const surahLocal = allChallenges.filter(c => (c.type || '').toUpperCase() === 'SURAH').length;

    setAvailableSkillCounts({
      audio: audioLocal,
      complete: completeLocal,
      surah: surahLocal
    });

    try {
      const res = await fetch('/api/1v1?action=available-counts');
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setAvailableSkillCounts({
            audio: Math.max(audioLocal, Number(data.counts.audio) || 0),
            complete: Math.max(completeLocal, Number(data.counts.complete) || 0),
            surah: Math.max(surahLocal, Number(data.counts.surah) || 0)
          });
        }
      }
    } catch {
      // Fallback already set
    }
  }, [allChallenges]);

  useEffect(() => {
    if (view === 'group_create') {
      fetchAvailableSkillCounts();
    }
  }, [view, fetchAvailableSkillCounts]);

  // Synchronize v1GameModes and counts with systemSettings (remove any hidden challenges)
  useEffect(() => {
    setV1GameModes(prev => {
      const filtered = prev.filter(m => {
        if (m === 'audio' && systemSettings.hideAudioChallenge) return false;
        if (m === 'complete' && systemSettings.hideCompletionChallenge) return false;
        if (m === 'surah' && systemSettings.hideSurahChallenge) return false;
        return true;
      });
      if (filtered.length > 0) return filtered;
      if (!systemSettings.hideCompletionChallenge) return ['complete'];
      if (!systemSettings.hideSurahChallenge) return ['surah'];
      if (!systemSettings.hideAudioChallenge) return ['audio'];
      return ['islamic'];
    });

    setSkillQuestionCounts(prev => ({
      audio: systemSettings.hideAudioChallenge ? 0 : prev.audio,
      complete: systemSettings.hideCompletionChallenge ? 0 : prev.complete,
      surah: systemSettings.hideSurahChallenge ? 0 : prev.surah
    }));
  }, [systemSettings.hideAudioChallenge, systemSettings.hideCompletionChallenge, systemSettings.hideSurahChallenge]);

  const totalConfiguredQuestions = useMemo(() => {
    let sum = 0;
    if (v1GameModes.includes('who_am_i')) {
      return selectedWhoAmICategories.reduce((acc, cat) => acc + (Math.max(0, Number(whoAmICategoryCounts[cat])) || 0), 0);
    }
    if (v1GameModes.includes('audio') && !systemSettings.hideAudioChallenge) {
      sum += Math.max(0, Number(skillQuestionCounts.audio) || 0);
    }
    if (v1GameModes.includes('complete') && !systemSettings.hideCompletionChallenge) {
      sum += Math.max(0, Number(skillQuestionCounts.complete) || 0);
    }
    if (v1GameModes.includes('surah') && !systemSettings.hideSurahChallenge) {
      sum += Math.max(0, Number(skillQuestionCounts.surah) || 0);
    }
    if (v1GameModes.includes('islamic')) {
      if (islamicRoomTopics.includes('all')) {
        sum += Math.max(0, Number(islamicTopicQuestionCounts['all']) || 0);
      } else {
        islamicRoomTopics.forEach(t => {
          sum += Math.max(0, Number(islamicTopicQuestionCounts[t]) || 0);
        });
      }
    }
    return sum;
  }, [v1GameModes, skillQuestionCounts, islamicRoomTopics, islamicTopicQuestionCounts, systemSettings, selectedWhoAmICategories, whoAmICategoryCounts]);

  const hasCountValidationErrors = useMemo(() => {
    if (v1GameModes.includes('who_am_i')) {
      if (selectedWhoAmICategories.length === 0) return true;
      const sum = selectedWhoAmICategories.reduce((acc, cat) => acc + (Math.max(0, Number(whoAmICategoryCounts[cat])) || 0), 0);
      return sum <= 0;
    }
    for (const skill of ['audio', 'complete', 'surah'] as const) {
      const isHidden =
        (skill === 'audio' && systemSettings.hideAudioChallenge) ||
        (skill === 'complete' && systemSettings.hideCompletionChallenge) ||
        (skill === 'surah' && systemSettings.hideSurahChallenge);

      if (v1GameModes.includes(skill) && !isHidden) {
        const count = Number(skillQuestionCounts[skill]) || 0;
        const max = availableSkillCounts[skill] || 0;
        if (count <= 0 || (max > 0 && count > max)) {
          return true;
        }
      }
    }
    if (v1GameModes.includes('islamic')) {
      if (islamicRoomTopics.includes('all')) {
        const count = Number(islamicTopicQuestionCounts['all']) || 0;
        const max = getTotalIslamicAvailableCount(islamicRoomCategories, islamicRoomLevels, ['all']);
        if (count <= 0 || (max > 0 && count > max)) {
          return true;
        }
      } else {
        if (islamicRoomTopics.length === 0) return true;
        for (const t of islamicRoomTopics) {
          const count = Number(islamicTopicQuestionCounts[t]) || 0;
          const max = getIslamicTopicAvailableCount(t, undefined, islamicRoomLevels);
          if (count <= 0 || (max > 0 && count > max)) {
            return true;
          }
        }
      }
    }
    return false;
  }, [v1GameModes, skillQuestionCounts, availableSkillCounts, islamicRoomTopics, islamicTopicQuestionCounts, islamicRoomCategories, islamicRoomLevels, systemSettings]);

  const handleJoinV1 = async (roomId: string, password?: string) => {
    if (!playerName) {
      toast.error('يرجى تسجيل اسمك أولاً للانضمام');
      return;
    }
    setIsJoiningRoom(true);
    setV1Error(null);
    if (privateRoomModal.isOpen) {
      setPrivateRoomModal(prev => ({ ...prev, error: undefined }));
    }
    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          roomId,
          code: roomId,
          player2Id: playerUsername || playerName,
          password: password ? password.trim() : undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRoom(data);
        setPrivateRoomModal({ isOpen: false, room: null, password: '', error: undefined });
        if (data.status === 'PLAYING') {
          const roomMode = data.gameMode === 'STANDARD' ? 'audio' : (data.gameMode === 'COMPLETION' || data.gameMode === 'ISLAMIC') ? 'complete' : 'surah';
          if (
            (roomMode === 'audio' && systemSettings.hideAudioChallenge) ||
            (roomMode === 'complete' && systemSettings.hideCompletionChallenge) ||
            (roomMode === 'surah' && systemSettings.hideSurahChallenge)
          ) {
            toast.error('تم تعطيل هذا التحدي من لوحة الإدارة');
            return;
          }
          setSkillsType(roomMode);
          const mapped = (data.challenges || []).map((q: any) => ({ ...q, verseText: q.verseText || q.keyword || q.text }));
          setChallenges(mapped);
          setCurrentChallengeIndex(0);
          setSessionCorrect(0);
          setSessionWrong(0);
          setSessionMistakes([]);
          setSkillsFeedback(false);
          setSelectedOption(null);
          setMatchedIds(new Set());
          setChallengesLoading(false);
          setView('challenge');
        } else {
          setView('group_waiting');
        }
        toast.success('تم دخول الغرفة بنجاح');
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        const errMsg = data.message || 'فشل الانضمام للتحدي';
        if (privateRoomModal.isOpen) {
          setPrivateRoomModal(prev => ({ ...prev, error: errMsg }));
        } else {
          setV1Error(errMsg);
          toast.error(errMsg);
        }
      }
    } catch (err) {
      const errMsg = 'حدث خطأ في الاتصال';
      if (privateRoomModal.isOpen) {
        setPrivateRoomModal(prev => ({ ...prev, error: errMsg }));
      } else {
        setV1Error(errMsg);
        toast.error(errMsg);
      }
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleCreateV1 = async () => {
    if (!playerName) return;
    if (v1IsPrivate && !v1RoomPassword.trim()) {
      toast.error('يرجى كتابة كلمة المرور للغرفة الخاصة');
      return;
    }
    if (totalConfiguredQuestions <= 0) {
      toast.error('يرجى تحديد عدد الأسئلة لمهارة واحدة على الأقل');
      return;
    }
    if (hasCountValidationErrors) {
      toast.error('يرجى تصحيح الأعداد التي تتجاوز الحد المتاح');
      return;
    }
    setIsCreatingRoom(true);
    setV1Error(null);
    try {
      if (v1GameModes.includes('who_am_i')) {
        const categories_config = selectedWhoAmICategories.map(cat => ({
          category: cat,
          count: Math.max(1, Number(whoAmICategoryCounts[cat]) || 1)
        }));
        const totalCount = Math.max(1, categories_config.reduce((sum, c) => sum + c.count, 0));
        const categorySummary = categories_config.map(c => `${c.category} (${c.count})`).join(' + ');

        const requestBody = {
          action: 'create',
          player1Id: playerUsername || playerName,
          player1Name: playerName,
          name: v1RoomName.trim() || 'تحدي من أنا؟',
          isPrivate: v1IsPrivate,
          password: v1IsPrivate ? v1RoomPassword.trim() : null,
          gameMode: 'WHO_AM_I',
          gameModes: ['WHO_AM_I'],
          challenge_type: 'who_am_i',
          categories_config: categories_config,
          categories: categories_config.map(c => c.category),
          category: categorySummary,
          questionCount: totalCount,
          timePerQuestion: 40,
          transitionMode: 'SYNC',
          room_config: {
            challenge_type: 'who_am_i',
            categories_config: categories_config
          },
          customChallenges: Array.from({ length: totalCount }, (_, i) => ({
            id: i + 1,
            type: 'WHO_AM_I',
            keyword: 'من أنا؟',
            text: 'من أنا؟'
          }))
        };

        const res = await fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        const data = await res.json();
        if (res.ok) {
          setRoom(data);
          setView('group_waiting');
        } else {
          const errorMsg = data.message || 'فشل إنشاء الغرفة';
          setV1Error(errorMsg);
          toast.error(errorMsg);
        }
        return;
      }

      const effectiveGameModes = v1GameModes.filter(m => {
        if (m === 'audio' && systemSettings.hideAudioChallenge) return false;
        if (m === 'complete' && systemSettings.hideCompletionChallenge) return false;
        if (m === 'surah' && systemSettings.hideSurahChallenge) return false;
        return true;
      });

      const isIslamicIncluded = effectiveGameModes.includes('islamic');
      const count = totalConfiguredQuestions;

      let customChallenges: any[] = [];

      // 1. Audio challenges
      if (effectiveGameModes.includes('audio') && !systemSettings.hideAudioChallenge) {
        const audioCount = Math.max(0, Number(skillQuestionCounts.audio) || 0);
        if (audioCount > 0) {
          const pool = allChallenges.filter(c => {
            const t = (c.type || '').toUpperCase();
            return t === 'STANDARD' || t === 'AUDIO' || t === '';
          });
          const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, audioCount);
          customChallenges.push(...picked);
        }
      }

      // 2. Completion challenges
      if (effectiveGameModes.includes('complete') && !systemSettings.hideCompletionChallenge) {
        const completeCount = Math.max(0, Number(skillQuestionCounts.complete) || 0);
        if (completeCount > 0) {
          const pool = allChallenges.filter(c => (c.type || '').toUpperCase() === 'COMPLETION');
          const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, completeCount);
          customChallenges.push(...picked);
        }
      }

      // 3. Surah challenges
      if (effectiveGameModes.includes('surah') && !systemSettings.hideSurahChallenge) {
        const surahCount = Math.max(0, Number(skillQuestionCounts.surah) || 0);
        if (surahCount > 0) {
          const pool = allChallenges.filter(c => (c.type || '').toUpperCase() === 'SURAH');
          const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, surahCount);
          customChallenges.push(...picked);
        }
      }

      // 4. Targeted Islamic questions
      if (isIslamicIncluded) {
        const allocations: Record<string, number> = {};
        if (islamicRoomTopics.includes('all')) {
          allocations['all'] = Math.max(0, Number(islamicTopicQuestionCounts['all']) || 0);
        } else {
          islamicRoomTopics.forEach(t => {
            allocations[t] = Math.max(0, Number(islamicTopicQuestionCounts[t]) || 0);
          });
        }
        const islamicQs = getTargetedIslamicQuestions(allocations, islamicRoomLevels, islamicRoomCategories);
        customChallenges.push(...islamicQs);
      }

      // 5. Shuffle all questions randomly
      const finalCustomChallenges = [...customChallenges].sort(() => Math.random() - 0.5);

      const requestBody = {
        action: 'create',
        player1Id: playerUsername || playerName,
        player1Name: playerName,
        name: v1RoomName.trim() || 'غرفة التحدي',
        isPrivate: v1IsPrivate,
        password: v1IsPrivate ? v1RoomPassword.trim() : null,
        gameMode: effectiveGameModes.length === 1
          ? (effectiveGameModes[0] === 'islamic' ? 'ISLAMIC' : effectiveGameModes[0] === 'audio' ? 'STANDARD' : effectiveGameModes[0] === 'complete' ? 'COMPLETION' : 'SURAH')
          : 'MIXED',
        gameModes: effectiveGameModes.map(m => m === 'islamic' ? 'ISLAMIC' : m === 'audio' ? 'STANDARD' : m === 'complete' ? 'COMPLETION' : 'SURAH'),
        categories: isIslamicIncluded ? islamicRoomCategories : (v1Category ? [v1Category] : []),
        category: isIslamicIncluded ? islamicRoomCategories[0] : v1Category,
        levels: isIslamicIncluded ? islamicRoomLevels : undefined,
        topics: isIslamicIncluded ? islamicRoomTopics : undefined,
        questionCount: count,
        timePerQuestion: v1Timer ? v1TimePerQuestion : 0,
        transitionMode: v1TransitionMode,
        customChallenges: finalCustomChallenges
      };

      console.log('Request Body being sent:', requestBody);

      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await res.json();
      if (res.ok) {
        setRoom(data);
        setView('group_waiting');
      } else {
        const errorMsg = data.message || 'فشل إنشاء الغرفة';
        setV1Error(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'حدث خطأ في الاتصال';
      setV1Error(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleStartRoomV1 = async () => {
    if (!room?.id || v1IsStartingRoom) return;
    if ((room?.participants?.length || 0) < 2) {
      toast.error('يجب وجود لاعبين على الأقل لبدء التحدي');
      return;
    }
    setV1IsStartingRoom(true);
    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', roomId: room.id })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.gameMode === 'WHO_AM_I' || room.gameMode === 'WHO_AM_I') {
          setRoom(data);
          setView('group_game');
          return;
        }

        // Initialize Game State
        const mapped = (data.challenges || []).map((q: any) => ({ ...q, verseText: q.verseText || q.keyword || q.text }));
        setChallenges(mapped);
        setCurrentChallengeIndex(0);
        setSessionCorrect(0);
        setSessionWrong(0);
        setSessionMistakes([]);
        setSkillsFeedback(false);
        setSelectedOption(null);
        setMatchedIds(new Set());

        const firstQ = mapped[0];
        const mode = firstQ?.type === 'SURAH' ? 'surah' : (firstQ?.type === 'STANDARD' || firstQ?.type === 'AUDIO') ? 'audio' : 'complete';
        if (
          (mode === 'audio' && systemSettings.hideAudioChallenge) ||
          (mode === 'complete' && systemSettings.hideCompletionChallenge) ||
          (mode === 'surah' && systemSettings.hideSurahChallenge)
        ) {
          toast.error('تم تعطيل هذا التحدي من لوحة الإدارة');
          setV1IsStartingRoom(false);
          return;
        }
        setSkillsType(mode);
        setRoom(data);
        const roomTime = (data.timePerQuestion && data.timePerQuestion > 0) ? data.timePerQuestion : 0;
        if (roomTime > 0) {
          setSpeedTimeLeft(roomTime);
        }
        setView('challenge');
      } else {
        toast.error(data.message || 'فشل بدء التحدي');
      }
    } catch (err) {
      console.error('Start room error:', err);
      toast.error('خطأ في الاتصال بالسيرفر');
    } finally {
      setV1IsStartingRoom(false);
    }
  };

  const isAdvancingRef = useRef(false);
  const notifiedWithdrawnPlayersRef = useRef<Set<string>>(new Set());

  // Requirement 4: Reset UI State immediately on question transition
  const resetQuestionUIState = useCallback((newIndex: number, currentRoomData?: any) => {
    setCurrentChallengeIndex(newIndex);
    setHasAnsweredCurrentQuestion(false);
    setSkillsFeedback(false);
    setSelectedOption(null);
    setMatchedIds(new Set());
    setSurahFeedbackData(null);

    const roomTime = (currentRoomData?.timePerQuestion && currentRoomData.timePerQuestion > 0)
      ? currentRoomData.timePerQuestion
      : (room?.timePerQuestion && room.timePerQuestion > 0)
        ? room.timePerQuestion
        : 0;
    if (roomTime > 0) {
      setSpeedTimeLeft(roomTime);
    }

    const currentChallengesList = (challenges && challenges.length > 0) ? challenges : (currentRoomData?.challenges || []);
    const nextQ = currentChallengesList[newIndex] || currentRoomData?.challenges?.[newIndex];
    if (nextQ) {
      const mode = nextQ.type === 'SURAH' ? 'surah' : (nextQ.type === 'STANDARD' || nextQ.type === 'AUDIO') ? 'audio' : 'complete';
      setSkillsType(mode);
    }
  }, [challenges, room?.timePerQuestion]);

  const handleRoomTimeout = async () => {
    if (!room?.id) return;
    if (room.transitionMode === 'ASYNC') {
      // In ASYNC mode: player timed out on their individual question
      try {
        fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit-answer',
            roomId: room.id,
            playerId: playerUsername || playerName,
            questionIndex: currentChallengeIndex,
            isCorrect: false,
            timestamp: Date.now()
          })
        }).catch(err => console.error('Error submitting ASYNC timeout answer:', err));
        moveToNextQuestion();
      } catch (err) {
        console.error('Error in ASYNC timeout:', err);
      }
      return;
    }

    // In SYNC mode: Submit answer as incorrect if not answered yet
    if (!hasAnsweredCurrentQuestion) {
      setHasAnsweredCurrentQuestion(true);
      setSkillsFeedback(true);
      fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-answer',
          roomId: room.id,
          playerId: playerUsername || playerName,
          questionIndex: room.currentQuestionIndex ?? currentChallengeIndex,
          isCorrect: false,
          timestamp: Date.now()
        })
      }).catch(err => console.error('Error submitting timeout answer:', err));
    }

    // Requirement 1: Only Host triggers advance-question on timeout
    const isHost = Boolean(
      (room?.player1?.name && playerName && room.player1.name === playerName) ||
      (room?.player1?.username && playerUsername && room.player1.username.toLowerCase() === playerUsername.toLowerCase()) ||
      (room?.hostName && playerName && room.hostName === playerName) ||
      (room?.hostUsername && playerUsername && room.hostUsername.toLowerCase() === playerUsername.toLowerCase())
    );

    if (isHost && !isAdvancingRef.current) {
      isAdvancingRef.current = true;
      try {
        const res = await fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'advance-question',
            roomId: room.id,
            playerId: playerUsername || playerName,
            questionIndex: room.currentQuestionIndex ?? currentChallengeIndex
          })
        });
        const data = await res.json();
        isAdvancingRef.current = false;
        if (res.ok && data) {
          setRoom(data);
          if (data.status === 'FINISHED') {
            recordDailyGiftRoomMatch();
            setView('group_game');
          } else if (data.currentQuestionIndex > currentChallengeIndex) {
            resetQuestionUIState(data.currentQuestionIndex, data);
          }
        }
      } catch (err) {
        isAdvancingRef.current = false;
        console.error('Error in handleRoomTimeout:', err);
      }
    }
  };

  // Poll room status
  useEffect(() => {
    if (!room?.id || (view !== 'group_waiting' && view !== 'group_game' && view !== 'challenge')) return;
    if (room.status === 'FINISHED' && view === 'group_game') return;

    const poll = async () => {
      try {
        const playerIdParam = encodeURIComponent(playerUsername || playerName || '');
        const res = await fetch(`/api/1v1?action=poll&roomId=${room.id}&playerId=${playerIdParam}`);
        const data = await res.json();
        if (res.ok) {
          prevParticipantsCount.current = data.participants?.length || 0;

          // If room was cancelled by host or server
          if (data.status === 'CANCELLED') {
            setRoom(null);
            toast.error('تم إلغاء الغرفة من قبل المضيف');
            setView('group_join');
            return;
          }

          // If room expired due to 10-minute TTL
          if (data.status === 'EXPIRED') {
            setRoom(null);
            toast.error('انتهت صلاحية الغرفة (مرور أكثر من 10 دقائق دون بدء التحدي)');
            setView('group_join');
            return;
          }

          // If room finished, switch to group_game results
          if (data.status === 'FINISHED') {
            recordDailyGiftRoomMatch();
            setRoom(data);
            if (view !== 'group_game') {
              setView('group_game');
            }
            return;
          }

          // Initial start from waiting room
          if (view === 'group_waiting' && data.status === 'PLAYING') {
            notifiedWithdrawnPlayersRef.current.clear();
            if (data.gameMode === 'WHO_AM_I' || room?.gameMode === 'WHO_AM_I') {
              setRoom(data);
              setView('group_game');
              return;
            }
            const mapped = (data.challenges || []).map((q: any) => ({ ...q, verseText: q.verseText || q.keyword || q.text }));
            const firstQ = mapped[0];
            const roomMode = firstQ?.type === 'SURAH' ? 'surah' : (firstQ?.type === 'STANDARD' || firstQ?.type === 'AUDIO') ? 'audio' : 'complete';
            if (
              (roomMode === 'audio' && systemSettings.hideAudioChallenge) ||
              (roomMode === 'complete' && systemSettings.hideCompletionChallenge) ||
              (roomMode === 'surah' && systemSettings.hideSurahChallenge)
            ) {
              setRoom(null);
              setSkillsType(null);
              toast.error('تم تعطيل هذا التحدي من لوحة الإدارة');
              setView('group_join');
              return;
            }
            setSkillsType(roomMode);
            setChallenges(mapped);
            setChallengesLoading(false);
            setCurrentChallengeIndex(data.currentQuestionIndex || 0);
            setSessionCorrect(0);
            setSessionWrong(0);
            setSessionMistakes([]);
            setSkillsFeedback(false);
            setHasAnsweredCurrentQuestion(false);
            setSelectedOption(null);
            setMatchedIds(new Set());

            const roomTime = (data.timePerQuestion && data.timePerQuestion > 0) ? data.timePerQuestion : 0;
            if (roomTime > 0) {
              setSpeedTimeLeft(roomTime);
            }

            setView('challenge');
          } else if (view === 'challenge' && data.status === 'PLAYING') {
            // Withdrawal Notification: Check if any participant has left/resigned and notify remaining players
            const participantsList = data.participants || [];
            participantsList.forEach((p: any) => {
              const pIdStr = String(p.id);
              const pProgress = data.playersProgress ? data.playersProgress[pIdStr] : null;
              const isWithdrawn = Boolean(p.hasLeft || (pProgress && pProgress.hasLeft) || p.isResigned || (pProgress && pProgress.isResigned) || p.isOnline === false);

              if (isWithdrawn && !notifiedWithdrawnPlayersRef.current.has(pIdStr)) {
                notifiedWithdrawnPlayersRef.current.add(pIdStr);
                if (p.name !== playerName && p.username !== playerUsername) {
                  toast.error(`🚪 انسحب ${p.name || 'أحد المتسابقين'} من التحدي`);
                }
              }
            });

            if (data.transitionMode === 'ASYNC') {
              // In ASYNC mode, keep room data updated without overriding player's local question position
              setRoom(data);
            } else {
              // In SYNC mode:
              // 1. Requirement 4: Check if server advanced to next question and reset UI state immediately
              if (data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
                resetQuestionUIState(data.currentQuestionIndex, data);
                setRoom(data);
                return;
              }

              // 2. Check if current user's answer is recorded
              const myPId = String(data.participants?.find((p: any) => p.name === playerName || p.username === playerUsername)?.id);
              if (data.currentAnswers && myPId && data.currentAnswers[myPId] && !hasAnsweredCurrentQuestion) {
                setHasAnsweredCurrentQuestion(true);
                setSkillsFeedback(true);
              }

              // 3. Requirement 1 & 3: Host-Only Transition Validation
              const isHost = Boolean(
                (room?.player1?.name && playerName && room.player1.name === playerName) ||
                (room?.player1?.username && playerUsername && room.player1.username.toLowerCase() === playerUsername.toLowerCase()) ||
                (room?.hostName && playerName && room.hostName === playerName) ||
                (room?.hostUsername && playerUsername && room.hostUsername.toLowerCase() === playerUsername.toLowerCase()) ||
                (data?.player1?.name && playerName && data.player1.name === playerName) ||
                (data?.player1?.username && playerUsername && data.player1.username.toLowerCase() === playerUsername.toLowerCase()) ||
                (data?.hostName && playerName && data.hostName === playerName) ||
                (data?.hostUsername && playerUsername && data.hostUsername.toLowerCase() === playerUsername.toLowerCase())
              );

              if (isHost && !isAdvancingRef.current) {
                const participants = data.participants || [];
                // Active players: exclude those who left (hasLeft) or resigned (isResigned) or went offline (isOnline === false)
                const activeParticipants = participants.filter((p: any) => p.isOnline !== false && !p.hasLeft && !p.isResigned);
                const activeCount = activeParticipants.length;
                const currentAnswers = data.currentAnswers || {};

                // Filter answers for active question
                const validAnswers = Object.entries(currentAnswers).filter(([_, ans]: [string, any]) => {
                  return ans && (ans.questionIndex === undefined || ans.questionIndex === data.currentQuestionIndex);
                });

                // Condition: all active participants have answered
                const allActiveAnswered = activeCount > 0 && (
                  validAnswers.length >= activeCount ||
                  activeParticipants.every((p: any) => Boolean(currentAnswers[String(p.id)]))
                );

                if (allActiveAnswered) {
                  isAdvancingRef.current = true;
                  fetch('/api/1v1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'advance-question',
                      roomId: room.id,
                      playerId: playerUsername || playerName,
                      questionIndex: data.currentQuestionIndex
                    })
                  })
                    .then(res => res.json())
                    .then(advData => {
                      isAdvancingRef.current = false;
                      if (advData && advData.currentQuestionIndex > currentChallengeIndex) {
                        resetQuestionUIState(advData.currentQuestionIndex, advData);
                        setRoom(advData);
                      }
                    })
                    .catch(err => {
                      isAdvancingRef.current = false;
                      console.error('Host advance question error:', err);
                    });
                }
              }

              setRoom(data);
            }
          } else {
            setRoom(data);
          }
        } else {
          console.error('Polling API Error:', data.message || 'Unknown error');
        }
      } catch (err) {
        console.error('Polling Network/Runtime Error:', err);
      }
    };

    const interval = setInterval(poll, 1000); // Poll every 1 second for real-time multiplayer sync
    return () => clearInterval(interval);
  }, [room?.id, view, room?.status, currentChallengeIndex, playerName, playerUsername, hasAnsweredCurrentQuestion, challenges, resetQuestionUIState]);

  // Presence & Connection Management: Track online/offline status & background lifecycle
  useEffect(() => {
    if (!room?.id || (view !== 'group_waiting' && view !== 'challenge' && view !== 'group_game')) return;

    const sendPresence = (online: boolean) => {
      const payload = JSON.stringify({
        action: 'presence',
        roomId: room.id,
        playerId: playerUsername || playerName,
        isOnline: online
      });

      if (!online && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/1v1', blob);
      } else {
        fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(err => console.error('Presence error:', err));
      }
    };

    // Mark online on entering
    sendPresence(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendPresence(false);
      } else if (document.visibilityState === 'visible') {
        sendPresence(true);
      }
    };

    const handleBeforeUnload = () => {
      sendPresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [room?.id, view, playerName, playerUsername]);

  // Check for active unfinished challenges on the Home screen
  useEffect(() => {
    if (view !== 'home' || !playerName) return;

    const checkActive = async () => {
      try {
        const pIdParam = encodeURIComponent(playerUsername || playerName || '');
        const res = await fetch(`/api/1v1?action=check-active&playerId=${pIdParam}`);
        const data = await res.json();
        if (res.ok && data && data.id && (data.status === 'PLAYING' || data.status === 'WAITING')) {
          // التحقق الدقيق من مسار هذا اللاعب تحديداً داخل الغرفة
          const pId = String(data.participants?.find((p: any) => p.name === playerName || p.username === playerUsername)?.id);
          const pProgress = data.playersProgress ? data.playersProgress[pId] : null;

          // إذا كان اللاعب قد انسحب (hasLeft = true أو isResigned = true) أو أنهى، يتم إخفاء الشريط تماماً وتنظيف المرجع
          if (pProgress && (pProgress.hasLeft || pProgress.isResigned || pProgress.finishTime)) {
            setActiveRunningRoom(null);
            localStorage.removeItem('activeRoomId');
            localStorage.removeItem('currentRoomId');
            return;
          }

          setActiveRunningRoom(data);
        } else {
          setActiveRunningRoom(null);
          localStorage.removeItem('activeRoomId');
          localStorage.removeItem('currentRoomId');
        }
      } catch (err) {
        console.error('Error checking active room:', err);
      }
    };

    checkActive();
    const interval = setInterval(checkActive, 8000);
    return () => clearInterval(interval);
  }, [view, playerName, playerUsername]);

  // 1. معالجة حالة التحميل (Loading State) واستعادة الغرفة عند تحديث الصفحة (Reload)
  useEffect(() => {
    const isMultiplayerView = view === 'group_waiting' || view === 'group_game' || (view === 'challenge' && challengeMode !== 'daily');

    // إذا قام اللاعب بتحديث الصفحة (Reload) وكان في شاشة غرفة بدون تحميل بيانات الـ room
    if (isMultiplayerView && !room) {
      const savedRoomId = localStorage.getItem('activeRoomId');
      if (!savedRoomId) {
        // لا توجد غرفة محفوظة: لا تعرض أي تحدي عشوائي ووجه اللاعب للـ Lobby
        if (view === 'group_waiting' || view === 'group_game' || (view === 'challenge' && skillsType === null)) {
          toast.error('حدث خطأ في مزامنة الغرفة');
          setView('group_join');
        }
        return;
      }

      setIsRoomLoading(true);
      const playerIdParam = encodeURIComponent(playerUsername || playerName || '');

      fetch(`/api/1v1?action=poll&roomId=${savedRoomId}&playerId=${playerIdParam}`)
        .then(r => r.json())
        .then(data => {
          if (!data || data.error || data.message || data.status === 'CANCELLED' || data.status === 'EXPIRED') {
            localStorage.removeItem('activeRoomId');
            setRoom(null);
            setSkillsType(null);
            setIsRoomLoading(false);
            toast.error('حدث خطأ في مزامنة الغرفة');
            setView('group_join');
            return;
          }

          setRoom(data);

          // التحقق من نوع التحدي الحقيقي
          if (data.gameMode === 'WHO_AM_I' || data.challenge_type === 'who_am_i') {
            setIsRoomLoading(false);
            setView('group_game');
            return;
          }

          if (data.status === 'WAITING') {
            setIsRoomLoading(false);
            setView('group_waiting');
            return;
          }

          if (data.status === 'FINISHED') {
            setIsRoomLoading(false);
            setView('group_game');
            return;
          }

          // غرفة نشطة PLAYING
          const mapped = (data.challenges || []).map((q: any) => ({
            ...q,
            verseText: q.verseText || q.keyword || q.text
          }));
          setChallenges(mapped);
          setCurrentChallengeIndex(data.currentQuestionIndex || 0);

          const curQ = mapped[data.currentQuestionIndex || 0] || mapped[0];
          let detectedMode: 'audio' | 'complete' | 'surah' | null = null;
          if (curQ?.type === 'SURAH') detectedMode = 'surah';
          else if (curQ?.type === 'STANDARD' || curQ?.type === 'AUDIO') detectedMode = 'audio';
          else if (curQ?.type === 'COMPLETION' || curQ?.type === 'ISLAMIC') detectedMode = 'complete';
          else if (data.gameMode === 'SURAH') detectedMode = 'surah';
          else if (data.gameMode === 'STANDARD') detectedMode = 'audio';
          else if (data.gameMode === 'COMPLETION' || data.gameMode === 'ISLAMIC') detectedMode = 'complete';

          // فرض قيود لوحة الإدارة (Strict Admin Rules)
          if (!detectedMode) {
            localStorage.removeItem('activeRoomId');
            setRoom(null);
            setSkillsType(null);
            setIsRoomLoading(false);
            toast.error('حدث خطأ في مزامنة الغرفة');
            setView('group_join');
            return;
          }

          if (
            (detectedMode === 'audio' && systemSettings.hideAudioChallenge) ||
            (detectedMode === 'complete' && systemSettings.hideCompletionChallenge) ||
            (detectedMode === 'surah' && systemSettings.hideSurahChallenge)
          ) {
            localStorage.removeItem('activeRoomId');
            setRoom(null);
            setSkillsType(null);
            setIsRoomLoading(false);
            toast.error('تم تعطيل هذا التحدي من لوحة الإدارة');
            setView('group_join');
            return;
          }

          setSkillsType(detectedMode);
          setIsRoomLoading(false);
          setView('challenge');
        })
        .catch(err => {
          console.error('Room recovery failed:', err);
          localStorage.removeItem('activeRoomId');
          setRoom(null);
          setSkillsType(null);
          setIsRoomLoading(false);
          toast.error('حدث خطأ في مزامنة الغرفة');
          setView('group_join');
        });
    }
  }, [view, room, challengeMode, playerUsername, playerName, systemSettings]);

  // 4. معالجة انقطاع الاتصال (Reconnection UI & Supabase Channel Events)
  useEffect(() => {
    if (!room?.id) {
      setIsReconnecting(false);
      return;
    }

    const channel = supabase
      .channel(`room_sync_${room.id}`)
      .subscribe((status, err) => {
        if (err) console.warn('[Supabase Room Channel Error]:', err);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsReconnecting(true);
        } else if (status === 'SUBSCRIBED') {
          setIsReconnecting(false);
        }
      });

    const handleOffline = () => setIsReconnecting(true);
    const handleOnline = () => {
      setIsReconnecting(false);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [room?.id]);

  // Realtime Presence & Friend Invites Setup
  useEffect(() => {
    if (!playerName && !playerUsername) {
      friendsRealtimeService.stopPresence();
      return;
    }

    // Auto-fetch uniquePlayerId if not stored locally
    if (!uniquePlayerId) {
      const ident = playerUsername || playerName;
      fetch(`/api/player-score?username=${encodeURIComponent(ident || '')}&name=${encodeURIComponent(playerName || '')}`)
        .then(res => res.json())
        .then(p => {
          if (p?.uniquePlayerId) {
            setUniquePlayerId(p.uniquePlayerId);
            localStorage.setItem('quran_unique_player_id', p.uniquePlayerId);
          }
        })
        .catch(() => {});
    }

    // Start Presence tracking
    friendsRealtimeService.startPresence({
      uniquePlayerId,
      username: playerUsername,
      name: playerName,
      activeFrame: userAchievement
    });

    // Subscribe to incoming room invites
    const identifiers = [uniquePlayerId, playerUsername, playerName].filter(Boolean) as string[];
    const unsubscribeInvites = friendsRealtimeService.subscribeToInvites(
      identifiers,
      (invite) => {
        // Ignore invites sent by self
        const myName = (playerName || '').trim().toLowerCase();
        const myUser = (playerUsername || '').trim().toLowerCase().replace(/^@+/, '');
        const hostN = (invite.hostName || '').trim().toLowerCase();
        const hostU = (invite.hostUsername || '').trim().toLowerCase().replace(/^@+/, '');
        if ((hostN && hostN === myName) || (hostU && hostU === myUser)) {
          return;
        }
        setIncomingRoomInvite(invite);
      }
    );

    return () => {
      unsubscribeInvites();
    };
  }, [playerName, playerUsername, uniquePlayerId, userAchievement]);

  const handleAcceptRoomInvite = useCallback(async (roomOrInvite: any) => {
    setIncomingRoomInvite(null);
    if (!roomOrInvite) return;

    // If RoomInviteModal already completed the join and passed the room object:
    if (roomOrInvite.status && (roomOrInvite.id || roomOrInvite.room)) {
      setRoom(roomOrInvite.room || roomOrInvite);
      setView('group_waiting');
      return;
    }

    const roomId = roomOrInvite.roomId || roomOrInvite.id;
    if (!roomId) return;

    try {
      const token = localStorage.getItem('quran_admin_token') || localStorage.getItem('quran_auth_token') || '';
      const pId = uniquePlayerId || playerUsername || playerName || '';
      const pName = playerName || 'متسابق جديد';

      const res = await fetch('/api/1v1', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'join',
          roomId: roomId,
          id: roomId,
          player2Id: pId,
          playerName: pName,
          password: roomOrInvite.password,
          isInvite: true,
          invitedUserId: pId
        })
      });

      const data = await res.json();
      if (res.ok && (data.room || data.id)) {
        setRoom(data.room || data);
        setView('group_waiting');
      } else {
        let errorMsg = 'تعذر الانضمام للغرفة';
        if (res.status === 403) {
          errorMsg = 'غير مصرح لك بالدخول أو الدعوة غير صالحة';
        } else if (res.status === 404) {
          errorMsg = 'الغرفة غير موجودة';
        } else if (data.message || data.error) {
          errorMsg = data.message || data.error;
        }

        setToastMessage({
          id: String(Date.now()),
          type: 'error',
          message: errorMsg
        });
      }
    } catch (e: any) {
      console.error('Error accepting room invite:', e);
      setToastMessage({
        id: String(Date.now()),
        type: 'error',
        message: e?.status === 403
          ? 'غير مصرح لك بالدخول أو الدعوة غير صالحة'
          : e?.status === 404
          ? 'الغرفة غير موجودة'
          : (e?.message || 'غير مصرح لك بالدخول أو الدعوة غير صالحة')
      });
    }
  }, [playerUsername, playerName, uniquePlayerId]);

  const handleDeclineRoomInvite = useCallback(() => {
    setIncomingRoomInvite(null);
  }, []);

  const handleOpenPlayerProfile = useCallback((player: any) => {
    setSelectedProfilePlayer(player);
  }, []);

  const handleClosePlayerProfile = useCallback(() => {
    setSelectedProfilePlayer(null);
  }, []);

  const handleResumeActiveRoom = (targetRoom: any) => {
    if (!targetRoom) return;
    setRoom(targetRoom);

    // If room is WAITING, it's host's pending room - return to waiting room
    if (targetRoom.status === 'WAITING') {
      setView('group_waiting');
      setActiveRunningRoom(null);
      toast.success('تمت العودة لقاعة انتظار الغرفة كمضيف 👑');
      return;
    }

    const mapped = (targetRoom.challenges || []).map((q: any) => ({
      ...q,
      verseText: q.verseText || q.keyword || q.text
    }));
    setChallenges(mapped);
    setChallengesLoading(false);

    // Notify server of rejoining presence
    fetch('/api/1v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'presence',
        roomId: targetRoom.id,
        playerId: playerUsername || playerName,
        isOnline: true
      })
    }).catch(err => console.error('Error sending presence on resume:', err));

    const pIdStr = String(targetRoom.participants?.find((p: any) => p.name === playerName || p.username === playerUsername)?.id);
    const myProg = targetRoom.playersProgress?.[pIdStr] || {};

    if (targetRoom.transitionMode === 'ASYNC') {
      // In ASYNC mode: resume from exact question where this player left off
      const resumeIndex = myProg.playerCurrentQuestionIndex ?? 0;
      setCurrentChallengeIndex(Math.min(resumeIndex, Math.max(0, (mapped.length || 1) - 1)));
    } else {
      // In SYNC mode: sync directly to the room's current active question index
      setCurrentChallengeIndex(targetRoom.currentQuestionIndex || 0);
    }

    setHasAnsweredCurrentQuestion(false);
    setSkillsFeedback(false);
    setSelectedOption(null);
    setMatchedIds(new Set());
    setSurahFeedbackData(null);

    const roomTime = (targetRoom.timePerQuestion && targetRoom.timePerQuestion > 0) ? targetRoom.timePerQuestion : 0;
    if (roomTime > 0) {
      setSpeedTimeLeft(roomTime);
    }

    const curQ = mapped[targetRoom.currentQuestionIndex || 0];
    if (curQ) {
      const mode = curQ.type === 'SURAH' ? 'surah' : (curQ.type === 'STANDARD' || curQ.type === 'AUDIO') ? 'audio' : 'complete';
      if (
        (mode === 'audio' && systemSettings.hideAudioChallenge) ||
        (mode === 'complete' && systemSettings.hideCompletionChallenge) ||
        (mode === 'surah' && systemSettings.hideSurahChallenge)
      ) {
        toast.error('تم تعطيل هذا التحدي في إعدادات التطبيق');
        setActiveRunningRoom(null);
        setView('group_join');
        return;
      }
      setSkillsType(mode);
    }

    setActiveRunningRoom(null);
    setView('challenge');
  };

  const isRoomLeader = Boolean(
    room && (
      (room.player1Id && (room.player1Id === playerUsername || room.player1Id === playerName)) ||
      (room.player1 && (room.player1.username === playerUsername || room.player1.name === playerName || room.player1.id === playerUsername || room.player1.id === playerName)) ||
      (room.hostName && playerName && room.hostName === playerName) ||
      (room.hostUsername && playerUsername && room.hostUsername.toLowerCase() === playerUsername.toLowerCase()) ||
      (room.created_by && (room.created_by === playerUsername || room.created_by === playerName))
    )
  );

  const handleCancelRoomByHost = () => {
    if (!room?.id) return;
    setIsCancelRoomModalOpen(true);
  };

  const confirmCancelRoomByHost = async () => {
    if (!room?.id) {
      setIsCancelRoomModalOpen(false);
      return;
    }

    setIsRoomActionLoading(true);
    const roomId = String(room.id);

    try {
      // 1. Delete from Supabase rooms, room_participants, and who_am_i tables
      try {
        await Promise.allSettled([
          supabase.from('who_am_i_submissions').delete().eq('room_id', roomId),
          supabase.from('who_am_i_answers').delete().eq('room_id', roomId),
          supabase.from('who_am_i_rounds').delete().eq('room_id', roomId),
          supabase.from('room_participants').delete().eq('room_id', roomId),
          supabase.from('rooms').delete().eq('id', roomId),
          supabase.from('Room').delete().eq('id', roomId)
        ]);
      } catch (sbErr) {
        console.warn('[Supabase cancel-room cleanup warn]:', sbErr);
      }

      // 2. Call /api/1v1 with cancel-room
      try {
        const res = await fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel-room',
            roomId: roomId,
            playerId: playerUsername || playerName
          })
        });
        const data = await res.json();
        if (!res.ok && res.status !== 404) {
          console.warn('[API cancel-room non-200]:', data);
        }
      } catch (apiErr) {
        console.warn('[API cancel-room fetch warn]:', apiErr);
      }

      // 3. Reset local storage & state
      try {
        localStorage.removeItem('activeRoomId');
        localStorage.removeItem('currentRoomId');
      } catch (e) { }

      setActiveRunningRoom(null);
      setRoom(null);
      setIsCancelRoomModalOpen(false);
      setView('group_join');
      toast.success('تم إلغاء الغرفة بنجاح');
    } catch (err: any) {
      console.error('Error cancelling room:', err);
      toast.error('حدث خطأ أثناء إلغاء الغرفة');
    } finally {
      setIsRoomActionLoading(false);
    }
  };

  const syncGroupProgress = async (isFinished = false, forcedScore?: number) => {
    if (!room?.id) return;
    const progress = ((currentChallengeIndex + (isFinished ? 1 : 0)) / (challenges.length || 5)) * 100;
    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-progress',
          roomId: room.id,
          playerId: playerUsername || playerName,
          progress,
          score: forcedScore !== undefined ? forcedScore : sessionCorrect,
          isFinished
        })
      });
      const data = await res.json();
      if (res.ok) setRoom(data);
    } catch (err) {
      console.error('Group sync error:', err);
    }
  };

  const handleWithdraw = async () => {
    if (!room?.id) {
      setIsResignModalOpen(false);
      return;
    }

    setIsRoomActionLoading(true);
    const roomId = String(room.id);
    const currentUserId = playerUsername || playerName;

    try {
      // 1. Delete player from Supabase room_participants and submissions
      try {
        if (currentUserId) {
          await Promise.allSettled([
            supabase.from('room_participants').delete().match({ room_id: roomId, user_id: currentUserId }),
            supabase.from('room_participants').delete().match({ room_id: roomId, name: currentUserId }),
            supabase.from('who_am_i_submissions').delete().match({ room_id: roomId, user_id: currentUserId }),
            supabase.from('who_am_i_answers').delete().match({ room_id: roomId, user_id: currentUserId })
          ]);
        }
      } catch (sbErr) {
        console.warn('[Supabase withdraw cleanup warn]:', sbErr);
      }

      // 2. Call /api/1v1 with resign action
      try {
        const res = await fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resign',
            roomId: roomId,
            playerId: currentUserId
          })
        });
        const data = await res.json();
        if (!res.ok && res.status !== 404) {
          console.warn('[API resign non-200]:', data);
        }
      } catch (apiErr) {
        console.warn('[API resign fetch warn]:', apiErr);
      }

      // 3. Reset local storage & state
      try {
        localStorage.removeItem('activeRoomId');
        localStorage.removeItem('currentRoomId');
      } catch (e) { }

      setActiveRunningRoom(null);
      setSessionCorrect(0);
      setRoom(null);
      setIsResignModalOpen(false);
      setView('group_join');
      toast.success('تم الانسحاب من الغرفة بنجاح');
    } catch (err: any) {
      console.error('Error withdrawing from room:', err);
      toast.error('حدث خطأ أثناء الانسحاب من الغرفة');
    } finally {
      setIsRoomActionLoading(false);
    }
  };

  const handleResignGroupChallenge = handleWithdraw;
  // Speed & Multiplayer Timer
  useEffect(() => {
    let interval: any;
    const hasRoomTimer = !!(room && (room.timePerQuestion || 0) > 0);
    const isActive = room
      ? (view === 'challenge' && hasRoomTimer && !isComplete && room.status === 'PLAYING')
      : ((view === 'speed_challenge' || (view === 'challenge' && isSpeedMode)) && !isSpeedGameOver && !isComplete && !skillsFeedback);

    if (isActive && !isFreezeActive) {
      interval = setInterval(() => {
        setSpeedTimeLeft((prev) => {
          if (prev <= 1) {
            if (room) {
              handleRoomTimeout();
            } else if (view === 'speed_challenge') {
              setIsSpeedGameOver(true);
            } else {
              handleSpeedTimeout();
            }
            stopListening();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, isSpeedGameOver, isComplete, isSpeedMode, stopListening, skillsFeedback, isFreezeActive, room?.timePerQuestion, room?.id, room?.status, currentChallengeIndex]);

  // Freeze Time local 10-second countdown
  useEffect(() => {
    if (!isFreezeActive || freezeSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setFreezeSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsFreezeActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFreezeActive, freezeSecondsLeft]);

  // Reset power-ups usage and freeze when advancing to a new question
  useEffect(() => {
    setIsFreezeActive(false);
    setFreezeSecondsLeft(0);
    setIsPowerUpUsedThisQuestion(false);
    setEliminatedOptionIndices([]);
  }, [currentChallengeIndex, currentChallenge?.id]);

  const handleExecuteFreezeTime = () => {
    if (isPowerUpUsedThisQuestion) {
      toast.error('يمكنك استخدام مساعدة واحدة فقط في هذا السؤال');
      return;
    }
    if (freezeTimeCount <= 0) {
      toast.error('رصيدك من تجميد الوقت نفد!');
      return;
    }
    setFreezeTimeCount(prev => {
      const next = Math.max(0, prev - 1);
      localStorage.setItem('quran_freeze_count', next.toString());
      return next;
    });
    setIsFreezeActive(true);
    setFreezeSecondsLeft(10);
    setIsPowerUpUsedThisQuestion(true);
    toast.success('تم تجميد الوقت لمدة 10 ثوانٍ! 🧊');
  };

  const handleExecuteDeleteTwo = () => {
    if (isPowerUpUsedThisQuestion) {
      toast.error('يمكنك استخدام مساعدة واحدة فقط في هذا السؤال');
      return;
    }
    if (deleteTwoCount <= 0) {
      toast.error('رصيدك من حذف الإجابات نفد!');
      return;
    }
    const currentOpts = skillsOptions || currentChallenge?.options || [];
    if (!Array.isArray(currentOpts) || currentOpts.length <= 2) {
      toast.error('لا يمكن حذف إجابات لهذا السؤال');
      return;
    }

    const rawCorrect = currentChallenge?.correctText || skillsCorrectAnswer || "";
    let correctIdx = -1;
    currentOpts.forEach((o: any, idx: number) => {
      if (o.isCorrect || (rawCorrect && superNormalizeArabic(typeof o === 'object' ? o.text : o) === superNormalizeArabic(rawCorrect))) {
        correctIdx = idx;
      }
    });

    const wrongIndices: number[] = [];
    currentOpts.forEach((_, idx) => {
      if (idx !== correctIdx) wrongIndices.push(idx);
    });

    wrongIndices.sort(() => Math.random() - 0.5);
    const toEliminate = wrongIndices.slice(0, 2);

    setEliminatedOptionIndices(toEliminate);
    setDeleteTwoCount(prev => {
      const next = Math.max(0, prev - 1);
      localStorage.setItem('quran_delete_two_count', next.toString());
      return next;
    });
    setIsPowerUpUsedThisQuestion(true);
    toast.success('تم حذف إجابتين خاطئتين! ✂️');
  };

  // Reset Speed timer on each match
  useEffect(() => {
    if (view === 'speed_challenge' && !isSpeedGameOver && matchedIds.size > 0 && !isComplete) {
      const qDuration = getSpeedQuestionDuration(currentChallenge);
      const timeTaken = Math.max(0, qDuration - speedTimeLeft);
      setSpeedTotalTimeSpent(prev => prev + timeTaken);
      setSpeedTimeLeft(qDuration);
    }
  }, [matchedIds.size, view, isSpeedGameOver, isComplete, currentChallenge]);

  // Effect to handle Surah Name Challenge inputs initialization
  useEffect(() => {
    const isSurahMode = skillsType === 'surah' || (view === 'group_game' && roomGameMode === 'surah');
    if (currentChallenge && isSurahMode) {
      const text = currentChallenge.correctText || "";
      let surahs: string[] = [];
      try {
        if (text.startsWith("[")) {
          surahs = JSON.parse(text);
        } else if (text) {
          surahs = [text];
        } else {
          // Fallback to first verse surah if any
          const firstVerseSurah = currentChallenge.verses?.[0]?.surah;
          if (firstVerseSurah) surahs = [firstVerseSurah];
        }
      } catch (e) {
        if (text) surahs = [text];
      }

      const validSurahs = surahs.filter(s => s.trim());
      // Initialize with correct number of empty strings
      setSurahInputs(new Array(Math.max(1, validSurahs.length)).fill(''));
    }
  }, [currentChallenge, skillsType, room?.gameMode, view]);

  // Handle Speed Challenge progression
  useEffect(() => {
    if (view === 'speed_challenge' && isComplete && !isSpeedGameOver) {
      const qDuration = getSpeedQuestionDuration(currentChallenge);
      const timeTaken = Math.max(0, qDuration - speedTimeLeft);
      setSpeedTotalTimeSpent(prev => prev + timeTaken);

      const timer = setTimeout(() => {
        const nextIdx = Math.floor(Math.random() * challenges.length);
        setCurrentChallengeIndex(nextIdx);
        setSpeedTimeLeft(getSpeedQuestionDuration(challenges[nextIdx]));
        setMatchedIds(new Set());
        setWordStates({});
        resetTranscript();
        setSpeedStartTime(Date.now());
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, view, isSpeedGameOver, challenges.length, speedTimeLeft, resetTranscript, currentChallenge]);

  // Effect to lock body scroll when modal is open
  useEffect(() => {
    if (selectedHadith || isSettingsOpen || showScores) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedHadith, isSettingsOpen, showScores]);

  const [showTafsirModal, setShowTafsirModal] = useState(false);
  const [tafsirData, setTafsirData] = useState('جاري تحميل التفسير من الخادم...');
  const [tafsirAyahText, setTafsirAyahText] = useState('');
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number | null>(null);
  const [currentAyahNumber, setCurrentAyahNumber] = useState<number | null>(null);

  useEffect(() => {
    if (showTafsirModal && currentSurahNumber && currentAyahNumber) {
      const fetchTafsir = async () => {
        try {
          // جلب التفسير الميسر ( Muyassar) لضمان الدقة وعدم تكرار الآية
          const res = await fetch(`https://api.alquran.cloud/v1/ayah/${currentSurahNumber}:${currentAyahNumber}/ar.muyassar`);
          const json = await res.json();
          if (json.code === 200) {
            setTafsirData(json.data.text);
          }
        } catch (err) {
          setTafsirData('حدث خطأ في جلب التفسير. يرجى المحاولة لاحقاً.');
        }
      };
      fetchTafsir();
    }
  }, [showTafsirModal, currentSurahNumber, currentAyahNumber]);

  const handleOpenTafsir = (surah: number, ayah: number, ayahText: string) => {
    setCurrentSurahNumber(surah);
    setCurrentAyahNumber(ayah);
    setTafsirAyahText(ayahText);
    setTafsirData('جاري تحميل التفسير من الخادم...');
    setShowTafsirModal(true);
  };

  const handleStartDaily = () => {
    if (dailyCompleted) return;
    setDailyChallengeOffset(0);
    setChallengeMode('daily');
    setSkillsType('complete');
    setSelectedOption(null);
    setSkillsFeedback(false);
    setView('challenge');

    // Save as incomplete if not finished
    const activeDaily = completionChallenges.length > 0
      ? completionChallenges[dailyChallengeIndex % completionChallenges.length]
      : challenges[dailyChallengeIndex];
    const firstVerse = activeDaily?.verses?.[0];
    const info = { index: dailyChallengeIndex, mode: 'daily' as const, surah: firstVerse?.surah || activeDaily?.keyword || '' };
    setIncompleteChallenge(info);
    localStorage.setItem('quran_incomplete_challenge', JSON.stringify(info));
  };

  const handleStartNormal = () => {
    setChallengeMode('normal');
    setView('list'); // Show all challenges to pick from
  };

  const handleStartSpeedChallenge = () => {
    setChallengeMode('normal');
    const randomIdx = Math.floor(Math.random() * Math.min(challenges.length, 50));
    setCurrentChallengeIndex(randomIdx);
    setView('speed_challenge');
    setSpeedTimeLeft(getSpeedQuestionDuration(challenges[randomIdx]));
    setSpeedTotalTimeSpent(0);
    setIsSpeedGameOver(false);
    setSpeedStartTime(Date.now());
    resetTranscript();
    startListening();
  };

  const handleSelectDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
    localStorage.setItem('quran_game_difficulty', diff);
    setView('challenge');

    // Save as incomplete
    const firstVerse = challenges[currentChallengeIndex]?.verses?.[0];
    const info = { index: currentChallengeIndex, mode: 'normal' as const, surah: firstVerse?.surah || '' };
    setIncompleteChallenge(info);
    localStorage.setItem('quran_incomplete_challenge', JSON.stringify(info));
  };

  const generateOptions = useCallback((type: 'complete' | 'surah', correctValue: string) => {
    if (type === 'surah') return;
    if (!currentChallenge) return;
    let rawOptions: string[] = [];

    if (currentChallenge?.options && Array.isArray(currentChallenge.options)) {
      rawOptions = [...currentChallenge.options];
    } else {
      // Fallback
      rawOptions = [correctValue];
      const words = ["يؤمنون", "يتقون", "يعلمون", "يفلحون", "يبصرون", "يسمعون", "يشعرون", "ينصرون", "تعلمون", "تعملون"];
      for (let i = 0; i < 3; i++) {
        const rand = words[Math.floor(Math.random() * words.length)];
        if (rand && !rawOptions.includes(rand)) rawOptions.push(rand);
        else i--;
      }
    }

    // Convert to objects and flag the correct one using Identity or Aggressive Normalization
    const normalizedCorrect = superNormalizeArabic(correctValue);
    const mappedOptions = rawOptions.filter((opt): opt is NonNullable<typeof opt> => opt !== null).map(opt => {
      // 1. Check if option is already an identity-based object from DB
      if (typeof opt === 'object' && (opt as any) !== null && 'isCorrect' in (opt as any)) {
        const o = opt as { text: string; isCorrect: boolean };
        return {
          text: o.text,
          isCorrect: !!o.isCorrect
        };
      }

      // 2. Legacy Fallback: Use Aggressive Normalization for string options
      const optText = typeof opt === 'string' ? opt : ((opt as any).text || '');
      const isCorrect = superNormalizeArabic(optText) === normalizedCorrect;

      // Keep debug logs for any cases that rely on text comparison
      if (isCorrect || superNormalizeArabic(optText).length > 0) {
        console.log('--- DEBUG MATCH (Legacy Fallback) ---');
        console.log('Selected Raw:', optText, 'Type:', typeof optText);
        console.log('Correct Raw:', correctValue, 'Type:', typeof correctValue);
        console.log('Selected Clean:', superNormalizeArabic(optText));
        console.log('Correct Clean:', normalizedCorrect);
        console.log('MATCH RESULT:', isCorrect);
      }

      return {
        text: optText,
        isCorrect: isCorrect
      };
    });

    const shuffled = [...mappedOptions].sort(() => Math.random() - 0.5);
    setSkillsOptions(shuffled);
    setSkillsCorrectAnswer(correctValue);
  }, [currentChallenge?.id || currentChallenge?.keyword]);

  const handleSpeedTimeout = () => {
    if (room?.id) {
      handleRoomTimeout();
      return;
    }
    if (skillsFeedback || isComplete) return;

    const isSurah = skillsType === 'surah' || (room && roomGameMode === 'surah');
    const isAudio = skillsType === 'audio' || (room && roomGameMode === 'audio');

    if (isSurah) {
      handleSubmitSurah();
    } else if (isAudio) {
      const currentQuestion = currentChallenge;
      if (!currentQuestion) return;
      setSkillsFeedback(true);
      setTimeout(() => {
        moveToNextQuestion();
      }, 1000);
    } else {
      handleConfirmAnswer();
    }
  };

  const moveToNextQuestion = () => {
    setSkillsFeedback(false);
    setSelectedOption(null);
    setSurahFeedbackData(null);

    const challengesLength = challenges.length || room?.challenges?.length || 0;

    if (currentChallengeIndex >= challengesLength - 1) {
      if (room) {
        syncGroupProgress(true);
      }
      if (view === 'challenge') {
        if (room) {
          setView('group_game'); // Show leaderboard at end
        } else {
          // Requirement 4: Cups are earned strictly in group rooms, not solo sessions
          setView('skills_results');
        }
      }
      return;
    }

    if (room) {
      syncGroupProgress(false);
    }

    setCurrentChallengeIndex(prev => prev + 1);
    setSessionCurrentIndex(prev => prev + 1);
    setMatchedIds(new Set());
    setWordStates({});
    const isAudio = skillsType === 'audio' || roomGameMode === 'audio';
    const roomTime = (room && (room.timePerQuestion || 0) > 0) ? room.timePerQuestion : 0;
    const nextQ = challenges[currentChallengeIndex + 1];
    if (room && nextQ?.type) {
      const nextMode = nextQ.type === 'SURAH' ? 'surah' : (nextQ.type === 'STANDARD' || nextQ.type === 'AUDIO') ? 'audio' : 'complete';
      setSkillsType(nextMode);
    }
    const nextTime = isSpeedMode ? getSpeedQuestionDuration(nextQ) : (isAudio ? 30 : 15);
    setSpeedTimeLeft(roomTime > 0 ? roomTime : nextTime);
    resetTranscript();
  };

  const handleOptionSelect = (option: any) => {
    if (skillsFeedback) return;
    setSelectedOption(option);
  };

  const handleConfirmAnswerWithOption = (option: any) => {
    setSelectedOption(option);
    handleConfirmAnswer();
  };

  const handleConfirmAnswer = () => {
    try {
      if (skillsFeedback) return;
      setSkillsFeedback(true);

      const currentQuestion = currentChallenge;
      if (!currentQuestion) {
        setSkillsFeedback(false);
        return;
      }

      const rawSelected = selectedOption ? (typeof selectedOption === 'object' ? selectedOption.text : selectedOption) : null;
      let rawCorrect = currentQuestion.correctText || "";
      if (!rawCorrect && skillsOptions && Array.isArray(skillsOptions)) {
        const correctOpt = skillsOptions.find(o => o.isCorrect);
        if (correctOpt) rawCorrect = correctOpt.text;
      }
      if (!rawCorrect && currentQuestion.options && Array.isArray(currentQuestion.options)) {
        const correctOpt = currentQuestion.options.find((o: any) => o.isCorrect);
        if (correctOpt) rawCorrect = typeof correctOpt === 'object' ? correctOpt.text : correctOpt;
      }

      const isObjectCorrect = selectedOption && typeof selectedOption === 'object' && selectedOption.isCorrect === true;
      const isTextMatch = !!(
        (rawSelected && rawCorrect && superNormalizeArabic(rawSelected) === superNormalizeArabic(rawCorrect)) ||
        (rawSelected && rawCorrect && String(rawSelected).trim().includes(String(rawCorrect).trim()))
      );

      const isCorrect = isObjectCorrect || isTextMatch;
      const answer = rawSelected || "لم يتم اختيار إجابة (انتهى الوقت)";

      if (isCorrect) {
        setSessionCorrect(prev => prev + 1);

        // توحيد منح النقاط: نقطة واحدة فقط (+1) عبر الدالة المركزية
        addPoint({ challengeId: currentQuestion?.id, roomId: room?.id });

        if (view === 'group_game') {
          syncGroupProgress(false, sessionCorrect + 1);
        }
        if (window.navigator.vibrate) window.navigator.vibrate(50);

        if ((view === 'group_game' || challengeMode === 'daily') && (targetVerses.length > 0 || currentQuestion.verses)) {
          const allVerseIds = targetVerses.length > 0
            ? targetVerses.map((v: any) => v.id)
            : currentQuestion.verses.map((v: any) => v.id);
          setMatchedIds(new Set(allVerseIds));
        }

        if (currentQuestion?.id) {
          setCompletedChallengeIds(prev => {
            const next = new Set(prev);
            next.add(currentQuestion.id);
            localStorage.setItem('quran_completed_ids', JSON.stringify(Array.from(next)));
            localStorage.setItem('quran_completed_challenges', JSON.stringify(Array.from(next)));
            return next;
          });
        }

        if (challengeMode === 'daily') {
          // Requirement 2: Trigger central streak increment immediately upon solving daily question
          incrementStreak();
          setSkillsFeedback(true);
          setTimeout(() => {
            setSkillsFeedback(false);
            setChallengeMode('normal');
            setView('home');
          }, 2000);
          return;
        }
      } else {
        setSessionWrong(prev => prev + 1);
        if (window.navigator.vibrate) window.navigator.vibrate(200);
        setSessionMistakes(prev => [...prev, {
          challenge: currentQuestion,
          keyword: currentQuestion.keyword || currentQuestion.verseText || currentQuestion.text || "",
          userAnswer: answer || "لا يوجد إجابة",
          correctAnswer: rawCorrect,
          correctText: rawCorrect,
          type: currentQuestion.type || 'COMPLETION',
          isFullyCorrect: false,
          pointsEarned: 0,
          totalPossible: 1
        }]);

        if (challengeMode === 'daily') {
          setTimeout(() => {
            setSkillsFeedback(false);
            setSelectedOption(null);
            setDailyChallengeOffset(prev => prev + 1);
            toast.error('إجابة غير صحيحة! تم استبدال السؤال بتحدٍ جديد، حاول مجدداً', { duration: 3000 });
          }, 1200);
          return;
        }
      }

      if (room?.id) {
        if (room.transitionMode === 'ASYNC') {
          fetch('/api/1v1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'submit-answer',
              roomId: room.id,
              playerId: playerUsername || playerName,
              questionIndex: currentChallengeIndex,
              isCorrect,
              timestamp: Date.now()
            })
          }).then(res => res.json()).then(data => {
            if (data && data.status) {
              setRoom(data);
              if (data.status === 'FINISHED') {
                recordDailyGiftRoomMatch();
                setView('group_game');
              }
            }
          }).catch(err => console.error('Error submitting ASYNC room answer:', err));

          const advanceDelay = isCorrect ? 900 : 1500;
          setTimeout(() => {
            moveToNextQuestion();
          }, advanceDelay);
          return;
        }

        setHasAnsweredCurrentQuestion(true);
        fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit-answer',
            roomId: room.id,
            playerId: playerUsername || playerName,
            questionIndex: room.currentQuestionIndex ?? currentChallengeIndex,
            isCorrect,
            timestamp: Date.now()
          })
        }).then(res => res.json()).then(data => {
          if (data && data.status) {
            setRoom(data);
            if (data.status === 'FINISHED') {
              recordDailyGiftRoomMatch();
              setView('group_game');
            } else if (data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
              resetQuestionUIState(data.currentQuestionIndex, data);
            }
          }
        }).catch(err => console.error('Error submitting room answer:', err));
        return;
      }

      const advanceDelay = isCorrect ? 1000 : 2500;
      setTimeout(() => {
        moveToNextQuestion();
      }, advanceDelay);
    } catch (error) {
      console.error('handleConfirmAnswer Error:', error);
      setSkillsFeedback(false);
    }
  };

  const handleSubmitSurah = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentQuestion = currentChallenge;
    if (!currentQuestion || skillsFeedback) return;

    setSkillsFeedback(true);

    // 1. Determine all correct surahs
    const text = currentQuestion.correctText || "";
    let correctSurahs: string[] = [];
    try {
      if (text.startsWith("[")) {
        correctSurahs = JSON.parse(text);
      } else if (text) {
        correctSurahs = [text];
      } else {
        const firstVerseSurah = currentQuestion.verses?.[0]?.surah || (targetVerses && targetVerses[0]?.surah);
        if (firstVerseSurah) correctSurahs = [firstVerseSurah];
      }
    } catch (e) {
      if (text) correctSurahs = [text];
    }
    correctSurahs = correctSurahs.filter(s => s.trim());

    // 2. Normalize and check matches
    const normalizedCorrect = correctSurahs.map(s => normalizeArabicText(s).trim());
    const normalizedInputs = surahInputs.map(s => normalizeArabicText(s).trim());

    let correctCount = 0;
    const matchedCorrectIndices = new Set<number>();

    normalizedInputs.forEach(input => {
      if (!input) return;
      const matchIndex = normalizedCorrect.findIndex((correct, idx) => correct === input && !matchedCorrectIndices.has(idx));
      if (matchIndex !== -1) {
        correctCount++;
        matchedCorrectIndices.add(matchIndex);
      }
    });

    const isFullyCorrect = correctCount === normalizedCorrect.length && normalizedInputs.length === normalizedCorrect.length;

    if (isFullyCorrect) {
      setSessionCorrect(prev => prev + 1);

      // توحيد منح النقاط: نقطة واحدة فقط (+1) عبر الدالة المركزية
      addPoint({ challengeId: currentQuestion?.id, roomId: room?.id });

      if (view === 'group_game') {
        syncGroupProgress(false, sessionCorrect + 1);
      }
      if (view === 'group_game' && currentQuestion.verses) {
        const allVerseIds = currentQuestion.verses.map((v: any) => v.id);
        setMatchedIds(new Set(allVerseIds));
      }
    } else {
      setSessionWrong(prev => prev + 1);
    }

    setSurahFeedbackData({
      isFullyCorrect,
      correctSurahs
    });

    setSessionMistakes(prev => [...prev, {
      challenge: currentQuestion,
      text: currentQuestion.keyword || "",
      keyword: currentQuestion.keyword || "",
      type: 'SURAH',
      userInputs: [...surahInputs],
      correctSurahsList: correctSurahs,
      pointsEarned: correctCount,
      totalPossible: correctSurahs.length,
      isFullyCorrect
    }]);

    if (challengeMode === 'daily') {
      if (isFullyCorrect) {
        setSkillsFeedback(false);
      } else {
        setTimeout(() => {
          setSkillsFeedback(false);
          setSurahFeedbackData(null);
          setDailyChallengeOffset(prev => prev + 1);
          toast.error('إجابة غير صحيحة! تم استبدال السؤال بتحدٍ جديد، حاول مجدداً', { duration: 3000 });
        }, 1200);
      }
      return;
    }

    // 4. Auto-advance in single-player, or submit in multiplayer
    if (room?.id) {
      if (room.transitionMode === 'ASYNC') {
        fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit-answer',
            roomId: room.id,
            playerId: playerUsername || playerName,
            questionIndex: currentChallengeIndex,
            isCorrect: isFullyCorrect,
            timestamp: Date.now()
          })
        }).then(res => res.json()).then(data => {
          if (data && data.status) {
            setRoom(data);
            if (data.status === 'FINISHED') {
              recordDailyGiftRoomMatch();
              setView('group_game');
            }
          }
        }).catch(err => console.error('Error submitting room surah answer:', err));

        const advanceDelay = isFullyCorrect ? 900 : 1800;
        setTimeout(() => {
          moveToNextQuestion();
        }, advanceDelay);
        return;
      }

      setHasAnsweredCurrentQuestion(true);
      fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-answer',
          roomId: room.id,
          playerId: playerUsername || playerName,
          questionIndex: room.currentQuestionIndex ?? currentChallengeIndex,
          isCorrect: isFullyCorrect,
          timestamp: Date.now()
        })
      }).then(res => res.json()).then(data => {
        if (data && data.status) {
          setRoom(data);
          if (data.status === 'FINISHED') {
            recordDailyGiftRoomMatch();
            setView('group_game');
          } else if (data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
            resetQuestionUIState(data.currentQuestionIndex, data);
          }
        }
      }).catch(err => console.error('Error submitting room surah answer:', err));
      return;
    }

    const advanceDelay = isFullyCorrect ? 1000 : 2500;
    setTimeout(() => {
      moveToNextQuestion();
    }, advanceDelay);
  };

  const handleBackToHome = () => {
    if (view === 'challenge' && !isComplete) {
      setIsExitModalOpen(true);
      return;
    }
    setView('home');
    setShowScores(false);
    resetTranscript();
    stopListening();
    if (allChallenges.length > 0) {
      setChallenges(allChallenges);
    }
  };

  const confirmExitToHome = () => {
    setView('home');
    setShowScores(false);
    resetTranscript();
    stopListening();
    setIncompleteChallenge(null);
    localStorage.removeItem('quran_incomplete_challenge');
    if (allChallenges.length > 0) {
      setChallenges(allChallenges);
    }
  };

  const handleSkip = () => {
    if (challengeMode === 'daily' || hasAnsweredCurrentQuestion) return;

    // Count as mistake as requested
    const currentQuestion = currentChallenge;
    if (currentQuestion) {
      setSessionWrong(prev => prev + 1);
      let rawCorrect = currentQuestion.correctText || "";
      if (!rawCorrect && skillsOptions && Array.isArray(skillsOptions)) {
        const correctOpt = skillsOptions.find(o => o.isCorrect);
        if (correctOpt) rawCorrect = correctOpt.text;
      }
      setSessionMistakes(prev => [...prev, {
        challenge: currentQuestion,
        keyword: currentQuestion.keyword || currentQuestion.verseText || currentQuestion.text || "",
        userAnswer: "تخطي السؤال",
        correctAnswer: rawCorrect,
        correctText: rawCorrect,
        type: currentQuestion.type || (skillsType === 'complete' ? 'COMPLETION' : skillsType === 'surah' ? 'SURAH' : 'STANDARD'),
        isFullyCorrect: false,
        pointsEarned: 0,
        totalPossible: 1
      }]);
    }

    // 1. Room Multiplayer Handling
    if (room?.id) {
      if (room.transitionMode === 'ASYNC') {
        // ASYNC MODE: submit answer as incorrect and advance locally immediately
        fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit-answer',
            roomId: room.id,
            playerId: playerUsername || playerName,
            questionIndex: currentChallengeIndex,
            isCorrect: false,
            timestamp: Date.now()
          })
        }).then(res => res.json()).then(data => {
          if (data && data.status) {
            setRoom(data);
            if (data.status === 'FINISHED') {
              recordDailyGiftRoomMatch();
              setView('group_game');
            }
          }
        }).catch(err => console.error('Error submitting ASYNC skip:', err));

        moveToNextQuestion();
        return;
      }

      // SYNC MODE (SYNCHRONOUS):
      // A. Submit answer as incorrect (0 points) to server
      setHasAnsweredCurrentQuestion(true);
      setSkillsFeedback(true);
      fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-answer',
          roomId: room.id,
          playerId: playerUsername || playerName,
          questionIndex: room.currentQuestionIndex ?? currentChallengeIndex,
          isCorrect: false,
          timestamp: Date.now()
        })
      }).then(res => res.json()).then(data => {
        if (data && data.status) {
          setRoom(data);
          if (data.status === 'FINISHED') {
            recordDailyGiftRoomMatch();
            setView('group_game');
          } else if (data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
            resetQuestionUIState(data.currentQuestionIndex, data);
          }
        }
      }).catch(err => console.error('Error submitting SYNC skip:', err));

      // B. Do NOT call moveToNextQuestion() locally; wait for room sync / listener
      return;
    }

    // Normal Single-player mode:
    moveToNextQuestion();
  };

  const syncLeaderboard = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 1. Proactive sync of achievement flags before fetching rankings
      if (playerUsername || playerName) {
        const hasSeerah = userCertificates.some(c => c.category === 'seerah') ||
          (Boolean(localStorage.getItem('quran_quiz_progress_seerah')) && (() => {
            try {
              const p = JSON.parse(localStorage.getItem('quran_quiz_progress_seerah') || '{}');
              return (p.easy >= 3 || p.hard >= 3);
            } catch { return false; }
          })());
        const hasGeneral = userCertificates.some(c => c.category === 'general') ||
          (Boolean(localStorage.getItem('quran_quiz_progress_general')) && (() => {
            try {
              const p = JSON.parse(localStorage.getItem('quran_quiz_progress_general') || '{}');
              return (p.easy >= 5 || p.hard >= 5);
            } catch { return false; }
          })());
        const storedFrame = localStorage.getItem('quran_active_frame') || activeFrame;
        // Requirement 1: If user chose "no frame" (null or 'none'), preserve null and do NOT force seerah/general
        const effectiveFrame = (storedFrame === 'seerah' || storedFrame === 'general')
          ? storedFrame
          : null;

        try {
          const scoreRes = await fetch('/api/player-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: playerName,
              username: playerUsername,
              score: totalPoints,
              totalPoints: totalPoints,
              totalCups: cups,
              trophiesCount: cups,
              streak: streak,
              streakCount: streak,
              seerahCompleted: hasSeerah,
              generalCompleted: hasGeneral,
              activeFrame: effectiveFrame
            })
          });
          if (scoreRes.ok) {
            const pData = await scoreRes.json();
            if (pData) {
              if (typeof pData.cups === 'number' && pData.cups > 0) {
                setCups(prev => {
                  const best = Math.max(prev, pData.cups);
                  localStorage.setItem('quran_total_cups', best.toString());
                  localStorage.setItem('quran_cups', best.toString());
                  return best;
                });
              }
              if (typeof pData.points === 'number' && pData.points > 0) {
                setTotalPoints(prev => {
                  const best = Math.max(prev, pData.points);
                  localStorage.setItem('quran_total_points', best.toString());
                  return best;
                });
              }
              if (typeof pData.streak === 'number' && pData.streak > 0) {
                setStreak(prev => {
                  const best = Math.max(prev, pData.streak);
                  localStorage.setItem('quran_streak', best.toString());
                  return best;
                });
              }
            }
          }
        } catch (err) {
          console.warn('Pre-fetch sync failed:', err);
        }
      }

      const params = new URLSearchParams({ t: Date.now().toString() });
      if (playerName) params.append('name', playerName);
      if (playerUsername) params.append('username', playerUsername);

      const response = await fetch(`/api/leaderboard?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Leaderboard sync failed: ${text.substring(0, 100)}`);
      }
      const data = await response.json();
      if (data.leaderboard && Array.isArray(data.leaderboard)) {
        const seenNames = new Set<string>();
        const unique: LeaderboardUser[] = data.leaderboard
          .filter((p: any) => {
            const norm = (p.name || '').trim().toLowerCase();
            if (!norm || seenNames.has(norm)) return false;
            seenNames.add(norm);
            return true;
          })
          .map((p: any) => ({
            ...p,
            totalPoints: p.totalPoints ?? p.points ?? 0,
            trophiesCount: p.trophiesCount ?? p.cups ?? 0,
            streakCount: p.streakCount ?? p.streak ?? 0,
            points: p.totalPoints ?? p.points ?? 0,
            cups: p.trophiesCount ?? p.cups ?? 0,
            streak: p.streakCount ?? p.streak ?? 0
          }))
          .sort(compareLeaderboardUsers);

        setLeaderboard(unique);
        localStorage.setItem('quran_leaderboard', JSON.stringify(unique));

        if (typeof data.totalUsers === 'number') {
          setTotalUsersCount(data.totalUsers);
          localStorage.setItem('quran_total_users_count', data.totalUsers.toString());
        }

        if (typeof data.userRank === 'number') {
          setUserLeaderboardRank(data.userRank);
          localStorage.setItem('quran_user_leaderboard_rank', data.userRank.toString());
        } else if (data.userRank === null) {
          const localIdx = unique.findIndex((p: any) => {
            if (playerUsername && p.username && p.username.replace(/^@+/, '').toLowerCase() === playerUsername.replace(/^@+/, '').toLowerCase()) return true;
            if (playerName && p.name && p.name.trim().toLowerCase() === playerName.trim().toLowerCase()) return true;
            return false;
          });
          if (localIdx !== -1) {
            setUserLeaderboardRank(localIdx + 1);
            localStorage.setItem('quran_user_leaderboard_rank', (localIdx + 1).toString());
          }
        }

        // Synchronize cups, points, and streak from leaderboard for current player
        const myEntry = unique.find((p: any) => {
          if (playerUsername && p.username && p.username.replace(/^@+/, '').toLowerCase() === playerUsername.replace(/^@+/, '').toLowerCase()) return true;
          if (playerName && p.name && p.name.trim().toLowerCase() === playerName.trim().toLowerCase()) return true;
          return false;
        });

        if (myEntry) {
          const myCups = myEntry.trophiesCount ?? myEntry.cups;
          if (typeof myCups === 'number' && myCups > 0) {
            setCups(prev => {
              const best = Math.max(prev, myCups);
              localStorage.setItem('quran_total_cups', best.toString());
              localStorage.setItem('quran_cups', best.toString());
              return best;
            });
          }
          const myPts = myEntry.totalPoints ?? myEntry.points;
          if (typeof myPts === 'number' && myPts > 0) {
            setTotalPoints(prev => {
              const best = Math.max(prev, myPts);
              localStorage.setItem('quran_total_points', best.toString());
              return best;
            });
          }
          const myStreak = myEntry.streakCount ?? myEntry.streak;
          if (typeof myStreak === 'number' && myStreak > 0) {
            setStreak(prev => {
              const best = Math.max(prev, myStreak);
              localStorage.setItem('quran_streak', best.toString());
              return best;
            });
          }
        }
      }
    } catch (error) {
      console.error('Leaderboard sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [playerName, playerUsername, cups, totalPoints, streak, completedChallengeIds, activeFrame, userCertificates]);

  const handlePlayerLogout = useCallback(() => {
    try {
      setPlayerName(null);
      setPlayerUsername(null);
      setUniquePlayerId(null);
      setActiveFrame(null);
      setIsNameDecorated(false);
      setShowProfileDecoration(false);
      setUserCertificates([]);
      friendsRealtimeService.stopPresence();

      localStorage.removeItem('quran_player_name');
      localStorage.removeItem('quran_player_username');
      localStorage.removeItem('quran_unique_player_id');
      localStorage.removeItem('quran_device_id');
      localStorage.removeItem('quran_username_changed_at');
      localStorage.removeItem('quran_active_frame');
      localStorage.removeItem('quran_name_decorated');
      localStorage.removeItem('quran_show_decoration');
      localStorage.removeItem('quran_user_certificates');

      setView('home');
      syncLeaderboard();
    } catch (err) {
      console.error('Error during player logout:', err);
      setView('home');
    }
  }, [syncLeaderboard]);

  const handleDeletePlayerAccount = useCallback(async (password: string) => {
    const identifier = (playerUsername || playerName || '').trim();
    if (!identifier) {
      throw new Error('تعذر تحديد الحساب الحالي.');
    }

    const res = await fetch('/api/player-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete-account',
        username: identifier,
        password: password.trim()
      })
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || 'فشل حذف الحساب. يرجى التحقق من كلمة المرور.');
    }

    // Complete cleanup from state and storage
    setPlayerName(null);
    setPlayerUsername(null);
    setActiveFrame(null);
    setIsNameDecorated(false);
    setShowProfileDecoration(false);
    setUserCertificates([]);
    setTotalPoints(0);
    setCups(0);
    setStreak(0);
    setStreakInfo(null);
    setDailyCompleted(false);

    localStorage.removeItem('quran_player_name');
    localStorage.removeItem('quran_player_username');
    localStorage.removeItem('quran_device_id');
    localStorage.removeItem('quran_username_changed_at');
    localStorage.removeItem('quran_active_frame');
    localStorage.removeItem('quran_name_decorated');
    localStorage.removeItem('quran_show_decoration');
    localStorage.removeItem('quran_user_certificates');
    localStorage.removeItem('quran_total_points');
    localStorage.removeItem('quran_cups');
    localStorage.removeItem('quran_streak');
    localStorage.removeItem('quran_last_played');
    localStorage.removeItem('quran_last_played_time');
    localStorage.removeItem('quran_daily_completed');
    localStorage.removeItem('quran_daily_mystery_gift');
    localStorage.removeItem('quran_quiz_progress_seerah');
    localStorage.removeItem('quran_quiz_progress_general');

    setView('home');
    syncLeaderboard();
    return data;
  }, [playerName, playerUsername, syncLeaderboard]);

  useEffect(() => {
    localStorage.setItem('quran_total_points', totalPoints.toString());
    localStorage.setItem('quran_cups', cups.toString());
    localStorage.setItem('quran_total_cups', cups.toString());
    localStorage.setItem('quran_leaderboard', JSON.stringify(leaderboard));
    if (playerName) localStorage.setItem('quran_player_name', playerName);
    localStorage.setItem('quran_settings', JSON.stringify(librarySettings));
  }, [totalPoints, cups, leaderboard, playerName, librarySettings]);

  useEffect(() => {
    syncLeaderboard();
  }, [activeFrame, userCertificates.length]);

  // Sync leaderboard immediately when opened or when window gains focus (Zero periodic polling on server)
  useEffect(() => {
    if (showScores) {
      syncLeaderboard();
      const onFocus = () => syncLeaderboard();
      const onVisibility = () => {
        if (document.visibilityState === 'visible') syncLeaderboard();
      };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }
  }, [showScores, syncLeaderboard]);



  const saveScore = (challenge: string, score: number) => {
    const challengeKey = challengeMode === 'daily' ? `[يومي] ${challenge}` : challenge;

    setBestScores(prev => {
      const currentBest = prev[challengeKey] || 0;
      const updated = { ...prev };
      if (score > currentBest) {
        // Requirement 4: Cups are earned strictly in group rooms, not solo threshold
        updated[challengeKey] = score;
        localStorage.setItem('quran_game_scores', JSON.stringify(updated));
        return updated;
      }
      return prev;
    });

    const isNewCompletion = currentChallenge?.id && !completedChallengeIds.has(currentChallenge.id);

    if (isNewCompletion) {
      setCompletedChallengeIds(prev => {
        const newSet = new Set(prev);
        newSet.add(currentChallenge!.id);
        localStorage.setItem('quran_completed_ids', JSON.stringify(Array.from(newSet)));
        return newSet;
      });
    }

    // Requirement 4: Cups are strictly earned from group rooms only
    const newCupsCount = cups;

    // Sync with backend using player username / name without duplicate point increments
    fetch('/api/player-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: playerUsername,
        name: playerName,
        totalPoints: totalPoints,
        cups: 0,
        totalCups: newCupsCount,
        challengeId: currentChallenge?.id,
        roomId: room?.id,
        score: totalPoints,
        seerahCompleted: (getActiveAchievement() === 'seerah'),
        generalCompleted: (getActiveAchievement() === 'general'),
        quranCompleted: (completedChallengeIds.size >= 15)
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Score sync failed:', text);
        }
      })
      .catch(err => console.error('Failed to sync score:', err));

    // Update leaderboard entry & sync
    syncLeaderboard();
  };
  useEffect(() => {
    if (challengeMode !== 'daily' || !dailyCompleted) return;

    const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();

      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [challengeMode, dailyCompleted]);

  useEffect(() => {
    const savedScores = localStorage.getItem('quran_game_scores');
    if (savedScores) {
      setBestScores(JSON.parse(savedScores));
    }
    const savedDifficulty = localStorage.getItem('quran_game_difficulty');
    if (savedDifficulty) {
      setDifficulty(savedDifficulty as Difficulty);
    }
  }, []);

  // Requirement 4: Cups are earned strictly in group rooms. Solo retroactive cup sync disabled.


  const handleDifficultyChange = (newDiff: Difficulty) => {
    setDifficulty(newDiff);
    localStorage.setItem('quran_game_difficulty', newDiff);
    setShowSettings(false);
  };

  useEffect(() => {
    // تحميل الآيات عند بدء التطبيق أو تغيير التحدي
    if (!KEYWORD) return;

    let verses: Verse[] = [];
    if (currentChallenge && Array.isArray(currentChallenge.verses) && currentChallenge.verses.length > 0) {
      // Use verses stored in the database if available
      verses = currentChallenge.verses as Verse[];
      console.log('App: Loaded verses from DB challenge:', currentChallenge.keyword, verses);
    } else if (currentChallenge && (skillsType === 'complete' || skillsType === 'surah' || roomGameMode === 'complete' || roomGameMode === 'surah' || challengeMode === 'daily')) {
      // Create a virtual verse from the keyword for Completion/Surah challenges that lack explicit verses
      verses = [{
        id: `comp-${currentChallenge.id || 'daily'}`,
        number: 1,
        text: currentChallenge.keyword || currentChallenge.verseText || currentChallenge.prompt || '',
        surah: currentChallenge.correctText || (currentChallenge.verses?.[0]?.surah) || 'إكمال الآية',
      }] as Verse[];
      console.log('App: Using virtual verse from keyword:', currentChallenge.keyword);
    } else {
      // Fallback to automatic search disabled as per strict requirement
      verses = [];
      console.log('App: Search fallback disabled for:', KEYWORD);
    }

    if (verses.length === 0 && (view === 'challenge' || view === 'group_game')) {
      console.warn('App: No verses found for keyword:', KEYWORD);
    }

    setAllTargetVerses(verses);
    setMatchedIds(new Set());
    setWordStates({});
    setScore(0);
    resetTranscript();
    console.log('App: currentChallenge updated:', currentChallenge);
  }, [KEYWORD, resetTranscript, view, challengeMode, currentChallenge, challenges.length, roomGameMode]);

  useEffect(() => {
    const isSkillsMode = view === 'challenge' || view === 'group_game';
    const effectiveType = view === 'group_game' ? roomGameMode : skillsType;

    if ((isSkillsMode || challengeMode === 'daily') && (effectiveType === 'complete' || effectiveType === 'surah' || challengeMode === 'daily') && targetVerses.length > 0) {
      if (effectiveType === 'surah' && challengeMode !== 'daily') {
        generateOptions('surah', targetVerses[0]?.surah || '');
      } else {
        const firstUnmatched = targetVerses.find(v => !matchedIds.has(v.id));
        const lastWord = firstUnmatched ? firstUnmatched.text.split(' ').filter(Boolean).slice(-1)[0] : '';
        const correctVal = currentChallenge?.correctText || lastWord;
        generateOptions('complete', correctVal);
      }
    }
  }, [view, skillsType, targetVerses, matchedIds.size, generateOptions, roomGameMode, currentChallenge?.id || currentChallenge?.keyword, challengeMode]);

  const keywordWordCount = useMemo(() => KEYWORD.split(' ').filter(Boolean).length, [KEYWORD]);

  const distinguishingWordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const normalizedKeyword = normalizeArabicText(KEYWORD);

    targetVerses.forEach(verse => {
      const normalizedVerse = normalizeArabicText(verse.text);
      const uniquePart = normalizedVerse.replace(normalizedKeyword, '').trim();
      const uniqueWords = uniquePart.split(' ').filter(Boolean);

      if (uniqueWords.length === 0) {
        counts[verse.id] = 0;
        return;
      }

      let wordsNeeded = 1;
      while (wordsNeeded < uniqueWords.length) {
        const prefix = uniqueWords.slice(0, wordsNeeded).join(' ');
        const isUnique = !targetVerses.some(otherVerse => {
          if (otherVerse.id === verse.id) return false;
          const otherNormalized = normalizeArabicText(otherVerse.text);
          const otherUniquePart = otherNormalized.replace(normalizedKeyword, '').trim();
          return otherUniquePart.startsWith(prefix);
        });

        if (isUnique) break;
        wordsNeeded++;
      }
      counts[verse.id] = Math.max(wordsNeeded, Math.min(2, uniqueWords.length));
    });
    return counts;
  }, [targetVerses, KEYWORD]);

  // التحقق من المطابقة كلما تغير النص المسموع
  useEffect(() => {
    if (!transcript) return;

    const normalizedTranscript = normalizeArabicText(transcript);
    const transcriptWords = normalizedTranscript.split(' ').filter(Boolean);

    const candidates: { verse: Verse, score: number, distRatio: number, fullRatio: number }[] = [];
    const newWordStates = { ...wordStates };
    let countsChanged = false;

    targetVerses.forEach(verse => {
      if (matchedIds.has(verse.id)) return;

      const normalizedVerse = normalizeArabicText(verse.text);
      const normalizedKeyword = normalizeArabicText(KEYWORD);

      const uniquePart = normalizedVerse.replace(normalizedKeyword, '').trim();
      const uniqueWords = uniquePart.split(' ').filter(Boolean);

      if (uniqueWords.length === 0) {
        if (normalizedTranscript.includes(normalizedKeyword)) {
          candidates.push({ verse, score: 1000, distRatio: 1, fullRatio: 1 });
        }
        return;
      }

      // Linear Word Tracking Logic
      const currentVerseStates = { ...(newWordStates[verse.id] || {}) };
      let lastIndex = -1;
      const indices = Object.keys(currentVerseStates).map(Number);
      if (indices.length > 0) {
        lastIndex = Math.max(...indices);
      }

      transcriptWords.forEach(tWord => {
        const normTWord = normalizeArabicText(tWord);

        for (let i = lastIndex + 1; i < uniqueWords.length; i++) {
          const normVWord = normalizeArabicText(uniqueWords[i]);

          if (normTWord === normVWord || getSimilarity(normTWord, normVWord) > 0.8) {
            // Found a match at index i
            // Mark intermediate as skipped - REMOVED for strictness
            // Mark current as correct
            if (currentVerseStates[i] !== 'correct') {
              currentVerseStates[i] = 'correct';
              countsChanged = true;
            }
            lastIndex = i;
            break;
          }
        }
      });

      if (countsChanged) {
        newWordStates[verse.id] = currentVerseStates;
      }

      const correctCount = Object.values(currentVerseStates).filter(s => s === 'correct').length;
      const skippedCount = Object.values(currentVerseStates).filter(s => s === 'skipped').length;
      const fullRatio = (correctCount + skippedCount) / uniqueWords.length;

      const transcriptRemaining = transcriptWords.slice(keywordWordCount).join(' ');
      const targetRemaining = uniqueWords.join(' ');
      const similarity = getSimilarity(transcriptRemaining, targetRemaining);

      const score = (correctCount * 20) - (skippedCount * 5) + (similarity * 50);

      let requiredFullRatio = 0.9;
      if (difficulty === 'easy') requiredFullRatio = 0.75;
      else if (difficulty === 'medium') requiredFullRatio = 0.85;

      // Full Text Match Fallback: If the transcript clearly contains the verse, consider it matched
      const normalizedTranscriptFull = normalizeArabicText(transcript);
      const normalizedVerseMatch = normalizeArabicText(verse.text);
      const isFullTextMatch = normalizedTranscriptFull.includes(normalizedVerseMatch) ||
        (getSimilarity(normalizedTranscriptFull, normalizedVerseMatch) > 0.85) ||
        (normalizedTranscriptFull.includes(normalizeArabicText(KEYWORD)) &&
          uniqueWords.filter(w => normalizedTranscriptFull.includes(normalizeArabicText(w))).length / uniqueWords.length >= 0.8);

      if (isFullTextMatch || fullRatio >= requiredFullRatio || similarity > 0.9 || (correctCount + skippedCount >= uniqueWords.length - 1 && uniqueWords.length > 3)) {
        candidates.push({ verse, score, distRatio: correctCount / uniqueWords.length, fullRatio });
      }
    });

    if (countsChanged) {
      setWordStates(newWordStates);
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];

      setMatchedIds(prev => {
        const newSet = new Set(prev);
        newSet.add(best.verse.id);
        return newSet;
      });

      stopListening();
      resetTranscript();
      setTimeout(() => {
        startListening();
      }, 400);

      addPoint({ challengeId: currentChallenge?.id, roomId: room?.id });
      setScore(prev => prev + 1);
    }
  }, [transcript, targetVerses, matchedIds, KEYWORD, difficulty, wordStates, stopListening, resetTranscript, startListening, keywordWordCount, distinguishingWordCounts]);

  const handlePromptNextChallenge = () => {
    setIsNextChallengeModalOpen(true);
  };

  const confirmNextChallenge = () => {
    saveScore(KEYWORD, score);
    setSessionCorrect(prev => prev + 1);
    setIsNextChallengeModalOpen(false);

    if (currentChallengeIndex >= challenges.length - 1) {
      if (room) setView('group_game');
      else setView('skills_results');
      return;
    }

    setCurrentChallengeIndex(prev => prev + 1);
    setSessionCurrentIndex(prev => prev + 1);
    setMatchedIds(new Set());
    setWordStates({});
    if (isSpeedMode) {
      setSpeedTimeLeft(getSpeedQuestionDuration(challenges[currentChallengeIndex + 1]));
    }
    resetTranscript();
  };


  const matchedKeywords = useMemo(() => {
    return Array.from(matchedIds).map(id => {
      const verse = targetVerses.find(v => v.id === id);
      return verse ? verse.text : '';
    });
  }, [matchedIds, targetVerses]);

  const searchResults = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];

    const normalizedQuery = normalizeArabicText(trimmed);
    if (!normalizedQuery) return [];

    const results: any[] = [];
    quranData.forEach(surah => {
      surah.verses.forEach((verse: any) => {
        const normalizedVerse = normalizeArabicText(verse.text);
        // Exact phrase matching
        if (normalizedVerse.includes(normalizedQuery)) {
          results.push({ ...verse, surahName: surah.name, surahId: surah.id });
        }
      });
    });
    // Sort by verse length to show more specific matches first, limit to 100
    return results.sort((a, b) => a.text.length - b.text.length).slice(0, 100);
  }, [searchQuery]);

  const juzVerses = useMemo(() => {
    if (selectedJuz === null) return [];
    const boundary = juzBoundaries.find(b => b.juz === selectedJuz);
    if (!boundary) return [];

    const results: any[] = [];
    quranData.forEach(surah => {
      if (surah.id >= boundary.startSurah && surah.id <= boundary.endSurah) {
        surah.verses.forEach((verse: any) => {
          const isStart = surah.id === boundary.startSurah ? verse.id >= boundary.startVerse : true;
          const isEnd = surah.id === boundary.endSurah ? verse.id <= boundary.endVerse : true;
          if (isStart && isEnd) {
            results.push({ ...verse, surahName: surah.name, surahId: surah.id });
          }
        });
      }
    });
    return results;
  }, [selectedJuz]);

  const pageVerses = useMemo(() => {
    const results: any[] = [];
    quranData.forEach(surah => {
      surah.verses.forEach((verse: any) => {
        const versePage = getPageNumber(surah.id, verse.id);
        if (versePage === currentPage) {
          results.push({ ...verse, surahName: surah.name, surahId: surah.id, page: versePage });
        }
      });
    });
    return results;
  }, [currentPage]);

  const currentSurahName = useMemo(() => {
    return pageVerses[0]?.surahName || '...';
  }, [pageVerses]);

  const handleExplain = async () => {
    setShowExplanation(true);
    if (explanationText) return;

    setIsExplaining(true);
    try {
      const ai = new GoogleGenAI((import.meta as any).env.VITE_GEMINI_API_KEY || '');

      const versesList = targetVerses.map(v => `- سورة ${v.surah}: ${v.text}`).join('\n');
      const prompt = `أنا أقوم ببناء تطبيق لحفظ القرآن الكريم وتحديداً المتشابهات.
الآيات التالية تبدأ جميعها بـ "${KEYWORD}":
${versesList}

يرجى تقديم شرح مختصر ومفيد (في حدود 3-4 فقرات) يوضح:
1. لماذا تتشابه هذه الآيات (السياق العام).
2. كيف يمكن للحافظ التمييز بينها (الضوابط أو العلامات المميزة لكل سورة).
استخدم لغة عربية فصحى مبسطة ومشجعة.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setExplanationText(response.text || "عذراً، لم أتمكن من توليد الشرح.");
    } catch (error) {
      console.error("Error generating explanation:", error);
      setExplanationText("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. يرجى المحاولة لاحقاً.");
    } finally {
      setIsExplaining(false);
    }
  };

  // Helpers for modals and sub-components
  const [selectedActionAyah, setSelectedActionAyah] = useState<any>(null);
  const [actionSheetPosition, setActionSheetPosition] = useState<{ x: number; y: number } | null>(null);
  const [isAyahCopied, setIsAyahCopied] = useState(false);
  const [copiedAyahId, setCopiedAyahId] = useState<string | null>(null);
  const [selectedTafsirAyah, setSelectedTafsirAyah] = useState<any>(null);
  const [isTafsirModalOpen, setIsTafsirModalOpen] = useState(false);
  const [tafsirText, setTafsirText] = useState('');
  const [isTafsirLoading, setIsTafsirLoading] = useState(false);

  const handleCopyAyah = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setIsAyahCopied(true);
      setCopiedAyahId(id);
      setTimeout(() => {
        setIsAyahCopied(false);
        setCopiedAyahId(null);
      }, 2000);
    } catch { }
  };

  const handleShareAyah = (text: string, surahName?: string, ayahNum?: number) => {
    const msg = `﴿${text}﴾ [سورة ${surahName || ''} : ${ayahNum || ''}]`;
    if (navigator.share) {
      navigator.share({ text: msg }).catch(() => { });
    } else {
      navigator.clipboard.writeText(msg).catch(() => { });
    }
  };

  const handleAyahClick = (ayah: any, e: React.MouseEvent) => {
    setSelectedActionAyah(ayah);
    setActionSheetPosition({ x: e.clientX, y: e.clientY });
  };

  const handleAyahLongPress = (ayah: any, e: any) => {
    setSelectedActionAyah(ayah);
    setActionSheetPosition({ x: e.clientX || 0, y: e.clientY || 0 });
  };

  const currentSurahStartPage = surahStartPages[selectedSurahId || 1] || 1;
  const currentJuzStartPage = juzStartPages[selectedJuz || 1] || 1;

  const handleDirectPageSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const p = parseInt(pageInput);
    if (!isNaN(p) && p >= 1 && p <= 604) {
      setCurrentPage(p);
    }
  };

  const handleBuyCosmetic = (id: string, cost: number) => {
    if (totalPoints >= cost && !ownedCosmetics.includes(id)) {
      setTotalPoints(p => p - cost);
      setOwnedCosmetics(prev => {
        const next = [...prev, id];
        localStorage.setItem('quran_owned_cosmetics', JSON.stringify(next));
        return next;
      });
      localStorage.setItem('quran_total_points', (totalPoints - cost).toString());
      toast.success('تم الشراء بنجاح!');
    }
  };

  const handleEquipNameColor = (color: string | null) => {
    setEquippedNameColor(color);
    if (color) localStorage.setItem('quran_equipped_name_color', color);
    else localStorage.removeItem('quran_equipped_name_color');
  };

  const handleEquipTitle = (title: string | null) => {
    setEquippedTitle(title);
    if (title) localStorage.setItem('quran_equipped_title', title);
    else localStorage.removeItem('quran_equipped_title');
  };

  const handleEquipEffect = (effect: string | null) => {
    setEquippedEffect(effect);
    if (effect) localStorage.setItem('quran_equipped_effect', effect);
    else localStorage.removeItem('quran_equipped_effect');
  };

  const handleSelectChallenge = (c: any, idx: number) => {
    setCurrentChallengeIndex(idx);
    setView('challenge');
  };

  const handleSelectCategory = (cat: 'seerah' | 'general') => {
    setSelectedCategory(cat);
    setView('islamic_quiz');
  };

  const handleStartSpeedModeSelection = () => {
    handleStartSpeedChallenge();
  };

  const handleOpenLibrary = () => setView('library');
  const handleOpenSettings = () => setView('settings');
  const handleStartDailyChallenge = () => handleStartDaily();

  const handleResumeIncompleteChallenge = () => {
    if (incompleteChallenge) {
      setCurrentChallengeIndex(incompleteChallenge.index);
      setChallengeMode(incompleteChallenge.mode);
      setView('challenge');
    }
  };

  const handleDismissIncompleteChallenge = () => {
    setIncompleteChallenge(null);
    localStorage.removeItem('quran_incomplete_challenge');
  };

  const isOccasionToday = nearestOccasion?.daysRemaining === 0;
  const occasionsInfo = upcomingOccasions;
  const reconnectSecondsLeft = 3;
  const handleForceReconnect = () => window.location.reload();

  const value = {
    // Navigation & Views
    view, setView,
    showScores, setShowScores,
    showSettings, setShowSettings,

    // Challenges & Quiz
    challenges, setChallenges,
    allChallenges, setAllChallenges,
    completionChallenges, setCompletionChallenges: setDbCompletionChallenges, setDbCompletionChallenges,
    currentChallengeIndex, setCurrentChallengeIndex,
    currentChallenge,
    matchedIds, setMatchedIds,
    wordStates, setWordStates,
    score, setScore,
    bestScores, setBestScores,
    difficulty, setDifficulty,
    handleDifficultyChange,
    showExplanation, setShowExplanation,
    explanationText, setExplanationText,
    isExplaining, setIsExplaining,
    handleExplain,
    isSpeedMode, setIsSpeedMode,
    speedTimeLeft, setSpeedTimeLeft,
    speedQuestionTime: speedTimeLeft, setSpeedQuestionTime: setSpeedTimeLeft,
    speedTargetVersesCount: targetVerses.length, setSpeedTargetVersesCount: () => { },
    speedTotalTimeSpent, setSpeedTotalTimeSpent,
    isSpeedGameOver, setIsSpeedGameOver,
    handleStartSpeedChallenge,
    dailyCompleted, setDailyCompleted,
    dailyStreak: streak, setDailyStreak: setStreak,
    timeLeft, setTimeLeft,
    challengeMode, setChallengeMode,
    dailyChallengeOffset, setDailyChallengeOffset,
    handleStartDaily,
    handleStartDailyChallenge,
    incrementStreak,
    incompleteChallenge, setIncompleteChallenge,
    completedChallengeIds, setCompletedChallengeIds,
    allTargetVerses, setAllTargetVerses,
    KEYWORD,
    targetVerses,
    isComplete,
    width, height,
    transcript, listening: isListening, isListening, speechError: '',
    startListening, stopListening, resetTranscript,
    matchedKeywords,
    keywordWordCount, distinguishingWordCounts,
    handlePromptNextChallenge, confirmNextChallenge,
    handleSkip, handleBackToHome, confirmExitToHome,
    saveScore,

    // Skills Mode
    skillsType, setSkillsType,
    skillsQuestionCount: selectedSkillCount, setSkillsQuestionCount: setSelectedSkillCount,
    selectedSkillCount, setSelectedSkillCount,
    selectedSkillJuzs, setSelectedSkillJuzs,
    selectedSkillSurahs, setSelectedSkillSurahs,
    skillsScopeMode, setSkillsScopeMode,
    skillSurahSearch, setSkillSurahSearch,
    isJuzMenuOpen, setIsJuzMenuOpen,
    isSurahMenuOpen, setIsSurahMenuOpen,
    sessionCorrect, setSessionCorrect,
    sessionWrong, setSessionWrong,
    sessionMistakes, setSessionMistakes,
    sessionCurrentIndex, setSessionCurrentIndex,
    skillsOptions, setSkillsOptions,
    selectedOption, setSelectedOption,
    skillsFeedback, setSkillsFeedback,
    hasAnsweredCurrentQuestion, setHasAnsweredCurrentQuestion,
    surahInputs, setSurahInputs,
    surahFeedbackData, setSurahFeedbackData,
    handleOptionSelect,
    skillsCorrectAnswer,
    handleAnswerOption: handleOptionSelect,
    handleConfirmAnswer, handleConfirmAnswerWithOption,
    handleSubmitSurah, generateOptions,
    handleStartSkillsSession,
    handleSelectChallenge,
    handleResumeIncompleteChallenge,
    handleDismissIncompleteChallenge,
    handleSelectCategory,
    handleStartSpeedModeSelection,
    handleOpenLibrary,
    handleOpenSettings,
    handlePlayAgainSameRoom: () => {
      if (room?.id) {
        handleJoinV1(room.id);
      } else {
        setView('home');
      }
    },

    // Power-ups
    freezeTimeCount, setFreezeTimeCount,
    deleteTwoCount, setDeleteTwoCount,
    isFreezeActive, setIsFreezeActive,
    isPowerUpUsedThisQuestion, setIsPowerUpUsedThisQuestion,
    eliminatedOptionIndices, setEliminatedOptionIndices,
    handleExecuteFreezeTime,
    handleExecuteDeleteTwo,

    // Rooms & Multiplayer (v1)
    room, setRoom,
    roomRef,
    roomError: v1Error, setRoomError: setV1Error,
    roomLoading: isRoomLoading, setRoomLoading: setIsRoomLoading,
    isCreatingRoom, setIsCreatingRoom,
    isJoiningRoom, setIsJoiningRoom,
    v1RoomName, setV1RoomName,
    v1IsPrivate, setV1IsPrivate,
    showPasswordText, setShowPasswordText,
    v1RoomPassword, setV1RoomPassword,
    v1GameModes, setV1GameModes,
    availableSkillCounts, setAvailableSkillCounts,
    skillQuestionCounts, setSkillQuestionCounts,
    whoAmIQuestionCount, setWhoAmIQuestionCount,
    whoAmICategory, setWhoAmICategory,
    whoAmIAvailableCategories, setWhoAmIAvailableCategories,
    selectedWhoAmICategories, setSelectedWhoAmICategories,
    whoAmICategoryCounts, setWhoAmICategoryCounts,
    totalConfiguredQuestions,
    islamicRoomCategories, setIslamicRoomCategories,
    islamicRoomLevels, setIslamicRoomLevels,
    islamicRoomTopics, setIslamicRoomTopics,
    islamicTopicQuestionCounts, setIslamicTopicQuestionCounts,
    setShowIslamicConfigModal: setShowIslamicConfigModal,
    showIslamicConfigModal,
    showIslamicRoomConfigModal: showIslamicConfigModal, setShowIslamicRoomConfigModal: setShowIslamicConfigModal,
    hasCountValidationErrors,
    v1Timer, setV1Timer,
    v1TimePerQuestion, setV1TimePerQuestion,
    v1TransitionMode, setV1TransitionMode,
    handleCreateV1,
    handleStartRoomV1,
    handleStartRoom: handleStartRoomV1,
    v1IsStartingRoom,
    handleCancelRoomByHost,
    confirmCancelRoomByHost,
    isCancelRoomModalOpen,
    setIsCancelRoomModalOpen,
    showDeleteModal: isCancelRoomModalOpen,
    setShowDeleteModal: setIsCancelRoomModalOpen,
    isRoomLeader,
    isRoomActionLoading,
    availableRooms, setAvailableRooms,
    isLoadingRooms, setIsLoadingRooms,
    fetchAvailableRooms,
    handleJoinV1,
    privateRoomModal, setPrivateRoomModal,
    handleRoomTimeout,
    resetQuestionUIState,
    moveToNextQuestion,
    syncGroupProgress,
    handleLeaveRoom: () => {
      setRoom(null);
      setView('home');
    },
    handleWithdraw,
    handleResignGroupChallenge: handleWithdraw,
    handleResignMultiplayer: handleWithdraw,
    handleResign: handleWithdraw,
    isResignModalOpen, setIsResignModalOpen,
    isReconnecting, reconnectSecondsLeft, handleForceReconnect,
    toastMessage,
    setToastMessage,
    toast,

    // Leaderboard & Player Profile
    leaderboard, setLeaderboard,
    isSyncing, setIsSyncing,
    totalUsersCount, setTotalUsersCount,
    userLeaderboardRank, setUserLeaderboardRank,
    playerName, setPlayerName,
    playerUsername, setPlayerUsername,
    cups, setCups,
    totalPoints, setTotalPoints,
    addPoint,
    streak, setStreak,
    streakInfo,
    motivationalQuote, setMotivationalQuote,
    isStreakModalOpen, setIsStreakModalOpen,
    userAchievement,
    achievementStyles,
    isElite,
    safeAchievement,
    currentStyle,
    equippedNameColor, setEquippedNameColor,
    equippedTitle, setEquippedTitle,
    equippedEffect, setEquippedEffect,
    userCosmetics: ownedCosmetics, setUserCosmetics: setOwnedCosmetics,
    ownedCosmetics, setOwnedCosmetics,
    activeFrame, setActiveFrame,
    userCertificates, setUserCertificates,
    equippedBadge: activeFrame, setEquippedBadge: setActiveFrame,
    syncLeaderboard,
    getActiveAchievement,
    showCosmeticStore, setShowCosmeticStore,
    handleBuyCosmetic, handleEquipNameColor, handleEquipTitle, handleEquipEffect,

    // Auth
    playerAuthMode, setPlayerAuthMode,
    nameInput, setNameInput,
    usernameInput, setUsernameInput,
    passwordInput, setPasswordInput,
    authNameInput: nameInput, setAuthNameInput: setNameInput,
    authUsernameInput: usernameInput, setAuthUsernameInput: setUsernameInput,
    authPasswordInput: passwordInput, setAuthPasswordInput: setPasswordInput,
    isRegistering, setIsRegistering,
    isAuthSubmitting: isRegistering, setIsAuthSubmitting: setIsRegistering,
    registrationError, setRegistrationError,
    hasAgreedToPrivacy, setHasAgreedToPrivacy,
    handlePlayerAuth,
    handlePlayerAuthSubmit: handlePlayerAuth,
    handlePlayerLogout,
    signOut: handlePlayerLogout,
    handleDeletePlayerAccount,

    // Library & Mushaf
    activeListTab, setActiveListTab,
    activeLibraryTab: activeListTab, setActiveLibraryTab: setActiveListTab,
    searchQuery, setSearchQuery,
    adhkarSearchQuery, setAdhkarSearchQuery,
    isSearchSubmitted, setIsSearchSubmitted,
    selectedSurahId, setSelectedSurahId,
    selectedSurah: selectedSurahId, setSelectedSurah: setSelectedSurahId,
    selectedJuz, setSelectedJuz,
    currentPage, setCurrentPage,
    pageInput, setPageInput,
    isMushafFullscreen, setIsMushafFullscreen,
    isPageModeActive, setIsPageModeActive,
    isMushafFeaturesModalOpen, setIsMushafFeaturesModalOpen,
    openWird,
    mushafZoomScale, setMushafZoomScale,
    pageTurnDirection, setPageTurnDirection,
    filteredSurahsList,
    currentSurahStartPage,
    currentJuzStartPage,
    handleDirectPageSubmit,
    handleAyahClick,
    handleAyahLongPress,
    handlePullToRefresh,
    searchResults,
    juzVerses,
    pageVerses,
    currentSurahName,
    selectedHadith, setSelectedHadith,
    selectedDhikrCategory: selectedAdhkarCategoryId, setSelectedDhikrCategory: setSelectedAdhkarCategoryId,
    selectedAdhkarCategoryId, setSelectedAdhkarCategoryId,
    adhkarProgress, setAdhkarProgress,
    librarySettings, setLibrarySettings,
    isLibrarySettingsOpen: isSettingsOpen, setIsLibrarySettingsOpen: setIsSettingsOpen,
    isSettingsOpen, setIsSettingsOpen,

    // Modals & Overlays
    showAboutModal, setShowAboutModal,
    showPrivacyModal, setShowPrivacyModal,
    showDownloadModal, setShowDownloadModal,
    showTesterModal: showGooglePlayModal, setShowTesterModal: setShowGooglePlayModal,
    showGooglePlayModal, setShowGooglePlayModal,
    showStreakModal: isStreakModalOpen, setShowStreakModal: setIsStreakModalOpen,
    isOccasionsModalOpen, setIsOccasionsModalOpen,
    showIslamicOccasionsModal: isOccasionsModalOpen, setShowIslamicOccasionsModal: setIsOccasionsModalOpen,
    upcomingOccasions, occasionsInfo: upcomingOccasions,
    nearestOccasion, isOccasionToday,
    hijriDate, setHijriDate,
    selectedActionAyah, setSelectedActionAyah,
    actionSheetPosition, setActionSheetPosition,
    isAyahCopied, setIsAyahCopied,
    copiedAyahId, setCopiedAyahId,
    handleCopyAyah, handleShareAyah, handleOpenTafsir,
    selectedTafsirAyah, setSelectedTafsirAyah,
    isTafsirModalOpen, setIsTafsirModalOpen,
    showTafsirModal: isTafsirModalOpen, setShowTafsirModal: setIsTafsirModalOpen,
    tafsirText, setTafsirText,
    isTafsirLoading, setIsTafsirLoading,
    isExitModalOpen, setIsExitModalOpen,
    isNextChallengeModalOpen, setIsNextChallengeModalOpen,
    isIncompleteModalOpen: !!incompleteChallenge,
    setIsIncompleteModalOpen: (open: boolean) => { if (!open) setIncompleteChallenge(null); },
    showCertificate,
    setShowCertificate,
    showCertificateModal: showCertificate,
    setShowCertificateModal: setShowCertificate,
    selectedCategory,
    setSelectedCategory,
    certificateCategory: selectedCategory,
    certificateLevel: 'ممتاز',
    showPrivateRoomModal: privateRoomModal.isOpen,
    setShowPrivateRoomModal: (open: boolean) => setPrivateRoomModal(prev => ({ ...prev, isOpen: open })),
    privateRoomPinInput: privateRoomModal.password,
    setPrivateRoomPinInput: (pwd: string) => setPrivateRoomModal(prev => ({ ...prev, password: pwd })),
    handlePrivateRoomSubmit: () => { if (privateRoomModal.room) handleJoinV1(privateRoomModal.room.id, privateRoomModal.password); },
    privateRoomError: privateRoomModal.error,
    isPrivateSubmitting: isJoiningRoom,

    // Daily Mystery Gift
    dailyGift,
    revealDailyGift,
    incrementDailyGiftReadingTime,
    recordDailyGiftRoomMatch,
    claimDailyGiftReward,

    // Google Play Tester state
    testerEmail, setTesterEmail,
    testerStatus, setTesterStatus,
    testerMessage, setTesterMessage,
    internalTestLink, setInternalTestLink,
    isCheckingSavedStatus,
    handleRegisterTester,
    handleResetTesterForm,
    isNativeApp,
    handleShareApp,
    shareCopied,
    availableCategories: islamicCategoriesList,

    // Admin & System
    systemSettings, setSystemSettings,
    fetchSettings,
    challengesLoading, setChallengesLoading,
    challengesError, setChallengesError,
    adminToken, setAdminToken,
    adminRole, setAdminRole,
    isSuperAdmin, setIsSuperAdmin,
    adminUsername, setAdminUsername,
    adminName, setAdminName,
    adminId, setAdminId,
    canManageUsers, setCanManageUsers,
    handleAdminLogin, handleAdminLogout,
    showAdminLogin: false, setShowAdminLogin: () => { },

    // Friends, Profile & Live Invites
    uniquePlayerId, setUniquePlayerId,
    isFriendsModalOpen, setIsFriendsModalOpen,
    selectedProfilePlayer, setSelectedProfilePlayer,
    incomingRoomInvite, setIncomingRoomInvite,
    handleAcceptRoomInvite,
    handleDeclineRoomInvite,
    handleOpenPlayerProfile,
    handleClosePlayerProfile,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
