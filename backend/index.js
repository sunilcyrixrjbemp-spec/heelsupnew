/**
 * HeelsUp Enterprise Backend — Cloudflare Worker
 * Version: 3.0 Enterprise
 * Features: OTP Auth, Razorpay, Reviews, Wishlist, Addresses, Coupons,
 *           Offline Sales, Returns, Reports, Admin Settings, Audit Log
 */

// ════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsResponse();
    }
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error("Unhandled error:", err);
      return json({ error: "Internal server error" }, 500);
    }
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = request.method;

  // Health check
  if (method === "GET" && path === "/api/health") {
    return json({ ok: true, version: "3.0", timestamp: nowIso() });
  }

  // ─── AUTH ROUTES ───────────────────────────────────────────────
  if (path === "/api/auth/send-otp" && method === "POST")        return sendOtp(request, env);
  if (path === "/api/auth/verify-otp" && method === "POST")      return verifyOtpRoute(request, env);
  if (path === "/api/auth/register" && method === "POST")        return registerUser(request, env);
  if (path === "/api/auth/login" && method === "POST")           return loginUser(request, env);
  if (path === "/api/auth/logout" && method === "POST")          return logoutUser(request, env);
  if (path === "/api/auth/forgot-password" && method === "POST") return forgotPassword(request, env);
  if (path === "/api/auth/reset-password" && method === "POST")  return resetPassword(request, env);

  // ─── PRODUCTS ─────────────────────────────────────────────────
  if (path === "/api/products" && method === "GET")              return listProducts(url, env);
  if (/^\/api\/products\/(\d+)$/.test(path) && method === "GET") return getProduct(path, env);
  if (/^\/api\/products\/(\d+)\/reviews$/.test(path) && method === "GET")  return getProductReviews(path, env);
  if (/^\/api\/products\/(\d+)\/reviews$/.test(path) && method === "POST") return addProductReview(request, path, env);

  // ─── COUPONS ──────────────────────────────────────────────────
  if (path === "/api/coupons/validate" && method === "POST")     return validateCoupon(request, env);

  // ─── USER — PROTECTED ─────────────────────────────────────────
  if (path === "/api/me" && method === "GET")                    return getMe(request, env);
  if (path === "/api/me" && method === "PUT")                    return updateMe(request, env);
  if (path === "/api/me/password" && method === "PUT")           return changePassword(request, env);

  // Addresses
  if (path === "/api/me/addresses" && method === "GET")          return listAddresses(request, env);
  if (path === "/api/me/addresses" && method === "POST")         return addAddress(request, env);
  if (/^\/api\/me\/addresses\/(\d+)$/.test(path) && method === "PUT")    return updateAddress(request, path, env);
  if (/^\/api\/me\/addresses\/(\d+)$/.test(path) && method === "DELETE") return deleteAddress(request, path, env);

  // Wishlist
  if (path === "/api/me/wishlist" && method === "GET")           return getWishlist(request, env);
  if (path === "/api/me/wishlist" && method === "POST")          return addWishlist(request, env);
  if (/^\/api\/me\/wishlist\/(\d+)$/.test(path) && method === "DELETE") return removeWishlist(request, path, env);

  // ─── ORDERS ───────────────────────────────────────────────────
  if (path === "/api/orders/initiate" && method === "POST")      return initiateOrder(request, env);
  if (path === "/api/orders/my" && method === "GET")             return listMyOrders(request, env);
  if (/^\/api\/orders\/(\d+)\/return$/.test(path) && method === "POST") return submitReturn(request, path, env);

  // ─── PAYMENTS ─────────────────────────────────────────────────
  if (path === "/api/payments/razorpay/verify" && method === "POST") return verifyRazorpayPayment(request, env);

  // ─── PUBLIC SETTINGS (key_id only, no secret) ─────────────────
  if (path === "/api/settings" && method === "GET") {
    const [keyId, mode, freeAbove, stdCharge, siteName] = await Promise.all([
      getSetting(env, "razorpay_key_id", ""),
      getSetting(env, "razorpay_mode", "live"),
      getSetting(env, "shipping_free_above", "499"),
      getSetting(env, "shipping_standard_charge", "49"),
      getSetting(env, "site_name", "HeelsUp")
    ]);
    return json({ razorpay_key_id: keyId, razorpay_mode: mode, shipping_free_above: Number(freeAbove), shipping_standard_charge: Number(stdCharge), site_name: siteName });
  }

  // ─── R2 UPLOAD (Admin only — handled by admin handler) ────────
  if (path === "/api/admin/upload" && method === "POST") return handleAdmin(request, path, url, env);
  if (path.startsWith("/api/admin/upload") && method === "DELETE") return handleAdmin(request, path, url, env);

  // ─── SEARCH ───────────────────────────────────────────────────
  if (path === "/api/search" && method === "GET") {
    const q = url.searchParams.get("q") || "";
    if (!q.trim()) return json({ products: [], total: 0 });
    const { results } = await env.DB.prepare(
      "SELECT id, name, category, price, original_price, image_url, stock, rating, review_count FROM products WHERE active=1 AND (LOWER(name) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?)) ORDER BY featured DESC, rating DESC LIMIT 40"
    ).bind(`%${q}%`, `%${q}%`, `%${q}%`).all();
    return json({ products: results || [], total: results?.length || 0, query: q });
  }

  // ─── CONTACT / NEWSLETTER ─────────────────────────────────────
  if (path === "/api/newsletter" && method === "POST")           return createNewsletter(request, env);
  if (path === "/api/contact" && method === "POST")              return createContact(request, env);

  // ─── ADMIN ROUTES ─────────────────────────────────────────────
  if (path.startsWith("/api/admin")) return handleAdmin(request, path, url, env);

  return json({ error: "Not found" }, 404);
}



// ════════════════════════════════════════════════════════════════
// SETTINGS HELPERS (Read from DB — Admin can change via panel)
// ════════════════════════════════════════════════════════════════
async function getSetting(env, key, fallback = "") {
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
    return row ? String(row.value || fallback) : fallback;
  } catch { return fallback; }
}

async function setSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).bind(key, String(value), nowIso()).run();
}

async function getAllSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value, description, updated_at FROM settings ORDER BY key").all();
  return results || [];
}

// ════════════════════════════════════════════════════════════════
// OTP — Send via Google Apps Script
// ════════════════════════════════════════════════════════════════
async function sendOtpEmail(env, email, otp, purpose) {
  const scriptUrl = await getSetting(env, "otp_script_url",
    "https://script.google.com/macros/s/AKfycbzXkeCVB258ETOqj2i0FQPc-tYOLdsfHUqpE8fAqM8Q268f03bv4mt4GxMHyNQ_mDsV7A/exec");
  const siteName = await getSetting(env, "site_name", "HeelsUp");

  const subjects = {
    register: `Your OTP to create ${siteName} account`,
    forgot: `Reset your ${siteName} password — OTP`,
    login: `Your ${siteName} login OTP`
  };
  const messages = {
    register: `Welcome to ${siteName}! Your email verification OTP is: **${otp}**\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.\n\n— ${siteName} Team`,
    forgot: `Your password reset OTP for ${siteName} is: **${otp}**\n\nThis OTP expires in 10 minutes.\n\n— ${siteName} Team`,
    login: `Your login OTP for ${siteName} is: **${otp}**\n\nValid for 10 minutes.\n\n— ${siteName} Team`
  };

  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject: subjects[purpose] || `Your ${siteName} OTP`,
        message: messages[purpose] || `Your OTP is: ${otp}`,
        html: buildOtpHtml(siteName, otp, purpose)
      })
    });
    return { ok: res.ok };
  } catch (e) {
    console.error("OTP send failed:", e);
    return { ok: false, error: e.message };
  }
}

function buildOtpHtml(siteName, otp, purpose) {
  const purposeText = {
    register: "verify your email address",
    forgot: "reset your password",
    login: "log in to your account"
  }[purpose] || "verify your identity";

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:linear-gradient(135deg,#c9a96e,#8b6914);padding:32px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:28px">${siteName}</h1>
<p style="color:rgba(255,255,255,0.85);margin:8px 0 0">Premium Ladies Footwear</p>
</td></tr>
<tr><td style="padding:40px 36px">
<h2 style="color:#1a1a1a;margin:0 0 12px">Your OTP Code</h2>
<p style="color:#555;margin:0 0 28px">Use the code below to ${purposeText}:</p>
<div style="background:#f8f4ee;border:2px dashed #c9a96e;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px">
<span style="font-size:42px;font-weight:700;letter-spacing:12px;color:#8b6914;font-family:monospace">${otp}</span>
</div>
<p style="color:#888;font-size:13px;margin:0">⏱ This OTP expires in <strong>10 minutes</strong>.<br>🔒 Never share this OTP with anyone.</p>
</td></tr>
<tr><td style="background:#f8f8f8;padding:20px 36px;text-align:center">
<p style="color:#aaa;font-size:12px;margin:0">© 2025 ${siteName} | If you didn't request this, please ignore.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendOtp(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const email = normalizeEmail(body.email);
  const purpose = String(body.purpose || "register");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Valid email is required" }, 400);
  }
  if (!["register", "forgot", "login"].includes(purpose)) {
    return json({ error: "Invalid purpose" }, 400);
  }

  // Rate limit: max 5 OTPs per email per hour
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM otp_tokens WHERE email = ? AND created_at > ?"
  ).bind(email, hourAgo).first();
  if ((recent?.c || 0) >= 5) {
    return json({ error: "Too many OTP requests. Please wait 1 hour." }, 429);
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiryMins = parseInt(await getSetting(env, "otp_expiry_minutes", "10")) || 10;
  const expiresAt = new Date(Date.now() + expiryMins * 60000).toISOString();
  const otpHash = await sha256Hex(otp);

  await env.DB.prepare(
    "INSERT INTO otp_tokens (email, otp_hash, purpose, attempts, verified, expires_at, created_at) VALUES (?, ?, ?, 0, 0, ?, ?)"
  ).bind(email, otpHash, purpose, expiresAt, nowIso()).run();

  const result = await sendOtpEmail(env, email, otp, purpose);

  if (!result.ok) {
    return json({ error: "Failed to send OTP. Please try again." }, 502);
  }

  return json({ ok: true, message: `OTP sent to ${email}` });
}

