type Env = {
  DB: D1Database;
  UPLOADS: R2Bucket;
  APP_ENV?: string;
  JWT_SECRET?: string;
  REGISTRATION_MODE?: "closed" | "invite" | "open";
  SMS_ENABLED?: string;
  SMS_PROVIDER?: string;
  SMS_CODE_TTL_SECONDS?: string;
};

type AuthUser = { id: number; username: string; nickname: string; token_version?: number; status?: string };
type UserRow = AuthUser & { phone_normalized?: string; phone_verified_at?: string; password_hash?: string; deleted_at?: string };

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const reservedUsernames = new Set(["admin", "administrator", "root", "system", "support", "livepilot", "api", "null", "undefined"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (request.method === "GET" && ["/health", "/api/health"].includes(url.pathname)) return ok({ ok: true, name: "LivePilot Worker API" });
      if (request.method === "GET" && ["/ready", "/api/ready"].includes(url.pathname)) return await ready(env);
      if (request.method === "GET" && url.pathname === "/api/auth/registration-mode") return ok({ mode: registrationMode(env), sms_enabled: smsEnabled(env) });
      if (request.method === "POST" && url.pathname === "/api/auth/sms/send") return await sendSmsCode(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/sms/verify") return await verifySmsOnly(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/register") return await register(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/login") return await login(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/password-reset/start") return await startPasswordReset(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/password-reset/confirm") return await confirmPasswordReset(request, env);
      if (request.method === "GET" && url.pathname === "/api/me") return ok({ user: publicUser(await requireUser(request, env)) });
      if (request.method === "POST" && url.pathname === "/api/account/change-password") return await changePassword(request, env);
      if (request.method === "GET" && url.pathname === "/api/streamers") return await listStreamers(request, env, url);
      if (request.method === "POST" && url.pathname === "/api/streamers") return await createStreamer(request, env);
      if (request.method === "GET" && /^\/api\/streamers\/\d+$/.test(url.pathname)) return await getStreamer(request, env, idFromPath(url.pathname, "主播不存在"));
      if (request.method === "PATCH" && /^\/api\/streamers\/\d+$/.test(url.pathname)) return await updateStreamer(request, env, idFromPath(url.pathname, "主播不存在"));
      if (request.method === "DELETE" && /^\/api\/streamers\/\d+$/.test(url.pathname)) return await deleteStreamer(request, env, idFromPath(url.pathname, "主播不存在"));
      if (request.method === "POST" && /^\/api\/streamers\/\d+\/restore$/.test(url.pathname)) return await restoreStreamer(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && /^\/api\/streamers\/\d+\/set-default$/.test(url.pathname)) return await setDefaultStreamer(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "GET" && /^\/api\/streamers\/\d+\/platform-accounts$/.test(url.pathname)) return await listStreamerPlatformAccounts(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && url.pathname === "/api/platform/oauth/douyin/authorize-url") return ok({ configured: false, message: "抖音官方授权能力尚未配置，你可以先手动记录账号并继续使用截图复盘。", authorization_url: "" });
      if (request.method === "GET" && url.pathname === "/api/platform-accounts") return await listPlatformAccounts(request, env, url);
      if (request.method === "POST" && url.pathname === "/api/platform-accounts") return await createPlatformAccount(request, env);
      if (request.method === "GET" && /^\/api\/platform-accounts\/\d+$/.test(url.pathname)) return await getPlatformAccount(request, env, idFromPath(url.pathname, "平台账号不存在"));
      if (request.method === "PATCH" && /^\/api\/platform-accounts\/\d+$/.test(url.pathname)) return await updatePlatformAccount(request, env, idFromPath(url.pathname, "平台账号不存在"));
      if (request.method === "DELETE" && /^\/api\/platform-accounts\/\d+$/.test(url.pathname)) return await deletePlatformAccount(request, env, idFromPath(url.pathname, "平台账号不存在"));
      if (request.method === "POST" && /^\/api\/platform-accounts\/\d+\/archive$/.test(url.pathname)) return await deletePlatformAccount(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && /^\/api\/platform-accounts\/\d+\/bind$/.test(url.pathname)) return await bindPlatformAccount(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && /^\/api\/platform-accounts\/\d+\/unbind$/.test(url.pathname)) return await unbindPlatformAccount(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "GET" && /^\/api\/platform-accounts\/\d+\/members$/.test(url.pathname)) return await getPlatformAccount(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && /^\/api\/platform-accounts\/\d+\/members$/.test(url.pathname)) return await unsupportedAccountFeature(request, env, Number(url.pathname.split("/")[3]), "账号成员邀请后续开放。");
      if (["PATCH", "DELETE"].includes(request.method) && /^\/api\/platform-accounts\/\d+\/members\/\d+$/.test(url.pathname)) return await unsupportedAccountFeature(request, env, Number(url.pathname.split("/")[3]), "账号成员管理后续开放。");
      if (request.method === "POST" && /^\/api\/platform-accounts\/\d+\/sync$/.test(url.pathname)) return await unsupportedAccountSync(request, env, Number(url.pathname.split("/")[3]), url.searchParams.get("sync_type") || "account_profile");
      if (request.method === "GET" && url.pathname === "/api/dashboard") return await dashboard(request, env, url);
      if (request.method === "POST" && url.pathname === "/api/dev/session") return await createDevSession(request, env);
      if (request.method === "POST" && url.pathname === "/api/dev/invite") return await createDevInvite(request, env);
      if (request.method === "POST" && url.pathname === "/api/uploads") return await uploadPrivateObject(request, env);
      if (request.method === "GET" && url.pathname.startsWith("/api/uploads/")) return await readPrivateObject(request, env, idFromPath(url.pathname, "文件不存在"));
      if (request.method === "DELETE" && url.pathname.startsWith("/api/uploads/")) return await deletePrivateObject(request, env, idFromPath(url.pathname, "文件不存在"));
      return fail(404, "接口不存在");
    } catch (error) {
      if (error instanceof HttpError) return fail(error.status, error.message);
      return fail(500, "服务暂时异常，请稍后重试。");
    }
  }
};

