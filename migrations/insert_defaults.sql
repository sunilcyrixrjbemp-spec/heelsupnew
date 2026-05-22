INSERT OR IGNORE INTO categories (name, slug, description, active, sort_order, created_at, updated_at) VALUES
  ('Heels', 'heels', 'High heels and stilettos', 1, 1, datetime('now'), datetime('now')),
  ('Sandals', 'sandals', 'Casual and party sandals', 1, 2, datetime('now'), datetime('now')),
  ('Wedges', 'wedges', 'Wedge heels and platforms', 1, 3, datetime('now'), datetime('now')),
  ('Flats', 'flats', 'Comfortable flat shoes', 1, 4, datetime('now'), datetime('now')),
  ('Bags', 'bags', 'Handbags and clutches', 1, 5, datetime('now'), datetime('now')),
  ('Accessories', 'accessories', 'Fashion accessories', 1, 6, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO staff_roles (name, permissions, created_at) VALUES
  ('superadmin', '["all"]', datetime('now')),
  ('manager', '["manage_products","manage_orders","manage_customers","view_reports"]', datetime('now')),
  ('support', '["view_orders","view_customers","manage_returns"]', datetime('now'));