async function verifyOtpRoute(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const email = normalizeEmail(body.email);
  const otp = String(body.otp || "").trim();
  const purpose = String(body.purpose || "register");

  if (!email || !otp) return json({ error: "Email and OTP required" }, 400);

  const result = await verifyOtp(env, email, otp, purpose);
  if (!result.ok) return json({ error: result.error }, 400);

  return json({ ok: true, verified: true });
}

async function verifyOtp(env, email, otp, purpose) {
  const otpHash = await sha256Hex(String(otp).trim());
  const now = nowIso();

  const token = await env.DB.prepare(
    "SELECT * FROM otp_tokens WHERE email = ? AND purpose = ? AND verified = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1"
  ).bind(email, purpose, now).first();

  if (!token) return { ok: false, error: "OTP expired or not found. Please request a new OTP." };

  if ((token.attempts || 0) >= 5) {
    return { ok: false, error: "Too many incorrect attempts. Request a new OTP." };
  }

  if (token.otp_hash !== otpHash) {
    await env.DB.prepare("UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ?").bind(token.id).run();
    const remaining = 4 - (token.attempts || 0);
    return { ok: false, error: `Incorrect OTP. ${remaining} attempts remaining.` };
  }

  await env.DB.prepare("UPDATE otp_tokens SET verified = 1 WHERE id = ?").bind(token.id).run();
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════
// REGISTER
// ════════════════════════════════════════════════════════════════
async function registerUser(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const firstName = String(body.firstName || body.first_name || "").trim();
  const lastName  = String(body.lastName  || body.last_name  || "").trim();
  const email     = normalizeEmail(body.email);
  const phone     = String(body.phone     || "").replace(/\D/g, "").slice(-10);
  const password  = String(body.password  || "");
  const otp       = String(body.otp       || "").trim();

  if (!firstName || !email || !password) {
    return json({ error: "firstName, email, and password are required" }, 400);
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters" }, 400);
  }

  // Verify OTP
  const otpResult = await verifyOtp(env, email, otp, "register");
  if (!otpResult.ok) return json({ error: otpResult.error }, 400);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "An account with this email already exists" }, 409);

  const passwordHash = await hashPassword(password);
  const now = nowIso();

  const result = await env.DB.prepare(
    "INSERT INTO users (first_name, last_name, email, phone, password_hash, role, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'customer', 1, ?, ?)"
  ).bind(firstName, lastName, email, phone, passwordHash, now, now).run();

  const userId = result.meta?.last_row_id;
  const session = await createSession(env, userId, "customer");

  // Audit log
  await auditLog(env, userId, "register", "users", userId, { email });

  return json({
    ok: true,
    token: session.token,
    user: { id: userId, firstName, lastName, email, phone, role: "customer" }
  }, 201);
}

// ════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════
async function loginUser(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const email    = normalizeEmail(body.email);
  const password = String(body.password || "");
  const ip       = request.headers.get("CF-Connecting-IP") || "";

  if (!email || !password) return json({ error: "Email and password are required" }, 400);

  // Check account lockout
  const maxAttempts = parseInt(await getSetting(env, "max_login_attempts", "5")) || 5;
  const lockoutMins = parseInt(await getSetting(env, "lockout_duration_minutes", "30")) || 30;
  const windowStart = new Date(Date.now() - lockoutMins * 60000).toISOString();

  const failedAttempts = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM login_attempts WHERE email = ? AND success = 0 AND created_at > ?"
  ).bind(email, windowStart).first();

  if ((failedAttempts?.c || 0) >= maxAttempts) {
    return json({ error: `Account temporarily locked due to too many failed attempts. Try again after ${lockoutMins} minutes.` }, 429);
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await env.DB.prepare(
      "INSERT INTO login_attempts (email, success, ip, created_at) VALUES (?, 0, ?, ?)"
    ).bind(email, ip, nowIso()).run();
    return json({ error: "Invalid email or password" }, 401);
  }

  // Success
  await env.DB.prepare(
    "INSERT INTO login_attempts (email, success, ip, created_at) VALUES (?, 1, ?, ?)"
  ).bind(email, ip, nowIso()).run();

  const session = await createSession(env, user.id, user.role);
  await auditLog(env, user.id, "login", "users", user.id, { ip });

  return json({
    ok: true,
    token: session.token,
    user: mapUser(user)
  });
}

async function logoutUser(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const token = request.headers.get("authorization")?.slice(7).trim() || "";
  const payload = await verifyJwt(token, env.JWT_SECRET || "dev-secret-change-me");
  if (payload?.sid) {
    await env.DB.prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").bind(payload.sid).run();
  }
  await auditLog(env, auth.user.id, "logout", "sessions", null, {});
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════
// FORGOT / RESET PASSWORD
// ════════════════════════════════════════════════════════════════
async function forgotPassword(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "Email is required" }, 400);

  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  // Always return ok to prevent email enumeration
  if (!user) return json({ ok: true, message: "If this email exists, an OTP has been sent." });

  // Rate limit
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM otp_tokens WHERE email = ? AND purpose = 'forgot' AND created_at > ?"
  ).bind(email, hourAgo).first();
  if ((recent?.c || 0) >= 3) {
    return json({ ok: true, message: "If this email exists, an OTP has been sent." });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  const otpHash = await sha256Hex(otp);

  await env.DB.prepare(
    "INSERT INTO otp_tokens (email, otp_hash, purpose, attempts, verified, expires_at, created_at) VALUES (?, ?, 'forgot', 0, 0, ?, ?)"
  ).bind(email, otpHash, expiresAt, nowIso()).run();

  await sendOtpEmail(env, email, otp, "forgot");
  return json({ ok: true, message: "If this email exists, an OTP has been sent." });
}

