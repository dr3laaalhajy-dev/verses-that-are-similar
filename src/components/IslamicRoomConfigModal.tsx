import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { IslamicInfoSettingsForm, IslamicInfoSettings } from './challenge/IslamicInfoSettingsForm';

interface IslamicRoomConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategories: string[];
  onSelectCategories: (cats: string[]) => void;
  selectedLevels: (1 | 2 | 3)[];
  onSelectLevels: (lvls: (1 | 2 | 3)[]) => void;
  selectedTopics: string[];
  onSelectTopics: (topics: string[]) => void;
  topicQuestionCounts: Record<string, number>;
  onUpdateTopicCount: (topic: string, count: number) => void;
}

const IslamicRoomConfigModal: React.FC<IslamicRoomConfigModalProps> = ({
  isOpen,
  onClose,
  selectedCategories = ['akida'],
  onSelectCategories,
  selectedLevels = [1],
  onSelectLevels,
  selectedTopics = ['all'],
  onSelectTopics,
  topicQuestionCounts = {},
  onUpdateTopicCount,
}) => {
  // Body scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentQuestionsCount = selectedTopics.includes('all')
    ? (topicQuestionCounts['all'] || 5)
    : selectedTopics.reduce((sum, t) => sum + (topicQuestionCounts[t] || 0), 0);

  const handleFormChange = (newSettings: IslamicInfoSettings) => {
    onSelectCategories(newSettings.categories);
    onSelectLevels(newSettings.levels);
    onSelectTopics(newSettings.topics);
    Object.entries(newSettings.topicCounts).forEach(([topic, count]) => {
      onUpdateTopicCount(topic, count);
    });
  };

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 text-right p-5 sm:p-6"
          dir="rtl"
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-800">إعدادات المعلومات الإسلامية</h3>
                <p className="text-xs text-slate-400 font-bold">خصص المجالات والمستويات والمواضيع المطلوبة</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <IslamicInfoSettingsForm
            settings={{
              categories: selectedCategories,
              levels: selectedLevels,
              topics: selectedTopics,
              topicCounts: topicQuestionCounts,
              questionsCount: currentQuestionsCount
            }}
            onChange={handleFormChange}
            onSave={() => onClose()}
            onCancel={onClose}
            saveButtonText="تأكيد الإعدادات والمتابعة"
            showActionButtons={true}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default IslamicRoomConfigModal;
