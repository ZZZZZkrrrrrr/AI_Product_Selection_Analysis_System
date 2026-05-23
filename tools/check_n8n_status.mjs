#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output', 'amazon_product_analysis');

const defaultOutputPath = path.join(outputDir, 'n8n_status_latest.json');
const defaultN8nUrl = 'http://localhost:5678';
const defaultWorkflowId = 'nRSff4JkGEfBZJJd';
const defaultCrawlerHealthUrl = 'http://localhost:8787/health';
const defaultTimeoutMs = 5000;
const defaultCredentialPath = path.join(process.env.USERPROFILE || '', '.codex_n8n_api_key.credential.xml');
const invokeN8nApiScriptPath = path.join(projectRoot, 'tools', 'invoke_n8n_api.ps1');

function usage() {
  return [
    'Usage:',
    '  node tools/check_n8n_status.mjs',
    '  node tools/check_n8n_status.mjs --json',
    '  node tools/check_n8n_status.mjs --output output/amazon_product_analysis/n8n_status_latest.json',
    '  node tools/check_n8n_status.mjs --n8n-url http://localhost:5678 --workflow-id nRSff4JkGEfBZJJd',
    '  node tools/check_n8n_status.mjs --fail-on-api-unauthorized',
    '',
    'Read-only local status check. It never triggers workflow execution and never writes API key values.',
    'If N8N_API_KEY is set, it is sent as X-N8N-API-KEY only for the API status request.',
    'If N8N_API_KEY is not set but the saved Windows credential exists, it verifies through tools/invoke_n8n_api.ps1.',
    'By default API 401/403 is reported as a warning and exits 0 when n8n and crawler are reachable.',
    'Use --fail-on-api-unauthorized before API-driven execution to make missing API authorization fail the check.',
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
    outputPath: defaultOutputPath,
    n8nUrl: defaultN8nUrl,
    workflowId: defaultWorkflowId,
    crawlerHealthUrl: defaultCrawlerHealthUrl,
    timeoutMs: defaultTimeoutMs,
    credentialPath: defaultCredentialPath,
    failOnApiUnauthorized: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--fail-on-api-unauthorized') {
      options.failOnApiUnauthorized = true;
    } else if (arg === '--output') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--output requires a value');
      options.outputPath = resolveProjectPath(value);
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
    } else if (arg === '--crawler-health') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--crawler-health requires a value');
      options.crawlerHealthUrl = value;
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

  return options;
}

function shortText(value, length = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, length);
}

function statusCodeFromPowerShellOutput(text) {
  if (/\b401\b|Unauthorized|未授权/i.test(text)) return 401;
  if (/\b403\b|Forbidden|forbidden/i.test(text)) return 403;
  return null;
}

async function requestStatus(url, options = {}) {
  const startedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || defaultTimeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: options.headers || {},
      signal: controller.signal,
    });
    const text = await response.text();
    clearTimeout(timeout);
    return {
      ok: response.status >= 200 && response.status < 400,
      status_code: response.status,
      status_text: response.statusText,
      checked_at: new Date().toISOString(),
      started_at: startedAt,
      url,
      body_preview: text.slice(0, 160),
      error: '',
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      status_code: null,
      status_text: '',
      checked_at: new Date().toISOString(),
      started_at: startedAt,
      url,
      body_preview: '',
      error: error.name === 'AbortError' ? `timeout after ${options.timeoutMs || defaultTimeoutMs}ms` : error.message,
    };
  }
}

