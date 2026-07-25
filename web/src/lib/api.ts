export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

export type ApiError = { detail?: string | { msg?: string }[] };

export function getToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("token") || "";
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers });
  } catch {
    throw new Error("暂时无法连接服务，请确认后台服务已经启动后重试。");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError;
    if (response.status === 401) {
      clearAuth();
      const message = typeof body.detail === "string" ? body.detail : "登录已过期，请重新登录。";
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.setTimeout(() => {
          window.location.href = "/login";
        }, 800);
      }
      throw new Error(message);
    }
    if (response.status === 403) {
      throw new Error(typeof body.detail === "string" ? body.detail : "你没有权限进行这个操作。");
    }
    if (response.status >= 500) {
      throw new Error("服务暂时异常，请稍后重试。");
    }
    if (typeof body.detail === "string") throw new Error(body.detail);
    if (Array.isArray(body.detail) && body.detail[0]?.msg) throw new Error(body.detail[0].msg);
    throw new Error("请求失败，请稍后重试");
  }
  return response.json() as Promise<T>;
}

export function saveAuth(token: string, user: unknown) {
  window.localStorage.setItem("token", token);
  window.localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user");
}

export function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl(path));
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error("暂时无法连接服务，请确认后台服务已经启动后重试。"));
    xhr.onload = () => {
      const body = xhr.responseText ? safeParseResponse(xhr.responseText) as ApiError | T : {};
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
        return;
      }
      if (xhr.status === 401) {
        clearAuth();
        reject(new Error("登录已过期，请重新登录。"));
        return;
      }
      if (xhr.status === 403) {
        reject(new Error("你没有权限上传到这场直播。"));
        return;
      }
      if (xhr.status >= 500) {
        reject(new Error("服务暂时异常，请稍后重试。"));
        return;
      }
      if (typeof (body as ApiError).detail === "string") {
        reject(new Error((body as ApiError).detail as string));
        return;
      }
      reject(new Error("上传失败，请稍后重试"));
    };
    xhr.send(formData);
  });
}

function safeParseResponse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function apiUrl(path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`.replace(/([^:]\/)\/+/g, "$1");
}
