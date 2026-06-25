type Env = {
  DB: D1Database;
  UPLOADS: R2Bucket;
  APP_ENV?: string;
  JWT_SECRET?: string;
  REGISTRATION_MODE?: "closed" | "invite" | "open";
  SMS_ENABLED?: string;
  SMS_PROVIDER?: string;
  SMS_CODE_TTL_SECONDS?: string;
  MODEL_API_KEY?: string;
  MODEL_BASE_URL?: string;
  MODEL_TEXT_NAME?: string;
  MODEL_VISION_NAME?: string;
  MODEL_TIMEOUT_MS?: string;
  MODEL_PROVIDER?: string;
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
      if (request.method === "GET" && url.pathname === "/api/prepare-plans") return await listPreparePlans(request, env, url);
      if (request.method === "POST" && url.pathname === "/api/prepare-plans") return await createPreparePlan(request, env);
      if (request.method === "PATCH" && /^\/api\/prepare-plans\/\d+$/.test(url.pathname)) return await updatePreparePlan(request, env, idFromPath(url.pathname, "开播方案不存在"));
      if (request.method === "POST" && /^\/api\/prepare-plans\/\d+\/mark-used$/.test(url.pathname)) return await markPreparePlanUsed(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && url.pathname === "/api/prepare-plans/from-report") return await createPreparePlanFromReport(request, env);
      if (request.method === "GET" && url.pathname === "/api/live-sessions") return await listLiveSessions(request, env, url);
      if (request.method === "POST" && url.pathname === "/api/live-sessions") return await createLiveSession(request, env);
      if (request.method === "DELETE" && /^\/api\/live-sessions\/\d+$/.test(url.pathname)) return await deleteLiveSession(request, env, idFromPath(url.pathname, "复盘不存在"));
      if (request.method === "GET" && /^\/api\/live-sessions\/\d+\/metrics$/.test(url.pathname)) return await getSessionMetrics(request, env, Number(url.pathname.split("/")[3]));
      if (["POST", "PUT"].includes(request.method) && /^\/api\/live-sessions\/\d+\/metrics$/.test(url.pathname)) return await saveSessionMetrics(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && /^\/api\/live-sessions\/\d+\/screenshots$/.test(url.pathname)) return await uploadSessionScreenshots(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "GET" && /^\/api\/live-sessions\/\d+\/screenshots$/.test(url.pathname)) return await listSessionScreenshots(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && /^\/api\/live-sessions\/\d+\/recognized-fields$/.test(url.pathname)) return await confirmRecognizedFields(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && /^\/api\/live-sessions\/\d+\/recognize$/.test(url.pathname)) return await recognizeSessionScreenshots(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "GET" && /^\/api\/live-sessions\/\d+\/report$/.test(url.pathname)) return await getSessionReport(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && /^\/api\/live-sessions\/\d+\/report$/.test(url.pathname)) return await generateSessionReport(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "GET" && /^\/api\/live-sessions\/\d+\/report-versions$/.test(url.pathname)) return await listReportVersions(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "GET" && /^\/api\/live-sessions\/\d+\/report-versions\/\d+$/.test(url.pathname)) return await getReportVersion(request, env, Number(url.pathname.split("/")[3]), Number(url.pathname.split("/")[5]));
      if (request.method === "GET" && url.pathname === "/api/growth-tasks") return await listGrowthTasks(request, env, url);
      if (request.method === "PATCH" && /^\/api\/growth-tasks\/\d+$/.test(url.pathname)) return await updateGrowthTask(request, env, idFromPath(url.pathname, "行动项不存在"));
      if (request.method === "GET" && /^\/api\/streamers\/\d+\/latest-growth-tasks$/.test(url.pathname)) return await latestGrowthTasks(request, env, Number(url.pathname.split("/")[3]));
      if (request.method === "POST" && url.pathname === "/api/feedback") return await createFeedback(request, env);
      if (request.method === "GET" && url.pathname === "/api/feedback") return await listFeedback(request, env);
      if (request.method === "GET" && url.pathname === "/api/rules") return await listRules(request, env, url);
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

async function listPreparePlans(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const streamerId = Number(url.searchParams.get("streamer_id") || 0);
  const accountId = Number(url.searchParams.get("platform_account_id") || 0);
  if (streamerId) await ownedStreamer(env, user.id, streamerId);
  if (accountId) await ownedPlatformAccount(env, user.id, accountId);
  let sql = "SELECT * FROM preparation_plans WHERE user_id=?1";
  const params: unknown[] = [user.id];
  if (streamerId) { sql += " AND streamer_id=?2"; params.push(streamerId); }
  if (accountId) { sql += ` AND platform_account_id=?${params.length + 1}`; params.push(accountId); }
  sql += " ORDER BY id DESC LIMIT 100";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return ok({ items: (rows.results || []).map(serializePreparePlan) });
}

async function createPreparePlan(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  const streamerId = Number(body.streamer_id || 0);
  const accountId = body.platform_account_id ? Number(body.platform_account_id) : null;
  const streamer = await ownedStreamer(env, user.id, streamerId);
  if (accountId) await ownedPlatformAccount(env, user.id, accountId);
  const topic = String(body.topic || "").trim();
  if (!topic) throw new HttpError(400, "请先填写下一场直播主题。");
  const plan = await generatePreparePlanContent(env, streamer, {
    topic,
    duration_minutes: Number(body.duration_minutes || 90),
    goal: String(body.goal || "留得更久"),
    live_form: String(body.live_form || "评论互动"),
    has_cohost: Boolean(body.has_cohost),
    has_ecommerce: Boolean(body.has_ecommerce),
    special_notes: String(body.special_notes || "")
  });
  const result = await env.DB.prepare(
    "INSERT INTO preparation_plans (user_id, streamer_id, platform_account_id, topic, goal, duration_minutes, live_form, has_cohost, has_ecommerce, special_notes, plan_json, source_review_id, source_report_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) RETURNING *"
  ).bind(user.id, streamerId, accountId, topic, body.goal || "留得更久", Number(body.duration_minutes || 90), body.live_form || "评论互动", boolInt(body.has_cohost), boolInt(body.has_ecommerce), body.special_notes || "", JSON.stringify(plan), body.source_review_id || null, body.source_report_id || null).first();
  return ok(serializePreparePlan(result));
}

async function updatePreparePlan(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedPreparePlan(env, user.id, id);
  const body = await readJson<Record<string, unknown>>(request);
  await env.DB.prepare("UPDATE preparation_plans SET topic=COALESCE(?1,topic), plan_json=COALESCE(?2,plan_json), updated_at=CURRENT_TIMESTAMP WHERE id=?3 AND user_id=?4")
    .bind(body.topic ?? null, body.plan ? JSON.stringify(body.plan) : null, id, user.id).run();
  return ok(serializePreparePlan(await ownedPreparePlan(env, user.id, id)));
}

async function markPreparePlanUsed(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedPreparePlan(env, user.id, id);
  await env.DB.prepare("UPDATE preparation_plans SET is_used=1, used_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(id, user.id).run();
  return ok({ ok: true, message: "已标记为使用过。" });
}

async function createPreparePlanFromReport(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<{ report_id?: number; live_session_id?: number; topic?: string }>(request);
  const report = await ownedReport(env, user.id, Number(body.report_id || 0));
  const session = await ownedLiveSession(env, user.id, Number(report.live_session_id));
  const reportJson = safeJson(report.report_json, {}) as any;
  const topic = body.topic || `下一场优化：${reportJson?.top_issue?.title || session.title || "直播承接"}`;
  const planBody = {
    streamer_id: session.streamer_id,
    platform_account_id: session.platform_account_id || null,
    topic,
    duration_minutes: 90,
    goal: "验证复盘改进动作",
    live_form: "评论互动",
    has_cohost: false,
    has_ecommerce: false,
    special_notes: `根据报告 ${report.id} 创建：优先处理 ${reportJson?.one_sentence || "本场最大问题"}。`,
    source_review_id: session.id,
    source_report_id: report.id
  };
  return await createPreparePlan(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(planBody) }), env);
}

