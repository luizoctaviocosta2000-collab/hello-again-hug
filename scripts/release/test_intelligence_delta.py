#!/usr/bin/env python3
"""Replay only the two additive intelligence migrations on a disposable core snapshot.
Requires Docker. No hosted database, ports, user data or credentials are used.
"""
import subprocess
import time
from pathlib import Path

root = Path(__file__).resolve().parents[2]
docker = ['docker', '--host=unix:///var/run/docker.sock']
container = subprocess.check_output(docker + ['run', '-d', '--network', 'none', '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'], text=True).strip()

def sql(text):
    result = subprocess.run(docker + ['exec', '-i', container, 'psql', '-U', 'postgres',
        '-X', '-q', '-v', 'ON_ERROR_STOP=1'], input=text, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)

try:
    for _ in range(120):
        if subprocess.run(docker + ['exec', container, 'pg_isready', '-h', '127.0.0.1',
            '-U', 'postgres'], capture_output=True).returncode == 0:
            break
        time.sleep(.25)
    sql((root / 'tests/database/journey_schema.sql').read_text())
    # Auth fixture columns only; this never runs on Supabase.
    sql("alter table auth.users add column email text, add column raw_user_meta_data jsonb;")
    # Local snapshot omits Auth profile provisioning; model that fixture dependency.
    sql("""create function public.fixture_profile() returns trigger language plpgsql as $$
    begin insert into public.profiles(id,name,email) values(new.id,'Fictitious profile',coalesce(new.email,'fixture@example.invalid')); return new; end; $$;
    create trigger fixture_profile after insert on auth.users for each row execute function public.fixture_profile();""")
    for name in ['20261118100000_intelligence_foundation.sql',
                 '20261118180000_agent_autonomy_control_plane.sql']:
        sql('begin;\n' + (root / 'supabase/migrations' / name).read_text() + '\ncommit;')
        print('PASS migration:', name, flush=True)
    sql((root / 'tests/database/intelligence_staging_regression.sql').read_text())
    print('PASS intelligence tenant/source/idempotency regression', flush=True)
    sql("insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');")
    sql((root / 'tests/database/agent_autonomy_regression.sql').read_text())
    print('PASS autonomy tenant/permissions/defaults regression', flush=True)
finally:
    subprocess.run(docker + ['rm', '-f', '-v', container], capture_output=True, check=True)
