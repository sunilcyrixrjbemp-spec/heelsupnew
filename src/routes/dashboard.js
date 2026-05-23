import { requireAdmin } from '../middleware/auth.js';
import { ok, error, serverError } from '../utils/response.js';

export async function dashboardRouter(request, env) {
    if (request.method !== 'GET') {
        return error('Method not allowed', 405);
    }

    const { user, error: authError } = await requireAdmin(request, env);
    if (authError) return authError;

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    let dateFilter = '1=1';
    let params = [];
    if (from && to) {
        dateFilter = 'created_at >= ? AND created_at <= ?';
        params = [`${from} 00:00:00`, `${to} 23:59:59`];
    }

    try {
        const results = await env.DB.batch([
            // 0: Total Products
            env.DB.prepare('SELECT COUNT(*) as count FROM products'),
            // 1: Total Orders
            env.DB.prepare(`SELECT COUNT(*) as count FROM orders WHERE ${dateFilter}`).bind(...params),
            // 2: Total Revenue
            env.DB.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status IN ('paid', 'success') AND status NOT IN ('cancelled', 'returned') AND ${dateFilter}`).bind(...params),
            // 3: Pending Orders
            env.DB.prepare(`SELECT COUNT(*) as count FROM orders WHERE status IN ('placed', 'confirmed', 'processing') AND ${dateFilter}`).bind(...params),
            // 4: Orders By Status
            env.DB.prepare(`SELECT status, COUNT(*) as count FROM orders WHERE ${dateFilter} GROUP BY status`).bind(...params),
            // 5: Recent Orders
            env.DB.prepare('SELECT id, order_number, customer_name, customer_email, total as total_amount, status as order_status FROM orders ORDER BY created_at DESC LIMIT 8'),
            // 6: Top Products
            env.DB.prepare('SELECT p.id, p.name, p.category, p.image_url, p.price, p.stock, p.active, SUM(oi.qty) as total_qty FROM products p LEFT JOIN order_items oi ON p.id = oi.product_id GROUP BY p.id ORDER BY total_qty DESC LIMIT 8')
        ]);

        const totalProducts = results[0].results[0].count;
        const totalOrders = results[1].results[0].count;
        const totalRevenue = results[2].results[0].total;
        const pendingOrders = results[3].results[0].count;
        
        const ordersByStatus = {};
        for (const row of results[4].results) {
            const statusKey = (row.status || 'placed').toLowerCase();
            ordersByStatus[statusKey] = (ordersByStatus[statusKey] || 0) + row.count;
        }

        const recentOrders = results[5].results;
        const topProducts = results[6].results;

        return ok({
            totalProducts,
            totalOrders,
            totalRevenue,
            pendingOrders,
            ordersByStatus,
            recentOrders,
            topProducts
        });
    } catch (e) {
        console.error('Dashboard Error:', e);
        return serverError('Failed to fetch dashboard data');
    }
}
