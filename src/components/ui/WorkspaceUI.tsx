import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
export const money = (value: number) =>
  `${value < 0 ? "−" : ""}₹${Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="panel-heading">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <ArrowUpRight size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const before = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`workspace-dialog ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function notify(message: string, kind: "success" | "error" = "success") {
  window.dispatchEvent(
    new CustomEvent("journal-notice", { detail: { message, kind } }),
  );
}
export function Notifications() {
  const [notice, setNotice] = useState<{
    message: string;
    kind: string;
  } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = (event: Event) => {
      setNotice((event as CustomEvent).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(null), 5000);
    };
    window.addEventListener("journal-notice", handler);
    return () => {
      window.removeEventListener("journal-notice", handler);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="notice-region" role="status" aria-live="polite">
      {notice && (
        <div className={`notice ${notice.kind}`}>
          {notice.kind === "error" ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>{notice.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="space-y-4" aria-label="Loading content" role="status">
      <div className="skeleton h-12" />
      <div className="grid grid-cols-2 gap-4">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
      <div className="skeleton h-64" />
    </div>
  );
}
export function Metric({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {help && (
          <details className="metric-help">
            <summary aria-label={`Explain ${label}`}>?</summary>
            <p>{help}</p>
          </details>
        )}
      </div>
      <strong>{value}</strong>
    </div>
  );
}
