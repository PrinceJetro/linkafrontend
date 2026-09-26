const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

function getTokens() {
  if (typeof window === "undefined") return {};
  return {
    access: localStorage.getItem("linka_access") ?? "",
    refresh: localStorage.getItem("linka_refresh") ?? "",
  };
}

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem("linka_access", access);
  localStorage.setItem("linka_refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("linka_access");
  localStorage.removeItem("linka_refresh");
}

export function isLoggedIn() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("linka_access");
}

function sessionExpired(): never {
  clearTokens();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
  throw new Error("Session expired — please log in again.");
}

async function tryRefresh(): Promise<boolean> {
  const { refresh } = getTokens();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.access) {
      localStorage.setItem("linka_access", data.access);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function req(path: string, options: RequestInit = {}, auth = false, _retried = false) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const { access } = getTokens();
    if (access) headers["Authorization"] = `Bearer ${access}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401 && auth && !_retried) {
    // Access token likely expired — refresh once and retry instead of logging out
    if (await tryRefresh()) return req(path, options, auth, true);
    sessionExpired();
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  register: (data: { username: string; email: string; password: string }) =>
    req("/auth/register/", { method: "POST", body: JSON.stringify(data) }),
  login: (username: string, password: string) =>
    req("/auth/login/", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => req("/auth/me/", {}, true),
  changePassword: (old_password: string, new_password: string) =>
    req("/auth/change_password/", { method: "POST", body: JSON.stringify({ old_password, new_password }) }, true),
  matchHistory: () => req("/match/history/", {}, true),
  profiles: (params = "") => req(`/profiles/${params}`),
  myProfiles: () => req("/profiles/?mine=1", {}, true),
  createProfile: (data: object) =>
    req("/profiles/", { method: "POST", body: JSON.stringify(data) }, true),
  updateProfile: (id: number, data: object) =>
    req(`/profiles/${id}/`, { method: "PATCH", body: JSON.stringify(data) }, true),
  deleteProfile: (id: number) =>
    req(`/profiles/${id}/`, { method: "DELETE" }, true),
  mapStats: (industry = "") => req(`/profiles/map/${industry ? `?industry=${encodeURIComponent(industry)}` : ""}`),
  metrics: () => req("/metrics/"),
  notifications: () => req("/notifications/", {}, true),
  requestVerification: (id: number) =>
    req(`/profiles/${id}/request_verification/`, { method: "POST", body: "{}" }, true),
  match: (query: string, filters: { country?: string; industry?: string; partnership_type?: string } = {}) =>
    req("/match/", { method: "POST", body: JSON.stringify({ query, ...filters }) }),
  brief: (from_profile_id: number, to_profile_id: number, objective?: string, language = "English") =>
    req("/brief/", {
      method: "POST",
      body: JSON.stringify({ from_profile_id, to_profile_id, objective, language }),
    }),
  sendRequest: (data: object) => req("/requests/", { method: "POST", body: JSON.stringify(data) }, true),
  myRequests: () => req("/requests/", {}, true),
  requestAction: (id: number, action: "accept" | "decline" | "request_info") =>
    req(`/requests/${id}/${action}/`, { method: "POST", body: "{}" }, true),
  conversations: () => req("/conversations/", {}, true),
  startConversation: (data: { username?: string; user_id?: number }) =>
    req("/conversations/", { method: "POST", body: JSON.stringify(data) }, true),
  threadMessages: (id: number) => req(`/conversations/${id}/messages/`, {}, true),
  sendMessage: (id: number, body: string) =>
    req(`/conversations/${id}/messages/`, { method: "POST", body: JSON.stringify({ body }) }, true),
  milestones: (profileId: number) => req(`/profiles/milestones/?profile=${profileId}`),
  postMilestone: (data: object) =>
    req("/profiles/milestones/", { method: "POST", body: JSON.stringify(data) }, true),
  broadcasts: () => req("/profiles/broadcasts/"),
  postBroadcast: (data: object) =>
    req("/profiles/broadcasts/", { method: "POST", body: JSON.stringify(data) }, true),
  closeBroadcast: (id: number) =>
    req(`/profiles/broadcasts/${id}/close/`, { method: "POST", body: "{}" }, true),
  endorsements: (profileId: number) => req(`/endorsements/?profile=${profileId}`, {}, true),
  postEndorsement: (data: object) =>
    req("/endorsements/", { method: "POST", body: JSON.stringify(data) }, true),
  mou: (request_id: number) =>
    req("/mou/", { method: "POST", body: JSON.stringify({ request_id }) }, true),
  tradeInfo: (from_country: string, to_country: string, industry: string) =>
    req("/trade-info/", { method: "POST", body: JSON.stringify({ from_country, to_country, industry }) }),
  voiceIntent: async (blob: Blob) => {
    const fd = new FormData();
    fd.append("audio", blob, "note.webm");
    const headers: Record<string, string> = {};
    const access = typeof window !== "undefined" ? localStorage.getItem("linka_access") : "";
    if (access) headers["Authorization"] = `Bearer ${access}`;
    const res = await fetch(`${API_BASE}/voice-intent/`, { method: "POST", headers, body: fd });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

export { API_BASE };
