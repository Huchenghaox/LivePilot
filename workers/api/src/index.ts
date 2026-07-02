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
  MODEL_ENCRYPTION_KEY?: string;
  INITIAL_ADMIN_USERNAME?: string;
  INITIAL_ADMIN_EMAIL?: string;
};

type AuthUser = { id: number; username: string; nickname: string; token_version?: number; status?: string; role?: string };
type UserRow = AuthUser & { phone_normalized?: string; phone_verified_at?: string; password_hash?: string; deleted_at?: string };
type ModelRuntimeConfig = { provider: string; baseUrl: string; apiKey: string; textModel: string; visionModel: string; timeoutMs: number; source: "admin" | "secret" | "mock" | "none" };
type ModelCallConfig = { provider: string; baseUrl: string; apiKey: string; model: string; timeoutMs: number; source: "admin" | "secret" | "mock" };
type ModelPurpose = "text" | "vision" | "report" | "preparation";
type UpstreamModelErrorDetails = { status?: number; body?: string; code?: string; message?: string };

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const reservedUsernames = new Set(["admin", "administrator", "root", "system", "support", "livepilot", "api", "null", "undefined"]);
const passwordHashIterations = 60000;

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
      if (request.method === "POST" && ["/api/auth/login", "/api/login"].includes(url.pathname)) return await login(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/password-reset/start") return await startPasswordReset(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/password-reset/confirm") return await confirmPasswordReset(request, env);
      if (request.method === "GET" && ["/api/me", "/api/auth/me"].includes(url.pathname)) return ok({ user: publicUser(await requireUser(request, env)) });
      if (request.method === "POST" && url.pathname === "/api/account/change-password") return await changePassword(request, env);
      if (url.pathname.startsWith("/api/admin/")) return await adminRouter(request, env, url);
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
      if (request.method === "POST" && url.pathname === "/api/platform-accounts/recognize-profile") return await recognizePlatformAccountProfile(request, env);
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
      if (["POST", "PUT"].includes(request.method) && /^\/api\/live-sessions\/\d+\/recognized-fields$/.test(url.pathname)) return await confirmRecognizedFields(request, env, Number(url.pathname.split("/")[3]));
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
      console.error("Unhandled API error", safeErrorLog(error, { method: request.method, path: url.pathname }));
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
  const password = String(body.password || "");
  try {
    await checkRate(env, "login", username || clientIp(request), 3600, 10);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Login rate-limit check failed", safeErrorLog(error, { username }));
    throw new HttpError(500, "服务暂时异常，请稍后重试。");
  }

  let user: UserRow | null;
  try {
    user = await env.DB.prepare(
      "SELECT id, username, nickname, token_version, status, role, phone_normalized, phone_verified_at, password_hash, deleted_at FROM users WHERE username_normalized=?1"
    ).bind(username).first<UserRow>();
  } catch (error) {
    console.error("Login user lookup failed", safeErrorLog(error, { username }));
    throw new HttpError(500, "服务暂时异常，请稍后重试。");
  }

  let passwordOk = false;
  if (user?.password_hash) {
    passwordOk = await verifyPassword(password, user.password_hash);
  }
  if (!user || user.status !== "active" || user.deleted_at || !user.password_hash || !passwordOk) {
    throw new HttpError(401, "用户名或密码不正确");
  }

  try {
    await env.DB.prepare("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?1").bind(user.id).run();
  } catch (error) {
    console.error("Login last_login_at update failed", safeErrorLog(error, { user_id: user.id }));
    throw new HttpError(500, "服务暂时异常，请稍后重试。");
  }

  let token: string;
  try {
    token = await createToken(env, user.id, Number(user.token_version || 1));
  } catch (error) {
    console.error("Login token signing failed", safeErrorLog(error, { user_id: user.id, token_version: user.token_version }));
    throw new HttpError(500, "服务暂时异常，请稍后重试。");
  }
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

async function adminRouter(request: Request, env: Env, url: URL): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (request.method === "GET" && url.pathname === "/api/admin/dashboard") return await adminDashboard(env);
  if (request.method === "GET" && url.pathname === "/api/admin/models") return await getAdminModels(env);
  if (request.method === "PUT" && url.pathname === "/api/admin/models") return await saveAdminModelConfig(request, env, admin);
  if (request.method === "POST" && url.pathname === "/api/admin/models/test-text") return await testAdminModel(request, env, admin, "text");
  if (request.method === "POST" && url.pathname === "/api/admin/models/test-vision") return await testAdminModel(request, env, admin, "vision");
  if (request.method === "GET" && url.pathname === "/api/admin/model-providers") return ok({ items: await listModelProviders(env) });
  if (request.method === "POST" && url.pathname === "/api/admin/model-providers") return await createModelProvider(request, env, admin);
  if (request.method === "PUT" && /^\/api\/admin\/model-providers\/\d+$/.test(url.pathname)) return await updateModelProvider(request, env, admin, Number(url.pathname.split("/")[4]));
  if (request.method === "DELETE" && /^\/api\/admin\/model-providers\/\d+$/.test(url.pathname)) return await deleteModelProvider(request, env, admin, Number(url.pathname.split("/")[4]));
  if (request.method === "POST" && /^\/api\/admin\/model-providers\/\d+\/test$/.test(url.pathname)) return await testModelProvider(request, env, admin, Number(url.pathname.split("/")[4]));
  if (request.method === "POST" && /^\/api\/admin\/model-providers\/\d+\/sync-models$/.test(url.pathname)) return await syncProviderModels(request, env, admin, Number(url.pathname.split("/")[4]));
  if (request.method === "GET" && url.pathname === "/api/admin/model-assignments") return ok(await getModelAssignments(env));
  if (request.method === "PUT" && url.pathname === "/api/admin/model-assignments") return await saveModelAssignments(request, env, admin);
  if (request.method === "POST" && url.pathname === "/api/admin/model-assignments/test-text") return await testAssignedModel(request, env, admin, "text");
  if (request.method === "POST" && url.pathname === "/api/admin/model-assignments/test-vision") return await testAssignedModel(request, env, admin, "vision");
  if (request.method === "GET" && url.pathname === "/api/admin/users") return await adminListUsers(env, url);
  if (request.method === "GET" && /^\/api\/admin\/users\/\d+$/.test(url.pathname)) return await adminGetUser(env, Number(url.pathname.split("/")[4]));
  if (request.method === "PATCH" && /^\/api\/admin\/users\/\d+\/status$/.test(url.pathname)) return await adminUpdateUserStatus(request, env, admin, Number(url.pathname.split("/")[4]));
  if (request.method === "PATCH" && /^\/api\/admin\/users\/\d+\/role$/.test(url.pathname)) return await adminUpdateUserRole(request, env, admin, Number(url.pathname.split("/")[4]));
  if (request.method === "POST" && /^\/api\/admin\/users\/\d+\/password-reset$/.test(url.pathname)) return await adminPasswordReset(env, admin, Number(url.pathname.split("/")[4]));
  if (request.method === "GET" && url.pathname === "/api/admin/rules") return await adminListRules(env, url);
  if (request.method === "POST" && url.pathname === "/api/admin/rules") return await adminCreateRule(request, env, admin);
  if (request.method === "GET" && /^\/api\/admin\/rules\/\d+$/.test(url.pathname)) return await adminGetRule(env, Number(url.pathname.split("/")[4]));
  if (request.method === "PUT" && /^\/api\/admin\/rules\/\d+$/.test(url.pathname)) return await adminUpdateRule(request, env, admin, Number(url.pathname.split("/")[4]));
  if (request.method === "DELETE" && /^\/api\/admin\/rules\/\d+$/.test(url.pathname)) return await adminSetRuleStatus(env, admin, Number(url.pathname.split("/")[4]), "archived");
  if (request.method === "PATCH" && /^\/api\/admin\/rules\/\d+\/status$/.test(url.pathname)) {
    const body = await readJson<{ status?: string }>(request);
    return await adminSetRuleStatus(env, admin, Number(url.pathname.split("/")[4]), body.status || "inactive");
  }
  if (request.method === "GET" && url.pathname === "/api/admin/system/status") return await adminSystemStatus(env);
  if (request.method === "GET" && url.pathname === "/api/admin/audit-logs") return await adminAuditLogs(env, url);
  throw new HttpError(404, "管理员接口不存在");
}

async function adminDashboard(env: Env): Promise<Response> {
  const count = async (sql: string, ...params: unknown[]) => (await env.DB.prepare(sql).bind(...params).first<{ n: number }>())?.n || 0;
  return ok({
    total_users: await count("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL"),
    new_users_today: await count("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND date(created_at)=date('now')"),
    active_users: await count("SELECT COUNT(*) AS n FROM users WHERE status='active' AND deleted_at IS NULL"),
    active_users_today: await count("SELECT COUNT(*) AS n FROM users WHERE status='active' AND deleted_at IS NULL AND date(last_login_at)=date('now')"),
    disabled_users: await count("SELECT COUNT(*) AS n FROM users WHERE status!='active' AND deleted_at IS NULL"),
    streamers: await count("SELECT COUNT(*) AS n FROM streamers"),
    platform_accounts: await count("SELECT COUNT(*) AS n FROM platform_accounts"),
    preparation_plans: await count("SELECT COUNT(*) AS n FROM preparation_plans"),
    live_sessions: await count("SELECT COUNT(*) AS n FROM live_sessions"),
    screenshots: await count("SELECT COUNT(*) AS n FROM live_session_screenshots"),
    recognition_success: await count("SELECT COUNT(*) AS n FROM live_session_screenshots WHERE recognition_status IN ('recognized','needs_confirmation','confirmed')"),
    recognition_failed: await count("SELECT COUNT(*) AS n FROM live_session_screenshots WHERE recognition_status='failed'"),
    reports: await count("SELECT COUNT(*) AS n FROM review_reports"),
    report_failed: await count("SELECT COUNT(*) AS n FROM review_reports WHERE quality_status!='passed'"),
    ai_generations: await count("SELECT COUNT(*) AS n FROM ai_operation_logs WHERE operation IN ('prepare_plan','diagnostic_report','screenshot_recognition')"),
    model_calls: await count("SELECT COUNT(*) AS n FROM ai_operation_logs"),
    model_errors: await count("SELECT COUNT(*) AS n FROM ai_operation_logs WHERE status='failed'"),
    errors_today: await count("SELECT COUNT(*) AS n FROM ai_operation_logs WHERE status='failed' AND date(created_at)=date('now')"),
    new_users_7d: await count("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now','-7 days')"),
    active_users_7d: await count("SELECT COUNT(*) AS n FROM users WHERE last_login_at >= datetime('now','-7 days')")
  });
}

async function adminListUsers(env: Env, url: URL): Promise<Response> {
  const q = `%${url.searchParams.get("q") || ""}%`;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const rows = await env.DB.prepare(`
    SELECT u.id,u.username,u.nickname,u.phone_normalized,u.status,u.role,u.created_at,u.last_login_at,
      (SELECT COUNT(*) FROM streamers s WHERE s.user_id=u.id) AS streamer_count,
      (SELECT COUNT(*) FROM live_sessions ls WHERE ls.user_id=u.id) AS review_count,
      (SELECT COUNT(*) FROM review_reports rr WHERE rr.user_id=u.id) AS report_count
    FROM users u
    WHERE u.deleted_at IS NULL AND (u.username LIKE ?1 OR u.nickname LIKE ?1 OR u.phone_normalized LIKE ?1)
    ORDER BY u.id DESC LIMIT ?2 OFFSET ?3
  `).bind(q, limit, offset).all();
  return ok({ items: (rows.results || []).map(maskAdminUser), limit, offset });
}

async function adminGetUser(env: Env, id: number): Promise<Response> {
  const row = await env.DB.prepare("SELECT id,username,nickname,phone_normalized,status,role,created_at,last_login_at FROM users WHERE id=?1 AND deleted_at IS NULL").bind(id).first();
  if (!row) throw new HttpError(404, "用户不存在");
  return ok(maskAdminUser(row));
}

