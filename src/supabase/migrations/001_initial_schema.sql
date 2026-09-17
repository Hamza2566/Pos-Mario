-- ============================================================
-- 001_initial_schema.sql
-- Coffee Shop POS — Initial Database Schema
-- Apply in Supabase SQL Editor or via Supabase CLI migrations
-- ============================================================

-- Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- TABLES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE businesses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  phone        text,
  email        text,
  address      text,
  currency     text NOT NULL DEFAULT 'ETB',
  logo_url     text,
  timezone     text NOT NULL DEFAULT 'Africa/Addis_Ababa',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id),
  business_id  uuid NOT NULL REFERENCES businesses(id),
  full_name    text NOT NULL,
  role         text NOT NULL CHECK (role IN ('OWNER','EMPLOYEE')),
  phone        text,
  avatar_url   text,
  active       boolean NOT NULL DEFAULT true,
  -- pin_hash  text  -- Reserved for V2 PIN auth (bcrypt via Edge Function)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id),
  name         text NOT NULL,
  description  text,
  color        text,
  sort_order   int NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses(id),
  category_id     uuid REFERENCES categories(id),
  name            text NOT NULL,
  description     text,
  image_url       text,
  sku             text,
  price           NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_version   int NOT NULL DEFAULT 1,
  active          boolean NOT NULL DEFAULT true,
  track_inventory boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Increment price_version on every price change
CREATE OR REPLACE FUNCTION increment_price_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price <> OLD.price THEN
    NEW.price_version := OLD.price_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_price_version
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION increment_price_version();

-- Per-business sale number sequence helper
CREATE TABLE business_sale_sequences (
  business_id  uuid PRIMARY KEY REFERENCES businesses(id),
  last_number  int NOT NULL DEFAULT 0
);

CREATE TABLE sales (
  id              uuid PRIMARY KEY,
  business_id     uuid NOT NULL REFERENCES businesses(id),
  sale_number     text NOT NULL,
  employee_id     uuid NOT NULL REFERENCES profiles(id),
  subtotal        NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL,
  payment_status  text NOT NULL CHECK (payment_status IN ('PAID','PARTIALLY_PAID','REFUNDED','PARTIALLY_REFUNDED')),
  sale_status     text NOT NULL CHECK (sale_status IN ('COMPLETED','VOIDED','REFUNDED','PARTIALLY_REFUNDED')),
  device_id       text NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, sale_number)
);