async function ready(env: Env): Promise<Response> {
  const checks = { d1: false, schema: false, r2: false };
  await env.DB.prepare("SELECT 1").first();
  checks.d1 = true;
  const schema = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','streamers','platform_accounts','sms_verification_codes')").all();
  checks.schema = (schema.results || []).length >= 4;
  const probeKey = `readiness/${crypto.randomUUID()}.txt`;
  await env.UPLOADS.put(probeKey, "ok", { httpMetadata: { contentType: "text/plain" } });
  const probe = await env.UPLOADS.get(probeKey);
  checks.r2 = (await probe?.text()) === "ok";
  await env.UPLOADS.delete(probeKey);
  return ok({ ok: checks.d1 && checks.schema && checks.r2, checks });
}

async function sendSmsCode(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ phone?: string; purpose?: string }>(request);
  const purpose = validPurpose(body.purpose || "");
  const phone = normalizePhone(body.phone || "");
  const ip = clientIp(request);
  await checkRate(env, `sms-phone-${purpose}`, phone, 60, 1);
  await checkRate(env, `sms-ip-${purpose}`, ip, 3600, 30);
  if (!smsEnabled(env)) throw new HttpError(400, "短信服务暂未配置，请稍后再试或联系管理员。");
  const code = randomCode();
  await env.DB.batch([
    env.DB.prepare("UPDATE sms_verification_codes SET status='replaced' WHERE phone_normalized=?1 AND purpose=?2 AND used_at IS NULL AND status='active'").bind(phone, purpose),
    env.DB.prepare("INSERT INTO sms_verification_codes (phone_normalized, purpose, code_hash, expires_at, request_ip) VALUES (?1, ?2, ?3, datetime('now', ?4), ?5)")
      .bind(phone, purpose, await hmacHex(env, `${phone}:${purpose}:${code}`), `+${smsTtl(env)} seconds`, ip)
  ]);
  const payload: Record<string, unknown> = { ok: true, message: `验证码已发送到 ${maskPhone(phone)}。`, phone_masked: maskPhone(phone) };
  if (isDev(env) && smsProvider(env) === "mock") payload.debug_code = code;
  return ok(payload);
}

async function verifySmsOnly(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ phone?: string; purpose?: string; code?: string }>(request);
  const phone = normalizePhone(body.phone || "");
  const purpose = validPurpose(body.purpose || "");
  await consumeSmsCode(env, phone, purpose, body.code || "", false);
  return ok({ ok: true, message: "手机号验证通过" });
}