async function resetPassword(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const email    = normalizeEmail(body.email);
  const otp      = String(body.otp || "").trim();
  const password = String(body.password || "");

  if (!email || !otp || !password) return json({ error: "email, otp, and password are required" }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

  const otpResult = await verifyOtp(env, email, otp, "forgot");
  if (!otpResult.ok) return json({ error: otpResult.error }, 400);

  const hash = await hashPassword(password);
  await env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?")
    .bind(hash, nowIso(), email).run();

  // Revoke all sessions
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (user) {
    await env.DB.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?").bind(user.id).run();
    await auditLog(env, user.id, "password_reset", "users", user.id, {});
  }

  return json({ ok: true, message: "Password reset successful. Please log in." });
}

// ════════════════════════════════════════════════════════════════
// ME (PROFILE)
// ════════════════════════════════════════════════════════════════
async function getMe(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  return json({ user: mapUser(auth.user) });
}

async function updateMe(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const firstName = String(body.firstName || body.first_name || auth.user.first_name).trim();
  const lastName  = String(body.lastName  || body.last_name  || auth.user.last_name || "").trim();
  const phone     = String(body.phone     || auth.user.phone || "").replace(/\D/g, "").slice(-10);

  await env.DB.prepare(
    "UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = ? WHERE id = ?"
  ).bind(firstName, lastName, phone, nowIso(), auth.user.id).run();

  return json({ ok: true, message: "Profile updated" });
}

async function changePassword(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const current  = String(body.currentPassword || "");
  const newPass  = String(body.newPassword || "");

  if (!current || !newPass) return json({ error: "currentPassword and newPassword required" }, 400);
  if (newPass.length < 8) return json({ error: "New password must be at least 8 characters" }, 400);

  if (!(await verifyPassword(current, auth.user.password_hash))) {
    return json({ error: "Current password is incorrect" }, 400);
  }

  const hash = await hashPassword(newPass);
  await env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .bind(hash, nowIso(), auth.user.id).run();

  await auditLog(env, auth.user.id, "password_change", "users", auth.user.id, {});
  return json({ ok: true, message: "Password changed successfully" });
}

// ════════════════════════════════════════════════════════════════
// ADDRESSES
// ════════════════════════════════════════════════════════════════
async function listAddresses(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const { results } = await env.DB.prepare(
    "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC"
  ).bind(auth.user.id).all();
  return json({ addresses: results || [] });
}

async function addAddress(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const name    = String(body.name         || "").trim();
  const phone   = String(body.phone        || "").trim();
  const line1   = String(body.addressLine1 || "").trim();
  const city    = String(body.city         || "").trim();
  const state   = String(body.state        || "").trim();
  const pincode = String(body.pincode      || "").trim();

  if (!name || !phone || !line1 || !city || !state || !pincode) {
    return json({ error: "name, phone, addressLine1, city, state, pincode are required" }, 400);
  }

  const isDefault = body.isDefault ? 1 : 0;
  if (isDefault) {
    await env.DB.prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").bind(auth.user.id).run();
  }

  const result = await env.DB.prepare(
    "INSERT INTO addresses (user_id, name, phone, address_line1, address_line2, city, state, pincode, country, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(auth.user.id, name, phone, line1, String(body.addressLine2 || ""), city, state, pincode, String(body.country || "India"), isDefault, nowIso()).run();

  return json({ ok: true, id: result.meta?.last_row_id }, 201);
}

async function updateAddress(request, path, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const id = toInt(path.split("/").pop(), 0);
  const existing = await env.DB.prepare("SELECT * FROM addresses WHERE id = ? AND user_id = ?").bind(id, auth.user.id).first();
  if (!existing) return json({ error: "Address not found" }, 404);

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const isDefault = body.isDefault ? 1 : 0;
  if (isDefault) {
    await env.DB.prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").bind(auth.user.id).run();
  }

  await env.DB.prepare(
    "UPDATE addresses SET name=?, phone=?, address_line1=?, address_line2=?, city=?, state=?, pincode=?, country=?, is_default=? WHERE id=?"
  ).bind(
    String(body.name || existing.name),
    String(body.phone || existing.phone),
    String(body.addressLine1 || existing.address_line1),
    String(body.addressLine2 || existing.address_line2 || ""),
    String(body.city || existing.city),
    String(body.state || existing.state),
    String(body.pincode || existing.pincode),
    String(body.country || existing.country || "India"),
    isDefault,
    id
  ).run();

  return json({ ok: true });
}

async function deleteAddress(request, path, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const id = toInt(path.split("/").pop(), 0);
  await env.DB.prepare("DELETE FROM addresses WHERE id = ? AND user_id = ?").bind(id, auth.user.id).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════
// WISHLIST
// ════════════════════════════════════════════════════════════════
async function getWishlist(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const { results } = await env.DB.prepare(
    `SELECT w.id, w.product_id, w.created_at,
            p.name, p.price, p.original_price, p.image_url, p.images_json, p.category, p.stock
     FROM wishlist w JOIN products p ON p.id = w.product_id
     WHERE w.user_id = ? ORDER BY w.id DESC`
  ).bind(auth.user.id).all();
  return json({ wishlist: (results || []).map(r => ({
    ...r,
    images: safeJsonParse(r.images_json, [])
  }))});
}

async function addWishlist(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const productId = toInt(body?.productId || body?.product_id, 0);
  if (!productId) return json({ error: "productId required" }, 400);
  try {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, ?)"
    ).bind(auth.user.id, productId, nowIso()).run();
  } catch {}
  return json({ ok: true });
}

async function removeWishlist(request, path, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const productId = toInt(path.split("/").pop(), 0);
  await env.DB.prepare("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?").bind(auth.user.id, productId).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════════
async function listProducts(url, env) {
  const category = url.searchParams.get("category") || "";
  const featured = url.searchParams.get("featured") || "";
  const isNew    = url.searchParams.get("is_new") || "";
  const trending = url.searchParams.get("trending") || "";
  const search   = url.searchParams.get("q") || url.searchParams.get("search") || "";
  const limit    = Math.min(toInt(url.searchParams.get("limit"), 50), 200);
  const offset   = toInt(url.searchParams.get("offset"), 0);

  let sql = "SELECT * FROM products WHERE active = 1";
  const binds = [];

  if (category) { sql += " AND LOWER(category) = LOWER(?)"; binds.push(category); }
  if (featured === "true") { sql += " AND featured = 1"; }
  if (isNew === "true") { sql += " AND is_new = 1"; }
  if (trending === "true") { sql += " AND is_trending = 1"; }
  if (search) { sql += " AND (LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))"; binds.push(`%${search}%`, `%${search}%`); }

  sql += " ORDER BY featured DESC, is_trending DESC, is_new DESC, id DESC LIMIT ? OFFSET ?";
  binds.push(limit, offset);

  const { results } = await env.DB.prepare(sql).bind(...binds).all();

  // Total count
  let countSql = "SELECT COUNT(*) as total FROM products WHERE active = 1";
  const countBinds = [];
  if (category) { countSql += " AND LOWER(category) = LOWER(?)"; countBinds.push(category); }
  if (search) { countSql += " AND (LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))"; countBinds.push(`%${search}%`, `%${search}%`); }
  const countRow = await env.DB.prepare(countSql).bind(...countBinds).first();

  return json({ products: (results || []).map(mapProduct), total: countRow?.total || 0, limit, offset });
}

async function getProduct(path, env) {
  const id = toInt(path.split("/").pop(), 0);
  if (!id) return json({ error: "Invalid product id" }, 400);
  const product = await env.DB.prepare("SELECT * FROM products WHERE id = ? AND active = 1").bind(id).first();
  if (!product) return json({ error: "Product not found" }, 404);

  // Get approved reviews
  const { results: reviews } = await env.DB.prepare(
    `SELECT r.*, u.first_name, u.last_name FROM product_reviews r
     JOIN users u ON u.id = r.user_id WHERE r.product_id = ? AND r.status = 'approved' ORDER BY r.id DESC LIMIT 10`
  ).bind(id).all();

  // Related products (same category)
  const { results: related } = await env.DB.prepare(
    "SELECT * FROM products WHERE category = ? AND id != ? AND active = 1 ORDER BY featured DESC LIMIT 4"
  ).bind(product.category, id).all();

  return json({
    product: mapProduct(product),
    reviews: reviews || [],
    related: (related || []).map(mapProduct)
  });
}

// ════════════════════════════════════════════════════════════════
// REVIEWS
// ════════════════════════════════════════════════════════════════
async function getProductReviews(path, env) {
  const productId = toInt(path.split("/")[3], 0);
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.rating, r.title, r.body, r.created_at, u.first_name
     FROM product_reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ? AND r.status = 'approved' ORDER BY r.id DESC LIMIT 20`
  ).bind(productId).all();
  return json({ reviews: results || [] });
}

async function addProductReview(request, path, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const productId = toInt(path.split("/")[3], 0);
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const rating = toInt(body.rating, 0);
  if (!rating || rating < 1 || rating > 5) return json({ error: "Rating must be 1-5" }, 400);

  // Check for duplicate review
  const existing = await env.DB.prepare(
    "SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ?"
  ).bind(productId, auth.user.id).first();
  if (existing) return json({ error: "You have already reviewed this product" }, 409);

  await env.DB.prepare(
    "INSERT INTO product_reviews (product_id, user_id, rating, title, body, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
  ).bind(productId, auth.user.id, rating, String(body.title || "").trim(), String(body.body || "").trim(), nowIso()).run();

  return json({ ok: true, message: "Review submitted. It will appear after moderation." }, 201);
}

// ════════════════════════════════════════════════════════════════
// COUPONS
// ════════════════════════════════════════════════════════════════
async function validateCoupon(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const code     = String(body.code || "").trim().toUpperCase();
  const subtotal = Number(body.subtotal || 0);

  if (!code) return json({ error: "Coupon code required" }, 400);

  const coupon = await env.DB.prepare(
    "SELECT * FROM coupons WHERE code = ? AND active = 1"
  ).bind(code).first();

  if (!coupon) return json({ error: "Invalid or expired coupon code" }, 404);
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return json({ error: "This coupon has expired" }, 400);
  }
  if (coupon.max_uses && (coupon.used_count || 0) >= coupon.max_uses) {
    return json({ error: "This coupon has reached its usage limit" }, 400);
  }
  if (subtotal < coupon.min_order) {
    return json({ error: `Minimum order amount of ₹${coupon.min_order} required for this coupon` }, 400);
  }

  let discount = coupon.type === "percent"
    ? Math.round(subtotal * (coupon.value / 100))
    : coupon.value;

  if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);

  return json({
    ok: true,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount: Math.round(discount),
    description: coupon.description
  });
}

// ════════════════════════════════════════════════════════════════
// ORDERS — Auth Required
// ════════════════════════════════════════════════════════════════
async function initiateOrder(request, env) {
  // Auth REQUIRED — no guest checkout
  const auth = await requireAuth(request, env);
  if (!auth.ok) return json({ error: "Please log in to place an order", code: "AUTH_REQUIRED" }, 401);

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  // Get Razorpay keys from settings
  const rzpKeyId     = await getSetting(env, "razorpay_key_id", env.RAZORPAY_KEY_ID || "");
  const rzpKeySecret = await getSetting(env, "razorpay_key_secret", env.RAZORPAY_KEY_SECRET || "");

  if (!rzpKeyId || !rzpKeySecret) {
    return json({ error: "Payment gateway not configured. Please contact admin." }, 503);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json({ error: "Order items required" }, 400);

  // Validate coupon if provided
  let discountAmount = 0;
  let couponCode = String(body.couponCode || "").trim().toUpperCase();
  if (couponCode) {
    const subtotal = items.reduce((s, i) => s + (Number(i.price || 0) * Math.max(1, i.qty || 1)), 0);
    const coupon = await env.DB.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").bind(couponCode).first();
    if (coupon && subtotal >= coupon.min_order) {
      let disc = coupon.type === "percent"
        ? Math.round(subtotal * (coupon.value / 100))
        : coupon.value;
      if (coupon.max_discount) disc = Math.min(disc, coupon.max_discount);
      discountAmount = disc;
    }
  }

  const created = await createOrderRecord(env, {
    userId: auth.user.id,
    customer: body.customer || {
      name: `${auth.user.first_name} ${auth.user.last_name || ""}`.trim(),
      email: auth.user.email,
      phone: auth.user.phone || body.phone || ""
    },
    items: body.items,
    deliveryMethod: body.deliveryMethod || "standard",
    notes: body.notes || "",
    paymentMethod: "RAZORPAY",
    paymentStatus: "initiated",
    orderStatus: "payment_pending",
    couponCode: couponCode || null,
    discountAmount
  });

  if (!created.ok) return json({ error: created.error }, 400);

  const amountPaise = Math.round(Number(created.order.total_amount) * 100);
  const basicAuth = btoa(`${rzpKeyId}:${rzpKeySecret}`);

  const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}`, "content-type": "application/json" },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: String(created.order.order_number),
      notes: { internal_order_id: String(created.order.id) }
    })
  });

  if (!rzpRes.ok) {
    const t = await rzpRes.text();
    return json({ error: "Payment gateway error. Please try again.", detail: t }, 502);
  }

  const rzpOrder = await rzpRes.json();
  await env.DB.prepare("UPDATE orders SET razorpay_order_id = ?, updated_at = ? WHERE id = ?")
    .bind(rzpOrder.id, nowIso(), created.order.id).run();

  // Update coupon usage
  if (couponCode) {
    await env.DB.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?").bind(couponCode).run();
  }

  await auditLog(env, auth.user.id, "order_initiated", "orders", created.order.id, { orderNumber: created.order.order_number });

  return json({
    ok: true,
    key: rzpKeyId,
    order: {
      id: created.order.id,
      orderNumber: created.order.order_number,
      amount: created.order.total_amount,
      discount: discountAmount
    },
    razorpayOrder: rzpOrder
  });
}

