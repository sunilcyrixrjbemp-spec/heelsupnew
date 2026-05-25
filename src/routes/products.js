// worker/src/routes/products.js
import { requireAdmin } from '../middleware/auth.js';
import { ok, list, created, error, notFound, serverError } from '../utils/response.js';

function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
}

function safeJsonParse(str, fallback = []) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function mapProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    sku: p.sku || "",
    category: p.category || "",
    price: Number(p.price),
    original_price: p.original_price ? Number(p.original_price) : null,
    mrp: p.original_price ? Number(p.original_price) : null,
    stock: Number(p.stock || 0),
    active: !!p.active,
    is_active: !!p.active,
    featured: !!p.featured,
    is_featured: !!p.featured,
    is_new: !!p.is_new,
    is_trending: !!p.is_trending,
    rating: Number(p.rating || 4.5),
    review_count: Number(p.review_count || 0),
    sold_count: Number(p.sold_count || 0),
    sales: Number(p.sold_count || 0),
    sales_count: Number(p.sold_count || 0),
    gst_percent: Number(p.gst_percent || 0),
    category_id: p.category_id || null,
    description: p.description || "",
    sizes: safeJsonParse(p.sizes_json, []),
    images: safeJsonParse(p.images_json, p.image_url ? [p.image_url] : []),
  };
}

