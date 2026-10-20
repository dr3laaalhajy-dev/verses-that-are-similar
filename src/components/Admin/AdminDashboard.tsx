import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit2, Trash2, Save, X, BookOpen,
  LayoutDashboard, Search, Sparkles, AlertCircle, ArrowRight,
  Hash, List, ChevronDown, ChevronUp, Users, Shield, UserPlus, Key, Loader2, Home,
  Crown, Lock, KeyRound, Copy, Check, User, Menu, LogOut, UserX, UserCheck,
  Trophy, Star, RefreshCw, Eye, EyeOff, ShieldCheck, CheckCircle2, XCircle
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
  category?: string;
  level?: string;
  type?: string;
  audioUrl?: string;
  options?: any[];
  correctText?: string;
}

interface Admin {
  id: number;
  username: string;
  name?: string;
  isSuperAdmin: boolean;
  role?: string;
  canManageUsers?: boolean;
}

interface PlayerUser {
  id: number;
  name: string;
  username: string;
  points: number;
  cups: number;
  isBlocked: boolean;
  activeFrame?: string | null;
  seerahCompleted?: boolean;
  generalCompleted?: boolean;
  quranCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminDashboardProps {
  token: string;
  isSuperAdmin: boolean;
  adminRole?: string;
  currentUsername?: string;
  currentName?: string;
  currentAdminId?: number | null;
  canManageUsers?: boolean;
  onPermissionsUpdated?: (canManageUsers: boolean) => void;
  systemSettings?: {
    hideAudioChallenge: boolean;
    hideCompletionChallenge: boolean;
    hideSurahChallenge: boolean;
  };
  onSettingsUpdated?: () => void;
  onLogout: () => void;
  onBackHome: () => void;
}

export default function AdminDashboard({ 
  token, 
  isSuperAdmin, 
  adminRole, 
  currentUsername, 
  currentName,
  currentAdminId,
  canManageUsers,
  onPermissionsUpdated,
  systemSettings,
  onSettingsUpdated,
  onLogout, 
  onBackHome 
}: AdminDashboardProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'STANDARD' | 'COMPLETION' | 'SURAH' | 'admins' | 'users'>('STANDARD');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [isSavingChallenge, setIsSavingChallenge] = useState(false);
  const [isDeletingChallenge, setIsDeletingChallenge] = useState(null as number | null);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(null as number | null);

  // Active permission state for Co-Founder to allow real-time instant sync
  const [activeCanManageUsers, setActiveCanManageUsers] = useState<boolean>(() => {
    if (typeof canManageUsers === 'boolean') return canManageUsers;
    return localStorage.getItem('quran_admin_can_manage_users') === 'true';
  });

  useEffect(() => {
    if (typeof canManageUsers === 'boolean') {
      setActiveCanManageUsers(canManageUsers);
    }
  }, [canManageUsers]);

  // Permissions
  const isCurrentUserFounder = adminRole === 'FOUNDER' || currentUsername?.toLowerCase() === 'alaa' || currentUsername === 'علاء';
  const isCurrentUserCoFounder = adminRole === 'CO_FOUNDER';
  const isRegularAdmin = adminRole === 'ADMIN' || (!isCurrentUserFounder && !isCurrentUserCoFounder);
  const canSeeAdminsTab = !isRegularAdmin && (isCurrentUserFounder || isCurrentUserCoFounder);
  const canManageUsersTab = isCurrentUserFounder || (isCurrentUserCoFounder && !!activeCanManageUsers);

  // Strict check for Founder Alaa (ID: 5)
  const isFounderAlaa = currentAdminId === 5 || 
    (isCurrentUserFounder && (currentUsername?.toLowerCase() === 'alaa' || currentUsername === 'علاء'));

  // Global settings state
  const [localSettings, setLocalSettings] = useState({
    hideAudioChallenge: systemSettings?.hideAudioChallenge ?? false,
    hideCompletionChallenge: systemSettings?.hideCompletionChallenge ?? false,
    hideSurahChallenge: systemSettings?.hideSurahChallenge ?? false,
  });
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);

