"""Integration tests in a disposable local PostgreSQL database; never production."""
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
if os.environ.get('PGHOST') not in {'localhost', '127.0.0.1'} or os.environ.get('PGDATABASE') != 'imobfy_receipt_test':
    raise SystemExit('Use localhost and PGDATABASE=imobfy_receipt_test (empty disposable DB).')
PSQL = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']

def sql(command):
    return subprocess.run(PSQL, input=command, text=True, capture_output=True, check=True, timeout=30).stdout.strip()

for file in ['tests/database/receipt_fixture.sql',
             'supabase/migrations/20261022133523_harden_commission_receipt_ownership.sql',
             'tests/database/receipt_regression.sql']:
    sql((ROOT / file).read_text())
    print('PASS', file, flush=True)

USER = '10000000-0000-0000-0000-000000000001'
COMMISSION = '00000000-0000-0000-0000-000000000004'
AUTH = f"set role authenticated; set request.jwt.claim.sub='{USER}';"
INSERT = f"insert into public.commission_receipts(user_id,commission_id,amount) values ('{USER}','{COMMISSION}',60);"

# Hold the first transaction open until a second session demonstrably waits on it.
holder = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
contender = None
try:
    holder.stdin.write('begin; ' + AUTH + INSERT + '\n\\echo LOCKED\n')
    holder.stdin.flush()
    if holder.stdout.readline().strip() != 'LOCKED':
        raise AssertionError('Holder failed to insert receipt')
    contender = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    contender.stdin.write("set application_name='imobfy_receipt_contender';" + AUTH + INSERT)
    contender.stdin.close()
    deadline = time.monotonic() + 10
    blocked = False
    while time.monotonic() < deadline:
        blocked = sql("select exists(select 1 from pg_stat_activity where application_name='imobfy_receipt_contender' and wait_event_type='Lock')") == 't'
        if blocked or contender.poll() is not None:
            break
        time.sleep(0.1)
    assert blocked, 'Second receipt must wait for the commission lock'
    holder.stdin.write('commit;\n\\q\n')
    holder.stdin.flush()
    holder.wait(timeout=10)
    assert holder.returncode == 0, holder.stderr.read()
    contender.wait(timeout=10)
    error = contender.stderr.read()
    assert contender.returncode != 0 and '23514' in error, error
    assert sql(f"select sum(amount) from public.commission_receipts where commission_id='{COMMISSION}'") == '60.00'
    assert sql(f"select status from public.commissions where id='{COMMISSION}'") == 'partially_received'
    print('PASS concurrent receipts: second session blocked, then overpayment rejected', flush=True)
finally:
    for process in [holder, contender]:
        if process and process.poll() is None:
            process.kill()
            process.wait()