async function listLiveSessions(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const streamerId = Number(url.searchParams.get("streamer_id") || 0);
  const accountId = Number(url.searchParams.get("platform_account_id") || 0);
  const status = url.searchParams.get("status") || "";
  if (streamerId) await ownedStreamer(env, user.id, streamerId);
  if (accountId) await ownedPlatformAccount(env, user.id, accountId);
  const filters = ["ls.user_id=?1"];
  const params: unknown[] = [user.id];
  if (streamerId) { filters.push(`ls.streamer_id=?${params.length + 1}`); params.push(streamerId); }
  if (accountId) { filters.push(`ls.platform_account_id=?${params.length + 1}`); params.push(accountId); }
  if (status) { filters.push(`ls.status=?${params.length + 1}`); params.push(status); }
  const rows = await env.DB.prepare(
    `SELECT ls.*, pa.display_name AS pa_display_name, pa.account_handle AS pa_account_handle FROM live_sessions ls LEFT JOIN platform_accounts pa ON pa.id=ls.platform_account_id WHERE ${filters.join(" AND ")} ORDER BY ls.id DESC LIMIT 100`
  ).bind(...params).all();
  return ok((rows.results || []).map(serializeLiveSession));
}

async function createLiveSession(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  const streamerId = Number(body.streamer_id || 0);
  const accountId = body.platform_account_id ? Number(body.platform_account_id) : null;
  await ownedStreamer(env, user.id, streamerId);
  if (accountId) await ownedPlatformAccount(env, user.id, accountId);
  if (body.preparation_plan_id) await ownedPreparePlan(env, user.id, Number(body.preparation_plan_id));
  const result = await env.DB.prepare(
    "INSERT INTO live_sessions (user_id, streamer_id, platform_account_id, preparation_plan_id, platform, data_source, title, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'draft') RETURNING id"
  ).bind(user.id, streamerId, accountId, body.preparation_plan_id || null, body.platform || "douyin", body.data_source || "manual_input", body.title || "直播复盘").first<{ id: number }>();
  return ok(result);
}

async function deleteLiveSession(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedLiveSession(env, user.id, id);
  await env.DB.prepare("UPDATE live_sessions SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(id, user.id).run();
  return ok({ ok: true, message: "复盘已归档。" });
}

async function getSessionMetrics(request: Request, env: Env, sessionId: number): Promise<Response> {
  const user = await requireUser(request, env);
  const session = await ownedLiveSession(env, user.id, sessionId);
  const rows = await env.DB.prepare("SELECT * FROM review_metrics WHERE user_id=?1 AND live_session_id=?2 ORDER BY id").bind(user.id, sessionId).all();
  const metrics = metricsObject(rows.results || []);
  return ok({ ...metrics, session, items: (rows.results || []).map(serializeMetric) });
}

async function saveSessionMetrics(request: Request, env: Env, sessionId: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedLiveSession(env, user.id, sessionId);
  const body = await readJson<Record<string, unknown>>(request);
  await env.DB.prepare(
    "UPDATE live_sessions SET live_date=COALESCE(?1,live_date), session_topic=COALESCE(?2,session_topic), main_goal=COALESCE(?3,main_goal), has_paid_promotion=?4, has_cohost=?5, self_review=COALESCE(?6,self_review), duration_minutes=COALESCE(?7,duration_minutes), peak_online=COALESCE(?8,peak_online), average_online=COALESCE(?9,average_online), new_followers=COALESCE(?10,new_followers), updated_at=CURRENT_TIMESTAMP WHERE id=?11 AND user_id=?12"
  ).bind(body.live_date ?? null, body.session_topic ?? body.title ?? null, body.main_goal ?? null, nullableBool(body.has_paid_promotion), nullableBool(body.has_cohost), body.self_review ?? null, normalizeMetricValue(body.duration_minutes), normalizeMetricValue(body.peak_online), normalizeMetricValue(body.average_online), normalizeMetricValue(body.new_followers), sessionId, user.id).run();
  const known = metricDefinitions();
  for (const [key, def] of Object.entries(known)) {
    if (body[key] === undefined || body[key] === null || body[key] === "") continue;
    await upsertMetric(env, user.id, sessionId, { key, label: def.label, category: def.category, raw_value: String(body[key]), normalized_value: normalizeMetricValue(body[key]), unit: def.unit, source_type: "manual_input", confidence: "manual", is_confirmed: 1 });
  }
  await env.DB.prepare("UPDATE live_sessions SET status='metrics_confirmed' WHERE id=?1 AND user_id=?2 AND status!='reported'").bind(sessionId, user.id).run();
  return await getSessionMetrics(request, env, sessionId);
}

async function uploadSessionScreenshots(request: Request, env: Env, sessionId: number): Promise<Response> {
  const user = await requireUser(request, env);
  const session = await ownedLiveSession(env, user.id, sessionId);
  const form = await request.formData();
  const files = (form.getAll("files") as unknown[]).filter((item) => typeof item === "object" && item !== null && "arrayBuffer" in item) as File[];
  if (!files.length) throw new HttpError(400, "请至少上传一张直播数据截图。");
  if (files.length > 10) throw new HttpError(400, "单场最多上传10张截图。");
  const items: unknown[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = detectImageType(bytes);
    if (!contentType) throw new HttpError(400, "图片格式不正确，请上传 PNG、JPG 或 WebP。");
    if (!bytes.byteLength) throw new HttpError(400, "图片为空，请重新选择。");
    if (bytes.byteLength > 10 * 1024 * 1024) throw new HttpError(413, "单张截图不能超过10MB。");
    const key = `users/${user.id}/reviews/${sessionId}/${crypto.randomUUID()}`;
    await env.UPLOADS.put(key, bytes, { httpMetadata: { contentType } });
    const row = await env.DB.prepare(
      "INSERT INTO live_session_screenshots (user_id, live_session_id, streamer_id, platform_account_id, r2_object_key, original_filename, content_type, size_bytes, upload_status, recognition_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'uploaded', 'uploaded') RETURNING *"
    ).bind(user.id, sessionId, session.streamer_id, session.platform_account_id || null, key, safeFilename(file.name || "screenshot"), contentType, bytes.byteLength).first<any>();
    items.push(serializeScreenshot(row));
    await recognizeOneScreenshot(env, user, session, row).catch(async (error) => {
      await env.DB.prepare("UPDATE live_session_screenshots SET recognition_status='failed', recognition_error=?1, updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND user_id=?3").bind(error instanceof Error ? error.message : "识别失败", row.id, user.id).run();
    });
  }
  await env.DB.prepare("UPDATE live_sessions SET status='metrics_recognized', updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2 AND status!='reported'").bind(sessionId, user.id).run();
  return ok({ items, message: "截图已上传，识别结果需要确认后才会用于报告。" });
}

async function listSessionScreenshots(request: Request, env: Env, sessionId: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedLiveSession(env, user.id, sessionId);
  const rows = await env.DB.prepare("SELECT * FROM live_session_screenshots WHERE user_id=?1 AND live_session_id=?2 ORDER BY id").bind(user.id, sessionId).all();
  return ok({ items: (rows.results || []).map(serializeScreenshot) });
}

async function recognizeSessionScreenshots(request: Request, env: Env, sessionId: number): Promise<Response> {
  const user = await requireUser(request, env);
  const session = await ownedLiveSession(env, user.id, sessionId);
  const rows = await env.DB.prepare("SELECT * FROM live_session_screenshots WHERE user_id=?1 AND live_session_id=?2 ORDER BY id").bind(user.id, sessionId).all();
  for (const row of rows.results || []) await recognizeOneScreenshot(env, user, session, row as any);
  return ok({ ok: true, message: "截图识别已完成，请确认数据。" });
}

async function confirmRecognizedFields(request: Request, env: Env, sessionId: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedLiveSession(env, user.id, sessionId);
  const body = await readJson<{ items?: any[] }>(request);
  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      await upsertMetric(env, user.id, sessionId, { ...item, is_confirmed: 1, source_type: item.source_type || "screenshot_manual_confirmed" });
    }
  } else {
    await env.DB.prepare("UPDATE review_metrics SET is_confirmed=1, updated_at=CURRENT_TIMESTAMP WHERE user_id=?1 AND live_session_id=?2").bind(user.id, sessionId).run();
  }
  await env.DB.prepare("UPDATE live_session_screenshots SET recognition_status='confirmed', updated_at=CURRENT_TIMESTAMP WHERE user_id=?1 AND live_session_id=?2 AND recognition_status IN ('recognized','needs_confirmation')").bind(user.id, sessionId).run();
  await env.DB.prepare("UPDATE live_sessions SET status='metrics_confirmed', updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(sessionId, user.id).run();
  return ok({ ok: true, message: "数据已确认，可以生成诊断报告。" });
}