async function verifyRazorpayPayment(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const rzpKeySecret  = await getSetting(env, "razorpay_key_secret", env.RAZORPAY_KEY_SECRET || "");
  const localOrderId  = toInt(body.orderId, 0);
  const rzpOrderId    = String(body.razorpay_order_id || "").trim();
  const rzpPaymentId  = String(body.razorpay_payment_id || "").trim();
  const rzpSignature  = String(body.razorpay_signature || "").trim();

  if (!localOrderId || !rzpOrderId || !rzpPaymentId || !rzpSignature) {
    return json({ error: "orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature required" }, 400);
  }

  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(localOrderId).first();
  if (!order) return json({ error: "Order not found" }, 404);

  const expected = await hmacHex(rzpKeySecret, `${rzpOrderId}|${rzpPaymentId}`);
  if (expected !== rzpSignature) {
    await auditLog(null, null, "payment_signature_failed", "orders", localOrderId, { rzpOrderId });
    return json({ error: "Payment verification failed. Invalid signature." }, 400);
  }

  const paidAt = nowIso();
  await env.DB.prepare(
    `UPDATE orders SET payment_status='paid', order_status='confirmed',
     razorpay_order_id=?, razorpay_payment_id=?, razorpay_signature=?, paid_at=?, updated_at=? WHERE id=?`
  ).bind(rzpOrderId, rzpPaymentId, rzpSignature, paidAt, paidAt, localOrderId).run();

  await env.DB.prepare(
    "INSERT INTO payments (order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, raw_payload, created_at) VALUES (?, 'RAZORPAY', ?, ?, ?, 'INR', 'captured', ?, ?)"
  ).bind(localOrderId, rzpOrderId, rzpPaymentId, order.total_amount, JSON.stringify(body), paidAt).run();

  // Send order confirmation email
  const user = order.user_id ? await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(order.user_id).first() : null;
  if (user) {
    const siteName = await getSetting(env, "site_name", "HeelsUp");
    await sendOtpEmail(env, user.email, "", "login"); // reuse sendOtpEmail for order email - we'll use raw fetch
    // Order confirmation email
    const scriptUrl = await getSetting(env, "otp_script_url", "");
    if (scriptUrl) {
      fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: user.email,
          subject: `Order Confirmed! #${order.order_number} — ${siteName}`,
          message: `Your order #${order.order_number} has been confirmed!\n\nTotal: ₹${order.total_amount}\nPayment: Online (Razorpay)\n\nThank you for shopping with ${siteName}!`,
          html: buildOrderConfirmHtml(order, siteName)
        })
      }).catch(() => {});
    }
  }

  await auditLog(user?.id || null, null, "payment_confirmed", "orders", localOrderId, { rzpPaymentId });

  return json({ ok: true, orderId: localOrderId, orderNumber: order.order_number, paymentStatus: "paid" });
}

