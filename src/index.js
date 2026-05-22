// src/index.js - HeelsUp Cloudflare Worker (Fixed with /api/admin/* aliases)
import { handleOptions, addCors } from './middleware/cors.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { ordersRouter } from './routes/orders.js';
import { customersRouter } from './routes/customers.js';
import { cartRouter } from './routes/cart.js';
import { wishlistRouter } from './routes/wishlist.js';
import { categoriesRouter } from './routes/categories.js';
import { couponsRouter } from './routes/coupons.js';
import { reviewsRouter } from './routes/reviews.js';
import { uploadRouter } from './routes/upload.js';
import { paymentRouter } from './routes/payment.js';
import { posRouter } from './routes/pos.js';
import { analyticsRouter } from './routes/analytics.js';
import { bannersRouter } from './routes/banners.js';
import { staffRouter } from './routes/staff.js';
import { settingsRouter } from './routes/settings.js';
import { contactRouter, newsletterRouter, inventoryRouter } from './routes/misc.js';
import { handleReports } from './routes/reports.js';
import { handleNotifications } from './routes/notifications.js';
import { handleShipping } from './routes/shipping.js';
import { json } from './utils/response.js';

// ── Admin alias helper ────────────────────────────────────────────────────────
// Frontend uses /api/admin/* — backend has routes at /api/* — this bridges them.
// It rewrites the URL path so existing routers work unchanged.
function rewriteAdminPath(request, fromPrefix, toPrefix) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(fromPrefix, toPrefix);
  return new Request(url.toString(), request);
}