async function getSessionReport(request: Request, env: Env, sessionId: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedLiveSession(env, user.id, sessionId);
  const report = await env.DB.prepare("SELECT * FROM review_reports WHERE user_id=?1 AND live_session_id=?2 ORDER BY id DESC LIMIT 1").bind(user.id, sessionId).first<any>();
  if (!report) throw new HttpError(404, "报告还没有生成");
  return ok(await serializeReport(env, user.id, report));
}

async function generateSessionReport(request: Request, env: Env, sessionId: number): Promise<Response> {
  const user = await requireUser(request, env);
  const session = await ownedLiveSession(env, user.id, sessionId);
  const metricsRows = (await env.DB.prepare("SELECT * FROM review_metrics WHERE user_id=?1 AND live_session_id=?2 AND is_confirmed=1 ORDER BY id").bind(user.id, sessionId).all()).results || [];
  if (!metricsRows.length) throw new HttpError(400, "请先确认直播数据，再生成报告。");
  const previousRows = (await env.DB.prepare("SELECT * FROM live_sessions WHERE user_id=?1 AND streamer_id=?2 AND id<>?3 AND status='reported' ORDER BY id DESC LIMIT 7").bind(user.id, session.streamer_id, sessionId).all()).results || [];
  const rules = await effectiveRules(env, user.id);
  const reportJson = await generateDiagnosticReport(env, session, metricsRows.map(serializeMetric), previousRows, rules);
  const quality = checkReportQuality(reportJson);
  const result = await env.DB.prepare(
    "INSERT INTO review_reports (user_id, live_session_id, streamer_id, platform_account_id, summary, report_json, quality_status, quality_warnings, model_name, rule_snapshot) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) RETURNING *"
  ).bind(user.id, sessionId, session.streamer_id, session.platform_account_id || null, reportJson.one_sentence, JSON.stringify(reportJson), quality.ok ? "passed" : "needs_review", JSON.stringify(quality.warnings), modelName(env, "text"), JSON.stringify(rules)).first<any>();
  await saveReportChildren(env, user.id, result.id, reportJson, session.streamer_id);
  await env.DB.prepare("UPDATE live_sessions SET status='reported', main_problem=?1, updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND user_id=?3").bind(reportJson.top_issue?.title || "", sessionId, user.id).run();
  return ok(await serializeReport(env, user.id, result));
}

async function listReportVersions(request: Request, env: Env, sessionId: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedLiveSession(env, user.id, sessionId);
  const rows = await env.DB.prepare("SELECT id, summary, model_name, prompt_version, quality_status, created_at FROM review_reports WHERE user_id=?1 AND live_session_id=?2 ORDER BY id DESC").bind(user.id, sessionId).all();
  return ok({ items: rows.results || [] });
}

async function getReportVersion(request: Request, env: Env, sessionId: number, reportId: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedLiveSession(env, user.id, sessionId);
  return ok(await serializeReport(env, user.id, await ownedReport(env, user.id, reportId)));
}

async function listGrowthTasks(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const sessionId = Number(url.searchParams.get("live_session_id") || 0);
  if (sessionId) await ownedLiveSession(env, user.id, sessionId);
  const rows = sessionId
    ? await env.DB.prepare("SELECT ai.* FROM report_action_items ai JOIN review_reports rr ON rr.id=ai.report_id WHERE ai.user_id=?1 AND rr.live_session_id=?2 ORDER BY ai.priority").bind(user.id, sessionId).all()
    : await env.DB.prepare("SELECT * FROM report_action_items WHERE user_id=?1 ORDER BY id DESC LIMIT 50").bind(user.id).all();
  return ok({ items: rows.results || [] });
}

async function updateGrowthTask(request: Request, env: Env, id: number): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  const result = await env.DB.prepare("UPDATE report_action_items SET status=COALESCE(?1,status), remark=COALESCE(?2,remark), updated_at=CURRENT_TIMESTAMP WHERE id=?3 AND user_id=?4 RETURNING *").bind(body.status ?? null, body.remark ?? null, id, user.id).first();
  if (!result) throw new HttpError(404, "行动项不存在");
  return ok(result);
}

async function latestGrowthTasks(request: Request, env: Env, streamerId: number): Promise<Response> {
  const user = await requireUser(request, env);
  await ownedStreamer(env, user.id, streamerId);
  const session = await env.DB.prepare("SELECT * FROM live_sessions WHERE user_id=?1 AND streamer_id=?2 AND status='reported' ORDER BY id DESC LIMIT 1").bind(user.id, streamerId).first<any>();
  if (!session) return ok({ session: null, items: [] });
  const rows = await env.DB.prepare("SELECT ai.id, ai.title AS action, ai.status, ai.remark, ai.target_metric AS improvement FROM report_action_items ai JOIN review_reports rr ON rr.id=ai.report_id WHERE ai.user_id=?1 AND rr.live_session_id=?2 ORDER BY ai.priority").bind(user.id, session.id).all();
  return ok({ session: { id: session.id, title: session.title, created_at: session.created_at }, items: rows.results || [] });
}

