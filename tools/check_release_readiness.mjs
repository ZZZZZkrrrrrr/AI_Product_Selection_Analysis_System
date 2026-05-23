#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output', 'amazon_product_analysis');

const defaultJsonPath = path.join(outputDir, 'release_readiness_latest.json');
const defaultHtmlPath = path.join(outputDir, 'release_readiness_latest.html');
const latestProductReportPath = path.join(outputDir, 'amazon_product_analysis_latest.html');
const localRegressionPath = path.join(outputDir, 'local_regression_latest.json');
const regressionOverviewPath = path.join(outputDir, 'local_regression_overview.json');
const n8nStatusPath = path.join(outputDir, 'n8n_status_latest.json');

function usage() {
  return [
    'Usage:',
    '  node tools/check_release_readiness.mjs',
    '  node tools/check_release_readiness.mjs --json',
    '  node tools/check_release_readiness.mjs --no-write',
    '',
    'Summarizes whether the current AI product selection system is ready to demo/use.',
    'It only reads local files and does not call external APIs or trigger n8n workflow execution.',
  ].join('\n');
}

function parseArgs(args) {
  const options = { json: false, write: true };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--no-write') options.write = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, data: null, error: '' };
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return { exists: true, data: JSON.parse(raw), error: '' };
  } catch (error) {
    return { exists: true, data: null, error: error.message };
  }
}