async function adminUpdateUserStatus(request: Request, env: Env, admin: UserRow, id: number): Promise<Response> {
  const body = await readJson<{ status?: string }>(request);
  const status = body.status === "active" ? "active" : "disabled";
  if (id === admin.id && status !== "active") throw new HttpError(400, "不能禁用自己的管理员账号。");
  const result = await env.DB.prepare("UPDATE users SET status=?1, token_version=token_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND deleted_at IS NULL RETURNING id,username,nickname,phone_normalized,status,role,created_at,last_login_at").bind(status, id).first();
  if (!result) throw new HttpError(404, "用户不存在");
  await audit(env, admin, "admin.user.status", "user", String(id), "success", { status }, request);
  return ok(maskAdminUser(result));
}

async function adminUpdateUserRole(request: Request, env: Env, admin: UserRow, id: number): Promise<Response> {
  const body = await readJson<{ role?: string }>(request);
  const role = body.role === "admin" ? "admin" : "user";
  if (id === admin.id && role !== "admin" && await adminCount(env) <= 1) throw new HttpError(400, "系统至少需要保留一个管理员。");
  const result = await env.DB.prepare("UPDATE users SET role=?1, token_version=token_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND deleted_at IS NULL RETURNING id,username,nickname,phone_normalized,status,role,created_at,last_login_at").bind(role, id).first();
  if (!result) throw new HttpError(404, "用户不存在");
  await audit(env, admin, "admin.user.role", "user", String(id), "success", { role }, request);
  return ok(maskAdminUser(result));
}

async function adminPasswordReset(env: Env, admin: UserRow, id: number): Promise<Response> {
  const result = await env.DB.prepare("UPDATE users SET token_version=token_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND deleted_at IS NULL RETURNING id").bind(id).first();
  if (!result) throw new HttpError(404, "用户不存在");
  await audit(env, admin, "admin.user.password_reset", "user", String(id), "success", { invalidated_tokens: true });
  return ok({ ok: true, message: "已使该用户现有登录状态失效，请用户通过手机号验证码找回密码。" });
}

async function adminListRules(env: Env, url: URL): Promise<Response> {
  const q = `%${url.searchParams.get("q") || ""}%`;
  const category = url.searchParams.get("category") || "";
  const status = url.searchParams.get("status") || "";
  const rows = await env.DB.prepare("SELECT * FROM rules WHERE user_id IS NULL AND title LIKE ?1 AND (?2='' OR category=?2) AND (?3='' OR status=?3) ORDER BY id DESC LIMIT 100").bind(q, category, status).all();
  return ok({ items: rows.results || [] });
}

async function adminGetRule(env: Env, id: number): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM rules WHERE id=?1 AND user_id IS NULL").bind(id).first();
  if (!row) throw new HttpError(404, "规则不存在");
  return ok(row);
}

async function adminCreateRule(request: Request, env: Env, admin: UserRow): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  if (!title || !content) throw new HttpError(400, "规则标题和内容不能为空。");
  const row = await env.DB.prepare(`INSERT INTO rules (user_id,title,category,platform,risk_level,content,recommended_action,prohibited_action,source_name,source_url,published_at,effective_date,expires_at,status,version,created_by,updated_by)
    VALUES (NULL,?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,1,?14,?14) RETURNING *`)
    .bind(title, body.category || "运营经验", body.platform || "douyin", body.risk_level || "medium", content, body.recommended_action || "", body.prohibited_action || "", body.source_name || "内部运营经验", body.source_url || "", body.published_at || null, body.effective_date || null, body.expires_at || null, body.status || "active", admin.id).first();
  await audit(env, admin, "admin.rule.create", "rule", String((row as any).id), "success", { title }, request);
  return ok(row);
}

async function adminUpdateRule(request: Request, env: Env, admin: UserRow, id: number): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const row = await env.DB.prepare(`UPDATE rules SET title=COALESCE(?1,title), category=COALESCE(?2,category), platform=COALESCE(?3,platform), risk_level=COALESCE(?4,risk_level), content=COALESCE(?5,content), recommended_action=COALESCE(?6,recommended_action), prohibited_action=COALESCE(?7,prohibited_action), source_name=COALESCE(?8,source_name), source_url=COALESCE(?9,source_url), published_at=COALESCE(?10,published_at), effective_date=COALESCE(?11,effective_date), expires_at=COALESCE(?12,expires_at), status=COALESCE(?13,status), version=version+1, updated_by=?14, updated_at=CURRENT_TIMESTAMP WHERE id=?15 AND user_id IS NULL RETURNING *`)
    .bind(body.title ?? null, body.category ?? null, body.platform ?? null, body.risk_level ?? null, body.content ?? null, body.recommended_action ?? null, body.prohibited_action ?? null, body.source_name ?? null, body.source_url ?? null, body.published_at ?? null, body.effective_date ?? null, body.expires_at ?? null, body.status ?? null, admin.id, id).first();
  if (!row) throw new HttpError(404, "规则不存在");
  await audit(env, admin, "admin.rule.update", "rule", String(id), "success", { title: (row as any).title }, request);
  return ok(row);
}

async function adminSetRuleStatus(env: Env, admin: UserRow, id: number, status: string): Promise<Response> {
  const safeStatus = ["active", "inactive", "archived"].includes(status) ? status : "inactive";
  const row = await env.DB.prepare("UPDATE rules SET status=?1, updated_by=?2, updated_at=CURRENT_TIMESTAMP WHERE id=?3 AND user_id IS NULL RETURNING *").bind(safeStatus, admin.id, id).first();
  if (!row) throw new HttpError(404, "规则不存在");
  await audit(env, admin, "admin.rule.status", "rule", String(id), "success", { status: safeStatus });
  return ok(row);
}

async function adminSystemStatus(env: Env): Promise<Response> {
  const runtime = await modelRuntimeConfig(env);
  const assignments = await getRawModelAssignments(env);
  const textProvider = assignments?.default_text_provider_id ? await getModelProvider(env, Number(assignments.default_text_provider_id)) : null;
  const visionProvider = assignments?.default_vision_provider_id ? await getModelProvider(env, Number(assignments.default_vision_provider_id)) : null;
  const latestProviderTest = [textProvider, visionProvider]
    .filter(Boolean)
    .sort((a: any, b: any) => String(b.last_tested_at || "").localeCompare(String(a.last_tested_at || "")))[0] as any;
  const recentModelFailures = await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_logs WHERE action LIKE 'admin.model.test%' AND result!='success' AND created_at >= datetime('now','-7 days')").first<{ n: number }>();
  return ok({
    api_worker: "ok",
    d1: "ok",
    r2: "ok",
    text_model: await modelAvailability(env, "text"),
    vision_model: await modelAvailability(env, "vision"),
    current_text_model: runtime.textModel || "",
    current_vision_model: runtime.visionModel || "",
    last_text_test: latestProviderTest?.last_test_status || "untested",
    last_model_message: latestProviderTest?.last_test_message || "",
    registration_mode: registrationMode(env),
    sms_enabled: smsEnabled(env),
    model_failures_7d: recentModelFailures?.n || 0
  });
}

