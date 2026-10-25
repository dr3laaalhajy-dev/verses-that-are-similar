import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Play,
  Search,
  Bookmark,
  Share2,
  Maximize2,
  X,
  Clock,
  User,
  Sparkles,
  MessageSquareText,
  Scroll,
  Scale,
  ShieldCheck,
  BookOpen,
  Compass,
  HeartHandshake,
  Check,
  ChevronDown,
  Layers,
  ChevronLeft,
  ChevronRight,
  Tv
} from 'lucide-react';
import {
  IslamicVideo,
  VIDEO_CATEGORIES,
  INITIAL_ISLAMIC_VIDEOS
} from '../data/islamicVideosData';

interface IslamicVideosProps {
  onBack: () => void;
}

export const IslamicVideos: React.FC<IslamicVideosProps> = ({ onBack }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeVideo, setActiveVideo] = useState<IslamicVideo | null>(null);
  const [playerMode, setPlayerMode] = useState<'bottomSheet' | 'topSticky' | 'fullscreen'>('bottomSheet');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('quran_bookmarked_videos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showBookmarksOnly, setShowBookmarksOnly] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  // Sync bookmarks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('quran_bookmarked_videos', JSON.stringify(bookmarkedIds));
    } catch (e) {
      console.error('Failed to save bookmarks', e);
    }
  }, [bookmarkedIds]);

  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleShare = async (video: IslamicVideo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          text: `${video.title} - ${video.sheikh}`,
          url: shareUrl
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    navigator.clipboard?.writeText(shareUrl);
    setCopiedId(video.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get active category object
  const currentCategoryObj = useMemo(
    () => VIDEO_CATEGORIES.find((c) => c.id === selectedCategory) || VIDEO_CATEGORIES[0],
    [selectedCategory]
  );

  // Filtered videos
  const filteredVideos = useMemo(() => {
    return INITIAL_ISLAMIC_VIDEOS.filter((video) => {
      // Bookmarks filter
      if (showBookmarksOnly && !bookmarkedIds.includes(video.id)) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all' && video.category !== selectedCategory) {
        return false;
      }
      // Sub-category filter
      if (selectedSubCategory && video.subCategory !== selectedSubCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = video.title.toLowerCase().includes(q);
        const matchSheikh = video.sheikh.toLowerCase().includes(q);
        const matchDesc = video.description?.toLowerCase().includes(q);
        const matchCat = video.categoryLabel.toLowerCase().includes(q);
        const matchSub = video.subCategory?.toLowerCase().includes(q);
        return matchTitle || matchSheikh || matchDesc || matchCat || matchSub;
      }
      return true;
    });
  }, [selectedCategory, selectedSubCategory, searchQuery, showBookmarksOnly, bookmarkedIds]);

  // Icon mapping helper
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className="w-4 h-4" />;
      case 'MessageSquareText':
        return <MessageSquareText className="w-4 h-4" />;
      case 'Scroll':
        return <Scroll className="w-4 h-4" />;
      case 'Scale':
        return <Scale className="w-4 h-4" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4" />;
      case 'BookOpen':
        return <BookOpen className="w-4 h-4" />;
      case 'Compass':
        return <Compass className="w-4 h-4" />;
      case 'HeartHandshake':
        return <HeartHandshake className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  const handleNextVideo = () => {
    if (!activeVideo) return;
    const currentIndex = filteredVideos.findIndex((v) => v.id === activeVideo.id);
    if (currentIndex !== -1 && currentIndex < filteredVideos.length - 1) {
      setActiveVideo(filteredVideos[currentIndex + 1]);
    } else if (filteredVideos.length > 0) {
      setActiveVideo(filteredVideos[0]);
    }
  };

  const handlePrevVideo = () => {
    if (!activeVideo) return;
    const currentIndex = filteredVideos.findIndex((v) => v.id === activeVideo.id);
    if (currentIndex > 0) {
      setActiveVideo(filteredVideos[currentIndex - 1]);
    } else if (filteredVideos.length > 0) {
      setActiveVideo(filteredVideos[filteredVideos.length - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] text-slate-800 pb-28 font-sans selection:bg-[#0D6E52]/20" dir="rtl">
      {/* 1. Top Header with Islamic Geometric Pattern background (Opacity 5%) */}
      <header className="relative bg-gradient-to-b from-[#0D6E52] to-[#0A5640] text-white overflow-hidden shadow-xl border-b border-[#D4AF37]/30">
        {/* Islamic Geometric SVG Pattern Background (5% opacity) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-5 mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30zM30 6.863L53.137 30 30 53.137 6.863 30zM30 15l15 15-15 15-15-15z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-6 relative z-10">
          {/* Top Row: Back button, Title & Bookmarks button */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white border border-white/10 backdrop-blur-md shadow-sm"
                title="العودة"
              >
                <ArrowRight className="w-5 h-5" />
                <span className="font-bold text-xs sm:text-sm hidden sm:inline">العودة</span>
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B38F24] text-white flex items-center justify-center shadow-md shadow-[#0D6E52]/40 border border-white/20">
                  <Tv className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                      المكتبة المرئية الإسلامية
                    </h1>
                    <span className="text-[10px] font-black bg-[#D4AF37]/30 text-[#FCEEB5] border border-[#D4AF37]/40 px-2 py-0.5 rounded-full">
                      روائع الفيديوهات
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-emerald-100 font-semibold opacity-90">
                    دروس، ومواعظ، وشروحات علمية موثوقة لكبار العلماء والدعاة
                  </p>
                </div>
              </div>
            </div>

            {/* Bookmarks Toggle Button */}
            <button
              onClick={() => setShowBookmarksOnly((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-black text-xs transition-all shadow-sm border ${
                showBookmarksOnly
                  ? 'bg-[#D4AF37] text-[#0A5640] border-[#FCEEB5] shadow-lg scale-105'
                  : 'bg-white/10 text-white hover:bg-white/15 border-white/10 backdrop-blur-md'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${showBookmarksOnly ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">المحفوظات</span>
              {bookmarkedIds.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  showBookmarksOnly ? 'bg-[#0A5640] text-[#D4AF37]' : 'bg-[#D4AF37] text-[#0A5640]'
                }`}>
                  {bookmarkedIds.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <Search className="absolute right-4 w-5 h-5 text-emerald-600 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مقطع، شيخ، موضوع، أو مسألة فقهية..."
                className="w-full pr-12 pl-10 py-3.5 bg-white/95 text-slate-800 placeholder-slate-400 rounded-2xl font-bold text-sm shadow-lg shadow-black/10 outline-none focus:ring-3 focus:ring-[#D4AF37]/40 focus:bg-white transition-all border border-emerald-100/50 text-right"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Golden Bottom Border Accent */}
        <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-80" />
      </header>

      {/* 2. Sticky Top Embedded Player (if topSticky mode is selected) */}
      <AnimatePresence>
        {activeVideo && playerMode === 'topSticky' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sticky top-0 z-40 bg-slate-900 border-b-2 border-[#D4AF37] shadow-2xl"
          >
            <div className="max-w-4xl mx-auto">
              {/* Video Player */}
              <div className="relative w-full aspect-video bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
                  title={activeVideo.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              {/* Player Controls Bar */}
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-sm text-white truncate">{activeVideo.title}</h3>
                  <p className="text-xs text-[#D4AF37] font-semibold truncate">{activeVideo.sheikh}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handlePrevVideo}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                    title="المقطع السابق"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextVideo}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                    title="المقطع التالي"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPlayerMode('bottomSheet')}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                    title="عرض كـ نافذة منبثقة"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveVideo(null)}
                    className="p-1.5 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white transition-all"
                    title="إغلاق المشغل"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        {/* 3. Horizontal Scrollable Category Chips (الأصناف كأزرار أفقية قابلة للتمرير السريع) */}
        <div className="relative mb-4">
          <div
            ref={categoriesScrollRef}
            className="flex items-center gap-2 overflow-x-auto pb-2.5 pt-1 scrollbar-none scroll-smooth select-none px-1"
          >
            {VIDEO_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id && !showBookmarksOnly;
              const count =
                cat.id === 'all'
                  ? INITIAL_ISLAMIC_VIDEOS.length
                  : INITIAL_ISLAMIC_VIDEOS.filter((v) => v.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setShowBookmarksOnly(false);
                    setSelectedCategory(cat.id);
                    setSelectedSubCategory(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm whitespace-nowrap transition-all duration-200 shrink-0 shadow-xs border ${
                    isActive
                      ? 'bg-[#0D6E52] text-white border-[#D4AF37]/50 shadow-md shadow-[#0D6E52]/25 scale-[1.02] ring-2 ring-[#D4AF37]/30'
                      : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-[#0D6E52] border-slate-200/80 hover:border-emerald-200'
                  }`}
                >
                  <span className={isActive ? 'text-[#D4AF37]' : 'text-slate-400'}>
                    {getCategoryIcon(cat.iconName)}
                  </span>
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                      isActive
                        ? 'bg-[#D4AF37] text-[#0A5640]'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-100'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Subcategories Pills (الفروع التابعة للقسم النشط إن وجدت) */}
        <AnimatePresence>
          {currentCategoryObj.subCategories.length > 0 && !showBookmarksOnly && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 scrollbar-none px-1"
            >
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-400 pl-2 shrink-0">
                <Layers className="w-3.5 h-3.5 text-[#0D6E52]" />
                <span>التفريعات:</span>
              </div>

              <button
                onClick={() => setSelectedSubCategory(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  selectedSubCategory === null
                    ? 'bg-[#0D6E52]/10 text-[#0D6E52] border-[#0D6E52]/30 font-black'
                    : 'bg-white/70 text-slate-500 hover:bg-white border-slate-200/60'
                }`}
              >
                الكل
              </button>

              {currentCategoryObj.subCategories.map((sub) => {
                const isSubActive = selectedSubCategory === sub;
                return (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubCategory(isSubActive ? null : sub)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                      isSubActive
                        ? 'bg-[#0D6E52] text-white border-[#0D6E52] shadow-sm font-black'
                        : 'bg-white/70 text-slate-600 hover:bg-white border-slate-200/60 hover:text-[#0D6E52]'
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filter Summary Bar */}
        <div className="flex items-center justify-between px-1 mb-4 text-xs font-bold text-slate-500">
          <div>
            <span>عرض: </span>
            <span className="text-[#0D6E52] font-black">
              {showBookmarksOnly
                ? 'المقاطع المحفوظة'
                : selectedSubCategory
                ? `${currentCategoryObj.name} • ${selectedSubCategory}`
                : currentCategoryObj.name}
            </span>
            <span className="mr-1 text-slate-400 font-normal">({filteredVideos.length} مقطع)</span>
          </div>

          {(searchQuery || selectedSubCategory || showBookmarksOnly) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSubCategory(null);
                setShowBookmarksOnly(false);
                setSelectedCategory('all');
              }}
              className="text-[#0D6E52] hover:underline font-black text-xs"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>

        {/* 5. Videos Grid (شبكة بطاقات الفيديوهات) */}
        {filteredVideos.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-[#0D6E52] flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <Tv className="w-8 h-8 opacity-70" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">لا توجد مقاطع مطابقة</h3>
            <p className="text-xs font-bold text-slate-400 mb-5">
              {showBookmarksOnly
                ? 'لم تقم بحفظ أي مقطع في المفضلة بعد. اضغط على أيقونة الإشارة المرجعية على أي مقطع لحفظه.'
                : 'لم نجد أي مقطع يطابق معايير البحث الحالية.'}
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedSubCategory(null);
                setShowBookmarksOnly(false);
              }}
              className="px-5 py-2.5 rounded-2xl bg-[#0D6E52] text-white font-black text-xs shadow-md shadow-emerald-700/20 hover:bg-[#0A5640] transition-all"
            >
              عرض جميع المقاطع
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVideos.map((video) => {
              const isBookmarked = bookmarkedIds.includes(video.id);
              const isPlaying = activeVideo?.id === video.id;

              return (
                <motion.div
                  key={video.id}
                  whileHover={{ y: -4 }}
                  onClick={() => {
                    setActiveVideo(video);
                    if (playerMode !== 'topSticky') {
                      setPlayerMode('bottomSheet');
                    }
                  }}
                  className={`group relative bg-white rounded-3xl overflow-hidden border transition-all duration-300 shadow-sm hover:shadow-xl cursor-pointer flex flex-col justify-between ${
                    isPlaying
                      ? 'border-[#0D6E52] ring-2 ring-[#0D6E52]/20 shadow-emerald-900/10'
                      : 'border-slate-200/90 hover:border-[#D4AF37]/60'
                  }`}
                >
                  {/* Top Thumbnail Section */}
                  <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                    {/* YouTube High-Quality Thumbnail */}
                    <img
                      src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Dark gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 group-hover:from-black/70 transition-all" />

                    {/* Center Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-[#0D6E52]/90 text-white flex items-center justify-center shadow-2xl backdrop-blur-md border border-[#D4AF37]/60 group-hover:scale-110 group-hover:bg-[#0D6E52] group-hover:border-[#D4AF37] transition-all duration-300">
                        <Play className="w-6 h-6 fill-white translate-x-0.5 text-white" />
                      </div>
                    </div>

                    {/* Top Badges Row */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      {/* Category Badge */}
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-[#0D6E52]/90 text-white border border-[#D4AF37]/40 shadow-sm backdrop-blur-md">
                        {video.categoryLabel}
                      </span>

                      {/* Action buttons (Bookmark & Share) */}
                      <div className="flex items-center gap-1.5 pointer-events-auto">
                        <button
                          onClick={(e) => toggleBookmark(video.id, e)}
                          className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
                            isBookmarked
                              ? 'bg-[#D4AF37] text-[#0A5640] border-[#FCEEB5]'
                              : 'bg-black/40 text-white hover:bg-black/60 border-white/20'
                          }`}
                          title={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ في المفضلة'}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                        </button>

                        <button
                          onClick={(e) => handleShare(video, e)}
                          className="p-2 rounded-xl bg-black/40 text-white hover:bg-black/60 border border-white/20 backdrop-blur-md transition-all"
                          title="مشاركة المقطع"
                        >
                          {copiedId === video.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Bottom Duration Badge */}
                    <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-white text-[11px] font-bold border border-white/10">
                      <Clock className="w-3 h-3 text-[#D4AF37]" />
                      <span dir="ltr">{video.duration}</span>
                    </div>

                    {/* SubCategory Tag if available */}
                    {video.subCategory && (
                      <div className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-md text-white text-[10px] font-black">
                        {video.subCategory}
                      </div>
                    )}
                  </div>

                  {/* Bottom Text Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Video Title */}
                      <h3 className="text-sm sm:text-base font-black text-slate-800 line-clamp-2 leading-snug group-hover:text-[#0D6E52] transition-colors mb-2.5">
                        {video.title}
                      </h3>

                      {/* Sheikh Name with Icon */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 text-[#0D6E52] flex items-center justify-center shrink-0 border border-emerald-100">
                          <User className="w-3 h-3" />
                        </div>
                        <span className="truncate">{video.sheikh}</span>
                      </div>
                    </div>

                    {/* Short Description */}
                    {video.description && (
                      <p className="text-xs font-semibold text-slate-400 line-clamp-2 leading-relaxed pt-2 border-t border-slate-100">
                        {video.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. In-App Video Player (Bottom Sheet Modal) */}
      <AnimatePresence>
        {activeVideo && playerMode === 'bottomSheet' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          >
            {/* Modal Backdrop click to close */}
            <div
              className="absolute inset-0"
              onClick={() => setActiveVideo(null)}
            />

            {/* Bottom Sheet Modal Container */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-full max-w-3xl bg-slate-900 text-white rounded-t-[2.5rem] sm:rounded-[2rem] overflow-hidden shadow-2xl z-10 max-h-[92vh] flex flex-col border border-white/10"
            >
              {/* Top Drag Indicator for mobile */}
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3 sm:hidden" />

              {/* YouTube Iframe Player (playsinline=1&rel=0 for no external exit) */}
              <div className="relative w-full aspect-video bg-black shrink-0">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
                  title={activeVideo.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              {/* Video Info & Player Controls */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                {/* Header row with badges & close button */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black px-3 py-1 rounded-xl bg-[#0D6E52] text-white border border-[#D4AF37]/50 shadow-sm">
                      {activeVideo.categoryLabel}
                    </span>
                    {activeVideo.subCategory && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white/10 text-slate-200 border border-white/10">
                        {activeVideo.subCategory}
                      </span>
                    )}
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white/10 text-[#D4AF37] flex items-center gap-1 border border-white/10" dir="ltr">
                      <Clock className="w-3.5 h-3.5" />
                      {activeVideo.duration}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Minimize / Dock to top sticky mode */}
                    <button
                      onClick={() => setPlayerMode('topSticky')}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                      title="تصغير وتثبيت بالأعلى لمتابعة التصفح"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>

                    {/* Close Player */}
                    <button
                      onClick={() => setActiveVideo(null)}
                      className="p-2 rounded-xl bg-white/10 hover:bg-red-500/80 text-white transition-all"
                      title="إغلاق المشغل"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Video Title */}
                <h2 className="text-base sm:text-xl font-black text-white leading-snug mb-3">
                  {activeVideo.title}
                </h2>

                {/* Sheikh info & Share / Bookmark buttons */}
                <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0D6E52] to-[#0A5640] text-[#D4AF37] flex items-center justify-center font-black border border-[#D4AF37]/30 shadow-md">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">{activeVideo.sheikh}</div>
                      <div className="text-xs font-semibold text-slate-400">عالم وداعية إسلامي</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleBookmark(activeVideo.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all border ${
                        bookmarkedIds.includes(activeVideo.id)
                          ? 'bg-[#D4AF37] text-[#0A5640] border-[#FCEEB5]'
                          : 'bg-white/10 text-white hover:bg-white/20 border-white/10'
                      }`}
                    >
                      <Bookmark className={`w-4 h-4 ${bookmarkedIds.includes(activeVideo.id) ? 'fill-current' : ''}`} />
                      <span>{bookmarkedIds.includes(activeVideo.id) ? 'محفوظ' : 'حفظ'}</span>
                    </button>

                    <button
                      onClick={() => handleShare(activeVideo)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 font-bold text-xs transition-all"
                    >
                      {copiedId === activeVideo.id ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" />
                          <span>مشاركة</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Description */}
                {activeVideo.description && (
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-4">
                    <h4 className="text-xs font-black text-[#D4AF37] mb-1">نبذة عن المقطع:</h4>
                    <p className="text-xs sm:text-sm font-semibold text-slate-300 leading-relaxed">
                      {activeVideo.description}
                    </p>
                  </div>
                )}

                {/* Next / Previous video navigation buttons */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={handlePrevVideo}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all border border-white/10"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>المقطع السابق</span>
                  </button>
                  <button
                    onClick={handleNextVideo}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#0D6E52] hover:bg-[#0A5640] text-white font-black text-xs transition-all border border-[#D4AF37]/40 shadow-lg shadow-emerald-900/30"
                  >
                    <span>المقطع التالي</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
