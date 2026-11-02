import { HadithPage } from "./pages/HadithPage";
import { AdhkarPage } from "./pages/AdhkarPage";
import { AyahsListPage } from "./pages/AyahsListPage";
import { LibraryHubPage } from "./pages/LibraryHubPage";
import { ChallengesHubPage } from "./pages/ChallengesHubPage";
import { SkillsResultsPage } from "./pages/SkillsResultsPage";
import { SkillsCountSelectionPage } from "./pages/SkillsCountSelectionPage";
import { SpeedChallengePage } from "./pages/SpeedChallengePage";
import { GroupGameResultsPage } from "./pages/GroupGameResultsPage";
import { GroupWaitingPage } from "./pages/GroupWaitingPage";
import { GroupJoinPage } from "./pages/GroupJoinPage";
import { GroupCreatePage } from "./pages/GroupCreatePage";
import { HomePage } from "./pages/HomePage";
import { MushafPage } from "./pages/MushafPage";
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import {
  Sparkles, Trophy, RotateCcw, X, Mic, MicOff, Search, BookOpen, CheckCircle, CheckCircle2,
  ChevronRight, ChevronLeft, LayoutGrid, Heart, History, Compass, Home, Plane, Award, Star,
  ListFilter, Sun, Moon, Calendar, Settings, Copy, Check, Lightbulb, ChevronDown, User, Users, Quote,
  ArrowRight, ArrowLeft, Zap, Lock, AlertCircle, Hash, XCircle, Eye, EyeOff, List, Loader2, Flame, ZoomIn, ZoomOut, Maximize2, LogOut,
  Info, HelpCircle, AtSign, Key, LogIn, UserPlus, Smartphone, Download, Share2, Mail, ExternalLink, Send,
  Clock, RefreshCw, Globe, Plus, Gamepad2, Trash2, Play, ShoppingBag
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import CertificateGenerator from './components/CertificateGenerator';
import { quranData } from './services/QuranRepository';

import { HADITHS, Hadith } from './services/HadithRepository';
import { juzBoundaries, JUZ_NAMES_AR, ALL_QURAN_SURAHS, getJuzsForSurah } from './services/JuzRepository';
import { getPageNumber, juzStartPages, surahStartPages } from './services/PageRepository';
import { adhkarData, Dhikr } from './services/AdhkarRepository';
import { normalizeArabicText, getSimilarity, convertArabicNumbersToEnglish } from './utils/arabic';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import Confetti from 'react-confetti';
import ConfirmModal from './components/ConfirmModal';
import { supabase } from './services/supabase';
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import SkillsMenu from './components/SkillsMenu';
import BookReader from './components/BookReader';
import Encyclopedia from './components/Encyclopedia';
import IslamicQuiz from './components/IslamicQuiz';
import { IslamicVideos } from './components/IslamicVideos';
import QuranZoomViewer from './components/QuranZoomViewer';
import AyahActionSheet from './components/AyahActionSheet';
import IslamicRoomConfigModal from './components/IslamicRoomConfigModal';
import { getRandomIslamicRoomQuestions, getTargetedIslamicQuestions, getTotalIslamicAvailableCount, getIslamicTopicAvailableCount } from './utils/islamicChallengeHelper';
import { islamicCategoriesList } from './data/islamicCategories';
import DailyAyah from './components/DailyAyah';
import { renderQuranText } from './utils/quranUtils';
import { calculateStreakInfo, StreakInfo } from './utils/streakManager';
import { LeaderboardUser, compareLeaderboardUsers, calculateHiddenRankingScore } from './utils/leaderboardRanking';
import { StreakModal } from './components/StreakModal';
import { CosmeticStoreModal } from './components/CosmeticStoreModal';
import { LiveReactionsOverlay } from './components/LiveReactionsOverlay';
import { generateCompletionChallenges } from './services/challengeGenerator';
import SettingsView from './components/Settings/SettingsView';
import IslamicOccasionsModal from './components/IslamicOccasionsModal';
import { AppDownloadModal } from './components/AppDownloadModal';
import { GooglePlayTesterModal, GooglePlayButton, GooglePlayLogo } from './components/GooglePlayTesterModal';
import { PrivacyModal } from './components/PrivacyModal';
import WhoAmIGame from './components/WhoAmIGame';
import { WhoAmIInfoAlert } from './components/WhoAmISettings';
import { defaultChallenges } from './data/defaultChallenges';
import { PullToRefresh } from './components/PullToRefresh';
import {
  GroupChallengeEmblem,
  DailyChallengeEmblem,
  SkillsChallengeEmblem,
  SpeedChallengeEmblem,
  IslamicQuizEmblem,
  MushafLibraryIcon,
  AdhkarLibraryIcon,
  HadithLibraryIcon,
  BookLibraryIcon,
  EncyclopediaLibraryIcon,
  VideoLibraryIcon
} from './components/IslamicChallengeEmblems';
import {
  getHijriDate,
  getUpcomingOccasions,
  getNearestOccasion,
  syncAladhanHijri,
  HijriDateInfo,
  IslamicOccasion
} from './services/IslamicOccasionsService';

import { useWindowSize } from "./hooks/useWindowSize";
import { View, VALID_VIEWS, Difficulty, Verse, VerseCardProps } from "./types/challenges";
import { getBestSubsequenceMatch, superNormalizeArabic, getSpeedQuestionDuration } from "./utils/challengeHelpers";
import { SkillsChallengeHeader } from "./components/challenge/SkillsChallengeHeader";
import { VerseCard } from "./components/challenge/VerseCard";
import { AudioChallengeUI } from "./components/challenge/AudioChallengeUI";
import { SurahChallengeUI } from "./components/challenge/SurahChallengeUI";
import { CompleteChallengeUI } from "./components/challenge/CompleteChallengeUI";
import { LibrarySettingsModal } from "./components/LibrarySettingsModal";

export { superNormalizeArabic, getSpeedQuestionDuration };
export type { View, Difficulty, Verse, VerseCardProps };

const toast = {
  success: (msg: string, ..._args: any[]) => console.log(`SUCCESS: ${msg}`),
  error: (msg: string, ..._args: any[]) => console.log(`ERROR: ${msg}`)
};

export default function App() {
  const [view, setViewState] = useState<View>(() => {
    try {
      const saved = sessionStorage.getItem('current_app_view');
      if (saved && VALID_VIEWS.includes(saved as View)) {
        return saved as View;
      }
    } catch (e) {}
    return 'home';
  });

  const isPoppingRef = useRef(false);

  const setView = useCallback((next: View | ((prev: View) => View), pushToHistory = true) => {
    setViewState(prev => {
      const nextView = typeof next === 'function' ? next(prev) : next;
      if (nextView === prev) return prev;

      try {
        sessionStorage.setItem('current_app_view', nextView);
      } catch (e) {}

      if (pushToHistory && !isPoppingRef.current) {
        window.history.pushState({ view: nextView }, '', '');
      }
      return nextView;
    });
  }, []);

  useEffect(() => {
    if (!window.history.state || window.history.state.view !== view) {
      window.history.replaceState({ view }, '', '');
    }

    const handlePopState = (e: PopStateEvent) => {
      isPoppingRef.current = true;
      const targetView = (e.state && e.state.view && VALID_VIEWS.includes(e.state.view))
        ? (e.state.view as View)
        : 'home';

      try {
        sessionStorage.setItem('current_app_view', targetView);
      } catch (err) {}

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
    } catch {}
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
      } catch {}
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
    } catch {}
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
    } catch {}
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
        } catch {}
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
    } catch {}
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
  const [totalPoints, setTotalPoints] = useState<number>(() => Number(localStorage.getItem('quran_total_points')) || 0);
  const [cups, setCups] = useState(() => parseInt(localStorage.getItem('quran_total_cups') || localStorage.getItem('quran_cups') || '0'));

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
    syncAladhanHijri().catch(() => {});
  }, []);
  const [showProfileDecoration, setShowProfileDecoration] = useState(() => localStorage.getItem('quran_show_decoration') !== 'false');
  const [userCertificates, setUserCertificates] = useState<{ category: string, date: string, name: string }[]>(() => JSON.parse(localStorage.getItem('quran_user_certificates') || '[]'));
  const [showCertificate, setShowCertificate] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'seerah' | 'general'>('seerah');

  // Game Gamification: Explicit Decoration State
  const [activeFrame, setActiveFrame] = useState<string | null>(() => localStorage.getItem('quran_active_frame'));
  const [isNameDecorated, setIsNameDecorated] = useState(() => localStorage.getItem('quran_name_decorated') === 'true');

  // Gamification: Achievement Style Definitions (Only official frames: seerah and general)
  const achievementStyles: Record<string, { className: string, icon: string, textColor: string }> = {
    seerah: {
      className: 'rounded-full bg-[url("/golden_seerah_achievement_frame.png")] bg-center bg-no-repeat bg-contain scale-110',
      icon: '/icons/seerah.png',
      textColor: 'from-amber-600 via-yellow-600 to-amber-700'
    },
    general: {
      className: 'rounded-full bg-[url("/golden_general_achievement_frame.png")] bg-center bg-no-repeat bg-contain scale-110',
      icon: '/icons/general.png',
      textColor: 'from-blue-600 via-sky-500 to-indigo-700'
    },
    none: {
      className: 'rounded-full bg-slate-200',
      icon: '',
      textColor: 'from-slate-600 to-slate-800'
    }
  };

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

  const userAchievement = activeFrame || getActiveAchievement();
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

  // Cosmetics Store State
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
  const [equippedTitle, setEquippedTitle] = useState<string | null>(() => {
    return localStorage.getItem('quran_equipped_title') || null;
  });
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

  const [librarySettings, setLibrarySettings] = useState<{ darkMode: boolean; [key: string]: any }>(() => {
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
      } catch (e) {}
    } else if (!val) {
      try {
        localStorage.removeItem('activeRoomId');
      } catch (e) {}
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
    } catch {}
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
          } catch {}
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
        document.documentElement.requestFullscreen().catch(() => {});
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
        document.exitFullscreen().catch(() => {});
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
  const [motivationalQuote, setMotivationalQuote] = useState('');

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

  const MOTIVATIONAL_HADITHS = useMemo(() => [
    "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    "الَّذِي يَقْرَأُ الْقُرْآنَ وَهُوَ مَاهِرٌ بِهِ مَعَ السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ",
    "اقْرَؤُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ",
    "مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللَّهِ فَلَهُ بِهِ حَسَنَةٌ وَالْحَسَنَةُ بِعَشْرِ أَمْثَالِهَا",
    "يُقَالُ لِصَاحِبِ الْقُرْآنِ: اقْرَأْ وَارْتَقِ وَرَتِّلْ كَمَا كُنْتَ تُرَتِّلُ فِي الدُّنْيَا"
  ], []);

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
  }, [MOTIVATIONAL_HADITHS]);

  const updateStatsAfterWin = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = Date.now();
    const savedLastPlayedTimeStr = localStorage.getItem('quran_last_played_time');
    const savedStreak = parseInt(localStorage.getItem('quran_streak') || streak.toString());

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

    const newTotalPoints = totalPoints + score;
    setTotalPoints(newTotalPoints);
    localStorage.setItem('quran_total_points', newTotalPoints.toString());

    const hasSeerah = userCertificates.some(c => c.category === 'seerah');
    const hasGeneral = userCertificates.some(c => c.category === 'general');
    const effectiveFrame = (activeFrame === 'seerah' || activeFrame === 'general')
      ? activeFrame
      : (hasGeneral ? 'general' : (hasSeerah ? 'seerah' : null));

    // Sync completion status with backend
    fetch('/api/player-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: playerUsername,
        name: playerName,
        score: newTotalPoints,
        totalPoints: newTotalPoints,
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
    const todayStr = new Date().toISOString().split('T')[0];
    const savedDaily = localStorage.getItem('quran_daily_completed');
    if (savedDaily === todayStr) {
      setDailyCompleted(true);
    } else {
      setDailyCompleted(false);
    }
  }, []);

  // Check for 1v1 room ID in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetRoomId = params.get('roomId') || params.get('room') || params.get('code');

    if (targetRoomId && playerName) {
      handleJoinV1(targetRoomId);
    }
  }, [playerName]);

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

  const handleCancelRoomByHost = () => {
    if (!room?.id) return;
    setIsCancelRoomModalOpen(true);
  };

  const confirmCancelRoomByHost = async () => {
    if (!room?.id) return;

    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel-room',
          roomId: room.id,
          playerId: playerUsername || playerName
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('تم إلغاء الغرفة بنجاح');
        setRoom(null);
        setView('group_join');
      } else {
        toast.error(data.message || 'فشل إلغاء الغرفة');
      }
    } catch (err) {
      toast.error('حدث خطأ في الاتصال');
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

  const handleResignGroupChallenge = async () => {
    if (!room?.id || (!playerUsername && !playerName)) return;
    setActiveRunningRoom(null);
    localStorage.removeItem('activeRoomId');
    localStorage.removeItem('currentRoomId');
    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resign',
          roomId: room.id,
          playerId: playerUsername || playerName
        })
      });
      const data = await res.json();
      if (res.ok) setRoom(data);
    } catch (err) {
      console.error('Group resign error:', err);
    }
    setSessionCorrect(0);
    setActiveRunningRoom(null);
    setView('home');
    setIsResignModalOpen(false);
  };
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
          // Award a cup if the session was completed with correct answers!
          if (sessionCorrect > 0) {
            setCups(prev => {
              const nextCups = prev + 1;
              localStorage.setItem('quran_total_cups', nextCups.toString());
              localStorage.setItem('quran_cups', nextCups.toString());
              return nextCups;
            });
            if (playerUsername || playerName) {
              fetch('/api/player-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username: playerUsername,
                  name: playerName,
                  cups: 1,
                  totalCups: cups + 1,
                  totalPoints: totalPoints
                })
              }).catch(err => console.error('Failed to sync cup on session complete:', err));
            }
          }
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

        const earnedPoints = 1; // نقطة واحدة (1) بدلاً من 10 نقاط
        setTotalPoints(prev => {
          const next = prev + earnedPoints;
          localStorage.setItem('quran_total_points', next.toString());
          return next;
        });

        if (playerUsername || playerName) {
          fetch('/api/player-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: playerUsername,
              name: playerName,
              points: earnedPoints,
              totalPoints: totalPoints + earnedPoints,
              challengeId: currentQuestion?.id,
              roomId: room?.id
            })
          }).catch(err => console.error('Failed to sync score:', err));
        }

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
          setSkillsFeedback(false);
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

      const earnedPoints = 1; // نقطة واحدة (1) بدلاً من 10 نقاط
      setTotalPoints(prev => {
        const next = prev + earnedPoints;
        localStorage.setItem('quran_total_points', next.toString());
        return next;
      });

      if (playerUsername || playerName) {
        fetch('/api/player-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: playerUsername,
            name: playerName,
            points: earnedPoints,
            totalPoints: totalPoints + earnedPoints,
            challengeId: currentQuestion?.id,
            roomId: room?.id
          })
        }).catch(err => console.error('Failed to sync score:', err));
      }

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
        const effectiveFrame = (storedFrame === 'seerah' || storedFrame === 'general')
          ? storedFrame
          : (storedFrame === 'none' ? 'none' : (hasSeerah ? 'seerah' : (hasGeneral ? 'general' : null)));

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
    let newCups = cups;

    setBestScores(prev => {
      const currentBest = prev[challengeKey] || 0;
      const updated = { ...prev };
      if (score > currentBest) {
        const cupThreshold = Math.min(50, targetVerses.length * 8);
        if (score >= cupThreshold && currentBest < cupThreshold) {
          newCups = cups + 1;
          setCups(newCups);
        }
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

    const pointsToAdd = score > 0 ? score : 1;
    const newPoints = totalPoints + pointsToAdd;
    setTotalPoints(newPoints);
    localStorage.setItem('quran_total_points', newPoints.toString());

    let newCupsCount = cups;
    if (isNewCompletion) {
      newCupsCount = cups + 1;
      setCups(newCupsCount);
      localStorage.setItem('quran_total_cups', newCupsCount.toString());
      localStorage.setItem('quran_cups', newCupsCount.toString());
    }

    // Sync with backend using player username / name
    fetch('/api/player-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: playerUsername,
        name: playerName,
        points: pointsToAdd,
        totalPoints: newPoints,
        cups: isNewCompletion ? 1 : 0,
        totalCups: newCupsCount,
        challengeId: currentChallenge?.id,
        roomId: room?.id,
        score: newPoints,
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

  // Retroactive Cup Synchronization
  useEffect(() => {
    if (challenges.length > 0 && Object.keys(bestScores).length > 0) {
      const calculatedCups = challenges.reduce((total, c) => {
        const score = bestScores[c.keyword] || 0;
        const verses = Array.isArray(c.verses) ? c.verses : [];
        const threshold = Math.min(50, verses.length * 8);
        return score >= threshold ? total + 1 : total;
      }, 0);

      if (calculatedCups > cups) {
        setCups(calculatedCups);
        // Sync with backend using current state
        const newPoints = totalPoints;
        fetch('/api/player-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: playerUsername,
            name: playerName,
            points: newPoints,
            cups: calculatedCups,
            roomId: room?.id,
            score: newPoints
          })
        })
          .catch(err => console.error('Failed to sync retroactive cups:', err));
      }
    }
  }, [challenges, bestScores, cups, totalPoints, playerUsername, playerName]);


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

      const pointsEarned = 1; // نقطة واحدة (1) بدلاً من 10 نقاط
      setScore(prev => prev + pointsEarned);
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

  return (
    <div className={`min-h-screen relative text-slate-900 font-sans selection:bg-brand-emerald/10 ${librarySettings.darkMode ? 'lib-dark' : 'bg-slate-50'}`} dir="rtl">
      {/* Background with Generated Pattern */}
      <div
        className={`absolute inset-0 z-0 opacity-10 pointer-events-none transition-opacity duration-700 ${librarySettings.darkMode ? 'mix-blend-soft-light opacity-5' : 'mix-blend-multiply opacity-10'}`}
        style={{
          backgroundImage: `url('/islamic_pattern.png')`,
          backgroundSize: '400px',
        }}
      />

      {isComplete && <Confetti width={width} height={height} recycle={false} numberOfPieces={400} gravity={0.15} colors={['#064e3b', '#d4af37', '#fdfbf7', '#10b981']} />}

      {view === 'admin' ? (
        <div className="relative z-10 w-full min-h-screen">
          {adminToken ? (
            <AdminDashboard
              token={adminToken}
              isSuperAdmin={isSuperAdmin}
              adminRole={adminRole}
              currentUsername={adminUsername}
              currentName={adminName}
              currentAdminId={adminId}
              canManageUsers={canManageUsers}
              onPermissionsUpdated={(updated) => {
                setCanManageUsers(updated);
                localStorage.setItem('quran_admin_can_manage_users', String(updated));
              }}
              systemSettings={systemSettings}
              onSettingsUpdated={fetchSettings}
              onLogout={handleAdminLogout}
              onBackHome={() => {
                setView('home');
                fetchChallenges();
                fetchCompletionChallenges();
              }}
            />
          ) : (
            <AdminLogin
              onLogin={handleAdminLogin}
              onBack={() => setView('home')}
            />
          )}
        </div>
      ) : (
        <>
          {/* Header */}
          {!isMushafFullscreen && (
            <header className="w-full sticky top-0 z-40 glass-dark text-white shadow-xl border-b border-white/10 backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
            <div className="w-full px-4 sm:px-8 py-2 md:py-2 flex items-center justify-between gap-2 sm:gap-4 relative z-10">

              {/* Logo & Title */}
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                onClick={() => {
                  setView('home');
                  setShowScores(false);
                  setShowSettings(false);
                }}
                className="flex items-center gap-2 sm:gap-3 shrink-0 cursor-pointer group"
                title="تطبيق متين"
              >
                <div className="bg-white p-1 sm:p-1.5 rounded-xl md:rounded-2xl shadow-lg border border-white/60 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <img src="/logo.png" className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 object-contain" alt="شعار متين" />
                </div>
                <div className="flex flex-col justify-center select-none">
                  <div className="flex items-center">
                    <img
                      src="/matin-title-light.png"
                      className="h-6 sm:h-7 md:h-8 w-auto object-contain drop-shadow-md"
                      alt="متين"
                    />
                  </div>
                  <p className="text-[8px] sm:text-[9px] md:text-[10px] font-bold tracking-[0.2em] text-brand-gold/90 leading-none mt-1 whitespace-nowrap">
                    لعلوم القرآن الكريم
                  </p>
                </div>
              </motion.div>

              {/* Navigation Actions & Profile */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <button
                  onClick={() => {
                    setShowScores(!showScores);
                    setShowSettings(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95 ${showScores ? 'bg-brand-gold text-brand-emerald font-black' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                    }`}
                  title="المتصدرين"
                >
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{showScores ? 'العودة' : 'المتصدرين'}</span>
                </button>

                {/* Dark Mode / Light Mode Toggle Button */}
                <button
                  onClick={() => setLibrarySettings((prev: any) => ({ ...prev, darkMode: !prev.darkMode }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95 ${
                    librarySettings.darkMode
                      ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40 hover:bg-amber-400/35'
                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                  }`}
                  title={librarySettings.darkMode ? 'التبديل إلى الوضع الفاتح (Light Mode)' : 'التبديل إلى الوضع الداكن (Dark Mode)'}
                  aria-label="تبديل الوضع الداكن والفاتح"
                >
                  {librarySettings.darkMode ? (
                    <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200" />
                  )}
                  <span className="hidden sm:inline">
                    {librarySettings.darkMode ? 'فاتح' : 'داكن'}
                  </span>
                </button>


                <button
                  onClick={() => setShowAboutModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95"
                  title="عن التطبيق"
                >
                  <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-gold" />
                  <span className="hidden sm:inline">عن التطبيق</span>
                </button>

                <button
                  onClick={() => setView('admin')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95"
                  title="لوحة التحكم"
                >
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">الإدارة</span>
                </button>

                {playerName && (
                  <div
                    onClick={() => setView('settings')}
                    className="flex items-center gap-2 sm:gap-2.5 pr-2 sm:pr-2.5 border-r border-white/20 mr-0.5 sm:mr-1 shrink-0 cursor-pointer group"
                    title="ملفي الشخصي"
                  >
                    <div className="relative shrink-0 flex items-center justify-center">
                      <div className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white font-black text-xs sm:text-sm bg-gradient-to-br from-brand-emerald to-emerald-700 border-2 border-white/30 shadow-md group-hover:scale-105 transition-transform">
                        {(playerName || '').trim().charAt(0).toUpperCase()}
                      </div>
                      {isElite && (
                        safeAchievement === 'seerah' ? (
                          <div className="absolute -inset-1.5 rounded-full pointer-events-none z-20 bg-[url('/golden_seerah_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                        ) : safeAchievement === 'general' ? (
                          <div className="absolute -inset-1.5 rounded-full pointer-events-none z-20 bg-[url('/golden_general_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                        ) : (
                          <div className={`absolute -inset-1 rounded-full pointer-events-none z-0 ${currentStyle.className}`} />
                        )
                      )}
                      {isElite && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -bottom-1 -left-1 z-30 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center bg-transparent drop-shadow-lg"
                          title={userAchievement}
                        >
                          {currentStyle.icon.startsWith('/') ? (
                            <img src={currentStyle.icon} className="w-full h-full object-contain" alt="Badge" />
                          ) : (
                            <div className="flex items-center justify-center bg-transparent text-white text-[8px] sm:text-[9px] drop-shadow-lg w-full h-full">
                              {currentStyle.icon}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                    <div className="hidden lg:flex flex-col text-right whitespace-nowrap">
                      <span className={`text-xs sm:text-sm font-black leading-none ${isElite ? `text-transparent bg-clip-text bg-gradient-to-r ${currentStyle.textColor}` : 'text-white'}`}>
                        {playerName}
                      </span>
                      <span className="text-[10px] font-bold text-brand-gold/80 mt-0.5">{totalPoints} نقطة</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
          )}

          {/* Floating Back Button Directly Below Top Header Bar - ONLY visible when viewing Holy Quran (view === 'mushaf') */}
          {view === 'mushaf' && !isMushafFullscreen && (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-3 pb-1 flex justify-start items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <button
                onClick={() => {
                  setView('library');
                  setIsPageModeActive(false);
                  setSelectedSurahId(null);
                  setSelectedJuz(null);
                  setIsSearchSubmitted(false);
                  resetTranscript();
                  stopListening();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 backdrop-blur-md border border-emerald-200/60 dark:border-slate-700 shadow-sm hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all text-xs sm:text-sm font-black active:scale-95 group cursor-pointer"
                title="الرجوع للمكتبة"
              >
                <ArrowRight className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
                <span className="text-emerald-800 dark:text-emerald-300 font-black">الرجوع للمكتبة</span>
              </button>

              {isPageModeActive && (
                <button
                  onClick={() => {
                    setIsPageModeActive(false);
                    setIsSurahMenuOpen(false);
                    setIsJuzMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 backdrop-blur-md border border-amber-300/60 dark:border-slate-700 shadow-sm hover:bg-amber-50 dark:hover:bg-slate-700 transition-all text-xs sm:text-sm font-black active:scale-95 group cursor-pointer"
                  title="العودة لشاشة الدليل والمزايا"
                >
                  <BookOpen className="w-4 h-4 text-brand-emerald group-hover:scale-110 transition-transform" />
                  <span className="text-slate-700 dark:text-slate-200 font-black">دليل ومزايا المصحف</span>
                </button>
              )}
            </div>
          )}

          {/* Multiplayer Resign Button if in a room */}
          {room && (view === 'challenge' || view === 'group_waiting' || view === 'group_game') && (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-3 pb-1 flex justify-end items-center">
              <button
                onClick={() => setIsResignModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200/80 shadow-sm transition-all text-xs sm:text-sm font-black active:scale-95 group"
                title="الانسحاب من التحدي الجماعي"
              >
                <LogOut className="w-4 h-4 text-red-500 group-hover:rotate-180 transition-transform" />
                <span>الانسحاب من التحدي</span>
              </button>
            </div>
          )}

          {/* Daily Ayah Section (Below Header) - Only visible on Home Page */}
          {view === 'home' && !showScores && <DailyAyah />}

          <AnimatePresence>
            {!playerName && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xl overflow-y-auto"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="glass p-6 sm:p-10 md:p-12 rounded-3xl md:rounded-[3.5rem] max-w-md w-full shadow-2xl text-center relative my-auto bg-white/95"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-emerald rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-xl shadow-brand-emerald/20 text-white">
                    {playerAuthMode === 'register' ? (
                      <UserPlus className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    ) : (
                      <Key className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    )}
                  </div>

                  <h2 className="text-xl md:text-3xl font-black text-brand-emerald mb-2">
                    {playerAuthMode === 'register' ? 'أهلاً بك في تطبيق متين' : 'تسجيل الدخول'}
                  </h2>
                  <p className="text-slate-500 font-bold text-xs md:text-sm mb-6">
                    {playerAuthMode === 'register'
                      ? 'أنشئ حسابك لحفظ تقدمك والتنافس في لوحة المتصدرين'
                      : 'أدخل بيانات حسابك لمتابعة التحدي وحفظ نقاطك'}
                  </p>

                  {registrationError && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-5 p-3.5 bg-red-50 text-red-600 rounded-2xl text-xs md:text-sm font-bold border border-red-100 text-center"
                    >
                      {registrationError}
                    </motion.div>
                  )}

                  <form onSubmit={handlePlayerAuth} className="space-y-4 text-right">
                    {playerAuthMode === 'register' && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-brand-emerald" />
                          <span>الاسم</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: أحمد محمد"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 focus:border-brand-emerald transition-all font-bold text-sm text-slate-800"
                        />
                      </div>
                    )}

                    {/* حقل اسم المستخدم مع @ مدمجة تلقائياً */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <AtSign className="w-3.5 h-3.5 text-brand-emerald" />
                          <span>{playerAuthMode === 'register' ? 'اسم المستخدم' : 'اسم المستخدم أو الاسم'}</span>
                        </span>
                        <span className="text-[9px] text-brand-emerald font-bold bg-brand-emerald/10 px-2 py-0.5 rounded-md">
                          تبدأ بـ @ تلقائياً
                        </span>
                      </label>
                      <div className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:ring-2 focus-within:ring-brand-emerald/20 focus-within:border-brand-emerald rounded-2xl transition-all overflow-hidden">
                        <span className="pr-4 pl-1 text-brand-emerald font-black text-lg select-none shrink-0 pointer-events-none">
                          @
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="username"
                          value={usernameInput}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/@/g, '').trim();
                            setUsernameInput(cleaned);
                          }}
                          className="w-full py-3.5 pr-1 pl-4 bg-transparent outline-none font-bold text-sm text-slate-800 text-right"
                        />
                      </div>
                    </div>

                    {/* حقل كلمة المرور */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>كلمة المرور</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 focus:border-brand-emerald transition-all font-bold text-sm text-slate-800"
                      />
                      {playerAuthMode === 'login' && (
                        <p className="text-[10px] text-slate-400 font-bold mr-1">
                          * كلمة المرور الافتراضية للحسابات السابقة: 1234
                        </p>
                      )}
                    </div>

                    {/* الموافقة على سياسة الخصوصية وشروط الاستخدام */}
                    <div className="pt-1 pb-1">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-right group">
                        <input
                          type="checkbox"
                          checked={hasAgreedToPrivacy}
                          onChange={(e) => {
                            setHasAgreedToPrivacy(e.target.checked);
                            if (registrationError && e.target.checked) {
                              setRegistrationError(null);
                            }
                          }}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald/30 cursor-pointer accent-emerald-600 shrink-0"
                        />
                        <span className="text-[11px] sm:text-xs text-slate-600 font-bold leading-relaxed">
                          أوافق على{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrivacyModalInitialTab('privacy');
                              setShowPrivacyModal(true);
                            }}
                            className="text-brand-emerald hover:text-emerald-700 underline font-black inline cursor-pointer"
                          >
                            سياسة الخصوصية
                          </button>
                          {' '}و{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrivacyModalInitialTab('terms');
                              setShowPrivacyModal(true);
                            }}
                            className="text-brand-emerald hover:text-emerald-700 underline font-black inline cursor-pointer"
                          >
                            شروط الاستخدام
                          </button>
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isRegistering}
                      className="w-full py-4 mt-2 bg-brand-emerald text-white rounded-2xl font-black shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                      {isRegistering ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : playerAuthMode === 'register' ? (
                        <>
                          <span>ابدأ التحدي</span>
                          <ArrowLeft className="w-5 h-5" />
                        </>
                      ) : (
                        <>
                          <span>تسجيل الدخول ومتابعة التحدي</span>
                          <LogIn className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* التبديل بين لدي حساب بالفعل / ليس لدي حساب */}
                  <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                    {playerAuthMode === 'register' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerAuthMode('login');
                          setRegistrationError(null);
                        }}
                        className="text-xs md:text-sm font-black text-brand-emerald hover:text-brand-emerald/80 hover:underline transition-colors py-1"
                      >
                        لدي حساب بالفعل؟ تسجيل الدخول
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerAuthMode('register');
                          setRegistrationError(null);
                        }}
                        className="text-xs md:text-sm font-black text-brand-emerald hover:text-brand-emerald/80 hover:underline transition-colors py-1"
                      >
                        ليس لدي حساب، إنشاء حساب جديد
                      </button>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content*/}
          <PullToRefresh onRefresh={handlePullToRefresh}>
            <main className={`overflow-y-auto w-full ${view === 'mushaf'
              ? (isPageModeActive ? 'max-w-[96rem] px-0 sm:px-2 md:px-4 pt-1 sm:pt-2 md:pt-3 min-h-screen' : 'max-w-6xl px-3 sm:px-6 pt-1 sm:pt-2 md:pt-3 min-h-screen')
              : (view === 'challenge' || view === 'speed_challenge' || view === 'islamic_quiz' || view === 'group_game' || view === 'skills_count_selection' || view === 'skills_menu' || view === 'speed_menu')
                ? 'max-w-4xl px-3 sm:px-4 pt-1 sm:pt-2 md:pt-3 pb-8 md:pb-12 min-h-screen'
                : 'max-w-6xl px-3 sm:px-6 pt-4 sm:pt-6 md:pt-10 pb-20 min-h-screen'
            } mx-auto relative z-10`}>
            {challengesLoading && challenges.length === 0 ? (

              <div className="flex flex-col items-center justify-center py-40">
                <div className="w-12 h-12 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-6" />
                <p className="text-brand-emerald font-black animate-pulse">يتم استظهار الآيات...</p>
              </div>
            ) : challengesError && challenges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-4">
                  {(import.meta as any).env?.PROD ? 'عذراً، حدث خطأ في الاتصال بالخادم' : 'تعذر الاتصال بقاعدة البيانات'}
                </h3>
                <p className="text-slate-500 font-bold mb-8 max-w-md mx-auto">
                  {(import.meta as any).env?.PROD ? (
                    'يرجى التأكد من اتصالك بالإنترنت والمحاولة مرة أخرى لاحقاً'
                  ) : (
                    <>
                      قاعدة البيانات السحابية قد تستغرق بضع ثوانٍ للاستيقاظ عند أول تشغيل، أو تأكد من تشغيل المشروع عبر:
                      <code className="block mt-4 bg-slate-100 p-4 rounded-xl text-brand-emerald">npm run dev</code>
                    </>
                  )}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => fetchChallenges()}
                    disabled={challengesLoading}
                    className="px-10 py-4 bg-brand-emerald text-white rounded-2xl font-black shadow-lg hover:bg-brand-emerald/90 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {challengesLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                    إعادة المحاولة
                  </button>
                  {(import.meta as any).env?.PROD && (
                    <button
                      onClick={() => window.location.reload()}
                      className="px-10 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-black shadow-sm hover:bg-slate-50 transition-all"
                    >
                      تحديث الصفحة
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {showScores ? (
                  <motion.div
                    key="scores"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col gap-4 max-w-3xl mx-auto py-3 md:py-5 px-3 sm:px-4 pb-24 text-right"
                    dir="rtl"
                  >
                    {/* Clean Header matching Challenges & Library */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-1.5 h-7 sm:h-8 bg-brand-gold rounded-full" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-black text-brand-emerald tracking-tight">
                              لوحة المتصدرين
                            </h2>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              <Trophy className="w-3 h-3 text-amber-500" />
                              <span>أفضل 10 متصدرين</span>
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-400 mt-0.5">
                            فرسان التنافس في المتشابهات القرآنية والمسابقات الإسلامية
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowCosmeticStore(true)}
                          title="متجر التميز والمظهر"
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">متجر التميز</span>
                          <span className="sm:hidden">المتجر</span>
                        </button>
                        <button
                          onClick={() => syncLeaderboard()}
                          disabled={isSyncing}
                          title="تحديث القائمة"
                          className={`p-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-all shadow-xs active:scale-95 cursor-pointer ${isSyncing ? 'animate-spin' : ''}`}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Minimalist Summary Ribbon */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-150 dark:border-slate-800 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-bold text-xs">
                        <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>عدد المستخدمين: <strong className="text-slate-900 dark:text-slate-100 font-black">{totalUsersCount || leaderboard.length}</strong> مستخدم</span>
                      </div>

                      {/* 3 Metrics Legend: Star ⭐️, Trophy 🏆, Streak 🔥 */}
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/60 text-amber-800 dark:text-amber-200">
                          <span>⭐️</span>
                          <span>النقاط</span>
                        </span>
                        <span className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-950/40 px-2 py-0.5 rounded-md border border-yellow-200/60 dark:border-yellow-800/60 text-yellow-800 dark:text-yellow-200">
                          <span>🏆</span>
                          <span>الكؤوس</span>
                        </span>
                        <span className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-md border border-orange-200/60 dark:border-orange-800/60 text-orange-800 dark:text-orange-200">
                          <span>🔥</span>
                          <span>الشعلات</span>
                        </span>
                      </div>

                      {playerName && (
                        <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 flex-wrap">
                          <span>حسابك: <strong className="font-black text-slate-900 dark:text-white">{playerName}</strong></span>
                          <span className="text-emerald-300 dark:text-emerald-700 font-normal">|</span>
                          <span className="font-black text-amber-700 dark:text-amber-400">
                            {userLeaderboardRank === 1
                              ? 'ترتيبك: الأول 👑'
                              : userLeaderboardRank === 2
                              ? 'ترتيبك: الثاني 🥈'
                              : userLeaderboardRank === 3
                              ? 'ترتيبك: الثالث 🥉'
                              : userLeaderboardRank !== null
                              ? `ترتيبك: #${userLeaderboardRank}`
                              : 'ترتيبك: غير مصنف بعد'}
                          </span>
                        </div>
                      )}
                    </div>

                    {isSyncing && leaderboard.length === 0 ? (
                      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xs">
                        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-xs sm:text-sm">جاري جلب قائمة الأبطال والمتصدرين...</p>
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xs">
                        <Sparkles className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 dark:text-slate-500 font-bold text-xs sm:text-sm">كن أول من يسجل اسمه ويتصدر القائمة!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {leaderboard.slice(0, 10).map((player: any, index) => {
                          const isCurrentPlayer = (playerName && player.name)
                            ? player.name.trim().toLowerCase() === playerName.trim().toLowerCase()
                            : false;

                          const playerTotalPoints = player.totalPoints ?? player.points ?? 0;
                          const playerTrophies = player.trophiesCount ?? player.cups ?? 0;
                          const playerStreak = player.streakCount ?? player.streak ?? (isCurrentPlayer ? streak : 0);

                          // INDIVIDUAL PLAYER ACHIEVEMENT LOGIC (Global visibility)
                          const getPlayerAchievement = (p: any) => {
                            if (p.activeFrame === 'seerah' || p.activeFrame === 'general') return p.activeFrame;
                            if (p.activeFrame === 'none') return 'none';
                            if (p.seerahCompleted) return 'seerah';
                            if (p.generalCompleted) return 'general';
                            return 'none';
                          };

                          // Use individual player data for everyone in the list, and ensure current player uses active userAchievement
                          const achievement = (isCurrentPlayer && userAchievement && userAchievement !== 'none')
                            ? userAchievement
                            : getPlayerAchievement(player);
                          const style = achievementStyles[achievement];

                          // Decoration visibility (solely determined by selected frame: none or active frame)
                          const isPlayerElite = achievement !== 'none';

                          const isRank1 = index === 0;
                          const isRank2 = index === 1;
                          const isRank3 = index === 2;

                          return (
                            <motion.div
                              initial={{ x: 15, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: Math.min(index * 0.03, 0.3) }}
                              key={player.name + index}
                              className={`flex justify-between items-center px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl border transition-all duration-200 group relative ${
                                isRank1
                                  ? 'bg-gradient-to-l from-amber-500/10 via-amber-500/5 to-white dark:to-slate-900 border-amber-300 dark:border-amber-700/60 shadow-xs'
                                  : isRank2
                                  ? 'bg-gradient-to-l from-slate-100/80 via-slate-50/40 to-white dark:to-slate-900 border-slate-200 dark:border-slate-700 shadow-xs'
                                  : isRank3
                                  ? 'bg-gradient-to-l from-amber-600/10 via-amber-600/5 to-white dark:to-slate-900 border-amber-200 dark:border-amber-800/60 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500 shadow-xs'
                              } ${isCurrentPlayer ? 'ring-1.5 ring-emerald-500 border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/40' : ''}`}
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                                {/* Rank Badge */}
                                <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center shrink-0">
                                  {isRank1 ? (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-black text-xs sm:text-sm shadow-xs">
                                      👑
                                    </div>
                                  ) : isRank2 ? (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-xs sm:text-sm shadow-xs">
                                      🥈
                                    </div>
                                  ) : isRank3 ? (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex items-center justify-center font-black text-xs sm:text-sm shadow-xs">
                                      🥉
                                    </div>
                                  ) : (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-400 flex items-center justify-center font-black text-[11px] sm:text-xs">
                                      #{index + 1}
                                    </div>
                                  )}
                                </div>

                                {/* Avatar & Frame */}
                                <div className="relative group shrink-0 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10">
                                  {/* Inner Avatar */}
                                  <div className="relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-black text-xs sm:text-sm bg-gradient-to-br from-brand-emerald to-emerald-700 shadow-xs border border-white/60">
                                    {(player.name || '').trim().charAt(0).toUpperCase()}
                                  </div>

                                  {/* Frame / Achievement Decoration */}
                                  {isPlayerElite && (
                                    achievement === 'seerah' ? (
                                      <div className="absolute -inset-1 rounded-full pointer-events-none z-20 bg-[url('/golden_seerah_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                                    ) : achievement === 'general' ? (
                                      <div className="absolute -inset-1 rounded-full pointer-events-none z-20 bg-[url('/golden_general_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                                    ) : (
                                      <div className={`absolute -inset-0.5 rounded-full pointer-events-none z-0 ${style.className}`} />
                                    )
                                  )}

                                  {/* Badge Icon */}
                                  {isPlayerElite && (
                                    <div className="absolute -bottom-1 -left-1 z-30 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center bg-transparent drop-shadow">
                                      {style.icon.startsWith('/') ? (
                                        <img src={style.icon} className="w-full h-full object-contain" alt="Badge" />
                                      ) : (
                                        <div className="flex items-center justify-center text-[8px] w-full h-full">
                                          {style.icon}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Name & Stats */}
                                <div className="text-right min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`font-black text-xs sm:text-sm leading-tight truncate ${
                                        isPlayerElite && !(isCurrentPlayer ? equippedNameColor : player.equippedNameColor)
                                          ? `text-transparent bg-clip-text bg-gradient-to-r ${style.textColor}`
                                          : 'text-slate-800 dark:text-slate-100'
                                      }`}
                                      style={(isCurrentPlayer ? equippedNameColor : player.equippedNameColor) ? { color: (isCurrentPlayer ? equippedNameColor : player.equippedNameColor) } : undefined}
                                    >
                                      {player.name}
                                    </span>
                                    {(isCurrentPlayer ? (equippedTitle || player.equippedTitle || player.selectedTitle || player.title) : (player.equippedTitle || player.selectedTitle || player.title)) && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                                        {isCurrentPlayer ? (equippedTitle || player.equippedTitle || player.selectedTitle || player.title) : (player.equippedTitle || player.selectedTitle || player.title)}
                                      </span>
                                    )}
                                    {isCurrentPlayer && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-600 text-white shadow-xs">
                                        أنت
                                      </span>
                                    )}
                                  </div>
                                  {player.username && (
                                    <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                      @{player.username.replace(/^@+/, '')}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* The 3 Real Metrics: Stars/Points ⭐️, Trophies 🏆, Streaks 🔥 */}
                              <div className="shrink-0 flex items-center gap-1 sm:gap-2 pr-1">
                                {/* 1. Total Points (⭐️) */}
                                <div
                                  title="النقاط الإجمالية"
                                  className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 shadow-xs"
                                >
                                  <span className="text-xs sm:text-sm leading-none">⭐️</span>
                                  <span className="font-black text-xs sm:text-sm tabular-nums">
                                    {playerTotalPoints}
                                  </span>
                                </div>

                                {/* 2. Trophies Count (🏆) */}
                                <div
                                  title="عدد الكؤوس من التحديات الجماعية"
                                  className={`flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl border transition-all shadow-xs ${
                                    isRank1
                                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 border-amber-400 font-black'
                                      : 'bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200/80 dark:border-yellow-800/60 text-yellow-800 dark:text-yellow-200'
                                  }`}
                                >
                                  <span className="text-xs sm:text-sm leading-none">🏆</span>
                                  <span className="font-black text-xs sm:text-sm tabular-nums">
                                    {playerTrophies}
                                  </span>
                                </div>

                                {/* 3. Streak Count (🔥) */}
                                <div
                                  title="عدد الشعلات / أيام الدخول المتتالية"
                                  className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/60 text-orange-800 dark:text-orange-200 shadow-xs"
                                >
                                  <span className="text-xs sm:text-sm leading-none">🔥</span>
                                  <span className="font-black text-xs sm:text-sm tabular-nums">
                                    {playerStreak}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                ) : view === "group_create" ? (
                  <GroupCreatePage
                    v1RoomName={v1RoomName}
                    setV1RoomName={setV1RoomName}
                    v1IsPrivate={v1IsPrivate}
                    setV1IsPrivate={setV1IsPrivate}
                    showPasswordText={showPasswordText}
                    setShowPasswordText={setShowPasswordText}
                    v1RoomPassword={v1RoomPassword}
                    setV1RoomPassword={setV1RoomPassword}
                    v1GameModes={v1GameModes}
                    setV1GameModes={setV1GameModes}
                    systemSettings={systemSettings}
                    availableSkillCounts={availableSkillCounts}
                    skillQuestionCounts={skillQuestionCounts}
                    setSkillQuestionCounts={setSkillQuestionCounts}
                    whoAmIQuestionCount={whoAmIQuestionCount}
                    selectedWhoAmICategories={selectedWhoAmICategories}
                    setSelectedWhoAmICategories={setSelectedWhoAmICategories}
                    whoAmIAvailableCategories={whoAmIAvailableCategories}
                    whoAmICategoryCounts={whoAmICategoryCounts}
                    setWhoAmICategoryCounts={setWhoAmICategoryCounts}
                    totalConfiguredQuestions={totalConfiguredQuestions}
                    islamicRoomCategories={islamicRoomCategories}
                    islamicRoomLevels={islamicRoomLevels}
                    islamicRoomTopics={islamicRoomTopics}
                    islamicTopicQuestionCounts={islamicTopicQuestionCounts}
                    setShowIslamicConfigModal={setShowIslamicConfigModal}
                    hasCountValidationErrors={hasCountValidationErrors}
                    v1Timer={v1Timer}
                    setV1Timer={setV1Timer}
                    v1TimePerQuestion={v1TimePerQuestion}
                    setV1TimePerQuestion={setV1TimePerQuestion}
                    v1TransitionMode={v1TransitionMode}
                    setV1TransitionMode={setV1TransitionMode}
                    handleCreateV1={handleCreateV1}
                    isCreatingRoom={isCreatingRoom}
                    setView={setView}
                  />
                ) : view === "group_waiting" ? (
                  <GroupWaitingPage
                    room={room}
                    setShowCosmeticStore={setShowCosmeticStore}
                    playerUsername={playerUsername}
                    playerName={playerName}
                    equippedTitle={equippedTitle}
                    equippedNameColor={equippedNameColor}
                    handleStartRoomV1={handleStartRoomV1}
                    v1IsStartingRoom={v1IsStartingRoom}
                    handleCancelRoomByHost={handleCancelRoomByHost}
                    setView={setView}
                    setRoom={setRoom}
                  />
                ) : view === "group_join" ? (
                  <GroupJoinPage
                    setView={setView}
                    fetchAvailableRooms={fetchAvailableRooms}
                    isLoadingRooms={isLoadingRooms}
                    availableRooms={availableRooms}
                    playerUsername={playerUsername}
                    playerName={playerName}
                    handleJoinV1={handleJoinV1}
                    setPrivateRoomModal={setPrivateRoomModal}
                    isJoiningRoom={isJoiningRoom}
                  />
                ) : view === "group_game" ? (
                  <GroupGameResultsPage
                    room={room}
                    playerUsername={playerUsername}
                    playerName={playerName}
                    setRoom={setRoom}
                    setView={setView}
                  />
                ) : view === "speed_challenge" ? (
                  <SpeedChallengePage
                    speedTimeLeft={speedTimeLeft}
                    currentChallenge={currentChallenge}
                    speedTotalTimeSpent={speedTotalTimeSpent}
                    isSpeedGameOver={isSpeedGameOver}
                    handleStartSpeedChallenge={handleStartSpeedChallenge}
                    setView={setView}
                    room={room}
                    hasAnsweredCurrentQuestion={hasAnsweredCurrentQuestion}
                    handleExecuteFreezeTime={handleExecuteFreezeTime}
                    freezeTimeCount={freezeTimeCount}
                    isPowerUpUsedThisQuestion={isPowerUpUsedThisQuestion}
                    isFreezeActive={isFreezeActive}
                    handleExecuteDeleteTwo={handleExecuteDeleteTwo}
                    deleteTwoCount={deleteTwoCount}
                    eliminatedOptionIndices={eliminatedOptionIndices}
                    skillsType={skillsType}
                    KEYWORD={KEYWORD}
                    totalPoints={totalPoints}
                    targetVerses={targetVerses}
                    matchedIds={matchedIds}
                    isListening={isListening}
                    stopListening={stopListening}
                    startListening={startListening}
                    keywordWordCount={keywordWordCount}
                    wordStates={wordStates}
                    surahInputs={surahInputs}
                    setSurahInputs={setSurahInputs}
                    handleSubmitSurah={handleSubmitSurah}
                    skillsFeedback={skillsFeedback}
                    surahFeedbackData={surahFeedbackData}
                    skillsOptions={skillsOptions}
                    selectedOption={selectedOption}
                    handleOptionSelect={handleOptionSelect}
                    handleConfirmAnswer={handleConfirmAnswer}
                    skillsCorrectAnswer={skillsCorrectAnswer}
                    playerUsername={playerUsername}
                    playerName={playerName}
                  />
                ) : view === 'skills_menu' || view === 'speed_menu' ? (
                  <motion.div
                    key="skills_menu"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="max-w-4xl mx-auto py-10 px-4"
                  >
                    <SkillsMenu
                      onSelectMode={(mode) => {
                        setSkillsType(mode);
                        setView('skills_count_selection');
                      }}
                      onBack={() => setView('home')}
                      title={isSpeedMode ? 'تحدي السرعة' : 'تحدي المهارات'}
                      subtitle={isSpeedMode ? 'أسرع في الإجابة واجمع النقاط' : 'اختر التحدي الذي تفضله'}
                      hideAudio={systemSettings.hideAudioChallenge}
                      hideComplete={systemSettings.hideCompletionChallenge}
                      hideSurah={systemSettings.hideSurahChallenge}
                    />
                  </motion.div>
                ) : view === "skills_count_selection" ? (
                  <SkillsCountSelectionPage
                    skillsType={skillsType}
                    selectedSkillCount={selectedSkillCount}
                    setSelectedSkillCount={setSelectedSkillCount}
                    skillsScopeMode={skillsScopeMode}
                    setSkillsScopeMode={setSkillsScopeMode}
                    selectedSkillJuzs={selectedSkillJuzs}
                    setSelectedSkillJuzs={setSelectedSkillJuzs}
                    skillSurahSearch={skillSurahSearch}
                    setSkillSurahSearch={setSkillSurahSearch}
                    selectedSkillSurahs={selectedSkillSurahs}
                    setSelectedSkillSurahs={setSelectedSkillSurahs}
                    filteredSurahsList={filteredSurahsList}
                    handleStartSkillsSession={handleStartSkillsSession}
                    setView={setView}
                  />
                ) : view === "skills_results" ? (
                  <SkillsResultsPage
                    sessionCorrect={sessionCorrect}
                    sessionWrong={sessionWrong}
                    skillsType={skillsType}
                    totalPoints={totalPoints}
                    cups={cups}
                    sessionMistakes={sessionMistakes}
                    showMistakes={showMistakes}
                    setShowMistakes={setShowMistakes}
                    setView={setView}
                  />
                ) : view === 'settings' ? (
                  <SettingsView
                    playerName={playerName}
                    playerUsername={playerUsername}
                    totalPoints={totalPoints}
                    cups={cups}
                    activeFrame={activeFrame}
                    showProfileDecoration={showProfileDecoration}
                    setShowProfileDecoration={setShowProfileDecoration}
                    userCertificates={userCertificates}
                    onOpenCertificate={(cat) => {
                      setSelectedCategory(cat);
                      setShowCertificate(true);
                    }}
                    onActivateFrameAndCertificate={(cat) => {
                      const todayDate = new Date().toLocaleDateString('ar-EG', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      });
                      const certEntry = {
                        category: cat,
                        date: todayDate,
                        name: playerName || 'علاء'
                      };
                      const filtered = userCertificates.filter(c => c.category !== cat);
                      const updated = [...filtered, certEntry];
                      setUserCertificates(updated);
                      localStorage.setItem('quran_user_certificates', JSON.stringify(updated));

                      setActiveFrame(cat);
                      setIsNameDecorated(true);
                      setShowProfileDecoration(true);
                      localStorage.setItem('quran_active_frame', cat);
                      localStorage.setItem('quran_name_decorated', 'true');
                      localStorage.setItem('quran_show_decoration', 'true');

                      // Immediately sync active frame and achievement to database
                      if (playerUsername || playerName) {
                        fetch('/api/player-score', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: playerName,
                            username: playerUsername,
                            seerahCompleted: cat === 'seerah' || userCertificates.some(c => c.category === 'seerah'),
                            generalCompleted: cat === 'general' || userCertificates.some(c => c.category === 'general'),
                            activeFrame: cat
                          })
                        }).then(() => syncLeaderboard()).catch(err => console.error('Frame sync failed:', err));
                      }

                      setSelectedCategory(cat);
                      setShowCertificate(true);
                    }}
                    onSelectFrame={(frame) => {
                      setActiveFrame(frame);
                      if (frame) {
                        setIsNameDecorated(true);
                        setShowProfileDecoration(true);
                        localStorage.setItem('quran_active_frame', frame);
                        localStorage.setItem('quran_name_decorated', 'true');
                        localStorage.setItem('quran_show_decoration', 'true');
                      } else {
                        setIsNameDecorated(false);
                        setShowProfileDecoration(false);
                        localStorage.setItem('quran_active_frame', 'none');
                        localStorage.removeItem('quran_name_decorated');
                        localStorage.removeItem('quran_show_decoration');
                      }

                      if (playerUsername || playerName) {
                        fetch('/api/player-score', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: playerName,
                            username: playerUsername,
                            activeFrame: frame || 'none'
                          })
                        }).then(() => syncLeaderboard()).catch(err => console.error('Frame select sync failed:', err));
                      }
                    }}
                    onLogout={() => {
                      setPlayerName(null);
                      setPlayerUsername(null);
                      localStorage.removeItem('quran_player_name');
                      localStorage.removeItem('quran_player_username');
                      localStorage.removeItem('quran_device_id');
                      setView('home');
                    }}
                    onBackToHome={() => setView('home')}
                    onUpdatePlayer={(name, username) => {
                      setPlayerName(name);
                      setPlayerUsername(username);
                      localStorage.setItem('quran_player_name', name);
                      localStorage.setItem('quran_player_username', username);
                    }}
                    onStartQuizCategory={(_cat) => {
                      setView('islamic_quiz');
                    }}
                    onOpenDownloadApp={() => setShowDownloadModal(true)}
                    onOpenPrivacyPolicy={(tab) => {
                      setPrivacyModalInitialTab(tab || 'privacy');
                      setShowPrivacyModal(true);
                    }}
                  />
                ) : view === "home" ? (
                  <HomePage
                    activeRunningRoom={activeRunningRoom}
                    handleResumeActiveRoom={handleResumeActiveRoom}
                    playerName={playerName}
                    isElite={isElite}
                    isNameDecorated={isNameDecorated}
                    currentStyle={currentStyle}
                    motivationalQuote={motivationalQuote}
                    streak={streak}
                    cups={cups}
                    totalPoints={totalPoints}
                    completedChallengeIds={completedChallengeIds}
                    setIsOccasionsModalOpen={setIsOccasionsModalOpen}
                    nearestOccasion={nearestOccasion}
                    lastPlayedDate={lastPlayedDate}
                    dailyCompleted={dailyCompleted}
                    setView={setView}
                    streakInfo={streakInfo}
                    handleStartDaily={handleStartDaily}
                    systemSettings={systemSettings}
                    isNativeApp={isNativeApp}
                    testerStatus={testerStatus}
                    setShowGooglePlayModal={setShowGooglePlayModal}
                  />
                ) : view === "challenges" ? (
                  <ChallengesHubPage
                    setView={setView}
                    incompleteChallenge={incompleteChallenge}
                    setChallengeMode={setChallengeMode}
                    setCurrentChallengeIndex={setCurrentChallengeIndex}
                    dailyCompleted={dailyCompleted}
                    handleStartDaily={handleStartDaily}
                    timeLeft={timeLeft}
                    setIsSpeedMode={setIsSpeedMode}
                    systemSettings={systemSettings}
                  />
                ) : view === "library" ? (
                  <LibraryHubPage
                    setView={setView}
                    setSelectedSurahId={setSelectedSurahId}
                    setSelectedJuz={setSelectedJuz}
                    setIsSearchSubmitted={setIsSearchSubmitted}
                    setIsPageModeActive={setIsPageModeActive}
                    setSelectedAdhkarCategoryId={setSelectedAdhkarCategoryId}
                    setSelectedHadith={setSelectedHadith}
                    systemSettings={systemSettings}
                  />
                ) : view === "list" ? (
                  <AyahsListPage
                    setView={setView}
                    activeListTab={activeListTab}
                    setActiveListTab={setActiveListTab}
                    challenges={challenges}
                    completedChallengeIds={completedChallengeIds}
                    setCurrentChallengeIndex={setCurrentChallengeIndex}
                    setDifficulty={setDifficulty}
                    setIncompleteChallenge={setIncompleteChallenge}
                  />
                ) : challengeMode === 'daily' && dailyCompleted ? (
                  <motion.div
                    key="daily-done"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-6 md:p-12 rounded-2xl md:rounded-[4rem] text-center max-w-2xl mx-auto border-brand-gold/20"
                  >
                    <div className="mb-8 relative inline-block">
                      <div className="absolute inset-0 bg-brand-gold/20 blur-3xl rounded-full scale-150 animate-pulse" />
                      <CheckCircle className="w-24 h-24 text-brand-gold relative z-10" />
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black text-brand-emerald mb-4">أتممت تحديك اليومي!</h2>
                    <p className="text-slate-500 mb-10 text-lg font-medium">بارك الله فيك، التحدي القادم ينتظرك في:</p>
                    <div className="text-4xl md:text-6xl font-black text-brand-emerald mb-12 tabular-nums tracking-tighter" dir="ltr">
                      {timeLeft}
                    </div>
                    <button
                      onClick={() => {
                        setChallengeMode('normal');
                        setCurrentChallengeIndex(0);
                        setView('home');
                      }}
                      className="group relative px-10 py-5 bg-brand-emerald text-white rounded-3xl font-black text-lg hover:bg-brand-emerald/90 transition-all shadow-2xl hover:scale-105 active:scale-95"
                    >
                      <span className="relative z-10">استمر بالتحديات الحرة</span>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 rounded-b-3xl group-hover:h-full transition-all duration-300 opacity-0 group-hover:opacity-10" />
                    </button>
                  </motion.div>
                ) : view === "mushaf" ? (
                  <MushafPage
                    isPageModeActive={isPageModeActive}
                    setIsPageModeActive={setIsPageModeActive}
                    selectedSurahId={selectedSurahId}
                    setSelectedSurahId={setSelectedSurahId}
                    selectedJuz={selectedJuz}
                    setSelectedJuz={setSelectedJuz}
                    isSearchSubmitted={isSearchSubmitted}
                    setIsSearchSubmitted={setIsSearchSubmitted}
                    librarySettings={librarySettings}
                    setIsSettingsOpen={setIsSettingsOpen}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    isMushafFeaturesModalOpen={isMushafFeaturesModalOpen}
                    setIsMushafFeaturesModalOpen={setIsMushafFeaturesModalOpen}
                    isSurahMenuOpen={isSurahMenuOpen}
                    setIsSurahMenuOpen={setIsSurahMenuOpen}
                    isJuzMenuOpen={isJuzMenuOpen}
                    setIsJuzMenuOpen={setIsJuzMenuOpen}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    mushafZoomScale={mushafZoomScale}
                    setMushafZoomScale={setMushafZoomScale}
                    pageTurnDirection={pageTurnDirection}
                    setPageTurnDirection={setPageTurnDirection}
                    enterMushafFullscreen={enterMushafFullscreen}
                    selectedAyah={selectedAyah}
                    setSelectedAyah={setSelectedAyah}
                    setView={setView}
                  />
                ) : view === "adhkar" ? (
                  <AdhkarPage
                    adhkarSearchQuery={adhkarSearchQuery}
                    setAdhkarSearchQuery={setAdhkarSearchQuery}
                    selectedAdhkarCategoryId={selectedAdhkarCategoryId}
                    setSelectedAdhkarCategoryId={setSelectedAdhkarCategoryId}
                    adhkarProgress={adhkarProgress}
                    setAdhkarProgress={setAdhkarProgress}
                    setIsSettingsOpen={setIsSettingsOpen}
                    handleBackToHome={handleBackToHome}
                  />
                ) : view === "hadith" ? (
                  <HadithPage
                    setSelectedHadith={setSelectedHadith}
                    setIsSettingsOpen={setIsSettingsOpen}
                    handleBackToHome={handleBackToHome}
                  />
                ) : view === 'book' ? (
                  <motion.div
                    key="book"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full"
                  >
                    <BookReader onBack={() => setView('home')} darkMode={librarySettings.darkMode} />
                  </motion.div>
                ) : view === 'encyclopedia' ? (
                  <motion.div
                    key="encyclopedia"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full"
                  >
                    <Encyclopedia onBack={() => setView('home')} darkMode={librarySettings.darkMode} />
                  </motion.div>
                ) : view === 'islamic_videos' ? (
                  !systemSettings.hideIslamicVideos ? (
                    <motion.div
                      key="islamic_videos"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="w-full"
                    >
                      <IslamicVideos onBack={() => setView('library')} />
                    </motion.div>
                  ) : (
                    <div className="text-center py-24 px-4 max-w-md mx-auto">
                      <p className="text-slate-500 font-bold mb-4">هذا القسم غير متاح حالياً.</p>
                      <button onClick={() => setView('home')} className="px-6 py-2.5 bg-brand-emerald text-white rounded-xl font-black text-sm">
                        العودة للرئيسية
                      </button>
                    </div>
                  )
                ) : view === 'islamic_quiz' ? (
                  <motion.div
                    key="islamic_quiz"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full"
                  >
                    <IslamicQuiz
                      onBack={() => setView('home')}
                      onWin={updateStatsAfterWin}
                      claimedCategories={userCertificates.map(c => c.category)}
                      onShowCertificate={(cat) => {
                        setSelectedCategory(cat);
                        setShowCertificate(true);
                      }}
                    />
                  </motion.div>
                ) : (
                  <>
                    {!currentChallenge ? (
                      <div className="flex flex-col items-center justify-center py-40">
                        <div className="w-12 h-12 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-6" />
                        <p className="text-brand-emerald font-black animate-pulse">جاري التحميل...</p>
                      </div>
                    ) : (currentChallenge && !currentChallenge.verseText && !currentChallenge.text) ? (
                      <div style={{ padding: '40px', backgroundColor: '#fee', color: '#c00', direction: 'ltr', zIndex: 9999, position: 'relative', borderRadius: '2rem', margin: '40px auto', maxWidth: '800px' }} className="glass border-red-200 shadow-2xl">
                        <h3 className="text-2xl font-black mb-4">Debug: Missing Verse Data</h3>
                        <p className="mb-4 font-bold text-slate-700">The currentChallenge object exists but lacks 'verseText' or 'text' keys.</p>
                        <pre className="bg-white/80 p-6 rounded-xl overflow-auto max-h-[400px] border border-red-100 shadow-inner text-sm">{JSON.stringify(currentChallenge, null, 2)}</pre>
                        <button onClick={() => setView('home')} className="mt-8 px-8 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg hover:bg-red-700 transition-all">العودة للرئيسية (Back to Home)</button>
                      </div>
                    ) : (
                      <div key="game" className="space-y-2 md:space-y-4 max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-2 md:px-4 pt-1 md:pt-4">
                        {/* Floating Timer UI for Speed Mode or Multiplayer Room with Timer */}
                        {(isSpeedMode || (room && (room.timePerQuestion || 0) > 0)) && (
                          <div className="flex justify-center mb-2 sticky top-2 z-50">
                            <motion.div
                              animate={{
                                scale: isFreezeActive ? 1.05 : speedTimeLeft <= 5 ? [1, 1.05, 1] : 1,
                                backgroundColor: isFreezeActive ? '#e0f2fe' : speedTimeLeft <= 5 ? '#fee2e2' : '#ffffff'
                              }}
                              transition={{ repeat: speedTimeLeft <= 5 && !isFreezeActive ? Infinity : 0, duration: 0.5 }}
                              className={`glass px-3.5 md:px-4 py-1 rounded-full shadow-md border flex items-center gap-2 ${
                                isFreezeActive ? 'border-cyan-400 ring-2 ring-cyan-300' : speedTimeLeft <= 5 ? 'border-red-500' : 'border-brand-emerald/20'
                              }`}
                            >
                              <div className={`p-1 rounded-lg ${isFreezeActive ? 'bg-cyan-500 text-white' : speedTimeLeft <= 5 ? 'bg-red-500 text-white' : 'bg-brand-emerald text-white'}`}>
                                {isFreezeActive ? <span className="text-xs">🧊</span> : <Zap className="w-3.5 h-3.5" />}
                              </div>
                              <div className="text-right flex items-center gap-1.5">
                                <span className={`text-xs md:text-sm font-black tabular-nums ${isFreezeActive ? 'text-cyan-700' : speedTimeLeft <= 5 ? 'text-red-600' : 'text-slate-800'}`}>
                                  {isFreezeActive ? `مجمّد! (${freezeSecondsLeft}ث)` : `${speedTimeLeft} ثانية`}
                                </span>
                                {isSpeedMode && currentChallenge?.level && (
                                  <span className={`text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded-full ${
                                    (currentChallenge.level === 'hard' || currentChallenge.level === 'صعب') ? 'bg-rose-100 text-rose-700' :
                                    (currentChallenge.level === 'easy' || currentChallenge.level === 'سهل') ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {(currentChallenge.level === 'hard' || currentChallenge.level === 'صعب') ? 'صعب (20ث)' :
                                     (currentChallenge.level === 'easy' || currentChallenge.level === 'سهل') ? 'سهل (10ث)' :
                                     'متوسط (15ث)'}
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          </div>
                        )}

                        {/* Multiplayer Real-time Question Counter & Speed Bonus Indicator */}
                        {room && room.transitionMode !== 'ASYNC' && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 md:p-3.5 bg-linear-to-r from-slate-900/90 to-slate-800/90 text-white rounded-2xl border border-white/10 shadow-lg mb-4 text-xs font-bold"
                          >
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                              </span>
                              <span className="text-white font-black text-xs md:text-sm">
                                أجاب {room.answeredCount ?? 0} من {room.onlineParticipantsCount ?? room.totalParticipants ?? room.participants?.length ?? 1} لاعبين
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-xl border border-amber-400/30 text-[11px] font-black">
                              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span>أول 4 إجابات صحيحة تنال بونص سرعة (+1) ⚡</span>
                            </div>
                          </motion.div>
                        )}

                        {room && room.transitionMode === 'ASYNC' && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between gap-2.5 p-3 md:p-3.5 bg-linear-to-r from-slate-900/90 to-slate-800/90 text-white rounded-2xl border border-white/10 shadow-lg mb-4 text-xs font-bold"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">🚀</span>
                              <span className="text-white font-black text-xs md:text-sm">
                                سباق فردي سريع (أجب بأقصى سرعة ودقة!)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-xl border border-amber-400/30 text-[11px] font-black">
                              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span>أول 4 إجابات صحيحة تنال بونص سرعة (+1) ⚡</span>
                            </div>
                          </motion.div>
                        )}

                        {/* Multiplayer Waiting State after answering - Placed ABOVE the question (Only in SYNC mode) */}
                        {room && room.transitionMode !== 'ASYNC' && hasAnsweredCurrentQuestion && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="mb-4 p-3.5 md:p-4 rounded-2xl bg-linear-to-r from-amber-50 via-orange-50/80 to-amber-50 border-2 border-amber-300 shadow-md text-center space-y-2"
                          >
                            <div className="flex items-center justify-center gap-2.5">
                              <div className="w-7 h-7 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </div>
                              <h4 className="text-sm md:text-base font-black text-amber-900">
                                تم تسجيل إجابتك بنجاح، بانتظار باقي المتسابقين...
                              </h4>
                            </div>
                            <p className="text-[11px] md:text-xs text-amber-700 font-bold max-w-lg mx-auto leading-relaxed">
                              سينتقل الجميع تلقائياً إلى السؤال التالي فور اكتمال إجابات اللاعبين أو انتهاء وقت السؤال.
                            </p>
                            <div className="inline-flex items-center gap-2 bg-white px-3.5 py-1 rounded-full border border-amber-200 text-[11px] font-black text-amber-800 shadow-xs">
                              <Users className="w-3.5 h-3.5 text-amber-600" />
                              <span>أجاب ({room.answeredCount ?? 0} من {room.onlineParticipantsCount ?? room.totalParticipants ?? room.participants?.length ?? 1})</span>
                            </div>
                          </motion.div>
                        )}

                        {/* Tactical Power-ups HUD (🧊 Freeze Time & ✂️ Delete Two) */}
                        <div className="flex items-center justify-center gap-2.5 sm:gap-4 my-2 sm:my-3">
                          <button
                            type="button"
                            onClick={handleExecuteFreezeTime}
                            disabled={freezeTimeCount <= 0 || isPowerUpUsedThisQuestion || isFreezeActive || hasAnsweredCurrentQuestion}
                            title="تجميد الوقت لمدة 10 ثوانٍ"
                            className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl border text-xs sm:text-sm font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
                              isFreezeActive
                                ? 'bg-cyan-100 text-cyan-800 border-cyan-400 ring-2 ring-cyan-300 animate-pulse'
                                : freezeTimeCount > 0 && !isPowerUpUsedThisQuestion && !hasAnsweredCurrentQuestion
                                ? 'bg-white hover:bg-cyan-50 text-cyan-700 border-cyan-200 hover:border-cyan-400'
                                : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <span className="text-base leading-none">🧊</span>
                            <span>تجميد الوقت</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${freezeTimeCount > 0 ? 'bg-cyan-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                              {freezeTimeCount}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={handleExecuteDeleteTwo}
                            disabled={deleteTwoCount <= 0 || isPowerUpUsedThisQuestion || hasAnsweredCurrentQuestion || eliminatedOptionIndices.length > 0}
                            title="حذف إجابتين خاطئتين"
                            className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl border text-xs sm:text-sm font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
                              eliminatedOptionIndices.length > 0
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : deleteTwoCount > 0 && !isPowerUpUsedThisQuestion && !hasAnsweredCurrentQuestion
                                ? 'bg-white hover:bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'
                                : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <span className="text-base leading-none">✂️</span>
                            <span>حذف إجابتين (50/50)</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${deleteTwoCount > 0 ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                              {deleteTwoCount}
                            </span>
                          </button>
                        </div>
                        <SkillsChallengeHeader
                          index={challengeMode === 'daily' ? 0 : (view === 'challenge' ? currentChallengeIndex : sessionCurrentIndex)}
                          total={challengeMode === 'daily' ? 1 : (challenges.length > 50 ? 20 : Math.max(challenges.length, 1))}
                          mode={challengeMode === 'daily' ? 'complete' : skillsType}
                          title={challengeMode === 'daily' ? 'التحدي اليومي: إكمال الآية' : (room?.gameMode === 'ISLAMIC' || v1GameModes.includes('islamic') ? 'تحدي معلومات إسلامية' : undefined)}
                          verseText={KEYWORD}
                          totalPoints={totalPoints}
                          onSkip={challengeMode !== 'daily' ? handleSkip : undefined}
                          isComplete={isComplete}
                          level={currentChallenge?.level}
                          isDaily={challengeMode === 'daily'}
                          onFinishDaily={() => {
                            saveScore(KEYWORD, score);
                            const todayStr = new Date().toISOString().split('T')[0];
                            localStorage.setItem('quran_daily_completed', todayStr);
                            setDailyCompleted(true);
                            updateStatsAfterWin();
                            setChallengeMode('normal');
                            setView('home');
                          }}
                        />
                        {isRoomLoading ? (
                          <div className="flex flex-col items-center justify-center py-28 text-center bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
                            <div className="w-12 h-12 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-4" />
                            <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100 mb-1">
                              جاري استعادة بيانات الغرفة ونوع التحدي...
                            </h3>
                            <p className="text-xs text-slate-400 font-bold">
                              يرجى الانتظار لحظات لمزامنة الجولة الحالية
                            </p>
                          </div>
                        ) : skillsType === 'audio' && !systemSettings.hideAudioChallenge && challengeMode !== 'daily' ? (
                          <AudioChallengeUI
                            targetVerses={targetVerses}
                            matchedIds={matchedIds}
                            isListening={isListening}
                            onToggleListening={isListening ? stopListening : startListening}
                            keyword={KEYWORD}
                            keywordWordCount={keywordWordCount}
                            wordStates={wordStates}
                            onSkip={handleSkip}
                            isComplete={isComplete}
                            challengeMode={challengeMode}
                            saveScore={saveScore}
                            KEYWORD={KEYWORD}
                            score={score}
                            setDailyCompleted={setDailyCompleted}
                            updateStatsAfterWin={updateStatsAfterWin}
                            handlePromptNextChallenge={handlePromptNextChallenge}
                            onViewTafsir={handleOpenTafsir}
                          />
                        ) : skillsType === 'surah' && !systemSettings.hideSurahChallenge && challengeMode !== 'daily' ? (
                          <SurahChallengeUI
                            verseText={KEYWORD}
                            inputs={surahInputs}
                            onInputChange={(idx: number, val: string) => {
                              const newInputs = [...surahInputs];
                              newInputs[idx] = val;
                              setSurahInputs(newInputs);
                            }}
                            onSubmit={handleSubmitSurah}
                            feedback={skillsFeedback}
                            onSkip={handleSkip}
                            isComplete={isComplete}
                            challengeMode={challengeMode}
                            saveScore={saveScore}
                            KEYWORD={KEYWORD}
                            score={score}
                            setDailyCompleted={setDailyCompleted}
                            updateStatsAfterWin={updateStatsAfterWin}
                            handlePromptNextChallenge={handlePromptNextChallenge}
                            onViewTafsir={handleOpenTafsir}
                            currentChallenge={currentChallenge}
                            surahFeedbackData={surahFeedbackData}
                          />
                        ) : ((skillsType === 'complete' && !systemSettings.hideCompletionChallenge) || challengeMode === 'daily') ? (
                          <CompleteChallengeUI
                            verseText={KEYWORD}
                            options={skillsOptions || []}
                            selectedOption={selectedOption}
                            onOptionSelect={handleOptionSelect}
                            onConfirm={handleConfirmAnswer}
                            feedback={skillsFeedback}
                            correctText={skillsCorrectAnswer || currentChallenge?.correctText}
                            onSkip={challengeMode !== 'daily' ? handleSkip : undefined}
                            isComplete={isComplete}
                            challengeMode={challengeMode}
                            saveScore={saveScore}
                            KEYWORD={KEYWORD}
                            score={score}
                            setDailyCompleted={setDailyCompleted}
                            updateStatsAfterWin={updateStatsAfterWin}
                            handlePromptNextChallenge={handlePromptNextChallenge}
                            onViewTafsir={handleOpenTafsir}
                            currentChallenge={currentChallenge}
                            eliminatedIndices={eliminatedOptionIndices}
                            onFinishDaily={() => {
                              setChallengeMode('normal');
                              setView('home');
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm max-w-md mx-auto">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-3">
                              <AlertCircle className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">حدث خطأ في مزامنة الغرفة</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-5 leading-relaxed">
                              تعذر تحديد نوع التحدي للغرفة أو تم تعطيل هذا التحدي في إعدادات التطبيق.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setRoom(null);
                                setSkillsType(null);
                                localStorage.removeItem('activeRoomId');
                                setView('group_join');
                              }}
                              className="px-6 py-2.5 rounded-2xl bg-brand-emerald text-white text-xs font-black shadow-md shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all cursor-pointer"
                            >
                              العودة لقائمة الغرف
                            </button>
                          </div>
                        )}

                        {/* Live Reactions in Challenge / Room Game */}
                        {room && (
                          <LiveReactionsOverlay
                            roomId={room.id}
                            playerId={playerUsername || playerName || undefined}
                            playerName={playerName || undefined}
                            incomingReaction={room.lastReaction || room.playersProgress?.__lastReaction}
                          />
                        )}

                        {/* Transcript Debug */}
                        <AnimatePresence>
                          {isListening && transcript && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="p-4 md:p-8 glass bg-brand-gold/5 border-brand-gold/10 rounded-2xl md:rounded-3xl text-slate-700 text-center quran-text text-lg md:text-xl italic mt-6"
                            >
                              "{transcript}"
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </>
                )}
              </AnimatePresence>
            )}
          </main>
        </PullToRefresh>

          {view === 'home' && (
            <motion.div
              initial={{ scale: 0, x: 20 }}
              animate={{ scale: 1, x: 0 }}
              onClick={() => setIsStreakModalOpen(true)}
              className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 md:bottom-28 md:right-8 z-40 group cursor-pointer"
              title="شعلة الاستمرار اليومية - انقر لعرض التفاصيل"
            >
              <div className="relative">
                {streakInfo.status === 'active' && (
                  <div className="absolute inset-0 bg-orange-500/30 blur-2xl rounded-full scale-110 streak-pulse" />
                )}
                {streakInfo.status === 'warning' && (
                  <div className="absolute inset-0 bg-amber-500/40 blur-2xl rounded-full scale-110 animate-pulse" />
                )}
                <div className={`glass p-2 md:p-3 rounded-2xl md:rounded-[2rem] shadow-2xl flex items-center gap-2 md:gap-3 relative z-10 transition-all group-hover:scale-105 border ${
                  streakInfo.status === 'active'
                    ? 'bg-white/95 border-orange-200 shadow-orange-500/10'
                    : streakInfo.status === 'warning'
                    ? 'bg-amber-50/95 border-amber-300 shadow-amber-500/20 animate-pulse'
                    : 'bg-white/90 border-slate-200 shadow-slate-900/5'
                }`}>
                  <div className={`w-8 h-8 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-md overflow-hidden relative shrink-0 ${
                    streakInfo.status === 'active'
                      ? 'bg-gradient-to-tr from-orange-600 to-amber-500 shadow-orange-500/30'
                      : streakInfo.status === 'warning'
                      ? 'bg-gradient-to-tr from-slate-700 via-amber-700 to-amber-600 shadow-amber-600/30'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                  }`}>
                    <Flame className={`w-4 h-4 md:w-5 md:h-5 fill-current relative z-10 ${
                      streakInfo.status === 'active'
                        ? 'text-white'
                        : streakInfo.status === 'warning'
                        ? 'text-amber-200'
                        : 'text-slate-400 stroke-1'
                    }`} />
                    <div className="absolute inset-0 bg-linear-to-t from-white/20 to-transparent" />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <span className={`text-base md:text-xl font-black tabular-nums block leading-none ${
                        streakInfo.status === 'active'
                          ? 'text-orange-600'
                          : streakInfo.status === 'warning'
                          ? 'text-amber-800'
                          : 'text-slate-600'
                      }`}>
                        {streakInfo.streak}
                      </span>
                      {streakInfo.status === 'warning' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      )}
                    </div>
                    <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block mt-0.5">
                      {streakInfo.status === 'active'
                        ? 'أيام متتالية'
                        : streakInfo.status === 'warning'
                        ? 'مهلة الإنقاذ ⏳'
                        : 'ابدأ الشعلة'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}


          {/* Styled scrollbar & custom animations for the shimmers */}
          <style dangerouslySetInnerHTML={{
            __html: `
        @keyframes shimmer {
          100% { transform: translateX(200%); }
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #fdfbf7; }
        ::-webkit-scrollbar-thumb { background: #064e3b20; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #064e3b40; }
        ::selection { background: #d4af3730; color: #064e3b; }
      `}} />

          {/* About App Modal (نافذة عن التطبيق وصناع العمل) */}
          <AnimatePresence>
            {showAboutModal && (
              <div
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-xl"
                onClick={() => setShowAboutModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="bg-white rounded-3xl md:rounded-[3rem] p-6 md:p-10 max-w-lg w-full shadow-2xl relative overflow-hidden text-center border border-emerald-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setShowAboutModal(false)}
                    className="absolute top-4 left-4 p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 transition-colors"
                    title="إغلاق"
                  >
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-md border border-brand-gold/30 p-2">
                    <img src="/logo.png" className="w-full h-full object-contain drop-shadow-sm" alt="شعار متين" />
                  </div>

                  <div className="flex items-center justify-center mb-1">
                    <img src="/matin-title.png" className="h-9 md:h-10 object-contain drop-shadow-xs" alt="متين" />
                  </div>
                  <h3 className="text-xs md:text-sm font-bold text-slate-500 mb-4">
                    عن تطبيق متين لعلوم ومتشابهات القرآن الكريم
                  </h3>

                  <div className="space-y-3.5 my-6 text-right">
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                      <span className="text-[10px] md:text-xs font-black text-brand-emerald block mb-1">
                        إعداد وبرمجة التطبيق
                      </span>
                      <p className="text-sm md:text-base font-black text-slate-800">
                        علاء الدين الحجي
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                      <span className="text-[10px] md:text-xs font-black text-amber-700 block mb-1">
                        صاحب فكرة التطبيق
                      </span>
                      <p className="text-sm md:text-base font-black text-slate-800">
                        عمر سمير طبش
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
                      <p className="text-slate-600 font-bold text-xs md:text-sm leading-relaxed">
                        لا تنسونا من صالح دعائكم، هذا التطبيق صدقة جارية عني وعن أخي عمر وعن والدينا وأحبائنا.
                      </p>
                    </div>
                  </div>

                    {!isNativeApp && (
                      <div className="flex flex-col gap-2 mb-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAboutModal(false);
                            setShowGooglePlayModal(true);
                          }}
                          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2.5 border border-slate-700/80 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                        >
                          <GooglePlayLogo className="w-5 h-5" />
                          <span>تطبيق متين على Google Play</span>
                          {testerStatus === 'approved' && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                              تم القبول ✓
                            </span>
                          )}
                          {testerStatus === 'pending' && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
                              قيد المراجعة ⏳
                            </span>
                          )}
                        </button>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDownloadModal(true)}
                            className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                          >
                            <Smartphone className="w-5 h-5 text-emerald-200" />
                            <span>تحميل التطبيق (APK)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleShareApp}
                            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm border border-slate-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                            title="مشاركة رابط تحميل تطبيق الأندرويد"
                          >
                            {shareCopied ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span>تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-4 h-4 text-slate-600" />
                                <span>مشاركة</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setShowAboutModal(false)}
                    className="w-full py-3.5 bg-brand-emerald text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-[0.98]"
                  >
                    إغلاق
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedHadith && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl"
                onClick={() => setSelectedHadith(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className={`p-5 md:p-12 rounded-2xl md:rounded-[3.5rem] max-w-4xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl transition-all duration-500 theme-transition relative ${librarySettings.darkMode ? 'lib-dark' : 'glass border-white/20'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setSelectedHadith(null)}
                    className="absolute top-4 md:top-8 left-4 md:left-8 p-2 md:p-3 rounded-xl md:rounded-2xl bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all z-20"
                  >
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <div className="relative z-10 space-y-8 md:space-y-12 pb-6 md:pb-10" dir="rtl">
                    <div className="text-center space-y-3 md:space-y-4">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-teal-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-xl shadow-teal-600/30">
                        <Quote className="w-8 h-8 md:w-10 md:h-10 text-white" />
                      </div>
                      <h2 className="text-xl md:text-4xl font-black text-teal-900 font-quran px-6">{selectedHadith.title}</h2>
                      <div className="h-1 w-16 md:w-24 bg-teal-500/20 rounded-full mx-auto" />
                    </div>

                    <div className="space-y-6 md:space-y-8">
                      {/* Hadith Text Box */}
                      <div className={`p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border shadow-lg transition-colors ${librarySettings.darkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white/90 border-slate-200/80 text-slate-900 shadow-md'
                        }`}>
                        <h3 className="text-xs md:text-sm font-black text-teal-600 uppercase tracking-widest mb-4 opacity-80 border-b border-teal-500/20 pb-2">نص الحديث الشريف</h3>
                        <div className="w-full space-y-3" dir="rtl">
                          {selectedHadith.hadith
                            .split('\n')
                            .filter(l => l.trim())
                            .slice(1)
                            .map((line, i) => (
                              <p
                                key={i}
                                className={`text-base sm:text-lg md:text-xl font-bold leading-relaxed md:leading-loose text-justify w-full ${librarySettings.darkMode ? 'text-slate-100' : 'text-slate-800'
                                  }`}
                                style={{
                                  textAlign: 'justify',
                                  textJustify: 'inter-word',
                                  textAlignLast: 'right',
                                }}
                              >
                                {line}
                              </p>
                            ))}
                        </div>
                      </div>

                      {/* Hadith Explanation & Benefits Box */}
                      <div className={`p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border shadow-lg transition-colors ${librarySettings.darkMode ? 'bg-teal-950/40 border-teal-900/60 text-slate-100' : 'bg-teal-50/60 border-teal-100 text-slate-900 shadow-md'
                        }`}>
                        <h3 className="text-xs md:text-sm font-black text-teal-600 uppercase tracking-widest mb-4 opacity-80 border-b border-teal-500/20 pb-2">الشرح والفوائد</h3>
                        <div className="w-full space-y-3" dir="rtl">
                          {selectedHadith.description
                            .split(/\n\s*\n/)
                            .filter(p => p.trim())
                            .map((paragraph, i) => (
                              <p
                                key={i}
                                className={`text-sm sm:text-base md:text-xl font-medium leading-relaxed md:leading-loose text-justify w-full ${librarySettings.darkMode ? 'text-slate-200' : 'text-slate-800'
                                  }`}
                                style={{
                                  textAlign: 'justify',
                                  textJustify: 'inter-word',
                                  textAlignLast: 'right',
                                }}
                              >
                                {paragraph.split('\n').join(' ')}
                              </p>
                            ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center pt-4 md:pt-8">
                      <button
                        onClick={() => setSelectedHadith(null)}
                        className="px-10 py-4 md:px-12 md:py-5 bg-teal-600 text-white rounded-2xl md:rounded-3xl font-black text-base md:text-lg shadow-xl shadow-teal-600/30 hover:bg-teal-700 transition-all active:scale-95"
                      >
                        تمت القراءة
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <ConfirmModal
            isOpen={isExitModalOpen}
            onClose={() => setIsExitModalOpen(false)}
            onConfirm={confirmExitToHome}
            title="تأكيد الخروج"
            message="هل تريد العودة للرئيسية؟ سيتم فقدان تقدمك الحالي في هذه الآية."
          />

          <ConfirmModal
            isOpen={isResignModalOpen}
            onClose={() => setIsResignModalOpen(false)}
            onConfirm={handleResignGroupChallenge}
            title="تأكيد الانسحاب من التحدي"
            message="هل أنت متأكد من الانسحاب من هذا التحدي الجماعي؟ سيتم احتساب 0 نقاط وتسجيل أنك أنهيت التحدي بالانسحاب."
            confirmText="تأكيد الانسحاب"
            cancelText="إلغاء"
            isDanger={true}
          />

          <ConfirmModal
            isOpen={isCancelRoomModalOpen}
            onClose={() => setIsCancelRoomModalOpen(false)}
            onConfirm={confirmCancelRoomByHost}
            title="تأكيد إلغاء الغرفة"
            message="هل أنت متأكد من إلغاء الغرفة؟ سيتم حذفها وإشعار جميع المتسابقين المتواجدين."
            confirmText="تأكيد الإلغاء"
            cancelText="تراجع"
            isDanger={true}
          />

          <ConfirmModal
            isOpen={isNextChallengeModalOpen}
            onClose={() => setIsNextChallengeModalOpen(false)}
            onConfirm={confirmNextChallenge}
            title="التحدي التالي"
            message="هل أنت مستعد للتحدي التالي؟"
          />

          <LibrarySettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={librarySettings}
            setSettings={setLibrarySettings}
            showReadingMode={view === 'mushaf'}
          />

          <StreakModal
            isOpen={isStreakModalOpen}
            onClose={() => setIsStreakModalOpen(false)}
            streakInfo={streakInfo}
            onStartChallenge={() => {
              setIsStreakModalOpen(false);
              handleStartDaily();
            }}
          />

          <CosmeticStoreModal
            isOpen={showCosmeticStore}
            onClose={() => setShowCosmeticStore(false)}
            totalPoints={totalPoints}
            setTotalPoints={setTotalPoints}
            streakCount={streak}
            setStreakCount={setStreak}
            ownedCosmetics={ownedCosmetics}
            setOwnedCosmetics={setOwnedCosmetics}
            equippedBorder={activeFrame}
            setEquippedBorder={setActiveFrame}
            equippedNameColor={equippedNameColor}
            setEquippedNameColor={setEquippedNameColor}
            equippedTitle={equippedTitle}
            setEquippedTitle={setEquippedTitle}
            onSaveToServer={() => {
              if (playerName) {
                fetch('/api/player-score', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: playerName,
                    username: playerUsername,
                    equippedNameColor,
                    equippedTitle,
                    activeFrame,
                    ownedCosmetics,
                    powerUps: {
                      freezeTime: freezeTimeCount,
                      deleteTwo: deleteTwoCount
                    }
                  })
                }).catch(() => {});
              }
            }}
          />

          <IslamicOccasionsModal
            isOpen={isOccasionsModalOpen}
            onClose={() => setIsOccasionsModalOpen(false)}
            occasions={upcomingOccasions}
            hijriDate={hijriDate}
            initialSelectedId={nearestOccasion?.id}
          />

          <AppDownloadModal
            isOpen={showDownloadModal}
            onClose={() => setShowDownloadModal(false)}
          />

          <GooglePlayTesterModal
            isOpen={showGooglePlayModal}
            onClose={() => setShowGooglePlayModal(false)}
            testerEmail={testerEmail}
            setTesterEmail={setTesterEmail}
            testerStatus={testerStatus}
            testerMessage={testerMessage}
            internalTestLink={internalTestLink}
            onRegister={handleRegisterTester}
            onReset={handleResetTesterForm}
            onOpenDirectApk={() => setShowDownloadModal(true)}
            onShareApp={handleShareApp}
            shareCopied={shareCopied}
            isCheckingSavedStatus={isCheckingSavedStatus}
          />

          {selectedAyah && (
            <AyahActionSheet
              selectedAyah={selectedAyah}
              onClose={() => setSelectedAyah(null)}
              onNavigateToPage={(p) => {
                setCurrentPage(p);
                setSelectedAyah(null);
              }}
              onOpenEncyclopedia={(s, a) => {
                setSelectedAyah(null);
                setView('encyclopedia');
              }}
              darkMode={librarySettings.darkMode}
            />
          )}
      

          <PrivacyModal
            isOpen={showPrivacyModal}
            onClose={() => setShowPrivacyModal(false)}
            initialTab={privacyModalInitialTab}
          />

          <IslamicRoomConfigModal
            isOpen={showIslamicConfigModal}
            onClose={() => setShowIslamicConfigModal(false)}
            selectedCategories={islamicRoomCategories}
            onSelectCategories={setIslamicRoomCategories}
            selectedLevels={islamicRoomLevels}
            onSelectLevels={setIslamicRoomLevels}
            selectedTopics={islamicRoomTopics}
            onSelectTopics={setIslamicRoomTopics}
            topicQuestionCounts={islamicTopicQuestionCounts}
            onUpdateTopicCount={(topic, count) => setIslamicTopicQuestionCounts(prev => ({ ...prev, [topic]: count }))}
          />



          {/* Private Room Password Dialog */}
          <AnimatePresence>
            {privateRoomModal.isOpen && privateRoomModal.room && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-orange-100 text-right space-y-5"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <button
                      onClick={() => setPrivateRoomModal({ isOpen: false, room: null, password: '', error: undefined })}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <h3 className="font-black text-slate-800 text-base md:text-lg">غرفة خاصة محمية</h3>
                        <p className="text-[11px] text-slate-400 font-bold">{privateRoomModal.room.name || 'غرفة التحدي'}</p>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
                        <Lock className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1 text-xs text-slate-600 font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-400">المنشئ:</span>
                      <span className="text-slate-800 font-black">{privateRoomModal.room.hostName}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700">
                      أدخل كلمة المرور للانضمام
                    </label>
                    <input
                      type="password"
                      autoFocus
                      value={privateRoomModal.password}
                      onChange={(e) => setPrivateRoomModal(prev => ({ ...prev, password: e.target.value, error: undefined }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && privateRoomModal.password.trim() && !isJoiningRoom) {
                          handleJoinV1(privateRoomModal.room.id, privateRoomModal.password);
                        }
                      }}
                      placeholder="كلمة مرور الغرفة"
                      className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none text-slate-800 font-black text-sm text-center shadow-inner"
                    />
                    {privateRoomModal.error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-1.5 text-xs font-bold text-red-500 justify-end"
                      >
                        <span>{privateRoomModal.error}</span>
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      </motion.div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => handleJoinV1(privateRoomModal.room.id, privateRoomModal.password)}
                      disabled={isJoiningRoom || !privateRoomModal.password.trim()}
                      className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-black text-sm hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isJoiningRoom ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الانضمام'}
                    </button>
                    <button
                      onClick={() => setPrivateRoomModal({ isOpen: false, room: null, password: '', error: undefined })}
                      className="px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCertificate && (
              <CertificateGenerator
                category={selectedCategory}
                onClose={() => setShowCertificate(false)}
                isClaimed={userCertificates.some(c => c.category === selectedCategory)}
                claimedName={userCertificates.find(c => c.category === selectedCategory)?.name}
                onSave={(certData) => {
                  // Prevent duplicate entries for the same category
                  if (userCertificates.some(c => c.category === certData.category)) return;

                  const newCerts = [...userCertificates, certData];
                  setUserCertificates(newCerts);
                  localStorage.setItem('quran_user_certificates', JSON.stringify(newCerts));

                  // Automatically activate frame and decoration upon earning certificate
                  const category = certData.category === 'seerah' ? 'seerah' : 'general';
                  setActiveFrame(category);
                  setIsNameDecorated(true);
                  localStorage.setItem('quran_active_frame', category);
                  localStorage.setItem('quran_name_decorated', 'true');

                  // Immediately sync to server so others see the frame in the leaderboard
                  if (playerUsername || playerName) {
                    fetch('/api/player-score', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: playerName,
                        username: playerUsername,
                        seerahCompleted: category === 'seerah' || userCertificates.some(c => c.category === 'seerah'),
                        generalCompleted: category === 'general' || userCertificates.some(c => c.category === 'general'),
                        activeFrame: category
                      })
                    }).then(() => syncLeaderboard()).catch(err => console.error('Certificate save sync failed:', err));
                  }
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showTafsirModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-10 bg-slate-900/60 backdrop-blur-md"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-12 shadow-2xl max-w-2xl w-full relative overflow-hidden"
                >
                  <div className="absolute top-0 inset-x-0 h-2 bg-emerald-500" />

                  <div className="flex items-center gap-4 mb-6 md:mb-10">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <BookOpen className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-3xl font-black text-slate-800 leading-none mb-2">تفسير الآية الكريمة</h3>
                      <p className="text-[10px] md:text-xs font-black text-emerald-600 uppercase tracking-widest leading-none">تفسير السعدي (تيسير الكريم الرحمن)</p>
                    </div>
                  </div>

                  <p
                    className="!text-2xl md:!text-3xl text-slate-800 leading-loose !font-quran font-normal text-center my-6 !tracking-normal"
                    dir="rtl"
                    style={{ letterSpacing: '0', wordSpacing: 'normal', fontFeatureSettings: '"rlig" 1, "calt" 1' }}
                  >
                    {tafsirAyahText}
                  </p>

                  <div className="mt-6 p-5 bg-slate-50 rounded-xl border-r-4 border-emerald-500 w-full text-right" dir="rtl">
                    <p className="text-xs font-bold text-slate-500 mb-3">التفسير (الميسر):</p>
                    <p
                      className="text-lg md:text-xl text-slate-700 leading-relaxed !font-quran font-normal text-justify !tracking-normal"
                      style={{ letterSpacing: '0', wordSpacing: 'normal', fontFeatureSettings: '"rlig" 1, "calt" 1' }}
                    >
                      {tafsirData}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowTafsirModal(false)}
                    className="mt-6 md:mt-10 w-full py-4 md:py-5 bg-emerald-600 text-white rounded-xl md:rounded-2xl font-black text-md md:text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
                  >
                    حسناً، فهمت
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fixed Bottom Navigation Bar */}
          {!isMushafFullscreen && (
            <nav className="fixed bottom-0 left-0 right-0 z-40 glass-dark border-t border-white/15 shadow-2xl backdrop-blur-2xl py-2 px-3 sm:px-6">
              <div className="max-w-md mx-auto flex items-center justify-around">

                {/* 1. الرئيسية (Home) */}
                <button
                  onClick={() => {
                    setView('home');
                    setShowScores(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-300 ${view === 'home' && !showScores
                      ? 'text-brand-gold bg-white/15 scale-105 shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  title="الرئيسية"
                >
                  <Home className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">الرئيسية</span>
                </button>

                {/* 2. التحديات (Challenges) */}
                <button
                  onClick={() => {
                    setView('challenges');
                    setShowScores(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-300 ${view === 'challenges'
                      ? 'text-brand-gold bg-white/15 scale-105 shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  title="التحديات"
                >
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">التحديات</span>
                </button>

                {/* 3. المكتبة والعلوم الشرعية (Library) */}
                <button
                  onClick={() => {
                    setView('library');
                    setShowScores(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-300 ${view === 'library' || view === 'mushaf' || view === 'adhkar' || view === 'hadith' || view === 'book' || view === 'encyclopedia' || view === 'islamic_videos'
                      ? 'text-brand-gold bg-white/15 scale-105 shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  title="المكتبة والعلوم الشرعية"
                >
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">المكتبة</span>
                </button>

                {/* 4. الإعدادات (Settings) */}
                <button
                  onClick={() => {
                    setView('settings');
                    setShowScores(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-300 ${view === 'settings'
                      ? 'text-brand-gold bg-white/15 scale-105 shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  title="الإعدادات"
                >
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">الإعدادات</span>
                </button>

              </div>
            </nav>
          )}

          {/* Fullscreen Mushaf Mode Overlay */}
          <AnimatePresence>
            {isMushafFullscreen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={toggleFullscreenControls}
                className="fixed inset-0 z-[100] w-screen h-screen flex flex-col justify-between overflow-hidden select-none cursor-pointer"
                style={{
                  backgroundColor: librarySettings.darkMode ? '#0B132B' : '#fcfaf5',
                  color: librarySettings.darkMode ? '#e2e8f0' : '#1e293b',
                  backgroundImage: librarySettings.darkMode
                    ? 'radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, rgba(11, 19, 43, 0.98) 85%)'
                    : 'radial-gradient(circle at center, rgba(217, 119, 6, 0.05) 0%, #fcfaf5 85%)',
                }}
              >
                {/* Floating Top Controls: Exit 'X' Button on Corner & Page Info */}
                <AnimatePresence>
                  {areFullscreenControlsVisible && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 left-3 sm:top-5 sm:left-5 z-50 pointer-events-auto"
                      >
                        <button
                          onClick={exitMushafFullscreen}
                          className="p-2.5 sm:p-3 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xl border border-white/20 shadow-2xl transition-all active:scale-95 flex items-center gap-2 group cursor-pointer"
                          title="خروج من ملء الشاشة (Esc)"
                          aria-label="خروج من ملء الشاشة"
                        >
                          <X className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:rotate-90 transition-transform duration-200" />
                          <span className="text-xs sm:text-sm font-black hidden sm:inline text-white/90">خروج</span>
                        </button>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 right-3 sm:top-5 sm:right-5 z-50 pointer-events-auto"
                      >
                        <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-black/60 text-white backdrop-blur-xl border border-white/20 shadow-2xl text-xs sm:text-sm font-black flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-brand-gold" />
                          <span>المصحف الشريف</span>
                          <span className="text-white/40">•</span>
                          <span className="text-brand-gold">صفحة {currentPage}</span>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Main Fullscreen Quran Page View with Pinch-to-Zoom & Free 2D Pan */}
                <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden p-0 sm:p-2">
                  <QuranZoomViewer
                    pageNumber={currentPage}
                    darkMode={librarySettings.darkMode}
                    isFullscreen={true}
                    onPageTurn={(dir) => {
                      setPageTurnDirection(dir);
                      if (dir === 'next') {
                        setCurrentPage(prev => Math.min(604, prev + 1));
                      } else {
                        setCurrentPage(prev => Math.max(1, prev - 1));
                      }
                      resetFullscreenControlsTimer();
                    }}
                    onTap={() => {
                      if (selectedAyah) {
                        setSelectedAyah(null);
                      } else {
                        toggleFullscreenControls();
                      }
                    }}
                    onInteraction={resetFullscreenControlsTimer}
                    pageTurnDirection={pageTurnDirection}
                    selectedAyah={selectedAyah}
                    onSelectAyah={(s, a) => {
                      setSelectedAyah({ surah: s, ayah: a });
                      resetFullscreenControlsTimer();
                    }}
                  />
                </div>

                {/* Bottom Floating Navigation Arrows & Page Jump */}
                <AnimatePresence>
                  {areFullscreenControlsVisible && (
                    <motion.div
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 25 }}
                      transition={{ duration: 0.2 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        resetFullscreenControlsTimer();
                      }}
                      className="absolute bottom-4 sm:bottom-6 inset-x-0 flex justify-center items-center pointer-events-none z-50 px-4"
                    >
                      <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-2xl border border-white/20 shadow-2xl transition-all">
                        {/* Previous Page Button (In Arabic RTL: right arrow = previous page) */}
                        <button
                          onClick={() => {
                            if (currentPage > 1) {
                              setPageTurnDirection('prev');
                              setCurrentPage(prev => Math.max(1, prev - 1));
                              resetFullscreenControlsTimer();
                            }
                          }}
                          disabled={currentPage === 1}
                          className="p-2 sm:p-2.5 rounded-full text-white hover:text-brand-gold disabled:opacity-30 disabled:hover:text-white transition-all active:scale-90"
                          title="الصفحة السابقة"
                          aria-label="الصفحة السابقة"
                        >
                          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>

                        {/* Page indicator & direct input */}
                        <div className="flex items-center gap-1.5 px-2 text-white font-black text-xs sm:text-sm select-none">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={currentPage}
                            onClick={(e) => {
                              e.stopPropagation();
                              resetFullscreenControlsTimer();
                            }}
                            onChange={(e) => {
                              resetFullscreenControlsTimer();
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              if (val === '') return;
                              const num = parseInt(val);
                              if (num >= 1 && num <= 604) {
                                setCurrentPage(num);
                              }
                            }}
                            className="w-10 sm:w-12 bg-white/10 border border-white/20 rounded-lg text-center text-xs sm:text-sm font-black text-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold py-0.5"
                          />
                          <span className="text-white/40">/</span>
                          <span className="text-white/70">604</span>
                        </div>

                        {/* Next Page Button (In Arabic RTL: left arrow = next page) */}
                        <button
                          onClick={() => {
                            if (currentPage < 604) {
                              setPageTurnDirection('next');
                              setCurrentPage(prev => Math.min(604, prev + 1));
                              resetFullscreenControlsTimer();
                            }
                          }}
                          disabled={currentPage === 604}
                          className="p-2 sm:p-2.5 rounded-full text-white hover:text-brand-gold disabled:opacity-30 disabled:hover:text-white transition-all active:scale-90"
                          title="الصفحة التالية"
                          aria-label="الصفحة التالية"
                        >
                          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* 4. نافذة فوقية أثناء انقطاع الاتصال (Reconnection Overlay) */}
      <AnimatePresence>
        {isReconnecting && (room || view === 'group_waiting' || view === 'group_game' || view === 'challenge') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs text-right"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
                <RefreshCw className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">
                  جاري إعادة الاتصال...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                  ضعف أو انقطاع في الاتصال بالإنترنت، جاري استعادة المزامنة اللحظية للغرفة دون فقدان تقدمك...
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}
