
-- Fix missing SELECT privileges causing permission errors on products/stock_transactions
GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.stock_transactions TO authenticated;

-- Clean up any accounts created via Google OAuth during testing.
-- Businesses and business_members owned by those users cascade via FK.
DELETE FROM auth.users
WHERE id IN (
  SELECT user_id FROM auth.identities WHERE provider = 'google'
);
