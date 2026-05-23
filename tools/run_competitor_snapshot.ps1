param(
  [string]$Asins = "",
  [string]$SourceAsin = "",
  [string]$Marketplace = "",
  [string]$CsvPath = "C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\amazon_product_analysis.csv",
  [string]$CrawlerUrl = "http://localhost:8787/scrape",
  [int]$Limit = 5,
  [int]$DelaySeconds = 20,
  [int]$TimeoutMs = 45000,
  [switch]$DryRun,
  [switch]$MissingOnly,
  [switch]$ShowHelp
)

$ErrorActionPreference = 'Stop'

function ConvertTo-Domain([string]$Value) {
  $text = ''
  if ($null -ne $Value) {
    $text = $Value.Trim().ToLowerInvariant()
  }

  if (!$text) { return 'amazon.com' }
  if ($text.StartsWith('amazon.')) { return $text }

  switch ($text) {
    'in' { return 'amazon.in' }
    'india' { return 'amazon.in' }
    'us' { return 'amazon.com' }
    'usa' { return 'amazon.com' }
    'com' { return 'amazon.com' }
    'uk' { return 'amazon.co.uk' }
    'gb' { return 'amazon.co.uk' }
    'ca' { return 'amazon.ca' }
    'de' { return 'amazon.de' }
    'fr' { return 'amazon.fr' }
    'it' { return 'amazon.it' }
    'es' { return 'amazon.es' }
    'jp' { return 'amazon.co.jp' }
    default { return $text }
  }
}

function Split-Asins([string]$Value) {
  if (!$Value) { return @() }

  return @(
    $Value -split '[,\s;|]+' |
      ForEach-Object { $_.Trim().ToUpperInvariant() } |
      Where-Object { $_ -match '^[A-Z0-9]{10}$' } |
      Select-Object -Unique
  )
}

function Normalize-Asin([string]$Value) {
  if (!$Value) { return '' }
  $text = $Value.Trim().ToUpperInvariant()
  if ($text -match '^[A-Z0-9]{10}$') { return $text }
  return ''
}

function Clean-AvailabilityText([string]$Value) {
  if (!$Value) { return $Value }
  $text = ($Value -replace '\s+', ' ').Trim()
  if (!$text) { return $text }

  $patterns = @(
    "Currently unavailable\. We don't know when or if this item will be back in stock\.",
    'Temporarily out of stock\.',
    'In stock\.?',
    'Only [0-9]+ left in stock[^.]*\.?',
    'Usually dispatched[^.]*\.?'
  )

  foreach ($pattern in $patterns) {
    if ($text -match $pattern) {
      return $Matches[0].Trim()
    }
  }

  if ($text -match 'P\.when|function\(|ueLogError|setTimeout') {
    if ($text.Length -gt 180) {
      return ($text.Substring(0, 180).Trim() + '...')
    }
  }

  if ($text.Length -gt 260) {
    return ($text.Substring(0, 260).Trim() + '...')
  }

  return $text
}

