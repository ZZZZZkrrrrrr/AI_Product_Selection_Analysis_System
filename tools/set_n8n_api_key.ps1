$ErrorActionPreference = 'Stop'

$WorkflowId = 'nRSff4JkGEfBZJJd'
$BaseUrl = 'http://localhost:5678'
$CredentialPath = Join-Path $env:USERPROFILE '.codex_n8n_api_key.credential.xml'
$StatusPath = 'C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\n8n_api_auth_status.json'

function ConvertFrom-SecureStringToPlainText {
  param([Parameter(Mandatory = $true)][Security.SecureString]$SecureString)
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Write-Status {
  param([hashtable]$Status)
  $dir = Split-Path -Parent $StatusPath
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $Status.checked_at = (Get-Date).ToString('o')
  $Status | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $StatusPath -Encoding utf8
}

Write-Host ''
Write-Host 'n8n API Key authorization for Codex' -ForegroundColor Cyan
Write-Host 'Paste a NEW n8n API key. Input is hidden. Do not paste it into chat.' -ForegroundColor Yellow
Write-Host ''

$secureKey = Read-Host 'n8n API Key' -AsSecureString
$key = ConvertFrom-SecureStringToPlainText -SecureString $secureKey

if ([string]::IsNullOrWhiteSpace($key)) {
  Write-Status @{ ok = $false; error = 'Empty API key' }
  throw 'Empty API key'
}

$credential = [pscredential]::new('n8n-api-key', $secureKey)
$credential | Export-Clixml -LiteralPath $CredentialPath

$headers = @{
  'X-N8N-API-KEY' = $key
  'accept' = 'application/json'
}

try {
  $workflow = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/v1/workflows/$WorkflowId" -Headers $headers -TimeoutSec 12
  Write-Status @{
    ok = $true
    workflow_id = $WorkflowId
    workflow_name = $workflow.name
    credential_path = $CredentialPath
  }
  Write-Host ''
  Write-Host 'Authorization succeeded. Codex can now call the n8n API from this Windows user.' -ForegroundColor Green
}
catch {
  $statusCode = $null
  if ($_.Exception.Response) {
    $statusCode = [int]$_.Exception.Response.StatusCode
  }
  Write-Status @{
    ok = $false
    status_code = $statusCode
    error = $_.Exception.Message
    credential_path = $CredentialPath
  }
  Write-Host ''
  Write-Host 'Authorization failed. Check that the key is new, complete, and from this n8n instance.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
  $key = $null
}

Write-Host ''
Read-Host 'Press Enter to close'
