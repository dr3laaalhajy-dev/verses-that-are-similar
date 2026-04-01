import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Flame, Bell, Settings, X, ChevronDown, Info } from 'lucide-react';
import * as adhan from 'adhan';

// Configuration Mappings
const ADHAN_METHODS = {
  UmmAlQura: { name: 'أم القرى (السعودية)', fn: adhan.CalculationMethod.UmmAlQura },
  Egyptian: { name: 'الهيئة المصرية العامة للمساحة', fn: adhan.CalculationMethod.Egyptian },
  MuslimWorldLeague: { name: 'رابطة العالم الإسلامي', fn: adhan.CalculationMethod.MuslimWorldLeague },
  Dubai: { name: 'دبي (الإمارات)', fn: adhan.CalculationMethod.Dubai },
  Qatar: { name: 'قطر', fn: adhan.CalculationMethod.Qatar },
  Kuwait: { name: 'الكويت', fn: adhan.CalculationMethod.Kuwait },
  NorthAmerica: { name: 'أمريكا الشمالية (ISNA)', fn: adhan.CalculationMethod.NorthAmerica },
  Turkey: { name: 'تركيا (Diyanet)', fn: adhan.CalculationMethod.Turkey },
};

const ADHAN_MADHABS = {
  Shafi: { name: 'الشافعي / الجمهور', val: adhan.Madhab.Shafi },
  Hanafi: { name: 'الحنفي', val: adhan.Madhab.Hanafi },
};

