import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leo的生活学习助手",
  description: "生活、学习、计划、记账和进度管理面板"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
