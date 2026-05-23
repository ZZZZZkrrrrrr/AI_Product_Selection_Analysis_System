#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output', 'amazon_product_analysis');

const defaultN8nUrl = 'http://localhost:5678';
const defaultWorkflowId = 'nRSff4JkGEfBZJJd';
const defaultWorkflowName = 'Amazon 商品情报分析 - Crawlee免费抓取 + 阿里百炼 + HTML报告';
const defaultOutputPath = path.join(outputDir, 'n8n_workflow_contract_latest.json');
const defaultHtmlPath = path.join(outputDir, 'n8n_workflow_contract_latest.html');
const defaultCredentialPath = path.join(process.env.USERPROFILE || '', '.codex_n8n_api_key.credential.xml');
const defaultLocalWorkflowPath = path.join(projectRoot, 'n8n', 'workflows', 'amazon_product_analysis_crawlee_bailian_html.json');

const requiredNodes = [
  ['When clicking ‘Execute workflow’', 'n8n-nodes-base.manualTrigger'],
  ['Set the Input Fields', 'n8n-nodes-base.set'],
  ['Crawlee + Playwright 免费抓取 Amazon 页面', 'n8n-nodes-base.httpRequest'],
  ['Extract Product Details', 'n8n-nodes-base.code'],
  ['Extract Ads', 'n8n-nodes-base.code'],
  ['Product Insights', '@n8n/n8n-nodes-langchain.informationExtractor'],
  ['Product Descriptive Summarizer', '@n8n/n8n-nodes-langchain.chainLlm'],
  ['Competitive Analysis', '@n8n/n8n-nodes-langchain.informationExtractor'],
  ['Merge', 'n8n-nodes-base.merge'],
  ['Aggregate', 'n8n-nodes-base.aggregate'],
  ['生成 HTML 可视化报告', 'n8n-nodes-base.code'],
];

const requiredInputFields = [
  'product_url',
  'marketplace',
  'target_keywords',
  'competitor_asins',
  'landed_cost',
  'target_price',
  'shipping_cost',
  'notes',
];

const requiredReportTokens = [
  'amazon_product_analysis_latest.html',
  'amazon_product_analysis.csv',
  'evidence_json',
  'score_breakdown_json',
  'risk_flags_json',
  'next_actions_json',
  '选品推荐指数',
  '关键证据',
  '关键风险',
  '下一步动作',
];

const requiredEdges = [
  ['When clicking ‘Execute workflow’', 'Set the Input Fields'],
  ['Set the Input Fields', 'Crawlee + Playwright 免费抓取 Amazon 页面'],
  ['Crawlee + Playwright 免费抓取 Amazon 页面', 'Extract Product Details'],
  ['Crawlee + Playwright 免费抓取 Amazon 页面', 'Extract Ads'],
  ['Extract Product Details', 'Product Descriptive Summarizer'],
  ['Extract Product Details', 'Competitive Analysis'],
  ['Extract Ads', 'Product Insights'],
  ['Product Insights', 'Merge'],
  ['Product Descriptive Summarizer', 'Merge'],
  ['Competitive Analysis', 'Merge'],
  ['Merge', 'Aggregate'],
  ['Aggregate', '生成 HTML 可视化报告'],
];

function usage() {
  return [
    'Usage:',
    '  node tools/check_n8n_workflow_contract.mjs',
    '  node tools/check_n8n_workflow_contract.mjs --json',
    '  node tools/check_n8n_workflow_contract.mjs --source local',
    '  node tools/check_n8n_workflow_contract.mjs --input output/amazon_product_analysis/live_workflow_current.json',
    '',
    'Read-only n8n workflow contract check. It never triggers workflow execution and never writes API key values.',
  ].join('\n');
}

function resolveProjectPath(inputPath) {
  if (!inputPath) return inputPath;
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(projectRoot, inputPath);
}

function parsePositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer`);
  return number;
}

function parseArgs(args) {
  const options = {
    json: false,
    source: 'live',
    inputPath: '',
    outputPath: defaultOutputPath,
    htmlPath: defaultHtmlPath,
    n8nUrl: defaultN8nUrl,
    workflowId: defaultWorkflowId,
    credentialPath: defaultCredentialPath,
    timeoutMs: 30000,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--source') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--source requires live or local');
      if (!['live', 'local'].includes(value)) throw new Error('--source must be live or local');
      options.source = value;
      index += 1;
    } else if (arg === '--input') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--input requires a value');
      options.inputPath = resolveProjectPath(value);
      options.source = 'local';
      index += 1;
    } else if (arg === '--output') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--output requires a value');
      options.outputPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--html') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--html requires a value');
      options.htmlPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--n8n-url') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--n8n-url requires a value');
      options.n8nUrl = value.replace(/\/+$/, '');
      index += 1;
    } else if (arg === '--workflow-id') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--workflow-id requires a value');
      options.workflowId = value;
      index += 1;
    } else if (arg === '--credential-path') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--credential-path requires a value');
      options.credentialPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--timeout-ms') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--timeout-ms requires a value');
      options.timeoutMs = parsePositiveInteger(value, '--timeout-ms');
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.inputPath && options.source === 'local') options.inputPath = defaultLocalWorkflowPath;
  return options;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function normalizeWorkflow(value) {
  return Array.isArray(value) ? value[0] : value;
}

function psSingleQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseJsonFromOutput(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('PowerShell returned empty response');
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error(`Cannot parse n8n API response as JSON: ${clean.slice(0, 200)}`);
  }
}

async function fetchWorkflowWithEnvKey(options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const url = `${options.n8nUrl.replace(/\/+$/, '')}/api/v1/workflows/${encodeURIComponent(options.workflowId)}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        accept: 'application/json',
      },
      signal: controller.signal,
    });
    const text = await response.text();
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`n8n workflow API returned HTTP ${response.status}: ${text.slice(0, 200)}`);
    return {
      workflow: parseJsonFromOutput(text),
      fetch: {
        ok: true,
        mode: 'live',
        credential_source: 'N8N_API_KEY',
        status_code: response.status,
        url,
      },
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

function fetchWorkflowWithStoredCredential(options) {
  if (!options.credentialPath || !fs.existsSync(options.credentialPath)) {
    throw new Error('n8n API credential is not configured. Run tools\\set_n8n_api_key.ps1 first.');
  }

  const baseUrl = options.n8nUrl.replace(/\/+$/, '');
  const workflowUrl = `${baseUrl}/api/v1/workflows/${encodeURIComponent(options.workflowId)}`;
  const timeoutSec = Math.max(Math.ceil(options.timeoutMs / 1000), 5);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    '$OutputEncoding = [System.Text.Encoding]::UTF8',
    `$credential = Import-Clixml -LiteralPath ${psSingleQuote(options.credentialPath)}`,
    '$key = $credential.GetNetworkCredential().Password',
    "$headers = @{ 'X-N8N-API-KEY' = $key; 'accept' = 'application/json' }",
    `$data = Invoke-RestMethod -Method Get -Uri ${psSingleQuote(workflowUrl)} -Headers $headers -TimeoutSec ${timeoutSec}`,
    '$data | ConvertTo-Json -Depth 100',
  ].join('\n');
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: options.timeoutMs + 10000,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.replace(/\s+/g, ' ').trim();
    throw new Error(output || result.error?.message || 'n8n workflow API failed');
  }
  return {
    workflow: parseJsonFromOutput(result.stdout),
    fetch: {
      ok: true,
      mode: 'live',
      credential_source: 'saved_windows_credential',
      status_code: 200,
      url: workflowUrl,
    },
  };
}

