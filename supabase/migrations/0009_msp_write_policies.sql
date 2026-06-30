-- Allow MSP staff (msp_admin, msp_tech, legacy admin) to write orgs and locations.
-- This lets the /api/orgs route work with the user's session JWT instead of relying
-- solely on the service-role key.

-- orgs: msp_admin can insert, update, delete
create policy "msp admin insert orgs"
  on public.orgs for insert
  to authenticated
  with check (is_msp_staff());

create policy "msp admin update orgs"
  on public.orgs for update
  to authenticated
  using (is_msp_staff());

create policy "msp admin delete orgs"
  on public.orgs for delete
  to authenticated
  using (is_msp_staff());

-- locations: msp_admin can insert, update, delete
create policy "msp admin insert locations"
  on public.locations for insert
  to authenticated
  with check (is_msp_staff());

create policy "msp admin update locations"
  on public.locations for update
  to authenticated
  using (is_msp_staff());

create policy "msp admin delete locations"
  on public.locations for delete
  to authenticated
  using (is_msp_staff());
