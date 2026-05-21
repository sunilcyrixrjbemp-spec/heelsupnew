// worker/src/routes/products.js
import { requireAdmin, optionalAuth } from '../middleware/auth.js';
import { ok, list, created, error, notFound, serverError } from '../utils/response.js';

function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
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
            const search = params.get('q') || params.get('search');
            const sort = params.get('sort') || 'newest';
            const tag = params.get('tag');
            const minPrice = params.get('min_price');
            const maxPrice = params.get('max_price');

            let where = ['p.is_active = 1'];
            let binds = [];

            if (cat) {
                where.push('c.slug = ?');
                binds.push(cat);
            }
            if (featured === 'true' || featured === '1') {
                where.push('p.is_featured = 1');
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
                binds.push(parseInt(minPrice) * 100);
            }
            if (maxPrice) {
                where.push('p.price <= ?');
                binds.push(parseInt(maxPrice) * 100);
            }

            const sortMap = {
                newest: 'p.created_at DESC',
                oldest: 'p.created_at ASC',
                price_low: 'p.price ASC',
                price_high: 'p.price DESC',
                name: 'p.name ASC',
            };
            const orderBy = sortMap[sort] || 'p.created_at DESC';
            const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

            const countResult = await env.DB.prepare(
                `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereStr}`
            ).bind(...binds).first();

            const products = await env.DB.prepare(
                `SELECT p.id, p.sku, p.name, p.slug, p.description, p.price, p.mrp, p.images, p.sizes, p.colors, p.tags, p.is_featured,
                c.name as category_name, c.slug as category_slug,
                (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = 1) as avg_rating,
                (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = 1) as review_count,
                (SELECT SUM(stock) FROM inventory inv WHERE inv.product_id = p.id) as total_stock
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${whereStr}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
            ).bind(...binds, limit, offset).all();

            return list(products.results, {
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
            const product = await env.DB.prepare(
                `SELECT p.*, c.name as category_name, c.slug as category_slug,
                (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = 1) as avg_rating,
                (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = 1) as review_count
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.slug = ? AND p.is_active = 1`
            ).bind(productSlug).first();
            if (!product) return notFound('Product not found');

            // Get inventory
            const inventory = await env.DB.prepare(
                'SELECT size, color, stock FROM inventory WHERE product_id = ?'
            ).bind(product.id).all();

            // Get reviews
            const reviews = await env.DB.prepare(
                `SELECT r.id, r.rating, r.title, r.body, r.is_verified, r.created_at, u.name as reviewer_name
         FROM reviews r LEFT JOIN users u ON r.user_id = u.id
         WHERE r.product_id = ? AND r.is_approved = 1
         ORDER BY r.created_at DESC LIMIT 10`
            ).bind(product.id).all();

            return ok({ ...product, inventory: inventory.results, reviews: reviews.results });
        } catch (e) {
            return serverError('Failed to fetch product');
        }
    }

    // GET /api/products/:id
    if (path.match(/^\/\d+$/) && method === 'GET') {
        const id = path.slice(1);
        try {
            const product = await env.DB.prepare(
                `SELECT p.*, c.name as category_name, c.slug as category_slug,
                (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = 1) as avg_rating
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ? AND p.is_active = 1`
            ).bind(id).first();
            if (!product) return notFound('Product not found');

            const inventory = await env.DB.prepare('SELECT size, color, stock FROM inventory WHERE product_id = ?').bind(id).all();
            return ok({ ...product, inventory: inventory.results });
        } catch (e) {
            return serverError('Failed to fetch product');
        }
    }

    // POST /api/products — admin only
    if (path === '/' && method === 'POST') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        try {
            const body = await request.json();
            const { name, sku, description, category_id, price, mrp, cost_price, images, sizes, colors, tags, weight_grams, is_featured, meta_title, meta_desc } = body;
            if (!name || !sku || !price) return error('Name, SKU and price are required');

            const productSlug = slug(name);
            const result = await env.DB.prepare(
                `INSERT INTO products (sku, name, slug, description, category_id, price, mrp, cost_price, images, sizes, colors, tags, weight_grams, is_featured, meta_title, meta_desc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
            ).bind(
                sku, name, productSlug, description || null, category_id || null,
                price, mrp || null, cost_price || null,
                JSON.stringify(images || []), JSON.stringify(sizes || []),
                JSON.stringify(colors || []), JSON.stringify(tags || []),
                weight_grams || null, is_featured ? 1 : 0,
                meta_title || null, meta_desc || null
            ).first();

            // Insert inventory rows
            if (sizes && sizes.length > 0) {
                for (const size of sizes) {
                    await env.DB.prepare(
                        'INSERT OR IGNORE INTO inventory (product_id, size, stock) VALUES (?, ?, 0)'
                    ).bind(result.id, size).run();
                }
            }

            return created(result, 'Product created');
        } catch (e) {
            if (e.message?.includes('UNIQUE')) return error('SKU or slug already exists', 409);
            return serverError('Failed to create product');
        }
    }

    // PUT /api/products/:id — admin only
    if (path.match(/^\/\d+$/) && method === 'PUT') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = path.slice(1);
        try {
            const body = await request.json();
            const { name, description, category_id, price, mrp, cost_price, images, sizes, colors, tags, weight_grams, is_active, is_featured, meta_title, meta_desc } = body;

            await env.DB.prepare(
                `UPDATE products SET name=?, description=?, category_id=?, price=?, mrp=?, cost_price=?,
         images=?, sizes=?, colors=?, tags=?, weight_grams=?, is_active=?, is_featured=?,
         meta_title=?, meta_desc=?, updated_at=datetime('now') WHERE id=?`
            ).bind(
                name, description, category_id, price, mrp, cost_price,
                JSON.stringify(images || []), JSON.stringify(sizes || []),
                JSON.stringify(colors || []), JSON.stringify(tags || []),
                weight_grams, is_active ? 1 : 0, is_featured ? 1 : 0,
                meta_title, meta_desc, id
            ).run();

            return ok(null, 'Product updated');
        } catch (e) {
            return serverError('Failed to update product');
        }
    }

    // PATCH /api/products/:id/toggle — admin toggle active
    if (path.match(/^\/\d+\/toggle$/) && method === 'PATCH') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = path.match(/(\d+)/)[1];
        await env.DB.prepare(
            "UPDATE products SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END, updated_at=datetime('now') WHERE id=?"
        ).bind(id).run();
        return ok(null, 'Product status toggled');
    }

    // DELETE /api/products/:id — admin only
    if (path.match(/^\/\d+$/) && method === 'DELETE') {
        const { user, error: authError } = await requireAdmin(request, env);
        if (authError) return authError;
        const id = path.slice(1);
        await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
        return ok(null, 'Product deleted');
    }

    return error('Route not found', 404);
}