export default {
  async fetch(request, env, ctx) {
    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 2. Health check
    if (path === '/api/health') {
      return addCors(json({ success: true, message: 'HeelsUp API is running!', ts: new Date().toISOString() }), request);
    }

    // 3. API Router Logic
    if (path.startsWith('/api/')) {
      let response;
      try {

        // ── /api/admin/* aliases ── (frontend uses these paths)
        // Each alias rewrites to the actual backend path

        if (path.startsWith('/api/admin/reviews')) {
          // GET /api/admin/reviews -> /api/reviews/admin/all
          // PUT /api/admin/reviews/:id (status=approved) -> PATCH /api/reviews/:id/approve
          // PUT /api/admin/reviews/:id (status=rejected) -> DELETE /api/reviews/:id  [hide]
          // DELETE /api/admin/reviews/:id -> DELETE /api/reviews/:id
          const reviewIdMatch = path.match(/\/api\/admin\/reviews\/(\d+)/);
          if (method === 'GET' && !reviewIdMatch) {
            // List all reviews
            const url2 = new URL(request.url);
            url2.pathname = '/api/reviews/admin/all';
            response = await reviewsRouter(new Request(url2.toString(), request), env);
          } else if (reviewIdMatch && (method === 'PUT' || method === 'PATCH')) {
            // Frontend sends PUT with { status: 'approved' | 'rejected', reply }
            // Backend expects PATCH /:id/approve OR DELETE /:id
            let body = {};
            try { body = await request.clone().json(); } catch (_) { }
            const id = reviewIdMatch[1];
            if (body.status === 'approved') {
              const url2 = new URL(request.url);
              url2.pathname = `/api/reviews/${id}/approve`;
              response = await reviewsRouter(new Request(url2.toString(), { method: 'PATCH', headers: request.headers }), env);
            } else {
              // hidden/rejected -> delete
              const url2 = new URL(request.url);
              url2.pathname = `/api/reviews/${id}`;
              response = await reviewsRouter(new Request(url2.toString(), { method: 'DELETE', headers: request.headers }), env);
            }
          } else if (reviewIdMatch && method === 'DELETE') {
            const id = reviewIdMatch[1];
            const url2 = new URL(request.url);
            url2.pathname = `/api/reviews/${id}`;
            response = await reviewsRouter(new Request(url2.toString(), { method: 'DELETE', headers: request.headers }), env);
          } else {
            const rewritten = rewriteAdminPath(request, '/api/admin/reviews', '/api/reviews/admin');
            response = await reviewsRouter(rewritten, env);
          }
        }
        else if (path.startsWith('/api/admin/orders')) {
          const rewritten = rewriteAdminPath(request, '/api/admin/orders', '/api/orders');
          response = await ordersRouter(rewritten, env);
        }
        else if (path.startsWith('/api/admin/products')) {
          const rewritten = rewriteAdminPath(request, '/api/admin/products', '/api/products');
          response = await productsRouter(rewritten, env);
        }
        else if (path.startsWith('/api/admin/customers')) {
          const rewritten = rewriteAdminPath(request, '/api/admin/customers', '/api/customers');
          response = await customersRouter(rewritten, env);
        }
        else if (path.startsWith('/api/admin/banners')) {
          const rewritten = rewriteAdminPath(request, '/api/admin/banners', '/api/banners');
          response = await bannersRouter(rewritten, env);
        }
        else if (path.startsWith('/api/admin/categories')) {
          const rewritten = rewriteAdminPath(request, '/api/admin/categories', '/api/categories');
          response = await categoriesRouter(rewritten, env);
        }
        else if (path.startsWith('/api/admin/coupons')) {
          const rewritten = rewriteAdminPath(request, '/api/admin/coupons', '/api/coupons');
          response = await couponsRouter(rewritten, env);
        }
        else if (path.startsWith('/api/admin/staff')) {
          const rewritten = rewriteAdminPath(request, '/api/admin/staff', '/api/staff');
          response = await staffRouter(rewritten, env);
        }
        else if (path.startsWith('/api/admin/settings')) {
          const rewritten = rewriteAdminPath(request, '/api/admin/settings', '/api/settings');
          response = await settingsRouter(rewritten, env);
        }
        else if (path.startsWith('/api/admin/notifications')) {
          // /api/admin/notifications -> /api/notifications/admin/all
          // /api/admin/notifications/read-all -> /api/notifications/read-all
          let newPath = path.replace('/api/admin/notifications', '/api/notifications');
          if (newPath === '/api/notifications') newPath = '/api/notifications/admin/all';
          const url2 = new URL(request.url);
          url2.pathname = newPath;
          const rewritten = new Request(url2.toString(), request);
          response = await handleNotifications(rewritten, env, newPath, method);
        }
        else if (path.startsWith('/api/admin/shipping')) {
          const newPath = path.replace('/api/admin/shipping', '/api/shipping');
          const url2 = new URL(request.url);
          url2.pathname = newPath;
          const rewritten = new Request(url2.toString(), request);
          response = await handleShipping(rewritten, env, newPath, method);
        }
        else if (path.startsWith('/api/admin/inventory')) {
          const rewritten = rewriteAdminPath(request, '/api/admin/inventory', '/api/inventory');
          response = await inventoryRouter(rewritten, env);
        }
        else if (path.startsWith('/api/admin/reports') || path.startsWith('/api/admin/analytics')) {
          const newPath = path.replace('/api/admin/analytics', '/api/analytics').replace('/api/admin/reports', '/api/reports');
          const url2 = new URL(request.url);
          url2.pathname = newPath;
          const rewritten = new Request(url2.toString(), request);
          if (newPath.startsWith('/api/analytics')) response = await analyticsRouter(rewritten, env);
          else response = await handleReports(rewritten, env, newPath, method);
        }
        // Stubs for features not yet built (returns 200 with empty data so frontend doesn't crash)
        else if (path.startsWith('/api/admin/blogs')) {
          response = json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } });
        }
        else if (path.startsWith('/api/admin/collections')) {
          response = json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } });
        }
        else if (path.startsWith('/api/admin/pages')) {
          response = json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } });
        }
        else if (path.startsWith('/api/admin/taxes')) {
          if (path.includes('/rules')) response = json({ success: true, data: [] });
          else if (path.includes('/settings')) response = json({ success: true, data: { enabled: false, inclusive: true } });
          else response = json({ success: true, data: [] });
        }
        else if (path.startsWith('/api/admin/returns')) {
          response = json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } });
        }

        // ── Standard routes ──────────────────────────────────────────────────
        else if (path.startsWith('/api/auth')) response = await authRouter(request, env);
        else if (path.startsWith('/api/products')) response = await productsRouter(request, env);
        else if (path.startsWith('/api/orders')) response = await ordersRouter(request, env);
        else if (path.startsWith('/api/customers')) response = await customersRouter(request, env);
        else if (path.startsWith('/api/cart')) response = await cartRouter(request, env);
        else if (path.startsWith('/api/wishlist')) response = await wishlistRouter(request, env);
        else if (path.startsWith('/api/categories')) response = await categoriesRouter(request, env);
        else if (path.startsWith('/api/coupons')) response = await couponsRouter(request, env);
        else if (path.startsWith('/api/reviews')) response = await reviewsRouter(request, env);
        else if (path.startsWith('/api/upload')) response = await uploadRouter(request, env);
        else if (path.startsWith('/api/payment')) response = await paymentRouter(request, env);
        else if (path.startsWith('/api/pos')) response = await posRouter(request, env);
        else if (path.startsWith('/api/analytics')) response = await analyticsRouter(request, env);
        else if (path.startsWith('/api/banners')) response = await bannersRouter(request, env);
        else if (path.startsWith('/api/staff')) response = await staffRouter(request, env);
        else if (path.startsWith('/api/settings')) response = await settingsRouter(request, env);
        else if (path.startsWith('/api/notifications')) response = await handleNotifications(request, env, path, method);
        else if (path.startsWith('/api/shipping')) response = await handleShipping(request, env, path, method);
        else if (path.startsWith('/api/contact')) response = await contactRouter(request, env);
        else if (path.startsWith('/api/newsletter')) response = await newsletterRouter(request, env);
        else if (path.startsWith('/api/inventory')) response = await inventoryRouter(request, env);
        else if (path.startsWith('/api/reports')) response = await handleReports(request, env, path, method);
        else response = json({ success: false, error: 'API route not found' }, 404);

      } catch (err) {
        console.error('API Error:', err);
        response = json({ success: false, error: 'Internal server error' }, 500);
      }
      return addCors(response, request);
    }

    // 4. Static files via Cloudflare Assets
    return env.ASSETS.fetch(request);
  },
};