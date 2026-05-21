// worker/src/routes/reviews.js
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { ok, list, created, error, serverError } from '../utils/response.js';

export async function reviewsRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/reviews', '') || '/';
    const method = request.method;

    // GET /api/reviews?product_id=X
    if (path === '/' && method === 'GET') {
        const productId = url.searchParams.get('product_id');
        if (!productId) return error('product_id required');
        const reviews = await env.DB.prepare(
            `SELECT r.id, r.rating, r.title, r.body, r.is_verified, r.created_at, u.name as reviewer_name
       FROM reviews r LEFT JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ? AND r.is_approved = 1 ORDER BY r.created_at DESC`
        ).bind(productId).all();
        return list(reviews.results);
    }

    // POST /api/reviews
    if (path === '/' && method === 'POST') {
        const { user, error: authError } = await requireAuth(request, env);
        if (authError) return authError;
        try {
            const { product_id, rating, title, body, order_id } = await request.json();
            if (!product_id || !rating) return error('Product ID and rating required');
            if (rating < 1 || rating > 5) return error('Rating must be 1-5');

            // Check if user bought this product
            let isVerified = 0;
            if (order_id) {
                const bought = await env.DB.prepare(
                    'SELECT id FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.id = ? AND oi.product_id = ? AND o.user_id = ? AND o.status = \'delivered\''
                ).bind(order_id, product_id, user.id).first();
                if (bought) isVerified = 1;
            }

            await env.DB.prepare(
                'INSERT INTO reviews (product_id, user_id, order_id, rating, title, body, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).bind(product_id, user.id, order_id || null, rating, title || null, body || null, isVerified).run();

            return created(null, 'Review submitted — pending approval');
        } catch (e) { return serverError('Failed to submit review'); }
    }

    // GET /api/reviews/admin/all
    if (path === '/admin/all' && method === 'GET') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const reviews = await env.DB.prepare(
            `SELECT r.*, p.name as product_name, u.name as reviewer_name
       FROM reviews r JOIN products p ON r.product_id = p.id LEFT JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC`
        ).all();
        return list(reviews.results);
    }

    // PATCH /api/reviews/:id/approve
    if (path.match(/^\/\d+\/approve$/) && method === 'PATCH') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = path.match(/(\d+)/)[1];
        await env.DB.prepare('UPDATE reviews SET is_approved = 1 WHERE id = ?').bind(id).run();
        return ok(null, 'Review approved');
    }

    // DELETE /api/reviews/:id
    if (path.match(/^\/\d+$/) && method === 'DELETE') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = path.slice(1);
        await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
        return ok(null, 'Review deleted');
    }

    return error('Route not found', 404);
}