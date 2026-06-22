import React from "react";
import useFocusTrap from "../hooks/useFocusTrap";

const ConfirmModal = ({ isOpen, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, variant }) => {
  const ref = useFocusTrap(isOpen);
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" ref={ref} onClick={onCancel} role="dialog" aria-modal="true" aria-label={title || "Confirm"}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <h3>{title || "Confirm"}</h3>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal-actions">
          <button className="secondary" onClick={onCancel} data-close-modal>
            {cancelLabel || "Cancel"}
          </button>
          <button className={variant === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