async function register(request: Request, env: Env): Promise<Response> {
  await checkRate(env, "register-ip", clientIp(request), 3600, 20);
  const mode = registrationMode(env);
  if (mode === "closed") throw new HttpError(403, "当前暂未开放注册");
  const body = await readJson<Record<string, unknown>>(request);
  if (body.accepted_terms !== true) throw new HttpError(400, "请先阅读并同意服务条款和隐私政策。");
  const phone = normalizePhone(String(body.phone || ""));
  const username = validateUsername(String(body.username || ""));
  const nickname = String(body.nickname || body.name || username).trim() || username;
  const password = String(body.password || "");
  if (password.length < 6 || password !== String(body.confirm_password || "")) throw new HttpError(400, "密码不符合要求");
  await consumeSmsCode(env, phone, "register", String(body.sms_code || ""), true);
  if (mode === "invite") await consumeInvite(env, String(body.invite_code || ""));
  const duplicate = await env.DB.prepare("SELECT id FROM users WHERE username_normalized=?1 OR phone_normalized=?2").bind(username, phone).first();
  if (duplicate) throw new HttpError(400, "该用户名或手机号已被使用，请更换后重试。");
  const passwordHash = await hashPassword(password);
  const result = await env.DB.prepare(
    "INSERT INTO users (username, username_normalized, phone, phone_normalized, phone_verified_at, password_hash, nickname, status, token_version) VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP, ?5, ?6, 'active', 1) RETURNING id, username, nickname, token_version"
  ).bind(username, username, phone, phone, passwordHash, nickname).first<AuthUser>();
  if (!result) throw new HttpError(500, "注册失败，请稍后重试。");
  const token = await createToken(env, result.id, result.token_version || 1);
  return ok({ access_token: token, token_type: "bearer", user: publicUser(result) });
}

async function login(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ username?: string; password?: string }>(request);
  const username = normalizeUsername(String(body.username || ""));
  await checkRate(env, "login", username || clientIp(request), 3600, 10);
  const user = await env.DB.prepare("SELECT * FROM users WHERE username_normalized=?1").bind(username).first<UserRow>();
  if (!user || user.status !== "active" || user.deleted_at || !user.password_hash || !(await verifyPassword(String(body.password || ""), user.password_hash))) {
    throw new HttpError(401, "用户名或密码不正确");
  }
  await env.DB.prepare("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?1").bind(user.id).run();
  const token = await createToken(env, user.id, user.token_version || 1);
  return ok({ access_token: token, token_type: "bearer", user: publicUser(user) });
}

async function startPasswordReset(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ account?: string }>(request);
  const account = String(body.account || "").trim();
  await checkRate(env, "reset", clientIp(request), 3600, 10);
  const normalized = account.includes("+") || /^\d/.test(account) ? normalizePhone(account) : normalizeUsername(account);
  const user = await env.DB.prepare("SELECT * FROM users WHERE username_normalized=?1 OR phone_normalized=?1").bind(normalized).first<UserRow>();
  if (!user?.phone_normalized) return ok({ ok: true, message: "如果账号存在，验证码会发送到绑定手机号。" });
  const fakeReq = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify({ phone: user.phone_normalized, purpose: "reset_password" }) });
  return await sendSmsCode(fakeReq, env);
}

async function confirmPasswordReset(request: Request, env: Env): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const account = String(body.account || "").trim();
  const normalized = account.includes("+") || /^\d/.test(account) ? normalizePhone(account) : normalizeUsername(account);
  const user = await env.DB.prepare("SELECT * FROM users WHERE username_normalized=?1 OR phone_normalized=?1").bind(normalized).first<UserRow>();
  if (!user?.phone_normalized) throw new HttpError(400, "验证码错误或已过期");
  await consumeSmsCode(env, user.phone_normalized, "reset_password", String(body.sms_code || ""), true);
  const password = String(body.new_password || "");
  if (password.length < 6 || password !== String(body.confirm_password || "")) throw new HttpError(400, "密码不符合要求");
  if (user.password_hash && await verifyPassword(password, user.password_hash)) throw new HttpError(400, "新密码不能与旧密码相同");
  await env.DB.prepare("UPDATE users SET password_hash=?1, token_version=token_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=?2").bind(await hashPassword(password), user.id).run();
  return ok({ ok: true, message: "密码已修改，请使用新密码登录。" });
}

async function changePassword(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<{ old_password?: string; new_password?: string }>(request);
  const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id=?1").bind(user.id).first<{ password_hash: string }>();
  if (!row?.password_hash || !(await verifyPassword(body.old_password || "", row.password_hash))) throw new HttpError(400, "当前密码不正确");
  if (!body.new_password || body.new_password.length < 6 || await verifyPassword(body.new_password, row.password_hash)) throw new HttpError(400, "新密码不符合要求或与旧密码相同");
  await env.DB.prepare("UPDATE users SET password_hash=?1, token_version=token_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=?2").bind(await hashPassword(body.new_password), user.id).run();
  return ok({ ok: true, message: "密码已修改，请重新登录。" });
}

async function listStreamers(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const search = `%${url.searchParams.get("q") || ""}%`;
  const rows = await env.DB.prepare("SELECT * FROM streamers WHERE user_id=?1 AND name LIKE ?2 ORDER BY is_archived, id DESC LIMIT 100").bind(user.id, search).all();
  return ok((rows.results || []).map(serializeStreamer));
}

