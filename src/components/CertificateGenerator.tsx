"use client";

import React, { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChallengeCertificate } from './ChallengeCertificate';

interface CertificateGeneratorProps {
  onClose: () => void;
  onSave?: (cert: { category: string; date: string; name: string }) => void;
  category: string;
  isClaimed?: boolean;
  claimedName?: string;
}

const categoryDetailsMap: Record<string, { title: string; subtitle: string; score: string; rank: string }> = {
  seerah: { title: 'إتمام 60 سؤالاً في السيرة النبوية الشريفة', subtitle: 'العهد المكي والمدني والغزوات', score: '60 / 60', rank: 'عالم بالسيرة النبوية' },
  general: { title: 'ختم مسابقة الفقه والمعلومات الإسلامية', subtitle: 'أحكام العبادات والمعاملات', score: '100%', rank: 'فقيه متقن ومتميز' },
  figh: { title: 'ختم مسابقة الفقه والمعلومات الإسلامية', subtitle: 'أحكام العبادات والمعاملات', score: '100%', rank: 'فقيه متقن' },
  akida: { title: 'ختم بنك أسئلة العقيدة الإسلامية', subtitle: 'أصول الإيمان والتوحيد الخالص', score: '100%', rank: 'راسخ في العقيدة' },
  hadith: { title: 'إتمام 100 حديث شريف في السنة النبوية', subtitle: 'السنة النبوية والأحاديث المطهرة', score: '100%', rank: 'محدث متقن' },
  tafseer: { title: 'إتمام 100 سؤال في تفسير القرآن الكريم', subtitle: 'معاني الآيات ومقاصد السور', score: '100%', rank: 'عالم بالتفسير' },
  history: { title: 'ختم مسابقة التاريخ والفتوحات الإسلامية', subtitle: 'سير الخلفاء والعهود الإسلامية', score: '100%', rank: 'خبير بالتاريخ' },
  arabia: { title: 'إتمام مسابقة علوم اللغة العربية والمعاجم', subtitle: 'لغة القرآن الكريم والنحو والبلاغة', score: '100%', rank: 'أديب فصيح' },
};

export const CertificateGenerator: React.FC<CertificateGeneratorProps> = ({
  onClose,
  onSave,
  category,
  claimedName
}) => {
  // حظر التعديل: استخراج اسم اللاعب المسجل في قاعدة البيانات / الحساب المعتمد حصراً
  const verifiedPlayerName = useMemo(() => {
    return (
      claimedName ||
      localStorage.getItem('quran_user_triple_name') ||
      localStorage.getItem('quran_player_name') ||
      localStorage.getItem('quran_user_name') ||
      'علاء'
    );
  }, [claimedName]);

  const details = categoryDetailsMap[category] || {
    title: 'شهادة إنجاز التحديات القرآنية',
    subtitle: 'مدارسة علوم القرآن الكريم والسنة النبوية',
    score: '100%',
    rank: 'متقن ومتميز'
  };

  const currentDate = useMemo(() => {
    return new Date().toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  // حفظ الشهادة تلقائياً في السجل المعتمد
  useEffect(() => {
    if (onSave) {
      onSave({
        category,
        date: currentDate,
        name: verifiedPlayerName
      });
    }
  }, [category, currentDate, onSave, verifiedPlayerName]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto" dir="rtl">
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 15 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
        className="w-full max-w-4xl my-auto"
      >
        <ChallengeCertificate
          playerName={verifiedPlayerName}
          challengeName={details.title}
          score={details.score}
          surahOrJuz={details.subtitle}
          rank={details.rank}
          date={currentDate}
          certificateId={`MTN-${category.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`}
          allowNameEdit={false} // حظر تعديل الاسم نهائياً لمنع التزوير
          showControls={true}
          onClose={onClose}
        />
      </motion.div>
    </div>
  );
};

export default CertificateGenerator;
