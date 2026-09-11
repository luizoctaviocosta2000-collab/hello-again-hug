-- IMOBFY: persist operational settings in the authenticated user's profile.
-- Commission settings already feed the sales commission trigger; this migration
-- makes the Settings screen the durable source of those values.

alter table public.profiles
  add column if not exists vgv_goal numeric(14,2) not null default 0;

-- Keep existing users safe while enforcing sane percentage ranges.
update public.profiles
set default_commission_pct = least(greatest(coalesce(default_commission_pct, 6), 0), 100),
    tax_pct = least(greatest(coalesce(tax_pct, 9), 0), 100),
    participation_pct = least(greatest(coalesce(participation_pct, 20), 0), 100),
    vgv_goal = greatest(coalesce(vgv_goal, 0), 0);

alter table public.profiles
  drop constraint if exists profiles_default_commission_pct_range,
  drop constraint if exists profiles_tax_pct_range,
  drop constraint if exists profiles_participation_pct_range,
  drop constraint if exists profiles_vgv_goal_nonnegative;

alter table public.profiles
  add constraint profiles_default_commission_pct_range check (default_commission_pct between 0 and 100),
  add constraint profiles_tax_pct_range check (tax_pct between 0 and 100),
  add constraint profiles_participation_pct_range check (participation_pct between 0 and 100),
  add constraint profiles_vgv_goal_nonnegative check (vgv_goal >= 0);