function requestWorkflowApiWithStoredCredential(workflowPath, options = {}) {
  const startedAt = new Date().toISOString();
  const timeoutMs = Math.max((options.timeoutMs || defaultTimeoutMs) + 10000, 15000);
  const result = spawnSync('powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    invokeN8nApiScriptPath,
    '-Method',
    'Get',
    '-Path',
    workflowPath,
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
  });

  const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;
  const failedByTimeout = result.error && result.error.code === 'ETIMEDOUT';
  const statusCode = result.status === 0 ? 200 : statusCodeFromPowerShellOutput(combinedOutput);
  return {
    ok: result.status === 0,
    status_code: statusCode,
    status_text: result.status === 0 ? 'OK' : 'Stored credential API check failed',
    checked_at: new Date().toISOString(),
    started_at: startedAt,
    url: workflowPath,
    body_preview: result.status === 0 ? 'verified with saved Windows credential' : shortText(combinedOutput),
    error: result.status === 0 ? '' : failedByTimeout ? `timeout after ${timeoutMs}ms` : shortText(combinedOutput, 300),
    credential_source: 'saved_windows_credential',
  };
}

function apiAuthRejected(api) {
  return api.status_code === 401 || api.status_code === 403;
}

function apiStatusLabel(api, apiKeyPresent = false) {
  if (api.ok) return '已授权';
  if (apiAuthRejected(api)) return apiKeyPresent ? 'Key 被拒绝' : '未授权';
  if (api.status_code === null) return '不可达';
  return `HTTP ${api.status_code}`;
}

function credentialLabel(apiKeySource) {
  if (apiKeySource === 'N8N_API_KEY') return 'N8N_API_KEY';
  if (apiKeySource === 'saved_windows_credential') return '已保存的 Windows 凭据';
  return 'API Key';
}

function buildMessage(root, api, crawler, apiKeyPresent, apiKeySource) {
  const parts = [];
  parts.push(root.ok ? 'n8n 页面可访问' : 'n8n 页面不可访问');
  if (api.ok) {
    parts.push(`n8n API 已授权（${credentialLabel(apiKeySource)}）`);
  } else if (apiAuthRejected(api) && apiKeyPresent) {
    parts.push(`n8n API Key 已配置但被拒绝（${credentialLabel(apiKeySource)}）`);
  } else {
    parts.push(`n8n API ${apiStatusLabel(api, apiKeyPresent)}`);
  }
  parts.push(crawler.ok ? '爬虫健康检查可访问' : '爬虫健康检查不可访问');
  return `${parts.join('；')}。`;
}

function nextActionsForApi(api, apiKeyPresent, apiKeySource) {
  if (api.ok) return [];
  const label = credentialLabel(apiKeySource);
  if (apiAuthRejected(api) && apiKeyPresent) {
    return [
      `当前已检测到 ${label}，但 n8n 返回 401/403，说明这个 Key 没有被当前 n8n 接受。`,
      '回到 n8n 的 API 页面重新复制完整 API Key，确认没有多余空格、换行或复制遗漏。',
      '在当前终端重新设置环境变量：$env:N8N_API_KEY="新的 n8n API Key"',
      '或重新运行：powershell -ExecutionPolicy Bypass -File tools\\set_n8n_api_key.ps1',
      '重新运行：node tools/check_n8n_status.mjs',
    ];
  }
  if (apiAuthRejected(api)) {
    return [
      '在 n8n 的 API 页面创建或复制 API Key。',
      '在当前终端临时设置环境变量：$env:N8N_API_KEY="你的 n8n API Key"',
      '重新运行：node tools/check_n8n_status.mjs',
    ];
  }
  return [
    '确认 n8n API 地址、workflow ID 和本机网络状态。',
    '确认 n8n 页面可打开后重新运行：node tools/check_n8n_status.mjs',
  ];
}

