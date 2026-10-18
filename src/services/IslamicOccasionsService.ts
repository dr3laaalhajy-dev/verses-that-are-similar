export interface HijriDateInfo {
  day: number;
  month: number;
  year: number;
  dayName: string;
  monthName: string;
  formatted: string;
}

export interface IslamicOccasion {
  id: string;
  title: string;
  categoryLabel: string;
  timingBadge: string;
  daysRemaining: number;
  hijriDateText: string;
  gregorianDateText: string;
  shortDescription: string;
  virtue: string;
  hadith: string;
  hadithSource: string;
  hadithExplanation?: string;
  recommendedActs: string[];
  type: 'fasting' | 'friday' | 'white_days' | 'eid' | 'annual_season' | 'dhikr';
  iconType: 'moon' | 'sunrise' | 'calendar' | 'sparkles' | 'heart';
}

export const HIJRI_MONTHS_AR = [
  'المحرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة'
];

/**
 * Standard Umm al-Qura Hijri conversion
 */
export function getHijriDate(date: Date = new Date()): HijriDateInfo {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
    const parts = formatter.formatToParts(date);
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '1448', 10);

    const dayName = date.toLocaleDateString('ar-SA', { weekday: 'long' });
    const monthName = HIJRI_MONTHS_AR[month - 1] || 'شهر هجري';
    const formatted = `${day} ${monthName} ${year} هـ`;

    return {
      day,
      month,
      year,
      dayName,
      monthName,
      formatted
    };
  } catch {
    const dayName = date.toLocaleDateString('ar-SA', { weekday: 'long' });
    return {
      day: 1,
      month: 1,
      year: 1448,
      dayName,
      monthName: 'المحرم',
      formatted: '1 المحرم 1448 هـ'
    };
  }
}

/**
 * Background sync with Aladhan API to cache verified Hijri dates
 */
export async function syncAladhanHijri(date: Date = new Date()): Promise<void> {
  try {
    const dayStr = String(date.getDate()).padStart(2, '0');
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const yearStr = date.getFullYear();
    const cacheKey = `quran_hijri_aladhan_${dayStr}_${monthStr}_${yearStr}`;

    if (localStorage.getItem(cacheKey)) return;

    const res = await fetch(`https://api.aladhan.com/v1/gToH/${dayStr}-${monthStr}-${yearStr}`);
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.hijri) {
        localStorage.setItem(cacheKey, JSON.stringify(json.data.hijri));
      }
    }
  } catch {
    // Fail silently, local calculation is fully accurate
  }
}

/**
 * Formats relative timing badge in clean Arabic
 */
function formatBadge(days: number): string {
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  if (days === 2) return 'بعد يومين';
  if (days >= 3 && days <= 10) return `بعد ${days} أيام`;
  return `بعد ${days} يوماً`;
}

/**
 * Finds the NEXT occurrence of a target Hijri (month, day) starting from fromDate (0 to 365 days)
 */
function findNextHijriDate(targetMonth: number, targetDay: number, fromDate: Date = new Date()): { date: Date; daysRemaining: number; hijri: HijriDateInfo } | null {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);

  for (let i = 0; i < 366; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() + i);
    const h = getHijriDate(cur);
    if (h.month === targetMonth && h.day === targetDay) {
      return { date: cur, daysRemaining: i, hijri: h };
    }
  }
  return null;
}

/**
 * Finds the single NEXT occurrence of a given day of the week (0 = Sun, 1 = Mon, ..., 6 = Sat)
 */
function findNextWeekday(targetDayOfWeek: number, fromDate: Date = new Date()): { date: Date; daysRemaining: number; hijri: HijriDateInfo } {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() + i);
    if (cur.getDay() === targetDayOfWeek) {
      return { date: cur, daysRemaining: i, hijri: getHijriDate(cur) };
    }
  }
  return { date: d, daysRemaining: 0, hijri: getHijriDate(d) };
}

