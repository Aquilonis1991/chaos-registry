/**
 * 執行 Android bundleRelease，產出 AAB。
 * 使用：npm run build:aab（會先 build + cap sync，再執行此腳本）
 * 輸出：android/app/build/outputs/bundle/release/app-release.aab
 */
const path = require("path");
const { spawnSync } = require("child_process");

const androidDir = path.join(__dirname, "..", "android");
const isWin = process.platform === "win32";
const gradleCmd = isWin ? "gradlew.bat" : "./gradlew";

const result = spawnSync(gradleCmd, ["bundleRelease"], {
  cwd: androidDir,
  stdio: "inherit",
  shell: isWin,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("\nAAB 已產出：android/app/build/outputs/bundle/release/app-release.aab");
console.log("上傳至 Play  Console 後可依需求推送到各軌道（內部、封閉、開放、正式）。");
