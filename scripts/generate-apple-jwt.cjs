/**
 * 生成 Apple Sign In JWT Token
 * 
 * 使用方法：
 * 1. 將 .p8 檔案放在 secrets/ 資料夾中
 * 2. 修改下面的配置資訊
 * 3. 執行：node scripts/generate-apple-jwt.js
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// ============================================
// 配置資訊 - 請填入您的實際資訊
// ============================================

// Team ID（從 Apple Developer Portal 右上角取得）
const TEAM_ID = 'YOUR_TEAM_ID'; // 例如：ABC123DEF4

// Services ID（您建立的 Services ID）
const CLIENT_ID = 'com.votechaos.app.services';

// Key ID（從 Apple Developer Portal Keys 頁面取得）
const KEY_ID = 'YOUR_KEY_ID'; // 例如：ABC123DEF4

// .p8 檔案路徑
const KEY_FILE_PATH = path.join(__dirname, '../secrets/apple-sign-in-key.p8');

// JWT 有效期（天數，最大 180 天）
const VALIDITY_DAYS = 180;

// ============================================
// 生成 JWT
// ============================================

try {
  // 讀取 .p8 私鑰檔案
  const privateKey = fs.readFileSync(KEY_FILE_PATH, 'utf8');

  // 檢查配置
  if (TEAM_ID === 'YOUR_TEAM_ID' || KEY_ID === 'YOUR_KEY_ID') {
    console.error('❌ 錯誤：請先填入 TEAM_ID 和 KEY_ID');
    process.exit(1);
  }

  // 檢查檔案是否存在
  if (!fs.existsSync(KEY_FILE_PATH)) {
    console.error(`❌ 錯誤：找不到 .p8 檔案：${KEY_FILE_PATH}`);
    console.error('請確認檔案路徑是否正確');
    process.exit(1);
  }

  // 建立 JWT payload
  const payload = {
    iss: TEAM_ID,                    // Issuer (Team ID)
    iat: Math.floor(Date.now() / 1000), // Issued at (當前時間)
    exp: Math.floor(Date.now() / 1000) + (VALIDITY_DAYS * 24 * 60 * 60), // Expiration (180 天後)
    aud: 'https://appleid.apple.com', // Audience
    sub: CLIENT_ID                    // Subject (Services ID)
  };

  // 建立 JWT header
  const header = {
    alg: 'ES256',  // 使用 ES256 算法
    kid: KEY_ID    // Key ID
  };

  // 生成 JWT
  const token = jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: header
  });

  console.log('\n✅ JWT Token 生成成功！\n');
  console.log('='.repeat(80));
  console.log('請複製以下 JWT Token 並貼到 Supabase 的 Secret Key 欄位：');
  console.log('='.repeat(80));
  console.log(token);
  console.log('='.repeat(80));
  console.log('\n📋 配置資訊：');
  console.log(`   Team ID: ${TEAM_ID}`);
  console.log(`   Client ID (Services ID): ${CLIENT_ID}`);
  console.log(`   Key ID: ${KEY_ID}`);
  console.log(`   有效期: ${VALIDITY_DAYS} 天`);
  console.log('\n⚠️  重要提醒：');
  console.log('   1. 此 JWT Token 有效期為 180 天');
  console.log('   2. 到期前需要重新生成並更新 Supabase 設定');
  console.log('   3. 請妥善保存此 Token（但不要提交到 Git）\n');

} catch (error) {
  console.error('\n❌ 生成 JWT 時發生錯誤：');
  console.error(error.message);
  
  if (error.message.includes('Cannot find module')) {
    console.error('\n💡 解決方案：');
    console.error('   請先安裝 jsonwebtoken 套件：');
    console.error('   npm install jsonwebtoken\n');
  } else if (error.message.includes('PEM')) {
    console.error('\n💡 解決方案：');
    console.error('   請確認 .p8 檔案格式正確');
    console.error('   檔案應包含 -----BEGIN PRIVATE KEY----- 和 -----END PRIVATE KEY-----\n');
  }
  
  process.exit(1);
}
