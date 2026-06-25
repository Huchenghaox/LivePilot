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
