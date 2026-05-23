// worker/src/routes/orders.js
// HeelsUp — Complete Orders Router v2
// Payment: Razorpay ONLY (no COD)
// Exchange only (no returns/refunds)
// All amounts in PAISE (₹1 = 100 paise)

import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { ok, list, created, error, notFound, serverError } from '../utils/response.js';
import { verifyRazorpaySignature } from '../utils/razorpay.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function genOrderNumber() {
    const ts = Date.now().toString(36).toUpperCase().slice(-4);
    const rnd = Math.floor(Math.random() * 9000 + 1000);
    return `ORD-${rnd}-${ts}`;
}

/** Denormalize address snapshot → flat fields */
function parseAddress(snapshot) {
    if (!snapshot) return {};
    try {
        const a = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
        return {
            address_line1: a.line1 || a.address_line1 || '',
            address_line2: a.line2 || a.address_line2 || '',
            city: a.city || '',
            state: a.state || '',
            pincode: a.pincode || '',
            country: a.country || 'India',
        };
    } catch { return {}; }
}

/** Format a complete order row for API response */
function formatOrder(o, items = null) {
    const addr = parseAddress(o.address_snapshot);
    return {
        id: o.id,
        order_number: o.order_number,

        // Customer
        customer_name: o.customer_name || '',
        customer_email: o.customer_email || '',
        customer_phone: o.customer_phone || '',

        // Address
        address_line1: o.address_line1 || addr.address_line1 || '',
        address_line2: o.address_line2 || addr.address_line2 || '',
        city: o.city || addr.city || '',
        state: o.state || addr.state || '',
        pincode: o.pincode || addr.pincode || '',
        country: o.country || addr.country || 'India',
        delivery_method: o.delivery_method || 'Standard',

        // Order info
        order_status: o.order_status || 'placed',
        payment_status: o.payment_status || 'pending',
        payment_method: o.payment_method || '',
        source: o.source || 'online',

        // Razorpay (immutable fields — always present if paid via Razorpay)
        razorpay_order_id: o.razorpay_order_id || null,
        razorpay_payment_id: o.razorpay_payment_id || null,
        razorpay_signature: o.razorpay_signature || null,

        // Amounts (paise)
        subtotal_amount: o.subtotal_amount || o.subtotal || 0,
        discount_amount: o.discount_amount || o.discount || 0,
        shipping_amount: o.shipping_amount || o.shipping || 0,
        tax_amount: o.tax_amount || o.tax || 0,
        total_amount: o.total_amount || o.total || 0,

        // Coupon
        coupon_code: o.coupon_code || null,

        // Tracking
        tracking_number: o.tracking_number || null,
        tracking_url: o.tracking_url || null,

        // Exchange
        exchange_reason: o.exchange_reason || null,
        exchange_product: o.exchange_product || null,

        // Timestamps
        paid_at: o.paid_at || null,
        confirmed_at: o.confirmed_at || null,
        shipped_at: o.shipped_at || null,
        out_for_delivery_at: o.out_for_delivery_at || null,
        delivered_at: o.delivered_at || null,
        cancelled_at: o.cancelled_at || null,
        created_at: o.created_at || null,
        updated_at: o.updated_at || null,

        notes: o.notes || null,

        // Items (optional, only when fetched)
        ...(items !== null ? { items } : {}),
    };
}

/** Format order_items row */
function formatItem(it) {
    let snap = {};
    try { snap = JSON.parse(it.product_snapshot || '{}'); } catch { }
    return {
        id: it.id,
        product_id: it.product_id,
        product_name: snap.name || 'Product',
        sku: snap.sku || null,
        image: snap.image || null,
        size: it.size || null,
        color: it.color || null,
        quantity: it.qty || it.quantity || 1,
        price: it.unit_price || 0,
        total_price: it.total_price || 0,
    };
}

