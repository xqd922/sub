import type { Metadata } from "next";
import "./globals.css";
import { GlobalErrorBoundary } from "@/components/error_boundary";
import ToastContainer from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "通用订阅转换",
  description: "自动识别客户端并转换为对应配置",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <GlobalErrorBoundary>
          {children}
        </GlobalErrorBoundary>
        <ToastContainer />
      </body>
    </html>
  );
}
