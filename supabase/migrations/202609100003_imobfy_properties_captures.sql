-- Imobfy Phase 3: richer property inventory + owner/capture workflow.
-- Keeps legacy owner_name/owner_phone populated for compatibility.

alter table public.properties
  add column if not exists property_code text,
  add column if not exists zip_code text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists bathrooms integer,
  add column if not exists condominium_fee numeric(14,2),
  add column if not exists iptu_amount numeric(14,2),
  add column if not exists habite_se text,
  add column if not exists origin text,
  add column if not exists capture_date timestamptz,
  add column if not exists exclusivity boolean not null default false,
  add column if not exists commercial_notes text;

create unique index if not exists properties_user_code_idx
  on public.properties(user_id, property_code)
  where property_code is not null and property_code <> '';

create index if not exists properties_user_status_idx on public.properties(user_id, status);
create index if not exists properties_user_neighborhood_idx on public.properties(user_id, neighborhood);
create index if not exists captures_active_property_idx
  on public.captures(user_id, property_id)
  where status = 'active';
create index if not exists captures_owner_id_idx on public.captures(owner_id);
create index if not exists captures_status_idx on public.captures(user_id, status);

comment on table public.owners is 'Proprietários dos imóveis captados pelo corretor.';
comment on table public.captures is 'Registro da captação, exclusividade, origem e participação comercial do imóvel.';
comment on column public.properties.property_code is 'Código interno do imóvel na operação do corretor.';
comment on column public.properties.exclusivity is 'Indica se a captação é exclusiva.';
comment on column public.captures.capture_type is 'normal, exclusive ou shared (meiada).';
