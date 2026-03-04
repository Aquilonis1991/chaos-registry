/**
 * 僅在開發環境輸出，生產環境不輸出，避免敏感資訊（token、URL、params）寫入日誌。
 */
export const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};
