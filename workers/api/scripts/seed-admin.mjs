import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const username = normalizeUsername(process.env.ADMIN_USERNAME || process.argv[2] || "");
const password = process.env.ADMIN_PASSWORD || process.argv[3] || "";
const nickname = (process.env.ADMIN_NICKNAME || process.argv[4] || username || "LivePilot管理员").trim();
const phone = normalizePhone(process.env.ADMIN_PHONE || "");
const useLocal = process.env.ADMIN_LOCAL === "true" || process.argv.includes("--local");

if (!username || !/^[a-z][a-z0-9_]{3,31}$/.test(username)) {
  throw new Error("请设置 ADMIN_USERNAME，4-32位，首位字母，只能包含字母、数字和下划线。");
}
if (!password || password.length < 8) {
  throw new Error("请设置 ADMIN_PASSWORD，至少8位。");
}

const passwordHash = hashPassword(password);
const sql = `
INSERT INTO users (username, username_normalized, phone, phone_normalized, phone_verified_at, password_hash, nickname, status, role, token_version)
VALUES (${q(username)}, ${q(username)}, ${phone ? q(phone) : "NULL"}, ${phone ? q(phone) : "NULL"}, ${phone ? "CURRENT_TIMESTAMP" : "NULL"}, ${q(passwordHash)}, ${q(nickname)}, 'active', 'admin', 1)
ON CONFLICT(username_normalized) DO UPDATE SET
  password_hash=excluded.password_hash,
  nickname=excluded.nickname,
  phone=COALESCE(excluded.phone, users.phone),
  phone_normalized=COALESCE(excluded.phone_normalized, users.phone_normalized),
  phone_verified_at=COALESCE(excluded.phone_verified_at, users.phone_verified_at),
  status='active',
  role='admin',
  token_version=users.token_version+1,
  updated_at=CURRENT_TIMESTAMP;
`;

const dir = mkdtempSync(join(tmpdir(), "livepilot-seed-admin-"));
const file = join(dir, "seed-admin.sql");
try {
  writeFileSync(file, sql, { mode: 0o600 });
  const args = ["wrangler", "d1", "execute", "livepilot-production", useLocal ? "--local" : "--remote", "--file", file];
  const result = spawnSync("npx", args, {
    encoding: "utf8",
    timeout: 60000,
    env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" }
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const combined = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== 0 && !combined.includes('"success": true')) {
    throw result.error || new Error(`wrangler d1 execute failed with status ${result.status}`);
  }
  console.log(`管理员账号已初始化：${username}（${useLocal ? "local D1" : "remote D1"}）`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

function hashPassword(value) {
  const salt = randomBytes(16);
  const digest = pbkdf2Sync(value, salt, 210000, 32, "sha256");
  return `pbkdf2_sha256$210000$${salt.toString("base64")}$${digest.toString("base64")}`;
}

function normalizeUsername(value) {
  return String(value).trim().toLowerCase();
}

function normalizePhone(value) {
  if (!value) return "";
  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("86") && digits.length === 13) digits = digits.slice(2);
  if (!/^1\d{10}$/.test(digits)) throw new Error("ADMIN_PHONE格式不正确，应为中国大陆手机号。");
  return `+86${digits}`;
}

function q(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}
