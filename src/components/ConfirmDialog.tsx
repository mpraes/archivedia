"use client";

import { useCallback, useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Minimal accessible modal. Uses the native <dialog> element so we get
 * focus trapping, ESC handling, and a proper backdrop without extra deps.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleCancel = useCallback(
    (event: React.SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onCancel();
    },
    [onCancel],
  );

  return (
    <dialog
      ref={ref}
      onCancel={handleCancel}
      onClose={onCancel}
      aria-labelledby="confirm-title"
      className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-0 backdrop:bg-black/30"
    >
      <div className="w-[min(28rem,90vw)] p-6">
        <h2 id="confirm-title" className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">
          {title}
        </h2>
        {description ? <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{description}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[var(--color-line)] bg-surface px-4 py-2 text-sm hover:border-[var(--color-ink-soft)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? "rounded-full bg-[var(--color-warn)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-warn)]/90"
                : "rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