/** Get DB settings as a key→value map (batched single query) */
async function getSettings(db, keys) {
    if (!keys.length) return {};
    const qs = keys.map(() => '?').join(',');
    const rows = await db.prepare(
        `SELECT key, value FROM settings WHERE key IN (${qs})`
    ).bind(...keys).all();
    return Object.fromEntries((rows.results || []).map(r => [r.key, r.value]));
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ROUTER
// ══════════════════════════════════════════════════════════════════════════════
export async function ordersRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/orders', '') || '/';
    const method = request.method;
    const params = url.searchParams;

    // ── POST /api/orders — Create Order (Razorpay: called AFTER payment verify) ──
    // This endpoint should only be called after payment verification (see /api/payment/verify)
    // But we also accept a pre-verified body with razorpay fields.
    if (path === '/' && method === 'POST') {
        return handleCreateOrder(request, env);
    }

    // ── GET /api/orders/my — Customer's own orders ────────────────────────────
    if (path === '/my' && method === 'GET') {
        return handleMyOrders(request, env, params);
    }

    // ── GET /api/orders/track/:orderNumber — Public tracking ─────────────────
    if (path.startsWith('/track/') && method === 'GET') {
        return handleTrack(path, env);
    }

    // ── GET /api/orders/my/:id — Customer order detail ───────────────────────
    if (path.match(/^\/my\/\d+$/) && method === 'GET') {
        return handleMyOrderDetail(path, request, env);
    }

    // ── POST /api/orders/:id/exchange — Customer requests exchange ────────────
    if (path.match(/^\/\d+\/exchange$/) && method === 'POST') {
        return handleExchangeRequest(path, request, env);
    }

    // ─────────────── ADMIN ROUTES ────────────────────────────────────────────

    // ── GET /api/orders/admin — Admin: all orders (fast, paginated) ───────────
    if (path === '/admin' && method === 'GET') {
        return handleAdminListOrders(request, env, params);
    }

    // ── GET /api/orders/admin/stats — Admin: order stats summary ─────────────
    if (path === '/admin/stats' && method === 'GET') {
        return handleAdminStats(request, env, params);
    }

    // ── GET /api/orders/admin/:id — Admin: single order full detail ──────────
    if (path.match(/^\/admin\/\d+$/) && method === 'GET') {
        return handleAdminOrderDetail(path, request, env);
    }

    // ── PUT /api/orders/admin/:id/status — Admin: update status ──────────────
    // (frontend sends PUT, keep backward compat with PATCH too)
    if (path.match(/^\/admin\/\d+\/status$/) && (method === 'PUT' || method === 'PATCH')) {
        return handleAdminUpdateStatus(path, request, env);
    }

    // ── PUT /api/orders/admin/:id/exchange — Admin: approve/reject exchange ───
    if (path.match(/^\/admin\/\d+\/exchange$/) && method === 'PUT') {
        return handleAdminExchange(path, request, env);
    }

    // ── Legacy routes (backward compat) ──────────────────────────────────────
    // Old: GET /api/orders/admin/all
    if (path === '/admin/all' && method === 'GET') {
        return handleAdminListOrders(request, env, params);
    }
    // Old: PATCH /api/orders/:id/status (no admin prefix)
    if (path.match(/^\/\d+\/status$/) && (method === 'PATCH' || method === 'PUT')) {
        return handleAdminUpdateStatus(path, request, env);
    }

    return error('Route not found', 404);
}

