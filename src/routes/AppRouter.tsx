import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RotateCcw, CheckCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

import { LeaderboardPage } from '../pages/LeaderboardPage';
import { GroupCreatePage } from '../pages/GroupCreatePage';
import { GroupWaitingPage } from '../pages/GroupWaitingPage';
import { GroupJoinPage } from '../pages/GroupJoinPage';
import { GroupGameResultsPage } from '../pages/GroupGameResultsPage';
import { SpeedChallengePage } from '../pages/SpeedChallengePage';
import { ChallengesHubPage } from '../pages/ChallengesHubPage';
import { SkillsCountSelectionPage } from '../pages/SkillsCountSelectionPage';
import { SkillsResultsPage } from '../pages/SkillsResultsPage';
import { HomePage } from '../pages/HomePage';
import { LibraryHubPage } from '../pages/LibraryHubPage';
import { AyahsListPage } from '../pages/AyahsListPage';
import { MushafPage } from '../pages/MushafPage';
import { AdhkarPage } from '../pages/AdhkarPage';
import { HadithPage } from '../pages/HadithPage';
import { ChallengeGamePage } from '../pages/ChallengeGamePage';
import { DailyChestChallengePage } from '../pages/DailyChestChallengePage';

import SettingsView from '../components/Settings/SettingsView';
import SkillsMenu from '../components/SkillsMenu';
import BookReader from '../components/BookReader';
import Encyclopedia from '../components/Encyclopedia';
import { IslamicVideos } from '../components/IslamicVideos';
import IslamicQuiz from '../components/IslamicQuiz';
import { CertificatePreviewPage } from '../pages/CertificatePreviewPage';