function buildOrderConfirmHtml(order, siteName) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:linear-gradient(135deg,#c9a96e,#8b6914);padding:24px;text-align:center">
<h1 style="color:#fff;margin:0">${siteName}</h1>
<p style="color:rgba(255,255,255,0.9);margin:4px 0 0">Order Confirmed ✅</p>
</div>
<div style="padding:32px">
<h2 style="color:#1a1a1a">Order #${order.order_number}</h2>
<p style="color:#555">Thank you for your order! We are preparing it for dispatch.</p>
<div style="background:#f8f4ee;border-radius:8px;padding:16px;margin:20px 0">
<p style="margin:0;color:#666"><strong>Total:</strong> ₹${Number(order.total_amount).toLocaleString('en-IN')}</p>
<p style="margin:8px 0 0;color:#666"><strong>Payment:</strong> Online ✓</p>
<p style="margin:8px 0 0;color:#666"><strong>Status:</strong> Confirmed</p>
</div>
<p style="color:#888;font-size:13px">You can track your order anytime from My Orders section.</p>
</div></div></body></html>`;
}

async function listMyOrders(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const { results: orders } = await env.DB.prepare(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 100"
  ).bind(auth.user.id).all();

  const data = [];
  for (const order of orders) {
    const { results: items } = await env.DB.prepare(
      "SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC"
    ).bind(order.id).all();

    // Return request if any
    const ret = await env.DB.prepare(
      "SELECT id, status, created_at FROM return_requests WHERE order_id = ? LIMIT 1"
    ).bind(order.id).first();

    data.push({
      id: order.id,
      orderNumber: order.order_number,
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      subtotalAmount: Number(order.subtotal_amount),
      shippingAmount: Number(order.shipping_amount),
      discountAmount: Number(order.discount_amount),
      totalAmount: Number(order.total_amount),
      couponCode: order.coupon_code,
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_url,
      createdAt: order.created_at,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      address: { line1: order.address_line1, line2: order.address_line2, city: order.city, state: order.state, pincode: order.pincode },
      returnRequest: ret || null,
      items: items.map(item => ({
        name: item.product_name,
        sku: item.product_sku,
        qty: item.quantity,
        price: Number(item.unit_price),
        lineTotal: Number(item.line_total),
        size: item.size_label,
        image: item.image_url
      }))
    });
  }
  return json({ orders: data });
}

async function submitReturn(request, path, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;

  const orderId = toInt(path.split("/")[3], 0);
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const reason = String(body.reason || "").trim();
  if (!reason) return json({ error: "Reason for return is required" }, 400);

  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").bind(orderId, auth.user.id).first();
  if (!order) return json({ error: "Order not found" }, 404);

  if (!["confirmed", "shipped", "delivered"].includes(order.order_status)) {
    return json({ error: "Return can only be requested for confirmed, shipped, or delivered orders" }, 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM return_requests WHERE order_id = ?").bind(orderId).first();
  if (existing) return json({ error: "A return request already exists for this order" }, 409);

  const now = nowIso();
  await env.DB.prepare(
    "INSERT INTO return_requests (order_id, user_id, reason, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)"
  ).bind(orderId, auth.user.id, reason, now, now).run();

  await auditLog(env, auth.user.id, "return_requested", "orders", orderId, { reason });
  return json({ ok: true, message: "Return request submitted. We will process it within 2-3 business days." }, 201);
}

// ════════════════════════════════════════════════════════════════
// NEWSLETTER & CONTACT
// ════════════════════════════════════════════════════════════════
async function createNewsletter(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Valid email required" }, 400);
  await env.DB.prepare("INSERT INTO newsletter_subscribers (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING")
    .bind(email, nowIso()).run();
  return json({ ok: true, message: "Subscribed!" });
}

async function createContact(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
  const message = String(body.message || "").trim();
  if (!name || !email || !message) return json({ error: "name, email and message required" }, 400);
  await env.DB.prepare(
    "INSERT INTO contact_messages (name, email, phone, order_ref, subject, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(name, email, String(body.phone || ""), String(body.order || ""), String(body.subject || "General"), message, nowIso()).run();
  return json({ ok: true, message: "Message received! We will get back to you within 24 hours." });
}

// ════════════════════════════════════════════════════════════════
// ADMIN — ALL ADMIN ROUTES
// ════════════════════════════════════════════════════════════════
async function handleAdmin(request, path, url, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  if ((auth.user.role || "").toLowerCase() !== "admin") {
    return json({ error: "Admin access required" }, 403);
  }

  const method = request.method;

  // ── DASHBOARD STATS ──
  if (method === "GET" && path === "/api/admin/stats") {
    const [totalProducts, totalOrders, totalRevenue, totalUsers, pendingOrders, totalReturns] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as c FROM products WHERE active=1").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM orders").first(),
      env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE payment_status='paid'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE role='customer'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM orders WHERE order_status='placed' OR order_status='payment_pending'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM return_requests WHERE status='pending'").first()
    ]);
    const { results: recentOrders } = await env.DB.prepare(
      "SELECT id, order_number, customer_name, order_status, payment_status, total_amount, created_at FROM orders ORDER BY id DESC LIMIT 10"
    ).all();
    // Today's revenue
    const today = new Date().toISOString().split("T")[0];
    const todayRev = await env.DB.prepare(
      "SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE payment_status='paid' AND created_at LIKE ?"
    ).bind(`${today}%`).first();
    // This month
    const monthStart = `${today.slice(0,7)}-01`;
    const monthRev = await env.DB.prepare(
      "SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE payment_status='paid' AND created_at >= ?"
    ).bind(monthStart).first();

    return json({
      totalProducts: totalProducts?.c || 0,
      totalOrders: totalOrders?.c || 0,
      totalRevenue: totalRevenue?.r || 0,
      totalUsers: totalUsers?.c || 0,
      pendingOrders: pendingOrders?.c || 0,
      pendingReturns: totalReturns?.c || 0,
      todayRevenue: todayRev?.r || 0,
      monthRevenue: monthRev?.r || 0,
      recentOrders: recentOrders || []
    });
  }

  // ── SETTINGS ──
  if (method === "GET" && path === "/api/admin/settings") {
    const { results } = await env.DB.prepare("SELECT key, value FROM settings ORDER BY key ASC").all();
    const settings = {};
    (results || []).forEach(r => { settings[r.key] = r.value; });
    // Mask secret key — show masked version
    if (settings.razorpay_key_secret && settings.razorpay_key_secret.length > 6) {
      settings.razorpay_key_secret = settings.razorpay_key_secret.slice(0,4) + '•'.repeat(12);
    }
    return json({ settings });
  }
  if (method === "PUT" && path === "/api/admin/settings") {
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    // Support both flat {key:val} and wrapped {settings:{key:val}}
    const updates = body.settings && typeof body.settings === "object" ? body.settings : body;
    const allowed = ["razorpay_key_id","razorpay_key_secret","razorpay_mode","otp_script_url","site_name","site_email","support_phone","shipping_free_above","shipping_standard_charge","require_email_otp","otp_expiry_minutes","max_login_attempts","lockout_duration_minutes","maintenance_mode"];
    const changed = [];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        // Don't overwrite secret if it's all masked dots
        const val = String(updates[key]);
        if (key === "razorpay_key_secret" && /^[•]+$/.test(val)) continue;
        await setSetting(env, key, val);
        changed.push(key);
      }
    }
    if (changed.length) await auditLog(env, auth.user.id, "settings_updated", "settings", null, { keys: changed });
    return json({ ok: true, updated: changed.length });
  }


  // ── PRODUCTS ──
  if (method === "GET" && path === "/api/admin/products") {
    const search = url.searchParams.get("q") || "";
    const cat = url.searchParams.get("category") || "";
    let sql = "SELECT * FROM products WHERE 1=1";
    const binds = [];
    if (search) { sql += " AND (LOWER(name) LIKE LOWER(?) OR sku LIKE ?)"; binds.push(`%${search}%`, `%${search}%`); }
    if (cat) { sql += " AND LOWER(category) = LOWER(?)"; binds.push(cat); }
    sql += " ORDER BY id DESC LIMIT 200";
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json({ products: (results || []).map(mapProduct), total: results?.length || 0 });
  }

  if (method === "POST" && path === "/api/admin/products") {
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    const result = await insertProduct(env, body);
    if (!result.ok) return json({ error: result.error }, 400);
    await auditLog(env, auth.user.id, "product_created", "products", result.id, { name: body.name });
    const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(result.id).first();
    return json(mapProduct(product), 201);
  }

  // Bulk product upload
  if (method === "POST" && path === "/api/admin/products/bulk") {
    const body = await readJson(request);
    if (!body || !Array.isArray(body.products)) return json({ error: "products array required" }, 400);
    const results = { success: 0, failed: 0, errors: [] };
    for (const p of body.products) {
      const r = await insertProduct(env, p);
      if (r.ok) results.success++;
      else { results.failed++; results.errors.push({ name: p.name, error: r.error }); }
    }
    await auditLog(env, auth.user.id, "bulk_product_upload", "products", null, results);
    return json({ ok: true, ...results });
  }

  if ((method === "PUT" || method === "DELETE") && /^\/api\/admin\/products\/(\d+)$/.test(path)) {
    const id = toInt(path.split("/").pop(), 0);
    if (!id) return json({ error: "Invalid product id" }, 400);
    if (method === "DELETE") {
      await env.DB.prepare("UPDATE products SET active = 0, updated_at = ? WHERE id = ?").bind(nowIso(), id).run();
      await auditLog(env, auth.user.id, "product_deleted", "products", id, {});
      return json({ ok: true });
    }
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    await updateProduct(env, id, body);
    await auditLog(env, auth.user.id, "product_updated", "products", id, { name: body.name });
    const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
    return json(mapProduct(product));
  }

  // ── ORDERS ──
  if (method === "GET" && path === "/api/admin/orders") {
    const status = url.searchParams.get("status") || "";
    const search = url.searchParams.get("q") || "";
    const dateFrom = url.searchParams.get("from") || "";
    const dateTo = url.searchParams.get("to") || "";
    const limit = Math.min(toInt(url.searchParams.get("limit"), 50), 200);
    const offset = toInt(url.searchParams.get("offset"), 0);

    let sql = "SELECT * FROM orders WHERE 1=1";
    const binds = [];
    if (status) { sql += " AND order_status = ?"; binds.push(status); }
    if (search) { sql += " AND (customer_name LIKE ? OR customer_email LIKE ? OR order_number LIKE ?)"; binds.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (dateFrom) { sql += " AND created_at >= ?"; binds.push(dateFrom); }
    if (dateTo) { sql += " AND created_at <= ?"; binds.push(`${dateTo}T23:59:59Z`); }
    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    binds.push(limit, offset);
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    const count = await env.DB.prepare("SELECT COUNT(*) as c FROM orders WHERE 1=1" + (status ? ` AND order_status='${status}'` : "")).first();
    return json({ orders: results || [], total: count?.c || 0 });
  }

  if (method === "GET" && /^\/api\/admin\/orders\/(\d+)$/.test(path)) {
    const id = toInt(path.split("/").pop(), 0);
    const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
    if (!order) return json({ error: "Order not found" }, 404);
    const { results: items } = await env.DB.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id").bind(id).all();
    const ret = await env.DB.prepare("SELECT * FROM return_requests WHERE order_id = ? LIMIT 1").bind(id).first();
    return json({ order, items: items || [], returnRequest: ret || null });
  }

  if (method === "PUT" && /^\/api\/admin\/orders\/(\d+)\/status$/.test(path)) {
    const id = toInt(path.split("/")[4], 0);
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    const status = String(body.status || "").trim();
    const validStatuses = ["placed","confirmed","processing","packed","shipped","out_for_delivery","delivered","cancelled","returned"];
    if (!validStatuses.includes(status)) return json({ error: "Invalid status" }, 400);
    const updateFields = ["order_status = ?", "updated_at = ?"];
    const binds = [status, nowIso()];
    if (body.trackingNumber) { updateFields.push("tracking_number = ?"); binds.push(body.trackingNumber); }
    if (body.trackingUrl) { updateFields.push("tracking_url = ?"); binds.push(body.trackingUrl); }
    if (status === "cancelled") { updateFields.push("cancelled_at = ?"); binds.push(nowIso()); }
    binds.push(id);
    await env.DB.prepare(`UPDATE orders SET ${updateFields.join(", ")} WHERE id = ?`).bind(...binds).run();
    await auditLog(env, auth.user.id, "order_status_updated", "orders", id, { status, trackingNumber: body.trackingNumber });
    return json({ ok: true });
  }

  // ── CUSTOMERS ──
  if (method === "GET" && path === "/api/admin/customers") {
    const search = url.searchParams.get("q") || "";
    let sql = "SELECT id, first_name, last_name, email, phone, role, email_verified, created_at FROM users WHERE 1=1";
    const binds = [];
    if (search) { sql += " AND (email LIKE ? OR first_name LIKE ? OR phone LIKE ?)"; binds.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += " ORDER BY id DESC LIMIT 200";
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json({ customers: results || [] });
  }

  if (method === "PUT" && /^\/api\/admin\/customers\/(\d+)\/role$/.test(path)) {
    const id = toInt(path.split("/")[4], 0);
    const body = await readJson(request);
    const role = String(body?.role || "").trim();
    if (!["customer", "admin"].includes(role)) return json({ error: "Invalid role" }, 400);
    await env.DB.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").bind(role, nowIso(), id).run();
    await auditLog(env, auth.user.id, "user_role_changed", "users", id, { role });
    return json({ ok: true });
  }

  // ── COUPONS ──
  if (method === "GET" && path === "/api/admin/coupons") {
    const { results } = await env.DB.prepare("SELECT * FROM coupons ORDER BY id DESC").all();
    return json({ coupons: results || [] });
  }
  if (method === "POST" && path === "/api/admin/coupons") {
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) return json({ error: "Coupon code required" }, 400);
    const result = await env.DB.prepare(
      "INSERT INTO coupons (code, type, value, min_order, max_discount, max_uses, active, description, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(code, String(body.type || "percent"), Number(body.value || 0), Number(body.min_order || 0), body.max_discount || null, body.max_uses || null, body.active !== false ? 1 : 0, String(body.description || ""), body.expires_at || null, nowIso()).run();
    return json({ ok: true, id: result.meta?.last_row_id }, 201);
  }
  if (method === "PUT" && /^\/api\/admin\/coupons\/(\d+)$/.test(path)) {
    const id = toInt(path.split("/").pop(), 0);
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    await env.DB.prepare(
      "UPDATE coupons SET code=?, type=?, value=?, min_order=?, max_discount=?, max_uses=?, active=?, description=?, expires_at=? WHERE id=?"
    ).bind(String(body.code || ""), String(body.type || "percent"), Number(body.value || 0), Number(body.min_order || 0), body.max_discount || null, body.max_uses || null, body.active !== false ? 1 : 0, String(body.description || ""), body.expires_at || null, id).run();
    return json({ ok: true });
  }
  if (method === "DELETE" && /^\/api\/admin\/coupons\/(\d+)$/.test(path)) {
    const id = toInt(path.split("/").pop(), 0);
    await env.DB.prepare("UPDATE coupons SET active = 0 WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  // ── OFFLINE SALES ──
  if (method === "GET" && path === "/api/admin/offline-sales") {
    const dateFrom = url.searchParams.get("from") || "";
    let sql = "SELECT * FROM offline_sales WHERE 1=1";
    const binds = [];
    if (dateFrom) { sql += " AND created_at >= ?"; binds.push(dateFrom); }
    sql += " ORDER BY id DESC LIMIT 200";
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json({ sales: (results || []).map(s => ({ ...s, items: safeJsonParse(s.items_json, []) })) });
  }
  if (method === "POST" && path === "/api/admin/offline-sales") {
    const body = await readJson(request);
    if (!body || !Array.isArray(body.items) || !body.items.length) return json({ error: "items required" }, 400);
    const saleNumber = `OFF-${Date.now()}`;
    const subtotal = Number(body.subtotal || body.items.reduce((s, i) => s + (i.price * i.qty), 0));
    const discount = Number(body.discount || 0);
    const total = subtotal - discount;
    await env.DB.prepare(
      "INSERT INTO offline_sales (sale_number, customer_name, customer_phone, items_json, subtotal, discount, total, payment_method, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(saleNumber, String(body.customer_name || "Walk-in"), String(body.customer_phone || ""), JSON.stringify(body.items), subtotal, discount, total, String(body.payment_method || "Cash"), String(body.notes || ""), auth.user.id, nowIso()).run();

    // Reduce stock for sold items
    for (const item of body.items) {
      if (item.product_id) {
        await env.DB.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?").bind(item.qty || 1, item.product_id).run();
      }
    }
    await auditLog(env, auth.user.id, "offline_sale", "offline_sales", saleNumber, { total });
    return json({ ok: true, saleNumber, total }, 201);
  }

  // ── REVIEWS MODERATION ──
  if (method === "GET" && path === "/api/admin/reviews") {
    const status = url.searchParams.get("status") || "pending";
    const { results } = await env.DB.prepare(
      `SELECT r.*, u.first_name, u.last_name, p.name as product_name
       FROM product_reviews r JOIN users u ON u.id = r.user_id JOIN products p ON p.id = r.product_id
       WHERE r.status = ? ORDER BY r.id DESC LIMIT 100`
    ).bind(status).all();
    return json({ reviews: results || [] });
  }
  if (method === "PUT" && /^\/api\/admin\/reviews\/(\d+)$/.test(path)) {
    const id = toInt(path.split("/").pop(), 0);
    const body = await readJson(request);
    const status = String(body?.status || "").trim();
    if (!["approved", "rejected"].includes(status)) return json({ error: "status must be approved or rejected" }, 400);
    await env.DB.prepare("UPDATE product_reviews SET status = ? WHERE id = ?").bind(status, id).run();
    await auditLog(env, auth.user.id, `review_${status}`, "product_reviews", id, {});
    return json({ ok: true });
  }

  // ── RETURNS ──
  if (method === "GET" && path === "/api/admin/returns") {
    const { results } = await env.DB.prepare(
      `SELECT r.*, o.order_number, u.first_name, u.last_name, u.email
       FROM return_requests r JOIN orders o ON o.id = r.order_id JOIN users u ON u.id = r.user_id
       ORDER BY r.id DESC LIMIT 100`
    ).all();
    return json({ returns: results || [] });
  }
  if (method === "PUT" && /^\/api\/admin\/returns\/(\d+)$/.test(path)) {
    const id = toInt(path.split("/").pop(), 0);
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    const status = String(body.status || "").trim();
    const validStatuses = ["pending","approved","rejected","completed"];
    if (!validStatuses.includes(status)) return json({ error: "Invalid status" }, 400);
    await env.DB.prepare(
      "UPDATE return_requests SET status=?, refund_amount=?, admin_notes=?, updated_at=? WHERE id=?"
    ).bind(status, body.refund_amount || null, String(body.admin_notes || ""), nowIso(), id).run();
    await auditLog(env, auth.user.id, `return_${status}`, "return_requests", id, {});
    return json({ ok: true });
  }

  // ── NEWSLETTER SUBSCRIBERS ──
  if (method === "GET" && path === "/api/admin/newsletter") {
    const { results } = await env.DB.prepare("SELECT * FROM newsletter_subscribers ORDER BY id DESC LIMIT 1000").all();
    return json({ subscribers: results || [], total: results?.length || 0 });
  }

  // ── CONTACT MESSAGES ──
  if (method === "GET" && path === "/api/admin/contacts") {
    const { results } = await env.DB.prepare("SELECT * FROM contact_messages ORDER BY id DESC LIMIT 200").all();
    return json({ messages: results || [] });
  }

  // ── REPORTS ──
  if (method === "GET" && path === "/api/admin/reports/sales") {
    const dateFrom = url.searchParams.get("from") || new Date(Date.now() - 30*24*60*60*1000).toISOString().split("T")[0];
    const dateTo   = url.searchParams.get("to")   || new Date().toISOString().split("T")[0];
    const groupBy  = url.searchParams.get("group") || "day"; // day | month

    const format = groupBy === "month" ? "strftime('%Y-%m', created_at)" : "strftime('%Y-%m-%d', created_at)";

    const { results: salesByDate } = await env.DB.prepare(
      `SELECT ${format} as date, COUNT(*) as orders, SUM(total_amount) as revenue, SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END) as paid_revenue
       FROM orders WHERE created_at >= ? AND created_at <= ? GROUP BY date ORDER BY date ASC`
    ).bind(dateFrom, `${dateTo}T23:59:59Z`).all();

    const { results: topProducts } = await env.DB.prepare(
      `SELECT oi.product_name, oi.product_id, SUM(oi.quantity) as total_sold, SUM(oi.line_total) as revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= ? AND o.payment_status = 'paid'
       GROUP BY oi.product_id, oi.product_name ORDER BY total_sold DESC LIMIT 10`
    ).bind(dateFrom).all();

    const { results: topCategories } = await env.DB.prepare(
      `SELECT p.category, SUM(oi.quantity) as total_sold, SUM(oi.line_total) as revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
       WHERE o.created_at >= ? AND o.payment_status = 'paid'
       GROUP BY p.category ORDER BY revenue DESC`
    ).bind(dateFrom).all();

    const summary = await env.DB.prepare(
      `SELECT COUNT(*) as total_orders, SUM(total_amount) as total_revenue, AVG(total_amount) as avg_order_value,
              SUM(CASE WHEN payment_status='paid' THEN 1 ELSE 0 END) as paid_orders
       FROM orders WHERE created_at >= ? AND created_at <= ?`
    ).bind(dateFrom, `${dateTo}T23:59:59Z`).first();

    return json({ salesByDate: salesByDate || [], topProducts: topProducts || [], topCategories: topCategories || [], summary });
  }

  if (method === "GET" && path === "/api/admin/reports/inventory") {
    const { results: lowStock } = await env.DB.prepare("SELECT id, name, sku, category, stock FROM products WHERE active=1 AND stock <= 10 ORDER BY stock ASC LIMIT 50").all();
    const { results: outOfStock } = await env.DB.prepare("SELECT id, name, sku, category FROM products WHERE active=1 AND stock = 0").all();
    return json({ lowStock: lowStock || [], outOfStock: outOfStock || [] });
  }

  // ── AUDIT LOG ──
  if (method === "GET" && path === "/api/admin/audit-log") {
    const { results } = await env.DB.prepare(
      "SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200"
    ).all();
    return json({ logs: results || [] });
  }

  // ── BANNERS ──
  if (method === "GET" && path === "/api/admin/banners") {
    const { results } = await env.DB.prepare("SELECT * FROM banners ORDER BY sort_order ASC, id DESC").all();
    return json({ banners: results || [] });
  }
  if (method === "POST" && path === "/api/admin/banners") {
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    const result = await env.DB.prepare(
      "INSERT INTO banners (title, subtitle, image_url, link, active, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(String(body.title || ""), String(body.subtitle || ""), String(body.image_url || ""), String(body.link || ""), body.active !== false ? 1 : 0, toInt(body.sort_order, 0), nowIso()).run();
    return json({ ok: true, id: result.meta?.last_row_id }, 201);
  }
  if (method === "DELETE" && /^\/api\/admin\/banners\/(\d+)$/.test(path)) {
    const id = toInt(path.split("/").pop(), 0);
    await env.DB.prepare("DELETE FROM banners WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  // ── SETTINGS ──
  if (method === "GET" && path === "/api/admin/settings") {
    const { results } = await env.DB.prepare("SELECT key, value FROM settings ORDER BY key ASC").all();
    const settings = {};
    (results || []).forEach(r => { settings[r.key] = r.value; });
    // Mask the secret
    if (settings.razorpay_key_secret) settings.razorpay_key_secret = settings.razorpay_key_secret.replace(/./g, '•').slice(0, 20);
    return json({ settings });
  }
  if (method === "PUT" && path === "/api/admin/settings") {
    const body = await readJson(request);
    if (!body || !body.settings || typeof body.settings !== "object") return json({ error: "settings object required" }, 400);
    const allowed = [
      "razorpay_key_id","razorpay_key_secret","razorpay_mode",
      "otp_script_url","otp_expiry_minutes","require_email_otp",
      "shipping_free_above","shipping_standard_charge",
      "site_name","site_email","support_phone",
      "max_login_attempts","lockout_duration_minutes",
      "maintenance_mode"
    ];
    const entries = Object.entries(body.settings).filter(([k]) => allowed.includes(k));
    if (!entries.length) return json({ error: "No valid settings provided" }, 400);
    // Don't overwrite secret if it's masked (all bullets)
    const filtered = entries.filter(([k, v]) => {
      if (k === "razorpay_key_secret" && /^•+$/.test(String(v))) return false;
      return true;
    });
    for (const [k, v] of filtered) {
      await setSetting(env, k, String(v));
    }
    await auditLog(env, auth.user.id, "settings_updated", "settings", null, { keys: filtered.map(([k])=>k) });
    return json({ ok: true, updated: filtered.length });
  }
  // Masked GET for frontend (returns real key if unmasked read needed)
  if (method === "GET" && path === "/api/admin/settings/razorpay-key") {
    const key = await getSetting(env, "razorpay_key_id", "");
    const secret = await getSetting(env, "razorpay_key_secret", "");
    return json({ key_id: key, key_secret_masked: secret.slice(0,6)+'•'.repeat(Math.max(0,secret.length-6)) });
  }

  // ── CLEAR SESSIONS ──
  if (method === "POST" && path === "/api/admin/clear-sessions") {
    await env.DB.prepare("DELETE FROM sessions").run();
    await auditLog(env, auth.user.id, "sessions_cleared", "sessions", null, {});
    return json({ ok: true, message: "All sessions cleared" });
  }

  // ── CLEAR LOGIN LOCKS ──
  if (method === "POST" && path === "/api/admin/clear-locks") {
    await env.DB.prepare("DELETE FROM rate_limits WHERE type='login'").run();
    return json({ ok: true, message: "All login locks cleared" });
  }

  // ── TEST OTP ──
  if (method === "POST" && path === "/api/admin/test-otp") {
    const body = await readJson(request);
    const email = String(body?.email || auth.user?.email || "").trim();
    if (!email) return json({ error: "Email required" }, 400);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const scriptUrl = await getSetting(env, "otp_script_url", env.GOOGLE_APPSCRIPT_ENDPOINT || "");
    if (!scriptUrl) return json({ error: "OTP script URL not configured in Settings" }, 400);
    try {
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, subject: "HeelsUp - Test OTP", otp: otpCode, name: "Admin" })
      });
      return json({ ok: true, message: `Test OTP ${otpCode} sent to ${email}` });
    } catch (e) {
      return json({ error: "Failed to send OTP: " + e.message }, 500);
    }
  }


  // ── R2 IMAGE UPLOAD ──────────────────────────────────────────────
  if (method === "POST" && path === "/api/admin/upload") {
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") return json({ error: "No file uploaded" }, 400);
      const ext = (file.name || "").split(".").pop().toLowerCase();
      const allowed = ["jpg","jpeg","png","webp","gif","avif"];
      if (!allowed.includes(ext)) return json({ error: "Invalid file type. Use jpg/png/webp." }, 400);
      if (file.size > 5 * 1024 * 1024) return json({ error: "Max 5MB per image" }, 400);
      const key = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = await file.arrayBuffer();
      await env.MEDIA.put(key, buffer, { httpMetadata: { contentType: file.type || `image/${ext}` } });
      const r2BaseUrl = env.R2_PUBLIC_URL || "https://media.heelsup.in";
      const publicUrl = `${r2BaseUrl}/${key}`;
      return json({ ok: true, url: publicUrl, key });
    } catch(e) { return json({ error: "Upload failed: " + e.message }, 500); }
  }
  if (method === "DELETE" && /^\/api\/admin\/upload\/(.+)$/.test(path)) {
    const key = path.replace("/api/admin/upload/", "");
    try { await env.MEDIA.delete(key); return json({ ok: true }); }
    catch(e) { return json({ error: e.message }, 500); }
  }

  // ── PRODUCT IMAGES (multi-image) ─────────────────────────────────
  if (method === "GET" && /^\/api\/admin\/products\/(\d+)\/images$/.test(path)) {
    const pId = toInt(path.split("/")[4], 0);
    const { results } = await env.DB.prepare("SELECT * FROM product_images WHERE product_id=? ORDER BY sort_order ASC, id ASC").bind(pId).all();
    return json({ images: results || [] });
  }
  if (method === "POST" && /^\/api\/admin\/products\/(\d+)\/images$/.test(path)) {
    const pId = toInt(path.split("/")[4], 0);
    const body = await readJson(request);
    if (!body?.url) return json({ error: "url required" }, 400);
    const result = await env.DB.prepare("INSERT INTO product_images (product_id, url, sort_order, alt, created_at) VALUES (?,?,?,?,?)").bind(pId, String(body.url), Number(body.sort_order||0), String(body.alt||""), nowIso()).run();
    // Also update main image_url if this is first image
    const cnt = await env.DB.prepare("SELECT COUNT(*) as c FROM product_images WHERE product_id=?").bind(pId).first();
    if ((cnt?.c||0) === 1) await env.DB.prepare("UPDATE products SET image_url=? WHERE id=?").bind(String(body.url), pId).run();
    return json({ ok: true, id: result.meta?.last_row_id }, 201);
  }
  if (method === "DELETE" && /^\/api\/admin\/products\/\d+\/images\/\d+$/.test(path)) {
    const parts = path.split("/");
    const imgId = toInt(parts[6], 0);
    await env.DB.prepare("DELETE FROM product_images WHERE id=?").bind(imgId).run();
    return json({ ok: true });
  }
  if (method === "PUT" && /^\/api\/admin\/products\/\d+\/images\/reorder$/.test(path)) {
    const body = await readJson(request);
    if (!Array.isArray(body?.order)) return json({ error: "order array required" }, 400);
    for (let i = 0; i < body.order.length; i++) {
      await env.DB.prepare("UPDATE product_images SET sort_order=? WHERE id=?").bind(i, body.order[i]).run();
    }
    return json({ ok: true });
  }

  // ── BULK PRODUCT IMPORT ──────────────────────────────────────────
  if (method === "POST" && path === "/api/admin/products/bulk") {
    const body = await readJson(request);
    if (!body || !Array.isArray(body.products)) return json({ error: "products array required" }, 400);
    const products = body.products.slice(0, 500); // max 500 at a time
    let success = 0, failed = 0;
    const errors = [];
    for (const p of products) {
      const r = await insertProduct(env, p);
      if (r.ok) { success++; }
      else { failed++; errors.push({ name: p.name || "unknown", error: r.error }); }
    }
    await env.DB.prepare("INSERT INTO import_logs (admin_id, filename, total, success, failed, errors_json, created_at) VALUES (?,?,?,?,?,?,?)").bind(auth.user.id, String(body.filename||"bulk"), products.length, success, failed, JSON.stringify(errors.slice(0,50)), nowIso()).run();
    await auditLog(env, auth.user.id, "bulk_import", "products", null, { total: products.length, success, failed });
    return json({ ok: true, total: products.length, success, failed, errors: errors.slice(0,20) }, 201);
  }

  // ── IMPORT LOGS ──────────────────────────────────────────────────
  if (method === "GET" && path === "/api/admin/import-logs") {
    const { results } = await env.DB.prepare("SELECT * FROM import_logs ORDER BY id DESC LIMIT 50").all();
    return json({ logs: results || [] });
  }

  // ── STAFF MANAGEMENT ─────────────────────────────────────────────
  if (method === "GET" && path === "/api/admin/staff") {
    const { results } = await env.DB.prepare(
      "SELECT id, first_name, last_name, email, phone, role, staff_permissions, created_at FROM users WHERE role IN ('admin','staff') ORDER BY id DESC"
    ).all();
    return json({ staff: results || [] });
  }
  if (method === "POST" && path === "/api/admin/staff") {
    const body = await readJson(request);
    if (!body?.email || !body?.first_name) return json({ error: "email and first_name required" }, 400);
    const email = normalizeEmail(body.email);
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if (existing) {
      // Update existing user to staff
      await env.DB.prepare("UPDATE users SET role='staff', staff_permissions=? WHERE id=?").bind(JSON.stringify(body.permissions||[]), existing.id).run();
      await auditLog(env, auth.user.id, "staff_created", "users", existing.id, { email });
      return json({ ok: true, id: existing.id, message: "User upgraded to staff" });
    }
    // Create new staff account with random temp password
    const tempPass = Math.random().toString(36).slice(-8).toUpperCase();
    const bcrypt = await hashPassword(tempPass);
    const result = await env.DB.prepare(
      "INSERT INTO users (first_name, last_name, email, phone, password_hash, role, staff_permissions, email_verified, created_at, updated_at) VALUES (?,?,?,?,?,'staff',?,1,?,?)"
    ).bind(String(body.first_name), String(body.last_name||""), email, String(body.phone||""), bcrypt, JSON.stringify(body.permissions||[]), nowIso(), nowIso()).run();
    await auditLog(env, auth.user.id, "staff_created", "users", result.meta?.last_row_id, { email });
    return json({ ok: true, id: result.meta?.last_row_id, temp_password: tempPass, message: "Staff account created. Share the temp password." }, 201);
  }
  if (method === "PUT" && /^\/api\/admin\/staff\/(\d+)$/.test(path)) {
    const id = toInt(path.split("/").pop(), 0);
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    if (body.permissions !== undefined) {
      await env.DB.prepare("UPDATE users SET staff_permissions=? WHERE id=?").bind(JSON.stringify(body.permissions), id).run();
    }
    if (body.role) {
      await env.DB.prepare("UPDATE users SET role=? WHERE id=?").bind(body.role, id).run();
    }
    await auditLog(env, auth.user.id, "staff_updated", "users", id, {});
    return json({ ok: true });
  }
  if (method === "DELETE" && /^\/api\/admin\/staff\/(\d+)$/.test(path)) {
    const id = toInt(path.split("/").pop(), 0);
    await env.DB.prepare("UPDATE users SET role='customer', staff_permissions='[]' WHERE id=?").bind(id).run();
    await auditLog(env, auth.user.id, "staff_removed", "users", id, {});
    return json({ ok: true });
  }

  // ── STAFF ROLES ──────────────────────────────────────────────────
  if (method === "GET" && path === "/api/admin/staff-roles") {
    const { results } = await env.DB.prepare("SELECT * FROM staff_roles ORDER BY id ASC").all();
    return json({ roles: results || [] });
  }

  // ── ENHANCED DASHBOARD ───────────────────────────────────────────
  if (method === "GET" && path === "/api/admin/dashboard") {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = `${today.slice(0,7)}-01`;
    const yesterday = new Date(Date.now()-86400000).toISOString().split("T")[0];
    const lastMonthStart = new Date(new Date(monthStart).getTime()-86400000*2).toISOString().slice(0,7)+"-01";

    const [totalProducts,totalOrders,totalRevenue,totalCustomers,pendingOrders,pendingReturns,todayRev,monthRev,yesterdayRev,lastMonthRev,totalReviews] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as c FROM products WHERE active=1").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM orders").first(),
      env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE payment_status='paid'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE role='customer'").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM orders WHERE order_status IN ('placed','confirmed')").first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM return_requests WHERE status='pending'").first(),
      env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE payment_status='paid' AND date(created_at)=?").bind(today).first(),
      env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as r, COUNT(*) as c FROM orders WHERE payment_status='paid' AND created_at>=?").bind(monthStart).first(),
      env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE payment_status='paid' AND date(created_at)=?").bind(yesterday).first(),
      env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE payment_status='paid' AND created_at>=?").bind(lastMonthStart).first(),
      env.DB.prepare("SELECT COUNT(*) as c FROM product_reviews WHERE status='pending'").first()
    ]);

    const { results: recentOrders } = await env.DB.prepare(
      "SELECT id, order_number, customer_name, customer_email, order_status, payment_status, total_amount, created_at FROM orders ORDER BY id DESC LIMIT 8"
    ).all();
    const { results: lowStock } = await env.DB.prepare(
      "SELECT id, name, category, stock, image_url FROM products WHERE active=1 AND stock<=5 ORDER BY stock ASC LIMIT 8"
    ).all();
    const { results: topProducts } = await env.DB.prepare(
      `SELECT p.id, p.name, p.category, p.image_url, SUM(oi.quantity) as total_sold, SUM(oi.line_total) as revenue
       FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id
       WHERE o.payment_status='paid' AND o.created_at>=?
       GROUP BY p.id ORDER BY total_sold DESC LIMIT 5`
    ).bind(monthStart).all();
    const { results: salesTrend } = await env.DB.prepare(
      `SELECT date(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total_amount),0) as revenue
       FROM orders WHERE payment_status='paid' AND created_at>=?
       GROUP BY date(created_at) ORDER BY date ASC`
    ).bind(new Date(Date.now()-30*86400000).toISOString().split("T")[0]).all();

    return json({
      totalProducts: totalProducts?.c||0,
      totalOrders: totalOrders?.c||0,
      totalRevenue: totalRevenue?.r||0,
      totalCustomers: totalCustomers?.c||0,
      pendingOrders: pendingOrders?.c||0,
      pendingReturns: pendingReturns?.c||0,
      pendingReviews: totalReviews?.c||0,
      todayRevenue: todayRev?.r||0,
      yesterdayRevenue: yesterdayRev?.r||0,
      monthRevenue: monthRev?.r||0,
      monthOrders: monthRev?.c||0,
      lastMonthRevenue: lastMonthRev?.r||0,
      recentOrders: recentOrders||[],
      lowStock: lowStock||[],
      topProducts: topProducts||[],
      salesTrend: salesTrend||[]
    });
  }

  // ── ENHANCED REPORTS ─────────────────────────────────────────────
  if (method === "GET" && path === "/api/admin/reports/customers") {
    const days = parseInt(url.searchParams.get("days")||"30");
    const since = new Date(Date.now()-days*86400000).toISOString().split("T")[0];
    const [newCustomers, returning, topBuyers] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE role='customer' AND date(created_at)>=?").bind(since).first(),
      env.DB.prepare("SELECT COUNT(DISTINCT user_id) as c FROM orders WHERE user_id IS NOT NULL AND created_at>=? AND payment_status='paid'").bind(since).first(),
      env.DB.prepare(`SELECT u.first_name, u.last_name, u.email, COUNT(o.id) as orders, COALESCE(SUM(o.total_amount),0) as spent FROM orders o JOIN users u ON u.id=o.user_id WHERE o.payment_status='paid' GROUP BY o.user_id ORDER BY spent DESC LIMIT 10`).all()
    ]);
    return json({ newCustomers: newCustomers?.c||0, returningCustomers: returning?.c||0, topBuyers: topBuyers.results||[] });
  }

  if (method === "GET" && path === "/api/admin/reports/coupons") {
    const { results } = await env.DB.prepare(`
      SELECT c.code, c.type, c.value, COUNT(o.id) as used_count, COALESCE(SUM(o.discount_amount),0) as total_discount
      FROM coupons c LEFT JOIN orders o ON o.coupon_code=c.code AND o.payment_status='paid'
      GROUP BY c.id ORDER BY used_count DESC
    `).all();
    return json({ coupons: results||[] });
  }

  return json({ error: "Admin route not found" }, 404);
}



// ════════════════════════════════════════════════════════════════
// PRODUCT INSERT / UPDATE HELPERS
// ════════════════════════════════════════════════════════════════
async function insertProduct(env, body) {
  const name = String(body.name || "").trim();
  const price = Number(body.price || 0);
  if (!name || price <= 0) return { ok: false, error: "name and valid price are required" };
  const now = nowIso();
  try {
    const result = await env.DB.prepare(
      `INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending,
       rating, review_count, description, sizes_json, images_json, image_url, brand, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      name, String(body.sku || "").trim(), String(body.category || "Heels").trim(),
      price, body.mrp == null ? null : Number(body.mrp), toInt(body.stock, 0),
      body.active === false ? 0 : 1, body.featured ? 1 : 0, body.is_new ? 1 : 0, body.is_trending ? 1 : 0,
      Number(body.rating || 4.5), toInt(body.review_count, 0),
      String(body.description || "").trim(),
      JSON.stringify(Array.isArray(body.sizes) ? body.sizes : []),
      JSON.stringify(Array.isArray(body.images) ? body.images : [body.image_url].filter(Boolean)),
      String(body.image_url || "").trim(),
      String(body.brand || "").trim(), String(body.tags || "").trim(),
      now, now
    ).run();
    return { ok: true, id: result.meta?.last_row_id };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function updateProduct(env, id, body) {
  await env.DB.prepare(
    `UPDATE products SET name=?, sku=?, category=?, price=?, original_price=?, stock=?, active=?, featured=?, is_new=?, is_trending=?,
     rating=?, review_count=?, description=?, sizes_json=?, images_json=?, image_url=?, brand=?, tags=?, updated_at=? WHERE id=?`
  ).bind(
    String(body.name || "").trim(), String(body.sku || "").trim(), String(body.category || "Heels").trim(),
    Number(body.price || 0), body.mrp == null ? null : Number(body.mrp), toInt(body.stock, 0),
    body.active === false ? 0 : 1, body.featured ? 1 : 0, body.is_new ? 1 : 0, body.is_trending ? 1 : 0,
    Number(body.rating || 4.5), toInt(body.review_count, 0),
    String(body.description || "").trim(),
    JSON.stringify(Array.isArray(body.sizes) ? body.sizes : []),
    JSON.stringify(Array.isArray(body.images) ? body.images : [body.image_url].filter(Boolean)),
    String(body.image_url || "").trim(),
    String(body.brand || "").trim(), String(body.tags || "").trim(),
    nowIso(), id
  ).run();
}

