param(
  [string]$WorkflowId = "nRSff4JkGEfBZJJd",
  [string]$BaseUrl = "http://localhost:5678",
  [string]$Root = "C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing",
  [string]$Marker = "competitorSnapshotFile"
)

$ErrorActionPreference = 'Stop'

$CredentialPath = Join-Path $env:USERPROFILE '.codex_n8n_api_key.credential.xml'
if (!(Test-Path -LiteralPath $CredentialPath)) {
  throw "n8n API credential is not configured. Run tools\set_n8n_api_key.ps1 first."
}

$ApiKey = (Import-Clixml -LiteralPath $CredentialPath).GetNetworkCredential().Password
$OutputDir = Join-Path $Root 'output\amazon_product_analysis'
$ReportCodePath = Join-Path $Root 'tools\n8n_html_report_code_optimized.js'
$RawWorkflowPath = Join-Path $OutputDir 'live_workflow_raw_for_update.json'
$PayloadPath = Join-Path $OutputDir 'live_workflow_report_node_update_payload.json'
$ResponsePath = Join-Path $OutputDir 'live_update_report_node_response.json'
$ErrorPath = Join-Path $OutputDir 'live_update_report_node_error.txt'

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Invoke-CurlJson {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$ResponseFile,
    [Parameter(Mandatory = $true)][string]$ErrorFile
  )

  $httpCode = & curl.exe @Arguments -o $ResponseFile -w "%{http_code}" 2> $ErrorFile
  $curlExit = $LASTEXITCODE
  $stderr = ''
  if (Test-Path -LiteralPath $ErrorFile) {
    $stderrRaw = Get-Content -LiteralPath $ErrorFile -Raw -ErrorAction SilentlyContinue
    if ($null -ne $stderrRaw) {
      $stderr = [string]$stderrRaw
      $stderr = $stderr.Trim()
    }
  }
  if ($curlExit -ne 0) {
    throw "curl failed with exit code $curlExit. $stderr"
  }
  if ($httpCode -notmatch '^2\d\d$') {
    $body = ''
    if (Test-Path -LiteralPath $ResponseFile) {
      $body = (Get-Content -LiteralPath $ResponseFile -Raw -ErrorAction SilentlyContinue).Trim()
    }
    throw "n8n API returned HTTP $httpCode. $body"
  }
  return $httpCode
}

$workflowUrl = $BaseUrl.TrimEnd('/') + "/api/v1/workflows/$WorkflowId"

Invoke-CurlJson `
  -Arguments @(
    '-sS',
    '--max-time', '60',
    '-H', "X-N8N-API-KEY: $ApiKey",
    '-H', 'accept: application/json',
    $workflowUrl
  ) `
  -ResponseFile $RawWorkflowPath `
  -ErrorFile $ErrorPath | Out-Null

$nodeScript = @"
const fs = require('fs');
const args = process.argv.slice(process.argv[1] === '-' ? 2 : 1);
const rawPath = args[0];
const codePath = args[1];
const outPath = args[2];
const workflow = JSON.parse(fs.readFileSync(rawPath, 'utf8').replace(/^\uFEFF/, ''));
const code = fs.readFileSync(codePath, 'utf8').replace(/^\uFEFF/, '');
const nodes = workflow.nodes.map((node) => JSON.parse(JSON.stringify(node)));
const reportNode = nodes.find((node) =>
  node.type === 'n8n-nodes-base.code' &&
  node.parameters &&
  String(node.parameters.jsCode || '').includes('amazon_product_analysis_latest.html')
);
if (!reportNode) throw new Error('Cannot find report node');
reportNode.parameters = reportNode.parameters || {};
reportNode.parameters.jsCode = code;
const payload = {
  name: workflow.name,
  description: 'Local Crawlee + Playwright Amazon product analysis with Bailian AI, competitor snapshot evidence, optimized HTML report and CSV output.',
  nodes,
  connections: workflow.connections,
  settings: workflow.settings || {},
};
if (workflow.staticData != null) payload.staticData = workflow.staticData;
if (workflow.pinData != null) payload.pinData = workflow.pinData;
fs.writeFileSync(outPath, JSON.stringify(payload), 'utf8');
console.log(JSON.stringify({
  nodes: nodes.length,
  reportCodeLength: code.length,
  payloadBytes: fs.statSync(outPath).size,
  hasMarker: code.includes(process.env.N8N_REPORT_MARKER || 'competitorSnapshotFile'),
}));
"@

$buildResult = $nodeScript | node - $RawWorkflowPath $ReportCodePath $PayloadPath

Invoke-CurlJson `
  -Arguments @(
    '-sS',
    '--max-time', '180',
    '-X', 'PUT',
    '-H', "X-N8N-API-KEY: $ApiKey",
    '-H', 'accept: application/json',
    '-H', 'content-type: application/json',
    '--data-binary', "@$PayloadPath",
    $workflowUrl
  ) `
  -ResponseFile $ResponsePath `
  -ErrorFile $ErrorPath | Out-Null

$verifyRaw = Join-Path $OutputDir 'live_workflow_verify_after_report_node_update.json'
Invoke-CurlJson `
  -Arguments @(
    '-sS',
    '--max-time', '60',
    '-H', "X-N8N-API-KEY: $ApiKey",
    '-H', 'accept: application/json',
    $workflowUrl
  ) `
  -ResponseFile $verifyRaw `
  -ErrorFile $ErrorPath | Out-Null

$verifyScript = @"
const fs = require('fs');
const args = process.argv.slice(process.argv[1] === '-' ? 2 : 1);
const workflow = JSON.parse(fs.readFileSync(args[0], 'utf8').replace(/^\uFEFF/, ''));
const marker = args[1];
const reportNode = workflow.nodes.find((node) =>
  node.type === 'n8n-nodes-base.code' &&
  node.parameters &&
  String(node.parameters.jsCode || '').includes('amazon_product_analysis_latest.html')
);
const code = reportNode && reportNode.parameters ? String(reportNode.parameters.jsCode || '') : '';
console.log(JSON.stringify({
  workflow_id: workflow.id,
  active: workflow.active,
  updatedAt: workflow.updatedAt,
  report_has_marker: code.includes(marker),
  report_code_length: code.length,
}));
"@

$verifyResult = $verifyScript | node - $verifyRaw $Marker
$build = $buildResult | ConvertFrom-Json
$verify = $verifyResult | ConvertFrom-Json

[pscustomobject]@{
  ok = [bool]$verify.report_has_marker
  workflow_id = $verify.workflow_id
  active = $verify.active
  updated_at = $verify.updatedAt
  report_has_marker = $verify.report_has_marker
  report_code_length = $verify.report_code_length
  payload_bytes = $build.payloadBytes
  payload_path = $PayloadPath
  response_path = $ResponsePath
}