async function createStreamer(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  const name = String(body.name || "").trim();
  if (!name) throw new HttpError(400, "主播昵称不能为空");
  const result = await env.DB.prepare(
    "INSERT INTO streamers (user_id, name, direction, live_forms, average_online_range, usual_live_time, improvement_goal, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING *"
  ).bind(user.id, name, body.direction || "内容分享", JSON.stringify(body.live_forms || []), body.average_online_range || "", body.usual_live_time || "", body.improvement_goal || "", body.notes || "").first();
  return ok(serializeStreamer(result));
}

async function getStreamer(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  return ok(serializeStreamer(await ownedStreamer(env, user.id, id)));
}

async function updateStreamer(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedStreamer(env, user.id, id);
  const body = await readJson<Record<string, unknown>>(request);
  await env.DB.prepare("UPDATE streamers SET name=COALESCE(?1,name), direction=COALESCE(?2,direction), live_forms=COALESCE(?3,live_forms), average_online_range=COALESCE(?4,average_online_range), usual_live_time=COALESCE(?5,usual_live_time), improvement_goal=COALESCE(?6,improvement_goal), notes=COALESCE(?7,notes), updated_at=CURRENT_TIMESTAMP WHERE id=?8 AND user_id=?9")
    .bind(body.name ?? null, body.direction ?? null, body.live_forms ? JSON.stringify(body.live_forms) : null, body.average_online_range ?? null, body.usual_live_time ?? null, body.improvement_goal ?? null, body.notes ?? null, id, user.id).run();
  return await getStreamer(request, env, id);
}

