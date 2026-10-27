-- Read-only checks; execute as a database administrator after applying the migration.
-- Do not expose the private helper directly to the Data API.
with live as (
  select private.tv_bed_preparation(payload,updated_at) feed,payload,updated_at
  from public.booking_snapshot where id=1
)
select feed->>'state' as state,jsonb_array_length(feed->'rows') as properties,
  private.tv_bed_preparation(payload,now()-interval '2 hours')->>'state' as stale_state,
  has_function_privilege('anon','private.tv_bed_preparation(jsonb,timestamptz)','EXECUTE') as anonymous_helper_access,
  has_function_privilege('authenticated','private.tv_bed_preparation(jsonb,timestamptz)','EXECUTE') as staff_helper_access,
  position('Invalid TV feed key' in pg_get_functiondef('public.tv_dashboard_staff_feed(text)'::regprocedure))>0 as existing_guard_preserved
from live;
