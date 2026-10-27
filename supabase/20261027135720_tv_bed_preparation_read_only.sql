-- Add a read-only, guest-free bed preparation section to the existing paired TV feed.
-- The existing TV token check and every existing operations field are preserved.
create or replace function private.tv_bed_preparation(p jsonb, received timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $beds$
declare
  result jsonb;
  today date := (now() at time zone 'Europe/London')::date;
begin
  if not coalesce((select active from public.booking_feed_control where id=1),false) then
    return jsonb_build_object('state','unavailable','rows','[]'::jsonb);
  end if;
  perform private.assert_booking_feed_fresh(p,received);
  if today < (p->>'coverage_from')::date or today > (p->>'coverage_through')::date then
    return jsonb_build_object('state','unavailable','rows','[]'::jsonb);
  end if;
  with property_config(barn,bedrooms) as (
    values ('Holly Tree Barn',2),
      ('Red Oak Barn',2),
      ('Field Maple Barn',2),
      ('Wild Cherry Barn',2),
      ('Meadowsweet Barn',5),
      ('The Birches',5),
      ('The Elms',4),
      ('The Hazels',4),
      ('The Pines',4),
      ('The Sycamores',4),
      ('The Willows',5),
      ('Blue Iris Cottage',3),
      ('Dragonfly Cottage',2),
      ('Mallard Cottage',3),
      ('Marsh Marigold Cottage',3),
      ('Water Lily Cottage',2),
      ('White Swan Cottage',2),
      ('Bailgate Barn',3),
      ('Castle Hill Barn',3),
      ('Eastgate Barn',4),
      ('Lindum Barn',4),
      ('Chestnut House',5),
      ('Rowan House',5),
      ('Walnut House',5)
  ), candidates as (
    select b, private.housekeeping_time(b,true) as arrival_at
    from jsonb_array_elements(p->'bookings') b
    where b->>'safe_output'='true' and b->>'kind'='guest_booking'
      and private.housekeeping_time(b,true)>now()
      and (b->>'arrival_date')::date <= (p->>'coverage_through')::date
  ), ranked as (
    select b,arrival_at,
      row_number() over(partition by b->>'barn' order by arrival_at,b->>'booking_reference') as position,
      count(*) over(partition by b->>'barn',arrival_at) as conflicts
    from candidates
  ), next_bookings as (
    select * from ranked where position=1
  ), display_rows as (
    select barns.name,barns.sort_order,config.bedrooms,n.b,n.conflicts,
      prep.needed_by,
      coalesce(rooms.preferences,'[]'::jsonb) as preferences,
      n.b is not null and (
        config.bedrooms is null or n.conflicts>1
        or jsonb_typeof(n.b->'bed_preferences') is distinct from 'array'
        or jsonb_array_length(coalesce(n.b->'bed_preferences','[]'::jsonb))<>config.bedrooms
        or coalesce(rooms.unconfirmed,true)
      ) as needs_check
    from public.barns barns
    left join property_config config on config.barn=barns.name
    left join next_bookings n on n.b->>'barn'=barns.name
    left join lateral private.bed_laundry_preparation(n.b) prep on n.b is not null
    left join lateral (
      select jsonb_agg(jsonb_build_object('bedroom',room,
        'selection',coalesce(choice.selection,'Not provided')) order by room) as preferences,
        bool_or(choice.selection is null) as unconfirmed
      from generate_series(1,config.bedrooms) room
      left join lateral (
        select case when count(*)=1
          and min(pref->>'selection') in ('Superking','Twin beds')
          then min(pref->>'selection') end as selection
        from jsonb_array_elements(case when jsonb_typeof(n.b->'bed_preferences')='array'
          then n.b->'bed_preferences' else '[]'::jsonb end) pref
        where pref->>'bedroom'=room::text
      ) choice on true
    ) rooms on n.b is not null
    where barns.active
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'barn',name,
    'state',case when b is null then 'no-booking' when conflicts>1 then 'conflict' else 'booking' end,
    'arrivalDate',b->>'arrival_date',
    'checkInTime',b->>'check_in_time',
    'neededBy',needed_by,
    'expectedBedrooms',bedrooms,
    'bedPreferences',case when coalesce(conflicts,0)>1 then '[]'::jsonb else preferences end,
    'needsCheck',needs_check
  ) order by coalesce(needed_by,(b->>'arrival_date')::date) nulls last,sort_order,name),'[]'::jsonb)
  into result from display_rows;
  return jsonb_build_object('state','ready','date',today,'generatedAt',p->>'generatedAt',
    'coverageThrough',p->>'coverage_through','rows',result);
exception when others then
  -- Never let stale or incomplete bookings look like a verified empty preparation list.
  -- Existing hot-tub/operations screens remain available when the booking source fails.
  return jsonb_build_object('state','unavailable','rows','[]'::jsonb);
end;
$beds$;
revoke all on function private.tv_bed_preparation(jsonb,timestamptz) from public,anon,authenticated,service_role;

do $patch$
declare definition text;
begin
  definition := pg_get_functiondef('public.tv_dashboard_staff_feed(text)'::regprocedure);
  if position('private.tv_bed_preparation(' in definition)=0 then
    if position('return result;' in definition)=0 then
      raise exception 'TV feed return changed; review integration before applying';
    end if;
    definition := replace(definition,'return result;',
      'return result || jsonb_build_object(''bedPreparation'',coalesce((select private.tv_bed_preparation(s.payload,s.updated_at) from public.booking_snapshot s where s.id=1),jsonb_build_object(''state'',''unavailable'',''rows'',''[]''::jsonb)));');
    execute definition;
  end if;
end;
$patch$;
