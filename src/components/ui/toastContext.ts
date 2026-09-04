import { createContext } from 'react';

export type ToastKind = 'error' | 'success' | 'info';

export interface ToastContextValue {
  toast: (kind: ToastKind, message: string) => void;
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
