import * as adhan from 'adhan';

export interface CityData {
  name: string;
  lat: number;
  lng: number;
  method: keyof typeof ADHAN_METHODS;
}

export interface CountryData {
  name: string;
  code: string;
  defaultCity: string;
  cities: CityData[];
}

export const ADHAN_METHODS = {
  UmmAlQura: { name: 'أم القرى (السعودية)', fn: adhan.CalculationMethod.UmmAlQura },
  Egyptian: { name: 'الهيئة المصرية العامة للمساحة', fn: adhan.CalculationMethod.Egyptian },
  MuslimWorldLeague: { name: 'رابطة العالم الإسلامي', fn: adhan.CalculationMethod.MuslimWorldLeague },
  Dubai: { name: 'دبي (الإمارات)', fn: adhan.CalculationMethod.Dubai },
  Qatar: { name: 'قطر', fn: adhan.CalculationMethod.Qatar },
  Kuwait: { name: 'الكويت', fn: adhan.CalculationMethod.Kuwait },
  NorthAmerica: { name: 'أمريكا الشمالية (ISNA)', fn: adhan.CalculationMethod.NorthAmerica },
  Turkey: { name: 'تركيا (Diyanet)', fn: adhan.CalculationMethod.Turkey },
};

export const PRAYER_COUNTRIES: CountryData[] = [
  {
    name: 'مصر',
    code: 'EG',
    defaultCity: 'القاهرة',
    cities: [
      { name: 'القاهرة', lat: 30.0444, lng: 31.2357, method: 'Egyptian' },
      { name: 'الإسكندرية', lat: 31.2001, lng: 29.9187, method: 'Egyptian' },
      { name: 'الجيزة', lat: 30.0131, lng: 31.2089, method: 'Egyptian' },
      { name: 'المنصورة', lat: 31.0409, lng: 31.3785, method: 'Egyptian' },
      { name: 'طنطا', lat: 30.7865, lng: 31.0004, method: 'Egyptian' },
      { name: 'الزقازيق', lat: 30.5877, lng: 31.5020, method: 'Egyptian' },
      { name: 'أسيوط', lat: 27.1810, lng: 31.1837, method: 'Egyptian' },
      { name: 'سوهاج', lat: 26.5570, lng: 31.6948, method: 'Egyptian' },
      { name: 'بورسعيد', lat: 31.2653, lng: 32.3019, method: 'Egyptian' },
      { name: 'السويس', lat: 29.9668, lng: 32.5498, method: 'Egyptian' },
      { name: 'الإسماعيلية', lat: 30.6043, lng: 32.2723, method: 'Egyptian' },
      { name: 'الأقصر', lat: 25.6872, lng: 32.6396, method: 'Egyptian' },
      { name: 'أسوان', lat: 24.0889, lng: 32.8998, method: 'Egyptian' },
      { name: 'قنا', lat: 26.1551, lng: 32.7160, method: 'Egyptian' },
      { name: 'بني سويف', lat: 29.0661, lng: 31.0994, method: 'Egyptian' },
      { name: 'الفيوم', lat: 29.3084, lng: 30.8428, method: 'Egyptian' },
      { name: 'دمياط', lat: 31.4175, lng: 31.8144, method: 'Egyptian' },
      { name: 'مطروح', lat: 31.3543, lng: 27.2373, method: 'Egyptian' },
      { name: 'شرم الشيخ', lat: 27.9158, lng: 34.3299, method: 'Egyptian' },
      { name: 'الغردقة', lat: 27.2579, lng: 33.8116, method: 'Egyptian' },
    ]
  },
  {
    name: 'المملكة العربية السعودية',
    code: 'SA',
    defaultCity: 'مكة المكرمة',
    cities: [
      { name: 'مكة المكرمة', lat: 21.4225, lng: 39.8262, method: 'UmmAlQura' },
      { name: 'المدينة المنورة', lat: 24.5247, lng: 39.5692, method: 'UmmAlQura' },
      { name: 'الرياض', lat: 24.7136, lng: 46.6753, method: 'UmmAlQura' },
      { name: 'جدة', lat: 21.5433, lng: 39.1728, method: 'UmmAlQura' },
      { name: 'الدمام', lat: 26.4207, lng: 50.0888, method: 'UmmAlQura' },
      { name: 'الخبر', lat: 26.2172, lng: 50.1971, method: 'UmmAlQura' },
      { name: 'الطائف', lat: 21.2854, lng: 40.4248, method: 'UmmAlQura' },
      { name: 'تبوك', lat: 28.3835, lng: 36.5662, method: 'UmmAlQura' },
      { name: 'بريدة / القصيم', lat: 26.3260, lng: 43.9750, method: 'UmmAlQura' },
      { name: 'أبها', lat: 18.2164, lng: 42.5053, method: 'UmmAlQura' },
      { name: 'خميس مشيط', lat: 18.3000, lng: 42.7333, method: 'UmmAlQura' },
      { name: 'حائل', lat: 27.5114, lng: 41.7208, method: 'UmmAlQura' },
      { name: 'نجران', lat: 17.4924, lng: 44.1277, method: 'UmmAlQura' },
      { name: 'جازان', lat: 16.8892, lng: 42.5511, method: 'UmmAlQura' },
      { name: 'ينبع', lat: 24.0891, lng: 38.0618, method: 'UmmAlQura' },
      { name: 'الأحساء / الهفوف', lat: 25.3647, lng: 49.5855, method: 'UmmAlQura' },
      { name: 'الجبيل', lat: 27.0117, lng: 49.6582, method: 'UmmAlQura' },
      { name: 'عرعر', lat: 30.9753, lng: 41.0381, method: 'UmmAlQura' },
      { name: 'سكاكا / الجوف', lat: 29.9697, lng: 40.2064, method: 'UmmAlQura' },
    ]
  },
  {
    name: 'الإمارات العربية المتحدة',
    code: 'AE',
    defaultCity: 'دبي',
    cities: [
      { name: 'دبي', lat: 25.2048, lng: 55.2708, method: 'Dubai' },
      { name: 'أبوظبي', lat: 24.4539, lng: 54.3773, method: 'Dubai' },
      { name: 'الشارقة', lat: 25.3463, lng: 55.4209, method: 'Dubai' },
      { name: 'عجمان', lat: 25.4052, lng: 55.5136, method: 'Dubai' },
      { name: 'رأس الخيمة', lat: 25.7895, lng: 55.9432, method: 'Dubai' },
      { name: 'الفجيرة', lat: 25.1288, lng: 56.3265, method: 'Dubai' },
      { name: 'أم القيوين', lat: 25.5647, lng: 55.5552, method: 'Dubai' },
      { name: 'العين', lat: 24.2075, lng: 55.7447, method: 'Dubai' },
    ]
  },
  {
    name: 'الكويت',
    code: 'KW',
    defaultCity: 'مدينة الكويت',
    cities: [
      { name: 'مدينة الكويت', lat: 29.3759, lng: 47.9774, method: 'Kuwait' },
      { name: 'حولي', lat: 29.3328, lng: 48.0289, method: 'Kuwait' },
      { name: 'الأحمدي', lat: 29.0769, lng: 48.0839, method: 'Kuwait' },
      { name: 'الجهراء', lat: 29.3375, lng: 47.6581, method: 'Kuwait' },
      { name: 'الفروانية', lat: 29.2784, lng: 47.9583, method: 'Kuwait' },
      { name: 'مبارك الكبير', lat: 29.1867, lng: 48.0772, method: 'Kuwait' },
    ]
  },
  {
    name: 'قطر',
    code: 'QA',
    defaultCity: 'الدوحة',
    cities: [
      { name: 'الدوحة', lat: 25.2854, lng: 51.5310, method: 'Qatar' },
      { name: 'الريان', lat: 25.2919, lng: 51.4244, method: 'Qatar' },
      { name: 'الوكرة', lat: 25.1768, lng: 51.6048, method: 'Qatar' },
      { name: 'الخور', lat: 25.6839, lng: 51.5058, method: 'Qatar' },
      { name: 'أم صلال', lat: 25.4189, lng: 51.4055, method: 'Qatar' },
    ]
  },
  {
    name: 'البحرين',
    code: 'BH',
    defaultCity: 'المنامة',
    cities: [
      { name: 'المنامة', lat: 26.2285, lng: 50.5860, method: 'MuslimWorldLeague' },
      { name: 'المحرق', lat: 26.2572, lng: 50.6119, method: 'MuslimWorldLeague' },
      { name: 'الرفاع', lat: 26.1300, lng: 50.5550, method: 'MuslimWorldLeague' },
      { name: 'مدينة حمد', lat: 26.1153, lng: 50.5069, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'سلطنة عُمان',
    code: 'OM',
    defaultCity: 'مسقط',
    cities: [
      { name: 'مسقط', lat: 23.5880, lng: 58.3829, method: 'MuslimWorldLeague' },
      { name: 'صلالة', lat: 17.0151, lng: 54.0924, method: 'MuslimWorldLeague' },
      { name: 'صحار', lat: 24.3474, lng: 56.7095, method: 'MuslimWorldLeague' },
      { name: 'نزوى', lat: 22.9333, lng: 57.5333, method: 'MuslimWorldLeague' },
      { name: 'صور', lat: 22.5667, lng: 59.5289, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'الأردن',
    code: 'JO',
    defaultCity: 'عمّان',
    cities: [
      { name: 'عمّان', lat: 31.9454, lng: 35.9284, method: 'MuslimWorldLeague' },
      { name: 'الزرقاء', lat: 32.0728, lng: 36.0880, method: 'MuslimWorldLeague' },
      { name: 'إربد', lat: 32.5568, lng: 35.8469, method: 'MuslimWorldLeague' },
      { name: 'العقبة', lat: 29.5321, lng: 35.0063, method: 'MuslimWorldLeague' },
      { name: 'السلط', lat: 32.0392, lng: 35.7272, method: 'MuslimWorldLeague' },
      { name: 'مادبا', lat: 31.7167, lng: 35.7936, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'فلسطين',
    code: 'PS',
    defaultCity: 'القدس الشريف',
    cities: [
      { name: 'القدس الشريف', lat: 31.7683, lng: 35.2137, method: 'MuslimWorldLeague' },
      { name: 'غزة', lat: 31.5017, lng: 34.4668, method: 'Egyptian' },
      { name: 'خان يونس', lat: 31.3462, lng: 34.3063, method: 'Egyptian' },
      { name: 'رفح', lat: 31.2800, lng: 34.2500, method: 'Egyptian' },
      { name: 'رام الله', lat: 31.9038, lng: 35.2034, method: 'MuslimWorldLeague' },
      { name: 'نابلس', lat: 32.2227, lng: 35.2621, method: 'MuslimWorldLeague' },
      { name: 'الخليل', lat: 31.5294, lng: 35.0938, method: 'MuslimWorldLeague' },
      { name: 'جنين', lat: 32.4647, lng: 35.2959, method: 'MuslimWorldLeague' },
      { name: 'طولكرم', lat: 32.3125, lng: 35.0275, method: 'MuslimWorldLeague' },
      { name: 'بيت لحم', lat: 31.7054, lng: 35.2024, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'العراق',
    code: 'IQ',
    defaultCity: 'بغداد',
    cities: [
      { name: 'بغداد', lat: 33.3152, lng: 44.3661, method: 'MuslimWorldLeague' },
      { name: 'البصرة', lat: 30.5085, lng: 47.7804, method: 'MuslimWorldLeague' },
      { name: 'الموصل', lat: 36.3400, lng: 43.1300, method: 'MuslimWorldLeague' },
      { name: 'أربيل', lat: 36.1901, lng: 44.0091, method: 'MuslimWorldLeague' },
      { name: 'النجف الأشرف', lat: 32.0000, lng: 44.3333, method: 'MuslimWorldLeague' },
      { name: 'كربلاء المقدسة', lat: 32.6160, lng: 44.0249, method: 'MuslimWorldLeague' },
      { name: 'السليمانية', lat: 35.5570, lng: 45.4350, method: 'MuslimWorldLeague' },
      { name: 'كركوك', lat: 35.4681, lng: 44.3922, method: 'MuslimWorldLeague' },
      { name: 'دهوك', lat: 36.8679, lng: 42.9886, method: 'MuslimWorldLeague' },
      { name: 'الرمادي', lat: 33.4219, lng: 43.3039, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'سوريا',
    code: 'SY',
    defaultCity: 'دمشق',
    cities: [
      { name: 'دمشق', lat: 33.5138, lng: 36.2765, method: 'MuslimWorldLeague' },
      { name: 'حلب', lat: 36.2021, lng: 37.1343, method: 'MuslimWorldLeague' },
      { name: 'حمص', lat: 34.7324, lng: 36.7137, method: 'MuslimWorldLeague' },
      { name: 'اللاذقية', lat: 35.5317, lng: 35.7901, method: 'MuslimWorldLeague' },
      { name: 'حماة', lat: 35.1318, lng: 36.7578, method: 'MuslimWorldLeague' },
      { name: 'طرطوس', lat: 34.8890, lng: 35.8866, method: 'MuslimWorldLeague' },
      { name: 'دير الزور', lat: 35.3359, lng: 40.1408, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'لبنان',
    code: 'LB',
    defaultCity: 'بيروت',
    cities: [
      { name: 'بيروت', lat: 33.8938, lng: 35.5018, method: 'MuslimWorldLeague' },
      { name: 'طرابلس', lat: 34.4367, lng: 35.8497, method: 'MuslimWorldLeague' },
      { name: 'صيدا', lat: 33.5631, lng: 35.3689, method: 'MuslimWorldLeague' },
      { name: 'صور', lat: 33.2733, lng: 35.1939, method: 'MuslimWorldLeague' },
      { name: 'زحلة', lat: 33.8463, lng: 35.9020, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'اليمن',
    code: 'YE',
    defaultCity: 'صنعاء',
    cities: [
      { name: 'صنعاء', lat: 15.3694, lng: 44.1910, method: 'UmmAlQura' },
      { name: 'عدن', lat: 12.7855, lng: 45.0187, method: 'UmmAlQura' },
      { name: 'تعز', lat: 13.5795, lng: 44.0209, method: 'UmmAlQura' },
      { name: 'الحديدة', lat: 14.7978, lng: 42.9545, method: 'UmmAlQura' },
      { name: 'المكلا / حضرموت', lat: 14.5425, lng: 49.1242, method: 'UmmAlQura' },
      { name: 'إب', lat: 13.9667, lng: 44.1833, method: 'UmmAlQura' },
    ]
  },
  {
    name: 'المغرب',
    code: 'MA',
    defaultCity: 'الرباط',
    cities: [
      { name: 'الرباط', lat: 34.0209, lng: -6.8416, method: 'MuslimWorldLeague' },
      { name: 'الدار البيضاء', lat: 33.5731, lng: -7.5898, method: 'MuslimWorldLeague' },
      { name: 'مراكش', lat: 31.6295, lng: -7.9811, method: 'MuslimWorldLeague' },
      { name: 'فاس', lat: 34.0181, lng: -5.0078, method: 'MuslimWorldLeague' },
      { name: 'طنجة', lat: 35.7595, lng: -5.8340, method: 'MuslimWorldLeague' },
      { name: 'أكادير', lat: 30.4278, lng: -9.5981, method: 'MuslimWorldLeague' },
      { name: 'مكناس', lat: 33.8935, lng: -5.5473, method: 'MuslimWorldLeague' },
      { name: 'وجدة', lat: 34.6867, lng: -1.9114, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'الجزائر',
    code: 'DZ',
    defaultCity: 'الجزائر العاصمة',
    cities: [
      { name: 'الجزائر العاصمة', lat: 36.7538, lng: 3.0588, method: 'MuslimWorldLeague' },
      { name: 'وهران', lat: 35.6987, lng: -0.6349, method: 'MuslimWorldLeague' },
      { name: 'قسنطينة', lat: 36.3650, lng: 6.6147, method: 'MuslimWorldLeague' },
      { name: 'عنابة', lat: 36.9000, lng: 7.7667, method: 'MuslimWorldLeague' },
      { name: 'سطيف', lat: 36.1911, lng: 5.4137, method: 'MuslimWorldLeague' },
      { name: 'باتنة', lat: 35.5558, lng: 6.1742, method: 'MuslimWorldLeague' },
      { name: 'تلمسان', lat: 34.8783, lng: -1.3150, method: 'MuslimWorldLeague' },
      { name: 'البليدة', lat: 36.4700, lng: 2.8300, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'تونس',
    code: 'TN',
    defaultCity: 'تونس العاصمة',
    cities: [
      { name: 'تونس العاصمة', lat: 36.8065, lng: 10.1815, method: 'MuslimWorldLeague' },
      { name: 'صفاقس', lat: 34.7406, lng: 10.7603, method: 'MuslimWorldLeague' },
      { name: 'سوسة', lat: 35.8256, lng: 10.6369, method: 'MuslimWorldLeague' },
      { name: 'القيروان', lat: 35.6781, lng: 10.0963, method: 'MuslimWorldLeague' },
      { name: 'بنزرت', lat: 37.2744, lng: 9.8739, method: 'MuslimWorldLeague' },
      { name: 'قابس', lat: 33.8815, lng: 10.0982, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'ليبيا',
    code: 'LY',
    defaultCity: 'طرابلس',
    cities: [
      { name: 'طرابلس', lat: 32.8872, lng: 13.1913, method: 'MuslimWorldLeague' },
      { name: 'بنغازي', lat: 32.1167, lng: 20.0667, method: 'Egyptian' },
      { name: 'مصراتة', lat: 32.3754, lng: 15.0925, method: 'MuslimWorldLeague' },
      { name: 'الزاوية', lat: 32.7522, lng: 12.7278, method: 'MuslimWorldLeague' },
      { name: 'سبها', lat: 27.0377, lng: 14.4283, method: 'MuslimWorldLeague' },
    ]
  },
  {
    name: 'السودان',
    code: 'SD',
    defaultCity: 'الخرطوم',
    cities: [
      { name: 'الخرطوم', lat: 15.5007, lng: 32.5599, method: 'Egyptian' },
      { name: 'أم درمان', lat: 15.6500, lng: 32.4833, method: 'Egyptian' },
      { name: 'بورتسودان', lat: 19.6167, lng: 37.2167, method: 'Egyptian' },
      { name: 'كسلا', lat: 15.4510, lng: 36.4000, method: 'Egyptian' },
      { name: 'ود مدني', lat: 14.4012, lng: 33.5199, method: 'Egyptian' },
    ]
  },
  {
    name: 'تركيا',
    code: 'TR',
    defaultCity: 'إسطنبول',
    cities: [
      { name: 'إسطنبول', lat: 41.0082, lng: 28.9784, method: 'Turkey' },
      { name: 'أنقرة', lat: 39.9334, lng: 32.8597, method: 'Turkey' },
      { name: 'إزمير', lat: 38.4237, lng: 27.1428, method: 'Turkey' },
      { name: 'بورصة', lat: 40.1885, lng: 29.0610, method: 'Turkey' },
      { name: 'أنطاليا', lat: 36.8969, lng: 30.7133, method: 'Turkey' },
      { name: 'غازي عنتاب', lat: 37.0662, lng: 37.3833, method: 'Turkey' },
      { name: 'قونية', lat: 37.8714, lng: 32.4846, method: 'Turkey' },
    ]
  },
  {
    name: 'دول أخرى (المهجر)',
    code: 'OTHER',
    defaultCity: 'لندن (بريطانيا)',
    cities: [
      { name: 'لندن (بريطانيا)', lat: 51.5074, lng: -0.1278, method: 'MuslimWorldLeague' },
      { name: 'مانشستر (بريطانيا)', lat: 53.4808, lng: -2.2426, method: 'MuslimWorldLeague' },
      { name: 'برلين (ألمانيا)', lat: 52.5200, lng: 13.4050, method: 'MuslimWorldLeague' },
      { name: 'فرانكفورت (ألمانيا)', lat: 50.1109, lng: 8.6821, method: 'MuslimWorldLeague' },
      { name: 'باريس (فرنسا)', lat: 48.8566, lng: 2.3522, method: 'MuslimWorldLeague' },
      { name: 'أمستردام (هولندا)', lat: 52.3676, lng: 4.9041, method: 'MuslimWorldLeague' },
      { name: 'بروكسل (بلجيكا)', lat: 50.8503, lng: 4.3517, method: 'MuslimWorldLeague' },
      { name: 'فيينا (النمسا)', lat: 48.2082, lng: 16.3738, method: 'MuslimWorldLeague' },
      { name: 'ستوكهولم (السويد)', lat: 59.3293, lng: 18.0686, method: 'MuslimWorldLeague' },
      { name: 'نيويورك (الولايات المتحدة)', lat: 40.7128, lng: -74.0060, method: 'NorthAmerica' },
      { name: 'شيكاغو (الولايات المتحدة)', lat: 41.8781, lng: -87.6298, method: 'NorthAmerica' },
      { name: 'لوس أنجلوس (الولايات المتحدة)', lat: 34.0522, lng: -118.2437, method: 'NorthAmerica' },
      { name: 'تورونتو (كندا)', lat: 43.6532, lng: -79.3832, method: 'NorthAmerica' },
      { name: 'سيدني (أستراليا)', lat: -33.8688, lng: 151.2093, method: 'MuslimWorldLeague' },
    ]
  }
];

export interface PrayerTimesDict {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export function calculateTimesForCoordinates(
  lat: number,
  lng: number,
  methodKey: keyof typeof ADHAN_METHODS = 'UmmAlQura',
  date: Date = new Date()
): PrayerTimesDict {
  const adhanCoords = new adhan.Coordinates(lat, lng);
  const methodObj = ADHAN_METHODS[methodKey] || ADHAN_METHODS.UmmAlQura;
  const params = methodObj.fn();
  params.madhab = adhan.Madhab.Shafi;

  const pt = new adhan.PrayerTimes(adhanCoords, date, params);
  const format = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

  return {
    Fajr: format(pt.fajr),
    Dhuhr: format(pt.dhuhr),
    Asr: format(pt.asr),
    Maghrib: format(pt.maghrib),
    Isha: format(pt.isha)
  };
}
