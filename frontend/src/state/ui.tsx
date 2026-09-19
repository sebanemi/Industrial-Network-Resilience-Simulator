import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export interface CursorPoint {
  x: number;
  y: number;
}

interface UIContextValue {
  toasts: Toast[];
  notify: (message: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
  cursor: CursorPoint | null;
  setCursor: (p: CursorPoint | null) => void;
  scaleLabel: string | null;
  setScaleLabel: (s: string | null) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

const TOAST_TTL = 3200;

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const [cursor, setCursor] = useState<CursorPoint | null>(null);
  const [scaleLabel, setScaleLabel] = useState<string | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, type, message }]);
      window.setTimeout(() => dismiss(id), TOAST_TTL);
    },
    [dismiss],
  );

  const value = useMemo<UIContextValue>(
    () => ({ toasts, notify, dismiss, cursor, setCursor, scaleLabel, setScaleLabel }),
    [toasts, notify, dismiss, cursor, scaleLabel],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error("useUI debe usarse dentro de <UIProvider>");
  }
  return ctx;
}