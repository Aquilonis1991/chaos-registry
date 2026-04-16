import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chaos Agent 管理後台",
  description: "觀察機器人本機狀態與緊急剎車（與 ChaosRegistry 分離）"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body style={{ fontFamily: "system-ui", margin: 0, padding: "1rem 1.5rem", background: "#0f1117", color: "#e6e6e6" }}>
        <header
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            marginBottom: "1rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid #2a2f3a"
          }}
        >
          <Link href="/" style={{ color: "#93c5fd", textDecoration: "none" }}>
            總覽後台
          </Link>
          <span style={{ opacity: 0.5 }}>|</span>
          <Link href="/agents-control" style={{ color: "#93c5fd", textDecoration: "none" }}>
            20 位 AI 機器人控制頁
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
