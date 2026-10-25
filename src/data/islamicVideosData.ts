export interface IslamicVideoCategory {
  id: string;
  name: string;
  description: string;
  iconName: string;
  subCategories: string[];
}

export interface IslamicVideo {
  id: string;
  title: string;
  sheikh: string;
  category: string;
  categoryLabel: string;
  subCategory?: string;
  youtubeId: string;
  duration: string;
  description?: string;
}

export const VIDEO_CATEGORIES: IslamicVideoCategory[] = [
  {
    id: 'all',
    name: 'الكل',
    description: 'أحدث المقاطع والإضافات من كافة الأقسام',
    iconName: 'Sparkles',
    subCategories: []
  },
  {
    id: 'debates',
    name: 'مناظرات وحوارات',
    description: 'مقارنة أديان، الرد على الشبهات، وحوارات فكرية',
    iconName: 'MessageSquareText',
    subCategories: ['مقارنة أديان', 'الرد على الشبهات', 'حوارات فكرية']
  },
  {
    id: 'hadith',
    name: 'شرح الحديث',
    description: 'صحيح البخاري، صحيح مسلم، الأربعين النووية، ورياض الصالحين',
    iconName: 'Scroll',
    subCategories: ['الأربعين النووية', 'صحيح البخاري', 'صحيح مسلم', 'رياض الصالحين']
  },
  {
    id: 'fiqh',
    name: 'الفقه وأحكامه',
    description: 'فقه العبادات، المعاملات المالية، فقه الأسرة، وفتاوى معاصرة',
    iconName: 'Scale',
    subCategories: ['فقه العبادات', 'المعاملات المالية', 'فقه الأسرة', 'فتاوى معاصرة']
  },
  {
    id: 'aqeedah',
    name: 'العقيدة والتوحيد',
    description: 'أصول الإيمان، التوحيد، وشرح أسماء الله الحسنى',
    iconName: 'ShieldCheck',
    subCategories: ['أصول الإيمان', 'شرح أسماء الله الحسنى', 'دلائل النبوة']
  },
  {
    id: 'tafseer',
    name: 'التفسير وعلوم القرآن',
    description: 'تدبر الآيات، أسباب النزول، وقصص القرآن المجيد',
    iconName: 'BookOpen',
    subCategories: ['تدبر الآيات', 'أسباب النزول', 'قصص القرآن']
  },
  {
    id: 'seerah',
    name: 'السيرة والتاريخ',
    description: 'السيرة النبوية العطرة، قصص الصحابة، والتاريخ الإسلامي',
    iconName: 'Compass',
    subCategories: ['السيرة النبوية', 'قصص الصحابة', 'التاريخ الإسلامي']
  },
  {
    id: 'tazkiyah',
    name: 'رقائق وتزكية',
    description: 'مواعظ قصيرة، إصلاح القلوب، والآداب والأخلاق الإسلامية',
    iconName: 'HeartHandshake',
    subCategories: ['مواعظ قصيرة', 'إصلاح القلوب', 'الآداب الإسلامية']
  }
];

