# F0 / R2 - disposable PostgreSQL 17 harness
#
# Runs the whole database chain (everything except the defeated legacy
# 20260908 baseline), applies F0-A / F0-B / R2 in the real order and asserts:
#   * value preservation, NULL preservation, idempotency, rename-only rollback
#   * status CHECK widening (accepts the union, rejects outside it)
#   * AI read functions: invoker, stable, empty search_path, anon denied
#   * F0 reproduces the indicator bug (2050), R2 fixes it (2750) and isolates users
#   * an unknown legacy status is reported instead of silently counted
#
# The repository path may contain non-ASCII characters, which psql -f cannot
# open on Windows. Everything is copied to an ASCII staging folder first.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tests/database/f0/run.ps1 `
#     -PgBin "C:\path\to\pgsql\bin"
#
# Optional: -Port 55439 -WorkDir "C:\temp\imobfy-f0"
# Nothing remote is touched: the cluster is created under WorkDir and destroyed.

param(
  [string]$PgBin = "",
  [int]$Port = 55439,
  [string]$WorkDir = ""
)

$ErrorActionPreference = "Continue"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path

if (-not $PgBin) {
  $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "psql.exe nao encontrado. Informe -PgBin com a pasta bin do PostgreSQL 17." }
  $PgBin = Split-Path $cmd.Source
}
$Psql = Join-Path $PgBin "psql.exe"
if (-not (Test-Path $Psql)) { throw "psql.exe nao existe em $PgBin" }

if (-not $WorkDir) { $WorkDir = Join-Path $env:TEMP "imobfy-f0-pg17" }
$Data  = Join-Path $WorkDir "data"
$Stage = Join-Path $WorkDir "stage"
$Log   = Join-Path $WorkDir "postgres.log"
New-Item -ItemType Directory -Force $WorkDir | Out-Null

$script:pass = 0

function Step([string]$msg) { Write-Host "`n=== $msg ===" }

function Invoke-Psql {
  param([string]$Db, [string]$File, [hashtable]$Vars = @{})
  $a = @("-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $Db,
         "-q", "-v", "ON_ERROR_STOP=1", "-f", $File)
  foreach ($k in $Vars.Keys) { $a += @("-v", "$k=$($Vars[$k])") }
  $out = & $Psql @a 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ($out | Out-String)
    throw "FALHOU: $File"
  }
  return $out
}

function Invoke-Test {
  param([string]$Db, [string]$File, [hashtable]$Vars = @{})
  $out = Invoke-Psql $Db $File $Vars
  $out | Where-Object { $_ -match 'PASS|BUG-REPRO|FAIL|ERROR|FATAL' } | ForEach-Object { "  $_" }
  $script:pass += @($out | Where-Object { $_ -match 'NOTICE:\s+PASS' }).Count
}

