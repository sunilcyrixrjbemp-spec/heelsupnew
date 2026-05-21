// src/index.js - Updated HeelsUp Cloudflare Worker
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
import { json } from './utils/response.js';

export default {
  async fetch(request, env, ctx) {
    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 2. Health check (API)
    if (path === '/api/health') {
      return addCors(json({ success: true, message: 'HeelsUp API is running!', ts: new Date().toISOString() }), request);
    }

    // 3. API Router Logic
    if (path.startsWith('/api/')) {
      let response;
      try {
        if (path.startsWith('/api/auth')) response = await authRouter(request, env);
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
        else if (path.startsWith('/api/contact')) response = await contactRouter(request, env);
        else if (path.startsWith('/api/newsletter')) response = await newsletterRouter(request, env);
        else if (path.startsWith('/api/inventory')) response = await inventoryRouter(request, env);
        else if (path.startsWith('/api/reports')) response = await handleReports(request, env, path, request.method);
        else response = json({ success: false, error: 'API route not found' }, 404);
      } catch (err) {
        console.error('API Error:', err);
        response = json({ success: false, error: 'Internal server error' }, 500);
      }
      return addCors(response, request);
    }

    // 4. Static File/Frontend Handler (If not an API call)
    // This looks for your files in the public folder automatically via Cloudflare Assets
    return env.ASSETS.fetch(request);
  },
};
