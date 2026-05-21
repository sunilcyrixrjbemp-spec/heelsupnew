// worker/src/routes/orders.js
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { ok, list, created, error, notFound, serverError } from '../utils/response.js';

function genOrderNumber() {
    const num = Math.floor(Math.random() * 90000) + 10000;
    return `ORD-${num}`;
}

export async function ordersRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/orders', '') || '/';
    const method = request.method;
    const params = url.searchParams;

    // POST /api/orders — create order (authenticated or guest)
    if (path === '/' && method === 'POST') {
        try {
            const { user } = await requireAuth(request, env);
            const body = await request.json();
            const { items, address_id, coupon_code, payment_method, notes } = body;

            if (!items || items.length === 0) return error('No items in order');

            // Validate and calculate totals server-side
            let subtotal = 0;
            const orderItems = [];

            for (const item of items) {
                const product = await env.DB.prepare(
                    'SELECT id, name, sku, price, images FROM products WHERE id = ? AND is_active = 1'
                ).bind(item.product_id).first();
                if (!product) return error(`Product ${item.product_id} not found or unavailable`);

                // Check stock
                const inv = await env.DB.prepare(
                    'SELECT stock FROM inventory WHERE product_id = ? AND size = ?'
                ).bind(item.product_id, item.size).first();
                if (!inv || inv.stock < item.qty) return error(`Insufficient stock for ${product.name} (size ${item.size})`);

                const totalPrice = product.price * item.qty;
                subtotal += totalPrice;
                orderItems.push({
                    product_id: product.id,
                    product_snapshot: JSON.stringify({ name: product.name, sku: product.sku, image: JSON.parse(product.images || '[]')[0], price: product.price }),
                    size: item.size,
                    color: item.color || null,
                    qty: item.qty,
                    unit_price: product.price,
                    total_price: totalPrice,
                });
            }

            // Apply coupon
            let discount = 0;
            let couponId = null;
            if (coupon_code) {
                const coupon = await env.DB.prepare(
                    `SELECT * FROM coupons WHERE code = ? AND is_active = 1
           AND (valid_from IS NULL OR valid_from <= datetime('now'))
           AND (valid_until IS NULL OR valid_until >= datetime('now'))`
                ).bind(coupon_code.toUpperCase()).first();

                if (coupon && subtotal >= coupon.min_order) {
                    couponId = coupon.id;
                    if (coupon.type === 'percent') discount = Math.floor(subtotal * coupon.value / 100);
                    else if (coupon.type === 'flat') discount = Math.min(coupon.value, subtotal);
                    await env.DB.prepare('UPDATE coupons SET uses_count = uses_count + 1 WHERE id = ?').bind(coupon.id).run();
                }
            }

            // Shipping
            const freeShippingAbove = parseInt(await env.DB.prepare("SELECT value FROM settings WHERE key = 'free_shipping_above'").first().then(r => r?.value || '49900'));
            const shippingCharge = parseInt(await env.DB.prepare("SELECT value FROM settings WHERE key = 'shipping_charge'").first().then(r => r?.value || '4900'));
            const shipping = (subtotal - discount) >= freeShippingAbove ? 0 : shippingCharge;

            // GST
            const gstPct = parseInt(await env.DB.prepare("SELECT value FROM settings WHERE key = 'gst_percent'").first().then(r => r?.value || '5'));
            const tax = Math.floor((subtotal - discount) * gstPct / 100);
            const total = subtotal - discount + shipping + tax;

            // Get address snapshot
            let addressSnapshot = null;
            if (address_id && user) {
                const addr = await env.DB.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').bind(address_id, user.id).first();
                if (addr) addressSnapshot = JSON.stringify(addr);
            }

            // Create order
            const orderNumber = genOrderNumber();
            const order = await env.DB.prepare(
                `INSERT INTO orders (order_number, user_id, payment_method, subtotal, discount, shipping, tax, total, coupon_id, coupon_code, address_id, address_snapshot, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
            ).bind(
                orderNumber, user?.id || null, payment_method || 'cod',
                subtotal, discount, shipping, tax, total,
                couponId, coupon_code?.toUpperCase() || null,
                address_id || null, addressSnapshot, notes || null
            ).first();

            // Insert order items & decrement inventory
            for (const item of orderItems) {
                await env.DB.prepare(
                    'INSERT INTO order_items (order_id, product_id, product_snapshot, size, color, qty, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(order.id, item.product_id, item.product_snapshot, item.size, item.color, item.qty, item.unit_price, item.total_price).run();

                await env.DB.prepare(
                    'UPDATE inventory SET stock = stock - ?, updated_at = datetime(\'now\') WHERE product_id = ? AND size = ?'
                ).bind(item.qty, item.product_id, item.size).run();
            }

            return created({ order_number: order.order_number, order_id: order.id, total: order.total }, 'Order placed successfully');
        } catch (e) {
            console.error('Order create error:', e);
            return serverError('Failed to create order');
        }
    }

    // GET /api/orders/my — customer's own orders
    if (path === '/my' && method === 'GET') {
        const { user, error: authError } = await requireAuth(request, env);
        if (authError) return authError;
        try {
            const page = parseInt(params.get('page') || '1');
            const limit = parseInt(params.get('limit') || '10');
            const offset = (page - 1) * limit;

            const orders = await env.DB.prepare(
                `SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method, o.total, o.created_at,
                (SELECT json_group_array(json_object('name', json_extract(oi.product_snapshot,'$.name'), 'image', json_extract(oi.product_snapshot,'$.image'), 'qty', oi.qty, 'size', oi.size))
                 FROM order_items oi WHERE oi.order_id = o.id) as items_preview
         FROM orders o WHERE o.user_id = ?
         ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
            ).bind(user.id, limit, offset).all();

            return list(orders.results);
        } catch (e) {
            return serverError('Failed to fetch orders');
        }
    }

    // GET /api/orders/:id — order detail
    if (path.match(/^\/\d+$/) && method === 'GET') {
        const { user, error: authError } = await requireAuth(request, env);
        if (authError) return authError;
        const id = path.slice(1);
        try {
            const where = user.role === 'admin' ? 'o.id = ?' : 'o.id = ? AND o.user_id = ?';
            const binds = user.role === 'admin' ? [id] : [id, user.id];

            const order = await env.DB.prepare(
                `SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o
         LEFT JOIN users u ON o.user_id = u.id WHERE ${where}`
            ).bind(...binds).first();
            if (!order) return notFound('Order not found');

            const items = await env.DB.prepare(
                'SELECT * FROM order_items WHERE order_id = ?'
            ).bind(id).all();

            return ok({ ...order, items: items.results });
        } catch (e) {
            return serverError('Failed to fetch order');
        }
    }

    // GET /api/orders/track/:orderNumber — public tracking
    if (path.startsWith('/track/') && method === 'GET') {
        const orderNumber = path.replace('/track/', '');
        const order = await env.DB.prepare(
            'SELECT order_number, status, payment_status, tracking_number, tracking_url, created_at, delivered_at FROM orders WHERE order_number = ?'
        ).bind(orderNumber).first();
        if (!order) return notFound('Order not found');
        return ok(order);
    }

    // GET /api/orders/admin/all — admin: all orders
    if (path === '/admin/all' && method === 'GET') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        try {
            const page = parseInt(params.get('page') || '1');
            const limit = parseInt(params.get('limit') || '20');
            const offset = (page - 1) * limit;
            const status = params.get('status');
            const channel = params.get('channel');
            const search = params.get('q');

            let where = [];
            let binds = [];
            if (status) { where.push('o.status = ?'); binds.push(status); }
            if (channel) { where.push('o.channel = ?'); binds.push(channel); }
            if (search) {
                where.push('(o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
                binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

            const total = await env.DB.prepare(
                `SELECT COUNT(*) as cnt FROM orders o LEFT JOIN users u ON o.user_id = u.id ${whereStr}`
            ).bind(...binds).first();

            const orders = await env.DB.prepare(
                `SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method, o.channel,
                o.total, o.created_at, o.tracking_number,
                COALESCE(u.name, o.guest_name) as customer_name,
                COALESCE(u.email, o.guest_email) as customer_email
         FROM orders o LEFT JOIN users u ON o.user_id = u.id
         ${whereStr} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
            ).bind(...binds, limit, offset).all();

            return list(orders.results, { page, limit, total: total.cnt, pages: Math.ceil(total.cnt / limit) });
        } catch (e) {
            return serverError('Failed to fetch orders');
        }
    }

    // PATCH /api/orders/:id/status — admin update status
    if (path.match(/^\/\d+\/status$/) && method === 'PATCH') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = path.match(/(\d+)/)[1];
        try {
            const { status, tracking_number, tracking_url } = await request.json();
            const delivered_at = status === 'delivered' ? "datetime('now')" : null;
            await env.DB.prepare(
                `UPDATE orders SET status=?, tracking_number=COALESCE(?,tracking_number),
         tracking_url=COALESCE(?,tracking_url), updated_at=datetime('now')
         ${delivered_at ? ", delivered_at=datetime('now')" : ''} WHERE id=?`
            ).bind(status, tracking_number || null, tracking_url || null, id).run();
            return ok(null, 'Order status updated');
        } catch (e) {
            return serverError('Failed to update order');
        }
    }

    return error('Route not found', 404);
}