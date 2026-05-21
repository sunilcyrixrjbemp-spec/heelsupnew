// ============================================================
// HeelsUp — JWT Auth Middleware
// ============================================================

export async function verifyJWT(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    // Verify HMAC-SHA256 signature
    const enc      = new TextEncoder();
    const keyData  = enc.encode(env.JWT_SECRET);
    const sigInput = enc.encode(`${headerB64}.${payloadB64}`);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify'],
    );

    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid    = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, sigInput);
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload; // { id, email, role, ... }
  } catch {
    return null;
  }
}

export async function requireAdmin(request, env) {
  const user = await verifyJWT(request, env);
  if (!user || user.role !== 'admin') return null;
  return user;
}