CREATE TABLE sale_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id               uuid NOT NULL REFERENCES sales(id),
  product_id            uuid REFERENCES products(id),
  product_name_snapshot text NOT NULL,
  unit_price_snapshot   NUMERIC(12,2) NOT NULL,
  price_version_used    int NOT NULL,
  quantity              int NOT NULL CHECK (quantity > 0),
  discount_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal              NUMERIC(12,2) NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id        uuid NOT NULL REFERENCES sales(id),
  business_id    uuid NOT NULL REFERENCES businesses(id),
  payment_method text NOT NULL CHECK (payment_method IN ('CASH','TELEBIRR','CBE_BIRR','CARD','OTHER')),
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference      text,
  received_by    uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id),
  name          text NOT NULL,
  unit          text NOT NULL,
  quantity      NUMERIC(12,3) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id),
  item_id          uuid NOT NULL REFERENCES inventory_items(id),
  transaction_type text NOT NULL CHECK (transaction_type IN ('PURCHASE','SALE','ADJUSTMENT','WASTE','RETURN','MANUAL_CORRECTION')),
  quantity_change  NUMERIC(12,3) NOT NULL,
  reference_id     uuid,
  notes            text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id),
  created_by   uuid NOT NULL REFERENCES profiles(id),
  category     text NOT NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description  text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id),
  user_id      uuid REFERENCES profiles(id),
  action       text NOT NULL,
  entity_type  text,
  entity_id    uuid,
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
CREATE INDEX idx_products_business ON products(business_id) WHERE active = true;
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_sales_business_date ON sales(business_id, created_at DESC);
CREATE INDEX idx_sales_employee ON sales(employee_id, created_at DESC);
CREATE INDEX idx_sales_status ON sales(business_id, sale_status);
CREATE INDEX idx_activity_business_date ON activity_logs(business_id, created_at DESC);
CREATE INDEX idx_inv_tx_item ON inventory_transactions(item_id, created_at DESC);
CREATE INDEX idx_payments_business ON payments(business_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS (used in RLS)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_business_id() RETURNS uuid AS $$
  SELECT business_id FROM profiles WHERE auth_user_id = auth.uid() AND active = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_role() RETURNS text AS $$
  SELECT role FROM profiles WHERE auth_user_id = auth.uid() AND active = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_profile_id() RETURNS uuid AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid() AND active = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ──────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ──────────────────────────────────────────────────────────────
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_sale_sequences ENABLE ROW LEVEL SECURITY;

-- businesses
CREATE POLICY "Users can view own business" ON businesses
  FOR SELECT USING (id = auth_business_id());
CREATE POLICY "Owners can update business" ON businesses
  FOR UPDATE USING (id = auth_business_id() AND auth_role() = 'OWNER');

-- profiles
CREATE POLICY "Owners see all profiles in business" ON profiles
  FOR SELECT USING (business_id = auth_business_id() AND auth_role() = 'OWNER');
CREATE POLICY "Employees see own profile" ON profiles
  FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "Owners can insert profiles" ON profiles
  FOR INSERT WITH CHECK (business_id = auth_business_id() AND auth_role() = 'OWNER');
CREATE POLICY "Owners can update profiles" ON profiles
  FOR UPDATE USING (business_id = auth_business_id() AND auth_role() = 'OWNER');

-- categories
CREATE POLICY "Auth users see own business categories" ON categories
  FOR SELECT USING (business_id = auth_business_id());
CREATE POLICY "Owners can manage categories" ON categories
  FOR ALL USING (business_id = auth_business_id() AND auth_role() = 'OWNER');

-- products
CREATE POLICY "Auth users see own business products" ON products
  FOR SELECT USING (business_id = auth_business_id());
CREATE POLICY "Owners can manage products" ON products
  FOR ALL USING (business_id = auth_business_id() AND auth_role() = 'OWNER');

-- sales (read-only via RLS; writes via RPC only)
CREATE POLICY "Owners see all sales" ON sales
  FOR SELECT USING (business_id = auth_business_id() AND auth_role() = 'OWNER');
CREATE POLICY "Employees see own sales" ON sales
  FOR SELECT USING (employee_id = auth_profile_id() AND business_id = auth_business_id());

-- sale_items
CREATE POLICY "Owners see all sale_items" ON sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_id AND s.business_id = auth_business_id() AND auth_role() = 'OWNER')
  );
CREATE POLICY "Employees see own sale_items" ON sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_id AND s.employee_id = auth_profile_id())
  );

-- payments
CREATE POLICY "Owners see all payments" ON payments
  FOR SELECT USING (business_id = auth_business_id() AND auth_role() = 'OWNER');
CREATE POLICY "Employees see own payments" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_id AND s.employee_id = auth_profile_id())
  );

-- inventory
CREATE POLICY "Owners manage inventory" ON inventory_items
  FOR ALL USING (business_id = auth_business_id() AND auth_role() = 'OWNER');
CREATE POLICY "Owners manage inventory_transactions" ON inventory_transactions
  FOR ALL USING (business_id = auth_business_id() AND auth_role() = 'OWNER');

-- expenses
CREATE POLICY "Owners manage expenses" ON expenses
  FOR SELECT USING (business_id = auth_business_id() AND auth_role() = 'OWNER');
CREATE POLICY "Owners can insert expenses" ON expenses
  FOR INSERT WITH CHECK (business_id = auth_business_id() AND auth_role() = 'OWNER');

-- activity_logs (read-only for owners, write via RPC only)
CREATE POLICY "Owners see activity logs" ON activity_logs
  FOR SELECT USING (business_id = auth_business_id() AND auth_role() = 'OWNER');

-- business_sale_sequences (managed by RPC only)
CREATE POLICY "No direct access to sequences" ON business_sale_sequences
  USING (false);
