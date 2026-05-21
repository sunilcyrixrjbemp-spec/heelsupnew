// worker/src/routes/banners.js
import { requireAdmin } from '../middleware/auth.js';
import { ok, list, created, error, serverError } from '../utils/response.js';

export async function bannersRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/banners', '') || '/';
    const method = request.method;

    // GET /api/banners?position=hero
    if (path === '/' && method === 'GET') {
        const position = url.searchParams.get('position') || 'hero';
        try {
            const banners = await env.DB.prepare(
                `SELECT * FROM banners WHERE is_active = 1 AND position = ?
         AND (valid_from IS NULL OR valid_from <= datetime('now'))
         AND (valid_until IS NULL OR valid_until >= datetime('now'))
         ORDER BY sort_order ASC`
            ).bind(position).all();
            return list(banners.results);
        } catch (e) { return serverError('Failed to fetch banners'); }
    }

    // GET /api/banners/admin/all
    if (path === '/admin/all' && method === 'GET') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const banners = await env.DB.prepare('SELECT * FROM banners ORDER BY sort_order ASC').all();
        return list(banners.results);
    }

    // POST /api/banners
    if (path === '/' && method === 'POST') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        try {
            const { title, subtitle, image_url, link_url, position, sort_order, valid_from, valid_until } = await request.json();
            if (!image_url) return error('image_url required');
            const result = await env.DB.prepare(
                'INSERT INTO banners (title, subtitle, image_url, link_url, position, sort_order, valid_from, valid_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
            ).bind(title, subtitle, image_url, link_url, position || 'hero', sort_order || 0, valid_from, valid_until).first();
            return created(result, 'Banner created');
        } catch (e) { return serverError('Failed to create banner'); }
    }

    // PUT /api/banners/:id
    if (path.match(/^\/\d+$/) && method === 'PUT') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = path.slice(1);
        const b = await request.json();
        await env.DB.prepare(
            'UPDATE banners SET title=?, subtitle=?, image_url=?, link_url=?, position=?, is_active=?, sort_order=?, valid_from=?, valid_until=? WHERE id=?'
        ).bind(b.title, b.subtitle, b.image_url, b.link_url, b.position, b.is_active ? 1 : 0, b.sort_order, b.valid_from, b.valid_until, id).run();
        return ok(null, 'Banner updated');
    }

    // DELETE /api/banners/:id
    if (path.match(/^\/\d+$/) && method === 'DELETE') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        await env.DB.prepare('DELETE FROM banners WHERE id = ?').bind(path.slice(1)).run();
        return ok(null, 'Banner deleted');
    }

    return error('Route not found', 404);
}