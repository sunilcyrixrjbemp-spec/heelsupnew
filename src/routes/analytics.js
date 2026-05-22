// worker/src/routes/analytics.js
import { requireAdmin } from '../middleware/auth.js';
import { ok, error, serverError } from '../utils/response.js';

export async function analyticsRouter(request, env) {
    const url = new URL(request.url);
    // Remove both /api/analytics and /api/admin/analytics
    const path = url.pathname.replace(/^\/api\/(admin\/)?analytics/, '') || '/';
    const method = request.method;

    if (path === '/dashboard' && method === 'GET') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        try {
            const [totalRevenue, totalOrders, totalCustomers, totalProducts,
                pendingOrders, recentOrders, topProducts, revenueByDay] = await Promise.all([
                    env.DB.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status='paid'").first(),
                    env.DB.prepare("SELECT COUNT(*) as cnt FROM orders").first(),
                    env.DB.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='customer'").first(),
                    env.DB.prepare("SELECT COUNT(*) as cnt FROM products WHERE is_active=1").first(),
                    env.DB.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status='pending'").first(),
                    env.DB.prepare(
                        `SELECT o.order_number, o.total, o.status, o.created_at,
                     COALESCE(u.name, o.guest_name) as customer_name
                     FROM orders o LEFT JOIN users u ON o.user_id = u.id
                     ORDER BY o.created_at DESC LIMIT 10`
                    ).all(),
                    env.DB.prepare(
                        `SELECT p.name, p.id, SUM(oi.qty) as units_sold, SUM(oi.total_price) as revenue
                     FROM order_items oi JOIN products p ON oi.product_id = p.id
                     JOIN orders o ON oi.order_id = o.id WHERE o.payment_status = 'paid'
                     GROUP BY p.id ORDER BY revenue DESC LIMIT 5`
                    ).all(),
                    env.DB.prepare(
                        `SELECT date(created_at) as day, SUM(total) as revenue, COUNT(*) as orders
                     FROM orders WHERE payment_status='paid' AND created_at >= date('now', '-30 days')
                     GROUP BY day ORDER BY day ASC`
                    ).all(),
                ]);
            return ok({
                summary: {
                    total_revenue: totalRevenue.total,
                    total_orders: totalOrders.cnt,
                    total_customers: totalCustomers.cnt,
                    total_products: totalProducts.cnt,
                    pending_orders: pendingOrders.cnt,
                },
                recent_orders: recentOrders.results,
                top_products: topProducts.results,
                revenue_chart: revenueByDay.results,
            });
        } catch (e) {
            console.error('Analytics error:', e);
            return serverError('Failed to fetch analytics');
        }
    }
    return error('Route not found', 404);
}