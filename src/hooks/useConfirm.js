import { useState, useCallback } from "react";
import ConfirmModal from "../components/ConfirmModal";

const useConfirm = () => {
  const [state, setState] = useState({ isOpen: false });

  const confirm = useCallback((message, title, confirmLabel, cancelLabel, variant) => {
    return new Promise((resolve) => {
      setState({ isOpen: true, message, title, confirmLabel, cancelLabel, variant, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve(true);
    setState({ isOpen: false });
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve(false);
    setState({ isOpen: false });
  }, [state]);

  const ConfirmDialog = useCallback(() => (
    <ConfirmModal
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ), [state, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog };
};

export default useConfirm;
