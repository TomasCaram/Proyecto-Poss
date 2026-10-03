-- 1) Columnas que faltaban en la base real (no toca datos existentes)
ALTER TABLE sale_details
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_id uuid REFERENCES promotions(id);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reference text;

ALTER TABLE mixed_payment_details
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS reference text;

-- 2) Cobro atómico: valida caja y stock y registra venta, detalle y pagos en una transacción
CREATE OR REPLACE FUNCTION create_sale(
  p_items jsonb,
  p_subtotal numeric,
  p_discount_amount numeric,
  p_total numeric,
  p_payment_method text,
  p_reference text DEFAULT NULL,
  p_mixed jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_register_id uuid;
  v_sale_id uuid;
  v_payment_id uuid;
  v_item record;
  v_gross numeric := 0;
  v_mixed_total numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;

  SELECT id INTO v_register_id
  FROM cash_registers
  WHERE status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_register_id IS NULL THEN
    RAISE EXCEPTION 'NO_OPEN_REGISTER';
  END IF;

  INSERT INTO sales (user_id, cash_register_id, subtotal, discount_amount, total, status)
  VALUES (v_user_id, v_register_id, p_subtotal, p_discount_amount, p_total, 'completed')
  RETURNING id INTO v_sale_id;

  FOR v_item IN
    SELECT *
    FROM jsonb_to_recordset(p_items) AS x(
      product_id uuid, product_name text, quantity int,
      unit_price numeric, discount_amount numeric, subtotal numeric, promotion_id uuid
    )
    ORDER BY x.product_id
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_ITEMS';
    END IF;

    UPDATE products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id AND stock >= v_item.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION