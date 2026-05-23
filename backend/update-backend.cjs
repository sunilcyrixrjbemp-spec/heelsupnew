const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');

// 1. Add schema upgrade
const upgradeIndex = content.indexOf('const upgrades = [');
if (upgradeIndex !== -1) {
    const insertSchema = '"CREATE TABLE IF NOT EXISTS product_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, user_id INTEGER, rating INTEGER, title TEXT, body TEXT, created_at TEXT)",\n        ';
    content = content.slice(0, upgradeIndex + 18) + '\n        ' + insertSchema + content.slice(upgradeIndex + 18);
}

// 2. Add routes
const routingIndex = content.indexOf('// PUBLIC API');
if (routingIndex !== -1) {
    const routes =   if (path.startsWith("/api/reviews/") && method === "GET") return getReviews(request, path, env);
  if (path.startsWith("/api/reviews/") && method === "POST") return addReview(request, path, env);\n;
    content = content.slice(0, routingIndex) + routes + content.slice(routingIndex);
}

// 3. Add controller functions at the end of the file
const functions = 
// REVIEWS
async function getReviews(request, path, env) {
  try {
    const parts = path.split('/');
    const productId = parseInt(parts[3], 10);
    if (!productId) return json({ error: "Invalid product id" }, 400);

    const { results } = await env.DB.prepare(
      "SELECT r.*, u.first_name, u.last_name FROM product_reviews r LEFT JOIN users u ON r.user_id = u.id WHERE r.product_id = ? ORDER BY r.id DESC"
    ).bind(productId).all();

    return json({ reviews: results || [] });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function addReview(request, path, env) {
  try {
    const parts = path.split('/');
    const productId = parseInt(parts[3], 10);
    if (!productId) return json({ error: "Invalid product id" }, 400);

    const auth = await authenticate(request, env);
    if (!auth.user) return json({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const { rating, title, reviewBody } = body;

    await env.DB.prepare(
      "INSERT INTO product_reviews (product_id, user_id, rating, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(productId, auth.user.id, rating, title, reviewBody, new Date().toISOString()).run();

    // Update product average rating
    const { results } = await env.DB.prepare("SELECT AVG(rating) as avg_rating, COUNT(id) as count FROM product_reviews WHERE product_id = ?").bind(productId).all();
    if (results && results[0]) {
      await env.DB.prepare("UPDATE products SET rating = ?, review_count = ? WHERE id = ?").bind(results[0].avg_rating || 0, results[0].count || 0, productId).run();
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
;
content += functions;

fs.writeFileSync('index.js', content);
console.log('Backend updated with product_reviews');
