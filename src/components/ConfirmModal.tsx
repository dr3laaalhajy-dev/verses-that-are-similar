import React from 'react';
import { GlobalModalWrapper } from './common/GlobalModalWrapper';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isAlert?: boolean;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  isAlert = false,
  confirmText = 'حسناً',
  cancelText = 'إلغاء',
  isDanger = false,
  isLoading = false
}) => {
  const isSuccess = title.includes('نجاح');
  const modalType = isDanger ? 'danger' : isSuccess ? 'success' : isAlert ? 'alert' : 'default';

  return (
    <GlobalModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      type={modalType}
      title={title}
      subtitle={message}
      primaryAction={{
        label: confirmText,
        onClick: () => {
          try {
            if (onConfirm) onConfirm();
          } catch (err) {
            console.error('ConfirmModal action error:', err);
          } finally {
            onClose();
          }
        },
        variant: isDanger ? 'danger' : isSuccess ? 'gold' : 'primary',
        loading: isLoading,
      }}
      secondaryAction={
        !isAlert
          ? {
              label: cancelText,
              onClick: onClose,
              variant: 'secondary',
              disabled: isLoading,
            }
          : undefined
      }
    />
  );
};

export default ConfirmModal;
