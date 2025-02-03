import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clash 订阅转换",
  description: "基于 ACL4SSR 规则的 Clash 订阅转换 API 服务",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
