import { useEffect, useRef } from "react";
/** Guard in-app navigation and tab closing while a persisted form has edits. */
export function useUnsavedChanges(dirty: boolean) {
  const latest = useRef(dirty);
  latest.current = dirty;
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (latest.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const navigate = (e: Event) => {
      if (latest.current && !window.confirm("Discard unsaved changes?"))
        e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    window.addEventListener("journal-navigate", navigate);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("journal-navigate", navigate);
    };
  }, []);
}
