import React, { useCallback, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToastContext, ToastKind, ToastContextValue } from './toastContext';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const TOAST_TTL_MS = 5000;

const KIND_STYLES: Record<ToastKind, { icon: React.ElementType; classes: string; live: 'assertive' | 'polite' }> = {
  error: {
    icon: AlertCircle,
    classes: 'border-destructive/30 bg-destructive/10 text-destructive',
    live: 'assertive',
  },
  success: {
    icon: CheckCircle2,
    classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    live: 'polite',
  },
  info: {
    icon: Info,
    classes: 'border-border bg-card text-foreground',
    live: 'polite',
  },
};

let nextId = 1;

// Minimal global toast system for failures that have no page-level banner
// (e.g. sign-out). Contextual banners stay where they already exist.
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), TOAST_TTL_MS);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      toastError: (message: string) => toast('error', message),
      toastSuccess: (message: string) => toast('success', message),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const style = KIND_STYLES[t.kind];
          const Icon = style.icon;
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              aria-live={style.live}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-md border p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2',
                style.classes
              )}
            >
              <Icon className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="flex-1 text-xs leading-relaxed">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