async function loadWorkflow(options) {
  if (options.source === 'local') {
    const inputPath = options.inputPath || defaultLocalWorkflowPath;
    return {
      workflow: normalizeWorkflow(readJsonFile(inputPath)),
      fetch: {
        ok: true,
        mode: 'local',
        credential_source: 'none',
        status_code: null,
        url: inputPath,
      },
    };
  }

  if (process.env.N8N_API_KEY) return fetchWorkflowWithEnvKey(options);
  return fetchWorkflowWithStoredCredential(options);
}

function nodeByName(workflow, name) {
  return Array.isArray(workflow.nodes) ? workflow.nodes.find((node) => node.name === name) : null;
}

function modelValue(node) {
  const model = node?.parameters?.model;
  if (typeof model === 'string') return model;
  if (model && typeof model.value === 'string') return model.value;
  return '';
}

function assignmentNames(node) {
  const assignments = node?.parameters?.assignments?.assignments;
  return Array.isArray(assignments) ? assignments.map((item) => item.name).filter(Boolean) : [];
}

function hasEdge(workflow, from, to) {
  const connection = workflow.connections?.[from]?.main;
  if (!Array.isArray(connection)) return false;
  return connection.flat().some((item) => item?.node === to);
}

function checkRequiredNodes(workflow) {
  const missing = [];
  const typeMismatches = [];
  for (const [name, type] of requiredNodes) {
    const node = nodeByName(workflow, name);
    if (!node) {
      missing.push(name);
    } else if (node.type !== type) {
      typeMismatches.push(`${name}: ${node.type || '暂无'}，期望 ${type}`);
    }
  }
  return {
    ok: missing.length === 0 && typeMismatches.length === 0,
    missing,
    type_mismatches: typeMismatches,
    checked: requiredNodes.length,
  };
}

function checkInputFields(workflow) {
  const setNode = nodeByName(workflow, 'Set the Input Fields');
  const fields = assignmentNames(setNode);
  const missing = requiredInputFields.filter((field) => !fields.includes(field));
  return {
    ok: missing.length === 0,
    fields,
    missing,
  };
}

function checkCrawlerRequest(workflow) {
  const crawlerNode = nodeByName(workflow, 'Crawlee + Playwright 免费抓取 Amazon 页面');
  const params = crawlerNode?.parameters || {};
  const methodOk = String(params.method || '').toUpperCase() === 'POST';
  const urlOk = String(params.url || '').includes('http://amazon-crawler:8787/scrape');
  const bodyText = typeof params.jsonBody === 'string' ? params.jsonBody : JSON.stringify(params.jsonBody || {});
  const timeoutOk = bodyText.includes('45000');
  return {
    ok: methodOk && urlOk && timeoutOk,
    method: params.method || '',
    url: params.url || '',
    timeout_ms_found: timeoutOk,
    issues: [
      methodOk ? '' : '爬虫节点不是 POST 请求。',
      urlOk ? '' : '爬虫节点没有指向 http://amazon-crawler:8787/scrape。',
      timeoutOk ? '' : '爬虫请求体没有保留 45000ms timeout。',
    ].filter(Boolean),
  };
}

function checkAiModels(workflow) {
  const modelNodes = Array.isArray(workflow.nodes)
    ? workflow.nodes.filter((node) => node.type === '@n8n/n8n-nodes-langchain.lmChatOpenAi')
    : [];
  const wrongModels = modelNodes
    .filter((node) => modelValue(node) !== 'qwen-turbo')
    .map((node) => `${node.name}: ${modelValue(node) || '暂无'}`);
  const missingCredential = modelNodes
    .filter((node) => !String(node.credentials?.openAiApi?.name || '').includes('阿里百炼'))
    .map((node) => node.name);
  return {
    ok: modelNodes.length >= 3 && wrongModels.length === 0 && missingCredential.length === 0,
    model_node_count: modelNodes.length,
    models: modelNodes.map((node) => ({ name: node.name, model: modelValue(node), credential: node.credentials?.openAiApi?.name || '' })),
    wrong_models: wrongModels,
    missing_bailian_credential: missingCredential,
  };
}

