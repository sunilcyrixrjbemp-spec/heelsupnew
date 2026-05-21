-- HeelsUp Product Seed Data
-- Run: wrangler d1 execute heelsup-live --remote --file migrations/seed_products.sql

-- Clear existing products (keep IDs clean)
DELETE FROM products;

-- Reset sequence
DELETE FROM sqlite_sequence WHERE name = 'products';

-- ============================================================
-- HEELS CATEGORY
-- ============================================================
INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Stiletto Block Heel Pumps', 'HU-H001', 'Heels', 899, 1499, 50, 1, 1, 1, 1, 4.8, 124,
 'Classic stiletto block heels with cushioned footbed. Perfect for office and parties. Premium synthetic leather upper with non-slip rubber sole. Comfortable 3-inch heel height.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1596703263926-eb0762ee17e4?w=600"]',
 'https://images.unsplash.com/photo-1596703263926-eb0762ee17e4?w=600',
 '2025-01-01T10:00:00Z', '2025-01-01T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Wedge Ankle Strap Heels', 'HU-H002', 'Heels', 799, 1299, 40, 1, 1, 0, 1, 4.5, 56,
 'Comfortable wedge heels with ankle strap. Perfect height for all-day comfort. Suede finish with metallic buckle. Great for both casual and formal occasions.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=600"]',
 'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=600',
 '2025-01-05T10:00:00Z', '2025-01-05T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Platform Mule Heels', 'HU-H003', 'Heels', 749, 1199, 35, 1, 1, 1, 1, 4.7, 78,
 'Trendy platform mule heels. Easy slip-on design with comfortable platform sole. Modern design for fashion-forward women. Available in black and nude.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600"]',
 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600',
 '2025-01-07T10:00:00Z', '2025-01-07T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Ankle Strap Block Heels', 'HU-H004', 'Heels', 999, 1599, 28, 1, 1, 1, 0, 4.6, 54,
 'Elegant ankle strap block heels with gold buckle detail. Comfortable 3.5 inch block heel for stability. Perfect for weddings, parties and formal events.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1596703263926-eb0762ee17e4?w=600"]',
 'https://images.unsplash.com/photo-1596703263926-eb0762ee17e4?w=600',
 '2025-01-09T10:00:00Z', '2025-01-09T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Pointed Toe Kitten Heels', 'HU-H005', 'Heels', 849, 1299, 45, 1, 0, 0, 0, 4.5, 43,
 'Sophisticated pointed toe kitten heels. Low 2-inch heel perfect for work. Classic design that never goes out of style.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=600"]',
 'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=600',
 '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Chunky Platform Heels', 'HU-H006', 'Heels', 1099, 1699, 20, 1, 0, 1, 1, 4.8, 67,
 'Bold chunky platform heels for the modern woman. Extra cushioning for comfort. Statement piece for any outfit.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600"]',
 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600',
 '2025-02-01T10:00:00Z', '2025-02-01T10:00:00Z');

-- ============================================================
-- SANDALS CATEGORY
-- ============================================================
INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Rose Gold Strappy Sandals', 'HU-S001', 'Sandals', 649, 999, 45, 1, 1, 0, 1, 4.7, 89,
 'Elegant strappy sandals in rose gold finish. Lightweight and comfortable for all-day wear. Adjustable ankle strap for perfect fit. Perfect for summer outings and brunches.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600"]',
 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600',
 '2025-01-02T10:00:00Z', '2025-01-02T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Boho Fringe Sandals', 'HU-S002', 'Sandals', 449, 699, 55, 1, 0, 0, 0, 4.4, 32,
 'Boho-chic fringe sandals for the free-spirited woman. Comfortable flat sole with decorative fringe detailing. Perfect for beach and casual outings.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600"]',
 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600',
 '2025-01-10T10:00:00Z', '2025-01-10T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Gladiator Flat Sandals', 'HU-S003', 'Sandals', 599, 899, 38, 1, 1, 1, 0, 4.6, 71,
 'Bold gladiator sandals with multiple strap detailing. Flat comfortable sole for all-day wear. Goes well with both western and ethnic outfits.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600"]',
 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600',
 '2025-02-05T10:00:00Z', '2025-02-05T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Ankle Tie Flat Sandals', 'HU-S004', 'Sandals', 399, 599, 65, 1, 0, 1, 1, 4.3, 28,
 'Simple and elegant ankle tie flat sandals. Lightweight and comfortable. Perfect everyday sandal for work and casual outings.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600"]',
 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600',
 '2025-02-10T10:00:00Z', '2025-02-10T10:00:00Z');

