// worker/src/routes/pos.js
import { requireAdmin } from '../middleware/auth.js';
import { ok, list, created, error, serverError } from '../utils/response.js';

function genOrderNumber() {
    return `POS-${Math.floor(Math.random() * 90000) + 10000}`;
}

export async function posRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/pos', '') || '/';
    const method = request.method;

    // POST /api/pos/sale — create POS/offline sale
    if (path === '/sale' && method === 'POST') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        try {
            const { customer_name, customer_phone, items, payment_method, discount, notes } = await request.json();
            if (!items || items.length === 0) return error('No items in sale');

            let subtotal = 0;
            const orderItems = [];

            for (const item of items) {
                const product = await env.DB.prepare(
                    'SELECT id, name, sku, price, images FROM products WHERE id = ? AND is_active = 1'
                ).bind(item.product_id).first();
                if (!product) return error(`Product ${item.product_id} not found`);

                // Check stock
                if (item.size) {
                    const inv = await env.DB.prepare(
                        'SELECT stock FROM inventory WHERE product_id = ? AND size = ?'
                    ).bind(item.product_id, item.size).first();
                    if (!inv || inv.stock < item.qty) return error(`Insufficient stock for ${product.name}`);
                }

                const unitPrice = item.unit_price || product.price;
                const totalPrice = unitPrice * item.qty;
                subtotal += totalPrice;
                orderItems.push({
                    product_id: product.id,
                    product_snapshot: JSON.stringify({ name: product.name, sku: product.sku, image: JSON.parse(product.images || '[]')[0], price: unitPrice }),
                    size: item.size || null,
                    color: item.color || null,
                    qty: item.qty,
                    unit_price: unitPrice,
                    total_price: totalPrice,
                });
            }

            const discountAmt = discount || 0;
            const total = subtotal - discountAmt;
            const orderNumber = genOrderNumber();

            const order = await env.DB.prepare(
                `INSERT INTO orders (order_number, guest_name, guest_phone, channel, status, payment_status, payment_method, subtotal, discount, total, notes)
         VALUES (?, ?, ?, 'pos', 'delivered', 'paid', ?, ?, ?, ?, ?) RETURNING *`
            ).bind(orderNumber, customer_name || 'Walk-in', customer_phone || null, payment_method || 'cash', subtotal, discountAmt, total, notes || null).first();

            for (const item of orderItems) {
                await env.DB.prepare(
                    'INSERT INTO order_items (order_id, product_id, product_snapshot, size, color, qty, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(order.id, item.product_id, item.product_snapshot, item.size, item.color, item.qty, item.unit_price, item.total_price).run();

                if (item.size) {
                    await env.DB.prepare(
                        'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND size = ?'
                    ).bind(item.qty, item.product_id, item.size).run();
                }
            }

            return created({ order_number: orderNumber, order_id: order.id, total }, 'POS sale recorded');
        } catch (e) {
            console.error('POS sale error:', e);
            return serverError('Failed to record sale');
        }
    }

    // GET /api/pos/sales — recent POS sales
    if (path === '/sales' && method === 'GET') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const sales = await env.DB.prepare(
            "SELECT * FROM orders WHERE channel='pos' ORDER BY created_at DESC LIMIT 50"
        ).all();
        return list(sales.results);
    }

    return error('Route not found', 404);
}