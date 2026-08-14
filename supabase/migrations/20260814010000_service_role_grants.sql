-- The Phase 3A/3B migrations granted anon/authenticated explicit table access but never
-- granted service_role anything beyond the schema-default TRIGGER/REFERENCES/TRUNCATE
-- privileges. service_role bypasses RLS but still requires base table grants, so the API's
-- admin client could not read or write any backend table. This closes that gap only for
-- service_role; anon/authenticated privileges and all row level security policies are
-- unchanged.
grant select, insert, update, delete on
  public.profiles,
  public.wallet_link_challenges,
  public.commitments,
  public.settlement_events,
  public.notifications,
  public.audit_logs,
  public.indexer_checkpoints
to service_role;
