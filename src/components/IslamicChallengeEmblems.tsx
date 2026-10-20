import React from 'react';

// ==========================================
// 1. CHALLENGES ICONS (واجهة التحديات)
// ==========================================

// Group Challenge (التحدي الجماعي) - اللوغو الجديد
export const GroupChallengeEmblem: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/icons/challenge-group.png"
    alt="التحدي الجماعي"
    className={`${className} object-contain drop-shadow-xs select-none`}
    draggable={false}
  />
);

// Daily Challenge (التحدي اليومي) - اللوغو الجديد
export const DailyChallengeEmblem: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/icons/challenge-daily.png"
    alt="التحدي اليومي"
    className={`${className} object-contain drop-shadow-xs select-none`}
    draggable={false}
  />
);

// Skills Challenge (تحدي المهارات) - اللوغو الجديد
export const SkillsChallengeEmblem: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/icons/challenge-skills.png"
    alt="تحدي المهارات"
    className={`${className} object-contain drop-shadow-xs select-none`}
    draggable={false}
  />
);

// Speed Challenge (تحدي السرعة) - اللوغو الجديد
export const SpeedChallengeEmblem: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/icons/challenge-speed.png"
    alt="تحدي السرعة"
    className={`${className} object-contain drop-shadow-xs select-none`}
    draggable={false}
  />
);

// Islamic Quiz (تحدي معلومات إسلامية) - اللوغو الجديد
export const IslamicQuizEmblem: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/icons/challenge-quiz.png"
    alt="تحدي معلومات إسلامية"
    className={`${className} object-contain drop-shadow-xs select-none`}
    draggable={false}
  />
);

// ==========================================
// 2. LIBRARY ICONS (واجهة المكتبة والعلوم الشرعية)
// ==========================================

// Mushaf (المصحف الشريف) - أيقونة المصحف الشريف المعتمدة
export const MushafLibraryIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/icons/mushaf-icon.png"
    alt="المصحف الشريف"
    className={`${className} object-contain drop-shadow-xs select-none`}
    draggable={false}
  />
);

// Adhkar (أذكار المسلم) - Authentic Islamic Tasbih / Prayer Beads & Crescent
export const AdhkarLibraryIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="48" height="48" rx="14" fill="#EEF2FF" />
    {/* Crescent Moon in center */}
    <path
      d="M26 15C22.6863 15 20 17.6863 20 21C20 24.3137 22.6863 27 26 27C27.1 27 28.1 26.7 29 26.2C27.5 28 25 29 22.5 29C18.3579 29 15 25.6421 15 21.5C15 17.3579 18.3579 14 22.5 14C23.8 14 25 14.4 26 15Z"
      fill="#4338CA"
    />
    <circle cx="27" cy="18" r="1.2" fill="#F59E0B" />
    {/* Tasbih Loop of Beads */}
    <circle cx="24" cy="10" r="1.8" fill="#6366F1" />
    <circle cx="29" cy="11" r="1.8" fill="#6366F1" />
    <circle cx="33.5" cy="14" r="1.8" fill="#6366F1" />
    <circle cx="36" cy="18.5" r="1.8" fill="#6366F1" />
    <circle cx="36.5" cy="23.5" r="1.8" fill="#818CF8" />
    <circle cx="34.5" cy="28.5" r="1.8" fill="#6366F1" />
    <circle cx="30.5" cy="32.5" r="1.8" fill="#6366F1" />
    {/* Left side beads */}
    <circle cx="19" cy="11" r="1.8" fill="#6366F1" />
    <circle cx="14.5" cy="14" r="1.8" fill="#6366F1" />
    <circle cx="12" cy="18.5" r="1.8" fill="#6366F1" />
    <circle cx="11.5" cy="23.5" r="1.8" fill="#818CF8" />
    <circle cx="13.5" cy="28.5" r="1.8" fill="#6366F1" />
    <circle cx="17.5" cy="32.5" r="1.8" fill="#6366F1" />
    {/* Meeting Bead (Imam / Minaret top piece) at bottom */}
    <path
      d="M22.5 33H25.5L24.8 37H23.2L22.5 33Z"
      fill="#4F46E5"
      stroke="#3730A3"
      strokeWidth="0.8"
    />
    <circle cx="24" cy="33" r="2.2" fill="#F59E0B" />
    {/* Flowing Silk Tassel (الشرابة) */}
    <path
      d="M24 37V41M22 41C22 41 23 43 24 43C25 43 26 41 26 41"
      stroke="#4338CA"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="23" y1="39" x2="22" y2="42" stroke="#6366F1" strokeWidth="1" strokeLinecap="round" />
    <line x1="25" y1="39" x2="26" y2="42" stroke="#6366F1" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

// Hadith (الأربعون النووية) - اللوغو الجديد
export const HadithLibraryIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/icons/library-hadith.png"
    alt="الأربعون النووية"
    className={`${className} object-contain drop-shadow-xs select-none`}
    draggable={false}
  />
);

// Book (كتاب المتشابهات) - اللوغو الجديد
export const BookLibraryIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/icons/library-book.png"
    alt="كتاب المتشابهات"
    className={`${className} object-contain drop-shadow-xs select-none`}
    draggable={false}
  />
);

// Encyclopedia (الموسوعة وتفسير القرآن) - اللوغو الجديد
export const EncyclopediaLibraryIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/icons/library-encyclopedia.png"
    alt="الموسوعة"
    className={`${className} object-contain drop-shadow-xs select-none`}
    draggable={false}
  />
);