  // Users management state
  const [usersList, setUsersList] = useState<PlayerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersFilter, setUsersFilter] = useState<'all' | 'active' | 'blocked'>('all');

  // Modals for Users
  const [editingUser, setEditingUser] = useState<PlayerUser | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserPoints, setEditUserPoints] = useState(0);
  const [editUserCups, setEditUserCups] = useState(0);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [resetPasswordUser, setResetPasswordUser] = useState<PlayerUser | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [isTogglingBlock, setIsTogglingBlock] = useState<number | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<number | null>(null);
  const [isTogglingPermission, setIsTogglingPermission] = useState<number | null>(null);

  useEffect(() => {
    if (systemSettings) {
      setLocalSettings(systemSettings);
    }
  }, [systemSettings]);

  // Prevent unauthorized access to tabs
  useEffect(() => {
    if (activeTab === 'admins' && !canSeeAdminsTab) {
      setActiveTab('STANDARD');
    }
    if (activeTab === 'users' && !canManageUsersTab) {
      setActiveTab('STANDARD');
    }
  }, [activeTab, canSeeAdminsTab, canManageUsersTab]);

  // Synchronize activeTab if current tab is hidden and user is not viewing it intentionally
  useEffect(() => {
    if (!isFounderAlaa && activeTab !== 'admins' && activeTab !== 'users') {
      const isCurrentHidden = 
        (activeTab === 'STANDARD' && localSettings.hideAudioChallenge) ||
        (activeTab === 'COMPLETION' && localSettings.hideCompletionChallenge) ||
        (activeTab === 'SURAH' && localSettings.hideSurahChallenge);

      if (isCurrentHidden) {
        if (!localSettings.hideAudioChallenge) setActiveTab('STANDARD');
        else if (!localSettings.hideCompletionChallenge) setActiveTab('COMPLETION');
        else if (!localSettings.hideSurahChallenge) setActiveTab('SURAH');
        else if (canManageUsersTab) setActiveTab('users');
        else if (canSeeAdminsTab) setActiveTab('admins');
      }
    }
  }, [localSettings, isFounderAlaa, activeTab, canSeeAdminsTab, canManageUsersTab]);

  const handleToggleSetting = async (key: 'hideAudioChallenge' | 'hideCompletionChallenge' | 'hideSurahChallenge', nextVal: boolean) => {
    setIsUpdatingSettings(true);
    const updated = { ...localSettings, [key]: nextVal };
    setLocalSettings(updated);

    // If hiding the currently active tab, automatically switch activeTab to first visible tab
    if (nextVal) {
      if (key === 'hideAudioChallenge' && activeTab === 'STANDARD') {
        if (!updated.hideCompletionChallenge) setActiveTab('COMPLETION');
        else if (!updated.hideSurahChallenge) setActiveTab('SURAH');
        else if (canSeeAdminsTab) setActiveTab('admins');
      } else if (key === 'hideCompletionChallenge' && activeTab === 'COMPLETION') {
        if (!updated.hideAudioChallenge) setActiveTab('STANDARD');
        else if (!updated.hideSurahChallenge) setActiveTab('SURAH');
        else if (canSeeAdminsTab) setActiveTab('admins');
      } else if (key === 'hideSurahChallenge' && activeTab === 'SURAH') {
        if (!updated.hideAudioChallenge) setActiveTab('STANDARD');
        else if (!updated.hideCompletionChallenge) setActiveTab('COMPLETION');
        else if (canSeeAdminsTab) setActiveTab('admins');
      }
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل تحديث الإعدادات');
      if (onSettingsUpdated) onSettingsUpdated();
      showAlert('نجاح', data.message || 'تم تحديث ظهور التحديات بنجاح');
    } catch (err: any) {
      setLocalSettings(localSettings); // Revert on failure
      showAlert('خطأ', err.message);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // Admin form and modal states
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'ADMIN' | 'CO_FOUNDER'>('ADMIN');
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [isInviteCodesModalOpen, setIsInviteCodesModalOpen] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);

  // Password change states
  const [changingPasswordAdmin, setChangingPasswordAdmin] = useState<Admin | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
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
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [type, setType] = useState<'STANDARD' | 'COMPLETION' | 'SURAH'>('STANDARD');
  const [audioUrl, setAudioUrl] = useState('');
  const [options, setOptions] = useState<any[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [correctText, setCorrectText] = useState('');
  const [correctSurahs, setCorrectSurahs] = useState<string[]>(['']);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [suggestions, setSuggestions] = useState<GroupedAyah[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const checkMyPermissions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin?action=me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const serverCanManage = Boolean(data.canManageUsers);
        setActiveCanManageUsers(prev => {
          if (prev !== serverCanManage) {
            localStorage.setItem('quran_admin_can_manage_users', String(serverCanManage));
            if (onPermissionsUpdated) {
              onPermissionsUpdated(serverCanManage);
            }
          }
          return serverCanManage;
        });
      }
    } catch {
      // ignore network errors
    }
  }, [token, onLogout, onPermissionsUpdated]);

  useEffect(() => {
    // 1. Check immediately on mount/refresh
    checkMyPermissions();

    // 2. Poll every 2.5s for instant sync across tabs or devices
    const interval = setInterval(() => {
      if (!document.hidden) {
        checkMyPermissions();
      }
    }, 2500);

    const handleVisibility = () => {
      if (!document.hidden) {
        checkMyPermissions();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'quran_admin_perm_updated_at' || e.key === 'quran_admin_can_manage_users') {
        checkMyPermissions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, [checkMyPermissions]);

  useEffect(() => {
    fetchChallenges();
    if (canSeeAdminsTab) {
      fetchAdmins();
      fetchInviteCodes();
    }
    if (canManageUsersTab) {
      fetchUsers();
    }
  }, [canSeeAdminsTab, canManageUsersTab]);

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

  const generateInviteCode = async (role: 'ADMIN' | 'SUPERADMIN' | 'CO_FOUNDER' = 'ADMIN') => {
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
      if (currentAdminId) {
        const me = data.find((a: any) => a.id === currentAdminId);
        if (me && typeof me.canManageUsers === 'boolean') {
          setActiveCanManageUsers(me.canManageUsers);
          localStorage.setItem('quran_admin_can_manage_users', String(me.canManageUsers));
          onPermissionsUpdated?.(me.canManageUsers);
        }
      }
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

  const handleSearchCompletionAyahs = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const groupedMatches = searchGroupedAyahsByStart(searchQuery);
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
      showAlert('تنبيه', type === 'STANDARD' ? 'يرجى إدخال الكلمة المفتاحية (بداية الآيات)' : 'يرجى إدخال نص الآية');
      return;
    }

    // Type-specific validations
    if (type === 'STANDARD') {
      if (verses.length === 0) {
        showAlert('تنبيه', 'يرجى إضافة آية واحدة على الأقل للتحدي');
        return;
      }
      const invalidVerses = verses.filter(v => !v.text.trim() || !v.surah.trim());
      if (invalidVerses.length > 0) {
        showAlert('تنبيه', 'يرجى التأكد من ملء نص الآية واسم السورة لجميع الآيات المضافة');
        return;
      }
    }

    if (type === 'COMPLETION') {
      if (options.some(opt => !opt.trim())) {
        showAlert('تنبيه', 'يرجى إدخال جميع الخيارات الأربعة لتكملة الآية');
        return;
      }
      if (!correctText.trim() || !options.includes(correctText)) {
        showAlert('تنبيه', 'يرجى اختيار أحد الخيارات كإجابة صحيحة');
        return;
      }
    }
    if (type === 'SURAH' && correctSurahs.filter(s => s.trim()).length === 0) {
      showAlert('تنبيه', 'يرجى إدخال اسم سورة صحيح واحد على الأقل');
      return;
    }

    const payloadVerses = type === 'STANDARD' ? verses : [];


    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/challenges/${editingId}` : '/api/challenges';

    const finalCorrectText = type === 'SURAH' 
      ? JSON.stringify(correctSurahs.filter(s => s.trim())) 
      : correctText;

    const finalOptions = type === 'COMPLETION' 
      ? options.map((opt, i) => ({
          text: typeof opt === 'string' ? opt : opt.text,
          isCorrect: i === correctIndex
        }))
      : options;

    const payload = { 
      keyword, 
      verses: payloadVerses, 
      category, 
      level, 
      type, 
      audioUrl, 
      options: finalOptions, 
      correctText: finalCorrectText 
    };

    setIsSavingChallenge(true);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
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
    const cleanUsername = newAdminUsername.trim().replace(/^@+/, '');
    if (!cleanUsername || !newAdminPassword.trim()) {
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
          name: newAdminName.trim() || cleanUsername,
          username: cleanUsername, 
          password: newAdminPassword,
          role: isCurrentUserFounder ? newAdminRole : 'ADMIN',
          isSuperAdmin: newAdminRole === 'CO_FOUNDER'
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'فشل إضافة المشرف');
      }

      showAlert('نجاح', 'تم إضافة المشرف بنجاح!');
      setNewAdminName('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setNewAdminRole('ADMIN');
      fetchAdmins();
    } catch (err: any) {
      showAlert('خطأ', err.message);
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPasswordAdmin || !newPasswordVal.trim()) return;
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'change-password',
          id: changingPasswordAdmin.id,
          newPassword: newPasswordVal
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل تغيير كلمة المرور');

      showAlert('نجاح', data.message || 'تم تغيير كلمة المرور بنجاح');
      setChangingPasswordAdmin(null);
      setNewPasswordVal('');
    } catch (err: any) {
      showAlert('خطأ', err.message);
    } finally {
      setIsChangingPassword(false);
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

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'فشل حذف المشرف');
        }
        fetchAdmins();
      } catch (err: any) {
        showAlert('خطأ', err.message);
      } finally {
        setIsDeletingAdmin(null);
      }
    });
  };

  const fetchUsers = async (searchVal = '') => {
    if (!canManageUsersTab) return;
    setUsersLoading(true);
    try {
      const q = searchVal.trim();
      const url = q ? `/api/admin?action=users&search=${encodeURIComponent(q)}` : `/api/admin?action=users`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 403) {
          checkMyPermissions();
        }
        throw new Error('فشل جلب قائمة المستخدمين');
      }
      const data = await res.json();
      setUsersList(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleToggleBlockUser = async (user: PlayerUser) => {
    const nextStatus = !user.isBlocked;
    const actionText = nextStatus ? 'حظر هذا المستخدم ومنعه من تسجيل الدخول' : 'إلغاء حظر المستخدم والسماح له بالدخول';
    showConfirm(
      nextStatus ? 'تأكيد الحظر' : 'تأكيد إلغاء الحظر',
      `هل أنت متأكد من رغبتك في ${actionText}؟`,
      async () => {
        setIsTogglingBlock(user.id);
        try {
          const res = await fetch('/api/admin?action=users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              subAction: 'toggle-block',
              id: user.id,
              isBlocked: nextStatus
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'فشلت العملية');
          setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, isBlocked: nextStatus } : u));
          showAlert('نجاح', data.message);
        } catch (err: any) {
          showAlert('خطأ', err.message);
        } finally {
          setIsTogglingBlock(null);
        }
      }
    );
  };

  const handleDeleteUser = (user: PlayerUser) => {
    showConfirm(
      'حذف حساب المستخدم',
      `هل أنت متأكد تماماً من حذف حساب اللاعب (${user.name} - @${user.username})؟ سيتم حذف جميع نقاطه وغرفه نهائياً ولا يمكن التراجع عن هذا الإجراء!`,
      async () => {
        setIsDeletingUser(user.id);
        try {
          const res = await fetch(`/api/admin?action=users&id=${user.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'فشل حذف المستخدم');
          setUsersList(prev => prev.filter(u => u.id !== user.id));
          showAlert('نجاح', data.message);
        } catch (err: any) {
          showAlert('خطأ', err.message);
        } finally {
          setIsDeletingUser(null);
        }
      }
    );
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingUser(true);
    try {
      const res = await fetch('/api/admin?action=users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subAction: 'update-info',
          id: editingUser.id,
          name: editUserName,
          username: editUserUsername,
          points: editUserPoints,
          cups: editUserCups
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل تحديث البيانات');
      setUsersList(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        name: editUserName.trim(),
        username: editUserUsername.replace(/^@+/, '').trim(),
        points: Number(editUserPoints),
        cups: Number(editUserCups)
      } : u));
      setEditingUser(null);
      showAlert('نجاح', data.message);
    } catch (err: any) {
      showAlert('خطأ', err.message);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newUserPassword.trim()) return;
    setIsResettingPassword(true);
    try {
      const res = await fetch('/api/admin?action=users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subAction: 'reset-password',
          id: resetPasswordUser.id,
          newPassword: newUserPassword.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل إعادة تعيين كلمة المرور');
      setResetPasswordUser(null);
      setNewUserPassword('');
      showAlert('نجاح', data.message);
    } catch (err: any) {
      showAlert('خطأ', err.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleToggleCoFounderUserPermission = async (targetAdmin: Admin) => {
    if (!isFounderAlaa) return;
    const nextVal = !targetAdmin.canManageUsers;
    setIsTogglingPermission(targetAdmin.id);
    try {
      const res = await fetch('/api/admin?action=toggle-user-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'toggle-user-permission',
          adminId: targetAdmin.id,
          canManageUsers: nextVal
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل تغيير الصلاحية');
      setAdmins(prev => prev.map(a => a.id === targetAdmin.id ? { ...a, canManageUsers: nextVal } : a));
      try {
        localStorage.setItem('quran_admin_perm_updated_at', Date.now().toString());
      } catch {
        // ignore
      }
      showAlert('نجاح', data.message);
    } catch (err: any) {
      showAlert('خطأ', err.message);
    } finally {
      setIsTogglingPermission(null);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setKeyword('');
    setCategory('');
    setLevel('');
    setVerses([]);
    setSuggestions([]);
    setType(activeTab === 'admins' || activeTab === 'users' ? 'STANDARD' : activeTab);
    setAudioUrl('');
    setOptions(['', '', '', '']);
    setCorrectIndex(null);
    setCorrectText('');
    setCorrectSurahs(['']);
    setSearchQuery('');
    setSuggestions([]);
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setKeyword(c.keyword);
    setCategory(c.category || '');
    setLevel(c.level || '');
    const cType = (c.type === 'AUDIO' || !c.type) ? 'STANDARD' : c.type;
    setActiveTab(cType);
    setType(cType as 'STANDARD' | 'COMPLETION' | 'SURAH');
    setAudioUrl(c.audioUrl || '');
    setOptions(c.options || ['', '', '', '']);
    
    if (cType === 'COMPLETION' && Array.isArray(c.options)) {
      const idx = c.options.findIndex((o: any) => typeof o === 'object' ? o.isCorrect : o === c.correctText);
      setCorrectIndex(idx !== -1 ? idx : null);
    }
    
    // Parse correctSurahs if it's a JSON string
    if (cType === 'SURAH') {
      try {
        if (c.correctText?.startsWith('[')) {
          setCorrectSurahs(JSON.parse(c.correctText));
        } else {
          setCorrectSurahs([c.correctText || '']);
        }
      } catch (e) {
        setCorrectSurahs([c.correctText || '']);
      }
    }
    
    setCorrectText(c.correctText || '');
    // Ensure verses is an array (backwards compat)
    setVerses(Array.isArray(c.verses) ? c.verses.map((v: any) => ({
      ...v,
      number: v.number || v.verseNumber
    })) : []);
    setIsAdding(true);
  };

  // Filtered users for users management tab
  const filteredUsers = useMemo(() => {
    return usersList.filter(user => {
      if (usersFilter === 'active' && user.isBlocked) return false;
      if (usersFilter === 'blocked' && !user.isBlocked) return false;
      if (usersSearch.trim()) {
        const q = usersSearch.trim().toLowerCase();
        const matchName = user.name?.toLowerCase().includes(q);
        const matchUser = user.username?.toLowerCase().includes(q.replace(/^@+/, ''));
        if (!matchName && !matchUser) return false;
      }
      return true;
    });
  }, [usersList, usersFilter, usersSearch]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col md:flex-row relative" dir="rtl">
      {/* Mobile Top Navbar (shown only on small screens) */}
      <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2.5 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all active:scale-95"
            aria-label="القائمة الجانبية"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-brand-emerald p-1.5 rounded-xl text-white shadow-xs">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs font-black text-slate-800 leading-tight">لوحة التحكم</h1>
              <span className="text-[10px] text-brand-emerald font-bold">
                {activeTab === 'STANDARD' ? 'المتشابهات' : activeTab === 'COMPLETION' ? 'تكملة الآية' : activeTab === 'SURAH' ? 'اسم السورة' : activeTab === 'users' ? 'إدارة المستخدمين' : 'المشرفين'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onBackHome}
            className="p-2 rounded-xl bg-brand-gold/15 text-brand-emerald hover:bg-brand-gold/25 transition-all"
            title="الرئيسية"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all"
            title="خروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Backdrop for Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Right-hand in RTL) */}
      <aside className={`
        fixed md:sticky top-0 right-0 z-50 md:z-30 h-screen
        w-72 md:w-80 bg-white/95 md:bg-white/90 backdrop-blur-xl border-l border-slate-200/80
        flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Top Header of Sidebar */}
        <div className="p-5 md:p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-brand-emerald p-2.5 rounded-2xl shadow-lg shadow-brand-emerald/20 text-white flex-shrink-0">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-800 leading-tight">إدارة المتشابهات</h2>
                <p className="text-[10px] font-black text-slate-400 tracking-wider uppercase">لوحة التحكم المركزية</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Logged In Admin Profile Card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/70 shadow-xs">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 ${
              isCurrentUserFounder ? 'bg-amber-500 shadow-amber-500/20' : isCurrentUserCoFounder ? 'bg-indigo-600 shadow-indigo-600/20' : 'bg-brand-emerald shadow-emerald-500/20'
            }`}>
              {isCurrentUserFounder ? <Crown className="w-5 h-5" /> : isCurrentUserCoFounder ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <div className="flex flex-col text-right leading-tight min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs md:text-sm font-black text-slate-800 truncate">
                  {currentName || (currentUsername ? (currentUsername.startsWith('@') ? currentUsername : `@${currentUsername}`) : 'المشرف')}
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black shrink-0 ${
                  isCurrentUserFounder 
                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                    : isCurrentUserCoFounder 
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {isCurrentUserFounder ? 'المؤسس' : isCurrentUserCoFounder ? 'مساعد مؤسس' : 'مشرف'}
                </span>
              </div>
              {currentUsername && (
                <span className="text-[10px] text-slate-400 font-mono font-medium truncate mt-0.5" dir="ltr">
                  {currentUsername.startsWith('@') ? currentUsername : `@${currentUsername}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6">
          {/* Section 1: Challenges & Questions */}
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-3 mb-2 block">
              أقسام الأسئلة والتحديات
            </span>
            <div className="space-y-1.5">
              {/* المتشابهات */}
              {(!localSettings.hideAudioChallenge || (isFounderAlaa && activeTab === 'STANDARD')) && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('STANDARD');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs md:text-sm font-black transition-all ${
                    activeTab === 'STANDARD'
                      ? 'bg-brand-emerald text-white shadow-lg shadow-brand-emerald/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4" />
                    <span>المتشابهات</span>
                  </div>
                  {localSettings.hideAudioChallenge && isFounderAlaa && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black">مخفي 🔒</span>
                  )}
                </button>
              )}

              {/* تكملة الآية */}
              {(!localSettings.hideCompletionChallenge || (isFounderAlaa && activeTab === 'COMPLETION')) && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('COMPLETION');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs md:text-sm font-black transition-all ${
                    activeTab === 'COMPLETION'
                      ? 'bg-brand-emerald text-white shadow-lg shadow-brand-emerald/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Edit2 className="w-4 h-4" />
                    <span>تكملة الآية</span>
                  </div>
                  {localSettings.hideCompletionChallenge && isFounderAlaa && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black">مخفي 🔒</span>
                  )}
                </button>
              )}

              {/* اسم السورة */}
              {(!localSettings.hideSurahChallenge || (isFounderAlaa && activeTab === 'SURAH')) && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('SURAH');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs md:text-sm font-black transition-all ${
                    activeTab === 'SURAH'
                      ? 'bg-brand-emerald text-white shadow-lg shadow-brand-emerald/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Hash className="w-4 h-4" />
                    <span>اسم السورة</span>
                  </div>
                  {localSettings.hideSurahChallenge && isFounderAlaa && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black">مخفي 🔒</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Management & System */}
          {(canManageUsersTab || canSeeAdminsTab) && (
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-3 mb-2 block">
                الإدارة والنظام
              </span>
              <div className="space-y-1.5">
                {/* إدارة المستخدمين */}
                {canManageUsersTab && (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setActiveTab('users');
                      setIsMobileSidebarOpen(false);
                      fetchUsers(usersSearch);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs md:text-sm font-black transition-all ${
                      activeTab === 'users'
                        ? 'bg-brand-emerald text-white shadow-lg shadow-brand-emerald/20'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4" />
                      <span>إدارة المستخدمين</span>
                    </div>
                    {usersList.length > 0 && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {usersList.length}
                      </span>
                    )}
                  </button>
                )}

                {/* المشرفين والصلاحيات */}
                {canSeeAdminsTab && (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setActiveTab('admins');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs md:text-sm font-black transition-all ${
                      activeTab === 'admins'
                        ? 'bg-brand-emerald text-white shadow-lg shadow-brand-emerald/20'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4" />
                      <span>المشرفين والصلاحيات</span>
                    </div>
                    {admins.length > 0 && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        activeTab === 'admins' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {admins.length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 md:p-5 border-t border-slate-100 space-y-2">
          <button
            type="button"
            onClick={onBackHome}
            className="w-full flex items-center justify-center gap-2 p-3 bg-brand-gold/15 text-brand-emerald rounded-2xl font-black text-xs md:text-sm hover:bg-brand-gold/25 transition-all active:scale-98"
          >
            <Home className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 p-3 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-98"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 min-h-screen p-4 md:p-8 overflow-x-hidden">
        {/* Top Action Bar in Main Area (when viewing Questions tabs) */}
        {activeTab !== 'admins' && activeTab !== 'users' && (
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 md:p-5 rounded-2xl md:rounded-[2rem] border border-slate-200/80 shadow-xs">
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-800">
                {activeTab === 'STANDARD' ? 'تحدي المتشابهات القرآنية' : activeTab === 'COMPLETION' ? 'تحدي تكملة الآية' : 'تحدي معرفة اسم السورة'}
              </h2>
              <p className="text-xs text-slate-400 font-bold">
                إدارة بنك الأسئلة والآيات وتعديلها أو حذفها
              </p>
            </div>

            <button
              onClick={() => {
                setType(activeTab as any);
                setIsAdding(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-brand-emerald text-white rounded-2xl font-black text-xs md:text-sm shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>
                إضافة {activeTab === 'STANDARD' ? 'متشابهات' : activeTab === 'COMPLETION' ? 'تكملة' : 'سورة'}
              </span>
            </button>
          </div>
        )}

        <main className="max-w-6xl mx-auto">
        {activeTab === 'users' ? (
          canManageUsersTab ? (
            <div className="space-y-6">
              {/* Top Banner / Header */}
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 text-brand-emerald flex items-center justify-center shadow-xs shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg md:text-xl font-black text-slate-800">إدارة المستخدمين وحسابات اللاعبين</h3>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black border border-emerald-200">
                        خاص بالمؤسس والمساعدين المصرح لهم
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                      تعديل بيانات اللاعبين، تغيير النقاط والكؤوس، تعيين كلمات المرور، أو حظر وحذف الحسابات
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fetchUsers(usersSearch)}
                  disabled={usersLoading}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
                  <span>تحديث القائمة</span>
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-800">{usersList.length}</div>
                    <div className="text-xs font-bold text-slate-400">إجمالي الحسابات المسجلة</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-emerald-600">
                      {usersList.filter(u => !u.isBlocked).length}
                    </div>
                    <div className="text-xs font-bold text-slate-400">حسابات نشطة ومفعلة</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <UserX className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-red-600">
                      {usersList.filter(u => u.isBlocked).length}
                    </div>
                    <div className="text-xs font-bold text-slate-400">حسابات محظورة من الدخول</div>
                  </div>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchUsers(usersSearch);
                    }}
                    placeholder="ابحث بالاسم أو اسم المستخدم (@username)..."
                    className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold outline-none focus:border-brand-emerald transition-all"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-100/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setUsersFilter('all')}
                    className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                      usersFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    الكل ({usersList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsersFilter('active')}
                    className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                      usersFilter === 'active' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    النشطة ({usersList.filter(u => !u.isBlocked).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsersFilter('blocked')}
                    className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                      usersFilter === 'blocked' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    المحظورة ({usersList.filter(u => u.isBlocked).length})
                  </button>
                </div>
              </div>

              {/* Users List Container */}
              {usersLoading ? (
                <div className="py-20 text-center bg-white rounded-[2rem] border border-slate-100 shadow-xs">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-emerald/30 mx-auto mb-3" />
                  <p className="text-slate-400 font-bold text-sm">جاري تحميل بيانات المستخدمين...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 shadow-xs">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-700 font-black text-base">لا يوجد مستخدمين مطابقين</p>
                  <p className="text-slate-400 font-bold text-xs mt-1">تأكد من دقة البحث أو الفلاتر المحددة</p>
                </div>
              ) : (
                <>
                  {/* Desktop View: Table (hidden md:block) */}
                  <div className="hidden md:block bg-white rounded-[2rem] border border-slate-200/90 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-50/90 border-b border-slate-100 text-slate-400 font-black text-xs uppercase tracking-wider">
                            <th className="py-4 px-6">المستخدم</th>
                            <th className="py-4 px-4">الحالة</th>
                            <th className="py-4 px-4 text-center">النقاط ⭐</th>
                            <th className="py-4 px-4 text-center">الكؤوس 🏆</th>
                            <th className="py-4 px-4">الإنجازات</th>
                            <th className="py-4 px-4">تاريخ الانضمام</th>
                            <th className="py-4 px-6 text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {filteredUsers.map(user => (
                            <tr 
                              key={user.id} 
                              className={`hover:bg-slate-50/80 transition-colors ${user.isBlocked ? 'bg-red-50/20' : ''}`}
                            >
                              {/* User Info */}
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="relative shrink-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                                      user.isBlocked ? 'bg-red-100 text-red-600' : 'bg-brand-emerald/10 text-brand-emerald'
                                    }`}>
                                      {user.name?.charAt(0) || 'م'}
                                    </div>
                                    {user.activeFrame && (
                                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-xs" title="إطار مخصص مفعّل" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-black text-slate-800 text-sm truncate leading-tight">
                                      {user.name}
                                    </div>
                                    <div className="text-xs font-mono font-bold text-slate-400 truncate mt-0.5" dir="ltr">
                                      @{user.username?.replace(/^@+/, '')}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-4 px-4 whitespace-nowrap">
                                <span className={`text-[10px] px-2.5 py-1 rounded-full font-black inline-flex items-center gap-1 ${
                                  user.isBlocked 
                                    ? 'bg-red-100 text-red-700 border border-red-200' 
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {user.isBlocked ? 'محظور من الدخول 🚫' : 'نشط ومفعل'}
                                </span>
                              </td>

                              {/* Points */}
                              <td className="py-4 px-4 text-center whitespace-nowrap">
                                <span className="font-black font-mono text-brand-emerald text-sm">
                                  {user.points.toLocaleString('ar-EG')}
                                </span>
                              </td>

                              {/* Cups */}
                              <td className="py-4 px-4 text-center whitespace-nowrap">
                                <span className="font-black font-mono text-amber-600 text-sm">
                                  {user.cups.toLocaleString('ar-EG')}
                                </span>
                              </td>

                              {/* Achievements */}
                              <td className="py-4 px-4">
                                <div className="flex flex-wrap items-center gap-1">
                                  {user.seerahCompleted && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-black border border-emerald-100 whitespace-nowrap">
                                      🏆 السيرة
                                    </span>
                                  )}
                                  {user.generalCompleted && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-black border border-blue-100 whitespace-nowrap">
                                      ⭐ عامة
                                    </span>
                                  )}
                                  {user.quranCompleted && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-black border border-amber-100 whitespace-nowrap">
                                      📖 قرآن
                                    </span>
                                  )}
                                  {!user.seerahCompleted && !user.generalCompleted && !user.quranCompleted && (
                                    <span className="text-slate-300 text-xs font-bold">-</span>
                                  )}
                                </div>
                              </td>

                              {/* Joined Date */}
                              <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-500 font-bold">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : '-'}
                              </td>

                              {/* Actions */}
                              <td className="py-4 px-6 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* Edit Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUser(user);
                                      setEditUserName(user.name);
                                      setEditUserUsername(user.username?.replace(/^@+/, '') || '');
                                      setEditUserPoints(user.points);
                                      setEditUserCups(user.cups);
                                    }}
                                    className="p-2 rounded-xl bg-slate-50 hover:bg-brand-emerald/10 text-slate-500 hover:text-brand-emerald transition-all"
                                    title="تعديل بيانات الحساب والنقاط"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>

                                  {/* Reset Password Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResetPasswordUser(user);
                                      setNewUserPassword('');
                                      setShowPasswordText(false);
                                    }}
                                    className="p-2 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-all"
                                    title="إعادة تعيين كلمة المرور"
                                  >
                                    <KeyRound className="w-4 h-4" />
                                  </button>

                                  {/* Block / Unblock Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBlockUser(user)}
                                    disabled={isTogglingBlock === user.id}
                                    className={`p-2 rounded-xl transition-all ${
                                      user.isBlocked
                                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    }`}
                                    title={user.isBlocked ? 'إلغاء الحظر والسماح بالدخول' : 'حظر اللاعب ومنعه من تسجيل الدخول'}
                                  >
                                    {isTogglingBlock === user.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : user.isBlocked ? (
                                      <UserCheck className="w-4 h-4" />
                                    ) : (
                                      <UserX className="w-4 h-4" />
                                    )}
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(user)}
                                    disabled={isDeletingUser === user.id}
                                    className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30"
                                    title="حذف الحساب نهائياً"
                                  >
                                    {isDeletingUser === user.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile View: Cards Grid (block md:hidden) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
                    {filteredUsers.map(user => (
                      <motion.div
                        key={user.id}
                        layout
                        className={`bg-white p-5 rounded-[2rem] border shadow-xs flex flex-col justify-between gap-4 transition-all ${
                          user.isBlocked
                            ? 'border-red-200 bg-red-50/20'
                            : 'border-slate-200/90 hover:border-brand-emerald/30 hover:shadow-md'
                        }`}
                      >
                        {/* Top: Avatar, Name, Username, Block Status */}
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base ${
                                  user.isBlocked ? 'bg-red-100 text-red-600' : 'bg-brand-emerald/10 text-brand-emerald'
                                }`}>
                                  {user.name?.charAt(0) || 'م'}
                                </div>
                                {user.activeFrame && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border border-white shadow-xs" title="إطار مخصص مفعّل" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <h4 className="font-black text-slate-800 text-sm md:text-base truncate leading-tight">
                                  {user.name}
                                </h4>
                                <span className="text-xs font-mono font-bold text-slate-400 truncate block mt-0.5" dir="ltr">
                                  @{user.username?.replace(/^@+/, '')}
                                </span>
                              </div>
                            </div>

                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-black shrink-0 ${
                              user.isBlocked 
                                ? 'bg-red-100 text-red-700 border border-red-200' 
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {user.isBlocked ? 'محظور من الدخول 🚫' : 'نشط ومفعل'}
                            </span>
                          </div>

                          {/* Score & Badges */}
                          <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs font-black">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                              <span>النقاط:</span>
                              <span className="text-brand-emerald font-black font-mono">{user.points}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>الكؤوس:</span>
                              <span className="text-amber-600 font-black font-mono">{user.cups}</span>
                            </div>
                          </div>

                          {/* Achievements tags */}
                          <div className="flex flex-wrap items-center gap-1 mt-2.5">
                            {user.seerahCompleted && (
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-black border border-emerald-100">
                                🏆 السيرة
                              </span>
                            )}
                            {user.generalCompleted && (
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-black border border-blue-100">
                                ⭐ عامة
                              </span>
                            )}
                            {user.quranCompleted && (
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-black border border-amber-100">
                                📖 قرآن
                              </span>
                            )}
                            {user.createdAt && (
                              <span className="text-[9px] text-slate-400 font-bold mr-auto">
                                انضم: {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons Row */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          {/* Edit Info Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(user);
                              setEditUserName(user.name);
                              setEditUserUsername(user.username?.replace(/^@+/, '') || '');
                              setEditUserPoints(user.points);
                              setEditUserCups(user.cups);
                            }}
                            className="flex-1 py-2 px-2.5 rounded-xl bg-slate-50 hover:bg-brand-emerald/10 text-slate-600 hover:text-brand-emerald font-black text-xs transition-all flex items-center justify-center gap-1.5"
                            title="تعديل بيانات الحساب والنقاط"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

                          {/* Reset Password Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setResetPasswordUser(user);
                              setNewUserPassword('');
                              setShowPasswordText(false);
                            }}
                            className="flex-1 py-2 px-2.5 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-600 font-black text-xs transition-all flex items-center justify-center gap-1.5"
                            title="إعادة تعيين كلمة المرور"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>كلمة المرور</span>
                          </button>

                          {/* Block / Unblock Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleBlockUser(user)}
                            disabled={isTogglingBlock === user.id}
                            className={`p-2 rounded-xl text-xs font-black transition-all ${
                              user.isBlocked
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                            title={user.isBlocked ? 'إلغاء الحظر والسماح بالدخول' : 'حظر اللاعب ومنعه من تسجيل الدخول'}
                          >
                            {isTogglingBlock === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : user.isBlocked ? (
                              <UserCheck className="w-4 h-4" />
                            ) : (
                              <UserX className="w-4 h-4" />
                            )}
                          </button>

                          {/* Delete User Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={isDeletingUser === user.id}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all text-xs font-black disabled:opacity-30"
                            title="حذف الحساب نهائياً"
                          >
                            {isDeletingUser === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 shadow-xs">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-black text-base">ليس لديك صلاحية للوصول إلى قسم إدارة المستخدمين</p>
              <p className="text-slate-400 font-bold text-xs mt-1">يتطلب هذا القسم تفويضاً خاصاً من المؤسس (علاء)</p>
            </div>
          )
        ) : activeTab !== 'admins' ? (
          <>
            {/* Founder Alaa's Global Challenge Visibility Control - Collapsible Dropdown */}
            {isFounderAlaa && (
              <div className="mb-8 rounded-2xl md:rounded-[2rem] bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border border-amber-300/40 shadow-sm overflow-hidden transition-all">
                {/* Header / Dropdown Trigger */}
                <button
                  type="button"
                  onClick={() => setIsSettingsDropdownOpen(prev => !prev)}
                  className="w-full p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-right hover:bg-amber-500/5 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                      <Crown className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base md:text-lg font-black text-slate-800">إدارة ظهور التحديات للعامة</h3>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black border border-amber-200">
                          خاص بالمؤسس علاء (ID: 5)
                        </span>
                      </div>
                      <p className="text-[11px] md:text-xs text-slate-500 font-bold mt-0.5">
                        إخفاء أو إظهار التحديات من الشريط العلوي وشاشات التحدي مع بقاء كافة البيانات المضافة محفوظة
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-auto">
                    {/* Status Badges */}
                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black">
                      <span className={`px-2 py-0.5 rounded-lg border ${localSettings.hideAudioChallenge ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        المتشابهات: {localSettings.hideAudioChallenge ? 'مخفي' : 'ظاهر'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg border ${localSettings.hideCompletionChallenge ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        التكملة: {localSettings.hideCompletionChallenge ? 'مخفي' : 'ظاهر'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg border ${localSettings.hideSurahChallenge ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        السورة: {localSettings.hideSurahChallenge ? 'مخفي' : 'ظاهر'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-100/80 hover:bg-amber-100 text-amber-900 text-xs font-black border border-amber-200 shadow-sm transition-all">
                      <span>{isSettingsDropdownOpen ? 'طي القائمة' : 'تعديل خيارات الظهور'}</span>
                      <motion.div
                        animate={{ rotate: isSettingsDropdownOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-4 h-4 text-amber-700" />
                      </motion.div>
                    </div>
                  </div>
                </button>

                {/* Dropdown Body */}
                <AnimatePresence>
                  {isSettingsDropdownOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="border-t border-amber-200/60 p-4 md:p-6 bg-white/70"
                    >
                      {/* Explanatory Banner */}
                      <div className="mb-4 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between gap-2">
                        <span>
                          💡 <strong>تنبيه المؤسس:</strong> عند إخفاء أي تحدي يختفي فوراً من شاشات التحدي للعامة ومن الشريط العلوي لإدارة المشرفين، وتبقى جميع الأسئلة والتحديات المضافة محفوظة بالكامل في قاعدة البيانات دون أي حذف.
                        </span>
                        {isUpdatingSettings && (
                          <div className="flex items-center gap-1.5 text-amber-700 shrink-0">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>جاري الحفظ...</span>
                          </div>
                        )}
                      </div>

                      {/* Toggles Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Audio / Similar Challenge Toggle */}
                        <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          localSettings.hideAudioChallenge 
                            ? 'bg-red-50/70 border-red-200 text-red-900' 
                            : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                        }`}>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-black flex items-center gap-2">
                                🎤 المتشابهات والتحدي الصوتي
                              </span>
                              <button
                                type="button"
                                disabled={isUpdatingSettings}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSetting('hideAudioChallenge', !localSettings.hideAudioChallenge);
                                }}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${
                                  localSettings.hideAudioChallenge ? 'bg-red-500' : 'bg-brand-emerald'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                  localSettings.hideAudioChallenge ? '-translate-x-6' : 'translate-x-0'
                                }`} />
                              </button>
                            </div>
                            <div className="text-[11px] font-bold mb-3">
                              {localSettings.hideAudioChallenge ? (
                                <span className="text-red-600">❌ مخفي من الشريط العلوي والتحديات</span>
                              ) : (
                                <span className="text-brand-emerald">✅ متاح وظاهر للجميع</span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              resetForm();
                              setActiveTab('STANDARD');
                            }}
                            className="mt-2 w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-all flex items-center justify-center gap-1.5"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>إدارة وإضافة الأسئلة</span>
                          </button>
                        </div>

                        {/* Completion Challenge Toggle */}
                        <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          localSettings.hideCompletionChallenge 
                            ? 'bg-red-50/70 border-red-200 text-red-900' 
                            : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                        }`}>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-black flex items-center gap-2">
                                ✍️ تحدي إكمال الآية
                              </span>
                              <button
                                type="button"
                                disabled={isUpdatingSettings}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSetting('hideCompletionChallenge', !localSettings.hideCompletionChallenge);
                                }}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${
                                  localSettings.hideCompletionChallenge ? 'bg-red-500' : 'bg-brand-emerald'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                  localSettings.hideCompletionChallenge ? '-translate-x-6' : 'translate-x-0'
                                }`} />
                              </button>
                            </div>
                            <div className="text-[11px] font-bold mb-3">
                              {localSettings.hideCompletionChallenge ? (
                                <span className="text-red-600">❌ مخفي من الشريط العلوي والتحديات</span>
                              ) : (
                                <span className="text-brand-emerald">✅ متاح وظاهر للجميع</span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              resetForm();
                              setActiveTab('COMPLETION');
                            }}
                            className="mt-2 w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-all flex items-center justify-center gap-1.5"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>إدارة وإضافة الأسئلة</span>
                          </button>
                        </div>

                        {/* Surah Challenge Toggle */}
                        <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          localSettings.hideSurahChallenge 
                            ? 'bg-red-50/70 border-red-200 text-red-900' 
                            : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                        }`}>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-black flex items-center gap-2">
                                📖 تحدي اسم السورة
                              </span>
                              <button
                                type="button"
                                disabled={isUpdatingSettings}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSetting('hideSurahChallenge', !localSettings.hideSurahChallenge);
                                }}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${
                                  localSettings.hideSurahChallenge ? 'bg-red-500' : 'bg-brand-emerald'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                  localSettings.hideSurahChallenge ? '-translate-x-6' : 'translate-x-0'
                                }`} />
                              </button>
                            </div>
                            <div className="text-[11px] font-bold mb-3">
                              {localSettings.hideSurahChallenge ? (
                                <span className="text-red-600">❌ مخفي من الشريط العلوي والتحديات</span>
                              ) : (
                                <span className="text-brand-emerald">✅ متاح وظاهر للجميع</span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              resetForm();
                              setActiveTab('SURAH');
                            }}
                            className="mt-2 w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-all flex items-center justify-center gap-1.5"
                          >
                            <Hash className="w-3.5 h-3.5" />
                            <span>إدارة وإضافة الأسئلة</span>
                          </button>
                        </div>
                      </div>

                      {/* Collapse Button */}
                      <div className="mt-4 pt-3 border-t border-amber-200/40 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setIsSettingsDropdownOpen(false)}
                          className="px-4 py-1.5 rounded-xl bg-amber-100/60 hover:bg-amber-100 text-amber-800 text-xs font-black transition-all flex items-center gap-1.5"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>إغلاق القائمة المنسدلة</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <AnimatePresence>
              {isAdding && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-[3rem] shadow-2xl border border-slate-200 mb-10 overflow-hidden"
                >
                  <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={resetForm}
                        className="flex items-center gap-2 text-slate-500 hover:text-brand-emerald transition-all py-2 font-bold text-sm group"
                      >
                        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        <span>رجوع</span>
                      </button>
                      <div className="w-px h-6 bg-slate-200" />
                      <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                        <Edit2 className="w-5 h-5 text-brand-emerald" />
                        {editingId ? 'تعديل التحدي' : `إضافة تحدي ${type === 'STANDARD' ? 'متشابهات' : type === 'COMPLETION' ? 'تكملة آية' : 'اسم سورة'}`}
                      </h3>
                    </div>
                    <button onClick={resetForm} className="p-2 hover:bg-slate-200 rounded-full transition-all"><X className="w-5 h-5 text-slate-400" /></button>
                  </div>

                  <div className="p-8 space-y-10">
                    


                    {/* STANDARD FORM (Mutashabihat) */}
                    {type === 'STANDARD' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-4 mb-6">
                          <div className="relative">
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">الكلمة المفتاحية (بداية الآيات)</label>
                            <input
                              type="text"
                              value={keyword}
                              onChange={(e) => setKeyword(e.target.value)}
                              placeholder="مثل: يا أيها الذين آمنوا"
                              className="w-full px-6 py-4 rounded-2xl bg-slate-100/50 border-2 border-transparent focus:border-brand-emerald outline-none font-bold text-lg transition-all"
                            />
                          </div>
                          <div className="flex items-end">
                            <button 
                              onClick={handleFetchMatches}
                              disabled={!keyword.trim() || isSearching}
                              className="h-[60px] px-8 bg-brand-gold text-brand-emerald rounded-2xl font-black shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center gap-3"
                            >
                              {isSearching ? <div className="w-4 h-4 border-2 border-brand-emerald border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
                              بحث عن تطابقات
                            </button>
                          </div>
                        </div>

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
                        
                        {/* Verses List */}
                        <div className="space-y-6 pt-6 border-t border-slate-100">
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
                    )}



                    {/* COMPLETION FORM */}
                    {type === 'COMPLETION' && (
                      <div className="bg-brand-emerald/5 border border-brand-emerald/10 p-6 rounded-3xl space-y-6">
                        <h4 className="text-sm font-black text-brand-emerald uppercase tracking-widest mb-4">نموذج تكملة الآية</h4>
                        
                        {/* Search Ayah Tool */}
                        <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 space-y-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mr-2 tracking-widest">البحث السريع في القرآن (اختياري)</label>
                          <div className="flex gap-3">
                            <div className="relative flex-1">
                              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="ابحث عن آية..."
                                className="w-full pl-6 pr-12 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-brand-emerald focus:bg-white outline-none font-bold text-lg transition-all"
                              />
                            </div>
                            <button 
                              onClick={handleSearchCompletionAyahs}
                              disabled={!searchQuery.trim() || isSearching}
                              className="px-8 bg-brand-emerald text-white rounded-2xl font-black shadow-lg hover:bg-brand-emerald/90 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                              <span>بحث</span>
                            </button>
                          </div>

                          {suggestions.length > 0 && type === 'COMPLETION' && (
                            <div className="pt-4 border-t border-slate-50">
                              <h5 className="text-[10px] font-black text-brand-emerald uppercase mb-3 mr-2">نتائج البحث ({suggestions.length}) - اضغط للإكمال التلقائي</h5>
                              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                {suggestions.map((s, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setKeyword(s.text);
                                      setSuggestions([]);
                                      setSearchQuery('');
                                    }}
                                    className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:border-brand-emerald hover:text-brand-emerald transition-all quran-text text-right"
                                  >
                                    {s.text}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-slate-500 uppercase mr-2 tracking-widest">نص بداية الآية</label>
                          <textarea
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="نص الآية الذي سيظهر للمستخدم..."
                            className="w-full px-6 py-4 h-24 rounded-2xl bg-white border-2 border-slate-200 focus:border-brand-emerald outline-none font-bold text-lg quran-text"
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-slate-500 uppercase mr-2 tracking-widest">خيارات التكملة (حدد الإجابة الصحيحة)</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[0, 1, 2, 3].map((index) => (
                              <div key={index} className="relative group">
                                <input
                                  type="text"
                                  value={typeof options[index] === 'object' ? (options[index]?.text || '') : (options[index] || '')}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    const oldVal = options[index];
                                    const newOptions = [...options];
                                    
                                    if (typeof oldVal === 'object') {
                                      newOptions[index] = { ...oldVal, text: newVal };
                                    } else {
                                      newOptions[index] = newVal;
                                    }
                                    
                                    setOptions(newOptions);
                                    
                                    // Sync correctText if this was the selected one
                                    const oldText = typeof oldVal === 'object' ? oldVal.text : oldVal;
                                    if (correctText === oldText && oldText !== '') {
                                      setCorrectText(newVal);
                                    }
                                  }}
                                  placeholder={`الخيار ${index + 1}`}
                                  className={`w-full pl-14 pr-6 py-4 rounded-2xl bg-white border-2 outline-none font-bold text-lg quran-text transition-all ${
                                    (typeof options[index] === 'object' ? options[index].text === correctText : options[index] === correctText) && correctText !== ''
                                      ? 'border-brand-emerald bg-brand-emerald/5 shadow-inner'
                                      : 'border-slate-200 focus:border-brand-emerald'
                                  }`}
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
                                  <input 
                                    type="radio"
                                    name="correctOption"
                                    checked={correctIndex === index}
                                    onChange={() => {
                                      setCorrectIndex(index);
                                      setCorrectText(typeof options[index] === 'string' ? options[index] : options[index].text);
                                    }}
                                    className="w-6 h-6 cursor-pointer accent-brand-emerald"
                                    title="تحديد كإجابة صحيحة"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SURAH FORM */}
                    {type === 'SURAH' && (
                      <div className="bg-brand-emerald/5 border border-brand-emerald/10 p-6 rounded-3xl space-y-6">
                        <h4 className="text-sm font-black text-brand-emerald uppercase tracking-widest mb-4">نموذج التعرّف على السورة</h4>
                        
                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-slate-500 uppercase mr-2 tracking-widest">نص الآية</label>
                          <textarea
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="نص الآية كاملة..."
                            className="w-full px-6 py-4 h-24 rounded-2xl bg-white border-2 border-slate-200 focus:border-brand-emerald outline-none font-bold text-lg quran-text"
                          />
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mr-2 tracking-widest">أسماء السور الصحيحة</label>
                            <button
                              onClick={() => setCorrectSurahs([...correctSurahs, ''])}
                              className="flex items-center gap-2 text-xs font-black text-brand-emerald hover:bg-brand-emerald/10 px-3 py-1 rounded-lg transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              إضافة سورة أخرى
                            </button>
                          </div>
                          <div className="space-y-3">
                            {correctSurahs.map((surah, index) => (
                              <div key={index} className="relative flex items-center gap-2">
                                <input
                                  type="text"
                                  value={surah}
                                  onChange={(e) => {
                                    const newSurahs = [...correctSurahs];
                                    newSurahs[index] = e.target.value;
                                    setCorrectSurahs(newSurahs);
                                  }}
                                  placeholder={`اسم السورة ${index + 1}...`}
                                  className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-slate-200 focus:border-brand-emerald outline-none font-bold text-lg"
                                />
                                {correctSurahs.length > 1 && (
                                  <button
                                    onClick={() => setCorrectSurahs(correctSurahs.filter((_, i) => i !== index))}
                                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    

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
              ) : challenges.filter(c => ((c.type === 'AUDIO' || !c.type) ? 'STANDARD' : c.type) === activeTab).map(c => (
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
                      {activeTab === 'STANDARD' && (
                        <div className="flex items-center gap-1.5 text-brand-emerald font-black text-[10px] uppercase tracking-wider">
                          <List className="w-3 h-3" />
                          <span>{c.verses.length} آيات</span>
                        </div>
                      )}
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
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
                       {activeTab === 'STANDARD' ? 'تحدي المتشابهات' : activeTab === 'COMPLETION' ? 'تكملة الآية' : 'اسم السورة'}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-brand-emerald group-hover:text-white transition-all">
                      <ChevronDown className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                    </div>
                  </div>
                </motion.div>
              ))}

              {!loading && challenges.filter(c => ((c.type === 'AUDIO' || !c.type) ? 'STANDARD' : c.type) === activeTab).length === 0 && (
                <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 shadow-sm">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-black text-base">لا توجد أسئلة أو تحديات في هذا القسم حالياً</p>
                  <p className="text-slate-400 font-bold text-xs mt-1">كافة البيانات والأسئلة محفوظة بأمان في قاعدة البيانات، ويمكنك الضغط على زر الإضافة لإضافة المزيد.</p>
                </div>
              )}
            </div>

          </>
        ) : canSeeAdminsTab ? (
          <div className="space-y-8">
            {/* Admins Header with Action Buttons */}
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 text-brand-emerald flex items-center justify-center shadow-xs shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-800">إدارة المشرفين والصلاحيات</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    التحكم في حسابات المشرفين وتعديل الصلاحيات وإدارة أكواد الدعوة
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {/* زر إضافة مشرف جديد */}
                <button
                  type="button"
                  onClick={() => setIsAddAdminModalOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-brand-emerald text-white rounded-2xl font-black text-xs md:text-sm shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة مشرف جديد</span>
                </button>

                {/* زر أكواد الدعوة */}
                {(isCurrentUserFounder || isCurrentUserCoFounder) && (
                  <button
                    type="button"
                    onClick={() => setIsInviteCodesModalOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs md:text-sm shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                  >
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>أكواد الدعوة</span>
                    {inviteCodes.filter(c => !c.isUsed).length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-emerald text-white font-black">
                        {inviteCodes.filter(c => !c.isUsed).length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Admins List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminLoading ? (
                <div className="col-span-full py-10 text-center text-slate-400 font-bold">جاري تحميل المشرفين...</div>
              ) : admins
                  .filter(admin => {
                    const isThisFounder = admin.role === 'FOUNDER' || admin.username.toLowerCase() === 'alaa' || admin.username === 'علاء';
                    if (isThisFounder && !isCurrentUserFounder) return false;
                    return true;
                  })
                  .map(admin => {
                const isThisFounder = admin.role === 'FOUNDER' || admin.username.toLowerCase() === 'alaa' || admin.username === 'علاء';
                const isThisCoFounder = admin.role === 'CO_FOUNDER';
                
                // Permission checks
                const canDeleteThisAdmin = !isThisFounder && (isCurrentUserFounder || (isCurrentUserCoFounder && !isThisCoFounder));
                const canChangeThisPassword = isCurrentUserFounder || (isCurrentUserCoFounder && !isThisFounder && !isThisCoFounder);

                return (
                  <motion.div
                    key={admin.id}
                    layout
                    className={`bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between gap-4 transition-all ${
                      isThisFounder 
                        ? 'border-amber-300 ring-2 ring-amber-100 bg-gradient-to-br from-amber-50/40 via-white to-white' 
                        : isThisCoFounder
                          ? 'border-indigo-200 ring-1 ring-indigo-50 bg-gradient-to-br from-indigo-50/20 via-white to-white'
                          : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 w-full">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          isThisFounder ? 'bg-amber-100 text-amber-600 shadow-sm' : isThisCoFounder ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'bg-brand-emerald/10 text-brand-emerald'
                        }`}>
                          {isThisFounder ? <Crown className="w-6 h-6 text-amber-600" /> : isThisCoFounder ? <Shield className="w-6 h-6 text-indigo-600" /> : <Users className="w-6 h-6 text-brand-emerald" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-slate-800 text-base flex items-center gap-2 flex-wrap">
                            <span>{admin.name || admin.username}</span>
                            <span className="text-xs text-brand-emerald font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100" dir="ltr">
                              {admin.username.startsWith('@') ? admin.username : `@${admin.username}`}
                            </span>
                            {isThisFounder && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-black border border-amber-200">
                                المؤسس
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] mt-0.5">
                            {isThisFounder ? (
                              <span className="text-amber-600 font-black">👑 صلاحيات كاملة (محمي)</span>
                            ) : isThisCoFounder ? (
                              <span className="text-indigo-600 font-bold">🛡️ مساعد مؤسس</span>
                            ) : (
                              <span className="text-slate-400 font-bold">مشرف محتوى عادي</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Change Password Button */}
                        {canChangeThisPassword && (
                          <button
                            onClick={() => {
                              setChangingPasswordAdmin(admin);
                              setNewPasswordVal('');
                            }}
                            title="تغيير كلمة المرور لهذا المشرف"
                            className="p-3 text-slate-400 hover:text-brand-emerald hover:bg-brand-emerald/10 transition-colors bg-slate-50 rounded-xl"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Button or Protected Lock */}
                        {isThisFounder ? (
                          <div 
                            title="حساب المؤسس محمي تماماً ولا يمكن حذفه"
                            className="p-3 text-amber-500 bg-amber-50 rounded-xl cursor-not-allowed border border-amber-200/50"
                          >
                            <Lock className="w-4 h-4" />
                          </div>
                        ) : canDeleteThisAdmin ? (
                          <button
                            onClick={() => handleDeleteAdmin(admin.id)}
                            disabled={isDeletingAdmin !== null}
                            title="حذف هذا المشرف"
                            className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors bg-slate-50 rounded-xl disabled:opacity-30"
                          >
                            {isDeletingAdmin === admin.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        ) : (
                          <div 
                            title="ليس لديك صلاحية لحذف هذا المشرف"
                            className="p-3 text-slate-200 bg-slate-50 rounded-xl cursor-not-allowed"
                          >
                            <Lock className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Co-Founder Users Management Permission Toggle (Founder Alaa only) */}
                    {isThisCoFounder && isFounderAlaa && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80 -mx-6 -mb-6 p-4 rounded-b-[2rem]">
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-black text-slate-700">صلاحية إدارة المستخدمين:</span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {admin.canManageUsers ? 'متاح له تعديل وحظر وحذف اللاعبين' : 'محجوب عن إدارة المستخدمين'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleCoFounderUserPermission(admin)}
                          disabled={isTogglingPermission === admin.id}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 shadow-xs ${
                            admin.canManageUsers 
                              ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600' 
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {isTogglingPermission === admin.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : admin.canManageUsers ? (
                            'مفعلة ✅'
                          ) : (
                            'معطلة ❌'
                          )}
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

          </div>
        ) : (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 shadow-sm">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-black text-base">ليس لديك صلاحية للوصول إلى إدارة المشرفين</p>
          </div>
        )}
      </main>
      </div>

      {/* Add Admin Modal Window */}
      <AnimatePresence>
        {isAddAdminModalOpen && (
          <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 text-brand-emerald flex items-center justify-center shadow-xs">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg">إضافة مشرف جديد</h4>
                    <p className="text-xs text-slate-400 font-bold">إنشاء حساب جديد للوصول إلى لوحة التحكم</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddAdminModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                await handleAddAdmin(e);
                setIsAddAdminModalOpen(false);
              }} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mr-2">الاسم الكامل / المستعار</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="w-full px-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-emerald transition-all font-bold text-sm"
                      placeholder="مثال: أحمد محمد"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mr-2">اسم المستخدم</label>
                  <div className="relative flex items-center">
                    <span className="absolute right-4 text-brand-emerald font-black text-base select-none z-10 pointer-events-none">@</span>
                    <input
                      type="text"
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value.replace(/@/g, '').trim())}
                      className="w-full pl-10 pr-9 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-emerald transition-all font-bold text-sm font-mono text-left"
                      dir="ltr"
                      placeholder="username"
                      required
                    />
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-slate-400 mr-2 font-medium">علامة @ تضاف تلقائياً في بداية اسم المستخدم</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mr-2">كلمة المرور</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      type="password"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="w-full px-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-emerald transition-all font-bold text-sm"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {isCurrentUserFounder ? (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mr-2">صلاحية الحساب</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setNewAdminRole('ADMIN')}
                        className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${newAdminRole === 'ADMIN' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Users className="w-4 h-4 text-slate-400" />
                        مشرف عادي
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAdminRole('CO_FOUNDER')}
                        className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${newAdminRole === 'CO_FOUNDER' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Shield className="w-4 h-4" />
                        مساعد مؤسس
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 font-bold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    بصفتك مساعد مؤسس، سيتم إنشاء الحساب بصلاحية: <strong>مشرف عادي</strong>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isAddingAdmin || !newAdminUsername || !newAdminPassword}
                    className="flex-1 py-3.5 bg-brand-emerald text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAddingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الإضافة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddAdminModalOpen(false)}
                    className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Codes Modal Window / Interface */}
      <AnimatePresence>
        {isInviteCodesModalOpen && (
          <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-3xl w-full shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs shrink-0">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg md:text-xl">واجهة أكواد الدعوة (Invitation Codes)</h4>
                    <p className="text-xs text-slate-400 font-bold">توليد أكواد دعوة للمشرفين الجدد وإدارتها</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsInviteCodesModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Generator Actions */}
              <div className="py-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
                <span className="text-xs font-black text-slate-600">توليد كود دعوة جديد:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => generateInviteCode('ADMIN')}
                    disabled={inviteLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs shadow-md hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>كود مشرف عادي</span>
                  </button>

                  {isCurrentUserFounder && (
                    <button
                      onClick={() => generateInviteCode('CO_FOUNDER')}
                      disabled={inviteLoading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      <span>كود مساعد مؤسس</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Codes Table List */}
              <div className="flex-1 overflow-y-auto py-4">
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-right border-collapse text-xs md:text-sm">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3.5">الكود</th>
                        <th className="px-5 py-3.5">الصلاحية</th>
                        <th className="px-5 py-3.5 text-center">الحالة</th>
                        <th className="px-5 py-3.5">تاريخ الإنشاء</th>
                        <th className="px-5 py-3.5 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inviteCodes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-slate-400 font-bold italic">لا توجد أكواد مولدة بعد</td>
                        </tr>
                      ) : inviteCodes.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5 border-l border-slate-100 font-mono font-black text-brand-emerald">
                            <div className="flex items-center gap-2">
                              <span className="bg-brand-emerald/5 px-2.5 py-1 rounded-lg border border-brand-emerald/10 select-all">
                                {c.code}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(c.code);
                                  setCopiedCodeId(c.id);
                                  setTimeout(() => setCopiedCodeId(null), 2000);
                                }}
                                className="p-1.5 text-slate-400 hover:text-brand-emerald hover:bg-brand-emerald/10 rounded-lg transition-colors"
                                title="نسخ الكود"
                              >
                                {copiedCodeId === c.id ? <Check className="w-3.5 h-3.5 text-brand-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                              c.role === 'CO_FOUNDER' || c.role === 'SUPERADMIN' 
                                ? 'bg-indigo-100 text-indigo-700' 
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {c.role === 'CO_FOUNDER' || c.role === 'SUPERADMIN' ? 'مساعد مؤسس' : 'مشرف عادي'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {c.isUsed ? (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-400 text-[10px] font-black rounded-full">تم استخدامه</span>
                            ) : (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">متاح</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-500 font-medium">
                            {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              onClick={() => deleteInviteCode(c.id)}
                              disabled={inviteLoading}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                              title="حذف الكود"
                            >
                              {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsInviteCodesModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs transition-all"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {changingPasswordAdmin && (
          <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 flex items-center justify-center text-brand-emerald">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg">تعديل كلمة المرور</h4>
                    <p className="text-xs text-slate-400 font-bold">للمشرف: {changingPasswordAdmin.username}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setChangingPasswordAdmin(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-2">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة (4 أحرف فأكثر)"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-brand-emerald transition-all"
                    required
                    minLength={4}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPassword || !newPasswordVal.trim()}
                    className="flex-1 py-3.5 bg-brand-emerald text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ كلمة المرور'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangingPasswordAdmin(null)}
                    className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 text-brand-emerald flex items-center justify-center shadow-xs">
                    <Edit2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg">تعديل بيانات المستخدم</h4>
                    <p className="text-xs text-slate-400 font-bold">تعديل الاسم، المعرف، النقاط والكؤوس</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingUser(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-600 mr-1">الاسم الكامل / المستعار</label>
                  <input
                    type="text"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-brand-emerald transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-600 mr-1">اسم المستخدم (@username)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editUserUsername}
                      onChange={(e) => setEditUserUsername(e.target.value)}
                      dir="ltr"
                      className="w-full px-4 py-3 pl-8 bg-slate-50 border border-slate-200 rounded-2xl font-bold font-mono outline-none focus:border-brand-emerald transition-all text-left"
                      required
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">@</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-600 mr-1 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>النقاط</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editUserPoints}
                      onChange={(e) => setEditUserPoints(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-brand-emerald transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-600 mr-1 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>الكؤوس</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editUserCups}
                      onChange={(e) => setEditUserCups(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-brand-emerald transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSavingUser}
                    className="flex-1 py-3.5 bg-brand-emerald text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التغييرات'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetPasswordUser && (
          <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg">إعادة تعيين كلمة المرور</h4>
                    <p className="text-xs text-slate-400 font-bold truncate">
                      للمستخدم: {resetPasswordUser.name} (@{resetPasswordUser.username?.replace(/^@+/, '')})
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setResetPasswordUser(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResetUserPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-600 mr-1">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? "text" : "password"}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور الجديدة"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-brand-emerald transition-all pl-12"
                      required
                      minLength={4}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(p => !p)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                    >
                      {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isResettingPassword || !newUserPassword.trim()}
                    className="flex-1 py-3.5 bg-brand-emerald text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isResettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تحديث كلمة المرور'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetPasswordUser(null)}
                    className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
