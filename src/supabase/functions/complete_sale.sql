-- ============================================================
-- complete_sale.sql
-- Atomic sale transaction RPC (SECURITY DEFINER)
-- Run in Supabase SQL Editor after 001_initial_schema.sql
-- ============================================================

CREATE OR REPLACE FUNCTION complete_sale(
  p_sale_id           uuid,
  p_employee_id       uuid,
  p_business_id       uuid,
  p_device_id         text,
  p_items             jsonb,    -- [{product_id, quantity, discount_amount}]
  p_payment_method    text,
  p_payment_reference text,
  p_sale_discount     numeric,
  p_notes             text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile           profiles%ROWTYPE;
  v_product           products%ROWTYPE;
  v_item              jsonb;
  v_item_subtotal     numeric(12,2);
  v_subtotal          numeric(12,2) := 0;
  v_discount_total    numeric(12,2);
  v_tax_amount        numeric(12,2) := 0;
  v_total_amount      numeric(12,2);
  v_sale_number       text;
  v_next_num          int;
  v_sale              sales%ROWTYPE;
  v_processed         jsonb := '[]'::jsonb;
  v_row               jsonb;
BEGIN
  -- ── STEP 1: Idempotency check ─────────────────────────────
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'sale_id',     v_sale.id,
      'sale_number', v_sale.sale_number,
      'total_amount',v_sale.total_amount,
      'idempotent',  true
    );
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_ITEMS: Sale must contain at least one item';
  END IF;

  IF p_payment_method NOT IN ('CASH','TELEBIRR','CBE_BIRR','CARD','OTHER') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: %', p_payment_method;
  END IF;

  -- ── STEP 2: Validate caller ───────────────────────────────
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = p_employee_id
    AND business_id = p_business_id
    AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Profile not found or not active in business';
  END IF;

  IF v_profile.auth_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Token mismatch';
  END IF;

  -- ── STEP 3: Lock products and compute line items ──────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid
      AND business_id = p_business_id
      AND active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND: % is no longer available',
        (v_item->>'product_id');
    END IF;

    IF COALESCE((v_item->>'quantity')::int, 0) <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: quantity must be greater than 0';
    END IF;

    v_item_subtotal :=
      (v_product.price * (v_item->>'quantity')::int)
      - COALESCE((v_item->>'discount_amount')::numeric, 0);

    IF v_item_subtotal < 0 THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT: line discount exceeds line total';
    END IF;

    v_processed := v_processed || jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'unit_price', v_product.price,
      'price_version', v_product.price_version,
      'quantity', (v_item->>'quantity')::int,
      'discount_amount', COALESCE((v_item->>'discount_amount')::numeric, 0),
      'subtotal', v_item_subtotal,
      'track_inventory', v_product.track_inventory
    );

    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;

  -- ── STEP 4: Calculate totals ──────────────────────────────
  v_discount_total := COALESCE(p_sale_discount, 0);
  IF v_discount_total < 0 THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT: sale discount cannot be negative';
  END IF;
  v_total_amount := GREATEST(v_subtotal - v_discount_total + v_tax_amount, 0);

  -- ── STEP 5: Generate sale_number ─────────────────────────
  INSERT INTO business_sale_sequences (business_id, last_number)
  VALUES (p_business_id, 1)
  ON CONFLICT (business_id) DO UPDATE
    SET last_number = business_sale_sequences.last_number + 1
  RETURNING last_number INTO v_next_num;

  v_sale_number := 'S-' || LPAD(v_next_num::text, 5, '0');

  -- ── STEP 6: Insert sale first (sale_items FK depends on it) ─
  INSERT INTO sales (
    id, business_id, sale_number, employee_id, device_id,
    subtotal, discount_amount, tax_amount, total_amount,
    payment_status, sale_status, notes, created_at, updated_at
  ) VALUES (
    p_sale_id, p_business_id, v_sale_number, p_employee_id, p_device_id,
    v_subtotal, v_discount_total, v_tax_amount, v_total_amount,
    'PAID', 'COMPLETED', p_notes, now(), now()
  );

  -- ── STEP 7: Insert items + inventory ──────────────────────
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_processed)
  LOOP
    INSERT INTO sale_items (
      sale_id,
      product_id,
      product_name_snapshot,
      unit_price_snapshot,
      price_version_used,
      quantity,
      discount_amount,
      subtotal
    ) VALUES (
      p_sale_id,
      (v_row->>'product_id')::uuid,
      v_row->>'product_name',
      (v_row->>'unit_price')::numeric,
      (v_row->>'price_version')::int,
      (v_row->>'quantity')::int,
      (v_row->>'discount_amount')::numeric,
      (v_row->>'subtotal')::numeric
    );

    IF COALESCE((v_row->>'track_inventory')::boolean, false) THEN
      INSERT INTO inventory_transactions (
        business_id, item_id, transaction_type, quantity_change,
        reference_id, created_by
      )
      SELECT
        p_business_id,
        ii.id,
        'SALE',
        -((v_row->>'quantity')::int),
        p_sale_id,
        p_employee_id
      FROM inventory_items ii
      WHERE ii.business_id = p_business_id
        AND ii.name = v_row->>'product_name'
        AND ii.active = true
      LIMIT 1;

      UPDATE inventory_items
      SET quantity = quantity - (v_row->>'quantity')::int,
          updated_at = now()
      WHERE business_id = p_business_id
        AND name = v_row->>'product_name'
        AND active = true;
    END IF;
  END LOOP;

  -- ── STEP 8: Insert payment ────────────────────────────────
  INSERT INTO payments (
    sale_id, business_id, payment_method, amount, reference, received_by
  ) VALUES (
    p_sale_id, p_business_id, p_payment_method, v_total_amount,
    p_payment_reference, p_employee_id
  );

  -- ── STEP 9: Activity log ─────────────────────────────────
  INSERT INTO activity_logs (
    business_id, user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_business_id,
    p_employee_id,
    'SALE_COMPLETED',
    'sale',
    p_sale_id,
    jsonb_build_object(
      'sale_number',    v_sale_number,
      'total_amount',   v_total_amount,
      'payment_method', p_payment_method,
      'item_count',     jsonb_array_length(p_items)
    )
  );

  RETURN jsonb_build_object(
    'sale_id',     p_sale_id,
    'sale_number', v_sale_number,
    'total_amount',v_total_amount,
    'idempotent',  false
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_sale(uuid, uuid, uuid, text, jsonb, text, text, numeric, text) TO authenticated;
