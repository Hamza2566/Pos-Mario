-- ============================================================
-- seed.sql
-- Sample data for development / first-time setup
-- Run AFTER 001_initial_schema.sql, complete_sale.sql, 002_app_functions.sql
-- Replace the owner auth_user_id with the real UUID from auth.users
-- ============================================================

-- 1. Create business
INSERT INTO businesses (id, name, phone, email, address, currency, timezone)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Mario Coffee',
  '+251911000001',
  'owner@mariocoffee.et',
  'Bole, Addis Ababa, Ethiopia',
  'ETB',
  'Africa/Addis_Ababa'
) ON CONFLICT (id) DO NOTHING;

-- 2. Create owner profile
-- Replace '00000000-0000-0000-0000-000000000001' with the UUID from Authentication → Users
INSERT INTO profiles (auth_user_id, business_id, full_name, role, phone, active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Mario Bekele',
  'OWNER',
  '+251911000001',
  true
) ON CONFLICT (auth_user_id) DO NOTHING;

-- 3. Categories
INSERT INTO categories (id, business_id, name, color, sort_order, active) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Hot Drinks',    '#ef4444', 1, true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cold Drinks',   '#06b6d4', 2, true),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Food & Snacks', '#f97316', 3, true),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Extras',        '#8b5cf6', 4, true)
ON CONFLICT (id) DO NOTHING;

-- 4. Products
INSERT INTO products (business_id, category_id, name, price, cost_price, price_version, active) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Espresso',          45,  15, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Macchiato',         50,  18, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Cappuccino',        65,  20, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Latte',             70,  22, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Americano',         55,  16, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Ethiopian Coffee',  40,  12, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Tea',               35,  10, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Iced Coffee',       75,  25, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Frappe',            85,  28, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Fresh Juice',       60,  20, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Smoothie',          90,  30, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 'Croissant',         45,  18, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 'Sandwich',          80,  35, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 'Cake Slice',        55,  20, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 'Extra Shot',        15,   5, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 'Oat Milk',          20,   8, 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 'Vanilla Syrup',     10,   3, 1, true);

-- 5. Inventory items
INSERT INTO inventory_items (business_id, name, unit, quantity, minimum_stock, cost_per_unit, active) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Coffee Beans',  'kg',  5.0, 2.0, 800, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Whole Milk',    'L',  10.0, 3.0,  45, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Oat Milk',      'L',   4.0, 2.0,  80, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sugar',         'kg',  3.0, 1.0,  30, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Paper Cups',    'pcs',150,  50,    1, true);