async function createFeedback(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  if (body.live_session_id) await ownedLiveSession(env, user.id, Number(body.live_session_id));
  if (body.report_id) await ownedReport(env, user.id, Number(body.report_id));
  await env.DB.prepare("INSERT INTO feedback (user_id, streamer_id, platform_account_id, live_session_id, report_id, feedback_type, content) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(user.id, body.streamer_id || null, body.platform_account_id || null, body.live_session_id || null, body.report_id || null, body.feedback_type || body.type || "其他", body.content || "").run();
  return ok({ ok: true, message: "反馈已收到，谢谢你帮助改进 LivePilot。" });
}

async function listFeedback(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare("SELECT * FROM feedback WHERE user_id=?1 ORDER BY id DESC LIMIT 50").bind(user.id).all();
  return ok({ items: rows.results || [], is_admin: false });
}

async function listRules(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare("SELECT * FROM rules WHERE status='active' AND (user_id IS NULL OR user_id=?1) ORDER BY user_id IS NOT NULL DESC, id DESC LIMIT 100").bind(user.id).all();
  return ok({ items: rows.results || [], total: (rows.results || []).length });
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

async function ownedPreparePlan(env: Env, userId: number, id: number): Promise<any> {
  const row = await env.DB.prepare("SELECT * FROM preparation_plans WHERE id=?1 AND user_id=?2").bind(id, userId).first<any>();
  if (!row) throw new HttpError(404, "开播方案不存在");
  return row;
}

async function ownedLiveSession(env: Env, userId: number, id: number): Promise<any> {
  const row = await env.DB.prepare("SELECT * FROM live_sessions WHERE id=?1 AND user_id=?2 AND status!='archived'").bind(id, userId).first<any>();
  if (!row) throw new HttpError(404, "复盘不存在");
  return row;
}

async function ownedReport(env: Env, userId: number, id: number): Promise<any> {
  const row = await env.DB.prepare("SELECT * FROM review_reports WHERE id=?1 AND user_id=?2").bind(id, userId).first<any>();
  if (!row) throw new HttpError(404, "报告不存在");
  return row;
}

async function upsertMetric(env: Env, userId: number, sessionId: number, metric: any): Promise<void> {
  const def = metricDefinitions()[metric.key] || { label: metric.label || metric.key, category: metric.category || "custom", unit: metric.unit || "" };
  const rawValue = metric.raw_value ?? metric.rawValue ?? metric.value ?? "";
  const normalized = metric.normalized_value ?? normalizeMetricValue(rawValue);
  await env.DB.prepare(
    "INSERT INTO review_metrics (user_id, live_session_id, category, key, label, raw_value, normalized_value, unit, source_type, source_upload_id, source_text, confidence, comparison_json, is_confirmed) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)"
  ).bind(userId, sessionId, metric.category || def.category, metric.key, metric.label || def.label, rawValue === "" ? null : String(rawValue), normalized, metric.unit || def.unit, metric.source_type || "manual_input", metric.source_upload_id || null, metric.source_text || "", metric.confidence || "manual", JSON.stringify(metric.comparison || {}), metric.is_confirmed ? 1 : 0).run();
}

async function recognizeOneScreenshot(env: Env, user: UserRow, session: any, screenshot: any): Promise<void> {
  await env.DB.prepare("UPDATE live_session_screenshots SET recognition_status='processing', updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(screenshot.id, user.id).run();
  const object = await env.UPLOADS.get(screenshot.r2_object_key);
  if (!object) throw new Error("截图文件不存在");
  const bytes = new Uint8Array(await object.arrayBuffer());
  const recognition = await recognizeScreenshotWithModel(env, bytes, screenshot.content_type);
  const normalized = normalizeRecognition(recognition);
  if (!normalized.metrics.length) throw new Error("这张截图暂时没有识别到有效指标，请手动补充数据。");
  await env.DB.prepare(
    "INSERT INTO recognition_results (user_id, live_session_id, upload_id, document_type, raw_json, normalized_json, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'needs_confirmation')"
  ).bind(user.id, session.id, screenshot.id, normalized.document_type, JSON.stringify(recognition), JSON.stringify(normalized)).run();
  for (const metric of normalized.metrics.slice(0, 80)) {
    await upsertMetric(env, user.id, session.id, { ...metric, source_type: "screenshot_ai", source_upload_id: screenshot.id, is_confirmed: 0 });
  }
  await env.DB.prepare("UPDATE live_session_screenshots SET recognition_status='needs_confirmation', updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(screenshot.id, user.id).run();
}

async function recognizeScreenshotWithModel(env: Env, bytes: Uint8Array, contentType: string): Promise<any> {
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) return mockRecognition();
  if (!env.MODEL_API_KEY || !env.MODEL_BASE_URL || !env.MODEL_VISION_NAME) throw new Error("当前尚未配置图片识别模型，请手动录入关键数据，或稍后配置视觉模型。");
  const dataUrl = `data:${contentType};base64,${base64(bytes)}`;
  return await callOpenAIJson(env, env.MODEL_VISION_NAME, [
    { role: "system", content: "你是直播后台截图识别助手。只提取截图中明确出现的数据，返回严格JSON，不分析、不补全、不猜测。" },
    { role: "user", content: [
      { type: "text", text: visionPrompt() },
      { type: "image_url", image_url: { url: dataUrl } }
    ] }
  ]);
}

async function generatePreparePlanContent(env: Env, streamer: any, input: any): Promise<any> {
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) return deterministicPreparePlan(streamer, input);
  if (!env.MODEL_API_KEY || !env.MODEL_BASE_URL || !env.MODEL_TEXT_NAME) throw new HttpError(400, "文字分析模型暂未配置，请先配置模型后再生成开播方案。");
  const result = await callOpenAIJson(env, env.MODEL_TEXT_NAME, [
    { role: "system", content: "你是LivePilot直播增长导师。必须返回严格JSON，方案要具体、可执行、合规，不要空泛建议。" },
    { role: "user", content: JSON.stringify({ task: "generate_preparation_plan", streamer, input, schema: preparePlanSchemaHint() }) }
  ]);
  return validatePreparePlan(result, streamer, input);
}

async function generateDiagnosticReport(env: Env, session: any, metrics: any[], previousSessions: any[], rules: any[]): Promise<any> {
  const context = { session, metrics, previousSessions, rules };
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) return deterministicDiagnostic(context);
  if (!env.MODEL_API_KEY || !env.MODEL_BASE_URL || !env.MODEL_TEXT_NAME) throw new HttpError(400, "文字分析模型暂未配置，请先配置模型后再生成报告。");
  const result = await callOpenAIJson(env, env.MODEL_TEXT_NAME, [
    { role: "system", content: "你是LivePilot AI直播增长导师。基于确认数据做漏斗诊断，区分事实、推断和待验证假设，输出严格JSON。禁止空泛建议，禁止伪造未提供数据。" },
    { role: "user", content: JSON.stringify({ task: "generate_live_growth_report", context, schema: reportSchemaHint() }) }
  ]);
  return validateReportShape(result, context);
}

async function callOpenAIJson(env: Env, model: string, messages: any[]): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.MODEL_TIMEOUT_MS || 30000));
  try {
    const response = await fetch(`${String(env.MODEL_BASE_URL).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.MODEL_API_KEY}` },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.2 }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`模型连接失败：${response.status}`);
    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("模型返回为空");
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function effectiveRules(env: Env, userId: number): Promise<any[]> {
  const rows = await env.DB.prepare("SELECT id, title, category, platform, risk_level, content, recommended_action, prohibited_action, source_name, effective_date, updated_at FROM rules WHERE status='active' AND (user_id IS NULL OR user_id=?1) ORDER BY user_id IS NOT NULL DESC, id DESC LIMIT 20").bind(userId).all();
  return rows.results || [];
}