// ══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// ── Create Order (post-payment) ────────────────────────────────────────────
async function handleCreateOrder(request, env) {
    try {
        const { user } = await requireAuth(request, env);

        const body = await request.json();
        const {
            items, address_id, coupon_code,
            razorpay_order_id, razorpay_payment_id, razorpay_signature,
            notes, delivery_method,
        } = body;

        // ── Validate required fields ──────────────────────────────────────────
        if (!items || !items.length) return error('No items in order', 400);
        if (!razorpay_payment_id) return error('Payment verification required. Complete Razorpay payment first.', 402);
        if (!razorpay_order_id) return error('Razorpay order ID missing', 400);
        if (!razorpay_signature) return error('Razorpay signature missing', 400);

        // ── Verify Razorpay signature ─────────────────────────────────────────
        const sigValid = await verifyRazorpaySignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            env.RAZORPAY_KEY_SECRET
        );
        if (!sigValid) return error('Payment verification failed. Invalid signature.', 402);

        // ── Check for duplicate payment ───────────────────────────────────────
        const dupCheck = await env.DB.prepare(
            'SELECT id FROM orders WHERE razorpay_payment_id = ?'
        ).bind(razorpay_payment_id).first();
        if (dupCheck) return error('This payment has already been used.', 409);

        // ── Validate & build order items (server-side prices) ────────────────
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            if (!item.product_id || !item.size || !item.qty || item.qty < 1)
                return error(`Invalid item: product_id, size, and qty required`, 400);

            const product = await env.DB.prepare(
                'SELECT id, name, sku, price, images FROM products WHERE id = ? AND is_active = 1'
            ).bind(item.product_id).first();
            if (!product) return error(`Product ${item.product_id} not found or unavailable`, 400);

            // Check stock
            const inv = await env.DB.prepare(
                'SELECT stock FROM inventory WHERE product_id = ? AND size = ?'
            ).bind(item.product_id, item.size).first();
            if (!inv || inv.stock < item.qty)
                return error(`Insufficient stock: ${product.name} size ${item.size}`, 400);

            const images = (() => { try { return JSON.parse(product.images || '[]'); } catch { return []; } })();
            const lineTotal = product.price * item.qty;
            subtotal += lineTotal;
            orderItems.push({
                product_id: product.id,
                product_snapshot: JSON.stringify({
                    name: product.name,
                    sku: product.sku,
                    image: images[0] || null,
                    price: product.price,
                }),
                size: item.size,
                color: item.color || null,
                qty: item.qty,
                unit_price: product.price,
                total_price: lineTotal,
            });
        }

        // ── Apply coupon ──────────────────────────────────────────────────────
        let discount = 0;
        let couponId = null;
        let validatedCouponCode = null;

        if (coupon_code) {
            const coupon = await env.DB.prepare(
                `SELECT * FROM coupons
         WHERE code = ? AND is_active = 1
           AND (valid_from  IS NULL OR valid_from  <= datetime('now'))
           AND (valid_until IS NULL OR valid_until >= datetime('now'))
           AND (max_uses    IS NULL OR uses_count  < max_uses)`
            ).bind(coupon_code.toUpperCase()).first();

            if (coupon && subtotal >= coupon.min_order) {
                couponId = coupon.id;
                validatedCouponCode = coupon.code;
                if (coupon.type === 'percent')
                    discount = Math.min(Math.floor(subtotal * coupon.value / 100), coupon.max_discount || Infinity);
                else if (coupon.type === 'flat')
                    discount = Math.min(coupon.value, subtotal);
                else if (coupon.type === 'free_shipping')
                    discount = 0; // handled below
            }
        }

        // ── Shipping & Tax (from settings — single batch query) ───────────────
        const cfg = await getSettings(env.DB, [
            'free_shipping_above', 'shipping_charge', 'gst_percent'
        ]);
        const freeShipAbove = parseInt(cfg.free_shipping_above || '49900');
        const shippingCharge = parseInt(cfg.shipping_charge || '4900');
        const gstPct = parseInt(cfg.gst_percent || '5');

        const isFreeShipping = coupon_code && (await env.DB.prepare(
            'SELECT type FROM coupons WHERE code = ? AND type = ?'
        ).bind(coupon_code.toUpperCase(), 'free_shipping').first());

        const effectiveSubtotal = subtotal - discount;
        const shipping = isFreeShipping || effectiveSubtotal >= freeShipAbove ? 0 : shippingCharge;
        const tax = Math.floor(effectiveSubtotal * gstPct / 100);
        const total = effectiveSubtotal + shipping + tax;

        // ── Get address snapshot ──────────────────────────────────────────────
        let addrSnap = null;
        let addrFields = {};

        if (address_id && user) {
            const addr = await env.DB.prepare(
                'SELECT * FROM addresses WHERE id = ? AND user_id = ?'
            ).bind(address_id, user.id).first();
            if (addr) {
                addrSnap = JSON.stringify(addr);
                addrFields = {
                    address_line1: addr.line1 || '',
                    address_line2: addr.line2 || '',
                    city: addr.city || '',
                    state: addr.state || '',
                    pincode: addr.pincode || '',
                    country: addr.country || 'India',
                };
            }
        }

        // ── Insert order ──────────────────────────────────────────────────────
        const orderNumber = genOrderNumber();
        const now = new Date().toISOString();

        const order = await env.DB.prepare(
            `INSERT INTO orders (
        order_number, user_id,
        customer_name, customer_email, customer_phone,
        address_line1, address_line2, city, state, pincode, country,
        address_id, address_snapshot,
        delivery_method, source,
        order_status, payment_status, payment_method,
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        subtotal_amount, discount_amount, shipping_amount, tax_amount, total_amount,
        coupon_id, coupon_code,
        paid_at, created_at, updated_at, notes
      ) VALUES (
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, 'online',
        'placed', 'paid', 'razorpay',
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, datetime('now'), datetime('now'), ?
      ) RETURNING *`
        ).bind(
            orderNumber, user?.id || null,
            user?.name || '',
            user?.email || '',
            user?.phone || '',
            addrFields.address_line1 || '',
            addrFields.address_line2 || '',
            addrFields.city || '',
            addrFields.state || '',
            addrFields.pincode || '',
            addrFields.country || 'India',
            address_id || null,
            addrSnap,
            delivery_method || 'Standard',
            razorpay_order_id, razorpay_payment_id, razorpay_signature,
            subtotal, discount, shipping, tax, total,
            couponId, validatedCouponCode,
            now,
            notes || null
        ).first();

        // ── Insert items & decrement stock (batched loop) ─────────────────────
        for (const item of orderItems) {
            await env.DB.prepare(
                `INSERT INTO order_items
          (order_id, product_id, product_snapshot, size, color, qty, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                order.id, item.product_id, item.product_snapshot,
                item.size, item.color, item.qty,
                item.unit_price, item.total_price
            ).run();

            await env.DB.prepare(
                `UPDATE inventory
         SET stock = stock - ?, updated_at = datetime('now')
         WHERE product_id = ? AND size = ?`
            ).bind(item.qty, item.product_id, item.size).run();
        }

        // ── Increment coupon usage ────────────────────────────────────────────
        if (couponId) {
            await env.DB.prepare(
                'UPDATE coupons SET uses_count = uses_count + 1 WHERE id = ?'
            ).bind(couponId).run();
        }

        return created({
            order_number: order.order_number,
            order_id: order.id,
            total: order.total_amount,
            payment_status: 'paid',
            order_status: 'placed',
        }, 'Order placed successfully');

    } catch (e) {
        console.error('Order create error:', e);
        return serverError('Failed to create order: ' + (e.message || ''));
    }
}

// ── Customer: My Orders ────────────────────────────────────────────────────
async function handleMyOrders(request, env, params) {
    const { user, error: authErr } = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
        const page = Math.max(1, parseInt(params.get('page') || '1'));
        const limit = Math.min(50, parseInt(params.get('limit') || '10'));
        const offset = (page - 1) * limit;

        const [countRow, ordersRes] = await Promise.all([
            env.DB.prepare('SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?')
                .bind(user.id).first(),
            env.DB.prepare(
                `SELECT
           id, order_number, order_status, payment_status, payment_method,
           total_amount, shipping_amount, discount_amount,
           tracking_number, tracking_url,
           paid_at, delivered_at, cancelled_at, created_at,
           exchange_reason, exchange_product
         FROM orders
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
            ).bind(user.id, limit, offset).all(),
        ]);

        // Attach items preview for each order
        const orders = await Promise.all((ordersRes.results || []).map(async o => {
            const itemsRes = await env.DB.prepare(
                `SELECT product_snapshot, size, qty, unit_price FROM order_items WHERE order_id = ? LIMIT 4`
            ).bind(o.id).all();
            const items = (itemsRes.results || []).map(it => {
                let snap = {}; try { snap = JSON.parse(it.product_snapshot || '{}'); } catch { }
                return { name: snap.name, image: snap.image, size: it.size, qty: it.qty, price: it.unit_price };
            });
            return { ...formatOrder(o), items };
        }));

        const total = countRow?.cnt || 0;
        return list(orders, { page, limit, total, pages: Math.ceil(total / limit) });
    } catch (e) {
        console.error('My orders error:', e);
        return serverError('Failed to fetch orders');
    }
}