function checkReportNode(workflow) {
  const reportNode = nodeByName(workflow, '生成 HTML 可视化报告');
  const code = String(reportNode?.parameters?.jsCode || '');
  const missingTokens = requiredReportTokens.filter((token) => !code.includes(token));
  return {
    ok: missingTokens.length === 0,
    missing_tokens: missingTokens,
    code_length: code.length,
  };
}

function checkWebhook(workflow) {
  const webhook = nodeByName(workflow, 'Webhook Trigger - Amazon Analysis');
  const params = webhook?.parameters || {};
  const methodOk = String(params.httpMethod || '').toUpperCase() === 'POST';
  const pathOk = params.path === 'amazon-product-analysis';
  const connected = hasEdge(workflow, 'Webhook Trigger - Amazon Analysis', 'Set the Input Fields');
  return {
    ok: Boolean(webhook) && methodOk && pathOk && connected,
    present: Boolean(webhook),
    method: params.httpMethod || '',
    path: params.path || '',
    connected_to_input: connected,
    issues: [
      webhook ? '' : '缺少 Webhook Trigger - Amazon Analysis，API/外部触发入口未就绪。',
      !webhook || methodOk ? '' : 'Webhook 不是 POST。',
      !webhook || pathOk ? '' : 'Webhook path 不是 amazon-product-analysis。',
      !webhook || connected ? '' : 'Webhook 没有连接到 Set the Input Fields。',
    ].filter(Boolean),
  };
}

function checkConnections(workflow) {
  const missing = requiredEdges.filter(([from, to]) => !hasEdge(workflow, from, to)).map(([from, to]) => `${from} -> ${to}`);
  return {
    ok: missing.length === 0,
    checked: requiredEdges.length,
    missing,
  };
}

