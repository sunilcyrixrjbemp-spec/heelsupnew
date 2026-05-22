CREATE TABLE IF NOT EXISTS collection_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(collection_id, product_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

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

INSERT OR IGNORE INTO tax_rules (name, type, rate, country, active, created_at, updated_at) VALUES
  ('GST 5%', 'percentage', 5, 'IN', 1, datetime('now'), datetime('now')),
  ('GST 12%', 'percentage', 12, 'IN', 1, datetime('now'), datetime('now')),
  ('GST 18%', 'percentage', 18, 'IN', 0, datetime('now'), datetime('now'));

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

INSERT OR IGNORE INTO shipping_zones (name, countries, active, sort_order, created_at, updated_at) VALUES
  ('India', 'IN', 1, 1, datetime('now'), datetime('now')),
  ('International', 'US,UK,AE,SG,AU', 0, 2, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO shipping_rates (zone_id, name, type, rate, min_order, free_above, estimated_days, active, created_at)
  SELECT 1, 'Standard Shipping', 'flat', 49, 0, 499, '3-5 days', 1, datetime('now');

INSERT OR IGNORE INTO shipping_rates (zone_id, name, type, rate, min_order, estimated_days, active, created_at)
  SELECT 1, 'Express Shipping', 'flat', 99, 0, '1-2 days', 1, datetime('now');

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

CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL,
  UNIQUE(type, key)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(type, key);
