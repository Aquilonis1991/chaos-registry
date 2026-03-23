/**
 * 包裝完成後執行此腳本，會依 package.json 的 version 輸出
 * 可貼到 Supabase SQL Editor 的 SQL（更新 app_min_version_android / app_min_version_ios）。
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
-- 依平台執行對應 UPDATE（或同時更新兩者）

UPDATE public.system_config SET value = '"${version}"'::jsonb WHERE key = 'app_min_version_android';
UPDATE public.system_config SET value = '"${version}"'::jsonb WHERE key = 'app_min_version_ios';
`;

console.log(sql);
console.log("");
console.log("-- 若要取消強制更新，請執行：");
console.log("-- UPDATE public.system_config SET value = '\"\"'::jsonb WHERE key = 'app_min_version_android';");
console.log("-- UPDATE public.system_config SET value = '\"\"'::jsonb WHERE key = 'app_min_version_ios';");
