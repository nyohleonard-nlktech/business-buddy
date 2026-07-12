
-- 1. Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read orders" ON public.orders
  FOR SELECT TO authenticated USING (public.is_member(business_id, auth.uid()));
CREATE POLICY "members insert orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (public.is_member(business_id, auth.uid()) AND recorded_by = auth.uid());
CREATE INDEX orders_business_created_idx ON public.orders (business_id, created_at DESC);

-- 2. order_id link on stock_transactions
ALTER TABLE public.stock_transactions ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
CREATE INDEX stock_transactions_order_idx ON public.stock_transactions (order_id);

-- Grant the new column for workers too
GRANT SELECT (id, business_id, product_id, type, quantity, unit_sale_price_snapshot, recorded_by, note, created_at, order_id)
  ON public.stock_transactions TO authenticated;

-- 3. Recreate views to include order_id
DROP VIEW IF EXISTS public.stock_transactions_owner_view;
DROP VIEW IF EXISTS public.stock_transactions_worker_view;
CREATE VIEW public.stock_transactions_owner_view
  WITH (security_invoker = true) AS
  SELECT * FROM public.stock_transactions WHERE public.is_owner(business_id, auth.uid());
GRANT SELECT ON public.stock_transactions_owner_view TO authenticated;
CREATE VIEW public.stock_transactions_worker_view
  WITH (security_invoker = true) AS
  SELECT id, business_id, product_id, type, quantity,
         unit_sale_price_snapshot, recorded_by, note, created_at, order_id
  FROM public.stock_transactions;
GRANT SELECT ON public.stock_transactions_worker_view TO authenticated;

-- 4. Atomic multi-item sale
CREATE OR REPLACE FUNCTION public.create_sale_order(
  _business_id UUID,
  _items JSONB,
  _note TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_order_id UUID;
  item JSONB;
  pid UUID;
  q INT;
  usp NUMERIC;
  total NUMERIC := 0;
  prod public.products%ROWTYPE;
BEGIN
  IF NOT public.is_member(_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this business';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'No items provided';
  END IF;

  INSERT INTO public.orders (business_id, recorded_by, total_amount, note)
    VALUES (_business_id, auth.uid(), 0, _note)
    RETURNING id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    pid := (item->>'product_id')::UUID;
    q := (item->>'quantity')::INT;
    usp := NULLIF(item->>'unit_sale_price','')::NUMERIC;
    IF q IS NULL OR q <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;
    SELECT * INTO prod FROM public.products WHERE id = pid;
    IF NOT FOUND OR prod.business_id <> _business_id THEN
      RAISE EXCEPTION 'Product not found';
    END IF;
    IF usp IS NULL THEN usp := prod.sale_price; END IF;

    INSERT INTO public.stock_transactions
      (business_id, product_id, type, quantity, recorded_by, note, order_id, unit_sale_price_snapshot)
      VALUES (_business_id, pid, 'sale', q, auth.uid(), NULL, new_order_id, usp);

    total := total + (usp * q);
  END LOOP;

  UPDATE public.orders SET total_amount = total WHERE id = new_order_id;
  RETURN new_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_sale_order(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale_order(UUID, JSONB, TEXT) TO authenticated;

-- 5. Atomic multi-item restock (owner-only; updates cost_price by default)
CREATE OR REPLACE FUNCTION public.create_restock(
  _business_id UUID,
  _items JSONB,
  _note TEXT DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item JSONB;
  pid UUID;
  q INT;
  ucost NUMERIC;
  upd_cost BOOLEAN;
  prod public.products%ROWTYPE;
  count_done INT := 0;
BEGIN
  IF NOT public.is_owner(_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only owners can restock';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'No items provided';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    pid := (item->>'product_id')::UUID;
    q := (item->>'quantity')::INT;
    ucost := NULLIF(item->>'unit_cost','')::NUMERIC;
    upd_cost := COALESCE((item->>'update_cost_price')::BOOLEAN, TRUE);
    IF q IS NULL OR q <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO prod FROM public.products WHERE id = pid;
    IF NOT FOUND OR prod.business_id <> _business_id THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    -- update cost first so the trigger's snapshot captures the new cost
    IF upd_cost AND ucost IS NOT NULL THEN
      UPDATE public.products SET cost_price = ucost WHERE id = pid;
    END IF;

    INSERT INTO public.stock_transactions
      (business_id, product_id, type, quantity, recorded_by, note)
      VALUES (_business_id, pid, 'restock', q, auth.uid(), _note);

    count_done := count_done + 1;
  END LOOP;
  RETURN count_done;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_restock(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_restock(UUID, JSONB, TEXT) TO authenticated;
