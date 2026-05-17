import { useCallback } from "react";

type ToastType = "success" | "error" | "info";

export function useToast() {
  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const toast = document.createElement("div");

    const baseClasses =
      "fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white";
    const typeClasses: Record<ToastType, string> = {
      success: "bg-green-600",
      error: "bg-red-600",
      info: "bg-gray-800",
    };

    toast.className = `${baseClasses} ${typeClasses[type]}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease-out";
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 2000);
  }, []);

  return { showToast };
}
