import type { NavigateFunction } from "react-router-dom";

/**
 * 左上角返回：有站內上一頁就 goBack，否則回首頁。
 * 深層連結／冷啟動直接開進詳情頁時，history 沒有可返回的上一頁，避免卡住。
 */
export function navigateBackOrHome(navigate: NavigateFunction, homePath = "/home") {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof idx === "number" && idx > 0) {
    navigate(-1);
    return;
  }
  navigate(homePath, { replace: true });
}
