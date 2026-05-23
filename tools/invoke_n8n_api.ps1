param(
  [Parameter(Mandatory = $true)][string]$Method,
  [Parameter(Mandatory = $true)][string]$Path,
  [object]$Body = $null
)

$ErrorActionPreference = 'Stop'
$BaseUrl = 'http://localhost:5678'
$CredentialPath = Join-Path $env:USERPROFILE '.codex_n8n_api_key.credential.xml'

if (!(Test-Path -LiteralPath $CredentialPath)) {
  throw "n8n API credential is not configured. Run tools\set_n8n_api_key.ps1 first."
}

$credential = Import-Clixml -LiteralPath $CredentialPath
$key = $credential.GetNetworkCredential().Password
$headers = @{
  'X-N8N-API-KEY' = $key
  'accept' = 'application/json'
}

$uri = $BaseUrl.TrimEnd('/') + '/' + $Path.TrimStart('/')
$args = @{
  Method = $Method
  Uri = $uri
  Headers = $headers
  TimeoutSec = 30
}

if ($null -ne $Body) {
  $headers['content-type'] = 'application/json'
  $args.Body = ($Body | ConvertTo-Json -Depth 20)
}

Invoke-RestMethod @args