function Get-PropertyValue($Object, [string]$Name) {
  if ($null -eq $Object) { return $null }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Copy-SnapshotRow($Row, [bool]$CarriedForward) {
  $copy = [ordered]@{}
  foreach ($property in $Row.PSObject.Properties) {
    $copy[$property.Name] = $property.Value
  }
  $copy['carried_forward'] = $CarriedForward
  $copy['run_action'] = if ($CarriedForward) { 'carried_forward' } else { 'existing' }
  if ($copy.Contains('availability')) {
    $copy['availability'] = Clean-AvailabilityText ([string]$copy['availability'])
  }
  if (!$copy.Contains('finished_at') -or !$copy['finished_at']) {
    $copy['finished_at'] = (Get-Date).ToString('o')
  }
  return [pscustomobject]$copy
}

function HtmlEscape([string]$Value) {
  if ($null -eq $Value) { return '' }
  return $Value.
    Replace('&', '&amp;').
    Replace('<', '&lt;').
    Replace('>', '&gt;').
    Replace('"', '&quot;').
    Replace("'", '&#39;')
}

function PsQuote([string]$Value) {
  return "'" + (($Value -replace "'", "''")) + "'"
}

function Show-Usage {
  $scriptPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }
  @(
    'Amazon competitor snapshot helper',
    '',
    'Purpose:',
    '  Low-frequency competitor ASIN snapshot. Outputs JSON and HTML logs.',
    '',
    'Commands:',
    '  1. Show help',
    "     & $(PsQuote $scriptPath) -ShowHelp",
    '',
    '  2. Refetch only missing or failed competitor rows from the latest CSV scope',
    "     & $(PsQuote $scriptPath) -MissingOnly -Limit 2 -DelaySeconds 20",
    '',
    '  3. Explicit source product and competitor set',
    "     & $(PsQuote $scriptPath) -SourceAsin 'B0BQXZ11B8' -Asins 'B08FC6C75Y; B09V4B6K53; B0BY8QNV1C' -Marketplace 'amazon.in' -MissingOnly -Limit 2 -DelaySeconds 20",
    '',
    '  4. Dry run without calling the crawler',
    "     & $(PsQuote $scriptPath) -SourceAsin 'B0BQXZ11B8' -Asins 'B08FC6C75Y; B09V4B6K53; B0BY8QNV1C' -Marketplace 'amazon.in' -DryRun",
    '',
    'Parameters:',
    '  -SourceAsin    Source product ASIN. Binds the snapshot to source + marketplace + competitor set.',
    '  -Asins         Competitor ASIN list. Supports comma, semicolon, whitespace, or line breaks.',
    '  -Marketplace   Amazon marketplace, such as amazon.in, in, amazon.com, or us.',
    '  -MissingOnly   Refetch only rows that are missing or failed in the latest snapshot.',
    '  -Limit         Maximum ASINs to fetch in this run. Keep this low.',
    '  -DelaySeconds  Delay between crawler calls. Keep 20 seconds or higher for free local crawling.',
    '  -DryRun        Generate logs without calling amazon-crawler.'
  ) -join [Environment]::NewLine
}

if ($ShowHelp) {
  Show-Usage
  return
}

if (!(Test-Path -LiteralPath $CsvPath) -and !$Asins) {
  throw "CSV not found and no ASIN list was provided: $CsvPath"
}

$latestRecord = $null
if (Test-Path -LiteralPath $CsvPath) {
  $records = @(Import-Csv -LiteralPath $CsvPath)
  $latestRecord = @($records | Where-Object { $_.competitor_asins -or $_.marketplace } | Select-Object -Last 1)[0]
}

if (!$Asins -and $latestRecord) {
  $Asins = [string]$latestRecord.competitor_asins
}
if (!$SourceAsin -and $latestRecord) {
  $SourceAsin = [string]$latestRecord.asin
}
if (!$Marketplace -and $latestRecord) {
  $Marketplace = [string]$latestRecord.marketplace
}

$requestedAsins = Split-Asins $Asins
if ($requestedAsins.Count -eq 0) {
  throw "No valid competitor ASINs found. Provide -Asins or fill competitor_asins in CSV."
}

$domain = ConvertTo-Domain $Marketplace
$sourceAsinNormalized = Normalize-Asin $SourceAsin
$sourceProductTitle = if ($latestRecord) { [string]$latestRecord.product_title } else { '' }
$competitorAsinKey = (@($requestedAsins | ForEach-Object { Normalize-Asin $_ } | Where-Object { $_ } | Sort-Object -Unique) -join '|')
$snapshotScopeKey = if ($sourceAsinNormalized) {
  "source=$sourceAsinNormalized|marketplace=$domain|competitors=$competitorAsinKey"
} else {
  "marketplace=$domain|competitors=$competitorAsinKey"
}
$outputDir = "C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$jsonPath = Join-Path $outputDir "competitor_snapshot_$stamp.json"
$historyHtmlPath = Join-Path $outputDir "competitor_snapshot_$stamp.html"
$latestJsonPath = Join-Path $outputDir "competitor_snapshot_latest.json"
$htmlPath = Join-Path $outputDir "competitor_snapshot_latest.html"
$existingByAsin = @{}

if (Test-Path -LiteralPath $latestJsonPath) {
  try {
    $existingSnapshot = Get-Content -LiteralPath $latestJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($row in @($existingSnapshot.results)) {
      $existingAsin = Normalize-Asin ([string](Get-PropertyValue $row 'input_asin'))
      if (!$existingAsin) {
        $existingAsin = Normalize-Asin ([string](Get-PropertyValue $row 'asin'))
      }
      if ($existingAsin) {
        $existingByAsin[$existingAsin] = $row
      }
    }
  } catch {
    Write-Warning "Existing competitor snapshot could not be read and will be ignored: $($_.Exception.Message)"
  }
}