async function saveReportChildren(env: Env, userId: number, reportId: number, reportJson: any, streamerId: number): Promise<void> {
  for (const item of (reportJson.diagnoses || []).slice(0, 8)) {
    await env.DB.prepare("INSERT INTO report_diagnoses (user_id, report_id, category, title, evidence, reasoning, confidence, impact_level, priority, requires_validation) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)")
      .bind(userId, reportId, item.category || "funnel", item.title || "待验证问题", item.evidence || "", item.reasoning || "", item.confidence || "medium", item.impact_level || "medium", Number(item.priority || 1), item.requires_validation === false ? 0 : 1).run();
  }
  for (const item of (reportJson.actions || []).slice(0, 3)) {
    await env.DB.prepare("INSERT INTO report_action_items (user_id, report_id, category, title, instruction, timing, script_example, target_metric, baseline_value, expected_direction, priority) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)")
      .bind(userId, reportId, item.category || "growth", item.title || "下一场动作", item.instruction || "", item.timing || "", item.script_example || "", item.target_metric || "", item.baseline_value ?? null, item.expected_direction || "up", Number(item.priority || 1)).run();
  }
  for (const item of (reportJson.experiments || []).slice(0, 3)) {
    await env.DB.prepare("INSERT INTO experiments (user_id, streamer_id, source_report_id, hypothesis, action, metric_key, baseline_value, target_value, target_direction) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
      .bind(userId, streamerId, reportId, item.hypothesis || "", item.action || "", item.metric_key || "", item.baseline_value ?? null, item.target_value ?? null, item.target_direction || "up").run();
  }
  for (const rule of reportJson.rule_references || []) {
    await env.DB.prepare("INSERT INTO rule_snapshots (user_id, report_id, rule_id, title, content, source, effective_date) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(userId, reportId, rule.id || null, rule.title || "", rule.content || "", rule.source_name || "LivePilot", rule.effective_date || null).run();
  }
}

async function serializeReport(env: Env, userId: number, report: any): Promise<any> {
  const data = safeJson(report.report_json, {}) as any;
  const actions = (await env.DB.prepare("SELECT * FROM report_action_items WHERE user_id=?1 AND report_id=?2 ORDER BY priority").bind(userId, report.id).all()).results || [];
  const diagnoses = (await env.DB.prepare("SELECT * FROM report_diagnoses WHERE user_id=?1 AND report_id=?2 ORDER BY priority").bind(userId, report.id).all()).results || [];
  const experiments = (await env.DB.prepare("SELECT * FROM experiments WHERE user_id=?1 AND source_report_id=?2 ORDER BY id").bind(userId, report.id).all()).results || [];
  const ruleSnapshots = (await env.DB.prepare("SELECT * FROM rule_snapshots WHERE user_id=?1 AND report_id=?2 ORDER BY id").bind(userId, report.id).all()).results || [];
  const issue = data.top_issue || diagnoses[0] || {};
  const conclusion = data.one_sentence || report.summary || "本场报告已生成，请先查看下一场重点动作。";
  const actionTexts = actions.length
    ? actions.map((item: any) => `${item.timing || "下一场直播中"}：${item.instruction || item.title || "执行一个明确的改进动作"}`)
    : arrayOfStrings(data.actions, 3, ["前3分钟先讲清本场价值，再抛出一个低门槛互动问题。"]);
  const legacyIssues = (actions.length ? actions : diagnoses).slice(0, 5).map((item: any, index: number) => {
    const diagnosis = diagnoses[index] || diagnoses[0] || {};
    return {
      title: diagnosis.title || item.title || "下一场需要验证的问题",
      evidence: diagnosis.evidence || item.evidence || data.top_issue?.evidence || "基于本场已确认直播数据。",
      reason: diagnosis.reasoning || item.reasoning || "当前只能根据后台数据推断，具体内容原因需要结合直播现场情况判断。",
      fix: item.instruction || data.actions?.[index]?.instruction || "下一场先做一个可验证的小调整。",
      script: item.script_example || data.scripts?.opening || "先把今天适合谁、能解决什么说清楚，再抛出一个低门槛互动问题。",
      target: item.target_metric || data.experiments?.[index]?.metric_key || "观察停留、评论和新增关注是否改善。"
    };
  });
  const nextPlan = {
    recommended_theme: data.next_plan?.recommended_theme || `下一场优先解决：${issue.title || data.top_issue?.title || "直播承接和转化"}`,
    titles: arrayOfStrings(data.next_plan?.titles, 5, []).length
      ? arrayOfStrings(data.next_plan.titles, 5, [])
      : [
          `下一场围绕${issue.title || "直播承接"}做一次小实验`,
          "把前3分钟讲清楚：适合谁、解决什么、为什么留下",
          "用一个低门槛问题打开评论区",
          "直播中段固定复盘一次观众最关心的问题",
          "收尾前给出明确关注理由"
        ],
    opening_3_minutes: data.next_plan?.opening_3_minutes || data.scripts?.opening || "开场先说明本场主题、适合的人群和会给到的具体价值，再提出一个二选一互动问题。",
    interaction_nodes: arrayOfStrings(data.next_plan?.interaction_nodes, 3, []).length
      ? arrayOfStrings(data.next_plan.interaction_nodes, 3, [])
      : [
          data.scripts?.interaction || "开播30秒提出二选一问题，快速让观众打1或2。",
          "第10分钟复述一条典型评论，并邀请相似经历的观众补充。",
          "中段每20分钟做一次问题回收，提醒新进观众当前正在解决什么。"
        ],
    follow_prompts: arrayOfStrings(data.next_plan?.follow_prompts, 2, []).length
      ? arrayOfStrings(data.next_plan.follow_prompts, 2, [])
      : [
          data.scripts?.follow || "如果你想继续看这类拆解，可以先点个关注，下一场我会接着验证这个方法。",
          "下次我会把今天这个问题继续拆细，关注后更容易回来接上。"
        ],
    new_traffic_script: data.next_plan?.new_traffic_script || data.scripts?.traffic_rise || "刚进来的朋友，今天先看这一个点：我会用3分钟讲清楚问题在哪里，再给一个能直接照做的动作。",
    goals: experiments.length
      ? experiments.slice(0, 3).map((item: any) => `${item.hypothesis || item.action || "验证一个增长动作"}：观察${item.metric_key || "核心指标"}是否${item.target_direction || "改善"}`)
      : arrayOfStrings(data.next_plan?.goals, 3, ["下一场优先验证停留、评论和新增关注是否改善。"])
  };
  const details = {
    "曝光": data.funnel?.exposure?.diagnosis || "暂无足够曝光数据判断。",
    "进房": data.funnel?.entry?.diagnosis || "暂无足够进房数据判断。",
    "停留": data.funnel?.retention?.diagnosis || "暂无足够停留数据判断。",
    "互动": data.funnel?.interaction?.diagnosis || "暂无足够互动数据判断。",
    "关注": data.funnel?.follow?.diagnosis || "暂无足够关注数据判断。",
    "付费或成交": data.funnel?.paid?.diagnosis || "暂无足够付费或成交数据判断。"
  };
  return {
    id: report.id,
    report_id: report.id,
    live_session_id: report.live_session_id,
    source: (report.model_name || "").startsWith("mock") ? "mock" : "model",
    report_type: report.report_type || "both",
    version_number: report.version_number || report.id,
    is_current_version: true,
    version_created_at: report.created_at,
    summary: conclusion,
    main_problem: data.top_issue?.title || issue.title || "优先检查进房后的承接和停留。",
    strength: data.strongest_advantage || "已经形成可复盘的数据基础，下一场可以用小实验验证改进。",
    next_actions: actionTexts.slice(0, 3),
    issues: legacyIssues,
    details,
    diagnostics: diagnoses.map((item: any) => ({
      rule_name: item.title || item.category || "规则诊断",
      matched_data: item.evidence || "已确认数据",
      judgment: item.reasoning || "需要结合下一场继续验证。",
      confidence: item.confidence || "medium"
    })),
    history_comparison: data.history_comparison || {
      has_history: false,
      limitation: "当前暂无足够历史场次判断趋势。"
    },
    analysis_limits: arrayOfStrings(data.limitations, 5, ["当前仅根据已确认后台数据进行分析，具体内容原因需要结合主播当场情况判断。"]),
    rule_snapshot: ruleSnapshots.map((rule: any) => ({
      id: rule.rule_id || rule.id,
      title: rule.title || "规则依据",
      rule_type: rule.source || "系统规则",
      source_name: rule.source || "LivePilot",
      reason_used: "与本场合规提醒或话术建议相关",
      summary: rule.content || ""
    })),
    next_plan: nextPlan,
    one_sentence: data.one_sentence || report.summary,
    strongest_advantage: data.strongest_advantage || "",
    top_issue: data.top_issue || null,
    structured_actions: actions,
    diagnoses,
    experiments,
    funnel: data.funnel || {},
    scripts: data.scripts || {},
    limitations: data.limitations || [],
    rule_references: data.rule_references || [],
    quality_status: report.quality_status,
    quality_warnings: safeJson(report.quality_warnings, []),
    model_name: report.model_name,
    created_at: report.created_at
  };
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

function serializePreparePlan(row: any): Record<string, unknown> {
  return {
    ...row,
    has_cohost: Boolean(row.has_cohost),
    has_ecommerce: Boolean(row.has_ecommerce),
    is_used: Boolean(row.is_used),
    plan: safeJson(row.plan_json, deterministicPreparePlan({}, { topic: row.topic || "下一场直播", goal: row.goal || "留得更久", duration_minutes: row.duration_minutes || 90 }))
  };
}

function serializeLiveSession(row: any): Record<string, unknown> {
  return {
    ...row,
    platform_account: row.platform_account_id ? { id: row.platform_account_id, display_name: row.pa_display_name || "", account_handle: row.pa_account_handle || "" } : null,
    has_paid_promotion: row.has_paid_promotion === null || row.has_paid_promotion === undefined ? null : Boolean(row.has_paid_promotion),
    has_cohost: row.has_cohost === null || row.has_cohost === undefined ? null : Boolean(row.has_cohost)
  };
}

function serializeScreenshot(row: any): Record<string, unknown> {
  return {
    id: row.id,
    live_session_id: row.live_session_id,
    streamer_id: row.streamer_id,
    platform_account_id: row.platform_account_id,
    original_filename: row.original_filename,
    content_type: row.content_type,
    size_bytes: row.size_bytes,
    upload_status: row.upload_status,
    recognition_status: row.recognition_status,
    recognition_error: row.recognition_error,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function serializeMetric(row: any): Record<string, unknown> {
  return {
    id: row.id,
    category: row.category,
    key: row.key,
    label: row.label,
    raw_value: row.raw_value,
    normalized_value: row.normalized_value,
    unit: row.unit,
    source_type: row.source_type,
    source_upload_id: row.source_upload_id,
    source_text: row.source_text,
    confidence: row.confidence,
    comparison: safeJson(row.comparison_json, {}),
    is_confirmed: Boolean(row.is_confirmed)
  };
}

function metricsObject(rows: any[]): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const row of rows) output[row.key] = row.normalized_value ?? row.raw_value ?? null;
  return output;
}

function metricDefinitions(): Record<string, { label: string; category: string; unit: string }> {
  return {
    duration_minutes: { label: "直播时长", category: "basic", unit: "分钟" },
    duration_seconds: { label: "直播时长", category: "basic", unit: "秒" },
    impressions: { label: "曝光人数", category: "traffic", unit: "人" },
    room_entries: { label: "进房人数", category: "traffic", unit: "人" },
    entry_rate: { label: "进房率", category: "traffic", unit: "%" },
    average_online: { label: "平均在线人数", category: "traffic", unit: "人" },
    peak_online: { label: "最高在线人数", category: "traffic", unit: "人" },
    average_watch_seconds: { label: "人均停留时长", category: "retention", unit: "秒" },
    comments: { label: "评论数", category: "interaction", unit: "次" },
    comment_users: { label: "评论人数", category: "interaction", unit: "人" },
    likes: { label: "点赞次数", category: "interaction", unit: "次" },
    shares: { label: "分享次数", category: "interaction", unit: "次" },
    new_followers: { label: "新增粉丝", category: "follow", unit: "人" },
    fan_club_joins: { label: "加粉丝团人数", category: "follow", unit: "人" },
    gift_users: { label: "送礼人数", category: "revenue", unit: "人" },
    gift_rate: { label: "送礼率", category: "revenue", unit: "%" },
    yinlang: { label: "收获音浪", category: "revenue", unit: "音浪" },
    estimated_income: { label: "预计本场收入", category: "revenue", unit: "元" },
    product_clicks: { label: "商品点击", category: "conversion", unit: "次" },
    orders: { label: "成交订单", category: "conversion", unit: "单" },
    revenue: { label: "成交金额", category: "conversion", unit: "元" }
  };
}

function normalizeMetricValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value).trim().replace(/,/g, "");
  if (!text || text === "--" || text.includes("暂无")) return null;
  const sign = text.startsWith("-") ? -1 : 1;
  text = text.replace(/^[+-]/, "");
  const h = text.match(/(\d+(?:\.\d+)?)\s*小时/);
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:分钟|分)/);
  const s = text.match(/(\d+(?:\.\d+)?)\s*秒/);
  if (h || m || s) return sign * ((Number(h?.[1] || 0) * 3600) + (Number(m?.[1] || 0) * 60) + Number(s?.[1] || 0));
  const num = Number((text.match(/\d+(?:\.\d+)?/) || [""])[0]);
  if (!Number.isFinite(num)) return null;
  let multiplier = 1;
  if (/[亿]/i.test(text)) multiplier = 100000000;
  else if (/[万w]/i.test(text)) multiplier = 10000;
  else if (/[千k]/i.test(text)) multiplier = 1000;
  return sign * num * multiplier;
}