async function deleteStreamer(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedStreamer(env, user.id, id);
  await env.DB.prepare("UPDATE streamers SET is_archived=1, updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(id, user.id).run();
  return ok({ ok: true, message: "主播已归档。" });
}

async function restoreStreamer(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedStreamer(env, user.id, id);
  await env.DB.prepare("UPDATE streamers SET is_archived=0, updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(id, user.id).run();
  return ok({ ok: true, message: "主播已恢复。", streamer: serializeStreamer(await ownedStreamer(env, user.id, id)) });
}

async function setDefaultStreamer(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  const streamer = await ownedStreamer(env, user.id, id);
  return ok({ ok: true, message: "已切换当前主播。", streamer: serializeStreamer(streamer) });
}

async function listPlatformAccounts(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const anchorId = Number(url.searchParams.get("anchor_id") || 0);
  if (anchorId) await ownedStreamer(env, user.id, anchorId);
  const rows = anchorId
    ? await env.DB.prepare("SELECT pa.* FROM platform_accounts pa JOIN streamer_platform_accounts spa ON spa.platform_account_id=pa.id WHERE pa.user_id=?1 AND spa.streamer_id=?2 AND pa.is_archived=0 ORDER BY pa.id DESC").bind(user.id, anchorId).all()
    : await env.DB.prepare("SELECT * FROM platform_accounts WHERE user_id=?1 AND is_archived=0 ORDER BY id DESC LIMIT 100").bind(user.id).all();
  return ok({ items: await Promise.all((rows.results || []).map((row) => serializePlatformAccount(env, row))) });
}

async function listStreamerPlatformAccounts(request: Request, env: Env, streamerId: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedStreamer(env, user.id, streamerId);
  const rows = await env.DB.prepare("SELECT pa.*, spa.is_primary FROM platform_accounts pa JOIN streamer_platform_accounts spa ON spa.platform_account_id=pa.id WHERE spa.user_id=?1 AND spa.streamer_id=?2 AND pa.is_archived=0 ORDER BY spa.is_primary DESC, pa.id DESC").bind(user.id, streamerId).all();
  return ok({ items: (rows.results || []).map((row) => serializePlatformAccountSync(row)) });
}

async function createPlatformAccount(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  if (body.anchor_id) await ownedStreamer(env, user.id, Number(body.anchor_id));
  const displayName = String(body.display_name || "").trim();
  if (!displayName) throw new HttpError(400, "账号名称不能为空");
  const result = await env.DB.prepare("INSERT INTO platform_accounts (user_id, platform, display_name, account_handle, account_type, follower_range, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING *")
    .bind(user.id, body.platform || "douyin", displayName, body.account_handle || "", body.account_type || "个人账号", body.follower_range || "", body.notes || "").first<Record<string, unknown>>();
  if (!result) throw new HttpError(500, "平台账号创建失败，请稍后重试。");
  if (body.anchor_id) await bindAccount(env, user.id, Number(result.id), Number(body.anchor_id), true);
  return ok(await serializePlatformAccount(env, result, true));
}

async function getPlatformAccount(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  return ok(await serializePlatformAccount(env, await ownedPlatformAccount(env, user.id, id), true));
}

async function updatePlatformAccount(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedPlatformAccount(env, user.id, id);
  const body = await readJson<Record<string, unknown>>(request);
  if (body.anchor_id) await ownedStreamer(env, user.id, Number(body.anchor_id));
  await env.DB.prepare("UPDATE platform_accounts SET display_name=COALESCE(?1,display_name), account_handle=COALESCE(?2,account_handle), account_type=COALESCE(?3,account_type), follower_range=COALESCE(?4,follower_range), notes=COALESCE(?5,notes), updated_at=CURRENT_TIMESTAMP WHERE id=?6 AND user_id=?7")
    .bind(body.display_name ?? null, body.account_handle ?? null, body.account_type ?? null, body.follower_range ?? null, body.notes ?? null, id, user.id).run();
  if (body.anchor_id) await bindAccount(env, user.id, id, Number(body.anchor_id), true);
  return await getPlatformAccount(request, env, id);
}

async function deletePlatformAccount(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedPlatformAccount(env, user.id, id);
  await env.DB.prepare("UPDATE platform_accounts SET is_archived=1, updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(id, user.id).run();
  return ok({ ok: true, message: "平台账号已归档。" });
}

async function bindPlatformAccount(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<{ streamer_id?: number; anchor_id?: number; is_primary?: boolean }>(request);
  const streamerId = Number(body.streamer_id || body.anchor_id || 0);
  await ownedPlatformAccount(env, user.id, id);
  await ownedStreamer(env, user.id, streamerId);
  await bindAccount(env, user.id, id, streamerId, body.is_primary !== false);
  return ok(await serializePlatformAccount(env, await ownedPlatformAccount(env, user.id, id), true));
}

async function unbindPlatformAccount(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<{ streamer_id?: number; anchor_id?: number }>(request);
  const streamerId = Number(body.streamer_id || body.anchor_id || 0);
  await ownedPlatformAccount(env, user.id, id);
  await ownedStreamer(env, user.id, streamerId);
  await env.DB.prepare("DELETE FROM streamer_platform_accounts WHERE user_id=?1 AND platform_account_id=?2 AND streamer_id=?3").bind(user.id, id, streamerId).run();
  return ok({ ok: true, message: "已解除绑定。" });
}

async function unsupportedAccountFeature(request: Request, env: Env, id: number, message: string): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedPlatformAccount(env, user.id, id);
  return fail(400, message);
}

async function unsupportedAccountSync(request: Request, env: Env, id: number, syncType: string): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedPlatformAccount(env, user.id, id);
  return ok({
    id: 0,
    sync_type: syncType,
    status: "unsupported",
    records_synced: 0,
    error_message: "当前未获得官方数据同步权限，请继续使用截图复盘或手动录入。",
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString()
  });
}

async function dashboard(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const streamerId = Number(url.searchParams.get("streamer_id") || 0);
  const accountId = Number(url.searchParams.get("platform_account_id") || 0);
  if (streamerId) await ownedStreamer(env, user.id, streamerId);
  if (accountId) await ownedPlatformAccount(env, user.id, accountId);
  const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE user_id=?1`).bind(user.id).first<{ total: number }>())?.total || 0;
  const recentPlan = await env.DB.prepare("SELECT id, topic, created_at FROM preparation_plans WHERE user_id=?1 ORDER BY id DESC LIMIT 1").bind(user.id).first();
  const recentSession = await env.DB.prepare("SELECT id, title, status, created_at FROM live_sessions WHERE user_id=?1 ORDER BY id DESC LIMIT 1").bind(user.id).first();
  const recentReport = await env.DB.prepare("SELECT id, summary, created_at FROM review_reports WHERE user_id=?1 ORDER BY id DESC LIMIT 1").bind(user.id).first();
  return ok({
    stats: {
      streamer_count: await count("streamers"),
      platform_account_count: await count("platform_accounts"),
      preparation_plan_count: await count("preparation_plans"),
      live_session_count: await count("live_sessions"),
      report_count: await count("review_reports")
    },
    recent_plan: recentPlan || null,
    recent_session: recentSession || null,
    recent_report: recentReport || null,
    onboarding: {
      has_streamer: (await count("streamers")) > 0,
      has_platform_account: (await count("platform_accounts")) > 0,
      has_plan: (await count("preparation_plans")) > 0,
      has_report: (await count("review_reports")) > 0
    }
  });
}

async function createDevSession(request: Request, env: Env): Promise<Response> {
  if (env.APP_ENV === "production") throw new HttpError(404, "接口不存在");
  const body = await readJson<{ username?: string; nickname?: string }>(request);
  const username = validateUsername(body.username || "local_worker_user");
  const nickname = (body.nickname || "Worker 本地测试用户").trim();
  await env.DB.prepare("INSERT OR IGNORE INTO users (username, username_normalized, nickname, status, token_version) VALUES (?1, ?2, ?3, 'active', 1)").bind(username, username, nickname).run();
  const user = await env.DB.prepare("SELECT id, username, nickname, token_version FROM users WHERE username_normalized=?1").bind(username).first<AuthUser>();
  if (!user) throw new HttpError(500, "无法创建本地测试用户");
  return ok({ token: await createToken(env, user.id, user.token_version || 1), user: publicUser(user) });
}

async function createDevInvite(request: Request, env: Env): Promise<Response> {
  if (env.APP_ENV === "production") throw new HttpError(404, "接口不存在");
  const body = await readJson<{ code?: string; max_uses?: number }>(request);
  const code = (body.code || "BETA2026").trim().toUpperCase();
  await env.DB.prepare("INSERT OR IGNORE INTO invitations (code_hash, label, max_uses, is_active) VALUES (?1, '本地测试邀请码', ?2, 1)").bind(await hmacHex(env, code), body.max_uses || 100).run();
  return ok({ ok: true, code });
}

async function uploadPrivateObject(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const filename = safeFilename(request.headers.get("x-livepilot-filename") || "upload.bin");
  const objectKey = `users/${user.id}/${crypto.randomUUID()}-${filename}`;
  const body = await request.arrayBuffer();
  if (!body.byteLength) throw new HttpError(400, "上传文件不能为空");
  if (body.byteLength > 20 * 1024 * 1024) throw new HttpError(413, "文件太大，请压缩后重试。");
  await env.UPLOADS.put(objectKey, body, { httpMetadata: { contentType } });
  const result = await env.DB.prepare("INSERT INTO uploaded_assets (user_id, object_key, filename, content_type, size_bytes) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id, filename, content_type, size_bytes, created_at").bind(user.id, objectKey, filename, contentType, body.byteLength).first();
  return ok({ item: result });
}

async function readPrivateObject(request: Request, env: Env, assetId: number): Promise<Response> {
  const user = await requireUser(request, env);
  const asset = await ownedAsset(env, user.id, assetId);
  const object = await env.UPLOADS.get(asset.object_key);
  if (!object) throw new HttpError(404, "文件不存在");
  return cors(new Response(object.body, { headers: { "content-type": asset.content_type, "cache-control": "private, no-store", "content-disposition": `attachment; filename="${asset.filename.replace(/"/g, "")}"` } }));
}

