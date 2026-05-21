// ============================================================
// HeelsUp — Reports Routes
// /api/reports/*
// Admin-only — sales, inventory, customer reports
// ============================================================

import { adminGuard } from '../middleware/adminAuth.js';
import { query, queryOne } from '../utils/db.js';
import { ok, err } from '../utils/response.js';

export async function handleReports(request, env, path, method) {

    // All reports are admin-only
    const { user, earlyReturn } = await adminGuard(request, env);
    if (earlyReturn) return earlyReturn;

    const url = new URL(request.url);
    const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);
    const fromDt = `${from} 00:00:00`;
    const toDt = `${to} 23:59:59`;

    // ── GET /api/reports/sales ─────────────────────────────────
    if (method === 'GET' && path === '/api/reports/sales') {
        const [summary, daily, byCategory, topProducts] = await Promise.all([

            // Overall summary
            queryOne(env.DB, `
        SELECT
          COUNT(*) as total_orders,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(DISTINCT user_id) as unique_customers
        FROM orders
        WHERE status NOT IN ('cancelled','returned')
          AND created_at BETWEEN ? AND ?
      `, [fromDt, toDt]),

            // Daily breakdown
            query(env.DB, `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as orders,
          SUM(total_amount) as revenue
        FROM orders
        WHERE status NOT IN ('cancelled','returned')
          AND created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [fromDt, toDt]),

            // Sales by category
            query(env.DB, `
        SELECT
          c.name as category,
          COUNT(oi.id) as items_sold,
          SUM(oi.unit_price * oi.qty) as revenue
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('cancelled','returned')
          AND o.created_at BETWEEN ? AND ?
        GROUP BY c.id
        ORDER BY revenue DESC
      `, [fromDt, toDt]),

            // Top 10 products
            query(env.DB, `
        SELECT
          p.name,
          p.sku,
          SUM(oi.qty) as units_sold,
          SUM(oi.unit_price * oi.qty) as revenue
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('cancelled','returned')
          AND o.created_at BETWEEN ? AND ?
        GROUP BY p.id
        ORDER BY revenue DESC
        LIMIT 10
      `, [fromDt, toDt]),
        ]);

        return ok({ from, to, summary, daily, by_category: byCategory, top_products: topProducts });
    }

    // ── GET /api/reports/inventory ─────────────────────────────
    if (method === 'GET' && path === '/api/reports/inventory') {
        const [lowStock, outOfStock, totalValue] = await Promise.all([

            query(env.DB, `
        SELECT p.name, p.sku, i.size, i.color, i.stock
        FROM inventory i
        JOIN products p ON p.id = i.product_id
        WHERE i.stock > 0 AND i.stock <= 5
        ORDER BY i.stock ASC
        LIMIT 50
      `),

            query(env.DB, `
        SELECT p.name, p.sku, i.size, i.color
        FROM inventory i
        JOIN products p ON p.id = i.product_id
        WHERE i.stock = 0
        ORDER BY p.name
        LIMIT 50
      `),

            queryOne(env.DB, `
        SELECT SUM(i.stock * p.cost_price) as value
        FROM inventory i
        JOIN products p ON p.id = i.product_id
      `),
        ]);

        return ok({ low_stock: lowStock, out_of_stock: outOfStock, total_inventory_value: totalValue?.value || 0 });
    }

    // ── GET /api/reports/customers ─────────────────────────────
    if (method === 'GET' && path === '/api/reports/customers') {
        const [newCustomers, topCustomers, retention] = await Promise.all([

            // New customers per day
            query(env.DB, `
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM users
        WHERE role = 'customer' AND created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [fromDt, toDt]),

            // Top 10 customers by spend
            query(env.DB, `
        SELECT u.first_name, u.email, u.phone,
          COUNT(o.id) as total_orders,
          SUM(o.total_amount) as total_spent
        FROM users u
        JOIN orders o ON o.user_id = u.id
        WHERE o.status NOT IN ('cancelled','returned')
        GROUP BY u.id
        ORDER BY total_spent DESC
        LIMIT 10
      `),

            // Repeat vs new buyers
            queryOne(env.DB, `
        SELECT
          COUNT(DISTINCT CASE WHEN order_count > 1 THEN user_id END) as repeat_customers,
          COUNT(DISTINCT CASE WHEN order_count = 1 THEN user_id END) as one_time_customers
        FROM (
          SELECT user_id, COUNT(*) as order_count
          FROM orders
          WHERE status NOT IN ('cancelled','returned')
          GROUP BY user_id
        )
      `),
        ]);

        return ok({ from, to, new_customers: newCustomers, top_customers: topCustomers, retention });
    }

    // ── GET /api/reports/orders ────────────────────────────────
    if (method === 'GET' && path === '/api/reports/orders') {
        const [byStatus, byPayment, refunds] = await Promise.all([

            query(env.DB, `
        SELECT status, COUNT(*) as count, SUM(total_amount) as total
        FROM orders
        WHERE created_at BETWEEN ? AND ?
        GROUP BY status
      `, [fromDt, toDt]),

            query(env.DB, `
        SELECT payment_method, COUNT(*) as count, SUM(total_amount) as total
        FROM orders
        WHERE created_at BETWEEN ? AND ?
        GROUP BY payment_method
      `, [fromDt, toDt]),

            queryOne(env.DB, `
        SELECT COUNT(*) as count, SUM(total_amount) as total
        FROM orders
        WHERE status IN ('returned','refunded')
          AND created_at BETWEEN ? AND ?
      `, [fromDt, toDt]),
        ]);

        return ok({ from, to, by_status: byStatus, by_payment: byPayment, refunds });
    }

    return err('Not found', 404);
}