import akidaData from './akida.json';
import fighData from './figh.json';
import hadithData from './hadith.json';
import historyData from './history.json';
import arabiaData from './arabia.json';
import tafseerData from './tafseer.json';
import { Question } from '../quizQuestionsData';

export interface CategoryQuestion extends Question {
  id?: number;
  topic?: string;
  link?: string;
}

export interface CategoryTopic {
  id: number;
  name: string;
  slug: string;
  levels: {
    1: CategoryQuestion[];
    2: CategoryQuestion[];
    3: CategoryQuestion[];
  };
}

export interface IslamicCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  topicsCount: number;
  topics: CategoryTopic[];
}

export interface CategoryMeta {
  id: string;
  title: string;
  icon: string;
  description: string;
  topicsCount: number;
  type: 'custom' | 'general' | 'seerah';
}

export const islamicCategoriesData: Record<string, IslamicCategory> = {
  akida: akidaData as unknown as IslamicCategory,
  figh: fighData as unknown as IslamicCategory,
  hadith: hadithData as unknown as IslamicCategory,
  tafseer: tafseerData as unknown as IslamicCategory,
  history: historyData as unknown as IslamicCategory,
  arabia: arabiaData as unknown as IslamicCategory,
};

export const islamicCategoriesList: CategoryMeta[] = [
  {
    id: 'general',
    title: 'أسئلة عامة',
    icon: '/icons/general.png',
    description: 'بنك أسئلة منوعة في مختلف جوانب الثقافة والمعارف الإسلامية',
    topicsCount: 5,
    type: 'general',
  },
  {
    id: 'seerah',
    title: 'السيرة النبوية',
    icon: '/icons/seerah.png',
    description: 'محطات مضيئة من حياة الحبيب المصطفى ﷺ وغزواته وأصحابه',
    topicsCount: 3,
    type: 'seerah',
  },
  {
    id: 'akida',
    title: 'العقيدة الإسلامية',
    icon: '/icons/icon-akida.svg',
    description: 'أصول الإيمان والتوحيد الخالص ونواقض الإيمان واليوم الآخر',
    topicsCount: (akidaData as unknown as IslamicCategory).topics.length,
    type: 'custom',
  },
  {
    id: 'figh',
    title: 'الفقه الإسلامي',
    icon: '/icons/icon-figh.svg',
    description: 'الأحكام الفقهية في العبادات والمعاملات من الطهارة حتى الحج',
    topicsCount: (fighData as unknown as IslamicCategory).topics.length,
    type: 'custom',
  },
  {
    id: 'hadith',
    title: 'الحديث الشريف',
    icon: '/icons/icon-hadith.svg',
    description: 'هدي النبي ﷺ وسنته المطهرة وعلوم الرواية والأحاديث',
    topicsCount: (hadithData as unknown as IslamicCategory).topics.length,
    type: 'custom',
  },
  {
    id: 'tafseer',
    title: 'تفسير القرآن',
    icon: '/icons/icon-tafseer.svg',
    description: 'معاني الآيات القرآنية ومقاصد السور من الفاتحة حتى غافر',
    topicsCount: (tafseerData as unknown as IslamicCategory).topics.length,
    type: 'custom',
  },
  {
    id: 'history',
    title: 'التاريخ الإسلامي',
    icon: '/icons/icon-history.svg',
    description: 'سير الخلفاء الراشدين والعهود الإسلامية من النبوة حتى العصر الحديث',
    topicsCount: (historyData as unknown as IslamicCategory).topics.length,
    type: 'custom',
  },
  {
    id: 'arabia',
    title: 'اللغة العربية',
    icon: '/icons/icon-arabia.svg',
    description: 'علوم لغة القرآن الكريم، النحو، الصرف، البلاغة، والمعاجم والأدب',
    topicsCount: (arabiaData as unknown as IslamicCategory).topics.length,
    type: 'custom',
  },
];