-- ============================================================
-- FLATS CATEGORY
-- ============================================================
INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Embroidered Juttis Flats', 'HU-F001', 'Flats', 549, 849, 60, 1, 0, 1, 0, 4.6, 67,
 'Handcrafted embroidered juttis from Rajasthan. Traditional art with modern comfort. Perfect for festivals and weddings. Each pair is uniquely crafted by skilled artisans.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600"]',
 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600',
 '2025-01-04T10:00:00Z', '2025-01-04T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Kolhapuri Flats Handcrafted', 'HU-F002', 'Flats', 499, 799, 70, 1, 1, 0, 0, 4.9, 145,
 'Authentic Kolhapuri chappals handmade by local artisans. Traditional Maharashtrian craft with comfortable leather sole. Durable and stylish. Perfect for everyday wear.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600"]',
 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600',
 '2025-01-08T10:00:00Z', '2025-01-08T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Ballet Flats Classic', 'HU-F003', 'Flats', 649, 999, 50, 1, 0, 0, 1, 4.5, 89,
 'Classic ballet flats for the everyday woman. Soft cushioned insole for all-day comfort. Goes with everything from jeans to dresses.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600"]',
 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600',
 '2025-02-15T10:00:00Z', '2025-02-15T10:00:00Z');

-- ============================================================
-- BAGS CATEGORY
-- ============================================================
INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Classic Tote Bag Tan', 'HU-B001', 'Bags', 1299, 1999, 30, 1, 1, 1, 0, 4.9, 203,
 'Premium quality tote bag in tan colour. Spacious interior with multiple pockets. Durable vegan leather with gold hardware. Perfect for work and shopping.',
 '[]',
 '["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600"]',
 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600',
 '2025-01-03T10:00:00Z', '2025-01-03T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Mini Sling Crossbody Bag', 'HU-B002', 'Bags', 899, 1299, 25, 1, 1, 1, 1, 4.8, 91,
 'Trendy mini sling bag perfect for outings. Multiple compartments, adjustable strap. Available in premium vegan leather. Holds phone, keys, cards and essentials.',
 '[]',
 '["https://images.unsplash.com/photo-1554141220-83411835a60b?w=600"]',
 'https://images.unsplash.com/photo-1554141220-83411835a60b?w=600',
 '2025-01-06T10:00:00Z', '2025-01-06T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Leather Clutch Gold', 'HU-B003', 'Bags', 1099, 1699, 20, 1, 0, 1, 0, 4.7, 67,
 'Elegant gold leather clutch for special occasions. Detachable chain strap. Magnetic clasp closure. Perfect for parties, weddings and evening events.',
 '[]',
 '["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600"]',
 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600',
 '2025-01-11T10:00:00Z', '2025-01-11T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Bucket Bag Casual', 'HU-B004', 'Bags', 749, 1099, 35, 1, 0, 1, 1, 4.4, 45,
 'Casual bucket bag with drawstring closure. Spacious enough for everyday essentials. Adjustable shoulder strap. Perfect for weekends and outings.',
 '[]',
 '["https://images.unsplash.com/photo-1554141220-83411835a60b?w=600"]',
 'https://images.unsplash.com/photo-1554141220-83411835a60b?w=600',
 '2025-02-20T10:00:00Z', '2025-02-20T10:00:00Z');

-- ============================================================
-- WEDGES CATEGORY
-- ============================================================
INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Cork Wedge Espadrilles', 'HU-W001', 'Wedges', 699, 1099, 40, 1, 1, 1, 1, 4.6, 58,
 'Trendy cork wedge espadrilles perfect for summer. Comfortable 3-inch wedge height. Breathable jute and canvas upper. Great for beach and casual outings.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=600"]',
 'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=600',
 '2025-02-01T10:00:00Z', '2025-02-01T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Platform Wedge Sandals', 'HU-W002', 'Wedges', 899, 1399, 30, 1, 0, 0, 1, 4.5, 42,
 'Stylish platform wedge sandals. 4-inch comfortable wedge heel. Ankle strap with buckle closure. Perfect for semi-formal occasions.',
 '["36","37","38","39","40","41"]',
 '["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600"]',
 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600',
 '2025-03-01T10:00:00Z', '2025-03-01T10:00:00Z');

-- ============================================================
-- ACCESSORIES CATEGORY
-- ============================================================
INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Silk Scarf Hair Accessory', 'HU-A001', 'Accessories', 299, 499, 100, 1, 0, 1, 1, 4.7, 112,
 'Premium silk scarf that doubles as hair accessory and bag accessory. Multiple styling options. Adds elegance to any look.',
 '[]',
 '["https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600"]',
 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600',
 '2025-03-10T10:00:00Z', '2025-03-10T10:00:00Z');

INSERT INTO products (name, sku, category, price, original_price, stock, active, featured, is_new, is_trending, rating, review_count, description, sizes_json, images_json, image_url, created_at, updated_at) VALUES
('Shoe Care Kit Deluxe', 'HU-A002', 'Accessories', 399, 599, 80, 1, 0, 0, 0, 4.8, 67,
 'Complete shoe care kit with cleaner, conditioner, brush and cloth. Keeps your footwear looking brand new. Works on leather, suede and synthetic materials.',
 '[]',
 '["https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600"]',
 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600',
 '2025-03-15T10:00:00Z', '2025-03-15T10:00:00Z');
