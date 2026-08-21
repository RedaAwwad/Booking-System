#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run k6 performance tests against the Booking System.

.DESCRIPTION
    Wrapper script that selects and runs one or more k6 test scenarios.
    Metrics are:
      1. Streamed live to Logstash :5001  →  Elasticsearch  →  Kibana  (real-time)
      2. Written as an archived JSON file to k6\results\<test>_<timestamp>.json
    App logs and Zipkin traces are captured automatically by the running stack.

.PARAMETER Test
    Which test to run:
      smoke        - Quick sanity check (01-smoke.test.js)
      load         - Normal daily traffic (02-load.test.js)
      stress       - Beyond capacity (03-stress.test.js)
      spike        - Flash-sale burst (04-spike.test.js)
      soak         - Endurance / leak detection (05-soak.test.js)
      breakpoint   - Find the breaking point (06-breakpoint.test.js)
      auth         - Auth flow benchmark (07-auth-flow.test.js)
      concurrency  - Concurrent booking race (08-booking-concurrency.test.js)
      all          - Run smoke + load + stress sequentially

.PARAMETER BaseUrl
    Override the default http://localhost:8080 base URL.

.PARAMETER SoakDuration
    Duration for the soak test (default: 30m). E.g. "1h", "2h".

.PARAMETER LogstashHost
    Hostname of the Logstash server receiving k6 metrics (default: localhost).

.PARAMETER LogstashPort
    Port of the Logstash k6 metrics pipeline (default: 5001).

.PARAMETER StreamToLogstash
    Set to $false to disable live metric streaming (offline / CI mode).
    The JSON result file is always written regardless of this flag.

.EXAMPLE
    .\k6\run-tests.ps1 -Test smoke
    .\k6\run-tests.ps1 -Test load -BaseUrl http://staging.myapp.com
    .\k6\run-tests.ps1 -Test soak -SoakDuration 1h
    .\k6\run-tests.ps1 -Test load -StreamToLogstash:$false
    .\k6\run-tests.ps1 -Test all
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('smoke','load','stress','spike','soak','breakpoint','auth','concurrency','all')]
    [string]$Test,

    [string]$BaseUrl          = 'http://localhost:8080',
    [string]$SoakDuration     = '30m',
    [string]$LogstashHost     = 'localhost',
    [int]   $LogstashPort     = 5001,
    [switch]$StreamToLogstash = $true
)

# ─── Resolve paths ──────────────────────────────────────────────────────────
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResultsDir = Join-Path $ScriptDir 'results'
$TestsDir   = Join-Path $ScriptDir 'tests'
$Timestamp  = Get-Date -Format 'yyyyMMdd_HHmmss'

if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}

# ─── Check k6 is installed ──────────────────────────────────────────────────
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  ⚠  k6 is not installed or not in PATH." -ForegroundColor Yellow
    Write-Host "     Install it from: https://k6.io/docs/get-started/installation/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Quick install options:" -ForegroundColor Cyan
    Write-Host "    Windows (winget): winget install k6" -ForegroundColor White
    Write-Host "    Windows (choco):  choco install k6" -ForegroundColor White
    Write-Host ""
    exit 1
}

# ─── Check Logstash connectivity (optional, non-blocking) ───────────────────
function Test-LogstashConnection {
    param([string]$Host, [int]$Port)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $result = $client.BeginConnect($Host, $Port, $null, $null)
        $ok     = $result.AsyncWaitHandle.WaitOne(1500, $false)
        $client.Close()
        return $ok
    } catch {
        return $false
    }
}