export const INITIAL_ISLAMIC_VIDEOS: IslamicVideo[] = [
  // 1. شرح الحديث
  {
    id: 'vid-h-1',
    title: 'شرح حديث: إنما الأعمال بالنيات - الأربعين النووية',
    sheikh: 'الشيخ د. عثمان الخميس',
    category: 'hadith',
    categoryLabel: 'شرح الحديث',
    subCategory: 'الأربعين النووية',
    youtubeId: 'W3i6e8-dD9o',
    duration: '14:20',
    description: 'شرح تفصيلي وماتع للحديث الأول من الأربعين النووية وبيان منزلة النية وإخلاص العمل لله تعالى.'
  },
  {
    id: 'vid-h-2',
    title: 'حديث جبريل الطويل: أركان الإسلام والإيمان والإحسان',
    sheikh: 'الشيخ د. سعيد الكملي',
    category: 'hadith',
    categoryLabel: 'شرح الحديث',
    subCategory: 'الأربعين النووية',
    youtubeId: 'b0mD7F2-4L8',
    duration: '22:15',
    description: 'شرح الشيخ سعيد الكملي لحديث جبريل عليه السلام المشتمل على جوامع الدين وأصول الشريعة.'
  },
  {
    id: 'vid-h-3',
    title: 'من رياض الصالحين: باب الإخلاص وإحضار النية في سائر الأعمال',
    sheikh: 'الشيخ محمد بن صالح العثيمين رحمه الله',
    category: 'hadith',
    categoryLabel: 'شرح الحديث',
    subCategory: 'رياض الصالحين',
    youtubeId: 'oE9cT-x5ZtI',
    duration: '18:40',
    description: 'دروس نفيسة من شرح رياض الصالحين للعلامة ابن عثيمين رحمه الله تعالى.'
  },
  {
    id: 'vid-h-4',
    title: 'فضل الصلاة على النبي ﷺ من صحيح البخاري',
    sheikh: 'الشيخ عبد الرزاق البدر',
    category: 'hadith',
    categoryLabel: 'شرح الحديث',
    subCategory: 'صحيح البخاري',
    youtubeId: 'k7f_8E8qDVo',
    duration: '12:30',
    description: 'بيان الأحاديث الواردة في فضل الصلاة والسلام على رسول الله ﷺ وثمراتها في الدنيا والآخرة.'
  },

  // 2. العقيدة والتوحيد
  {
    id: 'vid-aq-1',
    title: 'أصول الإيمان وأركان العقيدة الصحيحة',
    sheikh: 'الشيخ صالح الفوزان',
    category: 'aqeedah',
    categoryLabel: 'العقيدة والتوحيد',
    subCategory: 'أصول الإيمان',
    youtubeId: 'Z-2YJp4q27Y',
    duration: '16:50',
    description: 'محاضرة قيمة توضح حقيقة التوحيد وأركان الإيمان الستة وما ينجي المسلم من الشبهات والبدع.'
  },
  {
    id: 'vid-aq-2',
    title: 'شرح اسم الله (اللطيف) وأثره في حياة المسلم',
    sheikh: 'الشيخ د. محمد راتب النابلسي',
    category: 'aqeedah',
    categoryLabel: 'العقيدة والتوحيد',
    subCategory: 'شرح أسماء الله الحسنى',
    youtubeId: 'JgZlXlqK14E',
    duration: '19:35',
    description: 'تأملات إيمانية عميقة في اسم الله اللطيف وكيف يفيض الله بلطفه على عباده في الشدائد.'
  },
  {
    id: 'vid-aq-3',
    title: 'اسم الله (الرزاق): حقيقة التوكل وطلب الرزق بالحلال',
    sheikh: 'الشيخ د. عثمان الخميس',
    category: 'aqeedah',
    categoryLabel: 'العقيدة والتوحيد',
    subCategory: 'شرح أسماء الله الحسنى',
    youtubeId: 'gT2kK5M-LpA',
    duration: '11:10',
    description: 'شرح وافٍ لمعنى اسم الله الرزاق وضبط المفاهيم المتعلقة بالأسباب والتوكل.'
  },

  // 3. التفسير وعلوم القرآن
  {
    id: 'vid-taf-1',
    title: 'تدبر سورة الكهف والدروس المستفادة من فتنها الأربع',
    sheikh: 'الشيخ د. عثمان الخميس',
    category: 'tafseer',
    categoryLabel: 'التفسير وعلوم القرآن',
    subCategory: 'تدبر الآيات',
    youtubeId: 'L8EKnK4GZpA',
    duration: '28:10',
    description: 'تفسير وتدبر عميق لسورة الكهف، وقصصها: أصحاب الكهف، صاحب الجنتين، موسى والخضر، وذو القرنين.'
  },
  {
    id: 'vid-taf-2',
    title: 'أسرار سورة الفاتحة وعظمتها في الصلاة',
    sheikh: 'الشيخ د. سعيد الكملي',
    category: 'tafseer',
    categoryLabel: 'التفسير وعلوم القرآن',
    subCategory: 'تدبر الآيات',
    youtubeId: 'm4XgK2F-X5A',
    duration: '24:45',
    description: 'وقفات لغوية وبلاغية وإيمانية مع أم الكتاب السبع المثاني والقرآن العظيم.'
  },
  {
    id: 'vid-taf-3',
    title: 'قصة سيدنا يوسف عليه السلام: العبر والعظات من أحسن القصص',
    sheikh: 'الشيخ د. محمد راتب النابلسي',
    category: 'tafseer',
    categoryLabel: 'التفسير وعلوم القرآن',
    subCategory: 'قصص القرآن',
    youtubeId: 'P_X-p5G7g5s',
    duration: '31:20',
    description: 'رحلة إيمانية في سورة يوسف وبيان كيف يجعل الله بعد العسر يسراً وبعد المحنة منحة.'
  },
  {
    id: 'vid-taf-4',
    title: 'لماذا نزلت هذه الآية؟ أمثلة من أسباب النزول الصحيحة',
    sheikh: 'الشيخ صالح المغامسي',
    category: 'tafseer',
    categoryLabel: 'التفسير وعلوم القرآن',
    subCategory: 'أسباب النزول',
    youtubeId: 'w5Lp7-Gk2eM',
    duration: '15:15',
    description: 'بيان أهمية فهم سبب النزول في إدراك المعنى الصحيح للآيات القرآنية وتطبيقاتها.'
  },

  // 4. الفقه وأحكامه
  {
    id: 'vid-fq-1',
    title: 'صفة صلاة النبي ﷺ خطوة بخطوة كما صحت في السنة',
    sheikh: 'الشيخ د. عثمان الخميس',
    category: 'fiqh',
    categoryLabel: 'الفقه وأحكامه',
    subCategory: 'فقه العبادات',
    youtubeId: 'n1QWlP6pEAg',
    duration: '21:05',
    description: 'شرح تطبيقي ودقيق لصفة صلاة النبي ﷺ من تكبيرة الإحرام حتى التسليم مع تنبيهات على الأخطاء الشائعة.'
  },
  {
    id: 'vid-fq-2',
    title: 'أحكام المعاملات المالية المعاصرة والربا والبيوع',
    sheikh: 'الشيخ محمد بن صالح العثيمين رحمه الله',
    category: 'fiqh',
    categoryLabel: 'الفقه وأحكامه',
    subCategory: 'المعاملات المالية',
    youtubeId: 'Y6vLm9T8sQk',
    duration: '25:40',
    description: 'تأصيل شرعي في قواعد البيوع الحلال والمحرمة والضوابط التي تحفظ أموال المسلمين.'
  },
  {
    id: 'vid-fq-3',
    title: 'فقه الأسرة: حقوق الزوجين وأسس البيت المسلم السعيد',
    sheikh: 'الشيخ د. عثمان الخميس',
    category: 'fiqh',
    categoryLabel: 'الفقه وأحكامه',
    subCategory: 'فقه الأسرة',
    youtubeId: 'U_5L9pZkXvA',
    duration: '27:30',
    description: 'إرشادات شرعية ونبوية لبناء أسرة متماسكة وحل الخلافات الزوجية بالحكمة والعدل.'
  },
  {
    id: 'vid-fq-4',
    title: 'فتاوى معاصرة: أحكام العملات الرقمية والشراء بالتقسيط',
    sheikh: 'الشيخ د. سعد الخثلان',
    category: 'fiqh',
    categoryLabel: 'الفقه وأحكامه',
    subCategory: 'فتاوى معاصرة',
    youtubeId: 'q8M7vL5kX9s',
    duration: '13:55',
    description: 'إجابات فقهية مؤصلة على أبرز التساؤلات المعاصرة في التجارة الإلكترونية والمعاملات البنكية.'
  },

  // 5. مناظرات وحوارات
  {
    id: 'vid-deb-1',
    title: 'رحلة اليقين: الرد العلمي على شبهات الإلحاد والداروينية',
    sheikh: 'د. إياد قنيبي',
    category: 'debates',
    categoryLabel: 'مناظرات وحوارات',
    subCategory: 'الرد على الشبهات',
    youtubeId: 't4U0-h5aZLs',
    duration: '23:45',
    description: 'طرح علمي رصين ومنهجي يفند مغالطات الإلحاد المادي ويثبت دلائل الإتقان والخلق في الكون والإنسان.'
  },
  {
    id: 'vid-deb-2',
    title: 'حوار هادئ مع باحث عن الحقيقة: كيف نعرف أن القرآن كلام الله؟',
    sheikh: 'د. عثمان الخميس',
    category: 'debates',
    categoryLabel: 'مناظرات وحوارات',
    subCategory: 'حوارات فكرية',
    youtubeId: 'k4F9vLm8XQw',
    duration: '19:10',
    description: 'مناقشة فكرية وأدلة عقلية ونقلية تثبت إعجاز القرآن الكريم وصدق الرسالة المحمدية.'
  },
  {
    id: 'vid-deb-3',
    title: 'مقارنة الأديان: نبوءة النبي محمد ﷺ في الكتب السابقة',
    sheikh: 'الشيخ أحمد ديدات رحمه الله',
    category: 'debates',
    categoryLabel: 'مناظرات وحوارات',
    subCategory: 'مقارنة أديان',
    youtubeId: 'Z9k8X5LmPqA',
    duration: '35:20',
    description: 'محاضرة تاريخية رائدة في مقارنة الأديان وبيان البشارات النبوية في نصوص العهد القديم والجديد.'
  },

  // 6. السيرة والتاريخ
  {
    id: 'vid-se-1',
    title: 'السيرة النبوية: الهجرة الشريفة من مكة إلى المدينة وبناء الدولة',
    sheikh: 'د. راغب السرجاني',
    category: 'seerah',
    categoryLabel: 'السيرة والتاريخ',
    subCategory: 'السيرة النبوية',
    youtubeId: 'L2vK9Xp7mQs',
    duration: '29:50',
    description: 'تحليل استراتيجي وإيماني لأعظم حدث غيّر مجرى التاريخ الإنساني مع وقفات تربوية ملهمة.'
  },
  {
    id: 'vid-se-2',
    title: 'قصة الفاروق عمر بن الخطاب رضي الله عنه وإسلامه العظيم',
    sheikh: 'الشيخ بدر المشاري',
    category: 'seerah',
    categoryLabel: 'السيرة والتاريخ',
    subCategory: 'قصص الصحابة',
    youtubeId: 'r4X8mK9vL5s',
    duration: '26:15',
    description: 'سرد مؤثر ومشوق لمواقف الفاروق عمر، عدله، هيبته، وشفقته على رعيته.'
  },
  {
    id: 'vid-se-3',
    title: 'محطات من فتح الأندلس: طارق بن زياد وموسى بن نصير',
    sheikh: 'د. راغب السرجاني',
    category: 'seerah',
    categoryLabel: 'السيرة والتاريخ',
    subCategory: 'التاريخ الإسلامي',
    youtubeId: 'm7Xp2K8vL4s',
    duration: '32:40',
    description: 'قصة الفتح الإسلامي للأندلس وكيف تحولت شبه الجزيرة الإيبيرية إلى منارة للعلم والعدل والحضارة.'
  },

  // 7. رقائق وتزكية
  {
    id: 'vid-taz-1',
    title: 'إصلاح القلوب: كيف تتخلص من قسوة القلب والفتور؟',
    sheikh: 'الشيخ سمير مصطفى',
    category: 'tazkiyah',
    categoryLabel: 'رقائق وتزكية',
    subCategory: 'إصلاح القلوب',
    youtubeId: 'b7X8mK9pL2s',
    duration: '17:25',
    description: 'موعظة بليغة تمس شغاف القلب حول أسباب قسوة القلوب، ومفاتيح الخشوع والإقبال على الله.'
  },
  {
    id: 'vid-taz-2',
    title: 'دقائق ستغير نظرتك للحياة: الدنيا دار ممر لا دار مقر',
    sheikh: 'الشيخ محمد سيد حاج رحمه الله',
    category: 'tazkiyah',
    categoryLabel: 'رقائق وتزكية',
    subCategory: 'مواعظ قصيرة',
    youtubeId: 'k9X7mP2vL8s',
    duration: '10:40',
    description: 'كلمات ذهبية تذكر بحقيقة الحياة الزائلة والاستعداد للقاء الله بالعمل الصالح.'
  },
  {
    id: 'vid-taz-3',
    title: 'أدب المسلم مع الله ومع الناس: مفتاح رفعة الدرجات',
    sheikh: 'الشيخ عبد الرزاق البدر',
    category: 'tazkiyah',
    categoryLabel: 'رقائق وتزكية',
    subCategory: 'الآداب الإسلامية',
    youtubeId: 'v8X7mL9pK2s',
    duration: '15:50',
    description: 'بيان محاسن الأخلاق الإسلامية وثقل حسن الخلق في ميزان العبد يوم القيامة.'
  }
];
