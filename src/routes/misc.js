// worker/src/routes/misc.js
// Contact form, newsletter, inventory management
import { requireAdmin } from '../middleware/auth.js';
import { ok, list, error, serverError } from '../utils/response.js';

export async function contactRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/contact', '') || '/';
    const method = request.method;

    if (path === '/' && method === 'POST') {
        try {
            const { name, email, phone, order, subject, message } = await request.json();
            if (!name || !email || !message) return error('Name, email and message required');
            await env.DB.prepare(
                'INSERT INTO contact_messages (name, email, phone, order_ref, subject, message) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(name, email, phone || null, order || null, subject || null, message).run();
            return ok(null, 'Message sent! We will reply within 24 hours.');
        } catch (e) { return serverError('Failed to send message'); }
    }

    if (path === '/admin/all' && method === 'GET') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const msgs = await env.DB.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
        return list(msgs.results);
    }

    return error('Route not found', 404);
}

export async function newsletterRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/newsletter', '') || '/';
    const method = request.method;

    if (path === '/' && method === 'POST') {
        try {
            const { email } = await request.json();
            if (!email || !email.includes('@')) return error('Valid email required');
            await env.DB.prepare('INSERT OR IGNORE INTO newsletter (email) VALUES (?)').bind(email.toLowerCase()).run();
            return ok(null, 'Subscribed successfully!');
        } catch (e) { return serverError('Subscription failed'); }
    }

    return error('Route not found', 404);
}

export async function inventoryRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/inventory', '') || '/';
    const method = request.method;

    // GET /api/inventory?product_id=X
    if (path === '/' && method === 'GET') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const productId = url.searchParams.get('product_id');
        const where = productId ? 'WHERE i.product_id = ?' : '';
        const binds = productId ? [productId] : [];
        const inv = await env.DB.prepare(
            `SELECT i.*, p.name as product_name, p.sku FROM inventory i JOIN products p ON i.product_id = p.id ${where} ORDER BY p.name, i.size`
        ).bind(...binds).all();
        return list(inv.results);
    }

    // PUT /api/inventory/:id — update stock
    if (path.match(/^\/\d+$/) && method === 'PUT') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = path.slice(1);
        const { stock } = await request.json();
        if (stock < 0) return error('Stock cannot be negative');
        await env.DB.prepare("UPDATE inventory SET stock=?, updated_at=datetime('now') WHERE id=?").bind(stock, id).run();
        return ok(null, 'Inventory updated');
    }

    // POST /api/inventory — add inventory row
    if (path === '/' && method === 'POST') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const { product_id, size, color, stock } = await request.json();
        try {
            await env.DB.prepare(
                'INSERT INTO inventory (product_id, size, color, stock) VALUES (?, ?, ?, ?) ON CONFLICT(product_id, size, color) DO UPDATE SET stock=stock+excluded.stock'
            ).bind(product_id, size, color || null, stock || 0).run();
            return ok(null, 'Inventory updated');
        } catch (e) { return serverError('Failed to update inventory'); }
    }

    return error('Route not found', 404);
}