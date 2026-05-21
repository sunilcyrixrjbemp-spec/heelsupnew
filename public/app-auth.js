(function () {
  const API_BASE = (window.HEELSUP_CONFIG && window.HEELSUP_CONFIG.API_BASE) || "";

  function getToken() {
    return localStorage.getItem("heelsup_token") || "";
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem("heelsup_user") || "null");
    } catch {
      return null;
    }
  }

  function setSession(token, user) {
    if (token) localStorage.setItem("heelsup_token", token);
    if (user) localStorage.setItem("heelsup_user", JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem("heelsup_token");
    localStorage.removeItem("heelsup_user");
  }

  function authHeaders(extra) {
    const headers = Object.assign({ "Content-Type": "application/json" }, extra || {});
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function api(path, options) {
    const opts = Object.assign({ method: "GET" }, options || {});
    opts.headers = authHeaders(opts.headers || {});
    const response = await fetch(`${API_BASE}${path}`, opts);
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const err = new Error((data && (data.error || data.message)) || "Request failed");
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.HeelsUpAuth = {
    API_BASE,
    getToken,
    getUser,
    setSession,
    clearSession,
    api
  };
})();