function normalizeRecognition(raw: any): any {
  const metrics = Array.isArray(raw?.metrics) ? raw.metrics.slice(0, 120).map((item: any) => {
    const key = String(item.key || "").slice(0, 80);
    const def = metricDefinitions()[key] || { label: String(item.label || key).slice(0, 80), category: String(item.category || "custom").slice(0, 40), unit: String(item.unit || "").slice(0, 20) };
    return {
      category: String(item.category || def.category).slice(0, 40),
      key,
      label: String(item.label || def.label).slice(0, 80),
      raw_value: String(item.raw_value ?? "").slice(0, 120),
      normalized_value: item.normalized_value ?? normalizeMetricValue(item.raw_value),
      unit: String(item.unit || def.unit).slice(0, 20),
      confidence: ["high", "medium", "low"].includes(item.confidence) ? item.confidence : "medium",
      source_text: String(item.source_text || "").slice(0, 200),
      comparison: typeof item.comparison === "object" && item.comparison ? item.comparison : {}
    };
  }).filter((item: any) => item.key && item.normalized_value !== null) : [];
  return {
    document_type: String(raw?.document_type || "douyin_live_summary").slice(0, 80),
    live_info: raw?.live_info || {},
    metrics,
    unrecognized_fields: Array.isArray(raw?.unrecognized_fields) ? raw.unrecognized_fields.slice(0, 20) : [],
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.slice(0, 20) : [],
    summary: String(raw?.summary || "").slice(0, 500)
  };
}

function validatePreparePlan(result: any, streamer: any, input: any): any {
  return {
    recommended_theme: String(result.recommended_theme || `${input.topic}：解决一个最具体的问题`).slice(0, 120),
    backup_themes: arrayOfStrings(result.backup_themes, 2, [`${input.topic}问答场`, `${streamer.name || "主播"}经验复盘场`]),
    titles: arrayOfStrings(result.titles, 5, [`${input.topic}，今晚把关键问题说清楚`, `别急着划走，${input.topic}先看这3点`, `${input.topic}直播间：先解决最卡的一步`, `新朋友先听3分钟：${input.topic}`, `${input.topic}，这场只讲可执行方法`]),
    opening_3_minutes: String(result.opening_3_minutes || `大家好，今天这场先不铺太大，我们围绕“${input.topic}”解决一个最具体的问题。新进来的朋友先打个1，我会先用3分钟讲清楚今天能带走什么。`).slice(0, 2000),
    interaction_nodes: arrayOfStrings(result.interaction_nodes, 3, ["开播30秒提出二选一问题", "第8分钟点名回应3条评论", "每20分钟重复一次新用户承接"]),
    follow_prompts: arrayOfStrings(result.follow_prompts, 2, ["讲完第一个案例后说明关注后能持续获得什么", "收尾前提醒下场会复盘本场实验结果"]),
    new_traffic_script: String(result.new_traffic_script || `刚进来的朋友先别急，我用20秒把今天主题说清楚：${input.topic}。如果你正好遇到这个问题，先停一下听完第一个方法。`).slice(0, 1000),
    outline: arrayOfStrings(result.outline, 6, ["前3分钟：主题承诺和低门槛互动", "前10分钟：核心问题拆解", "10-30分钟：案例和评论承接", "中段循环：复述主题并邀请新用户参与", "流量上涨：重新介绍主题和互动问题", "收尾：总结并预告下一场"]),
    risk_notes: arrayOfStrings(result.risk_notes, 3, ["避免绝对化承诺", "不把运营经验说成平台官方规则", "涉及情绪和关系问题时避免攻击群体"]),
    target_metrics: arrayOfStrings(result.target_metrics, 3, ["前10分钟平均在线", "人均停留时长", "评论人数"])
  };
}

