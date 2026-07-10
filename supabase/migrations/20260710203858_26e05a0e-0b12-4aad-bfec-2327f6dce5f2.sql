
REVOKE EXECUTE ON FUNCTION public.is_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.member_role(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_stock_transaction() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_owner_membership() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_business_with_code(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_invite_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_business_with_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner(UUID, UUID) TO authenticated;
