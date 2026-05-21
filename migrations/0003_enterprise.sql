-- HeelsUp Enterprise Migration 0003
-- New tables for enterprise features

-- ============================================================
-- SETTINGS (Admin configurable — Razorpay keys, OTP URL, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- USER ADDRESSES
-- ============================================================
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- ============================================================
-- WISHLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);

-- ============================================================
-- PRODUCT REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON product_reviews(status);

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'percent',
  value REAL NOT NULL,
  min_order REAL NOT NULL DEFAULT 0,
  max_discount REAL,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  description TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================
-- OFFLINE SALES (POS / In-store entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS offline_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_number TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_phone TEXT,
  items_json TEXT NOT NULL,
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_offline_sales_date ON offline_sales(created_at);

-- ============================================================
-- RETURN REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS return_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  refund_amount REAL,
  admin_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_returns_status ON return_requests(status);

-- ============================================================
-- AUDIT LOG (Security)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- ============================================================
-- LOGIN ATTEMPTS (Rate limiting / Account lockout)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);

-- ============================================================
-- BANNERS (Homepage / Promo — Admin managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  link TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ============================================================
-- DEFAULT SETTINGS
-- ============================================================
INSERT OR IGNORE INTO settings (key, value, description, updated_at) VALUES
  ('razorpay_key_id', '', 'Razorpay Live Key ID (rzp_live_...)', datetime('now')),
  ('razorpay_key_secret', '', 'Razorpay Live Key Secret', datetime('now')),
  ('razorpay_mode', 'live', 'live or test', datetime('now')),
  ('otp_script_url', 'https://script.google.com/macros/s/AKfycbzXkeCVB258ETOqj2i0FQPc-tYOLdsfHUqpE8fAqM8Q268f03bv4mt4GxMHyNQ_mDsV7A/exec', 'Google Apps Script OTP sender URL', datetime('now')),
  ('site_name', 'HeelsUp', 'Website name', datetime('now')),
  ('site_email', 'suniljani012@gmail.com', 'Admin/Support email', datetime('now')),
  ('support_phone', '+91-9876543210', 'Customer support phone', datetime('now')),
  ('shipping_free_above', '499', 'Free shipping threshold in INR', datetime('now')),
  ('shipping_standard_charge', '49', 'Standard shipping charge in INR', datetime('now')),
  ('require_email_otp', 'true', 'Require OTP verification for registration', datetime('now')),
  ('otp_expiry_minutes', '10', 'OTP expiry time in minutes', datetime('now')),
  ('max_login_attempts', '5', 'Max failed logins before lockout', datetime('now')),
  ('lockout_duration_minutes', '30', 'Account lockout duration in minutes', datetime('now')),
  ('maintenance_mode', 'false', 'Put site in maintenance mode', datetime('now'));

-- ============================================================
-- DEFAULT COUPONS
-- ============================================================
INSERT OR IGNORE INTO coupons (code, type, value, min_order, max_discount, max_uses, active, description, created_at) VALUES
  ('HEELS10', 'percent', 10, 499, 500, 10000, 1, '10% off on orders above Rs.499', datetime('now')),
  ('FLAT100', 'flat', 100, 999, 100, 5000, 1, 'Flat Rs.100 off on orders above Rs.999', datetime('now')),
  ('WELCOME20', 'percent', 20, 299, 300, 2000, 1, '20% off for new customers', datetime('now')),
  ('SUMMER50', 'flat', 50, 599, 50, 1000, 1, 'Summer sale Rs.50 off', datetime('now'));
