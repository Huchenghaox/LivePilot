const baseUrl = process.env.WORKER_BASE_URL || "http://127.0.0.1:8787";
const stamp = Date.now().toString().slice(-8);

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function requestStatus(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function auth(token, extra = {}) {
  return { authorization: `Bearer ${token}`, ...extra };
}

async function main() {
  const health = await request("/api/health");
  assert(health.ok === true, "health should be ok");

  const ready = await request("/api/ready");
  assert(ready.ok === true, "ready should be ok");
  assert(ready.checks?.d1 === true && ready.checks?.r2 === true, "D1 and R2 should be ready");

  const mode = await request("/api/auth/registration-mode");
  assert(mode.mode === "invite", "local smoke expects invite registration mode");
  assert(mode.sms_enabled === true, "local smoke expects mock SMS enabled");

  await request("/api/dev/invite", {
    method: "POST",
    body: JSON.stringify({ code: `BETA${stamp}`, max_uses: 5 })
  });

  const phone = `138${stamp.padStart(8, "0").slice(0, 8)}`;
  const sms = await request("/api/auth/sms/send", {
    method: "POST",
    body: JSON.stringify({ phone, purpose: "register" })
  });
  assert(/^\d{6}$/.test(sms.debug_code || ""), "mock SMS should return debug_code only in local development");

  const username = `user${stamp}`;
  const password = `Lp${stamp}!`;
  const registered = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      phone,
      sms_code: sms.debug_code,
      username,
      nickname: "Worker烟测用户",
      password,
      confirm_password: password,
      invite_code: `BETA${stamp}`,
      accepted_terms: true
    })
  });
  assert(registered.access_token, "register should return token");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: username.toUpperCase(), password })
  });
  assert(login.access_token, "login should return token");
  const token = login.access_token;

  const me = await request("/api/me", { headers: auth(token) });
  assert(me.user?.username === username, "me should return current user");

  const streamer = await request("/api/streamers", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      name: "Worker烟测主播",
      direction: "内容分享",
      live_forms: ["单人口播"],
      improvement_goal: "留得更久"
    })
  });
  assert(streamer.id, "streamer should be created");

  const streamers = await request("/api/streamers", { headers: auth(token) });
  assert(Array.isArray(streamers) && streamers.some((item) => item.id === streamer.id), "streamer list should include created streamer");

  const account = await request("/api/platform-accounts", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      platform: "douyin",
      display_name: "Worker烟测抖音号",
      account_handle: `lp_${stamp}`,
      account_type: "个人账号",
      anchor_id: streamer.id
    })
  });
  assert(account.id, "platform account should be created");
  assert(account.bindings?.length === 1, "platform account should bind streamer");

  const bound = await request(`/api/streamers/${streamer.id}/platform-accounts`, { headers: auth(token) });
  assert(bound.items?.some((item) => item.id === account.id), "bound account should be visible from streamer");

  const dashboard = await request("/api/dashboard", { headers: auth(token) });
  assert(dashboard.stats?.streamer_count >= 1, "dashboard should include streamer count");
  assert(dashboard.stats?.platform_account_count >= 1, "dashboard should include platform account count");

  const plan = await request("/api/prepare-plans", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      streamer_id: streamer.id,
      platform_account_id: account.id,
      topic: "新主播如何提高直播停留",
      duration_minutes: 90,
      goal: "留得更久",
      live_form: "评论互动",
      special_notes: "下一场重点验证前3分钟互动"
    })
  });
  assert(plan.id && plan.plan?.opening_3_minutes, "preparation plan should be generated and saved");

  const session = await request("/api/live-sessions", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      streamer_id: streamer.id,
      platform_account_id: account.id,
      preparation_plan_id: plan.id,
      platform: "douyin",
      data_source: "screenshot_ai",
      title: "Worker烟测直播复盘"
    })
  });
  assert(session.id, "live session should be created");

  await request(`/api/live-sessions/${session.id}/metrics`, {
    method: "PUT",
    headers: auth(token),
    body: JSON.stringify({
      live_date: "2026-06-25",
      session_topic: "新主播如何提高直播停留",
      main_goal: "留得更久",
      self_review: "感觉前半段互动偏少",
      duration_minutes: "90",
      room_entries: "5,143",
      average_online: "32",
      peak_online: "126"
    })
  });

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const form = new FormData();
  form.append("files", new Blob([png], { type: "image/png" }), "douyin-live-summary.png");
  const screenshotResponse = await fetch(`${baseUrl}/api/live-sessions/${session.id}/screenshots`, {
    method: "POST",
    headers: auth(token),
    body: form
  });
  const screenshotBody = await screenshotResponse.json();
  assert(screenshotResponse.ok && screenshotBody.items?.length === 1, "review screenshot upload should succeed");

  const screenshots = await request(`/api/live-sessions/${session.id}/screenshots`, { headers: auth(token) });
  assert(screenshots.items?.[0]?.recognition_status !== "failed", "screenshot should be recognized or awaiting confirmation");

  const metricsBeforeConfirm = await request(`/api/live-sessions/${session.id}/metrics`, { headers: auth(token) });
  assert(metricsBeforeConfirm.items?.some((item) => item.key === "average_watch_seconds"), "recognized metrics should be saved as draft");
  await request(`/api/live-sessions/${session.id}/recognized-fields`, {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      items: [
        { key: "average_watch_seconds", label: "人均停留时长", category: "retention", raw_value: "2.5分钟", normalized_value: 150, unit: "秒", source_type: "screenshot_manual_confirmed", confidence: "manual" }
      ]
    })
  });

  const report = await request(`/api/live-sessions/${session.id}/report`, {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ mode: "comprehensive" })
  });
  assert(report.one_sentence && report.next_actions?.length > 0, "diagnostic report should include conclusion and actions");
  assert(report.structured_actions?.[0]?.timing && report.structured_actions?.[0]?.target_metric, "action should include timing and target metric");
  assert(report.experiments?.length > 0, "report should create experiments");

  const reportRead = await request(`/api/live-sessions/${session.id}/report`, { headers: auth(token) });
  assert(reportRead.funnel?.retention, "saved report should include funnel diagnosis");

  const nextPlan = await request("/api/prepare-plans/from-report", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ report_id: report.id })
  });
  assert(nextPlan.id && nextPlan.source_report_id === report.id, "next preparation plan should link source report");

  await request("/api/feedback", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ live_session_id: session.id, report_id: report.id, feedback_type: "报告有帮助", content: "烟测反馈" })
  });

  const upload = await fetch(`${baseUrl}/api/uploads`, {
    method: "POST",
    headers: auth(token, {
      "content-type": "text/plain",
      "x-livepilot-filename": "worker-smoke.txt"
    }),
    body: "hello livepilot"
  });
  const uploadBody = await upload.json();
  assert(upload.ok && uploadBody.item?.id, "private upload should succeed");

  const download = await fetch(`${baseUrl}/api/uploads/${uploadBody.item.id}`, { headers: auth(token) });
  assert(download.ok && (await download.text()) === "hello livepilot", "private download should return uploaded content");

  await request(`/api/uploads/${uploadBody.item.id}`, { method: "DELETE", headers: auth(token) });
  const deletedDownload = await requestStatus(`/api/uploads/${uploadBody.item.id}`, { headers: auth(token) });
  assert(deletedDownload.status === 404, "deleted private object should be inaccessible");

  const otherPhone = `139${stamp.padStart(8, "0").slice(0, 8)}`;
  const otherSms = await request("/api/auth/sms/send", {
    method: "POST",
    body: JSON.stringify({ phone: otherPhone, purpose: "register" })
  });
  const other = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      phone: otherPhone,
      sms_code: otherSms.debug_code,
      username: `other${stamp}`,
      password,
      confirm_password: password,
      invite_code: `BETA${stamp}`,
      accepted_terms: true
    })
  });
  const crossGet = await requestStatus(`/api/streamers/${streamer.id}`, { headers: auth(other.access_token) });
  assert(crossGet.status === 404, "cross-user streamer read should be denied");
  const crossBind = await requestStatus(`/api/platform-accounts/${account.id}/bind`, {
    method: "POST",
    headers: auth(other.access_token),
    body: JSON.stringify({ streamer_id: streamer.id })
  });
  assert(crossBind.status === 404, "cross-user bind should be denied");

  const changed = await request("/api/account/change-password", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ old_password: password, new_password: `${password}New` })
  });
  assert(changed.ok === true, "change password should succeed");
  const oldTokenMe = await requestStatus("/api/me", { headers: auth(token) });
  assert(oldTokenMe.status === 401, "old token should be invalid after password change");

  const resetSms = await request("/api/auth/password-reset/start", {
    method: "POST",
    body: JSON.stringify({ account: username })
  });
  assert(/^\d{6}$/.test(resetSms.debug_code || ""), "password reset should send mock SMS locally");
  await request("/api/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({
      account: username,
      sms_code: resetSms.debug_code,
      new_password: `${password}Reset`,
      confirm_password: `${password}Reset`
    })
  });
  const resetLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password: `${password}Reset` })
  });
  assert(resetLogin.access_token, "login with reset password should succeed");

  const unbind = await request(`/api/platform-accounts/${account.id}/unbind`, {
    method: "POST",
    headers: auth(resetLogin.access_token),
    body: JSON.stringify({ streamer_id: streamer.id })
  });
  assert(unbind.ok === true, "unbind should succeed");
  await request(`/api/platform-accounts/${account.id}`, { method: "DELETE", headers: auth(resetLogin.access_token) });
  await request(`/api/streamers/${streamer.id}`, { method: "DELETE", headers: auth(resetLogin.access_token) });

  console.log("Worker smoke passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
