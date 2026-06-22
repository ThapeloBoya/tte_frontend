import { useEffect, useCallback } from "react";

const useUnsavedChanges = (isDirty) => {
  const beforeUnloadHandler = useCallback((e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  }, [isDirty]);

  useEffect(() => {
    if (isDirty) {
      window.addEventListener("beforeunload", beforeUnloadHandler);
    } else {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    }
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [isDirty, beforeUnloadHandler]);
};

export default useUnsavedChanges;
