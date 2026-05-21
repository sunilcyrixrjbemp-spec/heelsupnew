// worker/src/routes/auth.js
import { signJWT } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { requireAuth } from '../middleware/auth.js';
import { ok, created, error, unauthorized, serverError } from '../utils/response.js';

export async function authRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/auth', '');
    const method = request.method;

    // POST /api/auth/register
    if (path === '/register' && method === 'POST') {
        try {
            const { name, email, phone, password } = await request.json();
            if (!name || !email || !password) return error('Name, email and password are required');
            if (password.length < 6) return error('Password must be at least 6 characters');

            // Check if email exists
            const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
            if (existing) return error('Email already registered', 409);

            const hashed = await hashPassword(password);
            const result = await env.DB.prepare(
                'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?) RETURNING id, name, email, phone, role, created_at'
            ).bind(name, email.toLowerCase().trim(), phone || null, hashed).first();

            const token = await signJWT({ id: result.id, email: result.email, role: result.role, name: result.name }, env.JWT_SECRET);
            return created({ token, user: { id: result.id, name: result.name, email: result.email, role: result.role } }, 'Registration successful');
        } catch (e) {
            console.error('Register error:', e);
            return serverError('Registration failed');
        }
    }

    // POST /api/auth/login
    if (path === '/login' && method === 'POST') {
        try {
            const { email, password } = await request.json();
            if (!email || !password) return error('Email and password required');

            // Rate limit check
            const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
            const rateLimitKey = `ratelimit:login:${ip}`;
            const attempts = parseInt(await env.KV.get(rateLimitKey) || '0');
            if (attempts >= 5) return error('Too many login attempts. Try after 1 minute.', 429);

            const user = await env.DB.prepare(
                'SELECT id, name, email, phone, password, role, avatar_url, is_active FROM users WHERE email = ?'
            ).bind(email.toLowerCase().trim()).first();

            if (!user || !(await verifyPassword(password, user.password))) {
                // Increment rate limit
                await env.KV.put(rateLimitKey, String(attempts + 1), { expirationTtl: 60 });
                return unauthorized('Invalid email or password');
            }

            if (!user.is_active) return unauthorized('Account is deactivated');

            // Reset rate limit on success
            await env.KV.delete(rateLimitKey);

            const token = await signJWT({ id: user.id, email: user.email, role: user.role, name: user.name }, env.JWT_SECRET);
            return ok({
                token,
                user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatar_url: user.avatar_url }
            }, 'Login successful');
        } catch (e) {
            console.error('Login error:', e);
            return serverError('Login failed');
        }
    }

    // GET /api/auth/me
    if (path === '/me' && method === 'GET') {
        const { user, error: authError } = await requireAuth(request, env);
        if (authError) return authError;

        const dbUser = await env.DB.prepare(
            'SELECT id, name, email, phone, role, avatar_url, created_at FROM users WHERE id = ?'
        ).bind(user.id).first();

        if (!dbUser) return unauthorized('User not found');
        return ok(dbUser);
    }

    // POST /api/auth/logout
    if (path === '/logout' && method === 'POST') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (token) {
            await env.KV.put(`blacklist:${token}`, '1', { expirationTtl: 86400 * 7 });
        }
        return ok(null, 'Logged out successfully');
    }

    // POST /api/auth/admin-setup (one-time admin creation)
    if (path === '/admin-setup' && method === 'POST') {
        try {
            const { name, email, password, secret } = await request.json();
            if (secret !== env.ADMIN_SECRET) return unauthorized('Invalid secret');

            const existing = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").first();
            if (existing) return error('Admin already exists', 409);

            const hashed = await hashPassword(password);
            const result = await env.DB.prepare(
                "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin') RETURNING id, name, email, role"
            ).bind(name, email.toLowerCase().trim(), hashed).first();

            const token = await signJWT({ id: result.id, email: result.email, role: result.role, name: result.name }, env.JWT_SECRET);
            return created({ token, user: result }, 'Admin created');
        } catch (e) {
            return serverError('Admin setup failed');
        }
    }

    // PUT /api/auth/profile
    if (path === '/profile' && method === 'PUT') {
        const { user, error: authError } = await requireAuth(request, env);
        if (authError) return authError;
        try {
            const { name, phone } = await request.json();
            await env.DB.prepare(
                "UPDATE users SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?"
            ).bind(name, phone, user.id).run();
            return ok({ name, phone }, 'Profile updated');
        } catch (e) {
            return serverError('Profile update failed');
        }
    }

    // PUT /api/auth/change-password
    if (path === '/change-password' && method === 'PUT') {
        const { user, error: authError } = await requireAuth(request, env);
        if (authError) return authError;
        try {
            const { current_password, new_password } = await request.json();
            const dbUser = await env.DB.prepare('SELECT password FROM users WHERE id = ?').bind(user.id).first();
            if (!await verifyPassword(current_password, dbUser.password)) return error('Current password is incorrect');
            if (new_password.length < 6) return error('New password must be at least 6 characters');
            const hashed = await hashPassword(new_password);
            await env.DB.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").bind(hashed, user.id).run();
            return ok(null, 'Password changed successfully');
        } catch (e) {
            return serverError('Password change failed');
        }
    }

    return error('Route not found', 404);
}