async function buildStatus(options) {
  const apiKey = process.env.N8N_API_KEY || '';
  const n8nUrl = options.n8nUrl.replace(/\/+$/, '');
  const workflowUrl = `${n8nUrl}/api/v1/workflows/${encodeURIComponent(options.workflowId)}`;
  const workflowApiPath = `/api/v1/workflows/${options.workflowId}`;
  const storedCredentialPresent = Boolean(options.credentialPath && fs.existsSync(options.credentialPath));
  const root = await requestStatus(n8nUrl, { timeoutMs: options.timeoutMs });
  const apiKeySource = apiKey ? 'N8N_API_KEY' : storedCredentialPresent ? 'saved_windows_credential' : 'none';
  const api = apiKey
    ? await requestStatus(workflowUrl, {
        timeoutMs: options.timeoutMs,
        headers: { 'X-N8N-API-KEY': apiKey },
      })
    : storedCredentialPresent
      ? requestWorkflowApiWithStoredCredential(workflowApiPath, options)
      : await requestStatus(workflowUrl, {
          timeoutMs: options.timeoutMs,
          headers: {},
        });
  const crawler = await requestStatus(options.crawlerHealthUrl, { timeoutMs: options.timeoutMs });
  const authorizationOk = api.ok;
  const serviceOk = root.ok && crawler.ok;
  const apiKeyPresent = Boolean(apiKey || storedCredentialPresent);
  const apiKeyRejected = apiKeyPresent && apiAuthRejected(api) && !authorizationOk;
  const attentionCount = [root, crawler].filter((item) => !item.ok).length + (authorizationOk ? 0 : 1);
  const strictApiFailure = options.failOnApiUnauthorized && !authorizationOk;
  const ok = serviceOk && !strictApiFailure;
  const status = serviceOk && authorizationOk
    ? '正常'
    : serviceOk
      ? (apiKeyRejected ? 'API Key 被拒绝' : strictApiFailure ? 'API 授权失败' : 'API 未授权')
      : '需关注';
  return {
    ok,
    status,
    status_class: serviceOk && authorizationOk ? 'ok' : serviceOk ? (strictApiFailure ? 'fail' : 'warn') : 'fail',
    generated_at: new Date().toISOString(),
    output_path: options.outputPath,
    n8n_url: n8nUrl,
    workflow_id: options.workflowId,
    crawler_health_url: options.crawlerHealthUrl,
    timeout_ms: options.timeoutMs,
    credential_path: options.credentialPath,
    stored_credential_present: storedCredentialPresent,
    api_key_present: apiKeyPresent,
    api_key_source: apiKeySource,
    api_key_rejected: apiKeyRejected,
    attention_count: attentionCount,
    service_ok: serviceOk,
    authorization_ok: authorizationOk,
    strict_api_authorization: options.failOnApiUnauthorized,
    strict_api_failure: strictApiFailure,
    message: buildMessage(root, api, crawler, apiKeyPresent, apiKeySource),
    checks: {
      n8n_root: root,
      n8n_workflow_api: {
        ...api,
        status_label: apiStatusLabel(api, apiKeyPresent),
      },
      crawler_health: crawler,
    },
    next_actions: nextActionsForApi(api, apiKeyPresent, apiKeySource),
  };
}

function writeStatus(status, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(status, null, 2), 'utf8');
}

function printHuman(status) {
  const lines = [];
  lines.push('AI Selection n8n Status');
  lines.push(`Overall: ${status.status}`);
  lines.push(`n8n page: ${status.checks.n8n_root.status_code || status.checks.n8n_root.error}`);
  lines.push(`n8n API: ${status.checks.n8n_workflow_api.status_label}`);
  lines.push(`API key source: ${status.api_key_source}`);
  lines.push(`crawler: ${status.checks.crawler_health.status_code || status.checks.crawler_health.error}`);
  lines.push(`strict API authorization: ${status.strict_api_authorization ? 'on' : 'off'}`);
  lines.push(`output: ${status.output_path}`);
  if (status.next_actions.length) {
    lines.push('');
    lines.push('Next actions:');
    status.next_actions.forEach((item) => lines.push(`- ${item}`));
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

  const status = await buildStatus(options);
  writeStatus(status, options.outputPath);
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    printHuman(status);
  }

  return status.ok ? 0 : 1;
}

process.exitCode = await main();