interface PrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface DashboardProps {
  streakCount: number;
  onNextPrayerMessage?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ streakCount }) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; timeLeft: string } | null>(null);
  const [locationName, setLocationName] = useState<string>('موقع محسوب محلياً');

  // Settings State
  const [selectedMethod, setSelectedMethod] = useState<keyof typeof ADHAN_METHODS>(
    (localStorage.getItem('quran_prayer_method') as keyof typeof ADHAN_METHODS) || 'UmmAlQura'
  );
  const [selectedMadhab, setSelectedMadhab] = useState<keyof typeof ADHAN_MADHABS>(
    (localStorage.getItem('quran_prayer_madhab') as keyof typeof ADHAN_MADHABS) || 'Shafi'
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const prayerNamesAr: Record<string, string> = {
    Fajr: 'الفجر',
    Sunrise: 'الشروق',
    Dhuhr: 'الظهر',
    Asr: 'العصر',
    Maghrib: 'المغرب',
    Isha: 'العشاء'
  };

  // Persist Settings
  useEffect(() => {
    localStorage.setItem('quran_prayer_method', selectedMethod);
    localStorage.setItem('quran_prayer_madhab', selectedMadhab);
  }, [selectedMethod, selectedMadhab]);

  // 1. Initialize Coordinates (from localStorage or Geolocation)
  useEffect(() => {
    const savedLat = localStorage.getItem('quran_user_lat');
    const savedLng = localStorage.getItem('quran_user_lng');

    if (savedLat && savedLng) {
      setCoords({ lat: parseFloat(savedLat), lng: parseFloat(savedLng) });
      setLocationName('موقعك المحفوظ');
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          localStorage.setItem('quran_user_lat', latitude.toString());
          localStorage.setItem('quran_user_lng', longitude.toString());
          setCoords({ lat: latitude, lng: longitude });
          setLocationName('موقعك الحالي');
        },
        () => {
          const makkah = { lat: 21.4225, lng: 39.8262 };
          setCoords(makkah);
          setLocationName('مكة المكرمة (تلقائي)');
        }
      );
    } else {
      const makkah = { lat: 21.4225, lng: 39.8262 };
      setCoords(makkah);
      setLocationName('مكة المكرمة (تلقائي)');
    }
  }, []);

  // 2. Calculate Prayer Times Locally
  const calculateLocalTimes = useCallback(() => {
    if (!coords) return;

    const adhanCoords = new adhan.Coordinates(coords.lat, coords.lng);
    const params = ADHAN_METHODS[selectedMethod].fn();
    params.madhab = ADHAN_MADHABS[selectedMadhab].val;
    const date = new Date();
    const pt = new adhan.PrayerTimes(adhanCoords, date, params);

    const formatTime = (dateObj: Date) => {
      return dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    setPrayerTimes({
      Fajr: formatTime(pt.fajr),
      Dhuhr: formatTime(pt.dhuhr),
      Asr: formatTime(pt.asr),
      Maghrib: formatTime(pt.maghrib),
      Isha: formatTime(pt.isha)
    });
  }, [coords, selectedMethod, selectedMadhab]);

  useEffect(() => {
    calculateLocalTimes();
    const interval = setInterval(calculateLocalTimes, 3600000);
    return () => clearInterval(interval);
  }, [calculateLocalTimes]);

  // 3. Countdown Logic
  const calculateCountdown = useCallback(() => {
    if (!coords) return;

    const adhanCoords = new adhan.Coordinates(coords.lat, coords.lng);
    const params = ADHAN_METHODS[selectedMethod].fn();
    params.madhab = ADHAN_MADHABS[selectedMadhab].val;
    const now = new Date();

    let pt = new adhan.PrayerTimes(adhanCoords, now, params);
    let next = pt.nextPrayer();

    if (next === 'none' || !pt.timeForPrayer(next)) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      pt = new adhan.PrayerTimes(adhanCoords, tomorrow, params);
      next = 'fajr';
    }

    const nextTime = pt.timeForPrayer(next);
    if (!nextTime) return;

    const diff = nextTime.getTime() - now.getTime();

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    const prayerKey = next.charAt(0).toUpperCase() + next.slice(1);

    setNextPrayer({
      name: prayerNamesAr[prayerKey] || prayerKey,
      time: nextTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
      timeLeft: `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    });
  }, [coords, selectedMethod, selectedMadhab]);

  useEffect(() => {
    const timer = setInterval(calculateCountdown, 1000);
    return () => clearInterval(timer);
  }, [calculateCountdown]);

  return (
    <div className="grid grid-cols-3 gap-3 items-start mb-8 md:mb-12 relative">


      {/* Streak Card - Compact Widget (1/3 Width) */}
      <motion.div
        whileHover={{ y: -3 }}
        className="col-span-1 premium-card !h-fit !py-3 !md:py-4 md:p-5 bg-linear-to-br from-orange-50/80 to-white/40 border-orange-100/50 flex flex-col items-center justify-center gap-15 group rounded-xl md:rounded-[2rem]"
      >
        <div className={`relative ${streakCount > 0 ? 'streak-pulse' : ''}`}>
          <div className="absolute inset-0 bg-orange-500/20 blur-lg rounded-full scale-150 animate-pulse" />
          <div className={`w-8 h-8 md:w-16 md:h-16 bg-orange-500 rounded-lg md:rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 relative z-10`}>
            <Flame className={`w-4 h-4 md:w-8 md:h-8 text-white ${streakCount > 0 ? 'fill-current' : ''}`} />
          </div>
          {streakCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -left-1 md:-top-2 md:-left-2 z-20 flex h-4 w-4 md:h-6 md:w-6 items-center justify-center rounded-full bg-slate-900 text-white text-[8px] md:text-xs font-bold border-2 border-white shadow-lg"
            >
              {streakCount}
            </motion.div>
          )}
        </div>
        <div className="text-center">
          <h3 className="text-[10px] md:text-lg font-black text-slate-800 leading-none">الشعلة</h3>
          <p className="text-[8px] md:text-xs text-slate-500 font-bold mt-0.5">
            {streakCount > 0 ? `${streakCount} يوم` : 'ابدأ اليوم!'}
          </p>
        </div>
      </motion.div>

      {/* Prayer Times Card - Wide Widget (2/3 Width) */}
      <motion.div
        whileHover={{ y: -3 }}
        className="col-span-2 premium-card !h-fit !py-3 !md:py-4 md:p-5 bg-linear-to-br from-emerald-50/80 to-white/40 border-emerald-100/50 flex flex-col rounded-xl md:rounded-[2rem]"
      >

        <div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 hover:bg-emerald-50 rounded-full transition-colors text-slate-800 hover:text-emerald-600"
            title="إعدادات المواقيت"
          >
            <Settings className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
          </button>
          <span className="text-[8px] md:text-[15px] font-black text-slate-400 uppercase tracking-wider leading-none">اعدادات مواقيت الصلاة</span>

        </div>

        {/* Top: Next Prayer & Countdown */}
        <div className="flex items-center justify-between w-full mb-2 md:mb-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-600 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-md">
              <Bell className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">الصلاة القادمة</span>

              </div>
              <h3 className="text-xs md:text-xl font-black text-slate-800 leading-none">{nextPrayer?.name}</h3>
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg md:text-4xl font-black text-emerald-600 tabular-nums tracking-tighter leading-none">
              {nextPrayer ? nextPrayer.timeLeft : '00:00:00'}
            </div>
            <span className="text-[8px] md:text-[10px] font-bold text-slate-400 block mt-0.5">بانتظار الإجابة</span>
          </div>
        </div>

        {/* Bottom: All 5 prayers restored - Miniaturized for mobile spacing */}
        <div className="w-full mt-2 pt-2 border-t border-emerald-100/50 flex items-center justify-between px-0.5 md:px-2 gap-0.5 md:gap-2">
          {prayerTimes && Object.entries(prayerTimes).map(([name, time]) => {
            const isNext = nextPrayer?.name === prayerNamesAr[name];
            return (
              <div
                key={name}
                className={`flex-1 flex flex-col items-center justify-center py-1 md:py-2 rounded-lg transition-all ${isNext ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 px-0.5' : 'text-slate-500'}`}
              >
                <span className={`text-[7px] sm:text-[10px] font-black mb-0.5 ${isNext ? 'text-emerald-100' : 'text-slate-400'} text-center truncate w-full`}>
                  {prayerNamesAr[name]}
                </span>
                <span className="text-[9px] sm:text-xs font-black tabular-nums text-center leading-none">{time}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-10 max-w-lg w-full shadow-2xl relative overflow-hidden text-center islamic-watermark border border-emerald-100"
            >
              <div className="relative z-10">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="absolute top-0 left-0 p-3 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>

                <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-6 md:mb-8 text-emerald-600">
                  <Settings className="w-8 h-8" />
                </div>

                <h2 className="text-2xl md:text-3xl font-black text-brand-emerald mb-4">إعدادات المواقيت</h2>
                <div className="h-1 w-16 bg-emerald-100 rounded-full mx-auto mb-8" />

                <div className="space-y-8 text-right">
                  {/* Calculation Method */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">طريقة الحساب:</label>
                    <div className="relative">
                      <select
                        value={selectedMethod}
                        onChange={(e) => setSelectedMethod(e.target.value as any)}
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl appearance-none font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                        dir="rtl"
                      >
                        {Object.entries(ADHAN_METHODS).map(([key, { name }]) => (
                          <option key={key} value={key}>{name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Madhab */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">المذهب الفقهي:</label>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(ADHAN_MADHABS).map(([key, { name }]) => (
                        <button
                          key={key}
                          onClick={() => setSelectedMadhab(key as any)}
                          className={`p-4 rounded-2xl font-bold transition-all border ${selectedMadhab === key ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 p-4 rounded-xl flex items-start gap-3 mt-4">
                    <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 font-bold leading-relaxed">
                      يتم حفظ هذه الإعدادات محلياً وتستخدم لتصحيح مواقيت الصلاة بناءً على موقعك.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="mt-10 w-full py-5 bg-emerald-800 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
