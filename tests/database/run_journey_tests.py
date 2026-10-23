"""Replay the schema-only snapshot and test the journey in a disposable DB."""
import os
from pathlib import Path
import subprocess

if os.environ.get('PGHOST') not in {'localhost','127.0.0.1'} or os.environ.get('PGDATABASE') != 'imobfy_journey_test':
    raise SystemExit('Requires empty local PGDATABASE=imobfy_journey_test.')
root=Path(__file__).resolve().parents[2]
for file in ['tests/database/journey_schema.sql','supabase/migrations/20261022182211_atomic_visit_journey.sql','tests/database/journey_regression.sql']:
    result=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-f',str(root/file)],capture_output=True,text=True,timeout=60)
    if result.returncode: raise SystemExit(result.stderr)
    print('PASS',file,flush=True)