async function deletePrivateObject(request: Request, env: Env, assetId: number): Promise<Response> {
  const user = await requireUser(request, env);
  const asset = await ownedAsset(env, user.id, assetId);
  await env.UPLOADS.delete(asset.object_key);
  await env.DB.prepare("UPDATE uploaded_assets SET deleted_at=CURRENT_TIMESTAMP, status='deleted' WHERE id=?1 AND user_id=?2").bind(assetId, user.id).run();
  return ok({ ok: true, message: "文件已删除" });
}

async function requireUser(request: Request, env: Env): Promise<UserRow> {
  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "请先登录");
  const payload = await verifyJwt(env, match[1]);
  const user = await env.DB.prepare("SELECT * FROM users WHERE id=?1").bind(payload.sub).first<UserRow>();
  if (!user || user.status !== "active" || user.deleted_at || Number(user.token_version || 0) !== payload.ver) throw new HttpError(401, "登录已过期，请重新登录");
  return user;
}

async function ownedStreamer(env: Env, userId: number, id: number): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare("SELECT * FROM streamers WHERE id=?1 AND user_id=?2").bind(id, userId).first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "主播不存在");
  return row;
}

async function ownedPlatformAccount(env: Env, userId: number, id: number): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare("SELECT * FROM platform_accounts WHERE id=?1 AND user_id=?2 AND is_archived=0").bind(id, userId).first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "平台账号不存在");
  return row;
}

async function ownedAsset(env: Env, userId: number, assetId: number): Promise<{ object_key: string; filename: string; content_type: string }> {
  const asset = await env.DB.prepare("SELECT object_key, filename, content_type FROM uploaded_assets WHERE id=?1 AND user_id=?2 AND deleted_at IS NULL").bind(assetId, userId).first<{ object_key: string; filename: string; content_type: string }>();
  if (!asset) throw new HttpError(404, "文件不存在");
  return asset;
}

