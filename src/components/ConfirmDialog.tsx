import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#C6A56B]/30 bg-[#FFFFFF] p-6 text-[#171717]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                destructive ? 'bg-[#7B252B]/10 text-[#7B252B]' : 'bg-[#C6A56B]/15 text-[#171717]'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-[#171717]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-1.5 text-[#77716A] transition-colors hover:bg-[#F5F0E6] hover:text-[#171717]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[#77716A]">{description}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[#171717]/15 bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#F5F0E6] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              destructive ? 'bg-[#7B252B] hover:bg-[#5F1C21]' : 'bg-[#171717] hover:bg-[#2E2B28]'
            }`}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
