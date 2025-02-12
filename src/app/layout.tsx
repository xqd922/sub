import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XQD订阅转换",
  description: "将订阅链接转换为Clash配置",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
