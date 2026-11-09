export interface AchievementStyle {
  className: string;
  icon: string;
  textColor: string;
}

export const achievementStyles: Record<string, AchievementStyle> = {
  seerah: {
    className: 'rounded-full bg-[url("/golden_seerah_achievement_frame.webp")] bg-center bg-no-repeat bg-contain scale-110',
    icon: '/icons/seerah.webp',
    textColor: 'from-amber-600 via-yellow-600 to-amber-700'
  },
  general: {
    className: 'rounded-full bg-[url("/golden_general_achievement_frame.webp")] bg-center bg-no-repeat bg-contain scale-110',
    icon: '/icons/general.webp',
    textColor: 'from-blue-600 via-sky-500 to-indigo-700'
  },
  none: {
    className: 'rounded-full bg-slate-200',
    icon: '',
    textColor: 'from-slate-600 to-slate-800'
  }
};

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mateen.game';
export const PLAY_STORE_TEST_LINK = 'https://play.google.com/apps/testing/com.mateen.game';