// ════════════════════════════════════════════════════════════════
// CREATE ORDER RECORD
// ════════════════════════════════════════════════════════════════
async function createOrderRecord(env, input) {
  const customer = input.customer || {};
  const itemsRaw = Array.isArray(input.items) ? input.items : [];
  if (!itemsRaw.length) return { ok: false, error: "Order items are required" };

  const customerName  = String(customer.name  || "").trim();
  const customerEmail = normalizeEmail(customer.email);
  const customerPhone = String(customer.phone || "").trim();
  const addressLine1  = String(customer.addressLine1 || customer.address_line1 || "").trim();
  const addressLine2  = String(customer.addressLine2 || customer.address_line2 || "").trim();
  const city          = String(customer.city    || "").trim();
  const state         = String(customer.state   || "").trim();
  const pincode       = String(customer.pincode || "").trim();
  const country       = String(customer.country || "India").trim();

  if (!customerName || !customerEmail || !customerPhone || !addressLine1 || !city || !state || !pincode) {
    return { ok: false, error: "Incomplete customer details" };
  }

  const items = [];
  for (const item of itemsRaw) {
    const qty = Math.max(1, toInt(item.qty, 1));
    const unitPrice = Number(item.price || 0);
    if (!item.name || unitPrice <= 0) continue;
    items.push({
      productId: item.productId ? toInt(item.productId, 0) : null,
      name: String(item.name),
      sku: String(item.sku || ""),
      qty, unitPrice,
      lineTotal: Number((unitPrice * qty).toFixed(2)),
      size: String(item.size || ""),
      image: String(item.image || item.img || "")
    });
  }
  if (!items.length) return { ok: false, error: "No valid order items" };

  const subtotalAmount = Number(items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2));
  const freeShipAbove = Number(await getSetting(env, "shipping_free_above", "499")) || 499;
  const shipCharge = Number(await getSetting(env, "shipping_standard_charge", "49")) || 49;
  const shippingAmount = subtotalAmount >= freeShipAbove ? 0 : shipCharge;
  const discountAmount = Number(input.discountAmount || 0);
  const totalAmount = Number((subtotalAmount + shippingAmount - discountAmount).toFixed(2));

  const orderNumber = await generateOrderNumber(env);
  const createdAt = nowIso();

  const result = await env.DB.prepare(
    `INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_phone,
     address_line1, address_line2, city, state, pincode, country, delivery_method, coupon_code,
     payment_method, payment_status, order_status, subtotal_amount, shipping_amount, discount_amount,
     total_amount, notes, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?)`
  ).bind(
    orderNumber, input.userId, customerName, customerEmail, customerPhone,
    addressLine1, addressLine2, city, state, pincode, country,
    String(input.deliveryMethod || "standard"), input.couponCode || null,
    input.paymentMethod, input.paymentStatus, input.orderStatus,
    subtotalAmount, shippingAmount, discountAmount, totalAmount,
    String(input.notes || "").trim(), createdAt, createdAt
  ).run();

  const orderId = result.meta?.last_row_id;
  await env.DB.batch(items.map(item =>
    env.DB.prepare(
      "INSERT INTO order_items (order_id, product_id, product_name, product_sku, quantity, unit_price, line_total, size_label, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(orderId, item.productId, item.name, item.sku, item.qty, item.unitPrice, item.lineTotal, item.size, item.image, createdAt)
  ));

  return { ok: true, order: { id: orderId, order_number: orderNumber, total_amount: totalAmount, subtotal_amount: subtotalAmount, shipping_amount: shippingAmount, discount_amount: discountAmount } };
}

