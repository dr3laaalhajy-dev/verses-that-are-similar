import React from 'react';
import { motion } from 'framer-motion';
import { Compass, ChevronLeft, ArrowRight, User } from 'lucide-react';

export const QIRAAT = [
  { id: 'nafi', name: 'نافع المدني', description: 'روايتي قالون وورش' },
  { id: 'ibn_kathir', name: 'ابن كثير المكي', description: 'روايتي البزي وقنبل' },
  { id: 'abu_amr', name: 'أبو عمرو البصري', description: 'روايتي الدوري والسوسي' },
  { id: 'ibn_amir', name: 'ابن عامر الشامي', description: 'روايتي هشام وابن ذكوان' },
  { id: 'asim', name: 'عاصم الكوفي', description: 'روايتي شعبة وحفص' },
  { id: 'hamza', name: 'حمزة الكوفي', description: 'روايتي خلف وخلاد' },
  { id: 'kisai', name: 'الكسائي الكوفي', description: 'روايتي أبي الحارث والدوري' },
  { id: 'abu_jaafar', name: 'أبو جعفر المدني', description: 'روايتي ابن وردان وابن جماز' },
  { id: 'yaqub', name: 'يعقوب الحضرمي', description: 'روايتي رويس وروح' },
  { id: 'khalaf', name: 'خلف العاشر', description: 'روايتي إسحاق وإدريس' }
];

interface QiraatIndexProps {
  onSelect: (id: string) => void;
  onBack: () => void;
}

const QiraatIndex: React.FC<QiraatIndexProps> = ({ onSelect, onBack }) => {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 py-10 px-6" dir="rtl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg">
            <Compass className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-emerald-900 font-quran text-right">القراءات العشر</h2>
            <p className="text-slate-400 font-bold text-sm mt-1 text-right">متع عينيك وقلبك بكلام الله بمختلف الروايات</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border border-slate-100 text-slate-600 font-black hover:bg-slate-50 transition-all shadow-sm"
        >
          <ArrowRight className="w-5 h-5" />
          العودة للرئيسية
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {QIRAAT.map((q, idx) => (
          <motion.button
            key={q.id}
            // @ts-ignore
            initial={{ opacity: 0, scale: 0.9 }}
            // @ts-ignore
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            // @ts-ignore
            whileHover={{ y: -8, shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)' }}
            onClick={() => onSelect(q.id)}
            className="group p-8 rounded-[2.5rem] bg-white border border-slate-100 text-right flex flex-col justify-between min-h-[180px] transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500 opacity-50" />
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                <User className="w-6 h-6" />
              </div>
              <ChevronLeft className="w-5 h-5 text-emerald-600 opacity-0 group-hover:opacity-100 group-hover:-translate-x-2 transition-all" />
            </div>

            <div className="relative z-10 space-y-2 mt-6">
              <h3 className="text-xl font-black text-slate-800 group-hover:text-emerald-700 transition-colors">{q.name}</h3>
              <p className="text-slate-400 font-bold text-xs">{q.description}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default QiraatIndex;
