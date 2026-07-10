
-- Enums
CREATE TYPE public.member_role AS ENUM ('owner', 'worker');
CREATE TYPE public.txn_type AS ENUM ('sale', 'restock', 'adjustment');

-- Businesses
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;

-- Members
CREATE TABLE public.business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'worker',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;

-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_member(_business_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members WHERE business_id = _business_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.member_role(_business_id UUID, _user_id UUID)
RETURNS public.member_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.business_members WHERE business_id = _business_id AND user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_owner(_business_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members WHERE business_id = _business_id AND user_id = _user_id AND role = 'owner');
$$;

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'piece',
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- Stock transactions
CREATE TABLE public.stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.txn_type NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity <> 0),
  unit_cost_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_sale_price_snapshot NUMERIC(12,2),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_transactions TO authenticated;
GRANT ALL ON public.stock_transactions TO service_role;

-- Worker-safe products view (excludes cost_price)
CREATE VIEW public.products_worker_view
WITH (security_invoker = true)
AS SELECT id, business_id, name, category, unit, sale_price,
          low_stock_threshold, current_stock, created_at
   FROM public.products;
GRANT SELECT ON public.products_worker_view TO authenticated;

-- Worker-safe transactions view (excludes cost snapshot)
CREATE VIEW public.stock_transactions_worker_view
WITH (security_invoker = true)
AS SELECT id, business_id, product_id, type, quantity,
          unit_sale_price_snapshot, recorded_by, note, created_at
   FROM public.stock_transactions;
GRANT SELECT ON public.stock_transactions_worker_view TO authenticated;

-- Trigger: enforce role-appropriate snapshotting + stock update + negative-stock guard
-- Convention: quantity is ALWAYS positive. Sale subtracts, restock adds. Adjustment can be negative (encoded by user, but we keep quantity positive and use a sign column? — spec says positive with sign convention. We allow negative quantity for 'adjustment' only.)
-- We relax check to allow negative for adjustment:
ALTER TABLE public.stock_transactions DROP CONSTRAINT stock_transactions_quantity_check;
ALTER TABLE public.stock_transactions ADD CONSTRAINT stock_transactions_quantity_check CHECK (
  (type = 'adjustment' AND quantity <> 0) OR (type IN ('sale','restock') AND quantity > 0)
);

CREATE OR REPLACE FUNCTION public.apply_stock_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prod public.products%ROWTYPE;
  delta INTEGER;
BEGIN
  SELECT * INTO prod FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  IF prod.business_id <> NEW.business_id THEN
    RAISE EXCEPTION 'Product does not belong to this business';
  END IF;

  -- Snapshot prices from the product at transaction time
  NEW.unit_cost_snapshot := prod.cost_price;
  IF NEW.type = 'sale' THEN
    NEW.unit_sale_price_snapshot := COALESCE(NEW.unit_sale_price_snapshot, prod.sale_price);
    delta := -NEW.quantity;
  ELSIF NEW.type = 'restock' THEN
    delta := NEW.quantity;
    NEW.unit_sale_price_snapshot := NULL;
  ELSE -- adjustment: quantity may be negative (removes stock) or positive
    delta := NEW.quantity;
    NEW.unit_sale_price_snapshot := NULL;
  END IF;

  IF prod.current_stock + delta < 0 THEN
    RAISE EXCEPTION 'Insufficient stock: have %, need %', prod.current_stock, -delta USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.products SET current_stock = current_stock + delta WHERE id = prod.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_stock_transaction_trg
BEFORE INSERT ON public.stock_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_transaction();

-- Auto-create owner membership when business is inserted
CREATE OR REPLACE FUNCTION public.create_owner_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_owner_membership_trg
AFTER INSERT ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.create_owner_membership();

