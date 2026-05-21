// ============================================================
// HeelsUp — Razorpay Payment Routes
// POST /api/payment/create-order   → Razorpay order banao
// POST /api/payment/verify         → Signature verify + order confirm
// POST /api/payment/webhook        → Razorpay webhook (server-side events)
// GET  /api/payment/key            → Public key frontend ko do
// ============================================================

import { razorpay } from '../utils/razorpay.js';
import { ok, error as err }  from '../utils/response.js';
import { optionalAuth } from '../middleware/auth.js';

export async function paymentRouter(request, env) {
  const url     = new URL(request.url);
  const path    = url.pathname.replace('/api/payment', '');
  const method  = request.method;

  // ── GET /api/payment/key ─────────────────────────────────
  if (method === 'GET' && path === '/key') {
    return ok({ key_id: env.RAZORPAY_KEY_ID });
  }

  // ── POST /api/payment/create-order ───────────────────────
  if (method === 'POST' && path === '/create-order') {
    // JWT auth required
    const user = await optionalAuth(request, env);
    if (!user) return err('Unauthorized', 401);

    let body;
    try { body = await request.json(); }
    catch { return err('Invalid JSON', 400); }

    const { cart_items, address_id, coupon_code } = body;

    if (!cart_items?.length) return err('Cart is empty', 400);
    if (!address_id)         return err('Address required', 400);

    // ── Recalculate total server-side (NEVER trust frontend amount) ──
    const productIds = cart_items.map(i => i.product_id);
    const placeholders = productIds.map(() => '?').join(',');
    const products = await env.DB
      .prepare(`SELECT id, price, is_active FROM products WHERE id IN (${placeholders}) AND is_active = 1`)
      .bind(...productIds)
      .all();

    if (products.results.length !== cart_items.length)
      return err('One or more products unavailable', 400);

    const priceMap = {};
    products.results.forEach(p => { priceMap[p.id] = p.price; });

    let subtotal = 0;
    for (const item of cart_items) {
      if (!priceMap[item.product_id]) return err(`Product ${item.product_id} not found`, 400);
      subtotal += priceMap[item.product_id] * (item.qty || 1);
    }

    // Coupon discount
    let discount = 0;
    if (coupon_code) {
      const coupon = await env.DB
        .prepare(`SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND
                  (expires_at IS NULL OR expires_at > datetime('now')) AND
                  (usage_limit IS NULL OR used_count < usage_limit)`)
        .bind(coupon_code.toUpperCase())
        .first();

      if (coupon) {
        if (coupon.type === 'percent') {
          discount = Math.round(subtotal * coupon.value / 100);
          if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
        } else {
          discount = coupon.value;
        }
      }
    }

    const total = Math.max(subtotal - discount, 0); // in paise

    // ── Create Razorpay Order ────────────────────────────────
    const rzpOrder = await razorpay.createOrder(env, {
      amount:   total,          // paise
      currency: 'INR',
      receipt:  `hu_${Date.now()}`,
      notes: {
        user_id:    user.id,
        address_id: address_id,
      },
    });

    if (!rzpOrder.id) return err('Payment gateway error', 502);

    // ── Save pending order in DB ─────────────────────────────
    const orderNum = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const newOrder = await env.DB
      .prepare(`INSERT INTO orders
        (order_number, user_id, address_id, subtotal, discount, total,
         payment_method, payment_status, status, razorpay_order_id, items_json)
        VALUES (?,?,?,?,?,?,'razorpay','pending','pending',?,?)`)
      .bind(
        orderNum,
        user.id,
        address_id,
        subtotal,
        discount,
        total,
        rzpOrder.id,
        JSON.stringify(cart_items),
      )
      .run();

    return ok({
      razorpay_order_id: rzpOrder.id,
      amount:            total,
      currency:          'INR',
      order_number:      orderNum,
      order_db_id:       newOrder.meta.last_row_id,
      key_id:            env.RAZORPAY_KEY_ID,
    });
  }

  // ── POST /api/payment/verify ─────────────────────────────
  if (method === 'POST' && path === '/verify') {
    const user = await optionalAuth(request, env);
    if (!user) return err('Unauthorized', 401);

    let body;
    try { body = await request.json(); }
    catch { return err('Invalid JSON', 400); }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return err('Missing payment fields', 400);

    // ── HMAC-SHA256 Signature Verification ──────────────────
    const isValid = await razorpay.verifySignature(env, {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValid) return err('Invalid payment signature', 400);

    // ── Update order to paid ─────────────────────────────────
    await env.DB
      .prepare(`UPDATE orders SET
        payment_status = 'paid',
        status = 'processing',
        razorpay_payment_id = ?,
        razorpay_signature = ?,
        paid_at = datetime('now'),
        updated_at = datetime('now')
        WHERE razorpay_order_id = ? AND user_id = ?`)
      .bind(razorpay_payment_id, razorpay_signature, razorpay_order_id, user.id)
      .run();

    // Fetch updated order
    const order = await env.DB
      .prepare(`SELECT * FROM orders WHERE razorpay_order_id = ?`)
      .bind(razorpay_order_id)
      .first();

    // Decrement inventory
    if (order?.items_json) {
      const items = JSON.parse(order.items_json);
      for (const item of items) {
        await env.DB
          .prepare(`UPDATE inventory SET stock = MAX(0, stock - ?)
                    WHERE product_id = ? AND size = ?`)
          .bind(item.qty || 1, item.product_id, item.size || '')
          .run();
      }
    }

    // Clear coupon usage if used
    if (order?.coupon_code) {
      await env.DB
        .prepare(`UPDATE coupons SET used_count = used_count + 1 WHERE code = ?`)
        .bind(order.coupon_code)
        .run();
    }

    return ok({
      success:      true,
      order_number: order?.order_number,
      order_id:     order?.id,
      message:      'Payment successful! Order placed.',
    });
  }

  // ── POST /api/payment/webhook ────────────────────────────
  // Razorpay Dashboard → Webhooks → URL: https://heelsup.in/api/payment/webhook
  if (method === 'POST' && path === '/webhook') {
    const signature = request.headers.get('x-razorpay-signature');
    const rawBody   = await request.text();

    const isValid = await razorpay.verifyWebhook(env, rawBody, signature);
    if (!isValid) return err('Invalid webhook signature', 400);

    const event = JSON.parse(rawBody);

    if (event.event === 'payment.failed') {
      const rzpOrderId = event.payload?.payment?.entity?.order_id;
      if (rzpOrderId) {
        await env.DB
          .prepare(`UPDATE orders SET payment_status = 'failed', status = 'cancelled',
                    updated_at = datetime('now') WHERE razorpay_order_id = ?`)
          .bind(rzpOrderId)
          .run();
      }
    }

    return ok({ received: true });
  }

  return err('Not found', 404);
}
