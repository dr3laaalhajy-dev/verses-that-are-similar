import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Bell, Settings, X, RotateCcw, Globe, Sliders, CheckCircle2, Clock, Compass } from 'lucide-react';
import * as adhan from 'adhan';
import {
  PRAYER_COUNTRIES,
  CountryData,
  CityData,
  PrayerTimesDict,
  calculateTimesForCoordinates
} from '../data/prayerCities';

interface DashboardProps {
  streakCount: number;
  onNextPrayerMessage?: string;
  className?: string;
}

const prayerNamesAr: Record<string, string> = {
  Fajr: 'الفجر',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء'
};

const DEFAULT_TIMES: PrayerTimesDict = {
  Fajr: '04:30',
  Dhuhr: '12:00',
  Asr: '15:20',
  Maghrib: '18:00',
  Isha: '19:20'
};

const Dashboard: React.FC<DashboardProps> = ({ className = '' }) => {
  // Selected Country & City
  const [selectedCountryName, setSelectedCountryName] = useState<string>(() => {
    return localStorage.getItem('quran_manual_country') || 'مصر';
  });
  const [selectedCityName, setSelectedCityName] = useState<string>(() => {
    return localStorage.getItem('quran_manual_city') || 'القاهرة';
  });

  // Display location name
  const [locationName, setLocationName] = useState<string>(() => {
    return localStorage.getItem('quran_user_location_name') || 'القاهرة، مصر';
  });

  // Active prayer times
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesDict>(() => {
    const saved = localStorage.getItem('quran_custom_prayer_times');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return DEFAULT_TIMES;
  });

  const [nextPrayer, setNextPrayer] = useState<{ name: string; key: string; time: string; timeLeft: string } | null>(null);

  // Qibla Direction Angle
  const qiblaAngle = useMemo(() => {
    try {
      const country = PRAYER_COUNTRIES.find((c) => c.name === selectedCountryName) || PRAYER_COUNTRIES[0];
      const city = country?.cities.find((c) => c.name === selectedCityName) || country?.cities[0];
      if (city && typeof city.lat === 'number' && typeof city.lng === 'number') {
        const q = adhan.Qibla(new adhan.Coordinates(city.lat, city.lng));
        return Math.round(q);
      }
    } catch (e) {
      console.error("Error computing Qibla angle:", e);
    }
    return 136;
  }, [selectedCountryName, selectedCityName]);

  // Settings Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Body scroll lock when prayer times settings modal is open
  useEffect(() => {
    if (isSettingsOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isSettingsOpen]);
  const [tempCountry, setTempCountry] = useState(selectedCountryName);
  const [tempCity, setTempCity] = useState(selectedCityName);
  const [tempTimes, setTempTimes] = useState<PrayerTimesDict>(prayerTimes);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Current Country & City data in modal
  const currentCountryData = useMemo<CountryData>(() => {
    return PRAYER_COUNTRIES.find((c) => c.name === tempCountry) || PRAYER_COUNTRIES[0];
  }, [tempCountry]);

  const currentCityData = useMemo<CityData>(() => {
    return (
      currentCountryData.cities.find((city) => city.name === tempCity) ||
      currentCountryData.cities[0]
    );
  }, [currentCountryData, tempCity]);

  // Helper to compute default times for a city
  const getDefaultTimesForCity = useCallback((city: CityData): PrayerTimesDict => {
    return calculateTimesForCoordinates(city.lat, city.lng, city.method);
  }, []);

  // Country change handler
  const handleCountryChange = (countryName: string) => {
    setTempCountry(countryName);
    const country = PRAYER_COUNTRIES.find((c) => c.name === countryName);
    if (country && country.cities.length > 0) {
      const firstCity = country.cities.find(c => c.name === country.defaultCity) || country.cities[0];
      setTempCity(firstCity.name);
      const computed = getDefaultTimesForCity(firstCity);
      setTempTimes(computed);
    }
  };

  // City change handler
  const handleCityChange = (cityName: string) => {
    setTempCity(cityName);
    const city = currentCountryData.cities.find((c) => c.name === cityName);
    if (city) {
      const computed = getDefaultTimesForCity(city);
      setTempTimes(computed);
    }
  };

  // Reset to current city defaults
  const handleResetToCityDefaults = () => {
    if (currentCityData) {
      const computed = getDefaultTimesForCity(currentCityData);
      setTempTimes(computed);
      setFeedbackMsg('تمت استعادة أوقات المدينة الافتراضية بنجاح');
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  // On mount: ensure initial times are calculated if none saved
  useEffect(() => {
    const savedTimesStr = localStorage.getItem('quran_custom_prayer_times');
    if (!savedTimesStr) {
      const eg = PRAYER_COUNTRIES.find(c => c.name === selectedCountryName) || PRAYER_COUNTRIES[0];
      const city = eg.cities.find(c => c.name === selectedCityName) || eg.cities[0];
      const computed = calculateTimesForCoordinates(city.lat, city.lng, city.method);
      setPrayerTimes(computed);
      localStorage.setItem('quran_custom_prayer_times', JSON.stringify(computed));
    }
  }, [selectedCountryName, selectedCityName]);

  // Open modal & sync temporary states
  const handleOpenSettings = () => {
    setTempCountry(selectedCountryName);
    setTempCity(selectedCityName);
    setTempTimes({ ...prayerTimes });
    setFeedbackMsg(null);
    setIsSettingsOpen(true);
  };

  // Save changes
  const handleSaveSettings = () => {
    setSelectedCountryName(tempCountry);
    setSelectedCityName(tempCity);
    const newLocName = `${tempCity}، ${tempCountry}`;
    setLocationName(newLocName);
    setPrayerTimes(tempTimes);

    localStorage.setItem('quran_manual_country', tempCountry);
    localStorage.setItem('quran_manual_city', tempCity);
    localStorage.setItem('quran_user_location_name', newLocName);
    localStorage.setItem('quran_custom_prayer_times', JSON.stringify(tempTimes));

    const city = currentCountryData.cities.find((c) => c.name === tempCity);
    if (city) {
      localStorage.setItem('quran_user_lat', city.lat.toString());
      localStorage.setItem('quran_user_lng', city.lng.toString());
    }

    setIsSettingsOpen(false);
  };

  // Countdown calculation based on current prayerTimes
  const calculateCountdown = useCallback(() => {
    if (!prayerTimes) return;

    const now = new Date();
    const prayers = [
      { key: 'Fajr', name: 'الفجر', time: prayerTimes.Fajr },
      { key: 'Dhuhr', name: 'الظهر', time: prayerTimes.Dhuhr },
      { key: 'Asr', name: 'العصر', time: prayerTimes.Asr },
      { key: 'Maghrib', name: 'المغرب', time: prayerTimes.Maghrib },
      { key: 'Isha', name: 'العشاء', time: prayerTimes.Isha },
    ];

    let targetPrayer: { key: string; name: string; time: string; targetDate: Date } | null = null;

    for (const p of prayers) {
      const [h, m] = p.time.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) continue;
      const pDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
      if (pDate.getTime() > now.getTime()) {
        targetPrayer = { ...p, targetDate: pDate };
        break;
      }
    }

    // If all today's prayers have passed, target tomorrow's Fajr
    if (!targetPrayer) {
      const [h, m] = prayers[0].time.split(':').map(Number);
      const tomorrowFajr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m, 0);
      targetPrayer = { ...prayers[0], targetDate: tomorrowFajr };
    }

    const diff = Math.max(0, targetPrayer.targetDate.getTime() - now.getTime());
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setNextPrayer({
      key: targetPrayer.key,
      name: targetPrayer.name,
      time: targetPrayer.time,
      timeLeft: `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    });
  }, [prayerTimes]);

  useEffect(() => {
    calculateCountdown();
    const timer = setInterval(calculateCountdown, 1000);
    return () => clearInterval(timer);
  }, [calculateCountdown]);

  return (
    <div className={`w-full relative ${className}`} dir="rtl">
      {/* Luxury Islamic Prayer Times Card - Ultra Compact & Panoramic */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full bg-gradient-to-br from-white via-emerald-50/20 to-amber-50/15 dark:from-obsidian-900/90 dark:via-obsidian-900/90 dark:to-obsidian-950/95 border border-emerald-100/80 dark:border-regalGold-500/20 shadow-xs hover:border-emerald-300/80 dark:hover:border-regalGold-500/40 hover:shadow-sm transition-all duration-300 p-2.5 sm:p-3.5 rounded-2xl relative overflow-hidden flex flex-col justify-between"
      >
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-emerald-400/10 dark:bg-holyEmerald-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-amber-400/10 dark:bg-regalGold-500/10 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

        {/* Top Header Bar: Location Badge, Qibla Badge & Settings Button */}
        <div className="flex items-center justify-between gap-1.5 pb-1.5 sm:pb-2 mb-1 sm:mb-1.5 border-b border-emerald-100/70 dark:border-regalGold-500/20 relative z-10 flex-wrap sm:flex-nowrap">
          {/* Location & Qibla Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50/90 dark:bg-obsidian-850 border border-emerald-200/80 dark:border-regalGold-500/25 rounded-full text-[10px] sm:text-xs font-bold shadow-2xs">
              <MapPin className="w-3 h-3 text-emerald-600 dark:text-regalGold-400 shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-none text-emerald-900 dark:text-regalGold-100 font-black">{locationName}</span>
            </div>

            {/* Qibla Direction Badge */}
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50/90 dark:bg-obsidian-850 border border-emerald-200/80 dark:border-regalGold-500/25 text-emerald-900 dark:text-regalGold-300 text-[10px] sm:text-xs font-black shadow-2xs" title="اتجاه القبلة المشرفة">
              <Compass className="w-3 h-3 text-emerald-600 dark:text-holyEmerald-400 shrink-0" />
              <span>{qiblaAngle}° القِبلَة</span>
            </div>
          </div>

          {/* Settings Pill Button */}
          <button
            onClick={handleOpenSettings}
            className="flex items-center gap-1 px-2.5 py-0.5 sm:py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-holyEmerald-600 dark:to-teal-700 active:scale-95 text-white rounded-full font-bold text-[10px] sm:text-xs transition-all shadow-xs group cursor-pointer"
            title="إعدادات مواقيت الصلاة"
          >
            <Settings className="w-3 h-3 text-emerald-100 dark:text-regalGold-200 transition-transform duration-300 group-hover:rotate-90 shrink-0" />
            <span>إعدادات المواقيت</span>
          </button>
        </div>

        {/* Main Next Prayer & Countdown Showcase - Horizontal Flex Row */}
        <div className="flex flex-row items-center justify-between gap-2 py-0.5 sm:py-1 relative z-10 flex-wrap sm:flex-nowrap">
          {/* Next Prayer Details */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 dark:from-holyEmerald-600 dark:via-teal-700 dark:to-obsidian-850 text-white flex items-center justify-center shadow-xs border border-emerald-400/40 dark:border-regalGold-500/30 shrink-0">
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-200 dark:text-regalGold-300 animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-100/70 dark:bg-holyEmerald-900/40 text-[9px] sm:text-[10px] font-black text-emerald-800 dark:text-holyEmerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-holyEmerald-400 animate-ping shrink-0" />
                الصلاة القادمة:
              </span>
              <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-800 dark:text-regalGold-100 tracking-tight">
                {nextPrayer?.name || 'جاري الحساب...'}
              </h3>
              {nextPrayer?.time && (
                <span className="text-[10px] sm:text-xs font-black text-emerald-700 dark:text-regalGold-300 bg-emerald-50 dark:bg-obsidian-800 px-1.5 py-0.2 rounded-md border border-emerald-200/50 dark:border-regalGold-500/30 tabular-nums">
                  {nextPrayer.time}
                </span>
              )}
            </div>
          </div>

          {/* Countdown Display - Compact Inline Row */}
          <div className="flex items-center gap-1.5 bg-white/90 dark:bg-obsidian-850/90 px-2.5 py-1 sm:px-3 sm:py-1 rounded-xl border border-emerald-100 dark:border-regalGold-500/20 shadow-2xs shrink-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-regalGold-300/70 shrink-0">
              متبقي للأذان:
            </span>
            <div className="text-sm sm:text-lg font-black text-emerald-600 dark:text-regalGold-400 tabular-nums tracking-tight font-mono leading-none">
              {nextPrayer ? nextPrayer.timeLeft : '00:00:00'}
            </div>
          </div>
        </div>

        {/* Five Prayers Grid - Compact & Responsive Row */}
        <div className="w-full mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-emerald-100/70 dark:border-regalGold-500/20 grid grid-cols-5 gap-1 sm:gap-2 relative z-10">
          {prayerTimes &&
            Object.entries(prayerTimes).map(([key, time]) => {
              const isNext = nextPrayer?.key === key;
              return (
                <div
                  key={key}
                  className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-0.5 sm:px-1 rounded-xl transition-all duration-200 ${
                    isNext
                      ? 'bg-gradient-to-b from-emerald-600 to-teal-700 dark:from-holyEmerald-700 dark:to-obsidian-900 text-white shadow-xs scale-[1.02] border border-emerald-400/50 dark:border-regalGold-500/40'
                      : 'bg-white hover:bg-emerald-50/40 text-slate-700 border border-emerald-100/80 shadow-2xs hover:border-emerald-200 dark:bg-obsidian-850/80 dark:hover:bg-obsidian-800 dark:text-regalGold-100 dark:border-regalGold-500/15'
                  }`}
                >
                  <span
                    className={`text-[9px] sm:text-[10px] font-black truncate w-full text-center leading-tight ${
                      isNext ? 'text-amber-200 dark:text-regalGold-300' : 'text-slate-600 dark:text-regalGold-300/70'
                    }`}
                  >
                    {prayerNamesAr[key] || key}
                  </span>
                  <span
                    className={`text-[10px] sm:text-xs font-black tabular-nums tracking-tight mt-0.5 ${
                      isNext ? 'text-white dark:text-regalGold-100' : 'text-slate-800 dark:text-regalGold-100'
                    }`}
                  >
                    {time}
                  </span>
                  {isNext && (
                    <span className="mt-0.5 text-[6px] sm:text-[7px] bg-amber-400 dark:bg-regalGold-500 text-emerald-950 font-black px-1 rounded-full uppercase tracking-tighter">
                      القادمة
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      </motion.div>

      {/* Settings Modal - Direct Manual City & Time Customization */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-[2.5rem] p-5 sm:p-7 max-w-lg w-full shadow-2xl relative overflow-hidden text-right border border-emerald-100 dark:border-slate-800 max-h-[92vh] flex flex-col"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 left-4 p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600 border border-emerald-100">
                <Sliders className="w-6 h-6" />
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 text-center mb-1">إعدادات مواقيت الصلاة</h2>
              <p className="text-xs text-slate-500 text-center mb-5 font-medium">
                اختر مدينتك واضبط مواعيد الصلوات يدوياً بدقة تامة
              </p>

              {/* Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 pl-1">
                {/* 1. Country & City Selection */}
                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70 space-y-3">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <span>اختيار الدولة والمدينة</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Country Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">الدولة:</label>
                      <select
                        value={tempCountry}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all cursor-pointer"
                      >
                        {PRAYER_COUNTRIES.map((country) => (
                          <option key={country.name} value={country.name}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* City Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">المدينة / المنطقة:</label>
                      <select
                        value={tempCity}
                        onChange={(e) => handleCityChange(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all cursor-pointer"
                      >
                        {currentCountryData.cities.map((city) => (
                          <option key={city.name} value={city.name}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Customizable Prayer Times */}
                <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-600" />
                        <span>مواعيد الصلوات (تعديل يدوي)</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        انقر على أي وقت لتعديله بحسب توقيتك المحلي
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetToCityDefaults}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      title="استعادة أوقات المدينة الافتراضية"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>توقيت المدينة</span>
                    </button>
                  </div>

                  {/* 5 Prayers Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const).map((key) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl hover:border-emerald-300 transition-colors"
                      >
                        <span className="text-xs font-bold text-slate-700">{prayerNamesAr[key]}</span>
                        <input
                          type="time"
                          value={tempTimes[key] || '00:00'}
                          onChange={(e) => {
                            const newTime = e.target.value;
                            setTempTimes((prev) => ({ ...prev, [key]: newTime }));
                          }}
                          className="font-mono font-bold text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {feedbackMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs font-bold text-emerald-800 leading-relaxed flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{feedbackMsg}</span>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl font-black text-sm transition-all shadow-md shadow-emerald-700/20 cursor-pointer"
                >
                  حفظ التغييرات وتطبيق
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all cursor-pointer"
                >
                  إلغاء
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