-- Join-by-invite-code RPC
CREATE OR REPLACE FUNCTION public.join_business_with_code(_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  biz_id UUID;
BEGIN
  SELECT id INTO biz_id FROM public.businesses WHERE invite_code = upper(_code);
  IF biz_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (biz_id, auth.uid(), 'worker')
  ON CONFLICT (business_id, user_id) DO NOTHING;
  RETURN biz_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_invite_code(_business_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_code TEXT;
BEGIN
  IF NOT public.is_owner(_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only owners can regenerate invite codes';
  END IF;
  new_code := upper(substr(md5(random()::text), 1, 8));
  UPDATE public.businesses SET invite_code = new_code WHERE id = _business_id;
  RETURN new_code;
END;
$$;

-- RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

-- Businesses: members can read; only owner_id can insert; only owner can update/delete
CREATE POLICY "members read business" ON public.businesses
  FOR SELECT TO authenticated USING (public.is_member(id, auth.uid()));
CREATE POLICY "user creates own business" ON public.businesses
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner updates business" ON public.businesses
  FOR UPDATE TO authenticated USING (public.is_owner(id, auth.uid())) WITH CHECK (public.is_owner(id, auth.uid()));
CREATE POLICY "owner deletes business" ON public.businesses
  FOR DELETE TO authenticated USING (public.is_owner(id, auth.uid()));

-- Members: user can see rows for businesses they belong to
CREATE POLICY "members read memberships" ON public.business_members
  FOR SELECT TO authenticated USING (public.is_member(business_id, auth.uid()));
-- Users self-insert via RPC (SECURITY DEFINER) or owner adds — allow insert if inserting self OR requester is owner
CREATE POLICY "insert membership self or by owner" ON public.business_members
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() OR public.is_owner(business_id, auth.uid())
  );
-- Owner can remove members; users can remove themselves
CREATE POLICY "owner or self delete membership" ON public.business_members
  FOR DELETE TO authenticated USING (
    public.is_owner(business_id, auth.uid()) OR user_id = auth.uid()
  );

-- Products RLS: members read; owner writes
-- Note: workers should query products_worker_view (no cost_price). Column-level:
CREATE POLICY "members read products" ON public.products
  FOR SELECT TO authenticated USING (public.is_member(business_id, auth.uid()));
CREATE POLICY "owner insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_owner(business_id, auth.uid()));
CREATE POLICY "owner update products" ON public.products
  FOR UPDATE TO authenticated USING (public.is_owner(business_id, auth.uid())) WITH CHECK (public.is_owner(business_id, auth.uid()));
CREATE POLICY "owner delete products" ON public.products
  FOR DELETE TO authenticated USING (public.is_owner(business_id, auth.uid()));

-- Column-level: revoke cost_price from workers via column privileges
REVOKE SELECT ON public.products FROM authenticated;
GRANT SELECT (id, business_id, name, category, unit, sale_price, low_stock_threshold, current_stock, created_at) ON public.products TO authenticated;
-- Owners need cost_price too. We'll expose it via a security-definer function/view for owners:
CREATE OR REPLACE VIEW public.products_owner_view
WITH (security_invoker = true)
AS SELECT * FROM public.products WHERE public.is_owner(business_id, auth.uid());
GRANT SELECT ON public.products_owner_view TO authenticated;

-- Stock transactions RLS: members read (via view for workers), members insert
CREATE POLICY "members read transactions" ON public.stock_transactions
  FOR SELECT TO authenticated USING (public.is_member(business_id, auth.uid()));
CREATE POLICY "members insert transactions" ON public.stock_transactions
  FOR INSERT TO authenticated WITH CHECK (
    public.is_member(business_id, auth.uid()) AND recorded_by = auth.uid()
  );

-- Column-level for stock_transactions: revoke cost snapshot from workers
REVOKE SELECT ON public.stock_transactions FROM authenticated;
GRANT SELECT (id, business_id, product_id, type, quantity, unit_sale_price_snapshot, recorded_by, note, created_at)
  ON public.stock_transactions TO authenticated;
CREATE OR REPLACE VIEW public.stock_transactions_owner_view
WITH (security_invoker = true)
AS SELECT * FROM public.stock_transactions WHERE public.is_owner(business_id, auth.uid());
GRANT SELECT ON public.stock_transactions_owner_view TO authenticated;
