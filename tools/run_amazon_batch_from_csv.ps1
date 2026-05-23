param(
  [string]$CsvPath = "C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\input\amazon_products_batch_template.csv",
  [string]$WebhookUrl = "http://localhost:5678/webhook/amazon-product-analysis",
  [int]$Limit = 0,
  [int]$DelaySeconds = 20,
  [int]$RetryCount = 1,
  [int]$RetryDelaySeconds = 10,
  [string]$FailedCsvPath = "",
  [switch]$ShowHelp,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
try {
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [Console]::OutputEncoding = $utf8NoBom
  $OutputEncoding = $utf8NoBom
} catch {
  # Older PowerShell hosts may not allow changing console encoding.
}

if ($ShowHelp) {
  @"
Amazon product analysis batch runner

Purpose:
  Read product analysis jobs from CSV and call the existing n8n webhook row by row.
  Each successful row refreshes the single-product report, CSV backup, and overview dashboard.

Common commands:
  1. Dry run one row. This does not call n8n:
     powershell -ExecutionPolicy Bypass -File tools\run_amazon_batch_from_csv.ps1 -DryRun -Limit 1

  2. Run the first 3 rows slowly:
     powershell -ExecutionPolicy Bypass -File tools\run_amazon_batch_from_csv.ps1 -Limit 3 -DelaySeconds 30

  3. Rerun failed rows:
     powershell -ExecutionPolicy Bypass -File tools\run_amazon_batch_from_csv.ps1 -CsvPath output\amazon_product_analysis\batch_failed_YYYYMMDD_HHMMSS.csv -Limit 1

Key parameters:
  -CsvPath            Input CSV. Default: input\amazon_products_batch_template.csv
  -WebhookUrl         n8n webhook URL. Default: http://localhost:5678/webhook/amazon-product-analysis
  -Limit              Max rows to process. 0 means no limit.
  -DelaySeconds       Delay between rows. Default: 20
  -RetryCount         Retries after each row failure. Default: 1
  -RetryDelaySeconds  Delay between retries. Default: 10
  -FailedCsvPath      Failed-row export path. Default: output\amazon_product_analysis\batch_failed_TIMESTAMP.csv
  -DryRun             Validate CSV and request body only. Does not call n8n.

Outputs:
  output\amazon_product_analysis\batch_run_TIMESTAMP.json
  output\amazon_product_analysis\batch_failed_TIMESTAMP.csv, only when failures exist.
"@
  exit 0
}

if (!(Test-Path -LiteralPath $CsvPath)) {
  throw "Batch CSV not found: $CsvPath"
}

$rows = Import-Csv -LiteralPath $CsvPath
$validRows = @($rows | Where-Object { $_.product_url -and $_.product_url.Trim() })

if ($Limit -gt 0) {
  $validRows = @($validRows | Select-Object -First $Limit)
}

if ($validRows.Count -eq 0) {
  throw "Batch CSV has no rows with product_url."
}

$outputDir = "C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$runStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$resultPath = Join-Path $outputDir "batch_run_$runStamp.json"
if ([string]::IsNullOrWhiteSpace($FailedCsvPath)) {
  $FailedCsvPath = Join-Path $outputDir "batch_failed_$runStamp.csv"
}
$results = New-Object System.Collections.Generic.List[object]
$failedRows = New-Object System.Collections.Generic.List[object]
$metadataColumns = @('row_number', 'attempts', 'error')
$isFailedCsvInput = $false
if ($validRows.Count -gt 0) {
  $inputColumns = @($validRows[0].PSObject.Properties.Name)
  $isFailedCsvInput = ($metadataColumns | Where-Object { $inputColumns -contains $_ }).Count -gt 0
}

for ($index = 0; $index -lt $validRows.Count; $index += 1) {
  $row = $validRows[$index]
  $body = [ordered]@{}

  foreach ($property in $row.PSObject.Properties) {
    if ($metadataColumns -contains $property.Name) {
      continue
    }
    $value = [string]$property.Value
    if ($null -ne $value) {
      $body[$property.Name] = $value.Trim()
    }
  }

  $item = [ordered]@{
    row_number = $index + 1
    product_url = $body.product_url
    marketplace = $body.marketplace
    status = if ($DryRun) { 'dry_run' } else { 'pending' }
    attempts = 0
    started_at = (Get-Date).ToString('o')
  }

  if ($DryRun) {
    $item.request_body = $body
  } else {
    $maxAttempts = [Math]::Max(1, $RetryCount + 1)
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt += 1) {
      $item.attempts = $attempt
      try {
        $response = Invoke-RestMethod `
          -Method Post `
          -Uri $WebhookUrl `
          -ContentType 'application/json; charset=utf-8' `
          -Body ($body | ConvertTo-Json -Compress -Depth 8) `
          -TimeoutSec 180

        $item.status = 'success'
        $item.response = $response
        $item.error = $null
        break
      } catch {
        $item.status = 'failed'
        $item.error = $_.Exception.Message
        if ($attempt -lt $maxAttempts -and $RetryDelaySeconds -gt 0) {
          Start-Sleep -Seconds $RetryDelaySeconds
        }
      }
    }
  }

  $item.finished_at = (Get-Date).ToString('o')
  $results.Add([pscustomobject]$item)

  if ($item.status -eq 'failed') {
    $failed = [ordered]@{
      row_number = $item.row_number
      attempts = $item.attempts
      error = $item.error
    }
    foreach ($property in $row.PSObject.Properties) {
      $failed[$property.Name] = $property.Value
    }
    $failedRows.Add([pscustomobject]$failed)
  }

  if (!$DryRun -and $DelaySeconds -gt 0 -and $index -lt ($validRows.Count - 1)) {
    Start-Sleep -Seconds $DelaySeconds
  }
}

$summary = [ordered]@{
  dry_run = [bool]$DryRun
  csv_path = $CsvPath
  source_is_failed_csv = $isFailedCsvInput
  webhook_url = $WebhookUrl
  total_rows = $validRows.Count
  success_count = @($results | Where-Object { $_.status -eq 'success' }).Count
  failed_count = @($results | Where-Object { $_.status -eq 'failed' }).Count
  dry_run_count = @($results | Where-Object { $_.status -eq 'dry_run' }).Count
  retry_count = $RetryCount
  retry_delay_seconds = $RetryDelaySeconds
  result_path = $resultPath
  failed_csv_path = if ($failedRows.Count -gt 0) { $FailedCsvPath } else { $null }
  results = $results
}

$summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resultPath -Encoding UTF8
if ($failedRows.Count -gt 0) {
  $failedRows | Export-Csv -LiteralPath $FailedCsvPath -NoTypeInformation -Encoding UTF8
}
$summary | ConvertTo-Json -Depth 12