export async function productsRouter(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/products', '') || '/';
    const method = request.method;
    const params = url.searchParams;

    // GET /api/products — public listing with filters
    if (path === '/' && method === 'GET') {
        try {
            const page = parseInt(params.get('page') || '1');
            const limit = Math.min(parseInt(params.get('limit') || '20'), 100);
            const offset = (page - 1) * limit;
            const cat = params.get('cat') || params.get('category');
            const featured = params.get('featured');
            const isNew = params.get('is_new');
            const trending = params.get('trending');
            const search = params.get('q') || params.get('search');
            const sort = params.get('sort') || 'newest';
            const tag = params.get('tag');
            const minPrice = params.get('min_price');
            const maxPrice = params.get('max_price');

            let where = ['p.active = 1'];
            let binds = [];

            if (cat) {
                where.push('LOWER(p.category) = LOWER(?)');
                binds.push(cat);
            }
            if (featured === 'true' || featured === '1') {
                where.push('p.featured = 1');
            }
            if (isNew === 'true' || isNew === '1') {
                where.push('p.is_new = 1');
            }
            if (trending === 'true' || trending === '1') {
                where.push('p.is_trending = 1');
            }
            if (search) {
                where.push("(p.name LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)");
                binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (tag) {
                where.push("p.tags LIKE ?");
                binds.push(`%"${tag}"%`);
            }
            if (minPrice) {
                where.push('p.price >= ?');
                binds.push(parseFloat(minPrice));
            }
            if (maxPrice) {
                where.push('p.price <= ?');
                binds.push(parseFloat(maxPrice));
            }

            const sortMap = {
                newest: 'p.id DESC',
                oldest: 'p.id ASC',
                price_low: 'p.price ASC',
                price_high: 'p.price DESC',
                name: 'p.name ASC',
            };
            const orderBy = sortMap[sort] || 'p.id DESC';
            const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

            const countResult = await env.DB.prepare(
                `SELECT COUNT(*) as total FROM products p ${whereStr}`
            ).bind(...binds).first();

            const productsRes = await env.DB.prepare(
                `SELECT p.*,
                (SELECT ROUND(AVG(rating),1) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') as avg_rating,
                (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') as review_count
          FROM products p
          ${whereStr}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`
            ).bind(...binds, limit, offset).all();

            const products = (productsRes.results || []).map(mapProduct);

            return list(products, {
                page, limit,
                total: countResult.total,
                pages: Math.ceil(countResult.total / limit)
            });
        } catch (e) {
            console.error('Products list error:', e);
            return serverError('Failed to fetch products');
        }
    }

    // GET /api/products/slug/:slug
    if (path.startsWith('/slug/') && method === 'GET') {
        const productSlug = path.replace('/slug/', '');
        try {
            const allProducts = await env.DB.prepare("SELECT id, name FROM products WHERE active = 1").all();
            const matched = (allProducts.results || []).find(p => slug(p.name) === productSlug);
            if (!matched) return notFound('Product not found');
            const id = matched.id;

            const product = await env.DB.prepare(
                `SELECT p.*,
                (SELECT ROUND(AVG(rating),1) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') as avg_rating,
                (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') as review_count
         FROM products p
         WHERE p.id = ? AND p.active = 1`
            ).bind(id).first();
            if (!product) return notFound('Product not found');

            const reviews = await env.DB.prepare(
                `SELECT r.id, r.rating, r.title, r.body, r.created_at, (u.first_name || ' ' || COALESCE(u.last_name, '')) as reviewer_name
         FROM product_reviews r LEFT JOIN users u ON r.user_id = u.id
         WHERE r.product_id = ? AND r.status = 'approved'
         ORDER BY r.created_at DESC LIMIT 10`
            ).bind(product.id).all();

            const images = await env.DB.prepare(
                "SELECT id, url, alt, sort_order, is_primary FROM product_images WHERE product_id=? ORDER BY sort_order ASC, id ASC"
            ).bind(product.id).all();

            const related = await env.DB.prepare(
                "SELECT * FROM products WHERE category=? AND id!=? AND active=1 ORDER BY featured DESC LIMIT 4"
            ).bind(product.category, product.id).all();

            return ok({
                product: mapProduct(product),
                reviews: reviews.results || [],
                images: images.results || [],
                related: (related.results || []).map(mapProduct)
            });
        } catch (e) {
            console.error('Slug fetch error:', e);
            return serverError('Failed to fetch product');
        }
    }

    // GET /api/products/:id
    if (path.match(/^\/\d+$/) && method === 'GET') {
        const id = parseInt(path.slice(1));
        try {
            const product = await env.DB.prepare(
                `SELECT p.*,
                (SELECT ROUND(AVG(rating),1) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') as avg_rating,
                (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') as review_count
         FROM products p
         WHERE p.id = ? AND p.active = 1`
            ).bind(id).first();
            if (!product) return notFound('Product not found');

            const reviews = await env.DB.prepare(
                `SELECT r.id, r.rating, r.title, r.body, r.created_at, (u.first_name || ' ' || COALESCE(u.last_name, '')) as reviewer_name
         FROM product_reviews r LEFT JOIN users u ON r.user_id = u.id
         WHERE r.product_id = ? AND r.status = 'approved'
         ORDER BY r.created_at DESC LIMIT 10`
            ).bind(id).all();

            const images = await env.DB.prepare(
                "SELECT id, url, alt, sort_order, is_primary FROM product_images WHERE product_id=? ORDER BY sort_order ASC, id ASC"
            ).bind(id).all();

            return ok({
                product: mapProduct(product),
                reviews: reviews.results || [],
                images: images.results || []
            });
        } catch (e) {
            console.error('ID fetch error:', e);
            return serverError('Failed to fetch product');
        }
    }

    // POST /api/products — admin only
    if (path === '/' && method === 'POST') {
        const { error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        try {
            const body = await request.json();
            const { name, sku, category, description, price, mrp, stock, sizes, images, brand, tags, is_new, is_trending, is_featured, meta_title, meta_desc } = body;
            if (!name || !sku || !price) return error('Name, SKU and price are required');

            const result = await env.DB.prepare(
                `INSERT INTO products (name, sku, category, description, price, original_price, stock, active, featured, is_new, is_trending, sizes_json, images_json, brand, tags, meta_title, meta_description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')) RETURNING *`
            ).bind(
                name, sku, category || null, description || null,
                parseFloat(price), mrp ? parseFloat(mrp) : null,
                parseInt(stock || 0), is_featured ? 1 : 0, is_new ? 1 : 0, is_trending ? 1 : 0,
                JSON.stringify(sizes || []), JSON.stringify(images || []),
                brand || null, JSON.stringify(tags || []),
                meta_title || null, meta_desc || null
            ).first();

            return created(mapProduct(result), 'Product created');
        } catch (e) {
            console.error('Create product error:', e);
            if (e.message?.includes('UNIQUE')) return error('SKU already exists', 409);
            return serverError('Failed to create product');
        }
    }

    // PUT /api/products/:id — admin only
    if (path.match(/^\/\d+$/) && method === 'PUT') {
        const { error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = parseInt(path.slice(1));
        try {
            const body = await request.json();
            const { name, category, description, price, mrp, stock, sizes, images, brand, tags, is_new, is_trending, is_featured, meta_title, meta_desc } = body;

            await env.DB.prepare(
                `UPDATE products SET name=?, category=?, description=?, price=?, original_price=?, stock=?,
         sizes_json=?, images_json=?, brand=?, tags=?, is_new=?, is_trending=?, featured=?,
         meta_title=?, meta_description=?, updated_at=datetime('now') WHERE id=?`
            ).bind(
                name, category || null, description || null, parseFloat(price), mrp ? parseFloat(mrp) : null, parseInt(stock || 0),
                JSON.stringify(sizes || []), JSON.stringify(images || []),
                brand || null, JSON.stringify(tags || []),
                is_new ? 1 : 0, is_trending ? 1 : 0, is_featured ? 1 : 0,
                meta_title || null, meta_desc || null, id
            ).run();

            const product = await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(id).first();
            return ok(mapProduct(product), 'Product updated');
        } catch (e) {
            console.error('Update product error:', e);
            return serverError('Failed to update product');
        }
    }

    // PATCH /api/products/:id — admin toggle/status/stock update
    if (path.match(/^\/\d+$/) && method === 'PATCH') {
        const { error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = parseInt(path.slice(1));
        try {
            const body = await request.json();
            const updates = [];
            const binds = [];

            if (body.stock !== undefined) {
                updates.push("stock=?");
                binds.push(Math.max(0, parseInt(body.stock)));
            }
            if (body.active !== undefined) {
                updates.push("active=?");
                binds.push(body.active ? 1 : 0);
            } else if (body.is_active !== undefined) {
                updates.push("active=?");
                binds.push(body.is_active ? 1 : 0);
            }
            if (body.featured !== undefined) {
                updates.push("featured=?");
                binds.push(body.featured ? 1 : 0);
            } else if (body.is_featured !== undefined) {
                updates.push("featured=?");
                binds.push(body.is_featured ? 1 : 0);
            }
            if (body.is_new !== undefined) {
                updates.push("is_new=?");
                binds.push(body.is_new ? 1 : 0);
            }
            if (body.is_trending !== undefined) {
                updates.push("is_trending=?");
                binds.push(body.is_trending ? 1 : 0);
            }

            if (!updates.length) return error("No valid fields to update", 400);

            // Log inventory change if stock is updated
            if (body.stock !== undefined) {
                const prod = await env.DB.prepare("SELECT id, name, stock FROM products WHERE id=?").bind(id).first();
                if (prod) {
                    const newStock = Math.max(0, parseInt(body.stock));
                    const diff = newStock - (prod.stock || 0);
                    await env.DB.prepare(
                        "INSERT INTO inventory_log (product_id, product_name, change_type, quantity_before, quantity_change, quantity_after, reason, created_at) VALUES (?,?,'adjustment',?,?,?,?,datetime('now'))"
                    ).bind(prod.id, prod.name, prod.stock || 0, diff, newStock, String(body.reason || "Admin adjustment")).run();
                }
            }

            updates.push("updated_at=datetime('now')");
            binds.push(id);

            await env.DB.prepare(
                `UPDATE products SET ${updates.join(', ')} WHERE id=?`
            ).bind(...binds).run();

            const product = await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(id).first();
            return ok(mapProduct(product), 'Product updated');
        } catch (e) {
            console.error('PATCH product error:', e);
            return serverError('Failed to patch product');
        }
    }

    // DELETE /api/products/:id — admin only
    if (path.match(/^\/\d+$/) && method === 'DELETE') {
        const { error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = parseInt(path.slice(1));
        try {
            await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
            return ok(null, 'Product deleted');
        } catch (e) {
            console.error('Delete product error:', e);
            return serverError('Failed to delete product');
        }
    }

    return error('Route not found', 404);
}