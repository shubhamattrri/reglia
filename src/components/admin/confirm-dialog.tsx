"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for deletions and cancellations; "primary" for reversible actions. */
  tone?: "danger" | "primary";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Promise-based replacement for window.confirm:
 *   const [ask, confirmDialog] = useConfirm();
 *   if (!(await ask({ title: "Remove Jane?" }))) return;
 * Render `confirmDialog` once in the component.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);

  const ask = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  return [ask, pending ? <ConfirmDialog {...pending} onSettle={settle} /> : null];
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onSettle,
}: ConfirmOptions & { onSettle: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSettle(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSettle]);

  return (
    <div
      className="datta-confirm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onSettle(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="datta-confirm-title"
        aria-describedby={message ? "datta-confirm-text" : undefined}
        className="datta-confirm-panel"
      >
        <div className={`datta-confirm-icon${tone === "primary" ? " is-primary" : ""}`} aria-hidden>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M12 7.5v5.5" />
            <path d="M12 16.5h.01" />
          </svg>
        </div>
        <h2 id="datta-confirm-title" className="datta-confirm-title">
          {title}
        </h2>
        {message ? (
          <div id="datta-confirm-text" className="datta-confirm-text">
            {message}
          </div>
        ) : null}
        <div className="datta-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="datta-btn datta-btn-outline"
            onClick={() => onSettle(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`datta-btn${tone === "danger" ? " datta-btn-solid-danger" : ""}`}
            onClick={() => onSettle(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
