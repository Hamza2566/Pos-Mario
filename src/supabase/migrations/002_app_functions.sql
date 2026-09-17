-- ============================================================
-- 002_app_functions.sql
-- Void sale, auth profile trigger, storage, activity, realtime
-- Apply after 001_initial_schema.sql and complete_sale.sql
-- ============================================================

-- Allow fully discounted (zero-total) sales
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);

-- ──────────────────────────────────────────────────────────────
-- updated_at helper
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_businesses_updated_at ON businesses;
CREATE TRIGGER trg_businesses_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory_items;
CREATE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Activity log helper (callable by authenticated users)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO activity_logs (business_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (auth_business_id(), auth_profile_id(), p_action, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION log_activity(text, text, uuid, jsonb) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- Void a completed sale (owner only)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION void_sale(p_sale_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale sales%ROWTYPE;
BEGIN
  IF auth_role() <> 'OWNER' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only owners can void sales';
  END IF;

  SELECT * INTO v_sale
  FROM sales
  WHERE id = p_sale_id
    AND business_id = auth_business_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND';
  END IF;

  IF v_sale.sale_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'INVALID_STATUS: Only completed sales can be voided';
  END IF;

  UPDATE sales
  SET sale_status = 'VOIDED',
      payment_status = 'REFUNDED',
      notes = CASE
        WHEN p_reason IS NULL OR p_reason = '' THEN notes
        WHEN notes IS NULL THEN 'Void: ' || p_reason
        ELSE notes || E'\nVoid: ' || p_reason
      END,
      updated_at = now()
  WHERE id = p_sale_id;

  -- Reverse inventory deducted for this sale
  UPDATE inventory_items ii
  SET quantity = ii.quantity - tx.quantity_change,
      updated_at = now()
  FROM inventory_transactions tx
  WHERE tx.item_id = ii.id
    AND tx.reference_id = p_sale_id
    AND tx.transaction_type = 'SALE';

  INSERT INTO inventory_transactions (
    business_id, item_id, transaction_type, quantity_change, reference_id, notes, created_by
  )
  SELECT
    tx.business_id,
    tx.item_id,
    'RETURN',
    -tx.quantity_change,
    p_sale_id,
    COALESCE(p_reason, 'Sale voided'),
    auth_profile_id()
  FROM inventory_transactions tx
  WHERE tx.reference_id = p_sale_id
    AND tx.transaction_type = 'SALE';

  INSERT INTO activity_logs (business_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_sale.business_id,
    auth_profile_id(),
    'SALE_VOIDED',
    'sale',
    p_sale_id,
    jsonb_build_object(
      'sale_number', v_sale.sale_number,
      'total_amount', v_sale.total_amount,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('sale_id', p_sale_id, 'sale_status', 'VOIDED');
END;
$$;

GRANT EXECUTE ON FUNCTION void_sale(uuid, text) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- Create employee profile from auth signup metadata
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ? 'business_id' THEN
    INSERT INTO public.profiles (auth_user_id, business_id, full_name, role, phone, active)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'business_id')::uuid,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
      CASE
        WHEN NEW.raw_user_meta_data->>'role' IN ('OWNER', 'EMPLOYEE')
          THEN NEW.raw_user_meta_data->>'role'
        ELSE 'EMPLOYEE'
      END,
      NULLIF(NEW.raw_user_meta_data->>'phone', ''),
      true
    )
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- Realtime for catalog sync
-- ──────────────────────────────────────────────────────────────
ALTER TABLE products REPLICA IDENTITY FULL;
ALTER TABLE categories REPLICA IDENTITY FULL;

-- ──────────────────────────────────────────────────────────────
-- Storage bucket for product images
-- ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
CREATE POLICY "Authenticated upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
CREATE POLICY "Authenticated update product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');