export const AppRouter: React.FC = () => {
  const app = useApp();

  if (app.challengesLoading && app.challenges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-brand-emerald font-black animate-pulse">يتم استظهار الآيات...</p>
      </div>
    );
  }

  if (app.challengesError && app.challenges.length === 0) {
    return (
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
            onClick={() => app.fetchChallenges()}
            disabled={app.challengesLoading}
            className="px-10 py-4 bg-brand-emerald text-white rounded-2xl font-black shadow-lg hover:bg-brand-emerald/90 transition-all flex items-center gap-3 disabled:opacity-50"
          >
            {app.challengesLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-5 h-5" />}
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
    );
  }

  const isCertRoute = typeof window !== 'undefined' && (
    window.location.pathname === '/certificate' ||
    window.location.pathname.startsWith('/certificate/') ||
    window.location.pathname === '/achievements' ||
    window.location.pathname.startsWith('/achievements/') ||
    new URLSearchParams(window.location.search).get('view') === 'certificate' ||
    new URLSearchParams(window.location.search).get('view') === 'achievements' ||
    new URLSearchParams(window.location.search).get('preview') === 'certificate'
  );

  if (isCertRoute) {
    return (
      <CertificatePreviewPage
        onBack={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
            window.location.href = '/';
          }
        }}
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
      {app.showScores ? (
        <LeaderboardPage
          syncLeaderboard={app.syncLeaderboard}
          isSyncing={app.isSyncing}
          totalUsersCount={app.totalUsersCount}
          leaderboard={app.leaderboard}
          playerName={app.playerName}
          userLeaderboardRank={app.userLeaderboardRank}
          streak={app.streak}
          userAchievement={app.userAchievement}
          achievementStyles={app.achievementStyles}
          equippedNameColor={app.equippedNameColor}
          onOpenPlayerProfile={app.handleOpenPlayerProfile}
        />
      ) : app.view === "group_create" ? (
        <GroupCreatePage
          v1RoomName={app.v1RoomName}
          setV1RoomName={app.setV1RoomName}
          v1IsPrivate={app.v1IsPrivate}
          setV1IsPrivate={app.setV1IsPrivate}
          showPasswordText={app.showPasswordText}
          setShowPasswordText={app.setShowPasswordText}
          v1RoomPassword={app.v1RoomPassword}
          setV1RoomPassword={app.setV1RoomPassword}
          v1GameModes={app.v1GameModes}
          setV1GameModes={app.setV1GameModes}
          systemSettings={app.systemSettings}
          availableSkillCounts={app.availableSkillCounts}
          skillQuestionCounts={app.skillQuestionCounts}
          setSkillQuestionCounts={app.setSkillQuestionCounts}
          whoAmIQuestionCount={app.whoAmIQuestionCount}
          selectedWhoAmICategories={app.selectedWhoAmICategories}
          setSelectedWhoAmICategories={app.setSelectedWhoAmICategories}
          whoAmIAvailableCategories={app.whoAmIAvailableCategories}
          whoAmICategoryCounts={app.whoAmICategoryCounts}
          setWhoAmICategoryCounts={app.setWhoAmICategoryCounts}
          totalConfiguredQuestions={app.totalConfiguredQuestions}
          islamicRoomCategories={app.islamicRoomCategories}
          islamicRoomLevels={app.islamicRoomLevels}
          islamicRoomTopics={app.islamicRoomTopics}
          islamicTopicQuestionCounts={app.islamicTopicQuestionCounts}
          setShowIslamicConfigModal={app.setShowIslamicConfigModal}
          hasCountValidationErrors={app.hasCountValidationErrors}
          v1Timer={app.v1Timer}
          setV1Timer={app.setV1Timer}
          v1TimePerQuestion={app.v1TimePerQuestion}
          setV1TimePerQuestion={app.setV1TimePerQuestion}
          v1TransitionMode={app.v1TransitionMode}
          setV1TransitionMode={app.setV1TransitionMode}
          handleCreateV1={app.handleCreateV1}
          isCreatingRoom={app.isCreatingRoom}
          setView={app.setView}
          roomScopeMode={app.roomScopeMode}
          setRoomScopeMode={app.setRoomScopeMode}
          roomSelectedJuzs={app.roomSelectedJuzs}
          setRoomSelectedJuzs={app.setRoomSelectedJuzs}
          roomSelectedSurahs={app.roomSelectedSurahs}
          setRoomSelectedSurahs={app.setRoomSelectedSurahs}
          roomSurahSearch={app.roomSurahSearch}
          setRoomSurahSearch={app.setRoomSurahSearch}
        />
      ) : app.view === "group_waiting" ? (
        <GroupWaitingPage
          room={app.room}
          playerUsername={app.playerUsername}
          playerName={app.playerName}
          equippedNameColor={app.equippedNameColor}
          handleStartRoomV1={app.handleStartRoomV1}
          v1IsStartingRoom={app.v1IsStartingRoom}
          handleCancelRoomByHost={app.handleCancelRoomByHost}
          setView={app.setView}
          setRoom={app.setRoom}
          setIsResignModalOpen={app.setIsResignModalOpen}
        />
      ) : app.view === "group_join" ? (
        <GroupJoinPage
          setView={app.setView}
          fetchAvailableRooms={app.fetchAvailableRooms}
          isLoadingRooms={app.isLoadingRooms}
          isRefreshing={app.isPullRefreshing}
          availableRooms={app.availableRooms}
          setRooms={app.setRooms || app.setAvailableRooms}
          playerUsername={app.playerUsername}
          playerName={app.playerName}
          handleJoinV1={app.handleJoinV1}
          setPrivateRoomModal={app.setPrivateRoomModal}
          isJoiningRoom={app.isJoiningRoom}
        />
      ) : app.view === "group_game" ? (
        <GroupGameResultsPage
          room={app.room}
          playerUsername={app.playerUsername}
          playerName={app.playerName}
          setRoom={app.setRoom}
          setView={app.setView}
          onCancelRoom={() => app.setIsCancelRoomModalOpen(true)}
          onWithdraw={() => app.setIsResignModalOpen(true)}
        />
      ) : app.view === "speed_challenge" ? (
        <SpeedChallengePage
          speedTimeLeft={app.speedTimeLeft}
          currentChallenge={app.currentChallenge}
          speedTotalTimeSpent={app.speedTotalTimeSpent}
          isSpeedGameOver={app.isSpeedGameOver}
          handleStartSpeedChallenge={app.handleStartSpeedChallenge}
          setView={app.setView}
          room={app.room}
          hasAnsweredCurrentQuestion={app.hasAnsweredCurrentQuestion}
          handleExecuteFreezeTime={app.handleExecuteFreezeTime}
          freezeTimeCount={app.freezeTimeCount}
          isPowerUpUsedThisQuestion={app.isPowerUpUsedThisQuestion}
          isFreezeActive={app.isFreezeActive}
          handleExecuteDeleteTwo={app.handleExecuteDeleteTwo}
          deleteTwoCount={app.deleteTwoCount}
          eliminatedOptionIndices={app.eliminatedOptionIndices}
          skillsType={app.skillsType}
          KEYWORD={app.KEYWORD}
          totalPoints={app.totalPoints}
          targetVerses={app.targetVerses}
          matchedIds={app.matchedIds}
          isListening={app.isListening}
          stopListening={app.stopListening}
          startListening={app.startListening}
          keywordWordCount={app.keywordWordCount}
          wordStates={app.wordStates}
          surahInputs={app.surahInputs}
          setSurahInputs={app.setSurahInputs}
          handleSurahInputChange={app.handleSurahInputChange}
          handleSubmitSurah={app.handleSubmitSurah}
          skillsFeedback={app.skillsFeedback}
          surahFeedbackData={app.surahFeedbackData}
          skillsOptions={app.skillsOptions}
          selectedOption={app.selectedOption}
          handleOptionSelect={app.handleOptionSelect}
          handleConfirmAnswer={app.handleConfirmAnswer}
          skillsCorrectAnswer={app.skillsCorrectAnswer}
          playerUsername={app.playerUsername}
          playerName={app.playerName}
        />
      ) : app.view === 'skills_menu' || app.view === 'speed_menu' ? (
        <motion.div
          key="skills_menu"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="max-w-4xl mx-auto py-10 px-4"
        >
          <SkillsMenu
            onSelectMode={(mode) => {
              app.setSkillsType(mode);
              app.setView('skills_count_selection');
            }}
            onBack={() => app.setView('home')}
            title={app.isSpeedMode ? 'تحدي السرعة' : 'تحدي المهارات'}
            subtitle={app.isSpeedMode ? 'أسرع في الإجابة واجمع النقاط' : 'اختر التحدي الذي تفضله'}
            hideAudio={app.systemSettings.hideAudioChallenge}
            hideComplete={app.systemSettings.hideCompletionChallenge}
            hideSurah={app.systemSettings.hideSurahChallenge}
          />
        </motion.div>
      ) : app.view === "skills_count_selection" ? (
        <SkillsCountSelectionPage
          skillsType={app.skillsType}
          selectedSkillCount={app.selectedSkillCount}
          setSelectedSkillCount={app.setSelectedSkillCount}
          skillsScopeMode={app.skillsScopeMode}
          setSkillsScopeMode={app.setSkillsScopeMode}
          selectedSkillJuzs={app.selectedSkillJuzs}
          setSelectedSkillJuzs={app.setSelectedSkillJuzs}
          skillSurahSearch={app.skillSurahSearch}
          setSkillSurahSearch={app.setSkillSurahSearch}
          selectedSkillSurahs={app.selectedSkillSurahs}
          setSelectedSkillSurahs={app.setSelectedSkillSurahs}
          filteredSurahsList={app.filteredSurahsList}
          handleStartSkillsSession={app.handleStartSkillsSession}
          setView={app.setView}
        />
      ) : app.view === "skills_results" ? (
        <SkillsResultsPage
          sessionCorrect={app.sessionCorrect}
          sessionScore={app.sessionScore}
          sessionWrong={app.sessionWrong}
          skillsType={app.skillsType}
          totalPoints={app.totalPoints}
          cups={app.cups}
          sessionMistakes={app.sessionMistakes}
          showMistakes={app.showMistakes}
          setShowMistakes={app.setShowMistakes}
          setView={app.setView}
        />
      ) : app.view === 'settings' ? (
        <SettingsView
          playerName={app.playerName}
          playerUsername={app.playerUsername}
          totalPoints={app.totalPoints}
          cups={app.cups}
          activeFrame={app.activeFrame}
          showProfileDecoration={app.showProfileDecoration}
          setShowProfileDecoration={app.setShowProfileDecoration}
          userCertificates={app.userCertificates}
          onOpenCertificate={(cat) => {
            app.setSelectedCategory(cat);
            app.setShowCertificate(true);
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
              name: app.playerName || 'علاء'
            };
            const filtered = app.userCertificates.filter((c: any) => c.category !== cat);
            const updated = [...filtered, certEntry];
            app.setUserCertificates(updated);
            localStorage.setItem('quran_user_certificates', JSON.stringify(updated));

            app.setActiveFrame(cat);
            app.setIsNameDecorated(true);
            app.setShowProfileDecoration(true);
            localStorage.setItem('quran_active_frame', cat);
            localStorage.setItem('quran_name_decorated', 'true');
            localStorage.setItem('quran_show_decoration', 'true');

            if (app.playerUsername || app.playerName) {
              fetch('/api/player-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: app.playerName,
                  username: app.playerUsername,
                  seerahCompleted: cat === 'seerah' || app.userCertificates.some((c: any) => c.category === 'seerah'),
                  generalCompleted: cat === 'general' || app.userCertificates.some((c: any) => c.category === 'general'),
                  activeFrame: cat
                })
              }).then(() => app.syncLeaderboard()).catch(err => console.error('Frame sync failed:', err));
            }

            app.setSelectedCategory(cat);
            app.setShowCertificate(true);
          }}
          onSelectFrame={(frame) => {
            const cleanFrame = (frame === 'seerah' || frame === 'general') ? frame : null;
            app.setActiveFrame(cleanFrame);
            if (cleanFrame) {
              app.setIsNameDecorated(true);
              app.setShowProfileDecoration(true);
              localStorage.setItem('quran_active_frame', cleanFrame);
              localStorage.setItem('quran_name_decorated', 'true');
              localStorage.setItem('quran_show_decoration', 'true');
            } else {
              app.setIsNameDecorated(false);
              app.setShowProfileDecoration(false);
              localStorage.removeItem('quran_active_frame');
              localStorage.removeItem('quran_name_decorated');
              localStorage.removeItem('quran_show_decoration');
            }

            if (app.playerUsername || app.playerName) {
              fetch('/api/player-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: app.playerName,
                  username: app.playerUsername,
                  activeFrame: cleanFrame
                })
              }).then(() => app.syncLeaderboard()).catch(err => console.error('Frame select sync failed:', err));
            }
          }}
          onLogout={app.handlePlayerLogout}
          onBackToHome={() => app.setView('home')}
          onUpdatePlayer={(name, username) => {
            app.setPlayerName(name);
            app.setPlayerUsername(username);
            localStorage.setItem('quran_player_name', name);
            localStorage.setItem('quran_player_username', username);
          }}
          onStartQuizCategory={(_cat) => {
            app.setView('islamic_quiz');
          }}
          onOpenDownloadApp={() => app.setShowDownloadModal(true)}
          onOpenPrivacyPolicy={(tab) => {
            app.setPrivacyModalInitialTab(tab || 'privacy');
            app.setShowPrivacyModal(true);
          }}
          canAccessAdmin={
            app.adminRole === 'FOUNDER' ||
            app.adminRole === 'CO_FOUNDER' ||
            (!!app.playerUsername && ['alaa', 'علاء', 'founder'].includes(app.playerUsername.toLowerCase())) ||
            (!!app.playerName && ['alaa', 'علاء'].includes(app.playerName.trim().toLowerCase()))
          }
          onOpenAdminPanel={() => app.setView('admin')}
        />
      ) : app.view === "home" ? (
        <HomePage
          activeRunningRoom={app.activeRunningRoom}
          handleResumeActiveRoom={app.handleResumeActiveRoom}
          playerName={app.playerName}
          isElite={app.isElite}
          isNameDecorated={app.isNameDecorated}
          currentStyle={app.currentStyle}
          motivationalQuote={app.motivationalQuote}
          streak={app.streak}
          cups={app.cups}
          totalPoints={app.totalPoints}
          completedChallengeIds={app.completedChallengeIds}
          setIsOccasionsModalOpen={app.setIsOccasionsModalOpen}
          nearestOccasion={app.nearestOccasion}
          lastPlayedDate={app.lastPlayedDate}
          dailyCompleted={app.dailyCompleted}
          setView={app.setView}
          streakInfo={app.streakInfo}
          handleStartDaily={app.handleStartDaily}
          systemSettings={app.systemSettings}
          isNativeApp={app.isNativeApp}
          testerStatus={app.testerStatus}
          setShowGooglePlayModal={app.setShowGooglePlayModal}
        />
      ) : app.view === "challenges" ? (
        <ChallengesHubPage
          setView={app.setView}
          incompleteChallenge={app.incompleteChallenge}
          setChallengeMode={app.setChallengeMode}
          setCurrentChallengeIndex={app.setCurrentChallengeIndex}
          dailyCompleted={app.dailyCompleted}
          handleStartDaily={app.handleStartDaily}
          timeLeft={app.timeLeft}
          setIsSpeedMode={app.setIsSpeedMode}
          systemSettings={app.systemSettings}
          dailyChallenge={app.currentChallenge || (app.challenges && app.challenges[app.dailyChallengeIndex])}
          userId={app.playerId || app.uniquePlayerId || app.playerUsername || app.playerName}
          activeRunningRoom={app.activeRunningRoom}
          handleResumeActiveRoom={app.handleResumeActiveRoom}
        />
      ) : app.view === "library" ? (
        <LibraryHubPage
          setView={app.setView}
          setSelectedSurahId={app.setSelectedSurahId}
          setSelectedJuz={app.setSelectedJuz}
          setIsSearchSubmitted={app.setIsSearchSubmitted}
          setIsPageModeActive={app.setIsPageModeActive}
          setSelectedAdhkarCategoryId={app.setSelectedAdhkarCategoryId}
          setSelectedHadith={app.setSelectedHadith}
          systemSettings={app.systemSettings}
        />
      ) : app.view === "list" ? (
        <AyahsListPage
          setView={app.setView}
          activeListTab={app.activeListTab}
          setActiveListTab={app.setActiveListTab}
          challenges={app.challenges}
          completedChallengeIds={app.completedChallengeIds}
          setCurrentChallengeIndex={app.setCurrentChallengeIndex}
          setDifficulty={app.setDifficulty}
          setIncompleteChallenge={app.setIncompleteChallenge}
        />
      ) : app.challengeMode === 'daily' && app.dailyCompleted ? (
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
            {app.timeLeft}
          </div>
          <button
            onClick={() => {
              app.setChallengeMode('normal');
              app.setCurrentChallengeIndex(0);
              app.setView('home');
            }}
            className="group relative px-10 py-5 bg-brand-emerald text-white rounded-3xl font-black text-lg hover:bg-brand-emerald/90 transition-all shadow-2xl hover:scale-105 active:scale-95"
          >
            <span className="relative z-10">استمر بالتحديات الحرة</span>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 rounded-b-3xl group-hover:h-full transition-all duration-300 opacity-0 group-hover:opacity-10" />
          </button>
        </motion.div>
      ) : app.view === "mushaf" ? (
        <MushafPage
          isPageModeActive={app.isPageModeActive}
          setIsPageModeActive={app.setIsPageModeActive}
          selectedSurahId={app.selectedSurahId}
          setSelectedSurahId={app.setSelectedSurahId}
          selectedJuz={app.selectedJuz}
          setSelectedJuz={app.setSelectedJuz}
          isSearchSubmitted={app.isSearchSubmitted}
          setIsSearchSubmitted={app.setIsSearchSubmitted}
          librarySettings={app.librarySettings}
          setIsSettingsOpen={app.setIsSettingsOpen}
          currentPage={app.currentPage}
          setCurrentPage={app.setCurrentPage}
          isMushafFeaturesModalOpen={app.isMushafFeaturesModalOpen}
          setIsMushafFeaturesModalOpen={app.setIsMushafFeaturesModalOpen}
          isSurahMenuOpen={app.isSurahMenuOpen}
          setIsSurahMenuOpen={app.setIsSurahMenuOpen}
          isJuzMenuOpen={app.isJuzMenuOpen}
          setIsJuzMenuOpen={app.setIsJuzMenuOpen}
          searchQuery={app.searchQuery}
          setSearchQuery={app.setSearchQuery}
          mushafZoomScale={app.mushafZoomScale}
          setMushafZoomScale={app.setMushafZoomScale}
          pageTurnDirection={app.pageTurnDirection}
          setPageTurnDirection={app.setPageTurnDirection}
          enterMushafFullscreen={app.enterMushafFullscreen}
          selectedAyah={app.selectedAyah}
          setSelectedAyah={app.setSelectedAyah}
          setView={app.setView}
        />
      ) : app.view === "adhkar" ? (
        <AdhkarPage
          adhkarSearchQuery={app.adhkarSearchQuery}
          setAdhkarSearchQuery={app.setAdhkarSearchQuery}
          selectedAdhkarCategoryId={app.selectedAdhkarCategoryId}
          setSelectedAdhkarCategoryId={app.setSelectedAdhkarCategoryId}
          adhkarProgress={app.adhkarProgress}
          setAdhkarProgress={app.setAdhkarProgress}
          setIsSettingsOpen={app.setIsSettingsOpen}
          handleBackToHome={app.handleBackToHome}
        />
      ) : app.view === "hadith" ? (
        <HadithPage
          setSelectedHadith={app.setSelectedHadith}
          setIsSettingsOpen={app.setIsSettingsOpen}
          handleBackToHome={app.handleBackToHome}
        />
      ) : app.view === 'book' ? (
        <motion.div
          key="book"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="w-full"
        >
          <BookReader onBack={() => app.setView('home')} darkMode={app.librarySettings.darkMode} />
        </motion.div>
      ) : app.view === 'encyclopedia' ? (
        <motion.div
          key="encyclopedia"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="w-full"
        >
          <Encyclopedia onBack={() => app.setView('home')} darkMode={app.librarySettings.darkMode} />
        </motion.div>
      ) : app.view === 'islamic_videos' ? (
        !app.systemSettings.hideIslamicVideos ? (
          <motion.div
            key="islamic_videos"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="w-full"
          >
            <IslamicVideos onBack={() => app.setView('library')} />
          </motion.div>
        ) : (
          <div className="text-center py-24 px-4 max-w-md mx-auto">
            <p className="text-slate-500 font-bold mb-4">هذا القسم غير متاح حالياً.</p>
            <button onClick={() => app.setView('home')} className="px-6 py-2.5 bg-brand-emerald text-white rounded-xl font-black text-sm">
              العودة للرئيسية
            </button>
          </div>
        )
      ) : app.view === 'islamic_quiz' ? (
        <motion.div
          key="islamic_quiz"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="w-full"
        >
          <IslamicQuiz
            onBack={() => app.setView('home')}
            onWin={app.updateStatsAfterWin}
            claimedCategories={app.userCertificates.map((c: any) => c.category)}
            onShowCertificate={(cat) => {
              app.setSelectedCategory(cat);
              app.setShowCertificate(true);
            }}
          />
        </motion.div>
      ) : app.view === 'daily_chest_challenge' ? (
        <motion.div
          key="daily_chest_challenge"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="w-full"
        >
          <DailyChestChallengePage />
        </motion.div>
      ) : (
        <ChallengeGamePage
          currentChallenge={app.currentChallenge}
          setView={app.setView}
          isSpeedMode={app.isSpeedMode}
          room={app.room}
          isFreezeActive={app.isFreezeActive}
          speedTimeLeft={app.speedTimeLeft}
          freezeSecondsLeft={app.freezeSecondsLeft}
          hasAnsweredCurrentQuestion={app.hasAnsweredCurrentQuestion}
          handleExecuteFreezeTime={app.handleExecuteFreezeTime}
          freezeTimeCount={app.freezeTimeCount}
          isPowerUpUsedThisQuestion={app.isPowerUpUsedThisQuestion}
          handleExecuteDeleteTwo={app.handleExecuteDeleteTwo}
          deleteTwoCount={app.deleteTwoCount}
          eliminatedOptionIndices={app.eliminatedOptionIndices}
          challengeMode={app.challengeMode}
          currentChallengeIndex={app.currentChallengeIndex}
          sessionCurrentIndex={app.sessionCurrentIndex}
          challenges={app.challenges}
          skillsType={app.skillsType}
          setSkillsType={app.setSkillsType}
          v1GameModes={app.v1GameModes}
          KEYWORD={app.KEYWORD}
          totalPoints={app.totalPoints}
          handleSkip={app.handleSkip}
          isComplete={app.isComplete}
          saveScore={app.saveScore}
          score={app.score}
          setDailyCompleted={app.setDailyCompleted}
          updateStatsAfterWin={app.updateStatsAfterWin}
          setChallengeMode={app.setChallengeMode}
          isRoomLoading={app.isRoomLoading}
          systemSettings={app.systemSettings}
          targetVerses={app.targetVerses}
          matchedIds={app.matchedIds}
          isListening={app.isListening}
          stopListening={app.stopListening}
          startListening={app.startListening}
          keywordWordCount={app.keywordWordCount}
          wordStates={app.wordStates}
          handlePromptNextChallenge={app.handlePromptNextChallenge}
          handleOpenTafsir={app.handleOpenTafsir}
          surahInputs={app.surahInputs}
          setSurahInputs={app.setSurahInputs}
          handleSurahInputChange={app.handleSurahInputChange}
          handleSubmitSurah={app.handleSubmitSurah}
          skillsFeedback={app.skillsFeedback}
          surahFeedbackData={app.surahFeedbackData}
          skillsOptions={app.skillsOptions}
          selectedOption={app.selectedOption}
          handleOptionSelect={app.handleOptionSelect}
          handleConfirmAnswer={app.handleConfirmAnswer}
          skillsCorrectAnswer={app.skillsCorrectAnswer}
          setRoom={app.setRoom}
          playerUsername={app.playerUsername}
          playerName={app.playerName}
          transcript={app.transcript}
        />
      )}
    </AnimatePresence>
  );
};

