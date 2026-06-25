type Env = {
  DB: D1Database;
  UPLOADS: R2Bucket;
  APP_ENV: string;
};

type AuthUser = {
  id: number;
  username: string;
  nickname: string;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (request.method === "GET" && url.pathname === "/health") return ok({ ok: true, name: "LivePilot Worker API" });
      if (request.method === "GET" && url.pathname === "/ready") return await ready(env);
      if (request.method === "POST" && url.pathname === "/api/dev/session") return await createDevSession(request, env);
      if (request.method === "POST" && url.pathname === "/api/uploads") return await uploadPrivateObject(request, env);
      if (request.method === "GET" && url.pathname.startsWith("/api/uploads/")) return await readPrivateObject(request, env, idFromPath(url.pathname));
      if (request.method === "DELETE" && url.pathname.startsWith("/api/uploads/")) return await deletePrivateObject(request, env, idFromPath(url.pathname));
      return fail(404, "接口不存在");
    } catch (error) {
      if (error instanceof HttpError) return fail(error.status, error.message);
      return fail(500, "服务暂时异常，请稍后重试。");
    }
  }
};

async function ready(env: Env): Promise<Response> {
  const checks = { d1: false, r2: false };
  await env.DB.prepare("SELECT 1").first();
  checks.d1 = true;
  const probeKey = `readiness/${crypto.randomUUID()}.txt`;
  await env.UPLOADS.put(probeKey, "ok", { httpMetadata: { contentType: "text/plain" } });
  const probe = await env.UPLOADS.get(probeKey);
  checks.r2 = (await probe?.text()) === "ok";
  await env.UPLOADS.delete(probeKey);
  return ok({ ok: checks.d1 && checks.r2, checks });
}

async function createDevSession(request: Request, env: Env): Promise<Response> {
  if (env.APP_ENV === "production") throw new HttpError(404, "接口不存在");
  const body = await readJson<{ username?: string; nickname?: string }>(request);
  const username = normalizeUsername(body.username || "local_worker_user");
  const nickname = (body.nickname || "Worker 本地测试用户").trim();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO users (username, username_normalized, nickname)
     VALUES (?1, ?2, ?3)`
  ).bind(username, username, nickname).run();
  const user = await env.DB.prepare(
    "SELECT id, username, nickname FROM users WHERE username_normalized = ?1"
  ).bind(username).first<AuthUser>();
  if (!user) throw new HttpError(500, "无法创建本地测试用户");
  const token = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO worker_sessions (user_id, token) VALUES (?1, ?2)")
    .bind(user.id, token)
    .run();
  return ok({ token, user });
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
  const result = await env.DB.prepare(
    `INSERT INTO uploaded_assets (user_id, object_key, filename, content_type, size_bytes)
     VALUES (?1, ?2, ?3, ?4, ?5)
     RETURNING id, filename, content_type, size_bytes, created_at`
  ).bind(user.id, objectKey, filename, contentType, body.byteLength).first();
  return ok({ item: result });
}

async function readPrivateObject(request: Request, env: Env, assetId: number): Promise<Response> {
  const user = await requireUser(request, env);
  const asset = await ownedAsset(env, user.id, assetId);
  const object = await env.UPLOADS.get(asset.object_key);
  if (!object) throw new HttpError(404, "文件不存在");
  return cors(new Response(object.body, {
    headers: {
      "content-type": asset.content_type,
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${asset.filename.replace(/"/g, "")}"`
    }
  }));
}

async function deletePrivateObject(request: Request, env: Env, assetId: number): Promise<Response> {
  const user = await requireUser(request, env);
  const asset = await ownedAsset(env, user.id, assetId);
  await env.UPLOADS.delete(asset.object_key);
  await env.DB.prepare("UPDATE uploaded_assets SET deleted_at = CURRENT_TIMESTAMP, status = 'deleted' WHERE id = ?1 AND user_id = ?2")
    .bind(assetId, user.id)
    .run();
  return ok({ ok: true, message: "文件已删除" });
}

async function requireUser(request: Request, env: Env): Promise<AuthUser> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "请先登录");
  const user = await env.DB.prepare(
    `SELECT users.id, users.username, users.nickname
     FROM worker_sessions
     JOIN users ON users.id = worker_sessions.user_id
     WHERE worker_sessions.token = ?1
       AND users.status = 'active'
       AND (worker_sessions.expires_at IS NULL OR worker_sessions.expires_at > CURRENT_TIMESTAMP)`
  ).bind(match[1]).first<AuthUser>();
  if (!user) throw new HttpError(401, "登录已过期，请重新登录");
  return user;
}

async function ownedAsset(env: Env, userId: number, assetId: number): Promise<{ object_key: string; filename: string; content_type: string }> {
  const asset = await env.DB.prepare(
    "SELECT object_key, filename, content_type FROM uploaded_assets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
  ).bind(assetId, userId).first<{ object_key: string; filename: string; content_type: string }>();
  if (!asset) throw new HttpError(404, "文件不存在");
  return asset;
}

function idFromPath(pathname: string): number {
  const raw = pathname.split("/").pop() || "";
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "文件不存在");
  return id;
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json().catch(() => ({}))) as T;
}

function normalizeUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{3,31}$/.test(username)) throw new HttpError(400, "用户名格式不正确");
  return username;
}

function safeFilename(value: string): string {
  return value.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_").slice(0, 120) || "upload.bin";
}

function ok(payload: unknown): Response {
  return cors(new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders }));
}

function fail(status: number, message: string): Response {
  return cors(new Response(JSON.stringify({ detail: message }), { status, headers: jsonHeaders }));
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "authorization,content-type,x-livepilot-filename");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