// ════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════
function mapProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    sku: p.sku || "",
    category: p.category || "",
    price: Number(p.price),
    original_price: p.original_price ? Number(p.original_price) : null,
    stock: Number(p.stock || 0),
    active: Boolean(p.active),
    featured: Boolean(p.featured),
    is_new: Boolean(p.is_new),
    is_trending: Boolean(p.is_trending),
    rating: Number(p.rating || 4.5),
    review_count: Number(p.review_count || 0),
    description: p.description || "",
    sizes: safeJsonParse(p.sizes_json, []),
    images: safeJsonParse(p.images_json, p.image_url ? [p.image_url] : []),
    image_url: p.image_url || "",
    brand: p.brand || "",
    tags: p.tags || "",
    created_at: p.created_at,
    updated_at: p.updated_at
  };
}

function mapUser(u) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name || "",
    email: u.email,
    phone: u.phone || "",
    role: u.role,
    emailVerified: Boolean(u.email_verified),
    createdAt: u.created_at
  };
}

function safeJsonParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; }
  catch { return fallback; }
}

async function auditLog(env, userId, action, entity, entityId, details) {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_log (user_id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId || null, action, entity || null, entityId ? String(entityId) : null, JSON.stringify(details || {}), nowIso()).run();
  } catch {}
}

