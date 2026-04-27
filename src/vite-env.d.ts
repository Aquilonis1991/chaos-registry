/// <reference types="vite/client" />

/** 與 package.json version 同步，建置時由 Vite 注入 */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** 機器人 admin（Next）公開 HTTPS 根網址，建置時可選；未設則 iframe 預設走同源 /agent-admin */
  readonly VITE_AGENT_ADMIN_BASE?: string;
  /** 僅 Vite dev：/agent-admin 代理目標（預設 http://127.0.0.1:3100，與 chaos-agent-core/admin package.json 一致） */
  readonly VITE_AGENT_ADMIN_PROXY_TARGET?: string;
}