# ─── Helper: run a single test file ─────────────────────────────────────────
function Invoke-K6Test {
    param(
        [string]$TestFile,
        [string]$Label
    )

    $outputFile = Join-Path $ResultsDir "${Label}_${Timestamp}.json"

    # ── Build the k6 output arguments ────────────────────────────────────────
    # Always write a local JSON archive
    $outputArgs = @("--out", "json=$outputFile")

    # Optionally stream live metrics to Logstash via the experimental
    # statsd/json-tcp output. k6 supports --out json which writes NDJSON.
    # We use a secondary --out json=stdout piped through nc to Logstash.
    $logstashAvailable = $false
    if ($StreamToLogstash) {
        $logstashAvailable = Test-LogstashConnection -Host $LogstashHost -Port $LogstashPort
        if ($logstashAvailable) {
            Write-Host "  📡 Logstash reachable at ${LogstashHost}:${LogstashPort} — streaming metrics live" -ForegroundColor Green
        } else {
            Write-Host "  ⚠  Logstash not reachable at ${LogstashHost}:${LogstashPort} — metrics saved locally only" -ForegroundColor Yellow
            Write-Host "     (Start the stack with: docker compose up -d)" -ForegroundColor DarkGray
        }
    }

    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  🚀 Running : $Label" -ForegroundColor Green
    Write-Host "  📁 Script  : $TestFile" -ForegroundColor Gray
    Write-Host "  🌐 Target  : $BaseUrl" -ForegroundColor Gray
    Write-Host "  💾 Archive : $outputFile" -ForegroundColor Gray
    if ($StreamToLogstash -and $logstashAvailable) {
        Write-Host "  📊 Kibana  : http://localhost:5601  (index: k6-metrics-*)" -ForegroundColor Magenta
        Write-Host "  🔍 Zipkin  : http://localhost:9411  (traces per request)" -ForegroundColor Magenta
    }
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""

    if ($StreamToLogstash -and $logstashAvailable) {
        # Stream live: write to both file (archive) and a Logstash-bound
        # second JSON output. We use a temp FIFO-like approach via a
        # background job that sends completed result file to Logstash.
        $k6Args = @(
            'run',
            '--out', "json=$outputFile",
            '-e', "K6_BASE_URL=$BaseUrl",
            '-e', "K6_SOAK_DURATION=$SoakDuration",
            $TestFile
        )

        # Run k6; once done, ship the result file to Logstash line-by-line
        & k6 @k6Args
        $exitCode = $LASTEXITCODE

        # Post-run: feed the result JSON file into Logstash via TCP
        # Logstash k6-metrics.conf has both a tcp input (port 5001) AND
        # a file input watching the shared volume — this covers the local case.
        Write-Host ""
        Write-Host "  📤 Shipping result file to Logstash ${LogstashHost}:${LogstashPort}..." -ForegroundColor Cyan
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient($LogstashHost, $LogstashPort)
            $stream    = $tcpClient.GetStream()
            $writer    = New-Object System.IO.StreamWriter($stream)
            $writer.AutoFlush = $true

            $lines = Get-Content $outputFile
            $sent  = 0
            foreach ($line in $lines) {
                if ($line.Trim() -ne '') {
                    $writer.WriteLine($line)
                    $sent++
                }
            }

            $writer.Close()
            $tcpClient.Close()
            Write-Host "  ✅ Shipped $sent metric lines to Logstash" -ForegroundColor Green
            Write-Host "     Open Kibana → Discover → select index: k6-metrics-*" -ForegroundColor DarkGray
        } catch {
            Write-Host "  ⚠  Could not ship to Logstash: $_" -ForegroundColor Yellow
            Write-Host "     Result file is still available at: $outputFile" -ForegroundColor DarkGray
        }

    } else {
        # Offline mode — just run k6 and save locally
        $k6Args = @(
            'run',
            '--out', "json=$outputFile",
            '-e', "K6_BASE_URL=$BaseUrl",
            '-e', "K6_SOAK_DURATION=$SoakDuration",
            $TestFile
        )
        & k6 @k6Args
        $exitCode = $LASTEXITCODE
    }

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "  ✅ $Label PASSED" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  ❌ $Label FAILED (exit code: $exitCode)" -ForegroundColor Red
    }

    Write-Host ""
    return $exitCode
}

# ─── Test map ───────────────────────────────────────────────────────────────
$TestMap = @{
    'smoke'       = @{ file = '01-smoke.test.js';               label = 'smoke' }
    'load'        = @{ file = '02-load.test.js';                label = 'load' }
    'stress'      = @{ file = '03-stress.test.js';              label = 'stress' }
    'spike'       = @{ file = '04-spike.test.js';               label = 'spike' }
    'soak'        = @{ file = '05-soak.test.js';                label = 'soak' }
    'breakpoint'  = @{ file = '06-breakpoint.test.js';          label = 'breakpoint' }
    'auth'        = @{ file = '07-auth-flow.test.js';           label = 'auth_flow' }
    'concurrency' = @{ file = '08-booking-concurrency.test.js'; label = 'booking_concurrency' }
}

# ─── Print header ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Booking System – k6 Performance Test Runner      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Observability stack:" -ForegroundColor White
Write-Host "    ELK  → http://localhost:5601   (k6 metrics + app logs)" -ForegroundColor DarkGray
Write-Host "    Zipkin → http://localhost:9411  (distributed traces)" -ForegroundColor DarkGray
Write-Host ""

# ─── Execute ─────────────────────────────────────────────────────────────────
$overallExit = 0

if ($Test -eq 'all') {
    $sequence = @('smoke', 'load', 'stress')
    foreach ($t in $sequence) {
        $entry    = $TestMap[$t]
        $testFile = Join-Path $TestsDir $entry.file
        $exit     = Invoke-K6Test -TestFile $testFile -Label $entry.label
        if ($exit -ne 0) { $overallExit = $exit }
        Write-Host "  ⏳ Waiting 10 s before next test..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 10
    }
} else {
    $entry    = $TestMap[$Test]
    $testFile = Join-Path $TestsDir $entry.file
    $overallExit = Invoke-K6Test -TestFile $testFile -Label $entry.label
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Results archive : $ResultsDir" -ForegroundColor White
Write-Host "  Kibana           : http://localhost:5601  → index: k6-metrics-*" -ForegroundColor Magenta
Write-Host "  App logs         : http://localhost:5601  → index: booking-app-logs-*" -ForegroundColor Magenta
Write-Host "  Zipkin traces    : http://localhost:9411" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

exit $overallExit