try {
  # fresh cluster
  if (Test-Path $Data) {
    Get-Process postgres -ErrorAction SilentlyContinue |
      Where-Object { $_.Path -like "$PgBin*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Remove-Item -Recurse -Force $Data -ErrorAction SilentlyContinue
  }
  if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage -ErrorAction SilentlyContinue }

  Step "staging ASCII (repo tem caminho com acento)"
  New-Item -ItemType Directory -Force $Stage | Out-Null
  Copy-Item (Join-Path $RepoRoot "supabase\migrations") (Join-Path $Stage "migrations") -Recurse
  Copy-Item $PSScriptRoot (Join-Path $Stage "tests") -Recurse
  $Mig = Join-Path $Stage "migrations"
  $Tst = Join-Path $Stage "tests"
  if (-not (Test-Path (Join-Path $Mig "202609090001_imobfy_core.sql"))) { throw "migracoes nao copiadas" }

  Step "initdb (PostgreSQL)"
  & (Join-Path $PgBin "initdb.exe") -D $Data -U postgres -A trust --encoding=UTF8 --locale=C 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "initdb falhou" }

  Step "start postgres :$Port"
  $pg = Start-Process -FilePath (Join-Path $PgBin "postgres.exe") `
    -ArgumentList @("-D", $Data, "-p", "$Port", "-c", "listen_addresses=127.0.0.1") `
    -RedirectStandardOutput (Join-Path $WorkDir "pg.out") `
    -RedirectStandardError (Join-Path $WorkDir "pg.err") `
    -WindowStyle Hidden -PassThru
  $ready = $false
  for ($i = 0; $i -lt 120; $i++) {
    & (Join-Path $PgBin "pg_isready.exe") -h 127.0.0.1 -p $Port -q 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "postgres nao subiu; veja $Log" }
  & $Psql -h 127.0.0.1 -p $Port -U postgres -d postgres -tAc "select version()"

  & (Join-Path $PgBin "createdb.exe") -h 127.0.0.1 -p $Port -U postgres imobfy_preserve
  & (Join-Path $PgBin "createdb.exe") -h 127.0.0.1 -p $Port -U postgres imobfy_replay

  # ---- DB 1: preservation / NULL / idempotency / rollback -------------------
  Step "PRESERVE: bootstrap + baseline canonico"
  Invoke-Psql imobfy_preserve (Join-Path $Tst "bootstrap.sql") | Out-Null
  Invoke-Psql imobfy_preserve (Join-Path $Mig "202609090001_imobfy_core.sql") | Out-Null

  Step "PRESERVE: fixtures"
  Invoke-Psql imobfy_preserve (Join-Path $Tst "preserve_fixtures.sql") | Out-Null

  Step "PRESERVE: F0-A (1a execucao)"
  Invoke-Psql imobfy_preserve (Join-Path $Mig "202609090002_f0_baseline_reconciliation.sql") | Out-Null
  Invoke-Test  imobfy_preserve (Join-Path $Tst "assert_preserve.sql")

  Step "PRESERVE: F0-A reexecucao (idempotencia)"
  Invoke-Psql imobfy_preserve (Join-Path $Mig "202609090002_f0_baseline_reconciliation.sql") | Out-Null
  Invoke-Test  imobfy_preserve (Join-Path $Tst "assert_preserve.sql")

  Step "PRESERVE: rollback rename-only"
  Invoke-Test imobfy_preserve (Join-Path $Tst "rollback_probe.sql")

  # ---- DB 2: full chain + F0-B + R2 -----------------------------------------
  Step "REPLAY: bootstrap + cadeia completa (R2 fica para depois da captura F0)"
  Invoke-Psql imobfy_replay (Join-Path $Tst "bootstrap.sql") | Out-Null
  $migs = Get-ChildItem (Join-Path $Mig "*.sql") | Sort-Object Name |
          Where-Object { $_.Name -ne "20260908_imobfy_core.sql" -and
                         $_.Name -ne "20261120091000_r2_status_indicators.sql" }
  Write-Host ("  migrations: " + $migs.Count)
  foreach ($m in $migs) { Invoke-Psql imobfy_replay $m.FullName | Out-Null }

  Step "REPLAY: grants + estrutura/funcoes"
  Invoke-Psql imobfy_replay (Join-Path $Tst "grants.sql") | Out-Null
  Invoke-Test imobfy_replay (Join-Path $Tst "assert_replay.sql")

  Step "REPLAY: matriz financeira (F0 deve reproduzir o bug)"
  Invoke-Psql imobfy_replay (Join-Path $Tst "finance_seed.sql") | Out-Null
  Invoke-Psql imobfy_replay (Join-Path $Tst "finance_capture.sql") @{ phase = "f0" } | Out-Null

  Step "REPLAY: aplicar R2 e capturar de novo"
  Invoke-Psql imobfy_replay (Join-Path $Mig "20261120091000_r2_status_indicators.sql") | Out-Null
  Invoke-Psql imobfy_replay (Join-Path $Tst "finance_capture.sql") @{ phase = "r2" } | Out-Null
  Invoke-Test  imobfy_replay (Join-Path $Tst "finance_assert.sql")

  Step "REPLAY: status desconhecido (producao nao tem CHECK)"
  Invoke-Psql imobfy_replay (Join-Path $Tst "prodlike_unknown.sql") | Out-Null
  Invoke-Psql imobfy_replay (Join-Path $Tst "finance_capture.sql") @{ phase = "prodlike" } | Out-Null
  Invoke-Test  imobfy_replay (Join-Path $Tst "assert_prodlike.sql")

  Write-Host "`nPASS lines: $script:pass"
  Write-Host "ALL SUITES PASSED"
}
finally {
  if ($pg) { Stop-Process -Id $pg.Id -Force -ErrorAction SilentlyContinue }
}
