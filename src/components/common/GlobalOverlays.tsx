import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import {
  Flame, X, Quote, AlertCircle, Lock, Loader2, BookOpen, RefreshCw, Smartphone, Share2, Check
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../services/supabase';

import ConfirmModal from '../ConfirmModal';
import { LibrarySettingsModal } from '../LibrarySettingsModal';
import { StreakModal } from '../StreakModal';
import IslamicOccasionsModal from '../IslamicOccasionsModal';
import { GooglePlayTesterModal, GooglePlayLogo } from '../GooglePlayTesterModal';
import AyahActionSheet from '../AyahActionSheet';
import { PrivacyModal } from '../PrivacyModal';
import IslamicRoomConfigModal from '../IslamicRoomConfigModal';
import CertificateGenerator from '../CertificateGenerator';
import { FriendsModal } from '../friends/FriendsModal';
import { PublicProfileModal } from '../profile/PublicProfileModal';
import { RoomInviteModal } from '../friends/RoomInviteModal';

export const GlobalOverlays: React.FC = () => {
  const app = useApp();

  // Body scroll lock for modal dialogs in GlobalOverlays
  React.useEffect(() => {
    const isAnyModalOpen = Boolean(
      app.privateRoomModal?.isOpen ||
      app.showTafsirModal ||
      app.showCertificate ||
      app.isSettingsOpen ||
      app.isStreakModalOpen ||
      app.showDownloadModal ||
      app.showGooglePlayModal ||
      app.showPrivacyModal ||
      app.showIslamicConfigModal
    );

    if (isAnyModalOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [
    app.privateRoomModal?.isOpen,
    app.showTafsirModal,
    app.showCertificate,
    app.isSettingsOpen,
    app.isStreakModalOpen,
    app.showDownloadModal,
    app.showGooglePlayModal,
    app.showPrivacyModal,
    app.showIslamicConfigModal
  ]);

  return (
    <>
      {/* 1. Confetti Celebration */}
      {app.isComplete && (
        <Confetti
          width={app.width}
          height={app.height}
          recycle={false}
          numberOfPieces={400}
          gravity={0.15}
          colors={['#064e3b', '#d4af37', '#fdfbf7', '#10b981']}
        />
      )}

      {/* 2. Floating Streak Flame Badge on Home */}
      {app.view === 'home' && (
        <motion.div
          initial={{ scale: 0, x: 20 }}
          animate={{ scale: 1, x: 0 }}
          onClick={() => app.setIsStreakModalOpen(true)}
          className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 md:bottom-28 md:right-8 z-40 group cursor-pointer"
          title="شعلة الاستمرار اليومية - انقر لعرض التفاصيل"
        >
          <div className="relative">
            {app.streakInfo.status === 'active' && (
              <div className="absolute inset-0 bg-orange-500/30 blur-2xl rounded-full scale-110 streak-pulse" />
            )}
            {app.streakInfo.status === 'warning' && (
              <div className="absolute inset-0 bg-amber-500/40 blur-2xl rounded-full scale-110 animate-pulse" />
            )}
            <div className={`glass p-2 md:p-3 rounded-2xl md:rounded-[2rem] shadow-2xl flex items-center gap-2 md:gap-3 relative z-10 transition-all group-hover:scale-105 border ${
              app.streakInfo.status === 'active'
                ? 'bg-white/95 border-orange-200 shadow-orange-500/10'
                : app.streakInfo.status === 'warning'
                ? 'bg-amber-50/95 border-amber-300 shadow-amber-500/20 animate-pulse'
                : 'bg-white/90 border-slate-200 shadow-slate-900/5'
            }`}>
              <div className={`w-8 h-8 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-md overflow-hidden relative shrink-0 ${
                app.streakInfo.status === 'active'
                  ? 'bg-gradient-to-tr from-orange-600 to-amber-500 shadow-orange-500/30'
                  : app.streakInfo.status === 'warning'
                  ? 'bg-gradient-to-tr from-slate-700 via-amber-700 to-amber-600 shadow-amber-600/30'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
              }`}>
                <Flame className={`w-4 h-4 md:w-5 md:h-5 fill-current relative z-10 ${
                  app.streakInfo.status === 'active'
                    ? 'text-white'
                    : app.streakInfo.status === 'warning'
                    ? 'text-amber-200'
                    : 'text-slate-400 stroke-1'
                }`} />
                <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent" />
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <span className={`text-base md:text-xl font-black tabular-nums block leading-none ${
                    app.streakInfo.status === 'active'
                      ? 'text-orange-600'
                      : app.streakInfo.status === 'warning'
                      ? 'text-amber-800'
                      : 'text-slate-600'
                  }`}>
                    {app.streakInfo.streak}
                  </span>
                  {app.streakInfo.status === 'warning' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  )}
                </div>
                <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block mt-0.5">
                  {app.streakInfo.status === 'active' ? 'أيام متتالية' : app.streakInfo.status === 'warning' ? 'أوشكت على الانطفاء' : 'ابدأ اليوم'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 3. About Modal */}
      <AnimatePresence>
        {app.showAboutModal && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-xl"
            onClick={() => app.setShowAboutModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl md:rounded-[3rem] p-6 md:p-10 max-w-lg w-full shadow-2xl relative overflow-hidden text-center border border-emerald-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => app.setShowAboutModal(false)}
                className="absolute top-4 left-4 p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-md border border-brand-gold/30 p-2">
                <img src="/logo.webp" className="w-full h-full object-contain drop-shadow-sm" alt="شعار متين" />
              </div>

              <div className="flex items-center justify-center mb-1">
                <img src="/matin-title.webp" className="h-9 md:h-10 object-contain drop-shadow-xs" alt="متين" />
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

              {!app.isNativeApp && (
                <div className="flex flex-col gap-2 mb-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      app.setShowAboutModal(false);
                      app.setShowGooglePlayModal(true);
                    }}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2.5 border border-slate-700/80 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    <GooglePlayLogo className="w-5 h-5" />
                    <span>تطبيق متين على Google Play</span>
                    {app.testerStatus === 'approved' && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                        تم القبول ✓
                      </span>
                    )}
                    {app.testerStatus === 'pending' && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
                        قيد المراجعة ⏳
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={app.handleShareApp}
                      className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs md:text-sm border border-slate-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                      title="مشاركة رابط التطبيق"
                    >
                      {app.shareCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>تم نسخ الرابط بنجاح</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 text-slate-600" />
                          <span>مشاركة رابط تطبيق متين</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => app.setShowAboutModal(false)}
                className="w-full py-3.5 bg-brand-emerald text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-[0.98]"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Selected Hadith Modal */}
      <AnimatePresence>
        {app.selectedHadith && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={() => app.setSelectedHadith(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-5 md:p-12 rounded-3xl shadow-2xl transition-all duration-500 theme-transition border ${app.librarySettings.darkMode ? 'lib-dark' : 'bg-white border-slate-100'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => app.setSelectedHadith(null)}
                className="absolute top-4 md:top-8 left-4 md:left-8 p-2 md:p-3 rounded-xl md:rounded-2xl bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all z-20"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              <div className="relative z-10 space-y-8 md:space-y-12 pb-6 md:pb-10" dir="rtl">
                <div className="text-center space-y-3 md:space-y-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-teal-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-xl shadow-teal-600/30">
                    <Quote className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>
                  <h2 className="text-xl md:text-4xl font-black text-teal-900 font-quran px-6">{app.selectedHadith.title}</h2>
                  <div className="h-1 w-16 md:w-24 bg-teal-500/20 rounded-full mx-auto" />
                </div>

                <div className="space-y-6 md:space-y-8">
                  <div className={`p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border shadow-lg transition-colors ${app.librarySettings.darkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white/90 border-slate-200/80 text-slate-900 shadow-md'}`}>
                    <h3 className="text-xs md:text-sm font-black text-teal-600 uppercase tracking-widest mb-4 opacity-80 border-b border-teal-500/20 pb-2">نص الحديث الشريف</h3>
                    <div className="w-full space-y-3" dir="rtl">
                      {app.selectedHadith.hadith
                        .split('\n')
                        .filter((l: string) => l.trim())
                        .slice(1)
                        .map((line: string, i: number) => (
                          <p
                            key={i}
                            className={`text-base sm:text-lg md:text-xl font-bold leading-relaxed md:leading-loose text-justify w-full ${app.librarySettings.darkMode ? 'text-slate-100' : 'text-slate-800'}`}
                            style={{ textAlign: 'justify', textJustify: 'inter-word', textAlignLast: 'right' }}
                          >
                            {line}
                          </p>
                        ))}
                    </div>
                  </div>

                  <div className={`p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border shadow-lg transition-colors ${app.librarySettings.darkMode ? 'bg-teal-950/40 border-teal-900/60 text-slate-100' : 'bg-teal-50/60 border-teal-100 text-slate-900 shadow-md'}`}>
                    <h3 className="text-xs md:text-sm font-black text-teal-600 uppercase tracking-widest mb-4 opacity-80 border-b border-teal-500/20 pb-2">الشرح والفوائد</h3>
                    <div className="w-full space-y-3" dir="rtl">
                      {app.selectedHadith.description
                        .split(/\n\s*\n/)
                        .filter((p: string) => p.trim())
                        .map((paragraph: string, i: number) => (
                          <p
                            key={i}
                            className={`text-sm sm:text-base md:text-xl font-medium leading-relaxed md:leading-loose text-justify w-full ${app.librarySettings.darkMode ? 'text-slate-200' : 'text-slate-800'}`}
                            style={{ textAlign: 'justify', textJustify: 'inter-word', textAlignLast: 'right' }}
                          >
                            {paragraph.split('\n').join(' ')}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-4 md:pt-8">
                  <button
                    onClick={() => app.setSelectedHadith(null)}
                    className="px-10 py-4 md:px-12 md:py-5 bg-teal-600 text-white rounded-2xl md:rounded-3xl font-black text-base md:text-lg shadow-xl shadow-teal-600/30 hover:bg-teal-700 transition-all active:scale-95"
                  >
                    تمت القراءة
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Confirm Modals */}
      <ConfirmModal
        isOpen={app.isExitModalOpen}
        onClose={() => app.setIsExitModalOpen(false)}
        onConfirm={app.confirmExitToHome}
        title="تأكيد الخروج"
        message="هل تريد العودة للرئيسية؟ سيتم فقدان تقدمك الحالي في هذه الآية."
      />

      <ConfirmModal
        isOpen={app.isResignModalOpen}
        onClose={() => app.setIsResignModalOpen(false)}
        onConfirm={app.handleWithdraw || app.handleResignGroupChallenge}
        isLoading={app.isRoomActionLoading}
        title="تأكيد الانسحاب"
        message="هل أنت متأكد من الانسحاب من التحدي؟ ستستمر اللعبة لباقي المتسابقين دون توقف."
        confirmText="تأكيد الانسحاب"
        cancelText="تراجع"
        isDanger={false}
      />

      <ConfirmModal
        isOpen={app.isCancelRoomModalOpen || app.showDeleteModal}
        onClose={() => {
          app.setIsCancelRoomModalOpen(false);
          app.setShowDeleteModal?.(false);
        }}
        onConfirm={app.confirmCancelRoomByHost}
        isLoading={app.isRoomActionLoading}
        title="تأكيد إلغاء الغرفة"
        message="هل أنت متأكد من إلغاء الغرفة؟ سيتم إنهاء التحدي وطرد جميع المتسابقين"
        confirmText="نعم، ألغِ الغرفة"
        cancelText="تراجع"
        isDanger={true}
      />

      <ConfirmModal
        isOpen={app.isNextChallengeModalOpen}
        onClose={() => app.setIsNextChallengeModalOpen(false)}
        onConfirm={app.confirmNextChallenge}
        title="التحدي التالي"
        message="هل أنت مستعد للتحدي التالي؟"
      />

      {/* 6. Settings & Feature Modals */}
      <LibrarySettingsModal
        isOpen={app.isSettingsOpen}
        onClose={() => app.setIsSettingsOpen(false)}
        settings={app.librarySettings}
        setSettings={app.setLibrarySettings}
        showReadingMode={app.view === 'mushaf'}
      />

      <StreakModal
        isOpen={app.isStreakModalOpen}
        onClose={() => app.setIsStreakModalOpen(false)}
        streakInfo={app.streakInfo}
        onStartChallenge={() => {
          app.setIsStreakModalOpen(false);
          if (typeof app.handleStartDaily === 'function') {
            app.handleStartDaily();
          } else if (typeof app.handleStartDailyChallenge === 'function') {
            app.handleStartDailyChallenge();
          }
        }}
      />

      <IslamicOccasionsModal
        isOpen={Boolean(app.isOccasionsModalOpen || app.showIslamicOccasionsModal)}
        onClose={() => {
          if (app.setIsOccasionsModalOpen) app.setIsOccasionsModalOpen(false);
          if (app.setShowIslamicOccasionsModal) app.setShowIslamicOccasionsModal(false);
        }}
        occasions={app.upcomingOccasions || app.occasionsInfo}
        hijriDate={app.hijriDate}
        initialSelectedId={app.nearestOccasion?.id}
      />

      <GooglePlayTesterModal
        isOpen={app.showGooglePlayModal}
        onClose={() => app.setShowGooglePlayModal(false)}
        testerEmail={app.testerEmail}
        setTesterEmail={app.setTesterEmail}
        testerStatus={app.testerStatus}
        testerMessage={app.testerMessage}
        internalTestLink={app.internalTestLink}
        onRegister={app.handleRegisterTester}
        onReset={app.handleResetTesterForm}
        onShareApp={app.handleShareApp}
        shareCopied={app.shareCopied}
        isCheckingSavedStatus={app.isCheckingSavedStatus}
      />

      {app.selectedAyah && (
        <AyahActionSheet
          selectedAyah={app.selectedAyah}
          onClose={() => app.setSelectedAyah(null)}
          onNavigateToPage={(p) => {
            app.setCurrentPage(p);
            app.setSelectedAyah(null);
          }}
          onOpenEncyclopedia={(_s, _a) => {
            app.setSelectedAyah(null);
            app.setView('encyclopedia');
          }}
          darkMode={app.librarySettings.darkMode}
        />
      )}

      <PrivacyModal
        isOpen={app.showPrivacyModal}
        onClose={() => app.setShowPrivacyModal(false)}
        initialTab={app.privacyModalInitialTab}
      />

      <IslamicRoomConfigModal
        isOpen={app.showIslamicConfigModal}
        onClose={() => app.setShowIslamicConfigModal(false)}
        selectedCategories={app.islamicRoomCategories}
        onSelectCategories={app.setIslamicRoomCategories}
        selectedLevels={app.islamicRoomLevels}
        onSelectLevels={app.setIslamicRoomLevels}
        selectedTopics={app.islamicRoomTopics}
        onSelectTopics={app.setIslamicRoomTopics}
        topicQuestionCounts={app.islamicTopicQuestionCounts}
        onUpdateTopicCount={(topic, count) => app.setIslamicTopicQuestionCounts((prev: any) => ({ ...prev, [topic]: count }))}
      />

      {/* Private Room Password Dialog */}
      <AnimatePresence>
        {app.privateRoomModal.isOpen && app.privateRoomModal.room && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-orange-100 text-right space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <button
                  onClick={() => app.setPrivateRoomModal({ isOpen: false, room: null, password: '', error: undefined })}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <h3 className="font-black text-slate-800 text-base md:text-lg">غرفة خاصة محمية</h3>
                    <p className="text-[11px] text-slate-400 font-bold">{app.privateRoomModal.room.name || 'غرفة التحدي'}</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1 text-xs text-slate-600 font-bold">
                <div className="flex justify-between">
                  <span className="text-slate-400">المنشئ:</span>
                  <span className="text-slate-800 font-black">{app.privateRoomModal.room.hostName}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700">
                  أدخل كلمة المرور للانضمام
                </label>
                <input
                  type="password"
                  autoFocus
                  value={app.privateRoomModal.password}
                  onChange={(e) => app.setPrivateRoomModal((prev: any) => ({ ...prev, password: e.target.value, error: undefined }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && app.privateRoomModal.password.trim() && !app.isJoiningRoom) {
                      app.handleJoinV1(app.privateRoomModal.room.id, app.privateRoomModal.password);
                    }
                  }}
                  placeholder="كلمة مرور الغرفة"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none text-slate-800 font-black text-sm text-center shadow-inner"
                />
                {app.privateRoomModal.error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 text-xs font-bold text-red-500 justify-end"
                  >
                    <span>{app.privateRoomModal.error}</span>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  </motion.div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => app.handleJoinV1(app.privateRoomModal.room.id, app.privateRoomModal.password)}
                  disabled={app.isJoiningRoom || !app.privateRoomModal.password.trim()}
                  className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-black text-sm hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {app.isJoiningRoom ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الانضمام'}
                </button>
                <button
                  onClick={() => app.setPrivateRoomModal({ isOpen: false, room: null, password: '', error: undefined })}
                  className="px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Certificate Generator */}
      <AnimatePresence>
        {app.showCertificate && (
          <CertificateGenerator
            category={app.selectedCategory}
            onClose={() => app.setShowCertificate(false)}
            isClaimed={app.userCertificates.some((c: any) => c.category === app.selectedCategory)}
            claimedName={app.userCertificates.find((c: any) => c.category === app.selectedCategory)?.name}
            onSave={(certData) => {
              if (app.userCertificates.some((c: any) => c.category === certData.category)) return;

              const newCerts = [...app.userCertificates, certData];
              app.setUserCertificates(newCerts);
              localStorage.setItem('quran_user_certificates', JSON.stringify(newCerts));

              const category = certData.category === 'seerah' ? 'seerah' : 'general';
              app.setActiveFrame(category);
              if (typeof app.setIsNameDecorated === 'function') app.setIsNameDecorated(true);
              localStorage.setItem('quran_active_frame', category);
              localStorage.setItem('quran_name_decorated', 'true');

              // Direct Supabase Update
              const pUnique = app.uniquePlayerId || localStorage.getItem('quran_unique_player_id');
              const pUser = app.playerUsername || localStorage.getItem('quran_player_username');
              const pName = app.playerName || localStorage.getItem('quran_player_name');
              const pId = app.playerId || localStorage.getItem('quran_player_id');

              if (pUnique || pUser || pName || pId) {
                const upFields: any = {
                  activeFrame: category,
                  updatedAt: new Date().toISOString()
                };
                if (category === 'seerah') upFields.seerahCompleted = true;
                if (category === 'general') upFields.generalCompleted = true;

                let q = supabase.from('players').update(upFields);
                if (pUnique) q = q.eq('uniquePlayerId', pUnique);
                else if (pUser) q = q.eq('username', pUser);
                else if (pName) q = q.eq('name', pName);
                else if (pId && /^\d+$/.test(String(pId))) q = q.eq('id', Number(pId));

                q.then(() => {
                  window.dispatchEvent(new CustomEvent('milestones_updated'));
                  window.dispatchEvent(new CustomEvent('quran_certificates_updated'));
                }, err => console.error('Failed to update Supabase in GlobalOverlays:', err));
              }

              if (app.playerUsername || app.playerName) {
                fetch('/api/player-score', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: app.playerName,
                    username: app.playerUsername,
                    seerahCompleted: category === 'seerah' || app.userCertificates.some((c: any) => c.category === 'seerah'),
                    generalCompleted: category === 'general' || app.userCertificates.some((c: any) => c.category === 'general'),
                    activeFrame: category
                  })
                }).then(() => app.syncLeaderboard()).catch(err => console.error('Certificate save sync failed:', err));
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Tafsir Modal */}
      <AnimatePresence>
        {app.showTafsirModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 md:p-10 shadow-2xl"
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
                {app.tafsirAyahText}
              </p>

              <div className="mt-6 p-5 bg-slate-50 rounded-xl border-r-4 border-emerald-500 w-full text-right" dir="rtl">
                <p className="text-xs font-bold text-slate-500 mb-3">التفسير (الميسر):</p>
                <p
                  className="text-lg md:text-xl text-slate-700 leading-relaxed !font-quran font-normal text-justify !tracking-normal"
                  style={{ letterSpacing: '0', wordSpacing: 'normal', fontFeatureSettings: '"rlig" 1, "calt" 1' }}
                >
                  {app.tafsirData}
                </p>
              </div>

              <button
                onClick={() => app.setShowTafsirModal(false)}
                className="mt-6 md:mt-10 w-full py-4 md:py-5 bg-emerald-600 text-white rounded-xl md:rounded-2xl font-black text-md md:text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
              >
                حسناً، فهمت
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Reconnection Overlay */}
      <AnimatePresence>
        {app.isReconnecting && (app.room || app.view === 'group_waiting' || app.view === 'group_game' || app.view === 'challenge') && (
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

      {/* Floating Toast Notification Banner */}
      <AnimatePresence>
        {app.toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100010] max-w-md w-[90%] pointer-events-none"
            style={{ zIndex: 100010 }}
          >
            <div className={`p-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 border text-white pointer-events-auto ${
              app.toastMessage.type === 'success'
                ? 'bg-emerald-600/95 border-emerald-400 shadow-emerald-500/30'
                : app.toastMessage.type === 'error'
                ? 'bg-red-600/95 border-red-400 shadow-red-500/30'
                : 'bg-slate-800/95 border-slate-600 shadow-slate-900/30'
            }`}>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                {app.toastMessage.type === 'success' ? (
                  <Check className="w-5 h-5 text-white stroke-[2.5]" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-white stroke-[2.5]" />
                )}
              </div>
              <p className="font-bold text-sm sm:text-base leading-snug flex-1">
                {app.toastMessage.message}
              </p>
              <button
                type="button"
                onClick={() => app.setToastMessage?.(null)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. Friends System Modal */}
      <FriendsModal
        isOpen={app.isFriendsModalOpen}
        onClose={() => app.setIsFriendsModalOpen(false)}
        currentPlayer={{
          id: app.playerId,
          name: app.playerName,
          username: app.playerUsername,
          uniquePlayerId: app.uniquePlayerId
        }}
        onOpenPlayerProfile={app.handleOpenPlayerProfile}
        isInRoomLobby={app.view === 'group_waiting'}
      />

      {/* 9. Public Profile Modal */}
      <PublicProfileModal
        isOpen={!!app.selectedProfilePlayer}
        onClose={app.handleClosePlayerProfile}
        targetPlayer={app.selectedProfilePlayer}
        currentViewer={{
          id: app.playerId,
          name: app.playerName,
          username: app.playerUsername,
          uniquePlayerId: app.uniquePlayerId
        }}
      />

      {/* 10. Real-time Central Room Invite Modal */}
      <RoomInviteModal
        invite={app.incomingRoomInvite}
        onAccept={app.handleAcceptRoomInvite}
        onDecline={app.handleDeclineRoomInvite}
        currentPlayer={{
          id: app.playerId,
          name: app.playerName,
          username: app.playerUsername,
          uniquePlayerId: app.uniquePlayerId
        }}
      />
    </>
  );
};

