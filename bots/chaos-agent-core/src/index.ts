/**
 * 安全預設：CLI 不直接執行任何對外計畫。
 * 僅允許 admin 後台 API（帶 AGENT_TRIGGER_SOURCE=admin-api）驅動。
 */
console.log(
  "[Agent] CLI disabled. Use admin panel buttons (run-plan / run-audit) to trigger execution."
);