function buildResult(workflowInput, fetch, options) {
  const workflow = normalizeWorkflow(workflowInput);
  const checks = {
    workflow_identity: {
      ok: workflow?.id === options.workflowId && workflow?.name === defaultWorkflowName,
      id: workflow?.id || '',
      name: workflow?.name || '',
      expected_id: options.workflowId,
      expected_name: defaultWorkflowName,
    },
    required_nodes: checkRequiredNodes(workflow),
    input_fields: checkInputFields(workflow),
    crawler_request: checkCrawlerRequest(workflow),
    ai_models: checkAiModels(workflow),
    report_node: checkReportNode(workflow),
    webhook_trigger: checkWebhook(workflow),
    core_connections: checkConnections(workflow),
  };
  const issues = [];
  Object.entries(checks).forEach(([key, check]) => {
    if (check.ok) return;
    if (key === 'workflow_identity') issues.push('目标工作流 ID 或名称不匹配。');
    if (key === 'required_nodes') issues.push(`缺少或类型不匹配的关键节点：${[...check.missing, ...check.type_mismatches].join('；') || '暂无详情'}`);
    if (key === 'input_fields') issues.push(`输入字段缺失：${check.missing.join(' / ') || '暂无详情'}`);
    if (key === 'crawler_request') issues.push(check.issues.join('；') || '爬虫请求配置异常。');
    if (key === 'ai_models') issues.push('阿里百炼 qwen-turbo 模型或凭据配置异常。');
    if (key === 'report_node') issues.push(`报告节点缺少关键输出标记：${check.missing_tokens.join(' / ') || '暂无详情'}`);
    if (key === 'webhook_trigger') issues.push(check.issues.join('；') || 'Webhook 触发入口异常。');
    if (key === 'core_connections') issues.push(`主链路连接缺失：${check.missing.join('；') || '暂无详情'}`);
  });
  const confirmations = [
    checks.workflow_identity.ok ? '已读到目标 n8n 工作流' : '',
    checks.required_nodes.ok ? '关键节点齐全' : '',
    checks.input_fields.ok ? 'V1.0 输入字段齐全' : '',
    checks.crawler_request.ok ? 'Crawlee 本地爬虫请求配置正确' : '',
    checks.ai_models.ok ? '阿里百炼 qwen-turbo 模型配置正确' : '',
    checks.report_node.ok ? 'HTML/CSV 与解释型 JSON 输出标记齐全' : '',
    checks.webhook_trigger.ok ? 'Webhook 触发入口已连接到输入节点' : '',
    checks.core_connections.ok ? '主链路连接完整' : '',
  ].filter(Boolean);

  return {
    ok: issues.length === 0,
    status: issues.length === 0 ? '通过' : '需关注',
    status_class: issues.length === 0 ? 'ok' : 'fail',
    generated_at: new Date().toISOString(),
    source: fetch.mode,
    workflow_id: options.workflowId,
    workflow_name: workflow?.name || '',
    n8n_url: options.n8nUrl,
    output_path: options.outputPath,
    html_report_path: options.htmlPath,
    fetch,
    facts: {
      node_count: Array.isArray(workflow?.nodes) ? workflow.nodes.length : 0,
      connection_count: workflow?.connections ? Object.keys(workflow.connections).length : 0,
      active: workflow?.active === true,
      input_field_count: checks.input_fields.fields.length,
      ai_model_count: checks.ai_models.model_node_count,
    },
    confirmations,
    issues,
    checks,
  };
}

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(result) {
  const factCards = Object.entries(result.facts || {})
    .map(([key, value]) => `<span>${htmlEscape(key)}：${htmlEscape(value)}</span>`)
    .join('');
  const checkRows = Object.entries(result.checks || {})
    .map(
      ([key, check]) => `
        <tr>
          <td>${htmlEscape(key)}</td>
          <td><b class="${check.ok ? 'ok' : 'fail'}">${htmlEscape(check.ok ? '通过' : '需关注')}</b></td>
          <td>${htmlEscape(JSON.stringify(check).slice(0, 280))}</td>
        </tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>n8n 工作流合同检查</title>
  <style>
    :root { color-scheme: light; --ink:#172033; --muted:#64748b; --line:#dbe3ef; --ok:#047857; --fail:#b91c1c; --soft:#f8fafc; }
    body { margin:0; background:#eef3f8; color:var(--ink); font:14px/1.65 Arial, "Microsoft YaHei", sans-serif; }
    main { max-width: 1100px; margin: 0 auto; padding: 28px 18px 40px; }
    header, section { background:#fff; border:1px solid var(--line); border-radius:8px; padding:18px; margin-bottom:14px; }
    h1 { margin:0 0 8px; font-size:24px; }
    h2 { margin:0 0 10px; font-size:17px; }
    p { margin:6px 0; color:var(--muted); }
    .badge { display:inline-flex; border-radius:999px; padding:5px 10px; font-weight:800; background:#eef2ff; }
    .badge.ok { color:var(--ok); background:#ecfdf5; }
    .badge.fail { color:var(--fail); background:#fef2f2; }
    .facts { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:12px; }
    .facts span { border:1px solid var(--line); border-radius:8px; background:var(--soft); padding:9px; font-weight:700; overflow-wrap:anywhere; }
    ul { margin:8px 0 0; padding-left:20px; }
    li { margin:4px 0; }
    table { width:100%; border-collapse:collapse; overflow:hidden; border-radius:8px; }
    th,td { text-align:left; vertical-align:top; border-bottom:1px solid var(--line); padding:10px; }
    th { background:var(--soft); }
    code { color:#16324f; overflow-wrap:anywhere; }
    .ok { color:var(--ok); }
    .fail { color:var(--fail); }
    @media (max-width: 720px) { .facts { grid-template-columns:1fr; } main { padding:14px 10px 24px; } table { font-size:12px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <span class="badge ${htmlEscape(result.status_class)}">${htmlEscape(result.status)}</span>
      <h1>n8n 工作流合同检查</h1>
      <p>${htmlEscape(result.ok ? '目标工作流结构满足 V1.0 设计要求；本检查只读 API，没有触发执行。' : '目标工作流结构存在需关注项；先修复后再自动执行。')}</p>
      <p>生成时间：${htmlEscape(result.generated_at)}</p>
      <p>工作流：${htmlEscape(result.workflow_name)}（${htmlEscape(result.workflow_id)}）</p>
      <p>来源：${htmlEscape(result.source)}；授权来源：${htmlEscape(result.fetch?.credential_source || 'none')}</p>
      <div class="facts">${factCards}</div>
    </header>
    <section>
      <h2>依据</h2>
      <ul>${result.confirmations.map((item) => `<li>${htmlEscape(item)}</li>`).join('') || '<li>暂无</li>'}</ul>
    </section>
    <section>
      <h2>问题</h2>
      <ul>${result.issues.map((item) => `<li>${htmlEscape(item)}</li>`).join('') || '<li>暂无阻断项</li>'}</ul>
    </section>
    <section>
      <h2>检查明细</h2>
      <table>
        <thead><tr><th>检查项</th><th>状态</th><th>摘要</th></tr></thead>
        <tbody>${checkRows}</tbody>
      </table>
    </section>
    <section>
      <h2>输出文件</h2>
      <p>JSON：<code>${htmlEscape(result.output_path)}</code></p>
      <p>HTML：<code>${htmlEscape(result.html_report_path)}</code></p>
    </section>
  </main>
</body>
</html>`;
}

function writeOutputs(result, options) {
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(options.htmlPath), { recursive: true });
  fs.writeFileSync(options.htmlPath, renderHtml(result), 'utf8');
}

