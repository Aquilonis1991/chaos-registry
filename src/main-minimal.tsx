import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 最小化版本：只渲染 React，不載入任何 Capacitor 服務
console.log('VoteChaos Minimal Version Starting...');

try {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error('Root element not found');
  }
  
  createRoot(root).render(<App />);
  console.log('React App rendered successfully');
} catch (error) {
  console.error('Failed to render app:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif;">
      <h1>啟動失敗</h1>
      <p>錯誤：${error}</p>
      <p>請查看控制台以獲取更多資訊</p>
    </div>
  `;
}

// 完全不載入任何 Capacitor 服務
console.log('Minimal version: No Capacitor services loaded');