// ── Customer: Order Detail ─────────────────────────────────────────────────
async function handleMyOrderDetail(path, request, env) {
    const { user, error: authErr } = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.match(/(\d+)/)?.[1];
    try {
        const [order, itemsRes] = await Promise.all([
            env.DB.prepare(
                'SELECT * FROM orders WHERE id = ? AND user_id = ?'
            ).bind(id, user.id).first(),
            env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all(),
        ]);
        if (!order) return notFound('Order not found');
        const items = (itemsRes.results || []).map(formatItem);
        return ok(formatOrder(order, items));
    } catch (e) {
        return serverError('Failed to fetch order');
    }
}

// ── Public: Track by order number ─────────────────────────────────────────
async function handleTrack(path, env) {
    const orderNumber = path.replace('/track/', '');
    if (!orderNumber) return error('Order number required', 400);
    try {
        const order = await env.DB.prepare(
            `SELECT order_number, order_status, payment_status,
              tracking_number, tracking_url,
              shipped_at, out_for_delivery_at, delivered_at, created_at
       FROM orders WHERE order_number = ?`
        ).bind(orderNumber.toUpperCase()).first();
        if (!order) return notFound('Order not found');
        return ok(order);
    } catch (e) {
        return serverError('Tracking lookup failed');
    }
}

