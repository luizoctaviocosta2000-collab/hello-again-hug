-- Run after every migration exists.
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
create schema if not exists f0test;
grant usage on schema f0test to authenticated;
create table if not exists f0test.result (
  phase text not null,
  who   text not null,
  payload jsonb,
  list    jsonb,
  primary key (phase, who)
);
grant all on all tables in schema f0test to authenticated;
