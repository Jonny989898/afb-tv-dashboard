# AFB TV dashboards

The existing outside-staff dashboard remains at:
https://jonny989898.github.io/afb-tv-dashboard/

## Cleaning staff: next-booking beds

Open:
https://jonny989898.github.io/afb-tv-dashboard/beds.html

The dedicated read-only screen shows the next future guest booking for every active property, the approved preparation date where available, and each bedroom's Superking or Twin choice. One Twin bedroom needs two single bedding sets.

- Six properties per page on 1080p screens; five on shorter displays.
- Pages advance every 30 seconds. Use Previous / Next, left / right remote keys, or Pause pages.
- The feed refreshes every minute. Full screen uses the browser's supported full-screen action.
- Page totals include only complete, confirmed setups. Missing choices and conflicting bookings say CHECK.
- These are requirements, not a record that bags have been packed. Record physical bagging and delivery in AFB Staff.
- No guest names, booking references, notes or staff records are included in the bed-preparation section.
- Stale, unavailable or offline booking data hides the bed quantities until verification succeeds.
- A booking whose check-in time has passed is no longer treated as the next booking. All times use Europe/London.

### Connect a TV

The page uses the same per-device pairing as the existing operations dashboard. If that browser is already paired, its saved connection is reused.

For a new device, use a manager-issued AFB TV setup link. Replace the end of its path with `beds.html`, retaining its `tv_token` parameter, or paste the original setup link into the new screen's Connect TV form. The code is stored only in that device's browser and removed from the address. Never commit or post a real setup link.

After pairing, bookmark the plain `beds.html` address on the Fire Stick. A manager can revoke the device through the existing TV-device API.

### Data integration

The existing `https://afb-internal.co.uk/api/tv-feed` endpoint forwards the new `bedPreparation` object from the existing, token-checked `tv_dashboard_staff_feed` function. The additive Supabase migration is recorded in `supabase/20261027135720_tv_bed_preparation_read_only.sql` and was applied to the AFB Staff App database on 27 October 2026.

The private projection uses the same snapshot freshness guard as AFB Staff and reads approved housekeeping preparation dates. Its bedroom counts come from the existing booking-feed property catalog. It grants no new direct database access. The migration preserves the existing feed definition, guard and ACL without committing its configured token hash.

### Validation

Run `node --test beds.test.mjs`.

Twelve checks cover set totals, incomplete/duplicate/unknown choices, conflicts, source freshness, pairing URL validation, rendering, pagination, missing setup and connection failures. Database verification covers all 24 properties, missing choices, conflicting/blocked/past bookings, stale-feed rejection and private-helper permissions. The security advisor reported no new findings after deployment.

Browser visual verification and physical Fire Stick testing remain outstanding.
