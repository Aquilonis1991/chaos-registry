/**
 * 包裝完成後執行此腳本，會依 package.json 的 version 輸出
 * 可貼到 Supabase SQL Editor 的 SQL（更新 app_min_version）。
 *
 * 使用：node scripts/print-force-update-sql.cjs
 * 或：npm run sql:force-update
 */
const fs = require("fs");
const path = require("path");

const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const version = pkg.version || "1.0.0";

const sql = `-- 強制更新：將最低 App 版本設為 ${version}（包裝完成後貼到 Supabase SQL Editor 執行）
-- 低於此版本的 App 會顯示「請更新」畫面

INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'app_min_version',
  '"${version}"'::jsonb,
  'app',
  '最低 App 版本號（如 ${version}）。留空則不強制更新。僅原生 App 會檢查。'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description;
`;

console.log(sql);
console.log("");
console.log("-- 若要取消強制更新，請執行：");
console.log("-- UPDATE public.system_config SET value = '\"\"'::jsonb WHERE key = 'app_min_version';");