function printHuman(result) {
  const lines = [];
  lines.push('AI Selection n8n Workflow Contract');
  lines.push(`Overall: ${result.status}`);
  lines.push(`Workflow: ${result.workflow_name || result.workflow_id}`);
  lines.push(`Source: ${result.source} (${result.fetch?.credential_source || 'none'})`);
  lines.push(`Nodes: ${result.facts.node_count}; connections: ${result.facts.connection_count}; webhook: ${result.checks.webhook_trigger.ok ? 'ready' : 'attention'}`);
  lines.push(`Output: ${result.output_path}`);
  lines.push(`HTML: ${result.html_report_path}`);
  if (result.issues.length) {
    lines.push('');
    lines.push('Issues:');
    result.issues.forEach((issue) => lines.push(`- ${issue}`));
  }
  console.log(lines.join('\n'));
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    return 1;
  }

  if (options.help) {
    console.log(usage());
    return 0;
  }

  try {
    const { workflow, fetch } = await loadWorkflow(options);
    const result = buildResult(workflow, fetch, options);
    writeOutputs(result, options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printHuman(result);
    return result.ok ? 0 : 1;
  } catch (error) {
    const result = {
      ok: false,
      status: '需关注',
      status_class: 'fail',
      generated_at: new Date().toISOString(),
      source: options.source,
      workflow_id: options.workflowId,
      workflow_name: '',
      n8n_url: options.n8nUrl,
      output_path: options.outputPath,
      html_report_path: options.htmlPath,
      fetch: {
        ok: false,
        mode: options.source,
        credential_source: process.env.N8N_API_KEY ? 'N8N_API_KEY' : fs.existsSync(options.credentialPath || '') ? 'saved_windows_credential' : 'none',
        status_code: null,
        url: options.source === 'live' ? `${options.n8nUrl}/api/v1/workflows/${options.workflowId}` : options.inputPath,
        error: error.message,
      },
      facts: {},
      confirmations: [],
      issues: [error.message],
      checks: {},
    };
    writeOutputs(result, options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printHuman(result);
    return 1;
  }
}

process.exitCode = await main();