async function adminAuditLogs(env: Env, url: URL): Promise<Response> {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
  const rows = await env.DB.prepare("SELECT al.*, u.username AS admin_username FROM admin_audit_logs al LEFT JOIN users u ON u.id=al.admin_user_id ORDER BY al.id DESC LIMIT ?1").bind(limit).all();
  return ok({ items: rows.results || [] });
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

async function recognizePlatformAccountProfile(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) throw new HttpError(400, "请上传一张抖音主页截图。");
  const bytes = new Uint8Array(await (file as File).arrayBuffer());
  const contentType = detectImageType(bytes);
  if (!contentType) throw new HttpError(400, "图片格式不正确，请上传 PNG、JPG 或 WebP。");
  if (!bytes.byteLength) throw new HttpError(400, "图片为空，请重新选择。");
  if (bytes.byteLength > 10 * 1024 * 1024) throw new HttpError(413, "单张截图不能超过10MB。");
  return ok(await recognizePlatformProfileWithModel(env, bytes, contentType, user.id));
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
  if (body.source_review_id) await ownedLiveSession(env, user.id, Number(body.source_review_id));
  if (body.source_report_id) await ownedReport(env, user.id, Number(body.source_report_id));
  const topic = String(body.topic || "").trim();
  if (!topic) throw new HttpError(400, "请先填写下一场直播主题。");
  let plan: any;
  try {
    plan = await generatePreparePlanContent(env, user.id, streamer, {
      topic,
      duration_minutes: Number(body.duration_minutes || 90),
      goal: String(body.goal || "留得更久"),
      live_form: String(body.live_form || "评论互动"),
      has_cohost: Boolean(body.has_cohost),
      has_ecommerce: Boolean(body.has_ecommerce),
      special_notes: String(body.special_notes || "")
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const message = modelErrorMessage(error);
    console.error("Prepare plan generation failed", safeErrorLog(error, { user_id: user.id, streamer_id: streamerId }));
    throw new HttpError(400, `开播方案生成失败：${message}`);
  }
  let result: any;
  try {
    result = await env.DB.prepare(
      "INSERT INTO preparation_plans (user_id, streamer_id, platform_account_id, topic, goal, duration_minutes, live_form, has_cohost, has_ecommerce, special_notes, plan_json, source_review_id, source_report_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) RETURNING *"
    ).bind(user.id, streamerId, accountId, topic, body.goal || "留得更久", Number(body.duration_minutes || 90), body.live_form || "评论互动", boolInt(body.has_cohost), boolInt(body.has_ecommerce), body.special_notes || "", JSON.stringify(plan), body.source_review_id || null, body.source_report_id || null).first();
  } catch (error) {
    console.error("Prepare plan save failed", safeErrorLog(error, { user_id: user.id, streamer_id: streamerId }));
    throw new HttpError(500, "开播方案保存失败，请稍后重试。");
  }
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
  const items = (rows.results || []).map(serializeMetric);
  const response = {
    ...metrics,
    duration_minutes: session.duration_minutes ?? metrics.duration_minutes ?? null,
    peak_online: session.peak_online ?? metrics.peak_online ?? null,
    average_online: session.average_online ?? metrics.average_online ?? null,
    new_followers: session.new_followers ?? metrics.new_followers ?? null,
    session,
    session_topic: session.session_topic || session.title || "",
    live_date: session.live_date || "",
    main_goal: session.main_goal || "",
    has_paid_promotion: nullableBooleanFromDb(session.has_paid_promotion),
    has_cohost: nullableBooleanFromDb(session.has_cohost),
    self_review: session.self_review || "",
    items,
    fields: items.map(metricToField)
  };
  console.log("LivePilot screenshot pipeline /metrics API response", {
    user_id: user.id,
    live_session_id: sessionId,
    field_count: response.fields.length,
    field_keys: response.fields.map((item: any) => item.metric_key),
    response
  });
  return ok(response);
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
    await replaceMetric(env, user.id, sessionId, { key, label: def.label, category: def.category, raw_value: String(body[key]), normalized_value: normalizeMetricValue(body[key]), unit: def.unit, source_type: "manual_input", confidence: "manual", is_confirmed: 1 });
  }
  if (Array.isArray(body.additional_metrics)) {
    for (const item of body.additional_metrics.slice(0, 80) as any[]) {
      const canonicalKey = canonicalMetricKey(item.metric_key || item.key || item.label);
      if (!canonicalKey && !item.metric_key) continue;
      await replaceMetric(env, user.id, sessionId, {
        key: canonicalKey || String(item.metric_key).slice(0, 80),
        label: String(item.label || item.metric_key || "补充指标").slice(0, 80),
        category: groupToCategory(item.group),
        raw_value: String(item.value ?? item.final_value ?? ""),
        normalized_value: normalizeMetricValue(item.value ?? item.final_value),
        unit: String(item.unit || "").slice(0, 20),
        source_type: "screenshot_manual_confirmed",
        confidence: "manual",
        is_confirmed: 1
      });
    }
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
  const body = await readJson<{ items?: any[]; fields?: any[] }>(request);
  const incoming = Array.isArray(body.items) ? body.items : Array.isArray(body.fields) ? body.fields : null;
  if (incoming) {
    for (const item of incoming) {
      if (item.deleted) continue;
      const key = canonicalMetricKey(item.metric_key || item.key || item.label);
      const raw = item.final_value ?? item.raw_value ?? item.value ?? item.normalized_value ?? "";
      if (!key || raw === "") continue;
      await replaceMetric(env, user.id, sessionId, {
        key,
        label: item.label,
        category: groupToCategory(item.group) || item.category,
        raw_value: String(raw),
        normalized_value: normalizeMetricValue(raw),
        unit: item.unit,
        source_upload_id: item.source_screenshot_id || item.source_upload_id || null,
        source_text: item.raw_text || item.source_text || "",
        comparison: item.comparison || {},
        is_confirmed: 1,
        source_type: item.source_type || "screenshot_manual_confirmed",
        confidence: item.confidence || "manual"
      });
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
  let reportJson: any;
  try {
    reportJson = await generateDiagnosticReport(env, user.id, session, metricsRows.map(serializeMetric), previousRows, rules);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const message = modelErrorMessage(error);
    console.error("Report generation failed", safeErrorLog(error, { user_id: user.id, live_session_id: sessionId }));
    throw new HttpError(400, `复盘报告生成失败：${message}`);
  }
  const runtime = await modelRuntimeConfig(env);
  const quality = checkReportQuality(reportJson);
  let result: any;
  try {
    result = await env.DB.prepare(
      "INSERT INTO review_reports (user_id, live_session_id, streamer_id, platform_account_id, summary, report_json, quality_status, quality_warnings, model_name, rule_snapshot) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) RETURNING *"
    ).bind(user.id, sessionId, session.streamer_id, session.platform_account_id || null, reportJson.one_sentence, JSON.stringify(reportJson), quality.ok ? "passed" : "needs_review", JSON.stringify(quality.warnings), runtime.textModel || modelName(env, "text"), JSON.stringify(rules)).first<any>();
    await saveReportChildren(env, user.id, result.id, reportJson, session.streamer_id);
    await env.DB.prepare("UPDATE live_sessions SET status='reported', main_problem=?1, updated_at=CURRENT_TIMESTAMP WHERE id=?2 AND user_id=?3").bind(reportJson.top_issue?.title || "", sessionId, user.id).run();
  } catch (error) {
    console.error("Report save failed", safeErrorLog(error, { user_id: user.id, live_session_id: sessionId }));
    throw new HttpError(500, "复盘报告保存失败，请稍后重试。");
  }
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
  if (body.streamer_id) await ownedStreamer(env, user.id, Number(body.streamer_id));
  if (body.platform_account_id) await ownedPlatformAccount(env, user.id, Number(body.platform_account_id));
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
  const streamerCount = await count("streamers");
  const platformAccountCount = await count("platform_accounts");
  const preparePlanCount = await count("preparation_plans");
  const sessionCount = await count("live_sessions");
  const reportCount = await count("review_reports");
  const modelStatus = await dashboardModelStatus(env);
  return ok({
    streamer_count: streamerCount,
    platform_account_count: platformAccountCount,
    prepare_plan_count: preparePlanCount,
    session_count: sessionCount,
    report_count: reportCount,
    rule_reminder: "",
    model_status: modelStatus,
    stats: {
      streamer_count: streamerCount,
      platform_account_count: platformAccountCount,
      preparation_plan_count: preparePlanCount,
      live_session_count: sessionCount,
      report_count: reportCount
    },
    recent_plan: recentPlan || null,
    recent_session: recentSession || null,
    recent_report: recentReport || null,
    onboarding: {
      has_streamer: streamerCount > 0,
      has_platform_account: platformAccountCount > 0,
      has_plan: preparePlanCount > 0,
      has_report: reportCount > 0
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
  await maybePromoteInitialAdmin(env, user);
  return user;
}

async function requireAdmin(request: Request, env: Env): Promise<UserRow> {
  const user = await requireUser(request, env);
  if (user.role !== "admin") throw new HttpError(403, "你没有系统管理权限。");
  return user;
}

async function maybePromoteInitialAdmin(env: Env, user: UserRow): Promise<void> {
  const target = normalizeUsername(env.INITIAL_ADMIN_USERNAME || env.INITIAL_ADMIN_EMAIL || "");
  if (!target || user.role === "admin") return;
  if (normalizeUsername(user.username) === target) {
    await env.DB.prepare("UPDATE users SET role='admin', updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND role!='admin'").bind(user.id).run();
    user.role = "admin";
  }
}

async function adminCount(env: Env): Promise<number> {
  return (await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND status='active' AND deleted_at IS NULL").first<{ n: number }>())?.n || 0;
}

function maskAdminUser(row: any): Record<string, unknown> {
  return {
    ...row,
    phone_normalized: undefined,
    phone_masked: row.phone_normalized ? maskPhone(row.phone_normalized) : "",
    role: row.role || "user",
    status: row.status || "active"
  };
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
  const key = canonicalMetricKey(metric.key || metric.metric_key || metric.label);
  if (!key) return;
  const def = metricDefinitions()[key] || { label: metric.label || key, category: metric.category || "custom", unit: metric.unit || "" };
  const rawValue = metric.raw_value ?? metric.rawValue ?? metric.value ?? "";
  const normalized = metric.normalized_value ?? normalizeMetricValue(rawValue);
  await env.DB.prepare(
    "INSERT INTO review_metrics (user_id, live_session_id, category, key, label, raw_value, normalized_value, unit, source_type, source_upload_id, source_text, confidence, comparison_json, is_confirmed) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)"
  ).bind(userId, sessionId, metric.category || def.category, key, metric.label || def.label, rawValue === "" ? null : String(rawValue), normalized, metric.unit || def.unit, metric.source_type || "manual_input", metric.source_upload_id || null, metric.source_text || "", metric.confidence || "manual", JSON.stringify(metric.comparison || {}), metric.is_confirmed ? 1 : 0).run();
}

async function replaceMetric(env: Env, userId: number, sessionId: number, metric: any): Promise<void> {
  const key = canonicalMetricKey(metric.key || metric.metric_key || metric.label);
  if (!key) return;
  await env.DB.prepare("DELETE FROM review_metrics WHERE user_id=?1 AND live_session_id=?2 AND key=?3").bind(userId, sessionId, key).run();
  await upsertMetric(env, userId, sessionId, { ...metric, key });
}

async function recognizeOneScreenshot(env: Env, user: UserRow, session: any, screenshot: any): Promise<void> {
  await env.DB.prepare("UPDATE live_session_screenshots SET recognition_status='processing', updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(screenshot.id, user.id).run();
  const object = await env.UPLOADS.get(screenshot.r2_object_key);
  if (!object) throw new Error("截图文件不存在");
  const bytes = new Uint8Array(await object.arrayBuffer());
  const recognition = await recognizeScreenshotWithModel(env, bytes, screenshot.content_type, user.id);
  const normalized = normalizeRecognition(recognition);
  if (!normalized.metrics.length) throw new Error("这张截图暂时没有识别到有效指标，请手动补充数据。");
  await applyRecognizedLiveInfo(env, user.id, session.id, normalized.live_info);
  await env.DB.prepare(
    "INSERT INTO recognition_results (user_id, live_session_id, upload_id, document_type, raw_json, normalized_json, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'needs_confirmation')"
  ).bind(user.id, session.id, screenshot.id, normalized.document_type, JSON.stringify(recognition), JSON.stringify(normalized)).run();
  for (const metric of normalized.metrics.slice(0, 80)) {
    await upsertMetric(env, user.id, session.id, { ...metric, source_type: "screenshot_ai", source_upload_id: screenshot.id, is_confirmed: 0 });
  }
  await env.DB.prepare("UPDATE live_session_screenshots SET recognition_status='needs_confirmation', updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2").bind(screenshot.id, user.id).run();
}

async function recognizeScreenshotWithModel(env: Env, bytes: Uint8Array, contentType: string, userId?: number): Promise<any> {
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) return mockRecognition();
  const config = await modelCallConfig(env, "vision");
  if (!config) throw new HttpError(400, "未配置视觉模型，暂时无法识别截图；文本功能可正常使用。");
  if (isKnownTextOnlyModel(config.model)) throw new HttpError(400, "当前模型不支持图片输入，请选择视觉模型。");
  const dataUrl = `data:${contentType};base64,${base64(bytes)}`;
  const fixed = await callOpenAIJson(env, config.model, [
    { role: "system", content: "你是抖音直播后台固定模板数据抽取器。只返回JSON，不要解释，不要总结，不要推断。" },
    { role: "user", content: [
      { type: "text", text: douyinDashboardPrompt() },
      { type: "image_url", image_url: { url: dataUrl } }
    ] }
  ], config, 1800, { userId, operation: "screenshot_recognition", purpose: "vision" });
  if (isDouyinDashboardResult(fixed)) return fixed;
  console.log("LivePilot screenshot pipeline fallback to generic vision recognition", {
    user_id: userId,
    platform: fixed?.platform || null,
    screenshot_type: fixed?.screenshot_type || null,
    keys: Object.keys(fixed || {})
  });
  return await callOpenAIJson(env, config.model, [
    { role: "system", content: "你是直播后台截图识别助手。只提取截图中明确出现的数据，返回严格JSON，不分析、不补全、不猜测。" },
    { role: "user", content: [
      { type: "text", text: visionPrompt() },
      { type: "image_url", image_url: { url: dataUrl } }
    ] }
  ], config, 2500, { userId, operation: "screenshot_recognition", purpose: "vision" });
}

async function recognizePlatformProfileWithModel(env: Env, bytes: Uint8Array, contentType: string, userId?: number): Promise<any> {
  const config = await modelCallConfig(env, "vision");
  if (!config) throw new HttpError(400, "截图自动读取暂不可用。你仍可以手动填写账号昵称和抖音号。");
  if (isKnownTextOnlyModel(config.model)) throw new HttpError(400, "当前图片读取能力暂不可用，请联系管理员选择支持图片的模型。");
  const dataUrl = `data:${contentType};base64,${base64(bytes)}`;
  const result = await callOpenAIJson(env, config.model, [
    { role: "system", content: "你是抖音主页截图信息抽取助手。只返回JSON，不要解释，不要总结，不要猜测。" },
    { role: "user", content: [
      { type: "text", text: platformProfilePrompt() },
      { type: "image_url", image_url: { url: dataUrl } }
    ] }
  ], config, 900, { userId, operation: "platform_profile_recognition", purpose: "vision" });
  return normalizePlatformProfileRecognition(result);
}

async function generatePreparePlanContent(env: Env, userId: number, streamer: any, input: any): Promise<any> {
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) return deterministicPreparePlan(streamer, input);
  const config = await modelCallConfig(env, "preparation");
  if (!config) throw new HttpError(400, "文字分析模型暂未配置，请先配置模型后再生成开播方案。");
  const result = await callOpenAIJson(env, config.model, [
    { role: "system", content: "你是LivePilot直播增长导师。只返回短JSON，不要Markdown。每个字段尽量简短、具体、可执行。" },
    { role: "user", content: JSON.stringify({ task: "generate_preparation_plan", streamer: { name: streamer.name, direction: streamer.direction, improvement_goal: streamer.improvement_goal }, input, schema: preparePlanSchemaHint() }) }
  ], config, 900, { userId, operation: "prepare_plan", purpose: "preparation" });
  return validatePreparePlan(result, streamer, input);
}

async function generateDiagnosticReport(env: Env, userId: number, session: any, metrics: any[], previousSessions: any[], rules: any[]): Promise<any> {
  const context = { session, metrics, previousSessions, rules };
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) return deterministicDiagnostic(context);
  const config = await modelCallConfig(env, "report");
  if (!config) throw new HttpError(400, "文字分析模型暂未配置，请先配置模型后再生成报告。");
  const compactContext = {
    session: { title: session.title, topic: session.session_topic || session.title, goal: session.main_goal, live_date: session.live_date },
    metrics: metrics.slice(0, 40).map((item: any) => ({ key: item.key, label: item.label, raw_value: item.raw_value, normalized_value: item.normalized_value, unit: item.unit })),
    previous_count: previousSessions.length,
    rules: rules.slice(0, 5).map((rule: any) => ({ title: rule.title, category: rule.category, risk_level: rule.risk_level, content: String(rule.content || "").slice(0, 120) }))
  };
  const result = await callOpenAIJson(env, config.model, [
    { role: "system", content: "你是LivePilot AI直播增长导师。只返回短JSON，不要Markdown。必须基于数据指出最大瓶颈，给最多3个下一场动作，每个动作含时间、做法、话术、观察指标。不要空泛建议。" },
    { role: "user", content: JSON.stringify({ task: "generate_live_growth_report", context: compactContext, schema: reportSchemaHint() }) }
  ], config, 1800, { userId, operation: "diagnostic_report", purpose: "report" });
  return validateReportShape(result, context);
}

async function callOpenAIJson(env: Env, model: string, messages: any[], config?: ModelCallConfig | ModelRuntimeConfig, maxTokens = 2200, log?: { userId?: number; operation: string; purpose: ModelPurpose | "admin" }): Promise<any> {
  const runtime = config || await modelCallConfig(env, "text");
  if (!runtime) throw new HttpError(400, "模型尚未配置。");
  if (!runtime.baseUrl || !runtime.apiKey) throw new HttpError(400, "模型尚未配置。");
  assertSafeModelBaseUrl(runtime.baseUrl, env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runtime.timeoutMs);
  const started = Date.now();
  let status = "success";
  let errorMessage = "";
  try {
    const body = { model, messages, response_format: { type: "json_object" }, temperature: 0.2, max_tokens: maxTokens };
    let response = await fetch(`${runtime.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${runtime.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok && response.status === 400) {
      const firstError = await modelUpstreamError(response);
      if (modelErrorText(firstError).toLowerCase().includes("response_format")) {
        response = await fetch(`${runtime.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${runtime.apiKey}` },
          body: JSON.stringify({ ...body, response_format: undefined }),
          signal: controller.signal
        });
      } else {
        throw new UpstreamModelError(firstError);
      }
    }
    if (!response.ok) throw new UpstreamModelError(await modelUpstreamError(response));
    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("模型返回为空");
    if (log?.operation === "screenshot_recognition") {
      console.log("LivePilot screenshot pipeline raw model response", { user_id: log.userId, model, raw: String(text).slice(0, 6000) });
    }
    const parsed = parseModelJson(text);
    if (log?.operation === "screenshot_recognition") {
      console.log("LivePilot screenshot pipeline parsed JSON", { user_id: log.userId, parsed });
    }
    return parsed;
  } catch (error) {
    status = "failed";
    errorMessage = modelErrorMessage(error);
    throw error;
  } finally {
    clearTimeout(timeout);
    if (log) {
      await logAiOperation(env, {
        userId: log.userId,
        operation: log.operation,
        purpose: String(log.purpose),
        provider: runtime.provider,
        modelName: model,
        status,
        latencyMs: Date.now() - started,
        errorMessage
      }).catch((error) => console.error("AI operation log failed", safeErrorLog(error, { operation: log.operation })));
    }
  }
}

function parseModelJson(text: string): any {
  const raw = String(text || "").trim();
  const candidates = [
    raw,
    raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  ];
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next extraction shape.
    }
  }
  throw new HttpError(400, "模型返回格式异常，未能解析为结构化JSON。请检查模型是否支持JSON输出。");
}

async function modelRuntimeConfig(env: Env): Promise<ModelRuntimeConfig> {
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) return { provider: "mock", baseUrl: "", apiKey: "", textModel: "mock-text", visionModel: "mock-vision", timeoutMs: 30000, source: "mock" };
  const text = await modelCallConfig(env, "text");
  const vision = await modelCallConfig(env, "vision");
  if (text || vision) {
    const primary = text || vision!;
    return {
      provider: primary.provider,
      baseUrl: primary.baseUrl,
      apiKey: primary.apiKey,
      textModel: text?.model || "",
      visionModel: vision?.model || "",
      timeoutMs: primary.timeoutMs,
      source: "admin"
    };
  }
  return await legacyModelRuntimeConfig(env);
}

async function legacyModelRuntimeConfig(env: Env): Promise<ModelRuntimeConfig> {
  const stored = await activeStoredModelConfig(env);
  if (stored) {
    return {
      provider: stored.provider_name || "openai-compatible",
      baseUrl: normalizeModelBaseUrl(stored.base_url || "", env),
      apiKey: (await decryptModelKey(env, stored.api_key_ciphertext, stored.api_key_iv)).trim(),
      textModel: normalizeModelName(stored.text_model_name),
      visionModel: isVisionModelName(stored.vision_model_name) ? normalizeModelName(stored.vision_model_name) : "",
      timeoutMs: Number(stored.timeout_ms || 30000),
      source: "admin"
    };
  }
  if (env.MODEL_API_KEY || env.MODEL_BASE_URL || env.MODEL_TEXT_NAME || env.MODEL_VISION_NAME) {
    return {
      provider: env.MODEL_PROVIDER || "openai-compatible",
      baseUrl: normalizeModelBaseUrl(env.MODEL_BASE_URL || "", env),
      apiKey: (env.MODEL_API_KEY || "").trim(),
      textModel: normalizeModelName(env.MODEL_TEXT_NAME),
      visionModel: isVisionModelName(env.MODEL_VISION_NAME || "") ? normalizeModelName(env.MODEL_VISION_NAME) : "",
      timeoutMs: Number(env.MODEL_TIMEOUT_MS || 30000),
      source: "secret"
    };
  }
  return { provider: "", baseUrl: "", apiKey: "", textModel: "", visionModel: "", timeoutMs: 30000, source: "none" };
}

async function modelCallConfig(env: Env, purpose: ModelPurpose): Promise<ModelCallConfig | null> {
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) return { provider: "mock", baseUrl: "", apiKey: "", model: `mock-${purpose}`, timeoutMs: 30000, source: "mock" };
  const assignments = await getRawModelAssignments(env);
  const configured = assignments ? await assignedModelConfig(env, assignments, purpose) : null;
  if (configured) return configured;
  const legacy = await legacyModelRuntimeConfig(env);
  if (!legacy.apiKey || !legacy.baseUrl) return null;
  const model = purpose === "vision" ? legacy.visionModel : legacy.textModel;
  if (!model) return null;
  return { provider: legacy.provider, baseUrl: legacy.baseUrl, apiKey: legacy.apiKey, model, timeoutMs: legacy.timeoutMs, source: legacy.source === "secret" ? "secret" : "admin" };
}

async function assignedModelConfig(env: Env, assignments: any, purpose: ModelPurpose): Promise<ModelCallConfig | null> {
  const textProviderId = Number(assignments.default_text_provider_id || 0);
  const visionProviderId = Number(assignments.default_vision_provider_id || 0);
  const providerId = purpose === "vision"
    ? visionProviderId
    : Number(purpose === "report" ? assignments.report_provider_id : purpose === "preparation" ? assignments.preparation_provider_id : 0) || textProviderId;
  const model = normalizeModelName(
    purpose === "vision"
      ? assignments.default_vision_model_name
      : (purpose === "report" ? assignments.report_model_name : purpose === "preparation" ? assignments.preparation_model_name : "") || assignments.default_text_model_name
  );
  if (!providerId || !model) return null;
  const provider = await getModelProvider(env, providerId);
  if (!provider?.enabled) return null;
  const apiKey = (await decryptModelKey(env, provider.api_key_ciphertext, provider.api_key_iv)).trim();
  if (!apiKey) return null;
  return { provider: provider.name, baseUrl: normalizeModelBaseUrl(provider.base_url, env), apiKey, model, timeoutMs: Number(assignments.timeout_ms || provider.timeout_ms || 30000), source: "admin" };
}

async function activeStoredModelConfig(env: Env): Promise<any | null> {
  return await env.DB.prepare("SELECT * FROM system_model_configs WHERE enabled=1 ORDER BY updated_at DESC, id DESC LIMIT 1").first<any>();
}

async function getRawModelAssignments(env: Env): Promise<any | null> {
  return await env.DB.prepare("SELECT * FROM model_assignments WHERE id=1").first<any>().catch(() => null);
}

async function getModelProvider(env: Env, id: number): Promise<any | null> {
  return await env.DB.prepare("SELECT * FROM model_providers WHERE id=?1").bind(id).first<any>().catch(() => null);
}

async function listModelProviders(env: Env): Promise<any[]> {
  const rows = await env.DB.prepare("SELECT * FROM model_providers ORDER BY enabled DESC, updated_at DESC, id DESC").all();
  const providers = rows.results || [];
  const out: any[] = [];
  for (const provider of providers) {
    const models = await env.DB.prepare("SELECT model_id, capability, updated_at FROM provider_models WHERE provider_id=?1 ORDER BY capability, model_id").bind((provider as any).id).all();
    out.push({ ...maskModelProvider(provider), models: models.results || [] });
  }
  return out;
}

async function getModelAssignments(env: Env): Promise<Record<string, unknown>> {
  const row = await getRawModelAssignments(env);
  return {
    default_text_provider_id: row?.default_text_provider_id || null,
    default_text_model_name: row?.default_text_model_name || "",
    default_vision_provider_id: row?.default_vision_provider_id || null,
    default_vision_model_name: row?.default_vision_model_name || "",
    report_provider_id: row?.report_provider_id || null,
    report_model_name: row?.report_model_name || "",
    preparation_provider_id: row?.preparation_provider_id || null,
    preparation_model_name: row?.preparation_model_name || "",
    updated_at: row?.updated_at || ""
  };
}

async function getAdminModels(env: Env): Promise<Response> {
  return ok({
    providers: await listModelProviders(env),
    assignments: await getModelAssignments(env),
    items: (await listModelConfigs(env)).map(maskModelConfig),
    active: maskModelConfig(await activeStoredModelConfig(env))
  });
}

async function listModelConfigs(env: Env): Promise<any[]> {
  const rows = await env.DB.prepare("SELECT * FROM system_model_configs ORDER BY enabled DESC, updated_at DESC, id DESC LIMIT 20").all();
  return rows.results || [];
}

function maskModelProvider(row: any | null): Record<string, unknown> | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    base_url: row.base_url,
    api_key_masked: row.api_key_last_four ? `****${row.api_key_last_four}` : "",
    api_key_last_four: row.api_key_last_four || "",
    enabled: Boolean(row.enabled),
    last_test_status: row.last_test_status,
    last_test_message: row.last_test_message,
    last_tested_at: row.last_tested_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    updated_by: row.updated_by
  };
}

function maskModelConfig(row: any | null): Record<string, unknown> | null {
  if (!row) return null;
  return {
    id: row.id,
    provider_name: row.provider_name,
    base_url: row.base_url,
    api_key_masked: row.api_key_last_four ? `****${row.api_key_last_four}` : "",
    api_key_last_four: row.api_key_last_four || "",
    text_model_name: row.text_model_name || "",
    vision_model_name: row.vision_model_name || "",
    timeout_ms: row.timeout_ms || 30000,
    enabled: Boolean(row.enabled),
    last_test_status: row.last_test_status,
    last_test_message: row.last_test_message,
    last_tested_at: row.last_tested_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    updated_by: row.updated_by
  };
}

async function createModelProvider(request: Request, env: Env, admin: UserRow): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const row = await saveModelProvider(env, admin, body, null);
  await audit(env, admin, "admin.model_provider.create", "model_provider", String((row as any).id), "success", { name: (row as any).name }, request);
  return ok({ item: maskModelProvider(row) });
}

async function updateModelProvider(request: Request, env: Env, admin: UserRow, id: number): Promise<Response> {
  const existing = await getModelProvider(env, id);
  if (!existing) throw new HttpError(404, "模型源不存在。");
  const row = await saveModelProvider(env, admin, await readJson<Record<string, unknown>>(request), existing);
  await audit(env, admin, "admin.model_provider.update", "model_provider", String(id), "success", { name: (row as any).name }, request);
  return ok({ item: maskModelProvider(row) });
}

async function saveModelProvider(env: Env, admin: UserRow, body: Record<string, unknown>, existing: any | null): Promise<any> {
  const name = String(body.name || existing?.name || "OpenAI Compatible").trim().slice(0, 80);
  if (!name) throw new HttpError(400, "请填写模型源名称。");
  const baseUrl = normalizeModelBaseUrl(String(body.base_url || existing?.base_url || ""), env);
  const rawKey = String(body.api_key || "").trim();
  let cipher = existing?.api_key_ciphertext || "";
  let iv = existing?.api_key_iv || "";
  let lastFour = existing?.api_key_last_four || "";
  if (rawKey) {
    const encrypted = await encryptModelKey(env, rawKey);
    cipher = encrypted.ciphertext;
    iv = encrypted.iv;
    lastFour = rawKey.slice(-4);
  }
  if (!cipher) throw new HttpError(400, "请填写 API Key。");
  const enabled = body.enabled === undefined ? Number(existing?.enabled ?? 1) : (body.enabled === false ? 0 : 1);
  if (existing) {
    return await env.DB.prepare("UPDATE model_providers SET name=?1, base_url=?2, api_key_ciphertext=?3, api_key_iv=?4, api_key_last_four=?5, enabled=?6, updated_by=?7, updated_at=CURRENT_TIMESTAMP WHERE id=?8 RETURNING *")
      .bind(name, baseUrl, cipher, iv, lastFour, enabled, admin.id, existing.id).first();
  }
  return await env.DB.prepare("INSERT INTO model_providers (name, base_url, api_key_ciphertext, api_key_iv, api_key_last_four, enabled, updated_by) VALUES (?1,?2,?3,?4,?5,?6,?7) RETURNING *")
    .bind(name, baseUrl, cipher, iv, lastFour, enabled, admin.id).first();
}

async function deleteModelProvider(request: Request, env: Env, admin: UserRow, id: number): Promise<Response> {
  const existing = await getModelProvider(env, id);
  if (!existing) throw new HttpError(404, "模型源不存在。");
  await env.DB.prepare("UPDATE model_providers SET enabled=0, updated_by=?1, updated_at=CURRENT_TIMESTAMP WHERE id=?2").bind(admin.id, id).run();
  await env.DB.prepare("UPDATE model_assignments SET default_text_provider_id=NULLIF(default_text_provider_id, ?1), default_vision_provider_id=NULLIF(default_vision_provider_id, ?1), report_provider_id=NULLIF(report_provider_id, ?1), preparation_provider_id=NULLIF(preparation_provider_id, ?1), updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(id).run();
  await audit(env, admin, "admin.model_provider.disable", "model_provider", String(id), "success", {}, request);
  return ok({ ok: true, message: "模型源已停用。" });
}

async function testModelProvider(request: Request, env: Env, admin: UserRow, id: number): Promise<Response> {
  const provider = await providerWithKey(env, id);
  const started = Date.now();
  try {
    const models = env.MODEL_PROVIDER === "mock" && isDev(env) ? mockProviderModels() : await fetchProviderModels(provider, env);
    const elapsed = Date.now() - started;
    await env.DB.prepare("UPDATE model_providers SET last_test_status='success', last_test_message=?1, last_tested_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?2")
      .bind(`模型源连接成功，读取到 ${models.length} 个模型，用时 ${elapsed}ms。`, id).run();
    await audit(env, admin, "admin.model_provider.test", "model_provider", String(id), "success", { elapsed_ms: elapsed, model_count: models.length }, request);
    return ok({ ok: true, status: "success", elapsed_ms: elapsed, models, message: `模型源连接成功，读取到 ${models.length} 个模型。` });
  } catch (error) {
    const message = providerErrorMessage(error);
    await env.DB.prepare("UPDATE model_providers SET last_test_status='failed', last_test_message=?1, last_tested_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?2").bind(message, id).run();
    await audit(env, admin, "admin.model_provider.test", "model_provider", String(id), "failed", { message }, request);
    throw new HttpError(400, message);
  }
}

async function syncProviderModels(request: Request, env: Env, admin: UserRow, id: number): Promise<Response> {
  const provider = await providerWithKey(env, id);
  const models = env.MODEL_PROVIDER === "mock" && isDev(env) ? mockProviderModels() : await fetchProviderModels(provider, env);
  for (const model of models.slice(0, 500)) {
    await env.DB.prepare("INSERT INTO provider_models (provider_id, model_id, capability, updated_at) VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP) ON CONFLICT(provider_id, model_id) DO UPDATE SET capability=excluded.capability, updated_at=CURRENT_TIMESTAMP")
      .bind(id, model.id, model.capability).run();
  }
  await env.DB.prepare("UPDATE model_providers SET last_test_status='success', last_test_message=?1, last_tested_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?2")
    .bind(`已拉取 ${models.length} 个模型。`, id).run();
  await audit(env, admin, "admin.model_provider.sync_models", "model_provider", String(id), "success", { model_count: models.length }, request);
  return ok({ ok: true, items: models, message: `已拉取 ${models.length} 个模型。` });
}

async function saveModelAssignments(request: Request, env: Env, admin: UserRow): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const textProviderId = nullableProviderId(body.default_text_provider_id);
  const visionProviderId = nullableProviderId(body.default_vision_provider_id);
  const reportProviderId = nullableProviderId(body.report_provider_id);
  const preparationProviderId = nullableProviderId(body.preparation_provider_id);
  if (textProviderId) await ensureProviderEnabled(env, textProviderId);
  if (visionProviderId) await ensureProviderEnabled(env, visionProviderId);
  if (reportProviderId) await ensureProviderEnabled(env, reportProviderId);
  if (preparationProviderId) await ensureProviderEnabled(env, preparationProviderId);
  const textModel = normalizeModelName(body.default_text_model_name || "");
  const visionModel = normalizeModelName(body.default_vision_model_name || "");
  if (visionModel && isKnownTextOnlyModel(visionModel)) throw new HttpError(400, "当前模型不支持图片输入，请选择视觉模型。");
  await env.DB.prepare(`
    INSERT INTO model_assignments (id, default_text_provider_id, default_text_model_name, default_vision_provider_id, default_vision_model_name, report_provider_id, report_model_name, preparation_provider_id, preparation_model_name, updated_by)
    VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(id) DO UPDATE SET
      default_text_provider_id=excluded.default_text_provider_id,
      default_text_model_name=excluded.default_text_model_name,
      default_vision_provider_id=excluded.default_vision_provider_id,
      default_vision_model_name=excluded.default_vision_model_name,
      report_provider_id=excluded.report_provider_id,
      report_model_name=excluded.report_model_name,
      preparation_provider_id=excluded.preparation_provider_id,
      preparation_model_name=excluded.preparation_model_name,
      updated_by=excluded.updated_by,
      updated_at=CURRENT_TIMESTAMP
  `).bind(
    textProviderId,
    textModel,
    visionProviderId,
    visionModel,
    reportProviderId,
    normalizeModelName(body.report_model_name || ""),
    preparationProviderId,
    normalizeModelName(body.preparation_model_name || ""),
    admin.id
  ).run();
  await audit(env, admin, "admin.model_assignment.save", "model_assignment", "1", "success", { text_provider_id: textProviderId, vision_provider_id: visionProviderId }, request);
  return ok(await getModelAssignments(env));
}

async function testAssignedModel(request: Request, env: Env, admin: UserRow, kind: "text" | "vision"): Promise<Response> {
  const started = Date.now();
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) {
    await audit(env, admin, `admin.model_assignment.test_${kind}`, "model_assignment", "1", "success", { local_mock: true }, request);
    return ok({ ok: true, status: "success", model_name: `mock-${kind}`, elapsed_ms: Date.now() - started, message: kind === "vision" ? "视觉模型测试成功。" : "文本模型测试成功。" });
  }
  const config = await modelCallConfig(env, kind);
  if (!config) throw new HttpError(400, kind === "vision" ? "未配置视觉模型，暂时无法识别截图；文本功能可正常使用。" : "文字分析模型暂未配置。");
  try {
    if (kind === "vision") {
      if (isKnownTextOnlyModel(config.model)) throw new HttpError(400, "当前模型不支持图片输入，请选择视觉模型。");
      await callVisionTest(env, config);
    } else {
      await callOpenAIJson(env, config.model, [
        { role: "system", content: "只返回JSON。" },
        { role: "user", content: "请返回 {\"ok\": true, \"message\": \"文本模型测试成功\"}" }
      ], config, 2200, { userId: admin.id, operation: "admin_model_test", purpose: "admin" });
    }
    await audit(env, admin, `admin.model_assignment.test_${kind}`, "model_assignment", "1", "success", { model: config.model, elapsed_ms: Date.now() - started }, request);
    return ok({ ok: true, status: "success", model_name: config.model, elapsed_ms: Date.now() - started, message: kind === "vision" ? "视觉模型测试成功。" : "文本模型测试成功。" });
  } catch (error) {
    const message = modelErrorMessage(error);
    await audit(env, admin, `admin.model_assignment.test_${kind}`, "model_assignment", "1", "failed", { model: config.model, message }, request);
    throw new HttpError(400, message);
  }
}

async function saveAdminModelConfig(request: Request, env: Env, admin: UserRow): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const baseUrl = normalizeModelBaseUrl(String(body.base_url || "").trim(), env);
  const existing = Number(body.id || 0) ? await env.DB.prepare("SELECT * FROM system_model_configs WHERE id=?1").bind(Number(body.id)).first<any>() : null;
  const rawKey = String(body.api_key || "").trim();
  let cipher = existing?.api_key_ciphertext || "";
  let iv = existing?.api_key_iv || "";
  let lastFour = existing?.api_key_last_four || "";
  if (rawKey) {
    const encrypted = await encryptModelKey(env, rawKey);
    cipher = encrypted.ciphertext;
    iv = encrypted.iv;
    lastFour = rawKey.slice(-4);
  }
  if (!cipher) throw new HttpError(400, "请填写模型 API Key。");
  if (body.enabled === true) await env.DB.prepare("UPDATE system_model_configs SET enabled=0 WHERE enabled=1").run();
  const values = [
    String(body.provider_name || existing?.provider_name || "openai-compatible").trim(),
    baseUrl,
    cipher,
    iv,
    lastFour,
    normalizeModelName(body.text_model_name || existing?.text_model_name || ""),
    normalizeModelName(body.vision_model_name || existing?.vision_model_name || ""),
    Number(body.timeout_ms || existing?.timeout_ms || 30000),
    body.enabled === true ? 1 : existing?.enabled || 0,
    admin.id
  ];
  const row = existing
    ? await env.DB.prepare("UPDATE system_model_configs SET provider_name=?1, base_url=?2, api_key_ciphertext=?3, api_key_iv=?4, api_key_last_four=?5, text_model_name=?6, vision_model_name=?7, timeout_ms=?8, enabled=?9, updated_by=?10, updated_at=CURRENT_TIMESTAMP WHERE id=?11 RETURNING *").bind(...values, existing.id).first()
    : await env.DB.prepare("INSERT INTO system_model_configs (provider_name, base_url, api_key_ciphertext, api_key_iv, api_key_last_four, text_model_name, vision_model_name, timeout_ms, enabled, updated_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) RETURNING *").bind(...values).first();
  await audit(env, admin, "admin.model.save", "system_model_config", String((row as any).id), "success", { enabled: Boolean((row as any).enabled), provider_name: (row as any).provider_name }, request);
  const provider = await saveModelProvider(env, admin, { name: values[0], base_url: values[1], api_key: rawKey || undefined, enabled: true }, null).catch(() => null);
  if (provider && values[5]) {
    await env.DB.prepare("UPDATE model_assignments SET default_text_provider_id=?1, default_text_model_name=?2, default_vision_provider_id=NULL, default_vision_model_name='', updated_by=?3, updated_at=CURRENT_TIMESTAMP WHERE id=1")
      .bind((provider as any).id, values[5], admin.id).run();
  }
  return ok(maskModelConfig(row));
}

async function testAdminModel(request: Request, env: Env, admin: UserRow, kind: "text" | "vision"): Promise<Response> {
  const assignments = await getRawModelAssignments(env);
  if (assignments) return await testAssignedModel(request, env, admin, kind);
  const started = Date.now();
  if (env.MODEL_PROVIDER === "mock" && isDev(env)) {
    await audit(env, admin, `admin.model.test_${kind}`, "system_model_config", "mock", "success", { local_mock: true }, request);
    return ok({ ok: true, status: "success", model_name: `mock-${kind}`, elapsed_ms: Date.now() - started, message: "本地Mock模型测试成功。" });
  }
  const config = await modelRuntimeConfig(env);
  if (!config.apiKey || !config.baseUrl) throw new HttpError(400, "模型尚未配置。");
  try {
    if (kind === "text") {
      if (!config.textModel) throw new HttpError(400, "文本模型名称未配置。");
      await callOpenAIJson(env, config.textModel, [
        { role: "system", content: "只返回JSON。" },
        { role: "user", content: "请返回 {\"ok\": true, \"message\": \"OK\"}" }
      ], config);
    } else {
      if (!config.visionModel) throw new HttpError(400, "图片识别模型名称未配置。");
      if (isKnownTextOnlyModel(config.visionModel)) throw new HttpError(400, "当前图片模型不是多模态/视觉模型。请填写支持图片输入的模型名；文本模型 glm-5.1 可以继续用于开播方案和复盘报告。");
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      await recognizeScreenshotWithModel(env, png, "image/png", admin.id);
    }
    const ms = Date.now() - started;
    await env.DB.prepare("UPDATE system_model_configs SET last_test_status='success', last_test_message=?1, last_tested_at=CURRENT_TIMESTAMP WHERE enabled=1").bind(`${kind === "text" ? "文本" : "图片"}模型连接成功，用时 ${ms}ms。`).run();
    await audit(env, admin, `admin.model.test_${kind}`, "system_model_config", "active", "success", { elapsed_ms: ms }, request);
    return ok({ ok: true, status: "success", model_name: kind === "text" ? config.textModel : config.visionModel, elapsed_ms: ms, message: "模型连接成功。" });
  } catch (error) {
    const message = modelErrorMessage(error);
    await env.DB.prepare("UPDATE system_model_configs SET last_test_status='failed', last_test_message=?1, last_tested_at=CURRENT_TIMESTAMP WHERE enabled=1").bind(message).run();
    await audit(env, admin, `admin.model.test_${kind}`, "system_model_config", "active", "failed", { message }, request);
    throw new HttpError(400, message);
  }
}

async function providerWithKey(env: Env, id: number): Promise<any> {
  const provider = await getModelProvider(env, id);
  if (!provider) throw new HttpError(404, "模型源不存在。");
  if (!provider.enabled) throw new HttpError(400, "模型源已停用，请先启用后再测试。");
  const apiKey = (await decryptModelKey(env, provider.api_key_ciphertext, provider.api_key_iv)).trim();
  if (!apiKey) throw new HttpError(400, "模型源 API Key 未配置。");
  return { ...provider, base_url: normalizeModelBaseUrl(provider.base_url, env), api_key: apiKey };
}

async function fetchProviderModels(provider: any, env: Env): Promise<{ id: string; capability: string }[]> {
  assertSafeModelBaseUrl(provider.base_url, env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${String(provider.base_url).replace(/\/$/, "")}/models`, {
      method: "GET",
      headers: { authorization: `Bearer ${provider.api_key}` },
      signal: controller.signal
    });
    if (!response.ok) throw new UpstreamModelError(await modelUpstreamError(response));
    const data = await response.json().catch(() => null) as any;
    const rawItems = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
    if (!Array.isArray(rawItems)) throw new HttpError(400, "模型源返回格式不是 OpenAI Compatible。");
    const models = rawItems
      .map((item: any) => typeof item === "string" ? item : String(item?.id || item?.name || ""))
      .filter(Boolean)
      .map((id: string) => ({ id, capability: inferModelCapability(id) }));
    if (!models.length) throw new HttpError(400, "模型源没有返回可用模型。");
    return models;
  } finally {
    clearTimeout(timeout);
  }
}

async function callVisionTest(env: Env, config: ModelCallConfig): Promise<void> {
  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  await callOpenAIJson(env, config.model, [
    { role: "system", content: "只返回JSON。" },
    { role: "user", content: [
      { type: "text", text: "请观察图片并返回 {\"ok\": true, \"message\": \"视觉模型测试成功\"}" },
      { type: "image_url", image_url: { url: dataUrl } }
    ] }
  ], config, 2200, { operation: "admin_model_test", purpose: "vision" });
}

function nullableProviderId(value: unknown): number | null {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function ensureProviderEnabled(env: Env, id: number): Promise<void> {
  const row = await getModelProvider(env, id);
  if (!row?.enabled) throw new HttpError(400, "选择的模型源不存在或已停用。");
}

function normalizeModelBaseUrl(value: string, env: Env): string {
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) throw new HttpError(400, "请填写 Base URL。");
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpError(400, "Base URL格式不正确。"); }
  if (env.APP_ENV === "production" && url.protocol !== "https:") throw new HttpError(400, "生产环境模型Base URL必须使用HTTPS。");
  if (!url.pathname || url.pathname === "/") url.pathname = "/v1";
  const normalized = url.toString().replace(/\/+$/, "");
  assertSafeModelBaseUrl(normalized, env);
  return normalized;
}

function inferModelCapability(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (/(qwen-vl|vision|omni|gpt-4o|gemini|4v|\bvl\b|[-_]vl)/i.test(lower)) return "vision";
  if (/(glm|deepseek|qwen-plus)/i.test(lower)) return "text";
  return "unknown";
}

function mockProviderModels(): { id: string; capability: string }[] {
  return [
    { id: "glm-5.1", capability: "text" },
    { id: "qwen-vl-plus", capability: "vision" },
    { id: "mock-unknown", capability: "unknown" }
  ];
}

function isVisionModelName(value: unknown): boolean {
  return inferModelCapability(String(value || "")) === "vision";
}

function providerErrorMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  if (error instanceof UpstreamModelError) {
    const status = error.details.status || 0;
    const text = modelErrorText(error.details);
    if ([401, 403].includes(status)) return `API Key无效或没有权限。上游返回：${text || status}`;
    if (status === 404) return "Base URL不是OpenAI Compatible接口，或没有 /models 能力。";
    if (status === 429) return "模型源请求过于频繁，请稍后再试。";
    return `模型源连接失败。上游返回：${text || status}`;
  }
  const message = error instanceof Error ? error.message : String(error || "");
  if (/abort|timeout|timed/i.test(message)) return "模型源请求超时，请检查Base URL或稍后重试。";
  if (/fetch|network|failed/i.test(message)) return "Base URL无法连接，请检查地址是否正确。";
  return "模型源连接失败，请检查Base URL和API Key。";
}

async function modelAvailability(env: Env, kind: "text" | "vision"): Promise<string> {
  const config = await modelRuntimeConfig(env);
  if (!config.apiKey || !config.baseUrl) return "未配置";
  if (kind === "text" && !config.textModel) return "未配置";
  if (kind === "vision" && !config.visionModel) return "未配置";
  if (kind === "vision" && isKnownTextOnlyModel(config.visionModel)) return "不是视觉模型";
  return "已配置";
}

async function dashboardModelStatus(env: Env): Promise<Record<string, unknown>> {
  const config = await modelRuntimeConfig(env);
  const textConfigured = Boolean(config.apiKey && config.baseUrl && config.textModel);
  const imageConfigured = Boolean(config.apiKey && config.baseUrl && config.visionModel && !isKnownTextOnlyModel(config.visionModel));
  const imageText = !config.apiKey || !config.baseUrl
    ? "模型服务未配置。"
    : !config.visionModel
      ? "当前图片识别模型未配置，不影响手动录入复盘。"
      : isKnownTextOnlyModel(config.visionModel)
        ? `当前图片模型 ${config.visionModel} 是文本模型，不支持截图识别；请填写支持图片输入的视觉模型。手动录入复盘不受影响。`
        : "图片识别模型已配置。";
  return {
    text_model_configured: textConfigured,
    image_model_configured: imageConfigured,
    text_model_name: config.textModel,
    image_model_name: config.visionModel,
    image_model_message: imageText
  };
}

async function encryptModelKey(env: Env, value: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await modelCryptoKey(env);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return { ciphertext: base64(new Uint8Array(encrypted)), iv: base64(iv) };
}

async function decryptModelKey(env: Env, ciphertext: string, iv: string): Promise<string> {
  if (!ciphertext || !iv) return "";
  const key = await modelCryptoKey(env);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}

async function modelCryptoKey(env: Env): Promise<CryptoKey> {
  const secret = env.MODEL_ENCRYPTION_KEY || (isDev(env) ? jwtSecret(env) : "");
  if (!secret || secret.length < 16) throw new HttpError(500, "模型密钥加密配置缺失，请配置 MODEL_ENCRYPTION_KEY。");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function assertSafeModelBaseUrl(value: string, env: Env): void {
  let url: URL;
  try { url = new URL(value); } catch { throw new HttpError(400, "Base URL格式不正确。"); }
  if (!["https:", "http:"].includes(url.protocol)) throw new HttpError(400, "Base URL只支持HTTP或HTTPS。");
  if (env.APP_ENV === "production" && url.protocol !== "https:") throw new HttpError(400, "生产环境模型Base URL必须使用HTTPS。");
  const host = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host) || host.endsWith(".local")) throw new HttpError(400, "Base URL不能指向本机或内网地址。");
  if (/^(10|127|169\.254|192\.168)\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) throw new HttpError(400, "Base URL不能指向内网地址。");
}

function normalizeModelName(value: unknown): string {
  return String(value || "").trim();
}

function isKnownTextOnlyModel(value: string): boolean {
  return ["glm-5.1", "glm5.1"].includes(normalizeModelName(value).toLowerCase());
}

function modelErrorMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  if (error instanceof UpstreamModelError) {
    const status = error.details.status || 0;
    const text = modelErrorText(error.details);
    if (/multimodal|vision|image|图片|视觉|多模态/i.test(text)) return `当前图片模型不是多模态/视觉模型。上游返回：${text}`;
    if ([401, 403].includes(status)) return `API Key无效或没有权限。上游返回：${text || status}`;
    if (status === 404) return `模型接口或模型名称不存在。上游返回：${text || status}`;
    if (status === 429) return "模型服务请求过于频繁，请稍后再试或检查服务额度。";
    if (status >= 500) return `模型服务暂时异常。上游返回：${text || status}`;
    if (/model/i.test(text)) return `模型名称不存在或当前账号无权使用。上游返回：${text}`;
    if (/key|token|auth|permission|unauthorized|forbidden/i.test(text)) return `API Key无效或没有权限。上游返回：${text}`;
    return `模型连接失败。上游返回：${text || status}`;
  }
  const message = error instanceof Error ? error.message : "模型测试失败。";
  if (/401|403|API Key|authorization/i.test(message)) return "API Key无效或没有权限。";
  if (/404|model/i.test(message)) return "模型名称不存在或当前账号无权使用。";
  if (/abort|timeout|timed/i.test(message)) return "模型请求超时，请检查网络或调大超时时间。";
  if (/JSON|format|返回/.test(message)) return "模型返回格式异常，未能解析为结构化JSON。";
  return "模型连接失败，请检查Base URL、模型名称和服务状态。";
}

class UpstreamModelError extends Error {
  details: UpstreamModelErrorDetails;

  constructor(details: UpstreamModelErrorDetails) {
    super(`Upstream model error ${details.status || ""}: ${modelErrorText(details)}`);
    this.name = "UpstreamModelError";
    this.details = details;
  }
}

async function modelUpstreamError(response: Response): Promise<UpstreamModelErrorDetails> {
  const text = await response.text().catch(() => "");
  const safeBody = text.slice(0, 500);
  try {
    const parsed = JSON.parse(safeBody);
    const err = parsed.error || parsed;
    return {
      status: response.status,
      code: String(err.code || parsed.code || ""),
      message: String(err.message || parsed.message || safeBody || "")
    };
  } catch {
    return { status: response.status, body: safeBody };
  }
}

function modelErrorText(details: UpstreamModelErrorDetails): string {
  return String(details.message || details.code || details.body || "").replace(/\s+/g, " ").slice(0, 180);
}

async function audit(env: Env, admin: UserRow, action: string, targetType: string, targetId: string, result = "success", metadata: Record<string, unknown> = {}, request?: Request): Promise<void> {
  const ipHash = request ? await hmacHex(env, clientIp(request)) : "";
  await env.DB.prepare("INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, result, metadata, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(admin.id, action, targetType, targetId, result, JSON.stringify(sanitizeAudit(metadata)), ipHash).run();
}

async function logAiOperation(env: Env, item: {
  userId?: number;
  operation: string;
  purpose: string;
  provider: string;
  modelName: string;
  status: string;
  latencyMs: number;
  errorMessage?: string;
}): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO ai_operation_logs (user_id, operation, purpose, provider, model_name, status, latency_ms, error_message)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
  `).bind(
    item.userId || null,
    item.operation.slice(0, 80),
    item.purpose.slice(0, 40),
    item.provider.slice(0, 80),
    item.modelName.slice(0, 120),
    item.status === "failed" ? "failed" : "success",
    Math.max(0, Math.round(item.latencyMs || 0)),
    (item.errorMessage || "").slice(0, 240)
  ).run();
}

function sanitizeAudit(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/key|secret|password|token|authorization/i.test(key)) continue;
    out[key] = typeof value === "string" ? value.slice(0, 300) : value;
  }
  return out;
}

async function effectiveRules(env: Env, userId: number): Promise<any[]> {
  const rows = await env.DB.prepare("SELECT id, title, category, platform, risk_level, content, recommended_action, prohibited_action, source_name, effective_date, updated_at FROM rules WHERE status='active' AND (expires_at IS NULL OR expires_at='' OR expires_at > CURRENT_TIMESTAMP) AND (user_id IS NULL OR user_id=?1) ORDER BY user_id IS NOT NULL DESC, id DESC LIMIT 20").bind(userId).all();
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

function metricToField(metric: Record<string, unknown>): Record<string, unknown> {
  const key = String(metric.key || "");
  const def = metricDefinitions()[key];
  return {
    id: metric.id,
    metric_key: key,
    label: metric.label || def?.label || key,
    group: categoryToGroup(String(metric.category || def?.category || "custom")),
    raw_value: metric.raw_value,
    normalized_value: metric.normalized_value,
    final_value: metric.normalized_value ?? metric.raw_value ?? "",
    unit: metric.unit || def?.unit || "",
    source_screenshot_id: metric.source_upload_id,
    source_screenshot_type: sourceTypeLabel(String(metric.source_type || "")),
    raw_text: metric.source_text || "",
    confidence: confidenceScore(String(metric.confidence || "manual")),
    is_manually_confirmed: Boolean(metric.is_confirmed),
    comparison: metric.comparison || {}
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
    total_viewers: { label: "累计观看", category: "traffic", unit: "人" },
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
    member_income: { label: "会员收入", category: "revenue", unit: "元" },
    guardian_income: { label: "星守护收入", category: "revenue", unit: "元" },
    estimated_income: { label: "预计本场收入", category: "revenue", unit: "元" },
    gift_income: { label: "礼物收入", category: "revenue", unit: "元" },
    product_clicks: { label: "商品点击", category: "conversion", unit: "次" },
    orders: { label: "成交订单", category: "conversion", unit: "单" },
    buyers: { label: "成交人数", category: "conversion", unit: "人" },
    conversion_rate: { label: "转化率", category: "conversion", unit: "%" },
    revenue: { label: "成交金额", category: "conversion", unit: "元" }
  };
}

function fixedDouyinDashboardFields(): Array<{ source: string; key: string; label: string; category: string; unit: string }> {
  return [
    { source: "exposure_count", key: "impressions", label: "曝光人数", category: "traffic", unit: "人" },
    { source: "enter_count", key: "room_entries", label: "进房人数", category: "traffic", unit: "人" },
    { source: "enter_rate", key: "entry_rate", label: "进房率", category: "traffic", unit: "%" },
    { source: "viewer_count", key: "total_viewers", label: "累计观看", category: "traffic", unit: "人" },
    { source: "average_online", key: "average_online", label: "平均在线人数", category: "traffic", unit: "人" },
    { source: "peak_online", key: "peak_online", label: "最高在线人数", category: "traffic", unit: "人" },
    { source: "average_watch_seconds", key: "average_watch_seconds", label: "人均停留时长", category: "retention", unit: "秒" },
    { source: "comment_count", key: "comments", label: "评论人数", category: "interaction", unit: "人" },
    { source: "like_count", key: "likes", label: "点赞次数", category: "interaction", unit: "次" },
    { source: "share_count", key: "shares", label: "分享次数", category: "interaction", unit: "次" },
    { source: "new_follow_count", key: "new_followers", label: "新增关注", category: "follow", unit: "人" },
    { source: "fans_group_count", key: "fan_club_joins", label: "加粉丝团人数", category: "follow", unit: "人" },
    { source: "yinlang", key: "yinlang", label: "收获音浪", category: "revenue", unit: "音浪" },
    { source: "gift_user_count", key: "gift_users", label: "送礼人数", category: "revenue", unit: "人" },
    { source: "gift_rate", key: "gift_rate", label: "送礼率", category: "revenue", unit: "%" },
    { source: "member_income", key: "member_income", label: "会员收入", category: "revenue", unit: "元" },
    { source: "guardian_income", key: "guardian_income", label: "星守护收入", category: "revenue", unit: "元" },
    { source: "estimated_income", key: "estimated_income", label: "预计本场收入", category: "revenue", unit: "元" },
    { source: "gift_income", key: "gift_income", label: "礼物收入", category: "revenue", unit: "元" },
    { source: "gmv", key: "revenue", label: "成交金额", category: "conversion", unit: "元" },
    { source: "order_count", key: "orders", label: "成交订单", category: "conversion", unit: "单" },
    { source: "buyer_count", key: "buyers", label: "成交人数", category: "conversion", unit: "人" },
    { source: "conversion_rate", key: "conversion_rate", label: "转化率", category: "conversion", unit: "%" }
  ];
}

function canonicalMetricKey(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase().replace(/\s+/g, "_").replace(/[：:]/g, "");
  if (metricDefinitions()[normalized]) return normalized;
  if (normalized.startsWith("custom_")) return normalized.slice(0, 80);
  const text = raw.toLowerCase();
  const pairs: Array<[RegExp, string]> = [
    [/直播时长|duration/, "duration_minutes"],
    [/开播时间|开始时间|started_at/, "started_at"],
    [/关播时间|结束时间|ended_at/, "ended_at"],
    [/曝光人数|曝光|impression/, "impressions"],
    [/进房人数|进入直播间人数|直播间进入人数|进入人数|进房\b|room_entries|entry_count|enter_count/, "room_entries"],
    [/进房率|进入率|曝光进入率|entry_rate|enter_rate/, "entry_rate"],
    [/累计观看|观看人数|viewer_count|total_viewers/, "total_viewers"],
    [/平均在线人数|平均在线|average_online/, "average_online"],
    [/最高在线人数|最高在线|peak_online/, "peak_online"],
    [/人均停留时长|人均停留|平均观看时长|平均停留|停留时长|average_watch|average_stay/, "average_watch_seconds"],
    [/评论人数|评论数|comments|comment_users|comment_count/, "comments"],
    [/点赞次数|点赞数|likes|like_count/, "likes"],
    [/分享次数|分享数|shares|share_count/, "shares"],
    [/新增粉丝|新增关注|涨粉|new_followers|new_follow_count/, "new_followers"],
    [/加粉丝团人数|粉丝团|fan_club|fans_group_count/, "fan_club_joins"],
    [/送礼人数|gift_users|gift_user_count/, "gift_users"],
    [/送礼率|gift_rate/, "gift_rate"],
    [/收获音浪|音浪|yinlang/, "yinlang"],
    [/礼物收入|gift_income/, "gift_income"],
    [/预计本场收入|预计收入|estimated_income/, "estimated_income"],
    [/会员收入|member_income/, "member_income"],
    [/星守护收入|guardian_income/, "guardian_income"],
    [/商品点击|product_clicks/, "product_clicks"],
    [/成交订单|订单数|order_count|orders/, "orders"],
    [/成交人数|buyer_count|buyers/, "buyers"],
    [/转化率|conversion_rate/, "conversion_rate"],
    [/成交金额|支付金额|gmv|revenue/, "revenue"]
  ];
  for (const [pattern, key] of pairs) {
    if (pattern.test(text)) return key;
  }
  return normalized.replace(/[^a-z0-9_]/g, "").slice(0, 80);
}

function categoryToGroup(category: string): string {
  const map: Record<string, string> = {
    basic: "核心数据",
    traffic: "流量",
    retention: "停留",
    interaction: "互动",
    follow: "关注",
    revenue: "营收",
    conversion: "成交",
    compliance: "合规",
    audience: "用户画像",
    custom: "自定义"
  };
  return map[category] || "自定义";
}

function groupToCategory(group: unknown): string {
  const map: Record<string, string> = {
    核心数据: "basic",
    流量: "traffic",
    停留: "retention",
    互动: "interaction",
    关注: "follow",
    营收: "revenue",
    成交: "conversion",
    合规: "compliance",
    用户画像: "audience",
    自定义: "custom"
  };
  return map[String(group || "")] || "custom";
}

function normalizeCategory(value: unknown): string {
  const raw = String(value || "");
  if (["basic", "traffic", "retention", "interaction", "follow", "revenue", "conversion", "compliance", "audience", "custom"].includes(raw)) return raw;
  return groupToCategory(raw);
}

function sourceTypeLabel(sourceType: string): string {
  if (sourceType === "screenshot_ai") return "截图AI识别";
  if (sourceType === "screenshot_manual_confirmed") return "用户确认";
  if (sourceType === "manual_input") return "手动录入";
  return sourceType || "未标明";
}

function confidenceScore(confidence: string): number {
  if (confidence === "high") return 92;
  if (confidence === "medium") return 75;
  if (confidence === "low") return 55;
  return 100;
}

function nullableBooleanFromDb(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return value === 1 || value === true || value === "1" || value === "true";
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
  const fixed = normalizeFixedDouyinDashboard(raw);
  const rawMetrics = fixed || (Array.isArray(raw?.metrics) ? raw.metrics : []);
  const metrics = Array.isArray(rawMetrics) ? rawMetrics.slice(0, 120).map((item: any) => {
    const key = canonicalMetricKey(item.key || item.label || item.source_text);
    const def = metricDefinitions()[key] || { label: String(item.label || key).slice(0, 80), category: String(item.category || "custom").slice(0, 40), unit: String(item.unit || "").slice(0, 20) };
    return {
      category: normalizeCategory(item.category || def.category).slice(0, 40),
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
  console.log("LivePilot screenshot pipeline normalized metrics", {
    platform: raw?.platform || null,
    screenshot_type: raw?.screenshot_type || null,
    metric_count: metrics.length,
    metric_keys: metrics.map((item: any) => item.key),
    metrics
  });
  return {
    document_type: String(raw?.document_type || raw?.screenshot_type || "douyin_live_summary").slice(0, 80),
    live_info: normalizeLiveInfo(raw),
    metrics,
    unrecognized_fields: Array.isArray(raw?.unrecognized_fields) ? raw.unrecognized_fields.slice(0, 20) : [],
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.slice(0, 20) : [],
    summary: String(raw?.summary || "").slice(0, 500)
  };
}

function isDouyinDashboardResult(raw: any): boolean {
  if (!raw || typeof raw !== "object") return false;
  if (String(raw.platform || "").toLowerCase() === "douyin" && String(raw.screenshot_type || "").toLowerCase() === "live_dashboard") return true;
  const metrics = raw.metrics && typeof raw.metrics === "object" ? raw.metrics : {};
  return ["exposure_count", "enter_count", "enter_rate", "average_online", "peak_online", "average_watch_seconds"].some((key) => metrics[key] !== undefined && metrics[key] !== null && metrics[key] !== "");
}

function normalizeLiveInfo(raw: any): Record<string, unknown> {
  const info = raw?.live_info && typeof raw.live_info === "object" ? raw.live_info : {};
  return {
    title: raw?.title ?? info.title ?? null,
    started_at: raw?.start_time ?? info.started_at ?? info.start_time ?? null,
    ended_at: raw?.end_time ?? info.ended_at ?? info.end_time ?? null,
    duration_seconds: raw?.duration ?? info.duration_seconds ?? info.duration ?? null
  };
}

function normalizeFixedDouyinDashboard(raw: any): any[] | null {
  if (!isDouyinDashboardResult(raw)) return null;
  const sourceMetrics = raw?.metrics && typeof raw.metrics === "object" ? raw.metrics : {};
  const aliases: Record<string, string[]> = {
    enter_count: ["enter_count", "进房人数", "进入直播间人数", "直播间进入人数"],
    enter_rate: ["enter_rate", "进房率", "进入率"],
    average_watch_seconds: ["average_watch_seconds", "人均停留", "平均观看时长", "人均停留时长"],
    peak_online: ["peak_online", "最高在线", "峰值在线"],
    new_follow_count: ["new_follow_count", "新增关注", "涨粉"],
    gift_rate: ["gift_rate", "送礼率"],
    member_income: ["member_income", "会员收入"],
    guardian_income: ["guardian_income", "星守护收入"],
    estimated_income: ["estimated_income", "预计本场收入", "预计收入"],
    gmv: ["gmv", "成交金额", "支付金额", "GMV"],
    order_count: ["order_count", "成交订单", "订单数"]
  };
  return fixedDouyinDashboardFields().map((field) => {
    const candidateKeys = [field.source, field.key, field.label, ...(aliases[field.source] || [])];
    const rawValue = firstPresent(sourceMetrics, candidateKeys);
    return {
      category: field.category,
      key: field.key,
      label: field.label,
      raw_value: rawValue,
      normalized_value: normalizeMetricValue(rawValue),
      unit: field.unit,
      confidence: rawValue === null || rawValue === undefined || rawValue === "" ? "low" : "high",
      source_text: rawValue === null || rawValue === undefined || rawValue === "" ? "" : `${field.label} ${rawValue}`,
      comparison: {}
    };
  }).filter((item) => item.raw_value !== null && item.raw_value !== undefined && item.raw_value !== "");
}

function firstPresent(source: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
  }
  return null;
}

async function applyRecognizedLiveInfo(env: Env, userId: number, sessionId: number, liveInfo: any): Promise<void> {
  if (!liveInfo || typeof liveInfo !== "object") return;
  const title = recognizedValue(liveInfo.title);
  const startedAt = recognizedValue(liveInfo.started_at);
  const durationSeconds = normalizeMetricValue(recognizedValue(liveInfo.duration_seconds) ?? recognizedValue(liveInfo.duration));
  const durationMinutes = durationSeconds ? Math.round(Number(durationSeconds) / 60) : null;
  await env.DB.prepare(
    "UPDATE live_sessions SET title=COALESCE(?1,title), session_topic=CASE WHEN COALESCE(session_topic,'')='' THEN COALESCE(?1,session_topic) ELSE session_topic END, live_date=COALESCE(?2,live_date), duration_minutes=COALESCE(?3,duration_minutes), updated_at=CURRENT_TIMESTAMP WHERE id=?4 AND user_id=?5"
  ).bind(title || null, startedAt ? String(startedAt).slice(0, 32) : null, durationMinutes, sessionId, userId).run();
  if (durationSeconds) {
    await replaceMetric(env, userId, sessionId, {
      key: "duration_minutes",
      label: "直播时长",
      category: "basic",
      raw_value: String(recognizedValue(liveInfo.duration_seconds) ?? recognizedValue(liveInfo.duration) ?? durationSeconds),
      normalized_value: durationMinutes,
      unit: "分钟",
      source_type: "screenshot_ai",
      confidence: "high",
      is_confirmed: 0
    });
  }
}

function recognizedValue(value: any): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value.normalized_value ?? value.raw_value ?? null;
  return value;
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
  return [
    "识别抖音直播复盘截图中明确出现的数据，只返回严格JSON，不要Markdown，不要分析。",
    "live_info可包含：title、started_at、ended_at、duration_seconds。",
    "metrics数组必须尽量使用这些标准key：yinlang(收获音浪)、gift_users(送礼人数)、gift_rate(送礼率)、member_income(会员收入)、guardian_income(星守护收入)、estimated_income(预计本场收入)、impressions(曝光人数)、room_entries(进房人数)、entry_rate(进房率)、average_online(平均在线人数)、peak_online(最高在线人数)、average_watch_seconds(人均停留时长)、comments(评论人数/评论数)、likes(点赞次数)、new_followers(新增粉丝/新增关注)、shares(分享次数)、fan_club_joins(加粉丝团人数)。",
    "每个metric字段：category、key、label、raw_value、normalized_value、unit、confidence、source_text、comparison。",
    "历史对比只放在comparison里，例如较近7场+1.3万，不要和本场实际值混成一个指标。",
    "不要猜测缺失值；无法读取的字段放入unrecognized_fields或warnings。"
  ].join("\\n");
}

function douyinDashboardPrompt(): string {
  return [
    "请先判断图片是否为抖音直播后台数据图。常见版式是顶部直播标题和时间，下面三块面板：营收指标、流量指标、互动指标。",
    "如果是，platform必须为douyin，screenshot_type必须为live_dashboard。",
    "如果不是，platform和screenshot_type按实际填写，metrics字段仍返回固定结构但值为null。",
    "按面板逐项读取，不要只看显眼大数字；小字指标也必须抽取。",
    "只抽取当前场次真实数据，不要混入较近7场、上一场、同类主播对比等历史对比。",
    "不要解释，不要总结，不要Markdown，只返回以下JSON结构：",
    "{",
    '  "platform": "douyin",',
    '  "screenshot_type": "live_dashboard",',
    '  "title": null,',
    '  "start_time": null,',
    '  "duration": null,',
    '  "metrics": {',
    '    "exposure_count": null,',
    '    "enter_count": null,',
    '    "enter_rate": null,',
    '    "viewer_count": null,',
    '    "average_online": null,',
    '    "peak_online": null,',
    '    "average_watch_seconds": null,',
    '    "comment_count": null,',
    '    "like_count": null,',
    '    "share_count": null,',
    '    "new_follow_count": null,',
    '    "fans_group_count": null,',
    '    "yinlang": null,',
    '    "gift_user_count": null,',
    '    "gift_rate": null,',
    '    "member_income": null,',
    '    "guardian_income": null,',
    '    "estimated_income": null,',
    '    "gift_income": null,',
    '    "gmv": null,',
    '    "order_count": null,',
    '    "buyer_count": null,',
    '    "conversion_rate": null',
    "  }",
    "}",
    "字段含义和别名：进房人数/进入直播间人数/直播间进入人数=enter_count；进房率/进入率=enter_rate；人均停留/平均观看时长=average_watch_seconds；最高在线/峰值在线=peak_online；新增关注/涨粉=new_follow_count；送礼率=gift_rate；会员收入=member_income；星守护收入=guardian_income；预计本场收入=estimated_income；成交金额/支付金额/GMV=gmv；成交订单/订单数=order_count。",
    "数值可保留原始中文单位，例如2.3万、5,143、22.1%、2.2分钟；空值必须返回null。"
  ].join("\\n");
}

function platformProfilePrompt(): string {
  return [
    "请从抖音主页截图中抽取账号资料，只返回JSON，不要Markdown。",
    "只读取截图中明确出现的信息；看不清或没有出现就返回null。",
    "字段：",
    "{",
    '  "platform": "douyin",',
    '  "display_name": null,',
    '  "account_handle": null,',
    '  "followers_raw": null,',
    '  "following_raw": null,',
    '  "likes_raw": null,',
    '  "bio": null,',
    '  "gender": null,',
    '  "tags": [],',
    '  "account_type_hint": null',
    "}",
    "抖音号通常在“抖音号：”后面；昵称通常是头像旁最大字号名称；粉丝数、获赞、关注、互关等按原文保留，例如1.2万、4502。"
  ].join("\\n");
}

function normalizePlatformProfileRecognition(raw: any): Record<string, unknown> {
  const displayName = cleanShortText(raw?.display_name, 80);
  const handleRaw = cleanShortText(raw?.account_handle, 80);
  const accountHandle = handleRaw ? handleRaw.replace(/^抖音号[:：]?/u, "").trim() : "";
  const followersRaw = cleanShortText(raw?.followers_raw ?? raw?.followers, 40);
  const followingRaw = cleanShortText(raw?.following_raw ?? raw?.following, 40);
  const likesRaw = cleanShortText(raw?.likes_raw ?? raw?.likes, 40);
  const bio = cleanShortText(raw?.bio, 300);
  const tags = Array.isArray(raw?.tags) ? raw.tags.map((item: unknown) => cleanShortText(item, 40)).filter(Boolean).slice(0, 8) : [];
  const accountTypeHint = cleanShortText(raw?.account_type_hint, 40);
  const notes = [
    bio ? `简介：${bio}` : "",
    followersRaw ? `粉丝：${followersRaw}` : "",
    likesRaw ? `获赞：${likesRaw}` : "",
    followingRaw ? `关注/互关：${followingRaw}` : "",
    tags.length ? `标签：${tags.join("、")}` : ""
  ].filter(Boolean).join("\\n");
  return {
    platform: "douyin",
    display_name: displayName || "",
    account_handle: accountHandle || "",
    follower_range: followerRangeFromRaw(followersRaw),
    account_type: accountTypeHint && /商家|企业|机构/u.test(accountTypeHint) ? accountTypeHint : "个人账号",
    notes,
    raw: {
      followers_raw: followersRaw || null,
      following_raw: followingRaw || null,
      likes_raw: likesRaw || null,
      bio: bio || null,
      tags
    }
  };
}

function cleanShortText(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\\u0000-\\u001f]/g, "").trim().slice(0, max);
}

function followerRangeFromRaw(raw: string): string {
  const value = normalizeMetricValue(raw);
  if (value === null) return "";
  if (value < 1000) return "1千以下";
  if (value < 10000) return "1千-1万";
  if (value < 100000) return "1万-10万";
  if (value < 1000000) return "10万-100万";
  return "100万以上";
}

function preparePlanSchemaHint(): string {
  return "JSON字段：recommended_theme字符串；titles数组3条；opening_3_minutes字符串；interaction_nodes数组3条；follow_prompts数组2条；risk_notes数组2条；target_metrics数组3条。";
}

function reportSchemaHint(): string {
  return "JSON字段：one_sentence；strongest_advantage；top_issue{title,evidence,confidence}；diagnoses数组最多3项；actions数组最多3项，每项含title,timing,instruction,script_example,target_metric,expected_direction；experiments数组最多3项；limitations数组。";
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
  return { id: user.id, name: user.nickname || user.username, nickname: user.nickname || user.username, username: user.username, role: user.role || "user" };
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await pbkdf2(password, salt, passwordHashIterations);
  return `pbkdf2_sha256$${passwordHashIterations}$${base64(salt)}$${base64(digest)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [algo, iterations, salt, digest] = stored.split("$");
    const count = Number(iterations);
    if (algo !== "pbkdf2_sha256" || !Number.isFinite(count) || count < 10000 || !salt || !digest) return false;
    const actual = await pbkdf2(password, fromBase64(salt), count);
    return timingSafeEqual(base64(actual), digest);
  } catch (error) {
    console.error("Password hash verification failed", safeErrorLog(error, { hash_prefix: stored.slice(0, 18) }));
    return false;
  }
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
function safeErrorLog(error: unknown, context: Record<string, unknown> = {}): Record<string, unknown> {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    ...context,
    name: err.name,
    message: err.message,
    stack: err.stack?.split("\n").slice(0, 3).join("\n")
  };
}
function base64(bytes: Uint8Array): string { let s = ""; bytes.forEach((b) => s += String.fromCharCode(b)); return btoa(s); }
function fromBase64(value: string): Uint8Array { return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)); }
function base64url(bytes: Uint8Array): string { return base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromBase64Url(value: string): Uint8Array { return fromBase64(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")); }
function base64urlJson(value: unknown): string { return base64url(new TextEncoder().encode(JSON.stringify(value))); }
function timingSafeEqual(a: string, b: string): boolean { if (a.length !== b.length) return false; let out = 0; for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i); return out === 0; }
function ok(payload: unknown): Response { return cors(new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders })); }
function fail(status: number, message: string): Response { return cors(new Response(JSON.stringify({ detail: message }), { status, headers: jsonHeaders })); }
function cors(response: Response, request?: Request): Response {
  const headers = new Headers(response.headers);
  const origin = request?.headers.get("origin") || "";
  const allowed = new Set([
    "https://livepilot-web.huchenghaox.workers.dev",
    "https://haoxagent.com",
    "https://www.haoxagent.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
  ]);
  headers.set("access-control-allow-origin", origin && allowed.has(origin) ? origin : "*");
  headers.set("vary", "Origin");
  headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "authorization,content-type,x-livepilot-filename");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