async function bindAccount(env: Env, userId: number, accountId: number, streamerId: number, isPrimary: boolean): Promise<void> {
  if (isPrimary) await env.DB.prepare("UPDATE streamer_platform_accounts SET is_primary=0 WHERE user_id=?1 AND streamer_id=?2").bind(userId, streamerId).run();
  await env.DB.prepare("INSERT OR REPLACE INTO streamer_platform_accounts (user_id, streamer_id, platform_account_id, is_primary) VALUES (?1, ?2, ?3, ?4)").bind(userId, streamerId, accountId, isPrimary ? 1 : 0).run();
}

async function consumeSmsCode(env: Env, phone: string, purpose: string, code: string, markUsed: boolean): Promise<void> {
  const row = await env.DB.prepare("SELECT * FROM sms_verification_codes WHERE phone_normalized=?1 AND purpose=?2 AND status='active' AND used_at IS NULL ORDER BY id DESC LIMIT 1").bind(phone, purpose).first<{ id: number; code_hash: string; expires_at: string; attempt_count: number }>();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) throw new HttpError(400, "验证码错误或已过期");
  if (row.attempt_count >= 5) throw new HttpError(429, "验证码错误次数过多，请重新获取。");
  const expected = await hmacHex(env, `${phone}:${purpose}:${code}`);
  if (expected !== row.code_hash) {
    await env.DB.prepare("UPDATE sms_verification_codes SET attempt_count=attempt_count+1 WHERE id=?1").bind(row.id).run();
    throw new HttpError(400, "验证码错误或已过期");
  }
  if (markUsed) await env.DB.prepare("UPDATE sms_verification_codes SET used_at=CURRENT_TIMESTAMP, status='used' WHERE id=?1").bind(row.id).run();
}

async function consumeInvite(env: Env, code: string): Promise<void> {
  const hash = await hmacHex(env, code.trim().toUpperCase());
  const result = await env.DB.prepare("UPDATE invitations SET used_count=used_count+1, last_used_at=CURRENT_TIMESTAMP WHERE code_hash=?1 AND is_active=1 AND used_count < max_uses AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)").bind(hash).run();
  if (!result.meta || result.meta.changes !== 1) throw new HttpError(400, "邀请码无效");
}

async function checkRate(env: Env, scope: string, subject: string, windowSeconds: number, limit: number): Promise<void> {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const subjectHash = await hmacHex(env, subject);
  await env.DB.prepare("INSERT OR IGNORE INTO rate_limits (scope, subject_hash, window_start, count) VALUES (?1, ?2, ?3, 0)").bind(scope, subjectHash, windowStart).run();
  const row = await env.DB.prepare("UPDATE rate_limits SET count=count+1 WHERE scope=?1 AND subject_hash=?2 AND window_start=?3 RETURNING count").bind(scope, subjectHash, windowStart).first<{ count: number }>();
  if ((row?.count || 0) > limit) throw new HttpError(429, "操作过于频繁，请稍后再试。");
}

function serializeStreamer(row: any): Record<string, unknown> {
  return { ...row, live_forms: safeJson(row.live_forms, []), is_archived: Boolean(row.is_archived), is_default: false, session_count: 0 };
}

async function serializePlatformAccount(env: Env, row: any, includeDetail = false): Promise<Record<string, unknown>> {
  const out = serializePlatformAccountSync(row);
  const bindings = (await env.DB.prepare("SELECT spa.streamer_id, spa.is_primary, s.name FROM streamer_platform_accounts spa JOIN streamers s ON s.id=spa.streamer_id WHERE spa.platform_account_id=?1 ORDER BY spa.is_primary DESC, spa.id DESC").bind(row.id).all()).results || [];
  const primary = bindings[0] as { streamer_id?: number; is_primary?: number; name?: string } | undefined;
  out.bindings = bindings;
  out.anchor = primary ? { id: primary.streamer_id, name: primary.name } : null;
  out.is_primary = Boolean(primary?.is_primary);
  if (includeDetail) {
    out.members = [{ id: 0, user_name: "当前用户", phone_masked: "", role: "owner", permission_scope: "all", status: "active" }];
    out.sync_jobs = [];
    out.data_snapshots = [];
  }
  return out;
}

function serializePlatformAccountSync(row: any): Record<string, unknown> {
  return {
    ...row,
    is_archived: Boolean(row.is_archived),
    is_primary: Boolean(row.is_primary),
    anchor: null,
    member_role: "owner",
    member_count: 1,
    capability_status: {
      "基础资料可读取": false,
      "粉丝数据可读取": false,
      "作品数据可读取": false,
      "广告投放数据可读取": false,
      "直播数据可读取": false,
      "电商直播数据可读取": false,
      "暂不支持": true
    },
    last_synced_at: "",
    connection_status: row.connection_status || "已手动记录",
    authorization_status: row.authorization_status || "未授权"
  };
}

