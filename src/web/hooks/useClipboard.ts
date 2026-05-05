import { useCallback } from "react";

export function useClipboard(onSuccess?: (message: string) => void, onError?: (message: string) => void) {
  return useCallback(
    async (text: string, successMessage = "已复制到剪贴板") => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          textarea.remove();
        }
        onSuccess?.(successMessage);
      } catch {
        onError?.("复制失败，请手动复制");
      }
    },
    [onError, onSuccess],
  );
}