function fileStatus(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, path: filePath, bytes: 0, updated_at: null };
  const stat = fs.statSync(filePath);
  return {
    exists: true,
    path: filePath,
    bytes: stat.size,
    updated_at: stat.mtime.toISOString(),
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

function statusItem(id, label, ok, status, message, facts = {}) {
  return { id, label, ok, status, message, facts };
}

function buildReadiness() {
  const generatedAt = new Date().toISOString();
  const productReport = fileStatus(latestProductReportPath);
  const localRegression = readJson(localRegressionPath);
  const overview = readJson(regressionOverviewPath);
  const n8n = readJson(n8nStatusPath);

  const overviewData = overview.data || {};
  const localData = localRegression.data || {};
  const operational = overviewData.operational_readiness || localData.operational_readiness || null;
  const git = overviewData.git_status_summary || localData.git_status_summary || null;
  const dataSources = overviewData.data_source_health_summary || localData.data_source_health_summary || null;
  const n8nSummary = overviewData.n8n_status_summary || localData.n8n_status_summary || null;

  const checks = [
    statusItem(
      'latest_product_report',
      '最新单品报告',
      productReport.exists && productReport.bytes > 0,
      productReport.exists ? '已生成' : '缺失',
      productReport.exists ? '最新单品 HTML 报告存在。' : '最新单品 HTML 报告不存在，需要先执行一次分析或本地预览。',
      { path: productReport.path, updated_at: productReport.updated_at, bytes: productReport.bytes },
    ),
    statusItem(
      'local_regression',
      '本地回归',
      localRegression.exists && localData.ok === true,
      localRegression.exists ? (localData.ok ? '通过' : '失败') : '缺失',
      localRegression.exists
        ? `本地回归 ${localData.ok ? '通过' : '未通过'}，检查 ${localData.counts?.total ?? 0} 项。`
        : '本地回归结果不存在，需要运行 node tools/run_local_regression_checks.mjs。',
      { path: localRegressionPath, counts: localData.counts || null },
    ),
    statusItem(
      'operational_readiness',
      '运维结论',
      operational?.ok === true || operational?.status === '可继续使用',
      operational?.status || '缺失',
      operational?.message || '缺少统一运维结论，需要刷新本地回归总览。',
      { confirmations: operational?.confirmations || [], issues: operational?.issues || [] },
    ),
    statusItem(
      'n8n',
      'n8n 与爬虫',
      n8n.exists && (n8n.data?.authorization_ok === true || n8nSummary?.authorization_ok === true),
      n8nSummary?.status || n8n.data?.status || '缺失',
      n8n.exists
        ? `n8n 状态：${n8nSummary?.status || n8n.data?.status || '暂无'}。`
        : 'n8n 状态文件不存在，需要运行 node tools/check_n8n_status.mjs。',
      {
        api: n8nSummary?.facts?.n8n_api || n8n.data?.checks?.n8n_workflow_api?.status_label || '暂无',
        crawler: n8nSummary?.facts?.crawler || n8n.data?.checks?.crawler_health?.status_code || '暂无',
      },
    ),
    statusItem(
      'data_sources',
      '数据源健康',
      dataSources?.ok === true,
      dataSources?.status || '缺失',
      dataSources?.message || '数据源健康摘要不存在，需要刷新统一回归总览。',
      { counts: dataSources?.counts || null },
    ),
    statusItem(
      'github',
      'GitHub 同步',
      git?.ok === true || git?.status === '已同步',
      git?.status || '缺失',
      git?.message || 'GitHub 同步摘要不存在，需要刷新统一回归总览。',
      {
        branch: git?.branch || '',
        upstream: git?.upstream || '',
        local_commit: git?.local_commit || '',
        remote_commit: git?.remote_commit || '',
        ahead: git?.ahead ?? null,
        behind: git?.behind ?? null,
        untracked_count: git?.untracked_count ?? null,
        untracked_preview: git?.untracked_preview || [],
      },
    ),
  ];

  const failed = checks.filter((item) => !item.ok);
  const ready = failed.length === 0;
  return {
    ready,
    status: ready ? '可演示' : '需关注',
    generated_at: generatedAt,
    project_root: projectRoot,
    summary:
      ready
        ? '当前系统可用于演示或日常使用；仍需注意免费抓取和外部服务的实时波动。'
        : '当前系统存在需要处理的项目，建议先修复后再演示或交付。',
    checks,
    next_actions: failed.map((item) => `${item.label}: ${item.message}`),
    artifacts: {
      json: defaultJsonPath,
      html: defaultHtmlPath,
      latest_product_report: latestProductReportPath,
      local_regression: localRegressionPath,
      regression_overview: regressionOverviewPath,
    },
  };
}

function renderHtml(readiness) {
  const cards = readiness.checks
    .map(
      (item) => `
      <article class="check ${item.ok ? 'ok' : 'warn'}">
        <div>
          <strong>${htmlEscape(item.label)}</strong>
          <p>${htmlEscape(item.message)}</p>
        </div>
        <b>${htmlEscape(item.status)}</b>
      </article>`,
    )
    .join('');
  const actions = readiness.next_actions.length
    ? `<ul>${readiness.next_actions.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul>`
    : '<p>暂无必须处理的动作。</p>';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI选品系统可演示状态</title>
  <style>
    :root { color-scheme: light; --ink:#102033; --muted:#607086; --line:#d9e2ef; --ok:#0f8f54; --warn:#b45309; --bg:#f6f8fb; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
    main { max-width: 980px; margin: 0 auto; padding: 24px 18px 40px; }
    header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: start; margin-bottom: 16px; }
    h1 { margin: 0 0 6px; font-size: clamp(24px, 4vw, 36px); line-height: 1.15; }
    p { margin: 0; color: var(--muted); overflow-wrap: anywhere; }
    .badge, .check, .actions { border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    .badge { min-width: 118px; padding: 14px; text-align: center; }
    .badge strong { display: block; color: ${readiness.ready ? 'var(--ok)' : 'var(--warn)'}; font-size: 30px; line-height: 1; }
    .check { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 14px; margin: 10px 0; }
    .check.ok { border-color: #bbf7d0; }
    .check.warn { border-color: #fcd34d; background: #fffbeb; }
    .check strong { display: block; margin-bottom: 4px; }
    .check b { border-radius: 999px; padding: 5px 10px; background: #f1f5f9; white-space: nowrap; }
    .check.ok b { background: #dcfce7; color: var(--ok); }
    .check.warn b { background: #fef3c7; color: var(--warn); }
    .actions { padding: 14px; margin-top: 14px; }
    .actions strong { display: block; margin-bottom: 8px; }
    .actions ul { margin: 0; padding-left: 20px; color: var(--warn); }
    .actions li { margin: 6px 0; overflow-wrap: anywhere; }
    @media (max-width: 720px) {
      main { padding: 18px 12px 28px; }
      header, .check { grid-template-columns: 1fr; }
      .badge { text-align: left; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>AI选品系统可演示状态</h1>
        <p>生成时间：${htmlEscape(readiness.generated_at)}。这份短报告只读取本地状态，不调用外部 API，不触发 n8n 执行。</p>
      </div>
      <div class="badge">
        <span>结论</span>
        <strong>${htmlEscape(readiness.status)}</strong>
      </div>
    </header>
    <p>${htmlEscape(readiness.summary)}</p>
    <section aria-label="检查项">${cards}</section>
    <section class="actions">
      <strong>下一步</strong>
      ${actions}
    </section>
  </main>
</body>
</html>`;
}

function writeArtifacts(readiness) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(defaultJsonPath, JSON.stringify(readiness, null, 2), 'utf8');
  fs.writeFileSync(defaultHtmlPath, renderHtml(readiness), 'utf8');
}

function printHuman(readiness) {
  const lines = [];
  lines.push('AI Selection Release Readiness');
  lines.push(`Overall: ${readiness.status}`);
  lines.push(readiness.summary);
  lines.push('');
  for (const item of readiness.checks) {
    lines.push(`- ${item.ok ? 'OK' : 'ATTENTION'}: ${item.label} - ${item.status}`);
  }
  if (readiness.next_actions.length) {
    lines.push('');
    lines.push('Next actions:');
    for (const action of readiness.next_actions) lines.push(`- ${action}`);
  }
  lines.push('');
  lines.push(`HTML: ${defaultHtmlPath}`);
  console.log(lines.join('\n'));
}

function main() {
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

  const readiness = buildReadiness();
  if (options.write) writeArtifacts(readiness);
  if (options.json) console.log(JSON.stringify(readiness, null, 2));
  else printHuman(readiness);
  return readiness.ready ? 0 : 1;
}

process.exitCode = main();
