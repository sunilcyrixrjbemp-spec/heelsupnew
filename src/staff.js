// worker/src/routes/staff.js
import { requireAdmin } from '../middleware/auth.js';
import { ok, list, error, serverError } from '../utils/response.js';

export async function staffRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/staff', '') || '/';
    const method = request.method;

    // GET /api/staff
    if (path === '/' && method === 'GET') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const staff = await env.DB.prepare(
            `SELECT s.*, u.name, u.email, u.phone FROM staff s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC`
        ).all();
        return list(staff.results);
    }

    // POST /api/staff — add staff (creates user + staff record)
    if (path === '/' && method === 'POST') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        try {
            const { name, email, phone, password, role } = await request.json();
            if (!name || !email || !password) return error('Name, email, password required');

            const { hashPassword } = await import('../utils/password.js');
            const hashed = await hashPassword(password);
            const newUser = await env.DB.prepare(
                "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'staff') RETURNING id"
            ).bind(name, email.toLowerCase(), phone || null, hashed).first();

            await env.DB.prepare(
                'INSERT INTO staff (user_id, role) VALUES (?, ?)'
            ).bind(newUser.id, role || 'sales').run();

            return ok(null, 'Staff member added');
        } catch (e) {
            if (e.message?.includes('UNIQUE')) return error('Email already exists', 409);
            return serverError('Failed to add staff');
        }
    }

    return error('Route not found', 404);
}