$asinList = @($requestedAsins)
if (!$MissingOnly -and $Limit -gt 0) {
  $asinList = @($asinList | Select-Object -First $Limit)
}

$fetchAsins = New-Object System.Collections.Generic.List[string]
foreach ($asin in $asinList) {
  $existing = $existingByAsin[$asin]
  $existingStatus = [string](Get-PropertyValue $existing 'status')
  if ($MissingOnly -and $existing -and $existingStatus -eq 'success') {
    continue
  }
  $fetchAsins.Add($asin)
}

if ($MissingOnly -and $Limit -gt 0) {
  $limitedFetchAsins = @($fetchAsins | Select-Object -First $Limit)
  $fetchAsins = New-Object System.Collections.Generic.List[string]
  foreach ($asin in $limitedFetchAsins) {
    $fetchAsins.Add($asin)
  }
}

$fetchByAsin = @{}
$results = New-Object System.Collections.Generic.List[object]

for ($index = 0; $index -lt $fetchAsins.Count; $index += 1) {
  $asin = $fetchAsins[$index]
  $url = "https://$domain/dp/$asin"
  $item = [ordered]@{
    input_asin = $asin
    marketplace = $domain
    product_url = $url
    status = if ($DryRun) { 'dry_run' } else { 'pending' }
    run_action = if ($DryRun) { 'dry_run' } else { 'fetched' }
    started_at = (Get-Date).ToString('o')
  }

  if ($DryRun) {
    $item.note = 'DryRun only. Local crawler was not called.'
  } else {
    try {
      $response = Invoke-RestMethod `
        -Method Post `
        -Uri $CrawlerUrl `
        -ContentType 'application/json; charset=utf-8' `
        -Body (@{ url = $url; timeoutMs = $TimeoutMs } | ConvertTo-Json -Compress) `
        -TimeoutSec ([Math]::Max(30, [Math]::Ceiling($TimeoutMs / 1000) + 15))

      $item.status = if ($response.ok) { 'success' } else { 'failed' }
      $item.ok = [bool]$response.ok
      $item.blocked = [bool]$response.blocked
      $item.asin = $response.asin
      $item.title = $response.title
      $item.brand = $response.brand
      $item.price = $response.price
      $item.price_number = $response.price_number
      $item.rating = $response.rating
      $item.rating_number = $response.rating_number
      $item.reviews = $response.reviews
      $item.reviews_number = $response.reviews_number
      $item.availability = Clean-AvailabilityText ([string]$response.availability)
      $item.category = if ($response.breadcrumbs) { ($response.breadcrumbs -join ' / ') } else { '' }
      $item.loaded_url = $response.loaded_url
      $item.error = $response.error
    } catch {
      $item.status = 'failed'
      $item.ok = $false
      $item.error = $_.Exception.Message
    }
  }

  $item.finished_at = (Get-Date).ToString('o')
  $fetchByAsin[$asin] = [pscustomobject]$item

  if (!$DryRun -and $DelaySeconds -gt 0 -and $index -lt ($fetchAsins.Count - 1)) {
    Start-Sleep -Seconds $DelaySeconds
  }
}

foreach ($asin in $asinList) {
  if ($fetchByAsin.ContainsKey($asin)) {
    $results.Add($fetchByAsin[$asin])
    continue
  }

  if ($existingByAsin.ContainsKey($asin)) {
    $results.Add((Copy-SnapshotRow $existingByAsin[$asin] $true))
    continue
  }

  $url = "https://$domain/dp/$asin"
  $results.Add([pscustomobject][ordered]@{
    input_asin = $asin
    marketplace = $domain
    product_url = $url
    status = 'not_fetched'
    run_action = 'not_fetched'
    ok = $false
    carried_forward = $false
    note = 'Not fetched in this run because the MissingOnly limit was reached.'
    finished_at = (Get-Date).ToString('o')
  })
}

$carriedForwardCount = @($results | Where-Object { $_.carried_forward }).Count
$fetchedCount = @($results | Where-Object { $_.run_action -eq 'fetched' }).Count
$dryRunCount = @($results | Where-Object { $_.run_action -eq 'dry_run' }).Count

$summary = [ordered]@{
  dry_run = [bool]$DryRun
  missing_only = [bool]$MissingOnly
  marketplace = $domain
  source_asin = $sourceAsinNormalized
  source_product_title = $sourceProductTitle
  competitor_asin_key = $competitorAsinKey
  snapshot_scope_key = $snapshotScopeKey
  requested_asin_count = $requestedAsins.Count
  fetch_count = $fetchAsins.Count
  fetched_count = $fetchedCount
  dry_run_count = $dryRunCount
  carried_forward_count = $carriedForwardCount
  asin_count = $results.Count
  success_count = @($results | Where-Object { $_.status -eq 'success' }).Count
  failed_count = @($results | Where-Object { $_.status -eq 'failed' }).Count
  not_fetched_count = @($results | Where-Object { $_.status -eq 'not_fetched' }).Count
  json_path = $jsonPath
  latest_json_path = $latestJsonPath
  html_path = $htmlPath
  history_html_path = $historyHtmlPath
  results = $results
}

$summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
$summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $latestJsonPath -Encoding UTF8

function Join-AsinList($Rows) {
  $asins = @($Rows | ForEach-Object { if ($_.input_asin) { $_.input_asin } else { $_.asin } } | Where-Object { $_ })
  if ($asins.Count -eq 0) { return 'None' }
  return ($asins -join ', ')
}

$fetchedRows = @($results | Where-Object { $_.run_action -eq 'fetched' })
$carriedRows = @($results | Where-Object { $_.run_action -eq 'carried_forward' })
$dryRunRows = @($results | Where-Object { $_.run_action -eq 'dry_run' })
$failedRows = @($results | Where-Object { $_.status -eq 'failed' })
$notFetchedRows = @($results | Where-Object { $_.status -eq 'not_fetched' })
$scriptPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }
$commandAsins = ($requestedAsins -join '; ')
$sourceArg = if ($sourceAsinNormalized) { " -SourceAsin $(PsQuote $sourceAsinNormalized)" } else { "" }
$missingOnlyCommand = "& $(PsQuote $scriptPath) -Asins $(PsQuote $commandAsins)$sourceArg -Marketplace $(PsQuote $domain) -MissingOnly -Limit 2 -DelaySeconds 20"
$dryRunCommand = "& $(PsQuote $scriptPath) -Asins $(PsQuote $commandAsins)$sourceArg -Marketplace $(PsQuote $domain) -DryRun"
$helpCommand = "& $(PsQuote $scriptPath) -ShowHelp"

$rowsHtml = ($results | ForEach-Object {
  $title = if ($_.title) { $_.title } else { 'No data' }
  $price = if ($_.price) { $_.price } else { 'No data' }
  $rating = if ($_.rating) { $_.rating } else { 'No data' }
  $reviews = if ($_.reviews) { $_.reviews } else { 'No data' }
  $status = if ($_.status) { $_.status } else { 'No data' }
  $action = if ($_.run_action) { $_.run_action } else { 'unknown' }
  "<tr><td>$(HtmlEscape $_.input_asin)</td><td><span class=""pill"">$(HtmlEscape $action)</span></td><td>$(HtmlEscape $status)</td><td>$(HtmlEscape $title)</td><td>$(HtmlEscape $price)</td><td>$(HtmlEscape $rating)</td><td>$(HtmlEscape $reviews)</td><td><a href=""$(HtmlEscape $_.product_url)"">Open</a></td></tr>"
}) -join "`n"

$logRowsHtml = @(
  "<tr><td>Fetched this run</td><td>$($fetchedRows.Count)</td><td>$(HtmlEscape (Join-AsinList $fetchedRows))</td></tr>",
  "<tr><td>Carried forward</td><td>$($carriedRows.Count)</td><td>$(HtmlEscape (Join-AsinList $carriedRows))</td></tr>",
  "<tr><td>Dry run only</td><td>$($dryRunRows.Count)</td><td>$(HtmlEscape (Join-AsinList $dryRunRows))</td></tr>",
  "<tr><td>Failed</td><td>$($failedRows.Count)</td><td>$(HtmlEscape (Join-AsinList $failedRows))</td></tr>",
  "<tr><td>Not fetched</td><td>$($notFetchedRows.Count)</td><td>$(HtmlEscape (Join-AsinList $notFetchedRows))</td></tr>"
) -join "`n"

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Competitor ASIN Snapshot</title>
  <style>
    * { box-sizing: border-box; }
    html, body { max-width: 100%; overflow-x: hidden; }
    body { margin: 0; background: #f4f7fb; color: #17202c; font-family: Arial, sans-serif; line-height: 1.55; }
    .page { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 40px; }
    .panel { background: #fff; border: 1px solid #dce3ee; border-radius: 8px; box-shadow: 0 14px 30px rgba(20, 32, 44, 0.07); padding: 18px; margin-bottom: 14px; }
    .kicker { color: #0f766e; font-size: 13px; font-weight: 900; }
    h1 { margin: 6px 0 8px; font-size: 28px; line-height: 1.25; letter-spacing: 0; }
    p { margin: 0; color: #536173; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
    .metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .metric { background: #fff; border: 1px solid #dce3ee; border-radius: 8px; padding: 14px; box-shadow: 0 8px 20px rgba(20, 32, 44, 0.05); }
    .metric span { display: block; color: #64748b; font-size: 12px; margin-bottom: 6px; }
    .metric strong { display: block; font-size: 22px; }
    .pill { display: inline-block; border-radius: 999px; background: #e6f4f1; color: #0f766e; font-weight: 900; padding: 2px 8px; font-size: 12px; }
    .command-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
    .command { border: 1px solid #dce3ee; border-radius: 8px; background: #f8fafc; padding: 12px; }
    .command span { display: block; color: #64748b; font-size: 12px; font-weight: 900; margin-bottom: 8px; }
    code { display: block; color: #17202c; background: #ffffff; border: 1px solid #dce3ee; border-radius: 6px; padding: 9px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
    .table-wrap { width: 100%; overflow-x: auto; border: 1px solid #dce3ee; border-radius: 8px; background: #fff; }
    table { width: 100%; min-width: 860px; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #dce3ee; vertical-align: top; }
    th { color: #64748b; background: #f8fafc; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    a { color: #2563eb; text-decoration: none; font-weight: 800; }
    @media (max-width: 860px) { .metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .command-grid { grid-template-columns: minmax(0, 1fr); } }
    @media (max-width: 560px) { .page { width: 100%; max-width: 100%; padding: 14px 10px 40px; } .panel { padding: 14px; } h1 { font-size: 23px; overflow-wrap: anywhere; word-break: break-word; } .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } table { min-width: 920px; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="panel">
      <div class="kicker">AI Product Selection</div>
      <h1>Competitor ASIN Low-Frequency Snapshot</h1>
      <p>Source ASIN: $(HtmlEscape $sourceAsinNormalized). Marketplace: $(HtmlEscape $domain). MissingOnly: $([bool]$MissingOnly). DryRun: $([bool]$DryRun). Limit: $Limit. Generated: $((Get-Date).ToString('o')).</p>
      <p>Scope: $(HtmlEscape $snapshotScopeKey)</p>
    </section>
    <section class="metric-grid">
      <article class="metric"><span>Requested</span><strong>$($summary.requested_asin_count)</strong></article>
      <article class="metric"><span>Success</span><strong>$($summary.success_count)</strong></article>
      <article class="metric"><span>Fetched</span><strong>$($summary.fetched_count)</strong></article>
      <article class="metric"><span>Carried</span><strong>$($summary.carried_forward_count)</strong></article>
      <article class="metric"><span>Failed</span><strong>$($summary.failed_count)</strong></article>
      <article class="metric"><span>Not fetched</span><strong>$($summary.not_fetched_count)</strong></article>
    </section>
    <section class="panel">
      <h2>Next Commands</h2>
      <p>Use MissingOnly to fill missing or failed rows. Existing successful rows are carried forward, so this can be run at low frequency without repeatedly crawling every competitor.</p>
      <div class="command-grid">
        <article class="command"><span>Refetch missing rows</span><code>$(HtmlEscape $missingOnlyCommand)</code></article>
        <article class="command"><span>Dry run first</span><code>$(HtmlEscape $dryRunCommand)</code></article>
        <article class="command"><span>Show help</span><code>$(HtmlEscape $helpCommand)</code></article>
      </div>
    </section>
    <section class="panel">
      <h2>Run Log</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Action</th><th>Count</th><th>ASINs</th></tr></thead>
          <tbody>$logRowsHtml</tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <h2>Snapshot Rows</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ASIN</th><th>Run action</th><th>Status</th><th>Title</th><th>Price</th><th>Rating</th><th>Reviews</th><th>Link</th></tr></thead>
          <tbody>$rowsHtml</tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>
"@

Set-Content -LiteralPath $htmlPath -Value $html -Encoding UTF8
Set-Content -LiteralPath $historyHtmlPath -Value $html -Encoding UTF8
$summary | ConvertTo-Json -Depth 12
