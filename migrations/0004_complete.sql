-- ============================================================
-- HeelsUp Enterprise Migration 0004 — Complete Schema
-- Run: npx wrangler d1 execute heelsup-live --file=migrations/0004_complete.sql
-- ============================================================

-- ============================================================
-- ALTER PRODUCTS — Add missing columns safely
-- ============================================================
-- ALTER TABLE products ADD COLUMN brand TEXT DEFAULT '';
-- ALTER TABLE products ADD COLUMN tags TEXT DEFAULT '';
-- ALTER TABLE products ADD COLUMN sold_count INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE products ADD COLUMN meta_title TEXT DEFAULT '';
-- ALTER TABLE products ADD COLUMN meta_description TEXT DEFAULT '';

-- ============================================================
-- ALTER ORDERS — Add missing columns safely
-- ============================================================
-- ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'online';
-- ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
-- ALTER TABLE orders ADD COLUMN tracking_number TEXT;
-- ALTER TABLE orders ADD COLUMN tracking_url TEXT;
-- ALTER TABLE orders ADD COLUMN shipped_at TEXT;
-- ALTER TABLE orders ADD COLUMN delivered_at TEXT;
-- ALTER TABLE orders ADD COLUMN admin_notes TEXT;

-- ============================================================
-- ALTER USERS — Add missing columns safely
-- ============================================================
-- ALTER TABLE users ADD COLUMN staff_permissions TEXT DEFAULT '[]';
-- ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN last_login_at TEXT;
-- ALTER TABLE users ADD COLUMN total_orders INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN total_spent REAL NOT NULL DEFAULT 0;

-- ============================================================
-- PRODUCT IMAGES (Multi-image support, max 5 per product)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  r2_key TEXT,
  alt TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_order ON product_images(product_id, sort_order);

-- ============================================================
-- CATEGORIES (Admin managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  r2_key TEXT,
  parent_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  product_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);

-- Default categories
INSERT OR IGNORE INTO categories (name, slug, description, active, sort_order, created_at, updated_at) VALUES
  ('Heels', 'heels', 'High heels and stilettos', 1, 1, datetime('now'), datetime('now')),
  ('Sandals', 'sandals', 'Casual and party sandals', 1, 2, datetime('now'), datetime('now')),
  ('Wedges', 'wedges', 'Wedge heels and platforms', 1, 3, datetime('now'), datetime('now')),
  ('Flats', 'flats', 'Comfortable flat shoes', 1, 4, datetime('now'), datetime('now')),
  ('Bags', 'bags', 'Handbags and clutches', 1, 5, datetime('now'), datetime('now')),
  ('Accessories', 'accessories', 'Fashion accessories', 1, 6, datetime('now'), datetime('now'));

-- ============================================================
-- COLLECTIONS (Curated product groups)
-- ============================================================
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  r2_key TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  conditions TEXT,
  product_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(active);

CREATE TABLE IF NOT EXISTS collection_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(collection_id, product_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- BLOG POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT,
  image_url TEXT,
  r2_key TEXT,
  category TEXT DEFAULT 'General',
  tags TEXT DEFAULT '',
  author_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  views INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);

-- ============================================================
-- CMS PAGES (About, FAQ, Policy, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS cms_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  template TEXT DEFAULT 'default',
  active INTEGER NOT NULL DEFAULT 1,
  meta_title TEXT,
  meta_description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON cms_pages(slug);

-- ============================================================
-- TAX RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'percentage',
  rate REAL NOT NULL DEFAULT 0,
  country TEXT NOT NULL DEFAULT 'IN',
  state TEXT,
  category TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Default GST rules
INSERT OR IGNORE INTO tax_rules (name, type, rate, country, active, created_at, updated_at) VALUES
  ('GST 5%', 'percentage', 5, 'IN', 1, datetime('now'), datetime('now')),
  ('GST 12%', 'percentage', 12, 'IN', 1, datetime('now'), datetime('now')),
  ('GST 18%', 'percentage', 18, 'IN', 0, datetime('now'), datetime('now'));

-- ============================================================
-- SHIPPING ZONES & RATES
-- ============================================================
CREATE TABLE IF NOT EXISTS shipping_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  countries TEXT NOT NULL DEFAULT 'IN',
  states TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'flat',
  rate REAL NOT NULL DEFAULT 0,
  min_weight REAL DEFAULT 0,
  max_weight REAL,
  min_order REAL DEFAULT 0,
  max_order REAL,
  free_above REAL,
  estimated_days TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (zone_id) REFERENCES shipping_zones(id) ON DELETE CASCADE
);

-- Default shipping zone
INSERT OR IGNORE INTO shipping_zones (name, countries, active, sort_order, created_at, updated_at) VALUES
  ('India', 'IN', 1, 1, datetime('now'), datetime('now')),
  ('International', 'US,UK,AE,SG,AU', 0, 2, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO shipping_rates (zone_id, name, type, rate, min_order, free_above, estimated_days, active, created_at)
  SELECT 1, 'Standard Shipping', 'flat', 49, 0, 499, '3-5 days', 1, datetime('now');

INSERT OR IGNORE INTO shipping_rates (zone_id, name, type, rate, min_order, estimated_days, active, created_at)
  SELECT 1, 'Express Shipping', 'flat', 99, 0, '1-2 days', 1, datetime('now');

-- ============================================================
-- NOTIFICATIONS (Admin alerts)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- ============================================================
-- INVENTORY LOG (Stock change history)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'adjustment',
  quantity_before INTEGER NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  order_id INTEGER,
  admin_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_inv_log_product ON inventory_log(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_log_created ON inventory_log(created_at);

-- ============================================================
-- IMPORT LOGS (Bulk import history)
-- ============================================================
CREATE TABLE IF NOT EXISTS import_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  filename TEXT NOT NULL DEFAULT 'bulk',
  total INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- STAFF ROLES (Role-based permissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  permissions TEXT NOT NULL DEFAULT '[]',
  description TEXT,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO staff_roles (name, permissions, description, created_at) VALUES
  ('Super Admin', '["all"]', 'Full access to everything', datetime('now')),
  ('Manager', '["products","orders","customers","reports","inventory","coupons"]', 'Manage products and orders', datetime('now')),
  ('Support', '["orders","customers","reviews","returns"]', 'Customer support access', datetime('now')),
  ('Inventory', '["products","inventory"]', 'Inventory management only', datetime('now'));

-- ============================================================
-- ANALYTICS EVENTS (Page views, conversions)
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  page TEXT,
  product_id INTEGER,
  user_id INTEGER,
  session_id TEXT,
  referrer TEXT,
  country TEXT,
  device TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

-- ============================================================
-- RATE LIMITS (fallback if KV not available)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL,
  UNIQUE(type, key)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(type, key);
