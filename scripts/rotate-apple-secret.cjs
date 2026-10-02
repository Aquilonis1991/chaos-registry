/**
 * 產生新的 Sign in with Apple client secret（JWT），在本地驗證簽章後，
 * 透過 Supabase Management API 寫入 Authentication > Providers > Apple。
 *
 * Apple 的 token / revoke 端點拿假的 code 或 token 時，不論 client secret 對錯都回同樣結果，
 * 沒辦法在不經過真實登入的情況下向 Apple 驗證 secret，所以這裡只做本地簽章與欄位檢查。
 *
 * 環境變數：
 *   APPLE_TEAM_ID、APPLE_KEY_ID
 *   APPLE_PRIVATE_KEY（.p8 內容）或 APPLE_KEY_FILE_PATH（.p8 路徑）
 *   SUPABASE_ACCESS_TOKEN（Supabase 個人 Access Token）
 *   SUPABASE_PROJECT_REF（預設 epyykzxxglkjombvozhr）
 *   APPLE_JWT_OUTPUT_PATH（選填，把 JWT 另存到檔案；不會印到 log）
 *
 * Token 本身永遠不印出來：這個 repo 是公開的，GitHub Actions log 任何人都看得到。
 */

const crypto = require('crypto');
const fs = require('fs');

const CLIENT_ID = 'com.votechaos.app.services';
// Apple 規定 client secret 最長 6 個月
const VALIDITY_DAYS = 180;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少環境變數 ${name}`);
  return value;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateClientSecret({ teamId, keyId, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId };
  const payload = { iss: teamId, iat: now, exp: now + VALIDITY_DAYS * 24 * 60 * 60, aud: 'https://appleid.apple.com', sub: CLIENT_ID };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return { token: `${signingInput}.${base64url(signature)}`, expiresAt: new Date(payload.exp * 1000) };
}

function verifyLocally(token, { teamId, keyId, privateKey }) {
  const [h, p, s] = token.split('.');
  const publicKey = crypto.createPublicKey(privateKey);
  const signatureOk = crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  const problems = [];
  if (!signatureOk) problems.push('簽章驗證失敗');
  if (header.alg !== 'ES256' || header.kid !== keyId) problems.push('header 不正確');
  if (payload.iss !== teamId || payload.sub !== CLIENT_ID || payload.aud !== 'https://appleid.apple.com') problems.push('payload 不正確');
  if (payload.exp - payload.iat > 15777000) problems.push('有效期超過 Apple 上限 6 個月');
  return problems;
}

async function updateSupabase({ accessToken, projectRef, clientSecret }) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ external_apple_secret: clientSecret }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase 更新失敗（HTTP ${res.status}）：${text.slice(0, 300)}`);
  }
}

async function main() {
  const teamId = requireEnv('APPLE_TEAM_ID');
  const keyId = requireEnv('APPLE_KEY_ID');
  const privateKey = process.env.APPLE_PRIVATE_KEY || fs.readFileSync(requireEnv('APPLE_KEY_FILE_PATH'), 'utf8');
  const accessToken = requireEnv('SUPABASE_ACCESS_TOKEN');
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'epyykzxxglkjombvozhr';

  const { token, expiresAt } = generateClientSecret({ teamId, keyId, privateKey });
  console.log(`已產生新的 Apple client secret，到期時間：${expiresAt.toISOString()}`);

  const problems = verifyLocally(token, { teamId, keyId, privateKey });
  if (problems.length > 0) {
    throw new Error(`新的 client secret 檢查未通過（${problems.join('、')}），未更新 Supabase`);
  }
  console.log('本地簽章與欄位檢查通過');

  await updateSupabase({ accessToken, projectRef, clientSecret: token });
  console.log(`已更新 Supabase 專案 ${projectRef} 的 Apple client secret`);

  if (process.env.APPLE_JWT_OUTPUT_PATH) {
    fs.writeFileSync(process.env.APPLE_JWT_OUTPUT_PATH, token, 'utf8');
  }
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
