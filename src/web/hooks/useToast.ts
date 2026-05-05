import { useCallback, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 2600);
  }, []);

  return { toasts, showToast };
}