function publicUser(user: AuthUser): Record<string, unknown> {
  return { id: user.id, name: user.nickname || user.username, nickname: user.nickname || user.username, username: user.username };
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await pbkdf2(password, salt, 210000);
  return `pbkdf2_sha256$210000$${base64(salt)}$${base64(digest)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iterations, salt, digest] = stored.split("$");
  if (algo !== "pbkdf2_sha256") return false;
  const actual = await pbkdf2(password, fromBase64(salt), Number(iterations));
  return timingSafeEqual(base64(actual), digest);
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

async function createToken(env: Env, sub: number, ver: number): Promise<string> {
  const header = base64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64urlJson({ sub: String(sub), ver, exp: Math.floor(Date.now() / 1000) + 7 * 86400 });
  const signature = await hmacBase64Url(env, `${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

async function verifyJwt(env: Env, token: string): Promise<{ sub: number; ver: number }> {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new HttpError(401, "登录已过期，请重新登录");
  if (!timingSafeEqual(await hmacBase64Url(env, `${header}.${payload}`), signature)) throw new HttpError(401, "登录已过期，请重新登录");
  const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { sub: string; ver: number; exp: number };
  if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) throw new HttpError(401, "登录已过期，请重新登录");
  return { sub: Number(data.sub), ver: Number(data.ver) };
}

function jwtSecret(env: Env): string {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.APP_ENV === "production") throw new HttpError(500, "服务暂时不可用，请联系管理员配置安全密钥。");
  return "livepilot-local-worker-secret-change-me";
}

async function hmacHex(env: Env, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(jwtSecret(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacBase64Url(env: Env, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(jwtSecret(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function validateUsername(value: string): string {
  const username = value.trim();
  const normalized = username.toLowerCase();
  if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(username) || /^\+?\d{8,16}$/.test(username) || reservedUsernames.has(normalized)) throw new HttpError(400, "用户名需为4至32位，首位为英文字母，只能包含字母、数字和下划线。");
  return normalized;
}
function normalizeUsername(value: string): string { return value.trim().toLowerCase(); }
function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("86") && digits.length === 13) digits = digits.slice(2);
  if (!/^1\d{10}$/.test(digits)) throw new HttpError(400, "请输入正确的中国大陆手机号。");
  return `+86${digits}`;
}
function maskPhone(phone: string): string { const d = phone.slice(-11); return `${d.slice(0, 3)}****${d.slice(-4)}`; }
function validPurpose(value: string): string { if (!["register", "reset_password", "change_phone_old", "change_phone_new"].includes(value)) throw new HttpError(400, "验证码用途不正确"); return value; }
function smsEnabled(env: Env): boolean { return String(env.SMS_ENABLED || "false") === "true"; }
function smsProvider(env: Env): string { return env.SMS_PROVIDER || "disabled"; }
function smsTtl(env: Env): number { return Number(env.SMS_CODE_TTL_SECONDS || 300); }
function registrationMode(env: Env): "closed" | "invite" | "open" { return env.REGISTRATION_MODE || "closed"; }
function isDev(env: Env): boolean { return env.APP_ENV !== "production"; }
function randomCode(): string { return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0"); }
function clientIp(request: Request): string { return request.headers.get("cf-connecting-ip") || "local"; }
function idFromPath(pathname: string, message: string): number { const id = Number(pathname.split("/").filter(Boolean).pop()); if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, message); return id; }
async function readJson<T>(request: Request): Promise<T> { return (await request.json().catch(() => ({}))) as T; }
function safeJson(value: unknown, fallback: unknown): unknown { try { return JSON.parse(String(value)); } catch { return fallback; } }
function safeFilename(value: string): string { return value.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_").slice(0, 120) || "upload.bin"; }
function base64(bytes: Uint8Array): string { let s = ""; bytes.forEach((b) => s += String.fromCharCode(b)); return btoa(s); }
function fromBase64(value: string): Uint8Array { return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)); }
function base64url(bytes: Uint8Array): string { return base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromBase64Url(value: string): Uint8Array { return fromBase64(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")); }
function base64urlJson(value: unknown): string { return base64url(new TextEncoder().encode(JSON.stringify(value))); }
function timingSafeEqual(a: string, b: string): boolean { if (a.length !== b.length) return false; let out = 0; for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i); return out === 0; }
function ok(payload: unknown): Response { return cors(new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders })); }
function fail(status: number, message: string): Response { return cors(new Response(JSON.stringify({ detail: message }), { status, headers: jsonHeaders })); }
function cors(response: Response): Response { const headers = new Headers(response.headers); headers.set("access-control-allow-origin", "*"); headers.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS"); headers.set("access-control-allow-headers", "authorization,content-type,x-livepilot-filename"); return new Response(response.body, { status: response.status, statusText: response.statusText, headers }); }
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
