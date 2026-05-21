// worker/src/routes/wishlist.js
import { requireAuth } from '../middleware/auth.js';
import { ok, list, error, serverError } from '../utils/response.js';

export async function wishlistRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/wishlist', '') || '/';
    const method = request.method;

    // GET /api/wishlist — get user's wishlist
    if (path === '/' && method === 'GET') {
        const { user, error: authError } = await requireAuth(request, env);
        if (authError) return authError;
        try {
            const items = await env.DB.prepare(
                `SELECT p.id, p.name, p.slug, p.price, p.mrp, p.images, c.name as category_name
         FROM wishlists w JOIN products p ON w.product_id = p.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE w.user_id = ? AND p.is_active = 1 ORDER BY w.added_at DESC`
            ).bind(user.id).all();
            return list(items.results);
        } catch (e) { return serverError('Failed to fetch wishlist'); }
    }

    // POST /api/wishlist — add to wishlist
    if (path === '/' && method === 'POST') {
        const { user, error: authError } = await requireAuth(request, env);
        if (authError) return authError;
        try {
            const { product_id } = await request.json();
            if (!product_id) return error('product_id required');
            await env.DB.prepare('INSERT OR IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)').bind(user.id, product_id).run();
            return ok(null, 'Added to wishlist');
        } catch (e) { return serverError('Failed to add to wishlist'); }
    }

    // DELETE /api/wishlist/:productId
    if (path.match(/^\/\d+$/) && method === 'DELETE') {
        const { user, error: authError } = await requireAuth(request, env);
        if (authError) return authError;
        const productId = path.slice(1);
        await env.DB.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?').bind(user.id, productId).run();
        return ok(null, 'Removed from wishlist');
    }

    return error('Route not found', 404);
}