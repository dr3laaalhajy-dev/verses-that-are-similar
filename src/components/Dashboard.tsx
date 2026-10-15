import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Bell, Settings, X, ChevronDown, Info, RefreshCw, Compass } from 'lucide-react';
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
  className?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ className = '' }) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; timeLeft: string } | null>(null);
  const [locationName, setLocationName] = useState<string>('موقع محسوب محلياً');
  const [isLocating, setIsLocating] = useState(false);

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

  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      const makkah = { lat: 21.4225, lng: 39.8262 };
      setCoords(makkah);
      setLocationName('مكة المكرمة (تلقائي)');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        localStorage.setItem('quran_user_lat', latitude.toString());
        localStorage.setItem('quran_user_lng', longitude.toString());
        setCoords({ lat: latitude, lng: longitude });
        setLocationName('موقعك الجغرافي');
        setIsLocating(false);
      },
      () => {
        const makkah = { lat: 21.4225, lng: 39.8262 };
        setCoords(makkah);
        setLocationName('مكة المكرمة (تلقائي)');
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  }, []);

  // 1. Initialize Coordinates (from localStorage or Geolocation)
  useEffect(() => {
    const savedLat = localStorage.getItem('quran_user_lat');
    const savedLng = localStorage.getItem('quran_user_lng');

    if (savedLat && savedLng) {
      setCoords({ lat: parseFloat(savedLat), lng: parseFloat(savedLng) });
      setLocationName('موقعك المحفوظ');
    } else {
      requestGeolocation();
    }
  }, [requestGeolocation]);

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
    <div className={`w-full h-full relative ${className}`} dir="rtl">
      {/* Luxury Islamic Prayer Times Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full h-full bg-gradient-to-br from-emerald-50/90 via-white to-amber-50/40 border border-emerald-200/60 shadow-xl shadow-emerald-950/5 p-4 sm:p-5 rounded-3xl relative overflow-hidden backdrop-blur-md flex flex-col justify-between"
      >
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-300/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-300/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Top Header Bar: Location & Settings Button */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-emerald-100/70 relative z-10">
          {/* Location Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/80 border border-emerald-200/50 rounded-full text-xs font-bold text-slate-700 shadow-xs">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate max-w-[150px] sm:max-w-none">{locationName}</span>
            <span className="text-slate-300">•</span>
            <span className="text-[10px] text-emerald-700 font-semibold truncate hidden sm:inline">
              {ADHAN_METHODS[selectedMethod]?.name.split('(')[0].trim()}
            </span>
          </div>

          {/* Elevated Settings Pill Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-full font-bold text-xs transition-all shadow-md shadow-emerald-700/20 group"
            title="إعدادات مواقيت الصلاة وطريقة الحساب"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-100 transition-transform duration-300 group-hover:rotate-90" />
            <span>إعدادات المواقيت</span>
          </button>
        </div>

        {/* Main Next Prayer & Countdown Showcase */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 relative z-10">
          {/* Next Prayer Details */}
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-emerald-700 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-700/25 border border-emerald-500/40 shrink-0">
              <Bell className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[11px] md:text-xs font-bold text-emerald-800">الصلاة القادمة</span>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {nextPrayer?.name || 'جاري الحساب...'}
                </h3>
                {nextPrayer?.time && (
                  <span className="text-xs md:text-sm font-bold text-slate-500 tabular-nums">
                    ({nextPrayer.time})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Countdown Display */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto bg-white/70 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-emerald-100/60">
            <span className="text-xs font-bold text-slate-500 sm:hidden">متبقي على الأذان:</span>
            <div className="text-left sm:text-left">
              <div className="text-2xl sm:text-3xl md:text-4xl font-black text-emerald-700 tabular-nums tracking-tight font-mono">
                {nextPrayer ? nextPrayer.timeLeft : '00:00:00'}
              </div>
              <span className="text-[10px] md:text-[11px] font-bold text-slate-400 hidden sm:block text-left">
                متبقي حتى رفع الأذان
              </span>
            </div>
          </div>
        </div>

        {/* Five Prayers Grid */}
        <div className="w-full mt-3 pt-3 border-t border-emerald-100/70 grid grid-cols-5 gap-1.5 sm:gap-2.5 relative z-10">
          {prayerTimes && Object.entries(prayerTimes).map(([name, time]) => {
            const isNext = nextPrayer?.name === prayerNamesAr[name];
            return (
              <div
                key={name}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 ${
                  isNext
                    ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-700/25 scale-[1.02] border border-emerald-500'
                    : 'bg-white/75 hover:bg-white text-slate-600 border border-emerald-100/60'
                }`}
              >
                <span className={`text-[10px] sm:text-xs font-black mb-1 truncate w-full text-center ${
                  isNext ? 'text-amber-200' : 'text-slate-500'
                }`}>
                  {prayerNamesAr[name]}
                </span>
                <span className={`text-xs sm:text-sm md:text-base font-black tabular-nums tracking-tight ${
                  isNext ? 'text-white' : 'text-slate-800'
                }`}>
                  {time}
                </span>
                {isNext && (
                  <span className="mt-1 text-[8px] bg-amber-400 text-emerald-950 font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter">
                    القادمة
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden text-right border border-emerald-100 max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 left-4 p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 border border-emerald-100">
                <Settings className="w-7 h-7" />
              </div>

              <h2 className="text-xl md:text-2xl font-black text-slate-900 text-center mb-1">إعدادات مواقيت الصلاة</h2>
              <p className="text-xs text-slate-500 text-center mb-6 font-medium">خصص طريقة الحساب والمذهب والموقع لحساب أدق للأوقات</p>

              <div className="space-y-6">
                {/* Location Detection Section */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">الموقع المعتمد:</span>
                      <span className="text-xs text-emerald-700 font-bold">{locationName}</span>
                    </div>
                  </div>
                  <button
                    onClick={requestGeolocation}
                    disabled={isLocating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>تحديث الموقع</span>
                  </button>
                </div>

                {/* Calculation Method */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">طريقة الحساب المعتمدة:</label>
                  <div className="relative">
                    <select
                      value={selectedMethod}
                      onChange={(e) => setSelectedMethod(e.target.value as any)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all appearance-none text-sm"
                      dir="rtl"
                    >
                      {Object.entries(ADHAN_METHODS).map(([key, { name }]) => (
                        <option key={key} value={key}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Madhab */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">المذهب الفقهي (توقيت العصر):</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.entries(ADHAN_MADHABS).map(([key, { name }]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedMadhab(key as any)}
                        className={`p-3 rounded-2xl font-bold text-xs md:text-sm transition-all border ${
                          selectedMadhab === key
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200/60 p-3.5 rounded-2xl flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                    يتم حساب جميع المواقيت بدقة محلياً عبر خطوط الطول والعرض وفق المعايير الفلكية الإسلامية المعتمدة.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="mt-6 w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-700/20 active:scale-98"
              >
                حفظ وإغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
