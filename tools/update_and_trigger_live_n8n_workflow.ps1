$ErrorActionPreference = 'Stop'

$WorkflowId = 'nRSff4JkGEfBZJJd'
$BaseUrl = 'http://localhost:5678'
$WebhookPath = 'amazon-product-analysis'
$Root = 'C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing'
$ReportCodePath = Join-Path $Root 'tools\n8n_html_report_code_optimized.js'
$StatusPath = Join-Path $Root 'output\amazon_product_analysis\n8n_live_update_status.json'
$CredentialPath = Join-Path $env:USERPROFILE '.codex_n8n_api_key.credential.xml'

function Get-N8nApiKey {
  if (!(Test-Path -LiteralPath $CredentialPath)) {
    throw "n8n API credential is not configured. Run tools\set_n8n_api_key.ps1 first."
  }
  $credential = Import-Clixml -LiteralPath $CredentialPath
  $credential.GetNetworkCredential().Password
}

function Invoke-N8nApi {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [object]$Body = $null,
    [int]$TimeoutSec = 60
  )

  $headers = @{
    'X-N8N-API-KEY' = $script:ApiKey
    'accept' = 'application/json'
  }
  $args = @{
    Method = $Method
    Uri = $BaseUrl.TrimEnd('/') + '/' + $Path.TrimStart('/')
    Headers = $headers
    TimeoutSec = $TimeoutSec
  }
  if ($null -ne $Body) {
    $headers['content-type'] = 'application/json'
    $args.Body = ($Body | ConvertTo-Json -Depth 100)
  }
  Invoke-RestMethod @args
}

function Set-ObjectProperty {
  param(
    [Parameter(Mandatory = $true)][object]$Object,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][object]$Value
  )
  if ($Object.PSObject.Properties.Name -contains $Name) {
    $Object.$Name = $Value
  }
  else {
    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
  }
}

function Write-Status {
  param([hashtable]$Status)
  $Status.checked_at = (Get-Date).ToString('o')
  $Status | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $StatusPath -Encoding utf8
}

$script:ApiKey = Get-N8nApiKey
$reportCode = Get-Content -LiteralPath $ReportCodePath -Encoding utf8 -Raw

$workflow = Invoke-N8nApi -Method GET -Path "/api/v1/workflows/$WorkflowId"

$reportNode = $workflow.nodes | Where-Object {
  $_.type -eq 'n8n-nodes-base.code' -and
  $_.parameters.jsCode -and
  $_.parameters.jsCode.Contains('amazon_product_analysis_latest.html')
} | Select-Object -First 1
if (!$reportNode) {
  throw 'Cannot find report node'
}
$reportNode.parameters.jsCode = $reportCode

$webhookNodeName = 'Webhook Trigger - Amazon Analysis'
$webhookNode = $workflow.nodes | Where-Object { $_.name -eq $webhookNodeName } | Select-Object -First 1
if (!$webhookNode) {
  $webhookNode = [pscustomobject]@{
    id = ([guid]::NewGuid().ToString())
    name = $webhookNodeName
    type = 'n8n-nodes-base.webhook'
    typeVersion = 2
    position = @(-1152, 448)
    parameters = [pscustomobject]@{
      httpMethod = 'POST'
      path = $WebhookPath
      responseMode = 'lastNode'
      options = [pscustomobject]@{}
    }
  }
  $workflow.nodes = @($workflow.nodes) + $webhookNode
}
else {
  $webhookNode.parameters.httpMethod = 'POST'
  $webhookNode.parameters.path = $WebhookPath
  $webhookNode.parameters.responseMode = 'lastNode'
}

$webhookConnection = [pscustomobject]@{
  main = @(
    @(
      [pscustomobject]@{
        node = 'Set the Input Fields'
        type = 'main'
        index = 0
      }
    )
  )
}
Set-ObjectProperty -Object $workflow.connections -Name $webhookNodeName -Value $webhookConnection

$updateBody = [ordered]@{
  name = $workflow.name
  description = 'Local Crawlee + Playwright Amazon product analysis with Bailian AI and optimized HTML/CSV output.'
  nodes = $workflow.nodes
  connections = $workflow.connections
  settings = $workflow.settings
}
if ($null -ne $workflow.staticData) { $updateBody.staticData = $workflow.staticData }
if ($null -ne $workflow.pinData) { $updateBody.pinData = $workflow.pinData }

$updated = Invoke-N8nApi -Method PUT -Path "/api/v1/workflows/$WorkflowId" -Body $updateBody
$activated = Invoke-N8nApi -Method POST -Path "/api/v1/workflows/$WorkflowId/activate"

$webhookUrl = "$BaseUrl/webhook/$WebhookPath"
$triggerResult = $null
$triggerError = $null
try {
  $triggerResult = Invoke-RestMethod -Method POST -Uri $webhookUrl -ContentType 'application/json' -Body '{}' -TimeoutSec 180
}
catch {
  $triggerError = $_.Exception.Message
}

$latestExecution = $null
try {
  $executionList = Invoke-N8nApi -Method GET -Path "/api/v1/executions?workflowId=$WorkflowId&limit=1" -TimeoutSec 30
  $latestExecution = $executionList.data | Select-Object -First 1
}
catch {}

Write-Status @{
  ok = ($null -eq $triggerError)
  workflow_id = $WorkflowId
  workflow_name = $updated.name
  webhook_url = $webhookUrl
  activated = $activated.active
  trigger_error = $triggerError
  trigger_result = $triggerResult
  latest_execution = $latestExecution
}

[pscustomobject]@{
  ok = ($null -eq $triggerError)
  workflow_id = $WorkflowId
  webhook_url = $webhookUrl
  latest_execution_id = $latestExecution.id
  latest_execution_status = $latestExecution.status
  trigger_error = $triggerError
}