function validateReportShape(result: any, context: any): any {
  const fallback = deterministicDiagnostic(context);
  return {
    one_sentence: String(result.one_sentence || fallback.one_sentence).slice(0, 240),
    strongest_advantage: String(result.strongest_advantage || fallback.strongest_advantage).slice(0, 240),
    top_issue: result.top_issue || fallback.top_issue,
    facts: Array.isArray(result.facts) ? result.facts.slice(0, 12) : fallback.facts,
    funnel: result.funnel || fallback.funnel,
    diagnoses: Array.isArray(result.diagnoses) && result.diagnoses.length ? result.diagnoses.slice(0, 5) : fallback.diagnoses,
    actions: Array.isArray(result.actions) && result.actions.length ? result.actions.slice(0, 3) : fallback.actions,
    timeline_plan: result.timeline_plan || fallback.timeline_plan,
    scripts: result.scripts || fallback.scripts,
    experiments: Array.isArray(result.experiments) && result.experiments.length ? result.experiments.slice(0, 3) : fallback.experiments,
    limitations: Array.isArray(result.limitations) ? result.limitations.slice(0, 8) : fallback.limitations,
    rule_references: context.rules || []
  };
}

function checkReportQuality(report: any): { ok: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!report.one_sentence) warnings.push("缺少一句话结论");
  if (!report.top_issue?.evidence) warnings.push("最大问题缺少数据证据");
  if (!Array.isArray(report.actions) || !report.actions.length || report.actions.length > 3) warnings.push("行动项数量不符合要求");
  for (const action of report.actions || []) {
    if (!action.timing || !action.instruction || !action.target_metric || !action.script_example) warnings.push(`行动“${action.title || "未命名"}”缺少时间、动作、指标或话术`);
  }
  if (!Array.isArray(report.experiments) || !report.experiments.length || report.experiments.length > 3) warnings.push("实验目标数量不符合要求");
  return { ok: warnings.length === 0, warnings };
}

function deterministicPreparePlan(streamer: any, input: any): any {
  const topic = input.topic || "下一场直播";
  const direction = streamer.direction || "内容分享";
  return validatePreparePlan({
    recommended_theme: `${topic}：先解决进房后的停留承接`,
    backup_themes: [`${topic}真实案例拆解`, `${direction}新用户问答场`],
    titles: [`${topic}，先听完前3分钟`, `新进来的朋友，${topic}别错过这3点`, `${topic}直播间：今晚只讲能照做的方法`, `为什么你看了很多方法还是没变化？`, `把${topic}拆成下一场能执行的动作`],
    opening_3_minutes: `大家好，今天这场围绕“${topic}”。新进来的朋友先打个1，我会先讲清楚今天最值得听的一个点：不是一次改很多，而是先把进房后的承接做好。30秒后我会问一个二选一问题，你们直接打数字就行。`,
    interaction_nodes: ["开播30秒：提出二选一问题，要求打1或2", "第8分钟：读出3条评论并做短回应", "第20分钟：重新介绍主题，承接新进房用户"],
    follow_prompts: ["第一个案例讲完后：如果你想看我连续复盘这个方法，先点个关注", "收尾前：下一场我会拿今天的数据继续验证，关注后能看到结果"],
    new_traffic_script: `刚进来的朋友，我用20秒重新说一下：今天讲“${topic}”，重点不是大道理，是下一场马上能用的动作。你先听完第一个案例再决定走不走。`,
    outline: ["前3分钟：主题承诺、二选一互动、新用户承接", "前10分钟：讲清一个核心问题", "10-30分钟：案例拆解和评论回应", "中段循环：每20分钟复述主题并抛新问题", "流量上涨时：重新介绍主题和互动入口", "在线下降时：切换到更具体生活场景", "收尾：总结动作并预告下场验证"],
    risk_notes: ["避免保证涨粉、保证流量等绝对化承诺", "不要把经验判断说成平台官方规定", "涉及情绪内容时避免群体攻击"],
    target_metrics: ["前10分钟平均在线", "人均停留时长", "评论人数"]
  }, streamer, input);
}

