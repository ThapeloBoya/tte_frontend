import { useEffect, useRef } from "react";

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useFocusTrap(open) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open || !ref.current) return;

    const container = ref.current;
    const previouslyFocused = document.activeElement;

    const focusable = container.querySelectorAll(focusableSelector);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (first) first.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        const closeBtn = container.querySelector("[data-close-modal]");
        if (closeBtn) closeBtn.click();
        return;
      }
      if (e.key !== "Tab") return;
      if (!focusable.length) return;

      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  return ref;
}
