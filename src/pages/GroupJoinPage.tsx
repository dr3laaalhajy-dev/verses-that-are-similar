import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, RefreshCw, Plus, Zap, Users, Lock, Globe, Clock, Play
} from 'lucide-react';
import { View } from '../types/challenges';

export interface GroupJoinPageProps {
  setView: (view: View) => void;
  fetchAvailableRooms: (force?: boolean) => void;
  isLoadingRooms: boolean;
  availableRooms: any[];
  playerUsername: string | null;
  playerName: string | null;
  handleJoinV1: (id: string) => void;
  setPrivateRoomModal: (modal: any) => void;
  isJoiningRoom: boolean;
}

export const GroupJoinPage: React.FC<GroupJoinPageProps> = ({
  setView,
  fetchAvailableRooms,
  isLoadingRooms,
  availableRooms,
  playerUsername,
  playerName,
  handleJoinV1,
  setPrivateRoomModal,
  isJoiningRoom
}) => {
  return (
    <motion.div
      key="group_join"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="w-full max-w-2xl mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4 space-y-4 sm:space-y-6 pb-28 sm:pb-32"
    >
      {/* Header with Back and Refresh */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setView('home')}
          className="p-2 sm:p-2.5 rounded-xl bg-white/60 hover:bg-white transition-all text-slate-500 font-bold flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm border border-slate-100 shadow-xs cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>الرئيسية</span>
        </button>

        <div className="text-center">
          <h2 className="text-lg sm:text-2xl font-black text-slate-800">التحدي الجماعي</h2>
          <p className="text-slate-400 font-bold text-[11px] sm:text-xs">قائمة الغرف المتاحة للتحدي المباشر</p>
        </div>

        <button
          onClick={() => fetchAvailableRooms(true)}
          disabled={isLoadingRooms}
          className="p-2 sm:p-2.5 rounded-xl bg-white/60 hover:bg-white transition-all text-slate-600 font-bold flex items-center gap-1.5 text-xs sm:text-sm border border-slate-100 shadow-xs cursor-pointer disabled:opacity-60"
          title="تحديث قائمة الغرف"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingRooms ? 'animate-spin text-orange-500' : ''}`} />
          <span className="hidden sm:inline">تحديث</span>
        </button>
      </div>

      {/* Prominent Create Room Action Banner */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setView('group_create')}
        className="w-full p-4 md:p-5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white rounded-3xl font-black shadow-lg shadow-orange-500/25 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer border border-white/20 transition-all group"
      >
        <div className="flex items-center gap-3 sm:gap-3.5 text-right">
          <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner group-hover:rotate-6 transition-transform shrink-0">
            <Plus className="w-6 h-6 text-white stroke-[2.5]" />
          </div>
          <div className="text-right">
            <div className="text-base md:text-lg font-black flex items-center gap-2">
              <span>إنشاء غرفة تحدي جديدة</span>
              <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-bold">مضيف 👑</span>
            </div>
            <p className="text-white/80 font-bold text-[11px] sm:text-xs mt-0.5">خصص المهارات، عدد الأسئلة والمؤقت ثم نافس أصدقاءك</p>
          </div>
        </div>
        <div className="w-full sm:w-auto px-4 py-2.5 bg-white text-orange-600 rounded-2xl font-black text-xs md:text-sm shadow-sm shrink-0 flex items-center justify-center gap-1.5 group-hover:bg-orange-50 transition-colors">
          <Zap className="w-4 h-4 fill-orange-500" />
          <span>أنشئ الآن</span>
        </div>
      </motion.button>

      {/* Available Rooms List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-black text-slate-700">
              الغرف المتاحة حالياً ({availableRooms.length})
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-bold">
            يتم التحديث تلقائياً ⚡
          </span>
        </div>

        {isLoadingRooms && availableRooms.length === 0 ? (
          <div className="glass p-12 rounded-3xl text-center border-slate-100 shadow-md">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-400">جاري تحميل الغرف النشطة...</p>
          </div>
        ) : availableRooms.length === 0 ? (
          <div className="glass p-8 md:p-10 rounded-3xl text-center border-slate-100 shadow-md space-y-4">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-700 mb-1">لا توجد غرف قيد الانتظار حالياً</h3>
              <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto">
                جميع التحديات بدأت أو تم إنهاؤها. بادر بإنشاء غرفتك ليراها الآخرون وينضموا إليك!
              </p>
            </div>
            <button
              onClick={() => setView('group_create')}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-black text-xs md:text-sm hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20 active:scale-95 inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>إنشاء غرفة جديدة</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {availableRooms.map((r: any) => {
              const isMyRoom = Boolean(
                (r.hostUsername && playerUsername && r.hostUsername.toLowerCase() === playerUsername.toLowerCase()) ||
                (r.hostName && playerName && r.hostName === playerName)
              );

              const createdTime = r.createdAt ? new Date(r.createdAt).getTime() : Date.now();
              const elapsedMs = Date.now() - createdTime;
              const remainingMins = Math.max(1, Math.min(10, Math.ceil((10 * 60 * 1000 - elapsedMs) / (60 * 1000))));

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    if (isMyRoom) {
                      handleJoinV1(r.id);
                    } else if (r.isPrivate) {
                      setPrivateRoomModal({
                        isOpen: true,
                        room: r,
                        password: '',
                        error: undefined
                      });
                    } else {
                      handleJoinV1(r.id);
                    }
                  }}
                  className={`glass p-3.5 sm:p-5 rounded-2xl border transition-all shadow-xs hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer group ${
                    isMyRoom
                      ? 'border-orange-400 bg-orange-50/40 hover:border-orange-500 shadow-orange-500/10 ring-1 ring-orange-300/50'
                      : 'border-slate-100 hover:border-orange-300'
                  }`}
                >
                  <div className="text-right space-y-2 w-full sm:w-auto">
                    <div className="flex flex-wrap items-center gap-2 justify-start">
                      {isMyRoom && (
                        <span className="px-2.5 py-0.5 bg-orange-500 text-white rounded-full text-[11px] font-black flex items-center gap-1 shadow-xs animate-pulse">
                          <span>غرفتك (أنت المضيف) 👑</span>
                        </span>
                      )}
                      {r.isPrivate ? (
                        <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[11px] font-black flex items-center gap-1 border border-amber-500/20">
                          <Lock className="w-3 h-3" />
                          <span>خاصة</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[11px] font-black flex items-center gap-1 border border-emerald-500/20">
                          <Globe className="w-3 h-3" />
                          <span>عامة</span>
                        </span>
                      )}
                      <h3 className="font-black text-slate-800 text-sm md:text-base group-hover:text-orange-600 transition-colors">
                        {r.name || 'غرفة التحدي'}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] md:text-xs text-slate-500 font-bold justify-start">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                        المنشئ: {isMyRoom ? 'أنت 👑' : (r.hostName || 'متسابق')}
                      </span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{r.participantCount} متسابقين</span>
                      </span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                        {r.questionCount} أسئلة
                      </span>
                      {r.timePerQuestion > 0 && (
                        <span className="bg-orange-100/70 text-orange-600 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{r.timePerQuestion} ثانية</span>
                        </span>
                      )}
                      <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200/50 flex items-center gap-0.5 text-[10px]">
                        <Clock className="w-2.5 h-2.5 text-amber-600" />
                        <span>صالحة لـ {remainingMins} د</span>
                      </span>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMyRoom) {
                          handleJoinV1(r.id);
                        } else if (r.isPrivate) {
                          setPrivateRoomModal({
                            isOpen: true,
                            room: r,
                            password: '',
                            error: undefined
                          });
                        } else {
                          handleJoinV1(r.id);
                        }
                      }}
                      disabled={isJoiningRoom}
                      className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-black text-xs md:text-sm transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                        isMyRoom
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/25 ring-2 ring-orange-400/40'
                          : r.isPrivate
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                          : 'bg-brand-emerald hover:bg-brand-emerald/90 text-white shadow-brand-emerald/20'
                      }`}
                    >
                      {isMyRoom ? (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>دخول غرفتك (المضيف) 👑</span>
                        </>
                      ) : r.isPrivate ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>انضمام بكلمة مرور</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>انضمام مباشر</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) on mobile anchored bottom right with safe area */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setView('group_create')}
        className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-40 sm:hidden px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full shadow-2xl shadow-orange-500/50 flex items-center gap-2 font-black cursor-pointer border-2 border-white active:scale-95 transition-transform"
        title="إنشاء غرفة جديدة"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
        <span className="text-xs">إنشاء غرفة</span>
      </motion.button>
    </motion.div>
  );
};

export default GroupJoinPage;
