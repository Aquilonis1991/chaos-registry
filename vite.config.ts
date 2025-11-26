import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 確保資源路徑正確（Capacitor 需要）
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-tabs'],
        }
      },
      // 將 native-ad-plugin 設為外部依賴（如果建置失敗時使用）
      external: (id) => {
        // 如果 native-ad-plugin 建置失敗，跳過它
        if (id === '@votechaos/native-ad-plugin') {
          return false; // 不設為外部，讓 Vite 嘗試解析
        }
        return false;
      }
    }
  },
  optimizeDeps: {
    // 排除 native-ad-plugin 的預先優化（因為它是本地套件）
    exclude: ['@votechaos/native-ad-plugin']
  },
}));
