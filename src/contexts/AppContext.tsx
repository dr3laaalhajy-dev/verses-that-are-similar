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
import {
  juzBoundaries,
  JUZ_NAMES_AR,
  ALL_QURAN_SURAHS,
  getJuzsForSurah,
  getSelectedJuzRange,
  getActiveScope,
  splitSurahAnswersByScope,
  splitSurahAnswersByJuzRange,
  SurahAnswerWithDetails,
  getAvailableSurahChallenges,
  getChallengeSurahsList,
  getTrueJuzForPosition,
  formatScopeSummary,
  validateSurahChallengeScope
} from '../services/JuzRepository';

export interface AyahCompletionSettings {
  isSelected: boolean;
  questionsCount: number;
  scopeMode: 'juz' | 'surah';
  selectedJuzRange: number[];
  selectedSurahs: string[];
}

export interface SurahNameSettings {
  isSelected: boolean;
  questionsCount: number;
  scopeMode: 'juz' | 'surah';
  selectedJuzRange: number[];
  selectedSurahs: string[];
}

export interface IslamicQuestionsSettings {
  isSelected: boolean;
  questionsCount: number;
  categories: string[];
  topics: string[];
  topicCounts: Record<string, number>;
  levels: any[];
}

export interface AudioSettings {
  isSelected: boolean;
  questionsCount: number;
}

export interface WhoAmISettings {
  isSelected: boolean;
  questionsCount: number;
  categories: string[];
  categoryCounts: Record<string, number>;
}

