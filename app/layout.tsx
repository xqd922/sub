import type { Metadata } from "next";
import "./globals.css";
import { GlobalErrorBoundary } from "./components/ErrorBoundary";
import { Providers } from "./providers";

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
        <Providers>
          <GlobalErrorBoundary>
            {children}
          </GlobalErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