/**
 * Generates all authentic Islamic occasions according to Ahl al-Sunnah wa al-Jama'ah (السنة النبوية الصحيحة)
 * - Monday and Thursday appear strictly ONCE (the nearest upcoming one)
 * - The three White Days (13, 14, 15) are unified into ONE single card
 * - Major annual seasons (Ramadan, Eid al-Fitr, Eid al-Adha, Arafah, Ashura) are precisely calculated with remaining days
 */
export function getUpcomingOccasions(limit: number = 10, startDate: Date = new Date()): IslamicOccasion[] {
  const occasions: IslamicOccasion[] = [];
  const currentHijri = getHijriDate(startDate);

  // 1. صيام الإثنين القادم (يظهر مرة واحدة فقط - الأقرب)
  const nextMon = findNextWeekday(1, startDate);
  occasions.push({
    id: `monday-${nextMon.date.toISOString().split('T')[0]}`,
    title: 'صيام يوم الإثنين',
    categoryLabel: 'سُنّة أسبوعية مؤكدة',
    timingBadge: formatBadge(nextMon.daysRemaining),
    daysRemaining: nextMon.daysRemaining,
    hijriDateText: nextMon.hijri.formatted,
    gregorianDateText: nextMon.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    shortDescription: 'تُعرض فيه الأعمال على الله، ويوم وُلد فيه النبي ﷺ',
    virtue: 'كان النبي ﷺ يتحرى صيام الإثنين ويقول: «تُعرَضُ الأعمالُ يومَ الإثنين والخميسِ، فأُحِبُّ أن يُعرَضَ عملي وأنا صائمٌ».',
    hadith: '«ذاكَ يَوْمٌ وُلِدْتُ فِيهِ، وَيَوْمٌ بُعِثْتُ، أَوْ أُنْزِلَ عَلَيَّ فِيهِ»',
    hadithSource: 'صحيح مسلم (1162)',
    hadithExplanation: 'شكر الله تعالى على نعمة بعثة النبي ﷺ ونزول القرآن، وعرض الطاعات وهو صائم.',
    recommendedActs: [
      'تبييت نية صيام الإثنين تطوعاً وتقرباً إلى الله',
      'الحرص على أكلة السحور لبركتها',
      'صلاة الضحى والتبكير للصلوات المكتوبة',
      'الدعاء عند الفطر فإن للصائم دعوة لا تُرد'
    ],
    type: 'fasting',
    iconType: 'sunrise'
  });

  // 2. صيام الخميس القادم (يظهر مرة واحدة فقط - الأقرب)
  const nextThu = findNextWeekday(4, startDate);
  occasions.push({
    id: `thursday-${nextThu.date.toISOString().split('T')[0]}`,
    title: 'صيام يوم الخميس',
    categoryLabel: 'سُنّة أسبوعية مؤكدة',
    timingBadge: formatBadge(nextThu.daysRemaining),
    daysRemaining: nextThu.daysRemaining,
    hijriDateText: nextThu.hijri.formatted,
    gregorianDateText: nextThu.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    shortDescription: 'يوم تُعرض فيه الأعمال على الله تعالى ويُستحب صيامه',
    virtue: 'يوم مبارك تُرفع فيه صحائف الأعمال الأسبوعية إلى رب العالمين، والصيام خير ما تُختم به الأعمال وتُعرض به.',
    hadith: '«تُعْرَضُ الأَعْمَالُ يَوْمَ الإِثْنَيْنِ وَالخَمِيسِ، فَأُحِبُّ أَنْ يُعْرَضَ عَمَلِي وَأَنَا صَائِمٌ»',
    hadithSource: 'سنن الترمذي (747) وقال حديث حسن',
    recommendedActs: [
      'تبييت نية صوم نافلة الخميس من الليل',
      'ملازمة الاستغفار والذكر طيلة نهار الصيام',
      'الصدقة وتفقد المحتاجين والأقارب',
      'الدعاء للمسلمين والوالدين عند الإفطار'
    ],
    type: 'fasting',
    iconType: 'sunrise'
  });

  // 3. سُنن وفضائل يوم الجمعة (تظهر مرة واحدة فقط - الأقرب)
  const nextFri = findNextWeekday(5, startDate);
  occasions.push({
    id: `friday-${nextFri.date.toISOString().split('T')[0]}`,
    title: 'سُنن وفضائل يوم الجمعة',
    categoryLabel: 'عيد الأسبوع وسيد الأيام',
    timingBadge: formatBadge(nextFri.daysRemaining),
    daysRemaining: nextFri.daysRemaining,
    hijriDateText: nextFri.hijri.formatted,
    gregorianDateText: nextFri.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    shortDescription: 'قراءة سورة الكهف، كثرة الصلاة على النبي ﷺ، وساعة الاستجابة',
    virtue: 'خير يوم طلعت عليه الشمس؛ فيه خُلق آدم وفيه أُدخل الجنة وفيه أُخرج منها، وفيه ساعة لا يوافقها عبد مسلم يسأل الله خيراً إلا أعطاه إياه.',
    hadith: '«مَن قَرَأَ سُورَةَ الكَهْفِ في يَومِ الجُمُعَةِ، أَضَاءَ له مِنَ النُّورِ ما بيْنَ الجُمُعَتَيْنِ»',
    hadithSource: 'المستدرك للحاكم وصححه الألباني',
    hadithExplanation: 'النور يكون نوراً معنوياً في القلب وهداية في البصيرة، ونوراً يوم القيامة يسعى بين يديه.',
    recommendedActs: [
      'قراءة سورة الكهف كاملة في يومها أو ليلتها',
      'الإكثار من الصلاة والسلام على رسول الله ﷺ',
      'الغسل والتطيب ولبس أحسن الثياب والتبكير لصلاة الجمعة',
      'تحري ساعة الإجابة (آخر ساعة من عصر الجمعة)'
    ],
    type: 'friday',
    iconType: 'heart'
  });

  // 4. صيام الأيام البيض (13، 14، 15) - مجمعة في بطاقة واحدة موحدة
  // نحدد موعد بداية الأيام البيض التالية بدقة
  let whiteDaysTarget: { date: Date; daysRemaining: number; hijri: HijriDateInfo } | null = null;
  const isCurrentlyWhiteDays = (currentHijri.day >= 13 && currentHijri.day <= 15) && !(currentHijri.month === 12 && currentHijri.day === 13);

  if (isCurrentlyWhiteDays) {
    whiteDaysTarget = {
      date: startDate,
      daysRemaining: 0,
      hijri: currentHijri
    };
  } else if (currentHijri.day < 13) {
    whiteDaysTarget = findNextHijriDate(currentHijri.month, 13, startDate);
  } else {
    // الشهر القادم (مع مراعاة ذي الحجة حيث لا يصام 13 لأنه من أيام التشريق)
    const nextHijriMonth = currentHijri.month === 12 ? 1 : currentHijri.month + 1;
    whiteDaysTarget = findNextHijriDate(nextHijriMonth, 13, startDate);
  }

  if (whiteDaysTarget) {
    const monthName = whiteDaysTarget.hijri.monthName;
    const isOngoing = whiteDaysTarget.daysRemaining === 0;
    occasions.push({
      id: `white-days-${whiteDaysTarget.hijri.year}-${whiteDaysTarget.hijri.month}`,
      title: 'صيام الأيام البيض',
      categoryLabel: 'سُنّة شهرية مباركة',
      timingBadge: isOngoing ? 'اليوم' : formatBadge(whiteDaysTarget.daysRemaining),
      daysRemaining: whiteDaysTarget.daysRemaining,
      hijriDateText: `13 و 14 و 15 ${monthName} ${whiteDaysTarget.hijri.year} هـ`,
      gregorianDateText: isOngoing 
        ? `الأيام البيض جارية الآن (${monthName})`
        : `تبدأ ${whiteDaysTarget.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      shortDescription: `صيام 13 و 14 و 15 ${monthName} كصيام الدهر كله`,
      virtue: 'وصية رسول الله ﷺ لأصحابه، والحسنة بعشر أمثالها؛ فصيام ثلاثة أيام من كل شهر يعادل صيام الشهر كله (30 يوماً)، فمن داوم عليها فكأنما صام الدهر كله.',
      hadith: '«صِيَامُ ثَلَاثَةِ أَيَّامٍ مِنْ كُلِّ شَهْرٍ صِيَامُ الدَّهْرِ، وَهِيَ أَيَّامُ الْبِيضِ: صَبِيحَةُ ثَلَاثَ عَشْرَةَ، وَأَرْبَعَ عَشْرَةَ، وَخَمْسَ عَشْرَةَ»',
      hadithSource: 'سنن النسائي (2420) بإسناد حسن، وصحيح البخاري (1975)',
      hadithExplanation: 'سُميت بيضاً لابيضاض لياليها بنور القمر حين يكتمل بدراً في السماء.',
      recommendedActs: [
        'تبييت نية صيام الأيام البيض كاملة (13 و 14 و 15)',
        'استغلال ساعات الصيام بالدعاء والذكر وتلاوة القرآن',
        'الحرص على السحور وتعجيل الفطر',
        'تذكير الأهل والإخوان بصيامها لنيل مثل أجرهم'
      ],
      type: 'white_days',
      iconType: 'moon'
    });
  }

  // 5. شهر رمضان المبارك (بداية الصيام المفروض 1 رمضان)
  const nextRamadan = findNextHijriDate(9, 1, startDate);
  if (nextRamadan) {
    occasions.push({
      id: `ramadan-start-${nextRamadan.hijri.year}`,
      title: 'شهر رمضان المبارك',
      categoryLabel: 'سيد الشهور وفريضة الصيام',
      timingBadge: formatBadge(nextRamadan.daysRemaining),
      daysRemaining: nextRamadan.daysRemaining,
      hijriDateText: `1 رمضان ${nextRamadan.hijri.year} هـ`,
      gregorianDateText: nextRamadan.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'شهر الصيام والقرآن والرحمة والمغفرة والعتق من النيران',
      virtue: 'تُفتح فيه أبواب الجنان، وتُغلق أبواب النيران، وتُصفد الشياطين، وفيه ليلة القدر التي هي خير من ألف شهر.',
      hadith: '«مَن صامَ رَمَضانَ إيمانًا واحْتِسابًا، غُفِرَ له ما تَقَدَّمَ مِن ذَنْبِهِ»',
      hadithSource: 'صحيح البخاري (38) ومسلم (760)',
      recommendedActs: [
        'الاستعداد النفسي والروحي بالتوبة الصادقة',
        'وضع خطة لختم القرآن ومدارسته في رمضان',
        'المحافظة على صلاة التراويح وقيام الليل',
        'الجود والصدقة وإفطار الصائمين'
      ],
      type: 'annual_season',
      iconType: 'moon'
    });
  }

  // 6. العشر الأواخر من رمضان وليلة القدر (21 رمضان)
  const nextLastTen = findNextHijriDate(9, 21, startDate);
  if (nextLastTen) {
    occasions.push({
      id: `laylat-qadr-${nextLastTen.hijri.year}`,
      title: 'العشر الأواخر وليلة القدر',
      categoryLabel: 'أعظم ليالي العام',
      timingBadge: formatBadge(nextLastTen.daysRemaining),
      daysRemaining: nextLastTen.daysRemaining,
      hijriDateText: `21 رمضان ${nextLastTen.hijri.year} هـ`,
      gregorianDateText: nextLastTen.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'ليالٍ مباركات فيها ليلة القدر خير من ألف شهر (83 سنة)',
      virtue: 'كان النبي ﷺ إذا دخلت العشر شد مئزره وأحيا ليله وأيقظ أهله طلباً لليلة القدر وغفراناً للذنوب.',
      hadith: '«تَحَرَّوْا لَيْلَةَ القَدْرِ في العَشْرِ الأَوَاخِرِ مِن رَمَضَانَ»',
      hadithSource: 'صحيح البخاري (2020)',
      recommendedActs: [
        'إحياء الليالي الوترية بالصلاة والقرآن',
        'الإكثار من دعاء: «اللهم إنك عفو تحب العفو فاعف عني»',
        'الاعتكاف لمن تيسر له والاعتكاف الجزئي بالمسجد',
        'الصدقة في كل ليلة من ليالي العشر'
      ],
      type: 'annual_season',
      iconType: 'sparkles'
    });
  }

  // 7. عيد الفطر المبارك (1 شوال)
  const nextEidFitr = findNextHijriDate(10, 1, startDate);
  if (nextEidFitr) {
    occasions.push({
      id: `eid-fitr-${nextEidFitr.hijri.year}`,
      title: 'عيد الفطر المبارك',
      categoryLabel: 'عيد المسلمين وفرحة الصائمين',
      timingBadge: formatBadge(nextEidFitr.daysRemaining),
      daysRemaining: nextEidFitr.daysRemaining,
      hijriDateText: `1 شوال ${nextEidFitr.hijri.year} هـ`,
      gregorianDateText: nextEidFitr.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'يوم الجائزة والفرح بتمام صيام شهر رمضان (يحرم صيامه)',
      virtue: 'يوم شكره تعالى وإظهار الفرح بالهداية وإتمام الصيام: ﴿وَلِتُكْمِلُوا الْعِدَّةَ وَلِتُكَبِّرُوا اللَّهَ عَلَىٰ مَا هَدَاكُمْ﴾.',
      hadith: '«إنَّ لِكُلِّ قَوْمٍ عِيدًا وهذا عِيدُنا»',
      hadithSource: 'صحيح البخاري (952) ومسلم (892)',
      recommendedActs: [
        'إخراج زكاة الفطر قبل صلاة العيد طُهرةً للصائم',
        'التكبير من غروب شمس آخر يوم من رمضان حتى صلاة العيد',
        'الاغتسال ولبس أحسن الثياب والتطيب للرجال',
        'أداء صلاة العيد وصلة الأرحام وإفشاء السلام'
      ],
      type: 'eid',
      iconType: 'sparkles'
    });
  }

  // 8. صيام الست من شوال
  const nextShawwalSix = findNextHijriDate(10, 2, startDate);
  if (nextShawwalSix) {
    occasions.push({
      id: `shawwal-six-${nextShawwalSix.hijri.year}`,
      title: 'صيام الست من شوال',
      categoryLabel: 'سُنّة نبوية مباركة',
      timingBadge: formatBadge(nextShawwalSix.daysRemaining),
      daysRemaining: nextShawwalSix.daysRemaining,
      hijriDateText: `شهر شوال ${nextShawwalSix.hijri.year} هـ`,
      gregorianDateText: nextShawwalSix.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'من صام رمضان ثم أتبعه ستاً من شوال كان كصيام الدهر',
      virtue: 'رمضان بعشرة أشهر، وصيام ستة أيام بشهرين، فذلك صيام سنة كاملة، فمن حافظ عليها كُتب له صيام الدهر.',
      hadith: '«مَن صامَ رَمَضانَ ثُمَّ أتْبَعَهُ سِتًّا مِن شَوَّالٍ، كانَ كَصِيامِ الدَّهْرِ»',
      hadithSource: 'صحيح مسلم (1164)',
      recommendedActs: [
        'المبادرة بالصيام بعد يوم العيد مباشرة أو متفرقة خلال شوال',
        'قضاء ما فات من رمضان أولاً لمن عليه قضاء',
        'تبييت النية من الليل لكل يوم',
        'تذكير الأهل بالفضل العظيم'
      ],
      type: 'fasting',
      iconType: 'sunrise'
    });
  }

  // 9. عشر ذي الحجة (1 ذو الحجة)
  const nextDhulHijjahTen = findNextHijriDate(12, 1, startDate);
  if (nextDhulHijjahTen) {
    occasions.push({
      id: `dhul-hijjah-${nextDhulHijjahTen.hijri.year}`,
      title: 'عشر ذي الحجة',
      categoryLabel: 'أفضل أيام الدنيا على الإطلاق',
      timingBadge: formatBadge(nextDhulHijjahTen.daysRemaining),
      daysRemaining: nextDhulHijjahTen.daysRemaining,
      hijriDateText: `1 ذو الحجة ${nextDhulHijjahTen.hijri.year} هـ`,
      gregorianDateText: nextDhulHijjahTen.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'العمل الصالح فيها أحب إلى الله من أي أيام أخرى في الدنيا',
      virtue: 'أقسم الله تعالى بها في سورة الفجر، والعمل فيها أعظم عند الله من الجهاد إلا من استُشهد ونفد ماله.',
      hadith: '«ما مِن أيَّامٍ العَمَلُ الصَّالِحُ فيها أحَبُّ إلى اللهِ مِن هذِه الأيَّامِ -يَعْنِي أيَّامَ العَشْرِ-»',
      hadithSource: 'صحيح البخاري (969)',
      recommendedActs: [
        'صيام التسع الأوائل من ذي الحجة وخاصة يوم عرفة',
        'الإكثار من التكبير والتهليل والتحميد المطلق في الأسواق والبيوت',
        'قراءة القرآن والصدقة وقيام الليل',
        'الإمساك عن الأخذ من الشعر والأظفار للمضحي مع دخول العشر'
      ],
      type: 'annual_season',
      iconType: 'sunrise'
    });
  }

  // 10. صيام يوم عرفة لغير الحاج (9 ذو الحجة)
  const nextArafah = findNextHijriDate(12, 9, startDate);
  if (nextArafah) {
    occasions.push({
      id: `arafah-${nextArafah.hijri.year}`,
      title: 'صيام يوم عرفة',
      categoryLabel: 'أعظم أيام الدهر لغير الحاج',
      timingBadge: formatBadge(nextArafah.daysRemaining),
      daysRemaining: nextArafah.daysRemaining,
      hijriDateText: `9 ذو الحجة ${nextArafah.hijri.year} هـ`,
      gregorianDateText: nextArafah.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'صيامه يُكفّر سنتين: سنة ماضية وسنة مقبلة',
      virtue: 'يوم مغفرة الذنوب والعتق من النيران وإجابة الدعاء؛ صيامه لغير الحاج يكفر خطايا عامين كاملين.',
      hadith: '«صِيَامُ يَوْمِ عَرَفَةَ، أَحْتَسِبُ عَلَى اللهِ أَنْ يُكَفِّرَ السَّنَةَ الَّتِي قَبْلَهُ، وَالسَّنَةَ الَّتِي بَعْدَهُ»',
      hadithSource: 'صحيح مسلم (1162)',
      hadithExplanation: 'خير الدعاء دعاء يوم عرفة، وخير ما قال النبيون: «لا إله إلا الله وحده لا شريك له».',
      recommendedActs: [
        'عقد نية صوم عرفة احتساباً للأجر العظيم',
        'الإكثار من الدعاء والتضرع طيلة يوم عرفة وخصوصاً بعد العصر',
        'كثرة التهليل والتكبير والتسبيح والاستغفار',
        'الاجتهاد في التوبة ورد المظالم'
      ],
      type: 'annual_season',
      iconType: 'sparkles'
    });
  }

  // 11. عيد الأضحى المبارك (يوم النحر 10 ذو الحجة)
  const nextEidAdha = findNextHijriDate(12, 10, startDate);
  if (nextEidAdha) {
    occasions.push({
      id: `eid-adha-${nextEidAdha.hijri.year}`,
      title: 'عيد الأضحى المبارك (يوم النحر)',
      categoryLabel: 'أعظم الأيام عند الله',
      timingBadge: formatBadge(nextEidAdha.daysRemaining),
      daysRemaining: nextEidAdha.daysRemaining,
      hijriDateText: `10 ذو الحجة ${nextEidAdha.hijri.year} هـ`,
      gregorianDateText: nextEidAdha.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'يوم الحج الأكبر وذبح الأضاحي وصلاة العيد والتكبير (يحرم صيامه)',
      virtue: 'أعظم الأيام عند الله تعالى، فيه تُذبح الهدايا والأضاحي تقرباً إلى الله اقتداءً بسيدنا إبراهيم ومحمد عليهما الصلاة والسلام.',
      hadith: '«إِنَّ أَعْظَمَ الأَيَّامِ عِنْدَ اللَّهِ تَبَارَكَ وَتَعَالَى يَوْمُ النَّحْرِ، ثُمَّ يَوْمُ القَرِّ»',
      hadithSource: 'سنن أبي داود (1765) وصححه الألباني',
      recommendedActs: [
        'أداء صلاة العيد مع المسلمين والاستماع للخطبة',
        'ذبح الأضحية بعد صلاة العيد وتوزيعها على الفقراء والأقارب',
        'التكبير المقيد بعد الصلوات المفروضة والتكبير المطلق',
        'صلة الأرحام وإشاعة الفرح والسرور بين المسلمين'
      ],
      type: 'eid',
      iconType: 'sparkles'
    });
  }

  // 12. أيام التشريق (11 و 12 و 13 ذو الحجة)
  const nextTashreeq = findNextHijriDate(12, 11, startDate);
  if (nextTashreeq) {
    occasions.push({
      id: `tashreeq-${nextTashreeq.hijri.year}`,
      title: 'أيام التشريق والذكر',
      categoryLabel: 'أيام أكل وشرب وذكر لله',
      timingBadge: formatBadge(nextTashreeq.daysRemaining),
      daysRemaining: nextTashreeq.daysRemaining,
      hijriDateText: `11 - 13 ذو الحجة ${nextTashreeq.hijri.year} هـ`,
      gregorianDateText: nextTashreeq.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'أيام ينهى عن صيامها وتُعمر بذكر الله والتكبير المقيد بعد الصلوات',
      virtue: 'أيام أكل وشرب وذكر لله تعالى؛ وهي الأيام المعدودات المذكورة في القرآن: ﴿وَاذْكُرُوا اللَّهَ فِي أَيَّامٍ مَّعْدُودَاتٍ﴾.',
      hadith: '«أيَّامُ التَّشريقِ أيَّامُ أَكْلٍ وشُربٍ وذِكْرٍ للهِ»',
      hadithSource: 'صحيح مسلم (1141)',
      recommendedActs: [
        'الاستمرار بالتكبير المقيد دبر كل صلاة مكتوبة حتى عصر اليوم الثالث عشر',
        'ذكر الله بالتسمية والتحميد عند الأكل والشرب',
        'النهي عن صيامها إلا لمتمتع أو قارن لم يجد الهدي',
        'الاجتهاد في الذكر والدعاء'
      ],
      type: 'annual_season',
      iconType: 'heart'
    });
  }

  // 13. صيام عاشوراء وتاسوعاء (9 و 10 محرم)
  const nextAshura = findNextHijriDate(1, 10, startDate);
  if (nextAshura) {
    occasions.push({
      id: `ashura-${nextAshura.hijri.year}`,
      title: 'صيام يوم عاشوراء وتاسوعاء',
      categoryLabel: 'مواسم الطاعات الكبرى',
      timingBadge: formatBadge(nextAshura.daysRemaining),
      daysRemaining: nextAshura.daysRemaining,
      hijriDateText: `9 و 10 محرم ${nextAshura.hijri.year} هـ`,
      gregorianDateText: nextAshura.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'يوم نجّى الله فيه موسى، وصيامه يُكفّر ذنوب سنة ماضية',
      virtue: 'يوم عظيم ونافلة جليلة، يكفّر الله بصيامه ذنوب السنة الماضية كلها فضلاً منه وكرماً، ويُسن صيام تاسوعاء معه لمخالفة أهل الكتاب.',
      hadith: '«صِيَامُ يَوْمِ عَاشُورَاءَ، أَحْتَسِبُ عَلَى اللهِ أَنْ يُكَفِّرَ السَّنَةَ الَّتِي قَبْلَهُ»',
      hadithSource: 'صحيح مسلم (1162)',
      hadithExplanation: 'الصيام يكفر صغائر الذنوب ويزيد في الحسنات، وينبغي مع الصيام التوبة والاستغفار.',
      recommendedActs: [
        'صيام يوم عاشوراء احتساباً لتكفير ذنوب سنة كاملة',
        'صيام اليوم التاسع (تاسوعاء) معه لموافقة سُنّة النبي ﷺ',
        'كثرة الدعاء عند الإفطار فإن للصائم دعوة لا تُرد',
        'الإكثار من الصيام في شهر الله المحرم'
      ],
      type: 'annual_season',
      iconType: 'sparkles'
    });
  }

  // 14. شهر شعبان ورفع الأعمال (1 شعبان)
  const nextShaban = findNextHijriDate(8, 1, startDate);
  if (nextShaban) {
    occasions.push({
      id: `shaban-${nextShaban.hijri.year}`,
      title: 'شهر شعبان ورفع الأعمال',
      categoryLabel: 'سُنّة الإكثار من الصيام',
      timingBadge: formatBadge(nextShaban.daysRemaining),
      daysRemaining: nextShaban.daysRemaining,
      hijriDateText: `1 شعبان ${nextShaban.hijri.year} هـ`,
      gregorianDateText: nextShaban.date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      shortDescription: 'تُرفع فيه الأعمال إلى رب العالمين، والاستعداد لرمضان',
      virtue: 'كان النبي ﷺ يكثر من صيام شعبان حتى قيل لا يفطر، وسُئل فقال: «ذاك شهر يغفل الناس عنه... وأحب أن يُرفع عملي وأنا صائم».',
      hadith: '«ذاكَ شَهْرٌ يَغْفُلُ النَّاسُ عَنْهُ بَيْنَ رَجَبٍ وَرَمَضَانَ، وَهُوَ شَهْرٌ تُرْفَعُ فِيهِ الأَعْمَالُ إِلَى رَبِّ العَالَمِينَ، فَأُحِبُّ أَنْ يُرْفَعَ عَمَلِي وَأَنَا صَائِمٌ»',
      hadithSource: 'سنن النسائي (2357) وحسنه الألباني',
      recommendedActs: [
        'الإكثار من صيام التطوع في شعبان اقتداءً بالنبي ﷺ',
        'قضاء ما فات من صيام رمضان الماضي قبل حلول رمضان الجديد',
        'الإقبال على تلاوة القرآن وتهيئة النفس للعبادة',
        'إصلاح القلوب ونبذ الشحناء والخصومة'
      ],
      type: 'annual_season',
      iconType: 'moon'
    });
  }

  // فرز جميع المناسبات ترتيباً زمنياً تصاعدياً حسب الأيام المتبقية (الأقرب فالأقرب)
  occasions.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return occasions.slice(0, limit);
}

/**
 * Returns the single nearest occasion for the Home Card
 */
export function getNearestOccasion(startDate: Date = new Date()): IslamicOccasion {
  const list = getUpcomingOccasions(1, startDate);
  if (list.length > 0) return list[0];

  const hijri = getHijriDate(startDate);
  return {
    id: 'default-dhikr',
    title: 'سُنن اليوم والأذكار',
    categoryLabel: 'مواسم الطاعات',
    timingBadge: 'اليوم',
    daysRemaining: 0,
    hijriDateText: hijri.formatted,
    gregorianDateText: startDate.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    shortDescription: 'تعاهد أذكار الصباح والمساء والسنن الرواتب',
    virtue: 'الدوام على الطاعة وإن قلّت أحب الأعمال إلى الله تعالى.',
    hadith: '«أَحَبُّ الأعمالِ إلى اللهِ أدْوَمُها وإنْ قَلَّ»',
    hadithSource: 'صحيح البخاري ومسلم',
    recommendedActs: [
      'المحافظة على الصلوات في أوقاتها',
      'صلاة ركعتي الضحى والسنن الرواتب',
      'قراءة ورد من القرآن الكريم',
      'كثرة الاستغفار والصلاة على النبي ﷺ'
    ],
    type: 'dhikr',
    iconType: 'sparkles'
  };
}
