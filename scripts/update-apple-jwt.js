/**
 * 自動更新 Apple Sign In JWT Token 並更新 Supabase
 * 
 * 使用方法：
 * 1. 設定環境變數或修改配置
 * 2. 執行：node scripts/update-apple-jwt.js
 * 3. 可以設定為定期執行（Windows Task Scheduler 或 Cron）
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// ============================================
// 配置資訊 - 請填入您的實際資訊
// ============================================

// Team ID（從 Apple Developer Portal 右上角取得）
const TEAM_ID = process.env.APPLE_TEAM_ID || 'YOUR_TEAM_ID';

// Services ID（您建立的 Services ID）
const CLIENT_ID = 'com.votechaos.app.services';

// Key ID（從 Apple Developer Portal Keys 頁面取得）
const KEY_ID = process.env.APPLE_KEY_ID || 'YOUR_KEY_ID';

// .p8 檔案路徑
const KEY_FILE_PATH = process.env.APPLE_KEY_FILE_PATH || 
  path.join(__dirname, '../secrets/apple-sign-in-key.p8');

// JWT 有效期（天數，最大 180 天）
const VALIDITY_DAYS = 180;

// Supabase 配置（可選 - 如果要用 API 自動更新）
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://epyykzxxglkjombvozhr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ============================================
// 生成 JWT Token
// ============================================

function generateJWT() {
  try {
    // 讀取 .p8 私鑰檔案
    const privateKey = fs.readFileSync(KEY_FILE_PATH, 'utf8');

    // 檢查配置
    if (TEAM_ID === 'YOUR_TEAM_ID' || KEY_ID === 'YOUR_KEY_ID') {
      throw new Error('請先設定 TEAM_ID 和 KEY_ID（環境變數或修改腳本）');
    }

    // 檢查檔案是否存在
    if (!fs.existsSync(KEY_FILE_PATH)) {
      throw new Error(`找不到 .p8 檔案：${KEY_FILE_PATH}`);
    }

    // 建立 JWT payload
    const payload = {
      iss: TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (VALIDITY_DAYS * 24 * 60 * 60),
      aud: 'https://appleid.apple.com',
      sub: CLIENT_ID
    };

    // 建立 JWT header
    const header = {
      alg: 'ES256',
      kid: KEY_ID
    };

    // 生成 JWT
    const token = jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      header: header
    });

    return token;
  } catch (error) {
    console.error('❌ 生成 JWT 時發生錯誤：', error.message);
    throw error;
  }
}

// ============================================
// 更新 Supabase（可選）
// ============================================

async function updateSupabase(jwtToken) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️  未設定 SUPABASE_SERVICE_ROLE_KEY，跳過自動更新 Supabase');
    console.log('   請手動將 JWT Token 貼到 Supabase Dashboard');
    return false;
  }

  try {
    // 注意：Supabase 的 Provider 設定需要透過 Dashboard 或 Admin API
    // 這裡提供一個範例，實際可能需要使用 Supabase Management API
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_auth_provider`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        provider: 'apple',
        secret_key: jwtToken
      })
    });

    if (response.ok) {
      console.log('✅ Supabase 已自動更新');
      return true;
    } else {
      console.log('⚠️  Supabase 自動更新失敗，請手動更新');
      return false;
    }
  } catch (error) {
    console.log('⚠️  Supabase 自動更新失敗：', error.message);
    console.log('   請手動將 JWT Token 貼到 Supabase Dashboard');
    return false;
  }
}

// ============================================
// 主程式
// ============================================

async function main() {
  console.log('\n🔄 開始更新 Apple JWT Token...\n');

  try {
    // 生成 JWT Token
    const jwtToken = generateJWT();

    console.log('✅ JWT Token 生成成功！\n');
    console.log('='.repeat(80));
    console.log('JWT Token:');
    console.log('='.repeat(80));
    console.log(jwtToken);
    console.log('='.repeat(80));
    console.log('\n📋 配置資訊：');
    console.log(`   Team ID: ${TEAM_ID}`);
    console.log(`   Client ID: ${CLIENT_ID}`);
    console.log(`   Key ID: ${KEY_ID}`);
    console.log(`   有效期: ${VALIDITY_DAYS} 天`);
    console.log(`   到期時間: ${new Date(Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000).toLocaleString()}`);

    // 儲存到檔案（可選）
    const tokenFilePath = path.join(__dirname, '../secrets/apple-jwt-token.txt');
    fs.writeFileSync(tokenFilePath, jwtToken, 'utf8');
    console.log(`\n💾 JWT Token 已儲存到: ${tokenFilePath}`);

    // 嘗試自動更新 Supabase（如果設定了 Service Role Key）
    if (SUPABASE_SERVICE_ROLE_KEY) {
      console.log('\n🔄 嘗試自動更新 Supabase...');
      await updateSupabase(jwtToken);
    } else {
      console.log('\n📝 下一步：');
      console.log('   1. 前往 Supabase Dashboard > Authentication > Providers > Apple');
      console.log('   2. 將上面的 JWT Token 貼到 Secret Key 欄位');
      console.log('   3. 點擊 Save');
    }

    console.log('\n✅ 完成！\n');

  } catch (error) {
    console.error('\n❌ 更新失敗：', error.message);
    process.exit(1);
  }
}

// 執行主程式
if (require.main === module) {
  main();
}

module.exports = { generateJWT, updateSupabase };