function deterministicDiagnostic(context: any): any {
  const m = Object.fromEntries((context.metrics || []).map((item: any) => [item.key, item.normalized_value]));
  const entries = Number(m.room_entries || 0);
  const avg = Number(m.average_online || 0);
  const peak = Number(m.peak_online || 0);
  const stay = Number(m.average_watch_seconds || 0);
  const comments = Number(m.comments || m.comment_users || 0);
  const followers = Number(m.new_followers || 0);
  const topMetric = peak && avg ? peak / Math.max(avg, 1) : 0;
  const issueTitle = stay && stay < 60 ? "进房后的停留承接偏弱" : topMetric > 2.5 ? "流量峰值没有沉淀为稳定在线" : comments < Math.max(entries * 0.01, 5) ? "互动没有形成足够参与感" : "关注承接需要继续验证";
  const evidence = stay ? `人均停留约${Math.round(stay)}秒` : peak && avg ? `最高在线${peak}，平均在线${avg}` : entries ? `进房人数${entries}` : "当前确认数据较少";
  return {
    one_sentence: `当前最大问题是${issueTitle}，下一场应优先优化前3分钟承接和低门槛互动。`,
    strongest_advantage: entries ? `本场已有${entries}人进房，说明主题或流量入口具备一定基础。` : "本场已经完成数据沉淀，可以从下一场开始建立对比。",
    top_issue: { title: issueTitle, evidence, confidence: stay || peak || comments ? "medium" : "low" },
    facts: (context.metrics || []).slice(0, 8).map((item: any) => `${item.label || item.key}：${item.raw_value ?? item.normalized_value}${item.unit || ""}`),
    funnel: {
      exposure: { conclusion: m.impressions ? "已有曝光数据，可继续观察进房率。" : "缺少曝光数据，暂不能判断标题封面问题。", evidence: m.impressions || null },
      entry: { conclusion: m.entry_rate ? "进房率可作为下一场重点对比。" : "缺少进房率时，不直接判断封面标题。", evidence: m.room_entries || null },
      retention: { conclusion: issueTitle.includes("停留") || issueTitle.includes("峰值") ? "停留和稳定在线是优先瓶颈。" : "停留暂不是唯一瓶颈。", evidence },
      interaction: { conclusion: comments ? "已有互动数据，可观察互动是否转化为关注。" : "评论数据不足，下一场要主动设计互动入口。", evidence: comments || null },
      follow: { conclusion: followers ? "关注转化可继续与进房人数对比。" : "新增关注不足或缺失，需要设计关注理由。", evidence: followers || null },
      revenue: { conclusion: m.yinlang || m.estimated_income ? "已有营收数据，但不应把打赏作为唯一目标。" : "缺少付费数据，暂不判断付费承接。", evidence: m.yinlang || m.estimated_income || null }
    },
    diagnoses: [
      { category: "retention", title: issueTitle, evidence, reasoning: "截图数据只能说明漏斗表现，具体内容原因需要结合主播当场情况判断。", confidence: "medium", impact_level: "high", priority: 1, requires_validation: true },
      { category: "interaction", title: "互动动作需要更低门槛", evidence: comments ? `评论相关数据为${comments}` : "当前缺少足够评论数据", reasoning: "普通号召互动容易被忽略，二选一和点名回应更容易启动评论。", confidence: "medium", impact_level: "medium", priority: 2, requires_validation: true }
    ],
    actions: [
      { category: "opening", title: "前3分钟先做主题承诺和二选一互动", timing: "开播后30秒内", instruction: "不要急着连麦或展开长讲，先说明本场能带走什么，并抛一个二选一问题。", script_example: "刚进来的朋友先停20秒，今天这场只解决一个问题。你们更怕直播没人进来，还是来了留不住？打1或2。", target_metric: "前10分钟平均在线、人均停留时长、评论人数", baseline_value: avg || stay || null, expected_direction: "up", priority: 1 },
      { category: "interaction", title: "每20分钟重新承接新流量", timing: "10-30分钟和中段循环", instruction: "每20分钟重新介绍主题，用一个具体场景问题让新用户进入。", script_example: "刚进来的朋友，我重新说一下今天主题：我们在看直播数据哪里卡住。你现在最想改的是进房、停留还是关注？打关键词。", target_metric: "评论人数、平均在线", baseline_value: comments || avg || null, expected_direction: "up", priority: 2 },
      { category: "follow", title: "给出关注理由而不是机械求关注", timing: "第一个案例讲完后和收尾前", instruction: "说明关注后能持续看到什么结果，避免频繁索取。", script_example: "如果你想看我下一场继续验证这个动作，先点个关注。我会拿下一场数据回来对比，不讲空话。", target_metric: "新增粉丝、关注转化方向", baseline_value: followers || null, expected_direction: "up", priority: 3 }
    ],
    timeline_plan: {
      before_live: "准备一个二选一问题、一个真实场景案例和一条关注理由。",
      first_3_minutes: "主题承诺、二选一互动、点名读评论。",
      first_10_minutes: "讲清核心问题，不急着铺太多分支。",
      minutes_10_30: "用案例承接评论，每20分钟重启新用户入口。",
      mid_loop: "复述主题、抛问题、读评论、给小结。",
      traffic_rise: "重新介绍主题和参与方式。",
      online_drop: "切到更具体的生活场景问题。",
      closing: "总结本场动作，预告下一场验证目标。"
    },
    scripts: {
      opening: "今天这场只解决一个直播增长问题，新进来的朋友先听完前3分钟。",
      retention: "如果你正好卡在这个问题，先别划走，我马上讲一个能照做的小动作。",
      comment: "你现在更想解决进房、停留还是关注？直接打两个字。",
      follow: "关注不是为了求数据，是为了让你看到下一场验证结果。",
      traffic_rise: "刚进来的朋友，我用20秒重新说一下今天在讲什么。",
      online_drop: "我们换一个更具体的场景，你们看是不是更贴近。",
      closing: "下一场我会继续验证这3个动作，重点看停留、评论和关注变化。"
    },
    experiments: [
      { hypothesis: "前3分钟低门槛互动能提升停留和评论", action: "30秒内提出二选一问题并读3条评论", metric_key: "average_watch_seconds", baseline_value: stay || null, target_value: null, target_direction: "up" },
      { hypothesis: "中段重新承接新用户能稳定平均在线", action: "每20分钟复述主题和参与方式", metric_key: "average_online", baseline_value: avg || null, target_value: null, target_direction: "up" },
      { hypothesis: "明确关注理由能提升新增关注", action: "案例后说明关注后能看到下一场验证结果", metric_key: "new_followers", baseline_value: followers || null, target_value: null, target_direction: "up" }
    ],
    limitations: ["当前主要基于后台截图数据，不能判断主播当时具体说了什么。", "没有足够历史场次时，不做严格趋势因果判断。"],
    rule_references: context.rules || []
  };
}

function mockRecognition(): any {
  return {
    document_type: "douyin_live_summary",
    live_info: { title: { raw_value: "示例直播复盘", normalized_value: "示例直播复盘", confidence: "high" } },
    metrics: [
      { category: "traffic", key: "impressions", label: "曝光人数", raw_value: "2.3万", normalized_value: 23000, unit: "人", confidence: "high", source_text: "曝光人数 2.3万", comparison: { period: "最近7场", raw_delta: "+1.3万", normalized_delta: 13000, direction: "up" } },
      { category: "traffic", key: "room_entries", label: "进房人数", raw_value: "5,143", normalized_value: 5143, unit: "人", confidence: "high", source_text: "进房人数 5,143" },
      { category: "traffic", key: "average_online", label: "平均在线人数", raw_value: "32", normalized_value: 32, unit: "人", confidence: "high", source_text: "平均在线人数 32" },
      { category: "traffic", key: "peak_online", label: "最高在线人数", raw_value: "126", normalized_value: 126, unit: "人", confidence: "high", source_text: "最高在线人数 126" },
      { category: "retention", key: "average_watch_seconds", label: "人均停留时长", raw_value: "2.2分钟", normalized_value: 132, unit: "秒", confidence: "high", source_text: "人均停留 2.2分钟" },
      { category: "interaction", key: "comments", label: "评论数", raw_value: "187", normalized_value: 187, unit: "次", confidence: "medium", source_text: "评论数 187" },
      { category: "interaction", key: "likes", label: "点赞次数", raw_value: "1.2w", normalized_value: 12000, unit: "次", confidence: "medium", source_text: "点赞 1.2w" },
      { category: "follow", key: "new_followers", label: "新增粉丝", raw_value: "46", normalized_value: 46, unit: "人", confidence: "high", source_text: "新增粉丝 46" },
      { category: "revenue", key: "yinlang", label: "收获音浪", raw_value: "3,280", normalized_value: 3280, unit: "音浪", confidence: "medium", source_text: "收获音浪 3,280" }
    ],
    unrecognized_fields: [],
    warnings: ["本结果来自本地开发Mock Provider，仅用于自动化测试。"],
    summary: "识别到流量、停留、互动、关注和营收指标。"
  };
}

function arrayOfStrings(value: unknown, max: number, fallback: string[]): string[] {
  const arr = Array.isArray(value) ? value.map((item) => String(item).slice(0, 1000)).filter(Boolean) : [];
  return (arr.length ? arr : fallback).slice(0, max);
}

function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function boolInt(value: unknown): number { return value === true || value === 1 || value === "true" ? 1 : 0; }
function nullableBool(value: unknown): number | null {
  if (value === null || value === undefined || value === "unknown") return null;
  return boolInt(value);
}

function modelName(env: Env, kind: "text" | "vision"): string {
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) return `mock-${kind}`;
  return kind === "text" ? (env.MODEL_TEXT_NAME || "") : (env.MODEL_VISION_NAME || "");
}

function visionPrompt(): string {
  return "识别抖音直播复盘截图中明确出现的直播基础信息、营收、流量、互动、关注、历史对比指标。返回JSON：document_type, live_info, metrics[], unrecognized_fields, warnings, summary。不要猜测缺失值，无法读取返回null或忽略。";
}

function preparePlanSchemaHint(): string {
  return "recommended_theme, backup_themes[2], titles[5], opening_3_minutes, interaction_nodes[3], follow_prompts[2], new_traffic_script, outline[], risk_notes[], target_metrics[3]";
}

function reportSchemaHint(): string {
  return "one_sentence, strongest_advantage, top_issue{title,evidence,confidence}, facts[], funnel{exposure,entry,retention,interaction,follow,revenue}, diagnoses[], actions[<=3], timeline_plan, scripts, experiments[<=3], limitations[]";
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