export interface ModularRoomSettings {
  ayahCompletion: AyahCompletionSettings;
  surahName: SurahNameSettings;
  islamicQuestions: IslamicQuestionsSettings;
  audio?: AudioSettings;
  whoAmI?: WhoAmISettings;
}
import { getPageNumber, juzStartPages, surahStartPages } from '../services/PageRepository';
import { adhkarData, Dhikr, resolveAdhkarCategoryId } from '../services/AdhkarRepository';
import { router } from '../services/router';
import { normalizeArabicText, normalizeSurahName, getSimilarity, convertArabicNumbersToEnglish } from '../utils/arabic';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../services/supabase';
import { friendsRealtimeService } from '../services/friendsRealtimeService';
import { getRandomIslamicRoomQuestions, getTargetedIslamicQuestions, getTotalIslamicAvailableCount, getIslamicTopicAvailableCount } from '../utils/islamicChallengeHelper';
import { islamicCategoriesList } from '../data/islamicCategories';
import { calculateStreakInfo, StreakInfo, getTodayLocalDateStr } from '../utils/streakManager';
import { LeaderboardUser, compareLeaderboardUsers, calculateHiddenRankingScore } from '../utils/leaderboardRanking';
import { generateCompletionChallenges, generateSurahChallenges } from '../services/challengeGenerator';
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
import {
  getDailyChallengeConfigForDate,
  calculateDecayingPoints,
  MAX_POINTS,
  MIN_POINTS,
  PENALTY_PER_RETRY
} from "../utils/dailyChestChallenge";

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface DailyMysteryGift {
  id: string;
  date: string;
  isRevealed: boolean;
  type: 'daily_chest_challenge' | 'reading_time' | 'room_challenge';
  category?: string;
  categoryTitle?: string;
  title: string;
  actionButtonText?: string;
  description: string;
  target: number;
  currentProgress: number;
  isCompleted: boolean;
  isClaimed: boolean;
  rewardPoints: number;
  maxLives?: number;
  attemptsCount?: number;
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
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.mateen.game';
    const webUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mateen.me';
    const shareUrl = playStoreUrl;
    const shareData = {
      title: 'تطبيق متين للقرآن الكريم',
      text: 'تطبيق متين لمراجعة وحفظ القرآن الكريم والمتشابهات اللفظية والتحديات القرآنية! متاح على متجر Google Play وعبر الويب:\n' + playStoreUrl + '\n' + webUrl,
      url: shareUrl
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
      if (shareUrl) {
        await navigator.clipboard.writeText(`${shareData.text}`);
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
  const [playerId, setPlayerId] = useState<number | string | null>(() => localStorage.getItem('quran_player_id'));
  const [totalPoints, setTotalPoints] = useState<number>(() => Number(localStorage.getItem('quran_total_points')) || 0);
  const [cups, setCups] = useState(() => parseInt(localStorage.getItem('quran_total_cups') || localStorage.getItem('quran_cups') || '0'));

  // Friends & Profile State
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState<number>(0);
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
    const config = getDailyChallengeConfigForDate(todayKey);

    try {
      const saved = localStorage.getItem('quran_daily_mystery_gift');
      if (saved) {
        const parsed: DailyMysteryGift = JSON.parse(saved);
        if (parsed && parsed.date === todayKey) {
          const attempts = parsed.attemptsCount ? Math.max(1, parsed.attemptsCount) : 1;
          const currentReward = parsed.isClaimed
            ? (parsed.rewardPoints || calculateDecayingPoints(attempts))
            : calculateDecayingPoints(attempts);
          return {
            ...parsed,
            type: 'daily_chest_challenge',
            category: parsed.category || config.category,
            categoryTitle: parsed.categoryTitle || config.categoryTitle,
            title: parsed.title || config.title,
            actionButtonText: parsed.actionButtonText || config.actionButtonText,
            description: parsed.description || config.description,
            target: parsed.target || config.target,
            maxLives: parsed.maxLives || config.maxLives,
            rewardPoints: currentReward,
            attemptsCount: attempts
          };
        }
      }
    } catch (e) {
      console.error('Error reading quran_daily_mystery_gift from localStorage:', e);
    }

    return {
      id: `mystery_${todayKey}`,
      date: todayKey,
      isRevealed: false,
      type: 'daily_chest_challenge',
      category: config.category,
      categoryTitle: config.categoryTitle,
      title: config.title,
      actionButtonText: config.actionButtonText,
      description: config.description,
      target: config.target,
      currentProgress: 0,
      isCompleted: false,
      isClaimed: false,
      rewardPoints: 50,
      maxLives: config.maxLives,
      attemptsCount: 1
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
      dailyGiftRef.current = updated;
      try {
        localStorage.setItem('quran_daily_mystery_gift', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  }, []);

  const recordDailyChestRetry = useCallback(() => {
    setDailyGift(prev => {
      const nextAttempts = (prev.attemptsCount || 1) + 1;
      const nextRewardPoints = calculateDecayingPoints(nextAttempts);
      const updated: DailyMysteryGift = {
        ...prev,
        attemptsCount: nextAttempts,
        rewardPoints: nextRewardPoints
      };
      dailyGiftRef.current = updated;
      try {
        localStorage.setItem('quran_daily_mystery_gift', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  }, []);

  const completeDailyChestChallenge = useCallback(() => {
    setDailyGift(prev => {
      const attempts = prev.attemptsCount || 1;
      const finalPoints = calculateDecayingPoints(attempts);
      const updated: DailyMysteryGift = {
        ...prev,
        currentProgress: prev.target,
        isCompleted: true,
        rewardPoints: finalPoints
      };
      dailyGiftRef.current = updated;
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
        dailyGiftRef.current = updated;
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
      dailyGiftRef.current = updated;
      try {
        localStorage.setItem('quran_daily_mystery_gift', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  }, []);

  const claimDailyGiftReward = useCallback(async () => {
    const gift = dailyGiftRef.current;
    if (!gift || !gift.isCompleted || gift.isClaimed) return;
    const attempts = gift.attemptsCount || 1;
    const points = calculateDecayingPoints(attempts);

    let nextLocalPoints = 0;
    setTotalPoints(current => {
      nextLocalPoints = current + points;
      try {
        localStorage.setItem('quran_total_points', String(nextLocalPoints));
      } catch (e) { }
      return nextLocalPoints;
    });

    toast.success(`🎉 مبارك! تم استلام مكافأة صندوق اليوم (+${points} نقطة)!`);

    const updated: DailyMysteryGift = {
      ...gift,
      isClaimed: true
    };
    setDailyGift(updated);
    dailyGiftRef.current = updated;
    try {
      localStorage.setItem('quran_daily_mystery_gift', JSON.stringify(updated));
    } catch (e) { }

    // Immediate database update with gift reward points
    const ident = playerUsername || playerName || localStorage.getItem('quran_player_username') || localStorage.getItem('quran_player_name');
    if (ident) {
      try {
        const res = await fetch('/api/player-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: playerUsername || localStorage.getItem('quran_player_username'),
            name: playerName || localStorage.getItem('quran_player_name'),
            points: points,
            rewardPoints: points,
            isReward: true,
            source: 'mystery_gift',
            totalPoints: nextLocalPoints
          })
        });
        if (res.ok) {
          const data = await res.json();
          const p = data?.player || data?.user || data;
          if (p && typeof p.points === 'number') {
            setTotalPoints(p.points);
            try {
              localStorage.setItem('quran_total_points', String(p.points));
            } catch (e) { }
          }
        }
      } catch (err) {
        console.error('Failed to sync daily gift points to backend:', err);
      }
    }
  }, [playerUsername, playerName]);

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
    // 1. Check Seerah (Full Completion: 3 groups / 60 questions)
    const seerahSaved = localStorage.getItem('quran_quiz_progress_seerah');
    if (seerahSaved) {
      try {
        const parsed = JSON.parse(seerahSaved);
        if ((parsed.easy >= 3 && parsed.hard >= 3) || (Number(parsed.score || 0) >= 60)) return 'seerah';
      } catch { }
    }

    // 2. Check General (Full Completion: 5 groups / 100 questions)
    const generalSaved = localStorage.getItem('quran_quiz_progress_general');
    if (generalSaved) {
      try {
        const parsed = JSON.parse(generalSaved);
        if (parsed.easy >= 5 && parsed.hard >= 5) return 'general';
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

  // Power-ups Inventory State ({ freeze: number, fiftyFifty: number })
  const [powerups, setPowerups] = useState<{ freeze: number; fiftyFifty: number }>(() => {
    const freeze = Number(localStorage.getItem('quran_freeze_count') ?? 3);
    const fiftyFifty = Number(localStorage.getItem('quran_delete_two_count') ?? 3);
    return {
      freeze: isNaN(freeze) ? 3 : freeze,
      fiftyFifty: isNaN(fiftyFifty) ? 3 : fiftyFifty
    };
  });
  const [freezeTimeCount, setFreezeTimeCount] = useState<number>(() => powerups.freeze);
  const [deleteTwoCount, setDeleteTwoCount] = useState<number>(() => powerups.fiftyFifty);
  const [isFreezeActive, setIsFreezeActive] = useState(false);
  const [freezeSecondsLeft, setFreezeSecondsLeft] = useState(0);
  const [isPowerUpUsedThisQuestion, setIsPowerUpUsedThisQuestion] = useState(false);
  const [eliminatedOptionIndices, setEliminatedOptionIndices] = useState<number[]>([]);
  const [isPurchasingPowerup, setIsPurchasingPowerup] = useState(false);

  useEffect(() => {
    setFreezeTimeCount(powerups.freeze);
    setDeleteTwoCount(powerups.fiftyFifty);
  }, [powerups.freeze, powerups.fiftyFifty]);

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
  const [isPullRefreshing, setIsPullRefreshing] = useState<boolean>(false);
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);
  const [privateRoomModal, setPrivateRoomModal] = useState<{ isOpen: boolean; room: any | null; password: string; error?: string }>({
    isOpen: false,
    room: null,
    password: '',
    error: undefined
  });
  const [v1IsStartingRoom, setV1IsStartingRoom] = useState(false);
  const [isSavingRoomSettings, setIsSavingRoomSettings] = useState(false);
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
  const [surahBonusInput, setSurahBonusInput] = useState<string>('');
  const [roomScopeMode, setRoomScopeMode] = useState<'juz' | 'surah'>('juz');
  const [roomSelectedJuzs, setRoomSelectedJuzs] = useState<number[]>([]);
  const [roomSelectedSurahs, setRoomSelectedSurahs] = useState<string[]>([]);
  const [roomSurahSearch, setRoomSurahSearch] = useState<string>('');
  const [roomSettings, setRoomSettings] = useState<ModularRoomSettings>({
    ayahCompletion: {
      isSelected: true,
      questionsCount: 5,
      scopeMode: 'juz',
      selectedJuzRange: [],
      selectedSurahs: []
    },
    surahName: {
      isSelected: false,
      questionsCount: 5,
      scopeMode: 'juz',
      selectedJuzRange: [],
      selectedSurahs: []
    },
    islamicQuestions: {
      isSelected: false,
      questionsCount: 5,
      categories: ['العقيدة'],
      topics: ['all'],
      topicCounts: { all: 5 },
      levels: [1, 2, 3]
    },
    audio: {
      isSelected: false,
      questionsCount: 5
    },
    whoAmI: {
      isSelected: false,
      questionsCount: 10,
      categories: ['أنبياء ورسل'],
      categoryCounts: { 'أنبياء ورسل': 10 }
    }
  });
  const [discoveredBonusSurahs, setDiscoveredBonusSurahs] = useState<string[]>([]);
  const [surahFeedbackData, setSurahFeedbackData] = useState<{
    isFullyCorrect: boolean;
    correctSurahs: string[];
    outOfRangeAnswers?: SurahAnswerWithDetails[];
    discoveredBonusSurahs?: string[];
  } | null>(null);
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
  const [sessionScore, setSessionScore] = useState(0);
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
    setSessionScore(0);
    setSessionWrong(0);
    setSessionMistakes([]);
    setShowMistakes(false);
    setCurrentChallengeIndex(0);
    setSessionCurrentIndex(0);
    setMatchedIds(new Set());
    setSpeedTimeLeft(skillsType === 'audio' ? 30 : 15);

    // Save chosen scope into state so activeScope uses them during challenge
    if (chosenJuzs && chosenJuzs.length > 0) {
      setSelectedSkillJuzs(chosenJuzs);
      setSelectedSkillSurahs([]);
    } else if (chosenSurahs && chosenSurahs.length > 0) {
      setSelectedSkillSurahs(chosenSurahs);
      setSelectedSkillJuzs([]);
    } else {
      setSelectedSkillJuzs([]);
      setSelectedSkillSurahs([]);
    }

    const dbType = skillsType === 'audio' ? 'STANDARD' : skillsType === 'complete' ? 'COMPLETION' : 'SURAH';
    const excludeIds = Array.from(completedChallengeIds);
    const isScopeActive = Boolean(
      (chosenJuzs && chosenJuzs.length > 0 && chosenJuzs.length < 30) ||
      (chosenSurahs && chosenSurahs.length > 0)
    );

    let pool: any[] = [];
    try {
      // If scope filter is active, fetch a larger candidate batch to find matching challenges
      const fetchLimit = isScopeActive ? 100 : count;
      let result = await fetchChallenges(dbType, fetchLimit, excludeIds);
      // RECYCLE LOOP: If zero new questions, recycle all original challenges
      if (!result || result.length === 0) {
        console.log('App: Recycling challenges for type:', dbType);
        result = await fetchChallenges(dbType, fetchLimit, []);
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

    // Merge with in-memory allChallenges
    if (allChallenges.length > 0) {
      const dbTypeMatches = allChallenges.filter(c => (c.type || '').toUpperCase() === dbType);
      const existingIds = new Set(pool.map(c => c.id));
      dbTypeMatches.forEach(c => {
        if (!existingIds.has(c.id)) {
          pool.push(c);
          existingIds.add(c.id);
        }
      });
    }

    // For SURAH challenges: Also convert any STANDARD challenges that have mutashabihat verses across multiple surahs
    if (dbType === 'SURAH' && allChallenges.length > 0) {
      const existingKeywords = new Set(pool.map(c => c.keyword || c.verseText));
      allChallenges.forEach(c => {
        if ((!c.type || c.type === 'STANDARD') && Array.isArray(c.verses) && c.verses.length > 0) {
          const kw = c.keyword || c.verseText;
          if (kw && !existingKeywords.has(kw)) {
            const surahs = Array.from(new Set(c.verses.map((v: any) => v.surah).filter(Boolean)));
            if (surahs.length > 0) {
              pool.push({
                ...c,
                id: c.id >= 10000 ? c.id : 50000 + c.id,
                type: 'SURAH',
                correctText: JSON.stringify(surahs),
                verses: c.verses
              });
              existingKeywords.add(kw);
            }
          }
        }
      });
    }

    // Helper functions for matching
    const isSurahMatch = (c: any) => {
      const surahsInChallenge: string[] = [];
      if (Array.isArray(c.verses)) {
        c.verses.forEach((v: any) => {
          if (v?.surah) surahsInChallenge.push(String(v.surah));
        });
      }
      if (c.correctText) {
        try {
          if (String(c.correctText).startsWith('[')) {
            const parsed = JSON.parse(c.correctText);
            if (Array.isArray(parsed)) surahsInChallenge.push(...parsed);
          } else {
            surahsInChallenge.push(String(c.correctText));
          }
        } catch {}
      }
      if (c.category) surahsInChallenge.push(String(c.category));
      if (c.keyword) surahsInChallenge.push(String(c.keyword));

      return (chosenSurahs || []).some(s => {
        const cleanS = s.replace(/^سورة\s+/, '').trim();
        const cleanSNorm = cleanS.replace(/[أإآ]/g, 'ا');
        return surahsInChallenge.some(item => {
          const cleanItem = String(item).replace(/^سورة\s+/, '').trim();
          const cleanItemNorm = cleanItem.replace(/[أإآ]/g, 'ا');
          return cleanItem === cleanS || cleanItemNorm === cleanSNorm || cleanItem.includes(cleanS) || cleanItemNorm.includes(cleanSNorm);
        });
      });
    };

    const isJuzMatch = (c: any) => {
      const juzsInChallenge: number[] = [];
      if (Array.isArray(c.verses)) {
        c.verses.forEach((v: any) => {
          if (v?.surah) {
            const trueJuzs = getTrueJuzForPosition(v.surah, v.number || v.verse_number, v.juz);
            juzsInChallenge.push(...trueJuzs);
          } else if (v?.juz) {
            juzsInChallenge.push(Number(v.juz));
          }
        });
      }
      if (c.surah) {
        const trueJuzs = getTrueJuzForPosition(c.surah, c.verse_number || c.number, c.juz);
        juzsInChallenge.push(...trueJuzs);
      }
      if (juzsInChallenge.some(j => (chosenJuzs || []).includes(j))) return true;

      if (!c.category) return false;
      return (chosenJuzs || []).some(j => {
        const arOrdinal = JUZ_NAMES_AR[j] || '';
        return (
          (arOrdinal && c.category.includes(arOrdinal)) ||
          c.category.includes(`الجزء ${j}`) ||
          c.category.includes(`جزء ${j}`)
        );
      });
    };

    // Strict Scope Filtering
    if (dbType === 'SURAH') {
      const currentScope = {
        scopeMode: (chosenSurahs && chosenSurahs.length > 0 ? 'surah' : 'juz') as 'surah' | 'juz',
        selectedJuzs: chosenJuzs || [],
        selectedSurahs: chosenSurahs || []
      };
      const candidates = pool.length > 0 ? pool : allChallenges;
      pool = getAvailableSurahChallenges(candidates, currentScope);
    } else if (isScopeActive && pool.length > 0) {
      const currentScope = {
        scopeMode: (chosenSurahs && chosenSurahs.length > 0 ? 'surah' : 'juz') as 'surah' | 'juz',
        selectedJuzs: chosenJuzs || [],
        selectedSurahs: chosenSurahs || []
      };

      if (dbType === 'COMPLETION') {
        if (currentScope.scopeMode === 'surah') {
          let surahFiltered = pool.filter(isSurahMatch);
          if (surahFiltered.length < count) {
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
          pool = surahFiltered;
        } else {
          let juzFiltered = pool.filter(isJuzMatch);
          if (juzFiltered.length < count) {
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
          pool = juzFiltered;
        }
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

  const [isPageModeActive, setIsPageModeActive] = useState(true);
  const prevViewForMushafRef = useRef<View>(view);
  useEffect(() => {
    if (view === 'mushaf' && prevViewForMushafRef.current !== 'mushaf') {
      setIsPageModeActive(true);
    }
    prevViewForMushafRef.current = view;
  }, [view]);
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
    setIncompleteChallenge(null);
    localStorage.removeItem('quran_incomplete_challenge');
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
  const addPoint = useCallback((metadata?: { challengeId?: number; roomId?: string; points?: number }) => {
    let nextVal = 0;
    const pts = metadata?.points ?? 1;
    setTotalPoints(prev => {
      nextVal = prev + pts;
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
          points: pts,
          totalPoints: nextVal,
          challengeId: metadata?.challengeId,
          roomId: metadata?.roomId
        })
      })
      .then(res => res.json())
      .then(data => {
        const p = data?.player || data?.user || data;
        if (p && typeof p.points === 'number') {
          setTotalPoints(p.points);
          try {
            localStorage.setItem('quran_total_points', String(p.points));
          } catch (e) {}
        }
      })
      .catch(err => console.error('Failed to sync point to backend:', err));
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
      const savedIncomplete = localStorage.getItem('quran_incomplete_challenge');
      if (savedIncomplete) {
        try {
          const parsed = JSON.parse(savedIncomplete);
          if (parsed.mode === 'daily') {
            setIncompleteChallenge(null);
            localStorage.removeItem('quran_incomplete_challenge');
          }
        } catch {}
      }
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
          path = (urlOrParams || '').split('?')[0];
        }
      } else if (urlOrParams instanceof URLSearchParams) {
        params = urlOrParams;
      } else {
        params = new URLSearchParams(window.location.search);
      }

      // 0. Login / Auth route
      if (path === '/login' || path === '/auth') {
        setShowScores(false);
        setIsMushafFullscreen(false);
        setView('home', false);
        return;
      }

      // 1. Mushaf route (/mushaf, /library/mushaf, /library/quran)
      const isExplicitMushaf =
        path === '/mushaf' ||
        path.startsWith('/mushaf/') ||
        path === '/library/mushaf' ||
        path.startsWith('/library/mushaf/') ||
        path === '/library/quran' ||
        path.startsWith('/library/quran/') ||
        params.get('view') === 'mushaf';

      if (isExplicitMushaf) {
        const pageParam = params.get('page');
        const pageNum = pageParam ? parseInt(pageParam, 10) : NaN;
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
          setCurrentPage(pageNum);
        }
        setIsMushafFullscreen(false);
        setShowScores(false);
        setIsPageModeActive(true);
        setView('mushaf', false);
        return;
      }

      // 2. Adhkar route (/library/adhkar/morning, /adhkar/morning, /adhkar/[type])
      const isExplicitAdhkar =
        path === '/adhkar' ||
        path.startsWith('/adhkar/') ||
        path === '/library/adhkar' ||
        path.startsWith('/library/adhkar/') ||
        params.get('view') === 'adhkar';

      if (isExplicitAdhkar) {
        let typeOrCategory: string | null = null;
        if (path?.startsWith('/library/adhkar/')) {
          const sub = (path || '').replace('/library/adhkar/', '').split('/')[0]?.split('?')[0]?.trim() || '';
          if (sub) typeOrCategory = sub;
        } else if (path?.startsWith('/adhkar/')) {
          const sub = (path || '').replace('/adhkar/', '').split('/')[0]?.split('?')[0]?.trim() || '';
          if (sub) typeOrCategory = sub;
        }
        if (!typeOrCategory) {
          typeOrCategory = params.get('type') || params.get('category') || params.get('id');
        }

        if (typeOrCategory) {
          const resolvedCategory = resolveAdhkarCategoryId(typeOrCategory);
          setSelectedAdhkarCategoryId(resolvedCategory);
        } else {
          setSelectedAdhkarCategoryId(null);
        }
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('adhkar', false);
        return;
      }

      // 3. Hadith route (/hadith, /library/hadith)
      if (path === '/hadith' || path.startsWith('/hadith/') || path === '/library/hadith' || path.startsWith('/library/hadith/')) {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setSelectedHadith(null);
        setView('hadith', false);
        return;
      }

      // 4. Book route (/book, /library/book)
      if (path === '/book' || path.startsWith('/book/') || path === '/library/book' || path.startsWith('/library/book/')) {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('book', false);
        return;
      }

      // 5. Encyclopedia route (/encyclopedia, /library/encyclopedia)
      if (path === '/encyclopedia' || path.startsWith('/encyclopedia/') || path === '/library/encyclopedia' || path.startsWith('/library/encyclopedia/')) {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('encyclopedia', false);
        return;
      }

      // 6. Islamic Videos route (/islamic_videos, /library/islamic_videos, /library/videos)
      if (path === '/islamic_videos' || path.startsWith('/islamic_videos/') || path === '/library/islamic_videos' || path.startsWith('/library/islamic_videos/') || path === '/library/videos') {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('islamic_videos', false);
        return;
      }

      // If user is at root '/', stay on home (or restore view strictly on initial page mount)
      if (path === '/' || path === '') {
        // If this is an explicit navigation to root '/', always go to home immediately and clear saved view
        if (typeof urlOrParams === 'string' && (urlOrParams === '/' || urlOrParams === '' || urlOrParams.includes('home'))) {
          sessionStorage.setItem('current_app_view', 'home');
          setSelectedAdhkarCategoryId(null);
          setIsMushafFullscreen(false);
          setShowScores(false);
          setView('home', false);
          return;
        }

        const savedView = sessionStorage.getItem('current_app_view');
        setSelectedAdhkarCategoryId(null);
        setIsMushafFullscreen(false);
        setShowScores(false);
        if (savedView && VALID_VIEWS.includes(savedView as View) && savedView !== 'home') {
          setView(savedView as View, false);
        } else {
          sessionStorage.setItem('current_app_view', 'home');
          setView('home', false);
        }
        if (window.location.search && !params.get('roomId') && !params.get('code')) {
          try {
            window.history.replaceState({ view: 'home' }, '', '/');
          } catch { }
        }
        return;
      }

      const cleanPath = (path || '').replace(/^\//, '').split('?')[0]?.split('#')[0] || '';
      const rootSegment = cleanPath.split('/')[0] || '';

      if (cleanPath === 'challenge/results' || cleanPath.startsWith('challenge/results')) {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('group_game', false);
        return;
      }

      if (rootSegment === 'leaderboard' || rootSegment === 'scores') {
        setIsMushafFullscreen(false);
        setShowScores(true);
        return;
      }

      if (rootSegment === 'challenges') {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('challenges', false);
        return;
      }

      if (rootSegment === 'library') {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('library', false);
        return;
      }

      if (rootSegment === 'settings') {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('settings', false);
        return;
      }

      if (rootSegment === 'daily-chest-challenge' || rootSegment === 'chest-challenge') {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('daily_chest_challenge', false);
        return;
      }

      if (rootSegment === 'room') {
        const targetRoomId = (cleanPath || '').split('/')[1] || params.get('roomId') || params.get('room') || params.get('code');
        if (targetRoomId) {
          setIsMushafFullscreen(false);
          setShowScores(false);
          handleJoinV1(targetRoomId);
        }
        return;
      }

      if (rootSegment === 'admin') {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView('admin', false);
        return;
      }

      if (VALID_VIEWS.includes(rootSegment as View)) {
        setIsMushafFullscreen(false);
        setShowScores(false);
        setView(rootSegment as View, false);
      }
    };

    // 1. Check URL parameters immediately on mount
    handleAppDeepLink();

    // 2. Listen for deep link events from Service Worker, Window & popstate (when notification is clicked or history changes)
    const deepLinkListener = (event: MessageEvent) => {
      if (event.data?.type === 'DEEP_LINK_NAVIGATE') {
        const targetRoute = event.data.data?.route || event.data.route || event.data.url;
        handleAppDeepLink(targetRoute);
      }
    };

    const popstateListener = () => {
      handleAppDeepLink();
    };

    const customNavigateListener = (e: any) => {
      if (e.detail?.route) {
        handleAppDeepLink(e.detail.route);
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', deepLinkListener);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('message', deepLinkListener);
      window.addEventListener('popstate', popstateListener);
      window.addEventListener('app_navigate', customNavigateListener);
    }

    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', deepLinkListener);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('message', deepLinkListener);
        window.removeEventListener('popstate', popstateListener);
        window.removeEventListener('app_navigate', customNavigateListener);
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
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      // 1. Direct query to Supabase (bypasses any intermediate cache layer)
      const sbPromise = supabase
        .from('rooms')
        .select('*')
        .eq('status', 'WAITING')
        .gte('createdAt', tenMinutesAgo)
        .order('createdAt', { ascending: false })
        .limit(40);

      // 2. Fetch from backend API with cache invalidation (_t timestamp and headers)
      const apiPromise = fetch(`/api/1v1?action=list-rooms&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }).then(res => res.json()).catch(() => null);

      const [sbRes, apiData] = await Promise.all([sbPromise, apiPromise]);

      if (apiData && Array.isArray(apiData.rooms)) {
        setAvailableRooms(apiData.rooms);
      } else if (sbRes && !sbRes.error && Array.isArray(sbRes.data)) {
        const formatted = sbRes.data.map((r: any) => {
          const progress = (r.playersProgress as any) || {};
          const participantCount = Object.keys(progress).length || 1;
          return {
            id: r.id,
            name: r.name || 'غرفة التحدي',
            isPrivate: Boolean(r.isPrivate),
            status: r.status,
            questionCount: r.questionCount,
            timePerQuestion: r.timePerQuestion,
            gameMode: r.gameMode,
            transitionMode: r.transitionMode || 'SYNC',
            participantCount,
            hostId: r.player1Id,
            hostName: r.hostName || 'مجهول',
            hostUsername: r.hostUsername || null,
            createdAt: r.createdAt
          };
        });
        setAvailableRooms(formatted);
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    } finally {
      if (showLoading) setIsLoadingRooms(false);
    }
  }, []);

  // Requirement 1: Prevent room duplication in room list when socket/realtime updates arrive
  const updateRoomInList = useCallback((newRoom: any) => {
    if (!newRoom || !newRoom.id) return;
    setAvailableRooms(prev => prev.some(r => r.id === newRoom.id) ? prev.map(r => r.id === newRoom.id ? newRoom : r) : [...prev, newRoom]);
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

  // تحديث البيانات الحقيقي عند السحب للتحديث (Pull to Refresh Handler)
  const handlePullToRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    setIsLoadingRooms(true);
    try {
      const tasks: Promise<any>[] = [
        fetchAvailableRooms(true),
        fetchSettings(),
        fetchChallenges(),
        fetchCompletionChallenges()
      ];

      // Refresh player score and profile
      const pUnique = uniquePlayerId || localStorage.getItem('quran_unique_player_id');
      const pUser = playerUsername || localStorage.getItem('quran_player_username');
      const pName = playerName || localStorage.getItem('quran_player_name');
      const pId = localStorage.getItem('quran_player_id');
      if (pUnique || pUser || pName || pId) {
        const params = new URLSearchParams({ t: Date.now().toString() });
        if (pId) params.append('id', pId);
        if (pUnique) params.append('uniquePlayerId', pUnique);
        if (pUser) params.append('username', pUser);
        if (pName) params.append('name', pName);
        tasks.push(
          fetch(`/api/users/me?${params.toString()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
          }).then(r => r.json()).then(data => {
            if (data?.user) {
              if (typeof data.user.points === 'number') setTotalPoints(data.user.points);
              if (typeof data.user.cups === 'number') setCups(data.user.cups);
              if (typeof data.user.streak === 'number') setStreak(data.user.streak);
            }
          }).catch(() => {})
        );
      }

      await Promise.allSettled(tasks);
    } catch (err) {
      console.warn('PullToRefresh background error:', err);
    } finally {
      setIsPullRefreshing(false);
      setIsLoadingRooms(false);
    }
  }, [fetchAvailableRooms, fetchSettings, fetchChallenges, fetchCompletionChallenges, uniquePlayerId, playerUsername, playerName]);

  const fetchAvailableSkillCounts = useCallback(async () => {
    const audioLocal = allChallenges.filter(c => {
      const t = (c.type || '').toUpperCase();
      return t === 'STANDARD' || t === 'AUDIO' || t === '';
    }).length;
    const completeLocal = allChallenges.filter(c => (c.type || '').toUpperCase() === 'COMPLETION').length;
    const surahAvailable = getAvailableSurahChallenges(allChallenges, {
      scopeMode: roomScopeMode,
      selectedJuzs: roomSelectedJuzs,
      selectedSurahs: roomSelectedSurahs
    }).length;

    setAvailableSkillCounts({
      audio: audioLocal > 0 ? audioLocal : 20,
      complete: Math.max(100, completeLocal),
      surah: Math.max(24, surahAvailable)
    });

    try {
      const res = await fetch('/api/1v1?action=available-counts');
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setAvailableSkillCounts({
            audio: Math.max(audioLocal, Number(data.counts.audio) || 0),
            complete: Math.max(100, completeLocal, Number(data.counts.complete) || 0),
            surah: Math.max(24, surahAvailable, Number(data.counts.surah) || 0)
          });
        }
      }
    } catch {
      // Fallback already set
    }
  }, [allChallenges, roomScopeMode, roomSelectedJuzs, roomSelectedSurahs]);

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

    // 1. Audio challenge: manual database records
    if (v1GameModes.includes('audio') && !systemSettings.hideAudioChallenge) {
      const audioCount = Math.max(0, Number(roomSettings.audio?.questionsCount || skillQuestionCounts.audio) || 0);
      const maxAudio = availableSkillCounts.audio || 0;
      if (audioCount <= 0 || (maxAudio > 0 && audioCount > maxAudio)) {
        return true;
      }
    }

    // 2. Completion challenge: dynamic generation from Quran
    if (v1GameModes.includes('complete') && !systemSettings.hideCompletionChallenge) {
      const completeCount = Math.max(0, Number(roomSettings.ayahCompletion?.questionsCount || skillQuestionCounts.complete) || 0);
      if (completeCount <= 0 || completeCount > 100) {
        return true;
      }
    }

    // 3. Surah challenge: dynamic validation from Quran scope
    if (v1GameModes.includes('surah') && !systemSettings.hideSurahChallenge) {
      const surahCount = Math.max(0, Number(roomSettings.surahName?.questionsCount || skillQuestionCounts.surah) || 0);
      if (surahCount <= 0) {
        return true;
      }
      const sScope = {
        scopeMode: roomSettings.surahName?.scopeMode || roomScopeMode,
        selectedJuzs: roomSettings.surahName?.selectedJuzRange || roomSelectedJuzs,
        selectedSurahs: roomSettings.surahName?.selectedSurahs || roomSelectedSurahs
      };
      const surahVal = validateSurahChallengeScope(allChallenges, sScope, surahCount);
      if (!surahVal.isValid) {
        return true;
      }
    }

    // 4. Islamic questions
    if (v1GameModes.includes('islamic')) {
      if (islamicRoomTopics.includes('all')) {
        const count = Math.max(0, Number(islamicTopicQuestionCounts['all'] ?? roomSettings.islamicQuestions?.questionsCount) || 0);
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
  }, [
    v1GameModes,
    skillQuestionCounts,
    roomSettings,
    availableSkillCounts,
    allChallenges,
    roomScopeMode,
    roomSelectedJuzs,
    roomSelectedSurahs,
    selectedWhoAmICategories,
    whoAmICategoryCounts,
    islamicRoomTopics,
    islamicTopicQuestionCounts,
    islamicRoomCategories,
    islamicRoomLevels,
    systemSettings
  ]);

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
          setSessionScore(0);
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
          try {
            sessionStorage.setItem(`is_creator_${data.id}`, 'true');
          } catch (_) {}
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
      if ((roomSettings.ayahCompletion.isSelected || effectiveGameModes.includes('complete')) && !systemSettings.hideCompletionChallenge) {
        const completeCount = Math.max(0, Number(roomSettings.ayahCompletion.questionsCount || skillQuestionCounts.complete) || 0);
        if (completeCount > 0) {
          let pool = allChallenges.filter(c => (c.type || '').toUpperCase() === 'COMPLETION');
          const cScopeMode = roomSettings.ayahCompletion.scopeMode || roomScopeMode;
          const cSurahs = roomSettings.ayahCompletion.selectedSurahs?.length ? roomSettings.ayahCompletion.selectedSurahs : roomSelectedSurahs;
          const cJuzs = roomSettings.ayahCompletion.selectedJuzRange?.length ? roomSettings.ayahCompletion.selectedJuzRange : roomSelectedJuzs;

          if (cScopeMode === 'surah' && cSurahs.length > 0) {
            const filtered = pool.filter(c => {
              const s = c.verses?.[0]?.surah || c.category || c.keyword || '';
              return cSurahs.some(rs => normalizeSurahName(rs) === normalizeSurahName(s) || s.includes(rs));
            });
            if (filtered.length >= Math.min(3, completeCount)) pool = filtered;
          } else if (cScopeMode === 'juz' && cJuzs.length > 0 && cJuzs.length < 30) {
            const filtered = pool.filter(c => {
              const j = c.verses?.[0]?.juz || (c.verses?.[0]?.surah ? getJuzsForSurah(c.verses[0].surah)[0] : null);
              return j ? cJuzs.includes(Number(j)) : true;
            });
            if (filtered.length >= Math.min(3, completeCount)) pool = filtered;
          }
          const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, completeCount);
          if (picked.length < completeCount) {
            const needed = completeCount - picked.length;
            const gen = generateCompletionChallenges(needed, {
              surahs: cScopeMode === 'surah' ? cSurahs : undefined,
              juzs: cScopeMode === 'juz' ? cJuzs : undefined
            });
            const mappedGen = gen.map((g, idx) => ({
              id: 98000 + picked.length + idx,
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
                id: `gen-comp-${idx}`,
                number: 1,
                text: g.prompt,
                surah: g.surah || '',
                juz: g.juz || 1
              }]
            }));
            picked.push(...mappedGen);
          }
          customChallenges.push(...picked);
        }
      }

      // 3. Surah challenges
      if ((roomSettings.surahName.isSelected || effectiveGameModes.includes('surah')) && !systemSettings.hideSurahChallenge) {
        const surahCount = Math.max(0, Number(roomSettings.surahName.questionsCount || skillQuestionCounts.surah) || 0);
        if (surahCount > 0) {
          const sScopeMode = roomSettings.surahName.scopeMode || roomScopeMode;
          const sSurahs = roomSettings.surahName.selectedSurahs?.length ? roomSettings.surahName.selectedSurahs : roomSelectedSurahs;
          const sJuzs = roomSettings.surahName.selectedJuzRange?.length ? roomSettings.surahName.selectedJuzRange : roomSelectedJuzs;

          const available = getAvailableSurahChallenges(allChallenges, {
            scopeMode: sScopeMode,
            selectedJuzs: sJuzs,
            selectedSurahs: sSurahs
          });
          const picked = [...available].sort(() => Math.random() - 0.5).slice(0, surahCount);
          if (picked.length < surahCount) {
            const needed = surahCount - picked.length;
            const extra = generateSurahChallenges(needed, {
              surahs: sScopeMode === 'surah' ? sSurahs : undefined,
              juzs: sScopeMode === 'juz' ? sJuzs : undefined
            });
            picked.push(...extra);
          }
          customChallenges.push(...picked);
        }
      }

      // 4. Targeted Islamic questions
      const effectiveIslamicCategories = (roomSettings.islamicQuestions?.isSelected && roomSettings.islamicQuestions.categories?.length)
        ? roomSettings.islamicQuestions.categories
        : islamicRoomCategories;

      const effectiveIslamicLevels = (roomSettings.islamicQuestions?.isSelected && roomSettings.islamicQuestions.levels?.length)
        ? roomSettings.islamicQuestions.levels
        : islamicRoomLevels;

      const effectiveIslamicTopics = (roomSettings.islamicQuestions?.isSelected && roomSettings.islamicQuestions.topics?.length)
        ? roomSettings.islamicQuestions.topics
        : islamicRoomTopics;

      const effectiveIslamicTopicCounts = (roomSettings.islamicQuestions?.isSelected && roomSettings.islamicQuestions.topicCounts && Object.keys(roomSettings.islamicQuestions.topicCounts).length)
        ? roomSettings.islamicQuestions.topicCounts
        : islamicTopicQuestionCounts;

      if (isIslamicIncluded) {
        const allocations: Record<string, number> = {};
        if (effectiveIslamicTopics.includes('all')) {
          allocations['all'] = Math.max(0, Number(effectiveIslamicTopicCounts['all'] ?? roomSettings.islamicQuestions?.questionsCount) || 5);
        } else {
          effectiveIslamicTopics.forEach(t => {
            allocations[t] = Math.max(0, Number(effectiveIslamicTopicCounts[t]) || 0);
          });
        }
        const islamicQs = getTargetedIslamicQuestions(allocations, effectiveIslamicLevels, effectiveIslamicCategories);
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
        categories: isIslamicIncluded ? effectiveIslamicCategories : (v1Category ? [v1Category] : []),
        category: isIslamicIncluded ? effectiveIslamicCategories[0] : v1Category,
        levels: isIslamicIncluded ? effectiveIslamicLevels : undefined,
        topics: isIslamicIncluded ? effectiveIslamicTopics : undefined,
        questionCount: count,
        timePerQuestion: v1Timer ? v1TimePerQuestion : 0,
        transitionMode: v1TransitionMode,
        customChallenges: finalCustomChallenges,
        roomSettings: roomSettings,
        room_settings: roomSettings,
        selected_juz: (roomSettings.surahName.isSelected ? roomSettings.surahName.selectedJuzRange : roomSettings.ayahCompletion.selectedJuzRange) || (roomScopeMode === 'juz' ? roomSelectedJuzs : []),
        selected_surahs: (roomSettings.surahName.isSelected ? roomSettings.surahName.selectedSurahs : roomSettings.ayahCompletion.selectedSurahs) || (roomScopeMode === 'surah' ? roomSelectedSurahs : []),
        scopeMode: (roomSettings.surahName.isSelected ? roomSettings.surahName.scopeMode : roomSettings.ayahCompletion.scopeMode) || roomScopeMode,
        surahFilters: {
          roomSettings: roomSettings,
          ayahCompletion: roomSettings.ayahCompletion,
          surahName: roomSettings.surahName,
          islamicQuestions: roomSettings.islamicQuestions,
          scopeMode: (roomSettings.surahName.isSelected ? roomSettings.surahName.scopeMode : roomSettings.ayahCompletion.scopeMode) || roomScopeMode,
          selected_juz: (roomSettings.surahName.isSelected ? roomSettings.surahName.selectedJuzRange : roomSettings.ayahCompletion.selectedJuzRange) || (roomScopeMode === 'juz' ? roomSelectedJuzs : []),
          selected_surahs: (roomSettings.surahName.isSelected ? roomSettings.surahName.selectedSurahs : roomSettings.ayahCompletion.selectedSurahs) || (roomScopeMode === 'surah' ? roomSelectedSurahs : [])
        }
      };

      console.log('Request Body being sent:', requestBody);

      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await res.json();
      if (res.ok) {
        try {
          sessionStorage.setItem(`is_creator_${data.id}`, 'true');
        } catch (_) {}
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

  const prefillRoomSettingsForEdit = useCallback((targetRoom: any) => {
    if (!targetRoom) return;

    // Refresh available counts in background
    fetchAvailableSkillCounts();

    // 1. Basic settings
    setV1RoomName(targetRoom.name || 'غرفة التحدي');
    setV1IsPrivate(Boolean(targetRoom.isPrivate));
    setV1RoomPassword(targetRoom.password || '');

    const timeVal = Number(targetRoom.timePerQuestion) || 0;
    setV1Timer(timeVal > 0);
    setV1TimePerQuestion(timeVal > 0 ? timeVal : 20);
    setV1TransitionMode(targetRoom.transitionMode === 'ASYNC' ? 'ASYNC' : 'SYNC');

    // 2. Identify game modes
    const rawMode = String(targetRoom.gameMode || '').toUpperCase();
    const rawModes: string[] = Array.isArray(targetRoom.gameModes)
      ? targetRoom.gameModes.map((m: any) => String(m).toUpperCase())
      : [];

    const isWhoAmI = rawMode === 'WHO_AM_I' || rawModes.includes('WHO_AM_I') || targetRoom.challenge_type === 'who_am_i';
    const isIslamic = rawMode === 'ISLAMIC' || rawModes.includes('ISLAMIC');

    if (isWhoAmI) {
      setV1GameModes(['who_am_i']);

      let configs: { category: string; count: number }[] = [];
      if (Array.isArray(targetRoom.categories_config) && targetRoom.categories_config.length > 0) {
        configs = targetRoom.categories_config;
      } else if (Array.isArray(targetRoom.surahFilters) && targetRoom.surahFilters.length > 0) {
        if (typeof targetRoom.surahFilters[0] === 'object' && targetRoom.surahFilters[0]?.category) {
          configs = targetRoom.surahFilters;
        } else if (typeof targetRoom.surahFilters[0] === 'string') {
          const perCat = Math.max(1, Math.floor((Number(targetRoom.questionCount) || 10) / targetRoom.surahFilters.length));
          configs = targetRoom.surahFilters.map((s: string) => ({ category: s, count: perCat }));
        }
      } else if (targetRoom.category || targetRoom.categoryFilter) {
        const catStr = String(targetRoom.categoryFilter || targetRoom.category || '');
        const parts = (catStr || '').split('+');
        for (const p of parts) {
          const m = p.match(/(.*?)\s*\((\d+)\)/);
          if (m) {
            configs.push({ category: m[1].trim(), count: parseInt(m[2], 10) || 1 });
          } else if (p.trim()) {
            configs.push({ category: p.trim(), count: 5 });
          }
        }
      }

      if (configs.length > 0) {
        setSelectedWhoAmICategories(configs.map(c => c.category));
        const countsMap: Record<string, number> = {};
        configs.forEach(c => {
          countsMap[c.category] = c.count;
        });
        setWhoAmICategoryCounts(prev => ({ ...prev, ...countsMap }));
      } else {
        setSelectedWhoAmICategories(['الصحابة']);
        setWhoAmICategoryCounts(prev => ({ ...prev, 'الصحابة': Number(targetRoom.questionCount) || 5 }));
      }
      return;
    }

    // If not WHO_AM_I
    const activeModes: ('audio' | 'complete' | 'surah' | 'islamic')[] = [];

    if (isIslamic) {
      activeModes.push('islamic');
    }

    if (rawModes.length > 0) {
      if (rawModes.some(m => m === 'AUDIO' || m === 'STANDARD')) activeModes.push('audio');
      if (rawModes.some(m => m === 'COMPLETION' || m === 'COMPLETE')) activeModes.push('complete');
      if (rawModes.some(m => m === 'SURAH')) activeModes.push('surah');
      if (rawModes.some(m => m === 'ISLAMIC') && !activeModes.includes('islamic')) activeModes.push('islamic');
    } else if (rawMode === 'COMPLETION' || rawMode === 'COMPLETE') {
      activeModes.push('complete');
    } else if (rawMode === 'SURAH') {
      activeModes.push('surah');
    } else if (rawMode === 'AUDIO' || rawMode === 'STANDARD') {
      activeModes.push('audio');
    } else if (rawMode === 'MIXED') {
      const challengesList = Array.isArray(targetRoom.challenges)
        ? targetRoom.challenges
        : (Array.isArray(targetRoom.challengeIds) && typeof targetRoom.challengeIds[0] === 'object' ? targetRoom.challengeIds : []);

      if (challengesList.length > 0) {
        if (challengesList.some((c: any) => (c.type || '').toUpperCase() === 'COMPLETION')) activeModes.push('complete');
        if (challengesList.some((c: any) => (c.type || '').toUpperCase() === 'SURAH')) activeModes.push('surah');
        if (challengesList.some((c: any) => {
          const t = (c.type || '').toUpperCase();
          return t === 'STANDARD' || t === 'AUDIO' || t === '';
        })) activeModes.push('audio');
        if (challengesList.some((c: any) => (c.type || '').toUpperCase() === 'ISLAMIC') && !activeModes.includes('islamic')) {
          activeModes.push('islamic');
        }
      } else {
        activeModes.push('complete', 'surah');
      }
    }

    if (activeModes.length === 0) {
      activeModes.push('complete');
    }

    setV1GameModes(activeModes);

    // Parse counts per skill
    const challengesList = Array.isArray(targetRoom.challenges)
      ? targetRoom.challenges
      : (Array.isArray(targetRoom.challengeIds) && typeof targetRoom.challengeIds[0] === 'object' ? targetRoom.challengeIds : []);

    if (challengesList.length > 0) {
      const audioCount = challengesList.filter((c: any) => {
        const t = (c.type || '').toUpperCase();
        return t === 'STANDARD' || t === 'AUDIO' || t === '';
      }).length;
      const completeCount = challengesList.filter((c: any) => (c.type || '').toUpperCase() === 'COMPLETION').length;
      const surahCount = challengesList.filter((c: any) => (c.type || '').toUpperCase() === 'SURAH').length;

      setSkillQuestionCounts({
        audio: activeModes.includes('audio') ? (audioCount || 5) : 0,
        complete: activeModes.includes('complete') ? (completeCount || 5) : 0,
        surah: activeModes.includes('surah') ? (surahCount || 5) : 0
      });
    } else {
      const totalQ = Number(targetRoom.questionCount) || 5;
      const perMode = Math.max(1, Math.floor(totalQ / Math.max(1, activeModes.length)));
      setSkillQuestionCounts({
        audio: activeModes.includes('audio') ? perMode : 0,
        complete: activeModes.includes('complete') ? perMode : 0,
        surah: activeModes.includes('surah') ? perMode : 0
      });
    }

    // Islamic config
    if (activeModes.includes('islamic')) {
      if (Array.isArray(targetRoom.surahFilters) && targetRoom.surahFilters.length > 0) {
        setIslamicRoomTopics(targetRoom.surahFilters);
      }
      if (Array.isArray(targetRoom.categories) && targetRoom.categories.length > 0) {
        setIslamicRoomCategories(targetRoom.categories);
      } else if (targetRoom.categoryFilter) {
        setIslamicRoomCategories([targetRoom.categoryFilter]);
      }
      if (Array.isArray(targetRoom.levels) && targetRoom.levels.length > 0) {
        setIslamicRoomLevels(targetRoom.levels);
      }
    }

    // Quran Scope config (Juzs & Surahs)
    const scope = getActiveScope(targetRoom);
    setRoomScopeMode(scope.scopeMode);
    setRoomSelectedJuzs(scope.selectedJuzs);
    setRoomSelectedSurahs(scope.selectedSurahs);
  }, [fetchAvailableSkillCounts]);

  const handleUpdateRoomSettings = async (roomId: string): Promise<boolean> => {
    if (!roomId) return false;
    if (v1IsPrivate && !v1RoomPassword.trim()) {
      toast.error('يرجى كتابة كلمة المرور للغرفة الخاصة');
      return false;
    }
    if (totalConfiguredQuestions <= 0) {
      toast.error('يرجى تحديد عدد الأسئلة لمهارة واحدة على الأقل');
      return false;
    }
    if (hasCountValidationErrors) {
      toast.error('يرجى تصحيح الأعداد التي تتجاوز الحد المتاح');
      return false;
    }

    setIsSavingRoomSettings(true);
    try {
      let updatePayload: any = {};

      if (v1GameModes.includes('who_am_i')) {
        const categories_config = selectedWhoAmICategories.map(cat => ({
          category: cat,
          count: Math.max(1, Number(whoAmICategoryCounts[cat]) || 1)
        }));
        const totalCount = Math.max(1, categories_config.reduce((sum, c) => sum + c.count, 0));
        const categorySummary = categories_config.map(c => `${c.category} (${c.count})`).join(' + ');

        const customChallenges = Array.from({ length: totalCount }, (_, i) => ({
          id: i + 1,
          type: 'WHO_AM_I',
          keyword: 'من أنا؟',
          text: 'من أنا؟'
        }));

        updatePayload = {
          name: v1RoomName.trim() || 'تحدي من أنا؟',
          isPrivate: v1IsPrivate,
          password: v1IsPrivate ? v1RoomPassword.trim() : null,
          gameMode: 'WHO_AM_I',
          surahFilters: categories_config,
          categoryFilter: categorySummary,
          questionCount: totalCount,
          timePerQuestion: 40,
          transitionMode: 'SYNC',
          challengeIds: customChallenges
        };
      } else {
        const effectiveGameModes = v1GameModes.filter(m => {
          if (m === 'audio' && systemSettings.hideAudioChallenge) return false;
          if (m === 'complete' && systemSettings.hideCompletionChallenge) return false;
          if (m === 'surah' && systemSettings.hideSurahChallenge) return false;
          return true;
        });

        const isIslamicIncluded = effectiveGameModes.includes('islamic');
        let customChallenges: any[] = [];

        // 1. Audio
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

        // 2. Completion
        if ((roomSettings.ayahCompletion.isSelected || effectiveGameModes.includes('complete')) && !systemSettings.hideCompletionChallenge) {
          const completeCount = Math.max(0, Number(roomSettings.ayahCompletion.questionsCount || skillQuestionCounts.complete) || 0);
          if (completeCount > 0) {
            let pool = allChallenges.filter(c => (c.type || '').toUpperCase() === 'COMPLETION');
            const cScopeMode = roomSettings.ayahCompletion.scopeMode || roomScopeMode;
            const cSurahs = roomSettings.ayahCompletion.selectedSurahs?.length ? roomSettings.ayahCompletion.selectedSurahs : roomSelectedSurahs;
            const cJuzs = roomSettings.ayahCompletion.selectedJuzRange?.length ? roomSettings.ayahCompletion.selectedJuzRange : roomSelectedJuzs;

            if (cScopeMode === 'surah' && cSurahs.length > 0) {
              const filtered = pool.filter(c => {
                const s = c.verses?.[0]?.surah || c.category || c.keyword || '';
                return cSurahs.some(rs => normalizeSurahName(rs) === normalizeSurahName(s) || s.includes(rs));
              });
              if (filtered.length >= Math.min(3, completeCount)) pool = filtered;
            } else if (cScopeMode === 'juz' && cJuzs.length > 0 && cJuzs.length < 30) {
              const filtered = pool.filter(c => {
                const j = c.verses?.[0]?.juz || (c.verses?.[0]?.surah ? getJuzsForSurah(c.verses[0].surah)[0] : null);
                return j ? cJuzs.includes(Number(j)) : true;
              });
              if (filtered.length >= Math.min(3, completeCount)) pool = filtered;
            }
            const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, completeCount);
            if (picked.length < completeCount) {
              const needed = completeCount - picked.length;
              const gen = generateCompletionChallenges(needed, {
                surahs: cScopeMode === 'surah' ? cSurahs : undefined,
                juzs: cScopeMode === 'juz' ? cJuzs : undefined
              });
              const mappedGen = gen.map((g, idx) => ({
                id: 98000 + picked.length + idx,
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
                  id: `gen-comp-upd-${idx}`,
                  number: 1,
                  text: g.prompt,
                  surah: g.surah || '',
                  juz: g.juz || 1
                }]
              }));
              picked.push(...mappedGen);
            }
            customChallenges.push(...picked);
          }
        }

        // 3. Surah
        if ((roomSettings.surahName.isSelected || effectiveGameModes.includes('surah')) && !systemSettings.hideSurahChallenge) {
          const surahCount = Math.max(0, Number(roomSettings.surahName.questionsCount || skillQuestionCounts.surah) || 0);
          if (surahCount > 0) {
            const sScopeMode = roomSettings.surahName.scopeMode || roomScopeMode;
            const sSurahs = roomSettings.surahName.selectedSurahs?.length ? roomSettings.surahName.selectedSurahs : roomSelectedSurahs;
            const sJuzs = roomSettings.surahName.selectedJuzRange?.length ? roomSettings.surahName.selectedJuzRange : roomSelectedJuzs;

            const available = getAvailableSurahChallenges(allChallenges, {
              scopeMode: sScopeMode,
              selectedJuzs: sJuzs,
              selectedSurahs: sSurahs
            });
            const picked = [...available].sort(() => Math.random() - 0.5).slice(0, surahCount);
            if (picked.length < surahCount) {
              const needed = surahCount - picked.length;
              const extra = generateSurahChallenges(needed, {
                surahs: sScopeMode === 'surah' ? sSurahs : undefined,
                juzs: sScopeMode === 'juz' ? sJuzs : undefined
              });
              picked.push(...extra);
            }
            customChallenges.push(...picked);
          }
        }

        // 4. Targeted Islamic
        const effectiveIslamicCategories = (roomSettings.islamicQuestions?.isSelected && roomSettings.islamicQuestions.categories?.length)
          ? roomSettings.islamicQuestions.categories
          : islamicRoomCategories;

        const effectiveIslamicLevels = (roomSettings.islamicQuestions?.isSelected && roomSettings.islamicQuestions.levels?.length)
          ? roomSettings.islamicQuestions.levels
          : islamicRoomLevels;

        const effectiveIslamicTopics = (roomSettings.islamicQuestions?.isSelected && roomSettings.islamicQuestions.topics?.length)
          ? roomSettings.islamicQuestions.topics
          : islamicRoomTopics;

        const effectiveIslamicTopicCounts = (roomSettings.islamicQuestions?.isSelected && roomSettings.islamicQuestions.topicCounts && Object.keys(roomSettings.islamicQuestions.topicCounts).length)
          ? roomSettings.islamicQuestions.topicCounts
          : islamicTopicQuestionCounts;

        if (isIslamicIncluded) {
          const allocations: Record<string, number> = {};
          if (effectiveIslamicTopics.includes('all')) {
            allocations['all'] = Math.max(0, Number(effectiveIslamicTopicCounts['all'] ?? roomSettings.islamicQuestions?.questionsCount) || 5);
          } else {
            effectiveIslamicTopics.forEach(t => {
              allocations[t] = Math.max(0, Number(effectiveIslamicTopicCounts[t]) || 0);
            });
          }
          const islamicQs = getTargetedIslamicQuestions(allocations, effectiveIslamicLevels, effectiveIslamicCategories);
          customChallenges.push(...islamicQs);
        }

        // Shuffle
        const finalCustomChallenges = [...customChallenges].sort(() => Math.random() - 0.5);

        updatePayload = {
          name: v1RoomName.trim() || 'غرفة التحدي',
          isPrivate: v1IsPrivate,
          password: v1IsPrivate ? v1RoomPassword.trim() : null,
          gameMode: effectiveGameModes.length === 1
            ? (effectiveGameModes[0] === 'islamic' ? 'ISLAMIC' : effectiveGameModes[0] === 'audio' ? 'STANDARD' : effectiveGameModes[0] === 'complete' ? 'COMPLETION' : 'SURAH')
            : 'MIXED',
          roomSettings: roomSettings,
          room_settings: roomSettings,
          surahFilters: {
            roomSettings: roomSettings,
            ayahCompletion: roomSettings.ayahCompletion,
            surahName: roomSettings.surahName,
            islamicQuestions: roomSettings.islamicQuestions,
            scopeMode: (roomSettings.surahName.isSelected ? roomSettings.surahName.scopeMode : roomSettings.ayahCompletion.scopeMode) || roomScopeMode,
            selected_juz: (roomSettings.surahName.isSelected ? roomSettings.surahName.selectedJuzRange : roomSettings.ayahCompletion.selectedJuzRange) || (roomScopeMode === 'juz' ? roomSelectedJuzs : []),
            selected_surahs: (roomSettings.surahName.isSelected ? roomSettings.surahName.selectedSurahs : roomSettings.ayahCompletion.selectedSurahs) || (roomScopeMode === 'surah' ? roomSelectedSurahs : [])
          },
          categoryFilter: isIslamicIncluded ? (effectiveIslamicCategories[0] || 'إسلامي') : (v1Category || ''),
          questionCount: finalCustomChallenges.length,
          timePerQuestion: v1Timer ? v1TimePerQuestion : 0,
          transitionMode: v1TransitionMode,
          challengeIds: finalCustomChallenges,
          selected_juz: (roomSettings.surahName.isSelected ? roomSettings.surahName.selectedJuzRange : roomSettings.ayahCompletion.selectedJuzRange) || (roomScopeMode === 'juz' ? roomSelectedJuzs : []),
          selected_surahs: (roomSettings.surahName.isSelected ? roomSettings.surahName.selectedSurahs : roomSettings.ayahCompletion.selectedSurahs) || (roomScopeMode === 'surah' ? roomSelectedSurahs : []),
          scopeMode: (roomSettings.surahName.isSelected ? roomSettings.surahName.scopeMode : roomSettings.ayahCompletion.scopeMode) || roomScopeMode
        };
      }

      // Execute update directly in Supabase as required
      let { error: updateError } = await supabase
        .from('rooms')
        .update(updatePayload)
        .eq('id', roomId);

      if (updateError && (updateError.message.includes('selected_') || updateError.message.includes('room_settings'))) {
        const safePayload = { ...updatePayload };
        delete (safePayload as any).selected_juz;
        delete (safePayload as any).selected_surahs;
        delete (safePayload as any).scopeMode;
        delete (safePayload as any).room_settings;
        delete (safePayload as any).roomSettings;
        const retryRes = await supabase.from('rooms').update(safePayload).eq('id', roomId);
        updateError = retryRes.error;
      }

      if (updateError) {
        console.warn('Direct supabase update encountered error, falling back to api/1v1:', updateError);
        const res = await fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-settings',
            roomId,
            updatePayload
          })
        });
        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || resData.message || 'فشل تحديث الإعدادات');
        }
      }

      // Optimistic local update
      setRoom((prev: any) => prev ? {
        ...prev,
        ...updatePayload,
        challenges: updatePayload.challengeIds
      } : prev);

      // Broadcast update on room channel so all participants receive it immediately
      try {
        const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:room_sync_${roomId}`);
        if (existingChannel && existingChannel.state === 'joined') {
          existingChannel.send({
            type: 'broadcast',
            event: 'room_settings_updated',
            payload: updatePayload
          }).catch(() => {});
        }
      } catch (_) {}

      toast.success('تم حفظ إعدادات الغرفة بنجاح');
      return true;
    } catch (err: any) {
      console.error('Error saving room settings:', err);
      toast.error(err?.message || 'حدث خطأ أثناء حفظ الإعدادات');
      return false;
    } finally {
      setIsSavingRoomSettings(false);
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
        setSessionScore(0);
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
  // Set of player IDs currently tracked as online via Supabase Presence in the active room.
  // Populated by the roomPresence useEffect below and exposed to advance-question logic.
  const [roomPresenceOnlineIds, setRoomPresenceOnlineIds] = useState<Set<string | number>>(new Set());

  // Requirement 4: Reset UI State immediately on question transition
  const resetQuestionUIState = useCallback((newIndex: number, currentRoomData?: any) => {
    setCurrentChallengeIndex(newIndex);
    setHasAnsweredCurrentQuestion(false);
    setSkillsFeedback(false);
    setSelectedOption(null);
    setMatchedIds(new Set());
    setSurahFeedbackData(null);
    setDiscoveredBonusSurahs([]);
    setSurahBonusInput('');

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
      const totalQ = room.questionCount || challenges.length || 5;
      const isLastQuestion = currentChallengeIndex >= totalQ - 1;
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
        if (!isLastQuestion) {
          moveToNextQuestion();
        } else {
          setSkillsFeedback(true);
          setHasAnsweredCurrentQuestion(true);
        }
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

    // Requirement 1 & 2: Only Host triggers advance-question on timeout, and NEVER auto-advance on the last question!
    const totalQ = room.questionCount || challenges.length || 5;
    const curQ = room.currentQuestionIndex ?? currentChallengeIndex;
    const isLastQuestion = curQ >= totalQ - 1;

    const currentUserId = playerUsername || playerName;
    const isHost = Boolean(
      (room?.host_id && String(currentUserId) === String(room.host_id)) ||
      (room?.player1Id && (String(currentUserId) === String(room.player1Id) || String(currentUserId) === String(room.player1?.id))) ||
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
            action: isLastQuestion ? 'end-room' : 'advance-question',
            roomId: room.id,
            playerId: playerUsername || playerName,
            questionIndex: room.currentQuestionIndex ?? currentChallengeIndex
          })
        });
        const data = await res.json();
        isAdvancingRef.current = false;
        if (res.ok && data) {
          setRoom(data);
          if (data.status === 'FINISHED' || data.status === 'completed') {
            recordDailyGiftRoomMatch();
            router.push('/challenge/results');
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

  // Sync room status via Supabase Realtime — legacy HTTP polling replaced with one-time fetch on mount
  // The setInterval was removed: real-time updates now come from postgres_changes / broadcast channels
  useEffect(() => {
    if (!room?.id || (view !== 'group_waiting' && view !== 'group_game' && view !== 'challenge')) return;
    if (room.status === 'FINISHED' && view === 'group_game') return;

    // One-time fetch on dependency change (e.g. view transition) — not a polling loop
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

          // If room finished or completed, switch to group_game results
          if (data.status === 'FINISHED' || data.status === 'completed') {
            recordDailyGiftRoomMatch();
            setRoom(data);
            if (view !== 'group_game') {
              router.push('/challenge/results');
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
            setSessionScore(0);
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
            // Withdrawal Notification: Check if any participant has explicitly left/resigned and notify remaining players
            // Notice: Temporary window blur, tab switches, and mobile app pause are NOT treated as withdrawals.
            const participantsList = data.participants || [];
            participantsList.forEach((p: any) => {
              const pIdStr = String(p.id);
              const pProgress = data.playersProgress ? data.playersProgress[pIdStr] : null;
              const isWithdrawn = Boolean(
                p.hasLeft || (pProgress && pProgress.hasLeft) ||
                p.isResigned || (pProgress && pProgress.isResigned) ||
                p.isAbandoned || (pProgress && pProgress.isAbandoned) ||
                p.status === 'abandoned' || (pProgress && pProgress.status === 'abandoned')
              );

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

              // 3. Requirement 1 & 3: Host-Only Transition Validation + Host Migration
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

              // ── Host Migration Logic ──────────────────────────────────────
              // If the room creator is offline (not in Supabase Presence), the first
              // online non-host player inherits the ability to advance questions.
              const participants = data.participants || [];

              // Helper: is a participant currently online in Supabase Presence?
              const isParticipantOnline = (p: any): boolean => {
                if (roomPresenceOnlineIds.size === 0) {
                  // Presence not yet populated — fall back to isOnline flag from API
                  return p.isOnline !== false;
                }
                return (
                  (p.id != null && roomPresenceOnlineIds.has(String(p.id))) ||
                  (p.name  && roomPresenceOnlineIds.has(String(p.name).trim().toLowerCase())) ||
                  (p.username && roomPresenceOnlineIds.has(String(p.username).trim().toLowerCase().replace(/^@+/, '')))
                );
              };

              // Determine if the original host is offline
              const hostParticipant = participants.find((p: any) =>
                String(p.id) === String(data?.player1Id || room?.player1Id) ||
                (p.name && data?.player1?.name && p.name === data.player1.name) ||
                (p.username && data?.player1?.username && p.username === data.player1.username)
              );
              const hostIsOffline = hostParticipant ? !isParticipantOnline(hostParticipant) : false;

              // Find the first online non-host participant
              const onlineNonHostParticipants = participants.filter((p: any) =>
                String(p.id) !== String(data?.player1Id || room?.player1Id) &&
                isParticipantOnline(p) &&
                !p.hasLeft && !p.isResigned && !p.isAbandoned && p.status !== 'abandoned'
              );
              const firstOnlinePlayer = onlineNonHostParticipants[0] || null;

              // Am I the first online non-host player (potential host migration target)?
              const amIFirstOnline = Boolean(
                firstOnlinePlayer && (
                  (firstOnlinePlayer.name && playerName && firstOnlinePlayer.name === playerName) ||
                  (firstOnlinePlayer.username && playerUsername && firstOnlinePlayer.username.toLowerCase() === playerUsername.toLowerCase()) ||
                  (firstOnlinePlayer.id && playerId && String(firstOnlinePlayer.id) === String(playerId))
                )
              );

              // Effective host: original host OR (host is offline AND I am the first online player)
              const isEffectiveHost = isHost || (hostIsOffline && amIFirstOnline);

              if (isEffectiveHost && !isAdvancingRef.current) {
                // Active players: online (by presence) + not abandoned/left
                const activeParticipants = participants.filter((p: any) => {
                  const pProg = data.playersProgress ? data.playersProgress[String(p.id)] : null;
                  return isParticipantOnline(p) && !p.hasLeft && !p.isResigned && !p.isAbandoned && p.status !== 'abandoned' &&
                    (!pProg || (!pProg.hasLeft && !pProg.isResigned && !pProg.isAbandoned && pProg.status !== 'abandoned'));
                });
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

                const totalQ = data.questionCount || (challenges && challenges.length) || 5;
                const isLastQuestion = data.currentQuestionIndex !== undefined && data.currentQuestionIndex >= totalQ - 1;

                if (allActiveAnswered) {
                  if (isLastQuestion) {
                    if (!isAdvancingRef.current) {
                      isAdvancingRef.current = true;
                      fetch('/api/1v1', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'end-room',
                          roomId: room.id,
                          playerId: playerUsername || playerName
                        })
                      })
                        .then(res => res.json())
                        .then(endedData => {
                          isAdvancingRef.current = false;
                          if (endedData) {
                            setRoom(endedData);
                            recordDailyGiftRoomMatch?.();
                            router.push('/challenge/results');
                            setView('group_game');
                          }
                        })
                        .catch(err => {
                          isAdvancingRef.current = false;
                          console.error('Host end room error on last question:', err);
                        });
                    }
                  } else if (!isAdvancingRef.current) {
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
                        if (advData) {
                          if (advData.status === 'completed' || advData.status === 'FINISHED' || advData.currentQuestionIndex >= totalQ) {
                            recordDailyGiftRoomMatch?.();
                            router.push('/challenge/results');
                            setView('group_game');
                          } else if (advData.currentQuestionIndex > currentChallengeIndex) {
                            resetQuestionUIState(advData.currentQuestionIndex, advData);
                            setRoom(advData);
                          }
                        }
                      })
                      .catch(err => {
                        isAdvancingRef.current = false;
                        console.error('Host advance question error:', err);
                      });
                  }
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

    // Single fetch on effect run — Realtime handles ongoing updates
    poll();
  }, [room?.id, view, room?.status, currentChallengeIndex, playerName, playerUsername, hasAnsweredCurrentQuestion, challenges, resetQuestionUIState, roomPresenceOnlineIds, playerId, uniquePlayerId]);

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

    // Disconnect ONLY on genuine page unload / window close (never on background tab switch)
    const handleBeforeUnload = () => {
      sendPresence(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [room?.id, view, playerName, playerUsername]);

  // ── Room Presence via Supabase Presence ──────────────────────────────────
  // Tracks which player IDs are truly online inside the active room using
  // Supabase Realtime Presence (not HTTP API). This powers:
  //  1. Offline indicator on participant list (roomPresenceOnlineIds)
  //  2. Host migration: first online non-host player inherits advance rights
  //  3. Auto-advance: if all online players answered, advance without waiting
  //     for offline players who will never respond
  useEffect(() => {
    if (!room?.id || (view !== 'challenge' && view !== 'group_game' && view !== 'group_waiting')) return;

    const myPresenceId = String(playerId || playerUsername || playerName || '');
    if (!myPresenceId) return;

    const channelName = `room_presence_${room.id}`;
    // Clean up any stale channel from a previous room
    const existing = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
    if (existing) { try { supabase.removeChannel(existing); } catch (_) {} }

    const presenceChannel = supabase.channel(channelName, {
      config: { presence: { key: myPresenceId } }
    });

    // Pure WebSocket Presence tracking driven directly by Supabase Realtime join, leave, and sync events
    const syncPresence = () => {
      const state = presenceChannel.presenceState();
      const onlineIds = new Set<string | number>();
      Object.entries(state).forEach(([key, presences]) => {
        onlineIds.add(key);
        if (Array.isArray(presences)) {
          presences.forEach((p: any) => {
            if (p.playerId != null)   onlineIds.add(String(p.playerId));
            if (p.playerName)         onlineIds.add(String(p.playerName).trim().toLowerCase());
            if (p.playerUsername)     onlineIds.add(String(p.playerUsername).trim().toLowerCase().replace(/^@+/, ''));
            if (p.uniquePlayerId)     onlineIds.add(String(p.uniquePlayerId).trim().toUpperCase());
          });
        }
      });
      setRoomPresenceOnlineIds(onlineIds);
    };

    presenceChannel
      .on('presence', { event: 'sync' },  syncPresence)
      .on('presence', { event: 'join' },  syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            playerId:       playerId        || null,
            playerName:     playerName      || null,
            playerUsername: playerUsername  || null,
            uniquePlayerId: uniquePlayerId  || null,
            joinedAt: new Date().toISOString()
          });
        }
      });

    return () => {
      try { supabase.removeChannel(presenceChannel); } catch (_) {}
      setRoomPresenceOnlineIds(new Set());
    };
  }, [room?.id, view, playerId, playerName, playerUsername, uniquePlayerId]);

  // Check for active unfinished challenges on Home and Challenges screens
  useEffect(() => {
    if ((view !== 'home' && view !== 'challenges') || !playerName) return;

    const checkActive = async () => {
      try {
        const pIdParam = encodeURIComponent(playerUsername || playerName || '');
        const res = await fetch(`/api/1v1?action=check-active&playerId=${pIdParam}`);
        const data = await res.json();
        if (res.ok && data && data.id && (data.status === 'PLAYING' || data.status === 'WAITING')) {
          // التحقق الدقيق من مسار هذا اللاعب تحديداً داخل الغرفة
          const pId = String(data.participants?.find((p: any) => p.name === playerName || p.username === playerUsername)?.id);
          const pProgress = data.playersProgress ? data.playersProgress[pId] : null;

          // إذا كان اللاعب قد انسحب (hasLeft = true أو isResigned = true أو isAbandoned) أو أنهى، يتم إخفاء الشريط تماماً وتنظيف المرجع
          if (pProgress && (pProgress.hasLeft || pProgress.isResigned || pProgress.isAbandoned || pProgress.status === 'abandoned' || pProgress.finishTime)) {
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

  // 4. معالجة انقطاع الاتصال والمزامنة اللحظية (Reconnection UI & Supabase Channel Events)
  useEffect(() => {
    if (!room?.id) {
      setIsReconnecting(false);
      return;
    }

    const channelName = `room_sync_app_${room.id}`;
    const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      try {
        supabase.removeChannel(existingChannel);
      } catch (_) {}
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload: any) => {
        if (payload?.new?.status === 'completed' || payload?.new?.status === 'FINISHED') {
          recordDailyGiftRoomMatch?.();
          router.push('/challenge/results');
          setView('group_game');
        } else if (payload?.new?.currentQuestionIndex !== undefined && payload.new.currentQuestionIndex > currentChallengeIndex) {
          resetQuestionUIState(payload.new.currentQuestionIndex, payload.new);
          setRoom(payload.new);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Room', filter: `id=eq.${room.id}` }, (payload: any) => {
        if (payload?.new?.status === 'completed' || payload?.new?.status === 'FINISHED') {
          recordDailyGiftRoomMatch?.();
          router.push('/challenge/results');
          setView('group_game');
        } else if (payload?.new?.currentQuestionIndex !== undefined && payload.new.currentQuestionIndex > currentChallengeIndex) {
          resetQuestionUIState(payload.new.currentQuestionIndex, payload.new);
          setRoom(payload.new);
        }
      })
      .on('broadcast', { event: 'room_completed' }, (_payload: any) => {
        recordDailyGiftRoomMatch?.();
        router.push('/challenge/results');
        setView('group_game');
      })
      .on('broadcast', { event: 'question_advanced' }, ({ payload }: any) => {
        if (!payload) return;
        if (payload.isFinished || payload.status === 'FINISHED' || payload.room?.status === 'FINISHED') {
          recordDailyGiftRoomMatch?.();
          router.push('/challenge/results');
          setView('group_game');
          return;
        }
        if (payload.currentQuestionIndex !== undefined && payload.currentQuestionIndex > currentChallengeIndex) {
          resetQuestionUIState(payload.currentQuestionIndex, payload.room);
          if (payload.room) setRoom(payload.room);
        }
      })
      .on('broadcast', { event: 'player_kicked' }, ({ payload }: any) => {
        if (!payload) return;
        const myIds = [
          String(playerId || ''),
          String(playerUsername || '').toLowerCase().replace(/^@+/, ''),
          String(playerName || '').trim().toLowerCase(),
          String(uniquePlayerId || '').toUpperCase()
        ].filter(Boolean);

        const kickedTargets = [
          String(payload.playerId || ''),
          String(payload.targetPlayerId || ''),
          String(payload.playerUsername || '').toLowerCase().replace(/^@+/, ''),
          String(payload.playerName || '').trim().toLowerCase()
        ].filter(Boolean);

        if (myIds.some(id => kickedTargets.includes(id))) {
          toast.error('تم إخراجك من الغرفة من قِبل المنشئ');

          // Full room state reset — ensures no stale state blocks incoming invite for same room
          setRoom(null);
          setSkillsType(null);
          setSkillsFeedback(false);
          setHasAnsweredCurrentQuestion(false);
          setSelectedOption(null);
          setMatchedIds(new Set());
          setIsRoomLoading(false);
          setIncomingRoomInvite(null);  // clear any stale invite modal
          setChallenges([]);
          setCurrentChallengeIndex(0);

          localStorage.removeItem('activeRoomId');
          localStorage.removeItem('currentRoomId');
          sessionStorage.removeItem(`is_creator_${payload.roomId || ''}`);

          // Re-subscribe invite channels in case the kick handler caused a re-render that
          // dropped the callback. Channels themselves stay alive (singleton pattern).
          const identifiers = [
            playerId ? `user_${playerId}` : null,
            uniquePlayerId,
            playerUsername
          ].filter(Boolean) as string[];
          friendsRealtimeService.subscribeToInvites(identifiers, (invite) => {
            const myName = (playerName || '').trim().toLowerCase();
            const myUser = (playerUsername || '').trim().toLowerCase().replace(/^@+/, '');
            const hostN = (invite.hostName || '').trim().toLowerCase();
            const hostU = (invite.hostUsername || '').trim().toLowerCase().replace(/^@+/, '');
            if ((hostN && hostN === myName) || (hostU && hostU === myUser)) return;
            setIncomingRoomInvite(invite);
          });

          setView('home');
        }
      })
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

  // Realtime Presence Setup
  useEffect(() => {
    if (!playerName && !playerUsername) {
      friendsRealtimeService.stopPresence();
      return;
    }

    // Auto-fetch uniquePlayerId & id if not stored locally
    if (!uniquePlayerId || !playerId) {
      const ident = playerUsername || playerName;
      fetch(`/api/player-score?username=${encodeURIComponent(ident || '')}&name=${encodeURIComponent(playerName || '')}`)
        .then(res => res.json())
        .then(p => {
          if (p?.uniquePlayerId) {
            setUniquePlayerId(p.uniquePlayerId);
            localStorage.setItem('quran_unique_player_id', p.uniquePlayerId);
          }
          if (p?.id) {
            setPlayerId(p.id);
            localStorage.setItem('quran_player_id', String(p.id));
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
  }, [playerName, playerUsername, uniquePlayerId, playerId, userAchievement]);

  // Consolidated Root Global Room Invites Listener (Depends ONLY on user identifier)
  useEffect(() => {
    const activeUserId = playerId ? `user_${playerId}` : (playerUsername || uniquePlayerId || playerName);
    if (!activeUserId) return;

    const identifiers = [
      playerId ? `user_${playerId}` : null,
      uniquePlayerId || null,
      playerUsername || null
    ].filter(Boolean) as string[];

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
  }, [playerId || playerUsername || playerName]);

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
    localStorage.setItem('activeRoomId', targetRoom.id);

    // If room is WAITING, return to waiting room
    if (targetRoom.status === 'WAITING') {
      setView('group_waiting');
      setActiveRunningRoom(null);
      toast.success('تمت العودة لقاعة انتظار الغرفة 👑');
      return;
    }

    if (targetRoom.gameMode === 'WHO_AM_I' || targetRoom.challenge_type === 'who_am_i') {
      setActiveRunningRoom(null);
      setView('group_game');
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
      // Missed questions are not presented; score for missed questions remains 0
      setCurrentChallengeIndex(targetRoom.currentQuestionIndex || 0);
    }

    setHasAnsweredCurrentQuestion(false);
    setSkillsFeedback(false);
    setSelectedOption(null);
    setMatchedIds(new Set());
    setSurahFeedbackData(null);
    setDiscoveredBonusSurahs([]);
    setSurahBonusInput('');

    const roomTime = (targetRoom.timePerQuestion && targetRoom.timePerQuestion > 0) ? targetRoom.timePerQuestion : 0;
    if (roomTime > 0) {
      if (targetRoom.questionStartTime) {
        const elapsed = Math.floor((Date.now() - Number(targetRoom.questionStartTime)) / 1000);
        const remaining = Math.max(1, roomTime - elapsed);
        setSpeedTimeLeft(remaining);
      } else {
        setSpeedTimeLeft(roomTime);
      }
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
          score: forcedScore !== undefined ? forcedScore : sessionScore,
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
      // 1. Delete player from Supabase room_participants and submissions & broadcast leave event
      try {
        if (currentUserId) {
          const leavePayload = {
            type: 'LEAVE',
            action: 'player_left',
            roomId: roomId,
            playerId: playerId || currentUserId,
            userId: playerId || currentUserId,
            playerName: playerName || currentUserId,
            timestamp: Date.now()
          };

          // Broadcast to room channel so host and participants immediately remove player and reset invite status
          try {
            const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:room_sync_${roomId}`);
            if (existingChannel && existingChannel.state === 'joined') {
              existingChannel.send({
                type: 'broadcast',
                event: 'player_left',
                payload: leavePayload
              }).catch(() => {});
              existingChannel.send({
                type: 'broadcast',
                event: 'participant_removed',
                payload: leavePayload
              }).catch(() => {});
            } else {
              const ch = supabase.channel(`room_sync_${roomId}`);
              ch.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                  ch.send({
                    type: 'broadcast',
                    event: 'player_left',
                    payload: leavePayload
                  }).catch(() => {});
                  ch.send({
                    type: 'broadcast',
                    event: 'participant_removed',
                    payload: leavePayload
                  }).finally(() => {
                    try {
                      supabase.removeChannel(ch);
                    } catch (_) {}
                  });
                }
              });
            }
          } catch (bErr) {
            console.warn('[Broadcast leave event warn]:', bErr);
          }

          // If this player joined via an invite with senderTarget, notify the sender directly
          const senderTarget = (room as any)?.senderTarget || (room as any)?.hostUsername || (room as any)?.hostName;
          if (senderTarget) {
            friendsRealtimeService.sendInviteResponse(senderTarget, 'player_left', {
              roomId: roomId,
              friendId: playerId || uniquePlayerId || currentUserId,
              friendName: playerName || undefined
            }).catch(() => {});
          }

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

      // 3. Reset local storage & state (Cleanup on Withdraw)
      try {
        localStorage.removeItem('activeRoomId');
        localStorage.removeItem('currentRoomId');
      } catch (e) { }

      setActiveRunningRoom(null);
      setSessionCorrect(0);
      setSessionScore(0);
      setRoom(null);
      setIsResignModalOpen(false);

      // Requirement 2: Reset all invite states and modals upon withdrawal
      setIncomingRoomInvite(null);
      setPrivateRoomModal({
        isOpen: false,
        room: null,
        password: '',
        error: undefined
      });
      setIsFriendsModalOpen(false);

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

  const buyPowerup = async (type: 'freeze' | 'fiftyFifty'): Promise<boolean> => {
    const cost = type === 'freeze' ? 30 : 50;
    if (totalPoints < cost) {
      toast.error(`نقاطك لا تكفي! تكلفة الأداة ${cost} نقطة (رصيدك الحالي: ${totalPoints})`);
      return false;
    }

    if (isPurchasingPowerup) return false;
    setIsPurchasingPowerup(true);

    try {
      // 1. Authoritative DB deduction first via /api/1v1
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase-powerup',
          playerId: playerId || playerUsername || playerName,
          playerName: playerName || playerUsername,
          playerUsername: playerUsername || null,
          powerupType: type,
          cost,
          roomId: room?.id || null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'فشلت عملية الشراء من قاعدة البيانات');
        setIsPurchasingPowerup(false);
        return false;
      }

      // 2. Only on successful DB update, update local state and inventory
      const remainingPoints = typeof data.remainingPoints === 'number'
        ? data.remainingPoints
        : Math.max(0, totalPoints - cost);

      setTotalPoints(remainingPoints);
      localStorage.setItem('quran_total_points', remainingPoints.toString());
      localStorage.setItem('quran_points', remainingPoints.toString());

      // Add +1 to inventory in State and localStorage
      setPowerups(prev => {
        const nextCount = (prev[type] || 0) + 1;
        const key = type === 'freeze' ? 'quran_freeze_count' : 'quran_delete_two_count';
        localStorage.setItem(key, nextCount.toString());
        return { ...prev, [type]: nextCount };
      });

      if (type === 'freeze') {
        toast.success('تم خصم 30 نقطة وإضافة تجميد الوقت لمخزونك (+1) 🧊');
      } else {
        toast.success('تم خصم 50 نقطة وإضافة حذف إجابتين لمخزونك (+1) ✂️');
      }

      setIsPurchasingPowerup(false);
      return true;
    } catch (err: any) {
      console.error('[PowerUps] DB points sync error:', err);
      toast.error('تعذر إتمام عملية الشراء، يرجى التحقق من اتصالك بالإنترنت');
      setIsPurchasingPowerup(false);
      return false;
    }
  };

  const handleExecuteFreezeTime = () => {
    if (isPowerUpUsedThisQuestion) {
      toast.error('يمكنك استخدام مساعدة واحدة فقط في هذا السؤال');
      return;
    }
    if (isFreezeActive) {
      return;
    }

    if ((powerups.freeze || 0) <= 0) {
      toast.error('رصيدك من تجميد الوقت صفر! قم بالشراء من المتجر أولاً 🛒');
      return;
    }

    // Deduct -1 from inventory
    setPowerups(prev => {
      const nextCount = Math.max(0, (prev.freeze || 0) - 1);
      localStorage.setItem('quran_freeze_count', nextCount.toString());
      return { ...prev, freeze: nextCount };
    });

    setIsFreezeActive(true);
    setFreezeSecondsLeft(10);
    setIsPowerUpUsedThisQuestion(true);
    toast.success('تم تفعيل تجميد الوقت لمدة 10 ثوانٍ! 🧊');
  };

  const handleExecuteDeleteTwo = () => {
    if (isPowerUpUsedThisQuestion) {
      toast.error('يمكنك استخدام مساعدة واحدة فقط في هذا السؤال');
      return;
    }
    if (eliminatedOptionIndices.length > 0) {
      return;
    }
    const currentOpts = skillsOptions || currentChallenge?.options || [];
    if (!Array.isArray(currentOpts) || currentOpts.length <= 2) {
      toast.error('لا يمكن حذف إجابات لهذا السؤال');
      return;
    }

    if ((powerups.fiftyFifty || 0) <= 0) {
      toast.error('رصيدك من حذف الإجابات صفر! قم بالشراء من المتجر أولاً 🛒');
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

    // Deduct -1 from inventory
    setPowerups(prev => {
      const nextCount = Math.max(0, (prev.fiftyFifty || 0) - 1);
      localStorage.setItem('quran_delete_two_count', nextCount.toString());
      return { ...prev, fiftyFifty: nextCount };
    });

    setEliminatedOptionIndices(toEliminate);
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

  const hasBonusField = useMemo(() => {
    const isMultiplayer = Boolean(room?.id || view === 'group_game');
    if (!isMultiplayer || !currentChallenge) return false;
    const allSurahs = getChallengeSurahsList(currentChallenge);
    const activeScope = getActiveScope(room, selectedSkillJuzs, selectedSkillSurahs, selectedJuz, currentChallenge?.type || 'SURAH');
    const { bonusAnswers, outOfRangeAnswers } = splitSurahAnswersByScope(allSurahs, activeScope, currentChallenge?.verses || []);
    return (bonusAnswers && bonusAnswers.length > 0) || (outOfRangeAnswers && outOfRangeAnswers.length > 0);
  }, [room?.id, view, currentChallenge, selectedSkillJuzs, selectedSkillSurahs, selectedJuz]);

  const handleSurahBonusInputChange = (val: string) => {
    setSurahBonusInput(val);

    if (val && val.trim() && currentChallenge) {
      const normVal = normalizeSurahName(val);
      const allCorrect = getChallengeSurahsList(currentChallenge);
      const activeScope = getActiveScope(room, selectedSkillJuzs, selectedSkillSurahs, selectedJuz, currentChallenge?.type || 'SURAH');
      const { bonusAnswers } = splitSurahAnswersByScope(allCorrect, activeScope, currentChallenge?.verses || []);

      const matchedBonus = bonusAnswers.find(b => normalizeSurahName(b.surah) === normVal);
      if (matchedBonus && !discoveredBonusSurahs.includes(matchedBonus.surah)) {
        setDiscoveredBonusSurahs(prev => [...prev, matchedBonus.surah]);
        addPoint({ challengeId: currentChallenge?.id, roomId: room?.id, points: 2 });
        toast.success(
          `🎁 مكافأة الحُفّاظ! إجابة إضافية خارج النطاق (+2 بونص): سورة ${matchedBonus.surah}`,
          { duration: 4000 }
        );
      }
    }
  };

  // Effect to handle Surah Name Challenge inputs initialization
  useEffect(() => {
    const isSurahMode = skillsType === 'surah' || (view === 'group_game' && roomGameMode === 'surah');
    if (currentChallenge && isSurahMode) {
      setDiscoveredBonusSurahs([]);
      setSurahBonusInput('');
      const allSurahs = getChallengeSurahsList(currentChallenge);
      const activeScope = getActiveScope(room, selectedSkillJuzs, selectedSkillSurahs, selectedJuz, currentChallenge?.type || 'SURAH');
      const { inRangeAnswers } = splitSurahAnswersByScope(
        allSurahs,
        activeScope,
        currentChallenge?.verses || []
      );

      // Initialize with correct number of empty strings strictly for inRangeAnswers
      const inputCount = inRangeAnswers.length > 0 ? inRangeAnswers.length : 1;
      setSurahInputs(new Array(inputCount).fill(''));
    }
  }, [currentChallenge, skillsType, room?.gameMode, view, selectedSkillJuzs, selectedSkillSurahs, selectedJuz, room]);

  // دالة البونص للعب الجماعي (الغرف) - نظام المكافأة المخفية
  const handleSurahInputChangeBonus = (idx: number, val: string) => {
    setSurahInputs(prev => {
      const newInputs = [...prev];
      newInputs[idx] = val;
      return newInputs;
    });

    if (val && val.trim() && currentChallenge) {
      const normVal = normalizeSurahName(val);
      const allCorrect = getChallengeSurahsList(currentChallenge);
      const activeScope = getActiveScope(room, selectedSkillJuzs, selectedSkillSurahs, selectedJuz, currentChallenge?.type || 'SURAH');
      const { bonusAnswers, inRangeAnswers } = splitSurahAnswersByScope(allCorrect, activeScope, currentChallenge?.verses || []);

      const matchedBonus = bonusAnswers.find(b => normalizeSurahName(b.surah) === normVal);
      if (matchedBonus && !discoveredBonusSurahs.includes(matchedBonus.surah)) {
        setDiscoveredBonusSurahs(prevBonus => [...prevBonus, matchedBonus.surah]);
        addPoint({ challengeId: currentChallenge?.id, roomId: room?.id, points: 2 });
        toast.success(
          `🎁 مكافأة الحُفّاظ! إجابة إضافية خارج النطاق (+2 بونص): سورة ${matchedBonus.surah}`,
          { duration: 4000 }
        );
      }

      // Check auto-completion for required answers (decoupled from bonus)
      if (!hasBonusField && !skillsFeedback && !isComplete) {
        const normalizedRequired = inRangeAnswers.map(a => normalizeSurahName(a.surah));
        const candidateInputs = [...surahInputs];
        candidateInputs[idx] = val;
        const normalizedCurrent = candidateInputs.map(s => normalizeSurahName(s)).filter(Boolean);

        const matchedRequiredIndices = new Set<number>();
        normalizedCurrent.forEach(inp => {
          const matchIdx = normalizedRequired.findIndex((req, rIdx) => req === inp && !matchedRequiredIndices.has(rIdx));
          if (matchIdx !== -1) {
            matchedRequiredIndices.add(matchIdx);
          }
        });

        if (matchedRequiredIndices.size === normalizedRequired.length && normalizedRequired.length > 0) {
          setTimeout(() => {
            handleSubmitSurah();
          }, 350);
        }
      }
    }
  };

  // دالة التجاهل للعب الفردي (تحدي المهارات) - إلغاء البونص تماماً والتنبيه البعدي فقط
  const handleSurahInputChangeSingle = (idx: number, val: string) => {
    setSurahInputs(prev => {
      const newInputs = [...prev];
      newInputs[idx] = val;
      return newInputs;
    });

    // الإنهاء التلقائي الفوري للسؤال عند اكتمال الإجابات المطلوبة ضمن النطاق
    if (val && val.trim() && currentChallenge && !skillsFeedback && !isComplete) {
      const allCorrect = getChallengeSurahsList(currentChallenge);
      const activeScope = getActiveScope(room, selectedSkillJuzs, selectedSkillSurahs, selectedJuz, currentChallenge?.type || 'SURAH');
      const { inRangeAnswers } = splitSurahAnswersByScope(allCorrect, activeScope, currentChallenge?.verses || []);
      const normalizedRequired = inRangeAnswers.map(a => normalizeSurahName(a.surah));

      const candidateInputs = [...surahInputs];
      candidateInputs[idx] = val;
      const normalizedCurrent = candidateInputs.map(s => normalizeSurahName(s)).filter(Boolean);

      const matchedRequiredIndices = new Set<number>();
      normalizedCurrent.forEach(inp => {
        const matchIdx = normalizedRequired.findIndex((req, rIdx) => req === inp && !matchedRequiredIndices.has(rIdx));
        if (matchIdx !== -1) {
          matchedRequiredIndices.add(matchIdx);
        }
      });

      if (matchedRequiredIndices.size === normalizedRequired.length && normalizedRequired.length > 0) {
        setTimeout(() => {
          handleSubmitSurah();
        }, 350);
      }
    }
  };

  // الدالة العامة الموجهة حسب نمط اللعب
  const handleSurahInputChange = (idx: number, val: string) => {
    const isMultiplayer = Boolean(room?.id || view === 'group_game');
    if (isMultiplayer) {
      handleSurahInputChangeBonus(idx, val);
    } else {
      handleSurahInputChangeSingle(idx, val);
    }
  };

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
    setDiscoveredBonusSurahs([]);
    setSurahBonusInput('');

    const challengesLength = challenges.length || room?.challenges?.length || 0;

    if (currentChallengeIndex >= challengesLength - 1) {
      if (room) {
        syncGroupProgress(true);
        // Do NOT auto-navigate to group_game here when in a room!
        // The host must click "إنهاء الغرفة" or wait for leader completion!
        return;
      }
      if (view === 'challenge') {
        // Requirement 4: Cups are earned strictly in group rooms, not solo sessions
        setView('skills_results');
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
        setSessionScore(prev => prev + 1);
        setScore(prev => prev + 1);

        // توحيد منح النقاط: نقطة واحدة فقط (+1) عبر الدالة المركزية
        addPoint({ challengeId: currentQuestion?.id, roomId: room?.id });

        setSessionMistakes(prev => [...prev, {
          challenge: currentQuestion,
          keyword: currentQuestion.keyword || currentQuestion.verseText || currentQuestion.text || "",
          userAnswer: answer || rawSelected || rawCorrect,
          correctAnswer: rawCorrect,
          correctText: rawCorrect,
          type: currentQuestion.type || 'COMPLETION',
          isFullyCorrect: true,
          pointsEarned: 1,
          totalPossible: 1
        }]);

        if (view === 'group_game') {
          syncGroupProgress(false, sessionScore + 1);
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
        const totalQ = room.questionCount || (challenges && challenges.length) || 5;
        const isLastQ = currentChallengeIndex >= totalQ - 1;

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
            }
          }).catch(err => console.error('Error submitting ASYNC room answer:', err));

          if (!isLastQ) {
            const advanceDelay = isCorrect ? 900 : 1500;
            setTimeout(() => {
              moveToNextQuestion();
            }, advanceDelay);
          }
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
            if (!isLastQ && data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
              resetQuestionUIState(data.currentQuestionIndex, data);
            }
            if (data.status === 'completed' || data.status === 'FINISHED') {
              recordDailyGiftRoomMatch();
              router.push('/challenge/results');
              setView('group_game');
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

    // 1. Determine all correct surahs across all positions
    const correctSurahs = getChallengeSurahsList(currentQuestion);

    // 2. Partition into inRange and outOfRange answers based on active scope
    const activeScope = getActiveScope(room, selectedSkillJuzs, selectedSkillSurahs, selectedJuz, currentQuestion?.type || 'SURAH');
    const { inRangeAnswers, outOfRangeAnswers } = splitSurahAnswersByScope(
      correctSurahs,
      activeScope,
      currentQuestion?.verses || []
    );

    const requiredSurahNames = inRangeAnswers.map(a => a.surah);

    // 3. Normalize and check matches
    const normalizedRequired = requiredSurahNames.map(s => normalizeSurahName(s));
    const normalizedInputs = surahInputs.map(s => normalizeSurahName(s)).filter(Boolean);

    const isMultiplayer = Boolean(room?.id || view === 'group_game');

    // Track newly discovered bonus surahs submitted by the player (Multiplayer only)
    let currentDiscoveredBonus: string[] = [];
    let newlyDiscoveredBonusCount = 0;
    if (isMultiplayer) {
      currentDiscoveredBonus = [...discoveredBonusSurahs];
      // Check required input boxes
      normalizedInputs.forEach(input => {
        const matchedBonus = outOfRangeAnswers.find(b => normalizeSurahName(b.surah) === input);
        if (matchedBonus && !currentDiscoveredBonus.includes(matchedBonus.surah)) {
          currentDiscoveredBonus.push(matchedBonus.surah);
          newlyDiscoveredBonusCount++;
        }
      });
      // Check explicit optional bonus box
      if (surahBonusInput && surahBonusInput.trim()) {
        const normBonus = normalizeSurahName(surahBonusInput);
        const matchedBonus = outOfRangeAnswers.find(b => normalizeSurahName(b.surah) === normBonus);
        if (matchedBonus && !currentDiscoveredBonus.includes(matchedBonus.surah)) {
          currentDiscoveredBonus.push(matchedBonus.surah);
          newlyDiscoveredBonusCount++;
        }
      }
      setDiscoveredBonusSurahs(currentDiscoveredBonus);
    } else {
      // تعطيل البونص تماماً في اللعب الفردي
      setDiscoveredBonusSurahs([]);
    }

    // Count matched required answers
    let matchedRequiredCount = 0;
    const matchedRequiredIndices = new Set<number>();

    normalizedInputs.forEach(input => {
      const matchIndex = normalizedRequired.findIndex((req, idx) => req === input && !matchedRequiredIndices.has(idx));
      if (matchIndex !== -1) {
        matchedRequiredCount++;
        matchedRequiredIndices.add(matchIndex);
      }
    });

    // 1. Unified Base Points: 1 point per correct in-range surah answer
    const basePoints = matchedRequiredCount * 1;
    // 2. Bonus Points: 2 points per correct out-of-range surah (multiplayer ONLY, 0 in solo)
    const bonusPoints = isMultiplayer ? newlyDiscoveredBonusCount * 2 : 0;
    // 3. Question Total Score = (correctRequiredCount * 1) + (correctBonusCount * 2)
    const questionScore = basePoints + bonusPoints;

    // Completion condition: all required answers answered (Bonus is strictly decoupled & optional)
    const isFullyCorrect = normalizedRequired.length > 0 && matchedRequiredCount === normalizedRequired.length;

    if (isFullyCorrect) {
      setSessionCorrect(prev => prev + 1);
    } else {
      setSessionWrong(prev => prev + 1);
    }

    // Update player's active score state immediately
    if (questionScore > 0) {
      addPoint({ challengeId: currentQuestion?.id, roomId: room?.id, points: questionScore });
    }
    setSessionScore(prev => prev + questionScore);
    setScore(prev => prev + questionScore);

    const newCumulativeScore = sessionScore + questionScore;

    if (view === 'group_game') {
      syncGroupProgress(false, newCumulativeScore);
      if (currentQuestion.verses) {
        const allVerseIds = currentQuestion.verses.map((v: any) => v.id);
        setMatchedIds(new Set(allVerseIds));
      }
    }

    const outOfRangeFinal = isMultiplayer
      ? outOfRangeAnswers.filter(b => !currentDiscoveredBonus.includes(b.surah))
      : outOfRangeAnswers;

    setSurahFeedbackData({
      isFullyCorrect,
      correctSurahs: requiredSurahNames,
      outOfRangeAnswers: outOfRangeFinal,
      discoveredBonusSurahs: isMultiplayer ? currentDiscoveredBonus : []
    });

    setSessionMistakes(prev => [...prev, {
      challenge: currentQuestion,
      text: currentQuestion.keyword || "",
      keyword: currentQuestion.keyword || "",
      type: 'SURAH',
      userInputs: [...surahInputs],
      correctSurahsList: requiredSurahNames,
      pointsEarned: questionScore,
      basePoints,
      bonusPoints,
      totalPossible: requiredSurahNames.length,
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
      const totalQ = room.questionCount || (challenges && challenges.length) || 5;
      const isLastQ = currentChallengeIndex >= totalQ - 1;

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
            pointsEarned: questionScore,
            basePoints: basePoints,
            bonusPoints: bonusPoints,
            score: newCumulativeScore,
            timestamp: Date.now()
          })
        }).then(res => res.json()).then(data => {
          if (data && data.status) {
            setRoom(data);
          }
        }).catch(err => console.error('Error submitting room surah answer:', err));

        if (!isLastQ) {
          const hasOutOfRange = outOfRangeFinal && outOfRangeFinal.length > 0;
          const advanceDelay = hasOutOfRange ? (isFullyCorrect ? 2500 : 2800) : (isFullyCorrect ? 900 : 1800);
          setTimeout(() => {
            moveToNextQuestion();
          }, advanceDelay);
        }
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
          pointsEarned: questionScore,
          basePoints: basePoints,
          bonusPoints: bonusPoints,
          score: newCumulativeScore,
          timestamp: Date.now()
        })
      }).then(res => res.json()).then(data => {
        if (data && data.status) {
          setRoom(data);
          if (!isLastQ && data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
            resetQuestionUIState(data.currentQuestionIndex, data);
          }
          if (data.status === 'completed' || data.status === 'FINISHED') {
            recordDailyGiftRoomMatch();
            router.push('/challenge/results');
            setView('group_game');
          }
        }
      }).catch(err => console.error('Error submitting room surah answer:', err));
      return;
    }

    const hasOutOfRange = outOfRangeFinal && outOfRangeFinal.length > 0;
    const advanceDelay = hasOutOfRange ? (isFullyCorrect ? 3000 : 3500) : (isFullyCorrect ? 1000 : 2500);
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
      const totalQ = room.questionCount || (challenges && challenges.length) || 5;
      const isLastQ = currentChallengeIndex >= totalQ - 1;

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
          }
        }).catch(err => console.error('Error submitting ASYNC skip:', err));

        if (!isLastQ) {
          moveToNextQuestion();
        }
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
          if (!isLastQ && data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
            resetQuestionUIState(data.currentQuestionIndex, data);
          }
          if (data.status === 'completed' || data.status === 'FINISHED') {
            recordDailyGiftRoomMatch();
            router.push('/challenge/results');
            setView('group_game');
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
        const hasSeerah = Boolean(localStorage.getItem('quran_quiz_progress_seerah')) && (() => {
            try {
              const p = JSON.parse(localStorage.getItem('quran_quiz_progress_seerah') || '{}');
              return (p.easy >= 3 && p.hard >= 3) || (Number(p.score || 0) >= 60);
            } catch { return false; }
          })();
        const hasGeneral = Boolean(localStorage.getItem('quran_quiz_progress_general')) && (() => {
            try {
              const p = JSON.parse(localStorage.getItem('quran_quiz_progress_general') || '{}');
              return (p.easy >= 5 && p.hard >= 5);
            } catch { return false; }
          })();
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
              seerahCompleted: hasSeerah,
              generalCompleted: hasGeneral,
              activeFrame: effectiveFrame
            })
          });
          if (scoreRes.ok) {
            const pData = await scoreRes.json();
            if (pData) {
              if (typeof pData.cups === 'number') {
                setCups(pData.cups);
                localStorage.setItem('quran_total_cups', pData.cups.toString());
                localStorage.setItem('quran_cups', pData.cups.toString());
              }
              if (typeof pData.points === 'number') {
                setTotalPoints(pData.points);
                localStorage.setItem('quran_total_points', pData.points.toString());
              }
              if (typeof pData.streak === 'number') {
                setStreak(pData.streak);
                localStorage.setItem('quran_streak', pData.streak.toString());
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

      // Fetch public leaderboard: Accessible to all visitors without requiring active session or login
      let response: Response;
      try {
        response = await fetch(`/api/player-score?action=leaderboard&${params.toString()}`, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });
        if (!response.ok) {
          response = await fetch(`/api/leaderboard?${params.toString()}`, {
            cache: 'no-store',
            headers: {
              'Pragma': 'no-cache',
              'Cache-Control': 'no-cache'
            }
          });
        }
      } catch {
        response = await fetch(`/api/leaderboard?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });
      }

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
          if (typeof myCups === 'number') {
            setCups(myCups);
            localStorage.setItem('quran_total_cups', myCups.toString());
            localStorage.setItem('quran_cups', myCups.toString());
          }
          const myPts = myEntry.totalPoints ?? myEntry.points;
          if (typeof myPts === 'number') {
            setTotalPoints(myPts);
            localStorage.setItem('quran_total_points', myPts.toString());
          }
          const myStreak = myEntry.streakCount ?? myEntry.streak;
          if (typeof myStreak === 'number') {
            setStreak(myStreak);
            localStorage.setItem('quran_streak', myStreak.toString());
          }
        }
      }
    } catch (error) {
      console.error('Leaderboard sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [playerName, playerUsername, cups, totalPoints, streak, completedChallengeIds, activeFrame, userCertificates]);

  // Requirement 1 & 2: Refresh User Profile / Session from server (/api/users/me)
  const refreshUserProfile = useCallback(async () => {
    const pUnique = uniquePlayerId || localStorage.getItem('quran_unique_player_id');
    const pUser = playerUsername || localStorage.getItem('quran_player_username');
    const pName = playerName || localStorage.getItem('quran_player_name');
    const pId = localStorage.getItem('quran_player_id');

    if (!pUnique && !pUser && !pName && !pId) return null;

    try {
      const params = new URLSearchParams({ t: Date.now().toString() });
      if (pId) params.append('id', pId);
      if (pUnique) params.append('uniquePlayerId', pUnique);
      if (pUser) params.append('username', pUser);
      if (pName) params.append('name', pName);

      const res = await fetch(`/api/users/me?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });

      if (!res.ok) return null;
      const data = await res.json();
      const user = data.user || data.player;

      if (user) {
        if (user.name) {
          setPlayerName(user.name);
          localStorage.setItem('quran_player_name', user.name);
        }
        if (user.username) {
          setPlayerUsername(user.username);
          localStorage.setItem('quran_player_username', user.username);
        }
        if (user.uniquePlayerId) {
          setUniquePlayerId(user.uniquePlayerId);
          localStorage.setItem('quran_unique_player_id', user.uniquePlayerId);
        }
        if (user.id) {
          setPlayerId(user.id);
          localStorage.setItem('quran_player_id', String(user.id));
        }
        if (typeof user.points === 'number') {
          setTotalPoints(user.points);
          localStorage.setItem('quran_total_points', String(user.points));
        }
        if (typeof user.cups === 'number') {
          setCups(user.cups);
          localStorage.setItem('quran_total_cups', String(user.cups));
          localStorage.setItem('quran_cups', String(user.cups));
        }
        if (typeof user.streak === 'number') {
          setStreak(user.streak);
          localStorage.setItem('quran_streak', String(user.streak));
        }
        if (user.activeFrame !== undefined) {
          const frame = (user.activeFrame === 'seerah' || user.activeFrame === 'general') ? user.activeFrame : null;
          setActiveFrame(frame);
          if (frame) {
            localStorage.setItem('quran_active_frame', frame);
          } else {
            localStorage.removeItem('quran_active_frame');
          }
        }
        return user;
      }
    } catch (e) {
      console.warn('Failed to refresh user profile from server:', e);
    }
    return null;
  }, [uniquePlayerId, playerUsername, playerName]);

  // Live session refresh on mount and window focus
  useEffect(() => {
    refreshUserProfile();
    const onFocus = () => refreshUserProfile();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshUserProfile();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshUserProfile]);

  // Realtime user updates listener (Supabase Realtime Broadcast)
  useEffect(() => {
    try {
      const channel = supabase.channel('realtime_user_updates')
        .on('broadcast', { event: 'user_profile_updated' }, () => {
          refreshUserProfile();
        })
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch { }
      };
    } catch (e) {
      console.warn('Realtime user profile subscription warning:', e);
    }
  }, [refreshUserProfile]);

  const handlePlayerLogout = useCallback(async () => {
    // 4. تنظيف حالة الواجهة (State Reset) فوراً
    try {
      setPlayerName(null);
      setPlayerUsername(null);
      setUniquePlayerId(null);
      setActiveFrame(null);
      setIsNameDecorated(false);
      setShowProfileDecoration(false);
      setUserCertificates([]);
      setPendingFriendRequestsCount(0);
      friendsRealtimeService.stopPresence();
    } catch (stateErr) {
      console.warn('[Hard Reset] State cleanup warning:', stateErr);
    }

    // 1. عزل عملية الخروج تماماً داخل try...catch مخصص (Safe Execution)
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error('[Hard Reset] Supabase auth signOut error:', signOutError);
    }

    // 2. التنظيف اليدوي العنيف (Manual Storage Clearing)
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (storageError) {
      console.error('[Hard Reset] Storage clearing error:', storageError);
    }

    // 3. إعادة توجيه قوية لتفريغ الكاش بالكامل (Hard Redirect & Full Page Reload)
    try {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (navErr) {
      console.error('[Hard Reset] Navigation error:', navErr);
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    }
  }, []);

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

  // Realtime Leaderboard updates: listen for admin score adjustments and update leaderboard instantly without full page refresh
  useEffect(() => {
    try {
      const channel = supabase.channel('realtime_leaderboard_updates')
        .on('broadcast', { event: 'leaderboard_updated' }, () => {
          syncLeaderboard();
        })
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch { }
      };
    } catch (e) {
      console.warn('Realtime leaderboard subscription warning:', e);
    }
  }, [syncLeaderboard]);



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
        quranCompleted: (completedChallengeIds.size >= 100)
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
        const lastWord = firstUnmatched ? (firstUnmatched.text || '').split(' ').filter(Boolean).slice(-1)[0] || '' : '';
        const correctVal = currentChallenge?.correctText || lastWord;
        generateOptions('complete', correctVal);
      }
    }
  }, [view, skillsType, targetVerses, matchedIds.size, generateOptions, roomGameMode, currentChallenge?.id || currentChallenge?.keyword, challengeMode]);

  const keywordWordCount = useMemo(() => {
    if (!KEYWORD) return 0;
    return (KEYWORD || '').split(' ').filter(Boolean).length;
  }, [KEYWORD]);

  const distinguishingWordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!KEYWORD || !targetVerses || targetVerses.length === 0) return counts;

    const normalizedKeyword = normalizeArabicText(KEYWORD || '');

    targetVerses.forEach(verse => {
      if (!verse) return;
      const normalizedVerse = normalizeArabicText(verse.text || '');
      const uniquePart = normalizedVerse.replace(normalizedKeyword, '').trim();
      const uniqueWords = (uniquePart || '').split(' ').filter(Boolean);

      if (uniqueWords.length === 0) {
        if (verse.id) counts[verse.id] = 0;
        return;
      }

      let wordsNeeded = 1;
      while (wordsNeeded < uniqueWords.length) {
        const prefix = uniqueWords.slice(0, wordsNeeded).join(' ');
        const isUnique = !targetVerses.some(otherVerse => {
          if (!otherVerse || otherVerse.id === verse.id) return false;
          const otherNormalized = normalizeArabicText(otherVerse.text || '');
          const otherUniquePart = otherNormalized.replace(normalizedKeyword, '').trim();
          return otherUniquePart.startsWith(prefix);
        });

        if (isUnique) break;
        wordsNeeded++;
      }
      if (verse.id) {
        counts[verse.id] = Math.max(wordsNeeded, Math.min(2, uniqueWords.length));
      }
    });
    return counts;
  }, [targetVerses, KEYWORD]);

  // التحقق من المطابقة كلما تغير النص المسموع
  useEffect(() => {
    if (!transcript || !targetVerses || targetVerses.length === 0) return;

    const normalizedTranscript = normalizeArabicText(transcript || '');
    const transcriptWords = (normalizedTranscript || '').split(' ').filter(Boolean);

    const candidates: { verse: Verse, score: number, distRatio: number, fullRatio: number }[] = [];
    const newWordStates = { ...wordStates };
    let countsChanged = false;

    targetVerses.forEach(verse => {
      if (!verse || !verse.id || matchedIds.has(verse.id)) return;

      const normalizedVerse = normalizeArabicText(verse.text || '');
      const normalizedKeyword = normalizeArabicText(KEYWORD || '');

      const uniquePart = normalizedVerse.replace(normalizedKeyword, '').trim();
      const uniqueWords = (uniquePart || '').split(' ').filter(Boolean);

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
      const normalizedTranscriptFull = normalizeArabicText(transcript || '');
      const normalizedVerseMatch = normalizeArabicText(verse.text || '');
      const isFullTextMatch = normalizedTranscriptFull.includes(normalizedVerseMatch) ||
        (getSimilarity(normalizedTranscriptFull, normalizedVerseMatch) > 0.85) ||
        (normalizedTranscriptFull.includes(normalizeArabicText(KEYWORD || '')) &&
          uniqueWords.length > 0 &&
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
    setSessionCorrect(0);
    setSessionScore(0);
    setSessionWrong(0);
    setSessionMistakes([]);
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
    sessionScore, setSessionScore,
    sessionWrong, setSessionWrong,
    sessionMistakes, setSessionMistakes,
    showMistakes, setShowMistakes,
    sessionCurrentIndex, setSessionCurrentIndex,
    skillsOptions, setSkillsOptions,
    selectedOption, setSelectedOption,
    skillsFeedback, setSkillsFeedback,
    hasAnsweredCurrentQuestion, setHasAnsweredCurrentQuestion,
    surahInputs, setSurahInputs,
    surahBonusInput, setSurahBonusInput,
    hasBonusField,
    handleSurahBonusInputChange,
    handleSurahInputChange,
    handleSurahInputChangeBonus,
    handleSurahInputChangeSingle,
    discoveredBonusSurahs, setDiscoveredBonusSurahs,
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
    powerups, setPowerups,
    buyPowerup,
    isPurchasingPowerup,
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
    roomScopeMode, setRoomScopeMode,
    roomSelectedJuzs, setRoomSelectedJuzs,
    roomSelectedSurahs, setRoomSelectedSurahs,
    roomSurahSearch, setRoomSurahSearch,
    roomSettings, setRoomSettings,
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
    prefillRoomSettingsForEdit,
    handleUpdateRoomSettings,
    isSavingRoomSettings,
    fetchAvailableSkillCounts,
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
    rooms: availableRooms, setRooms: setAvailableRooms,
    updateRoomInList,
    isLoadingRooms, setIsLoadingRooms,
    isPullRefreshing, setIsPullRefreshing,
    fetchAvailableRooms,
    handleJoinV1,
    privateRoomModal, setPrivateRoomModal,
    // Room Presence: Set of IDs (player id/name/username) currently online in the active game room
    roomPresenceOnlineIds,
    handleRoomTimeout,
    resetQuestionUIState,
    moveToNextQuestion,
    syncGroupProgress,
    handleLeaveRoom: () => {
      setRoom(null);
      setActiveRunningRoom(null);
      setIncomingRoomInvite(null);
      setIsResignModalOpen(false);
      setPrivateRoomModal({
        isOpen: false,
        room: null,
        password: '',
        error: undefined
      });
      setIsFriendsModalOpen(false);
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
    playerId, setPlayerId,
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
    selectedAyah, setSelectedAyah,
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
    router,
    navigateToRoute: router.push,

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
    completeDailyChestChallenge,
    recordDailyChestRetry,
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
    pendingFriendRequestsCount, setPendingFriendRequestsCount,
    selectedProfilePlayer, setSelectedProfilePlayer,
    incomingRoomInvite, setIncomingRoomInvite,
    inviteData: incomingRoomInvite, setInviteData: setIncomingRoomInvite,
    isInviteModalOpen: Boolean(incomingRoomInvite), setIsInviteModalOpen: (open: boolean) => {
      if (!open) setIncomingRoomInvite(null);
    },
    handleAcceptRoomInvite,
    handleDeclineRoomInvite,
    handleOpenPlayerProfile,
    handleClosePlayerProfile,
    refreshUserProfile,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