// ── Customer: Request Exchange ─────────────────────────────────────────────
async function handleExchangeRequest(path, request, env) {
    const { user, error: authErr } = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.match(/(\d+)/)?.[1];
    try {
        const order = await env.DB.prepare(
            'SELECT * FROM orders WHERE id = ? AND user_id = ?'
        ).bind(id, user.id).first();
        if (!order) return notFound('Order not found');

        // Only delivered orders can request exchange
        if (order.order_status !== 'delivered')
            return error('Exchange can only be requested for delivered orders', 400);

        // Check exchange window (default 7 days)
        const windowDays = 7;
        if (order.delivered_at) {
            const deliveredAt = new Date(order.delivered_at);
            const daysPassed = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
            if (daysPassed > windowDays)
                return error(`Exchange window of ${windowDays} days has expired`, 400);
        }

        const { reason, exchange_product } = await request.json();
        if (!reason?.trim()) return error('Exchange reason is required', 400);

        await env.DB.prepare(
            `UPDATE orders
       SET order_status = 'exchange_requested',
           exchange_reason  = ?,
           exchange_product = ?,
           updated_at = datetime('now')
       WHERE id = ?`
        ).bind(reason.trim(), exchange_product || null, id).run();

        return ok(null, 'Exchange request submitted successfully');
    } catch (e) {
        return serverError('Failed to submit exchange request');
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// ── Admin: List Orders (fast, all filters) ────────────────────────────────
async function handleAdminListOrders(request, env, params) {
    const { error: authErr } = await requireAdmin(request, env);
    if (authErr) return authErr;
    try {
        const page = Math.max(1, parseInt(params.get('page') || '1'));
        const limit = Math.min(100, parseInt(params.get('limit') || '20'));
        const offset = (page - 1) * limit;

        const status = params.get('status') || '';
        const source = params.get('source') || '';
        const payment = params.get('payment') || '';
        const method = params.get('method') || '';
        const q = params.get('q') || '';
        const dateFrom = params.get('from') || '';
        const dateTo = params.get('to') || '';

        const where = [];
        const binds = [];

        if (status) { where.push('o.order_status = ?'); binds.push(status); }
        if (source) { where.push('o.source = ?'); binds.push(source); }
        if (payment) { where.push('o.payment_status = ?'); binds.push(payment); }
        if (method) { where.push('o.payment_method LIKE ?'); binds.push(`%${method}%`); }
        if (q) {
            where.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR o.customer_phone LIKE ?)');
            const like = `%${q}%`;
            binds.push(like, like, like, like);
        }
        if (dateFrom) { where.push("o.created_at >= ?"); binds.push(dateFrom); }
        if (dateTo) { where.push("o.created_at <= ?"); binds.push(dateTo + 'T23:59:59'); }

        const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

        // Parallel count + data query
        const [countRow, ordersRes] = await Promise.all([
            env.DB.prepare(`SELECT COUNT(*) as cnt FROM orders o ${whereSQL}`)
                .bind(...binds).first(),
            env.DB.prepare(
                `SELECT
           o.id, o.order_number, o.order_status, o.payment_status, o.payment_method,
           o.customer_name, o.customer_email, o.customer_phone,
           o.city, o.state,
           o.total_amount, o.discount_amount, o.subtotal_amount,
           o.razorpay_order_id, o.razorpay_payment_id,
           o.source, o.coupon_code,
           o.tracking_number, o.tracking_url,
           o.paid_at, o.shipped_at, o.delivered_at, o.cancelled_at,
           o.exchange_reason, o.exchange_product,
           o.created_at, o.updated_at
         FROM orders o
         ${whereSQL}
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`
            ).bind(...binds, limit, offset).all(),
        ]);

        const total = countRow?.cnt || 0;
        const orders = (ordersRes.results || []).map(o => formatOrder(o, null));

        return list(orders, { page, limit, total, pages: Math.ceil(total / limit) });
    } catch (e) {
        console.error('Admin list orders error:', e);
        return serverError('Failed to fetch orders');
    }
}

// ── Admin: Stats Summary ──────────────────────────────────────────────────
async function handleAdminStats(request, env, params) {
    const { error: authErr } = await requireAdmin(request, env);
    if (authErr) return authErr;
    try {
        const days = parseInt(params.get('days') || '30');
        const from = params.get('from') || new Date(Date.now() - days * 864e5).toISOString();
        const to = params.get('to') || new Date().toISOString();

        const stats = await env.DB.prepare(
            `SELECT
         COUNT(*)                                                            as total_orders,
         SUM(CASE WHEN order_status = 'delivered'                 THEN 1 ELSE 0 END) as delivered,
         SUM(CASE WHEN order_status = 'placed'                    THEN 1 ELSE 0 END) as placed,
         SUM(CASE WHEN order_status = 'confirmed'                 THEN 1 ELSE 0 END) as confirmed,
         SUM(CASE WHEN order_status = 'shipped'                   THEN 1 ELSE 0 END) as shipped,
         SUM(CASE WHEN order_status = 'out_for_delivery'          THEN 1 ELSE 0 END) as out_for_delivery,
         SUM(CASE WHEN order_status = 'cancelled'                 THEN 1 ELSE 0 END) as cancelled,
         SUM(CASE WHEN order_status = 'exchange_requested'        THEN 1 ELSE 0 END) as exchange_requested,
         SUM(CASE WHEN order_status IN ('placed','confirmed','processing') THEN 1 ELSE 0 END) as unfulfilled,
         SUM(CASE WHEN payment_status = 'paid'                    THEN total_amount ELSE 0 END) as revenue,
         SUM(discount_amount)                                               as total_discount,
         COUNT(DISTINCT user_id)                                            as unique_customers
       FROM orders
       WHERE created_at BETWEEN ? AND ?`
        ).bind(from, to).first();

        return ok(stats);
    } catch (e) {
        return serverError('Failed to fetch stats');
    }
}

// ── Admin: Single Order Full Detail ──────────────────────────────────────
async function handleAdminOrderDetail(path, request, env) {
    const { error: authErr } = await requireAdmin(request, env);
    if (authErr) return authErr;
    const id = path.match(/(\d+)/)?.[1];
    try {
        const [order, itemsRes] = await Promise.all([
            env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first(),
            env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all(),
        ]);
        if (!order) return notFound('Order not found');
        const items = (itemsRes.results || []).map(formatItem);
        return ok(formatOrder(order, items));
    } catch (e) {
        return serverError('Failed to fetch order');
    }
}

// ── Admin: Update Order Status ─────────────────────────────────────────────
async function handleAdminUpdateStatus(path, request, env) {
    const { error: authErr } = await requireAdmin(request, env);
    if (authErr) return authErr;
    const id = path.match(/(\d+)/)?.[1];
    try {
        const body = await request.json();
        const { status, tracking_number, tracking_url, note } = body;

        if (!status) return error('Status is required', 400);

        // Fetch current order
        const current = await env.DB.prepare(
            'SELECT * FROM orders WHERE id = ?'
        ).bind(id).first();
        if (!current) return notFound('Order not found');

        const currentStatus = current.order_status;

        // ── Status transition validation ──────────────────────────────────────
        const VALID_TRANSITIONS = {
            placed: ['confirmed', 'cancelled'],
            confirmed: ['processing', 'shipped', 'cancelled'],
            processing: ['packed', 'shipped', 'cancelled'],
            packed: ['shipped', 'cancelled'],
            shipped: ['out_for_delivery', 'delivered', 'cancelled'],
            out_for_delivery: ['delivered'],
            delivered: [],  // terminal (exchange request comes from customer)
            cancelled: [],  // terminal
            exchange_requested: ['exchange_approved', 'exchange_rejected'],
            exchange_approved: [],  // terminal
            exchange_rejected: [],  // terminal
        };

        const allowed = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(status)) {
            return error(
                `Cannot transition from '${currentStatus}' to '${status}'. Allowed: [${allowed.join(', ') || 'none'}]`,
                422
            );
        }

        // ── Build dynamic SET clause ──────────────────────────────────────────
        const sets = ['order_status = ?', "updated_at = datetime('now')"];
        const binds = [status];

        // Stage timestamps
        const timestamps = {
            confirmed: 'confirmed_at',
            shipped: 'shipped_at',
            out_for_delivery: 'out_for_delivery_at',
            delivered: 'delivered_at',
            cancelled: 'cancelled_at',
        };
        if (timestamps[status]) {
            sets.push(`${timestamps[status]} = datetime('now')`);
        }

        // Tracking (only update if provided)
        if (tracking_number !== undefined && tracking_number !== null) {
            sets.push('tracking_number = ?');
            binds.push(tracking_number || null);
        }
        if (tracking_url !== undefined && tracking_url !== null) {
            sets.push('tracking_url = ?');
            binds.push(tracking_url || null);
        }

        // ── CRITICAL: Never touch Razorpay payment_status ─────────────────────
        // payment_status is ONLY updated by the payment verification endpoint.
        // Admin CANNOT change it if razorpay_payment_id is set.
        const isRazorpay = !!(current.razorpay_payment_id);
        if (!isRazorpay && body.payment_status) {
            // Non-Razorpay orders (POS/offline) — admin can update payment status
            sets.push('payment_status = ?');
            binds.push(body.payment_status);
        }
        // If Razorpay order and admin tried to change payment_status — silently ignore

        binds.push(id); // WHERE id = ?

        await env.DB.prepare(
            `UPDATE orders SET ${sets.join(', ')} WHERE id = ?`
        ).bind(...binds).run();

        // ── Return updated order ──────────────────────────────────────────────
        const updated = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
        return ok(formatOrder(updated), 'Order updated successfully');

    } catch (e) {
        console.error('Admin update status error:', e);
        return serverError('Failed to update order: ' + (e.message || ''));
    }
}

// ── Admin: Approve / Reject Exchange ──────────────────────────────────────
async function handleAdminExchange(path, request, env) {
    const { error: authErr } = await requireAdmin(request, env);
    if (authErr) return authErr;
    const id = path.match(/(\d+)/)?.[1];
    try {
        const { action } = await request.json();
        if (!['approve', 'reject'].includes(action))
            return error('action must be approve or reject', 400);

        const order = await env.DB.prepare(
            'SELECT * FROM orders WHERE id = ?'
        ).bind(id).first();
        if (!order) return notFound('Order not found');
        if (order.order_status !== 'exchange_requested')
            return error('Order is not in exchange_requested state', 400);

        const newStatus = action === 'approve' ? 'exchange_approved' : 'exchange_rejected';
        await env.DB.prepare(
            `UPDATE orders
       SET order_status = ?, updated_at = datetime('now')
       WHERE id = ?`
        ).bind(newStatus, id).run();

        return ok(null, `Exchange ${action}d successfully`);
    } catch (e) {
        return serverError('Failed to update exchange status');
    }
}