
-- 1) PROFILES
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update own profile
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Owners can read profiles of members in businesses they own
CREATE OR REPLACE FUNCTION public.is_owner_of_member(_target_user UUID, _viewer UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_members owner_row
    JOIN public.business_members member_row
      ON member_row.business_id = owner_row.business_id
    WHERE owner_row.user_id = _viewer
      AND owner_row.role = 'owner'
      AND member_row.user_id = _target_user
  );
$$;

CREATE POLICY "owners read team profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_owner_of_member(user_id, auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill for existing users
INSERT INTO public.profiles (user_id, name, phone)
SELECT id, COALESCE(raw_user_meta_data->>'name',''), COALESCE(raw_user_meta_data->>'phone','')
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 2) PLATFORM ADMINS
CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read own row" ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _uid);
$$;

-- Bootstrap: the signed-in user can claim admin if their phone matches the allowlist
CREATE OR REPLACE FUNCTION public.claim_platform_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _phone TEXT;
BEGIN
  IF _uid IS NULL THEN RETURN FALSE; END IF;
  SELECT COALESCE(raw_user_meta_data->>'phone','') INTO _phone FROM auth.users WHERE id = _uid;
  IF _phone IN ('683640243') THEN
    INSERT INTO public.platform_admins (user_id, phone_number)
    VALUES (_uid, _phone)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END; $$;

-- 3) BUSINESSES: soft delete
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- 4) ADMIN MESSAGES (inbox for business owners)
CREATE TABLE public.admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_broadcast BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.admin_messages TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipient reads own inbox" ON public.admin_messages FOR SELECT TO authenticated
  USING (target_user_id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "recipient marks read" ON public.admin_messages FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid()) WITH CHECK (target_user_id = auth.uid());

CREATE INDEX admin_messages_target_idx ON public.admin_messages(target_user_id, read_at);

-- 5) ADMIN RPCs
CREATE OR REPLACE FUNCTION public.admin_list_businesses()
RETURNS TABLE (
  business_id UUID,
  name TEXT,
  owner_user_id UUID,
  owner_name TEXT,
  owner_phone TEXT,
  workers_count INT,
  created_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT b.id, b.name, b.owner_id,
      COALESCE(p.name,''), COALESCE(p.phone,''),
      (SELECT COUNT(*)::INT FROM public.business_members bm WHERE bm.business_id = b.id AND bm.role = 'worker'),
      b.created_at, b.deactivated_at
    FROM public.businesses b
    LEFT JOIN public.profiles p ON p.user_id = b.owner_id
    ORDER BY b.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_soft_delete_business(_business_id UUID, _restore BOOLEAN DEFAULT FALSE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.businesses SET deactivated_at = CASE WHEN _restore THEN NULL ELSE now() END
    WHERE id = _business_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_send_message(_target_user UUID, _body TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.admin_messages (from_admin_id, target_user_id, body, is_broadcast)
    VALUES (auth.uid(), _target_user, _body, FALSE)
    RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_message(_body TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n INT;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.admin_messages (from_admin_id, target_user_id, body, is_broadcast)
    SELECT auth.uid(), b.owner_id, _body, TRUE
    FROM public.businesses b
    WHERE b.deactivated_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $$;

-- 6) Update join_business_with_code to also set name/phone on profile
CREATE OR REPLACE FUNCTION public.join_business_with_code(_code TEXT, _name TEXT DEFAULT NULL, _phone TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE biz_id UUID;
BEGIN
  SELECT id INTO biz_id FROM public.businesses
    WHERE invite_code = upper(_code) AND deactivated_at IS NULL;
  IF biz_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;

  -- Upsert profile info if provided
  IF _name IS NOT NULL OR _phone IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, name, phone)
    VALUES (auth.uid(), COALESCE(_name,''), COALESCE(_phone,''))
    ON CONFLICT (user_id) DO UPDATE
      SET name = COALESCE(NULLIF(EXCLUDED.name,''), public.profiles.name),
          phone = COALESCE(NULLIF(EXCLUDED.phone,''), public.profiles.phone),
          updated_at = now();
  END IF;

  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (biz_id, auth.uid(), 'worker')
  ON CONFLICT (business_id, user_id) DO NOTHING;
  RETURN biz_id;
END; $$;
