import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chaos Agent 管理後台",
  description: "觀察機器人本機狀態與緊急剎車（與 ChaosRegistry 分離）"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body style={{ fontFamily: "system-ui", margin: 0, padding: "1rem 1.5rem", background: "#0f1117", color: "#e6e6e6" }}>
        {children}
      </body>
    </html>
  );
}
