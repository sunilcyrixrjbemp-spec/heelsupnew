-- ============================================================
-- HeelsUp Enterprise Migration 0006 — Exchange Columns
-- ============================================================

ALTER TABLE orders ADD COLUMN exchange_reason TEXT;
ALTER TABLE orders ADD COLUMN exchange_product TEXT;