async function generateOrderNumber(env) {
  const today = new Date();
  const prefix = `HU-${today.getUTCFullYear()}${String(today.getUTCMonth()+1).padStart(2,"0")}${String(today.getUTCDate()).padStart(2,"0")}`;
  const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM orders WHERE order_number LIKE ?").bind(`${prefix}-%`).first();
  return `${prefix}-${String((row?.c || 0) + 1).padStart(4, "0")}`;
}

function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}
function toInt(v, def) {
  const n = parseInt(v);
  return isNaN(n) ? def : n;
}
function nowIso() {
  return new Date().toISOString();
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    }
  });
}
function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
async function readJson(request) {
  try { return await request.json(); }
  catch { return null; }
}

// ── AUTH HELPERS ────────────────────────────────────────────────
async function requireAuth(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, response: json({ error: "Unauthorized. Please log in." }, 401) };
  const payload = await verifyJwt(token, env.JWT_SECRET || "heelsup-secret-2025");
  if (!payload) return { ok: false, response: json({ error: "Invalid or expired token" }, 401) };
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ? AND user_id = ? AND revoked = 0 LIMIT 1").bind(payload.sid, payload.sub).first();
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    return { ok: false, response: json({ error: "Session expired. Please log in again." }, 401) };
  }
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").bind(payload.sub).first();
  if (!user) return { ok: false, response: json({ error: "User not found" }, 401) };
  return { ok: true, payload, user };
}

async function createSession(env, userId, role) {
  const id = crypto.randomUUID();
  const days = 30;
  const expiresAt = new Date(Date.now() + days * 864e5).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, role, revoked, expires_at, created_at) VALUES (?, ?, ?, 0, ?, ?)").bind(id, userId, role, expiresAt, nowIso()).run();
  const payload = { sub: userId, role, sid: id, iat: Math.floor(Date.now()/1000), exp: Math.floor(new Date(expiresAt).getTime()/1000) };
  return { token: await signJwt(payload, env.JWT_SECRET || "heelsup-secret-2025"), expiresAt };
}

// ── CRYPTO HELPERS ──────────────────────────────────────────────
function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function b64urlText(text) {
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function b64urlDecode(text) {
  return decodeURIComponent(escape(atob(text.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((text.length+3)%4))));
}
async function hmacBytes(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
async function hmacHex(secret, msg) {
  return [...await hmacBytes(secret, msg)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function signJwt(payload, secret) {
  const h = b64urlText(JSON.stringify({alg:"HS256",typ:"JWT"}));
  const p = b64urlText(JSON.stringify(payload));
  return `${h}.${p}.${b64url(await hmacBytes(secret, `${h}.${p}`))}`;
}
async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = b64url(await hmacBytes(secret, `${parts[0]}.${parts[1]}`));
  if (expected !== parts[2]) return null;
  const parsed = JSON.parse(b64urlDecode(parts[1]));
  if (!parsed.exp || parsed.exp < Math.floor(Date.now()/1000)) return null;
  return parsed;
}
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function randomSaltHex(len=16) {
  return [...crypto.getRandomValues(new Uint8Array(len))].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function pbkdf2(password, salt, iters=100000) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:new TextEncoder().encode(salt),iterations:iters}, key, 256);
  return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function hashPassword(password) {
  const iters = 100000;
  const salt = randomSaltHex(16);
  return `pbkdf2$${iters}$${salt}$${await pbkdf2(password, salt, iters)}`;
}
async function verifyPassword(password, stored) {
  try {
    const [algo, iters, salt, hash] = String(stored || "").split("$");
    if (algo !== "pbkdf2") return false;
    return (await pbkdf2(password, salt, Number(iters))) === hash;
  } catch { return false; }
}