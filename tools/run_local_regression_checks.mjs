#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output', 'amazon_product_analysis');

const defaultCacheDir = path.join(outputDir, 'cache');
const defaultSummaryPath = path.join(outputDir, 'local_regression_latest.json');
const defaultViewportWidths = [390];
const multiViewportWidths = [360, 390, 414];
const defaultMobileHeight = 1400;
const defaultDesktopWidth = 1366;
const defaultDesktopHeight = 1000;
const defaultRegressionOverviewJsonPath = path.join(outputDir, 'local_regression_overview.json');
const defaultRegressionOverviewHtmlPath = path.join(outputDir, 'local_regression_overview.html');
const defaultN8nStatusPath = path.join(outputDir, 'n8n_status_latest.json');

function usage() {
  return [
    'Usage:',
    '  node tools/run_local_regression_checks.mjs',
    '  node tools/run_local_regression_checks.mjs --json',
    '  node tools/run_local_regression_checks.mjs --cache-dir <dir>',
    '  node tools/run_local_regression_checks.mjs --strict-cache',
    '  node tools/run_local_regression_checks.mjs --strict-n8n-api',
    '  node tools/run_local_regression_checks.mjs --summary <json>',
    '  node tools/run_local_regression_checks.mjs --html <html>',
    '  node tools/run_local_regression_checks.mjs --multi-viewport',
    '  node tools/run_local_regression_checks.mjs --viewports 360,390,414',
    '  node tools/run_local_regression_checks.mjs --desktop',
    '  node tools/run_local_regression_checks.mjs --desktop --desktop-width 1440',
    '  node tools/run_local_regression_checks.mjs --no-overview',
    '',
    'Runs local read-only regression checks: data source health, adapter fixtures, optional cache directory, overview mobile layout, and latest product mobile layout.',
    'It validates local regression configuration first and stops early when the config is invalid.',
    'Default mobile layout checks run at 390px. Use --multi-viewport to cover 360px, 390px, and 414px.',
    '--desktop adds overview, latest product, and local regression summary desktop layout checks at 1366px by default.',
    'It writes both a JSON summary and a lightweight HTML summary by default.',
    'It refreshes local_regression_overview.html by default after writing the summary.',
    '--strict-cache fails the cache step when cache files are stale, expired, or missing freshness metadata.',
    '--strict-n8n-api fails the n8n status step when the n8n API key is missing or unauthorized.',
    'It does not call external APIs and does not trigger n8n workflow execution.',
  ].join('\n');
}

function resolveProjectPath(inputPath) {
  if (!inputPath) return inputPath;
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(projectRoot, inputPath);
}

function defaultHtmlPathFor(summaryPath) {
  const parsed = path.parse(summaryPath);
  return path.join(parsed.dir, `${parsed.name}.html`);
}

function parseViewportWidths(input) {
  const values = input
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value));

  const uniqueValues = [...new Set(values)];
  if (!uniqueValues.length || uniqueValues.some((value) => value < 320 || value > 640)) {
    throw new Error('--viewports requires comma-separated widths between 320 and 640');
  }

  return uniqueValues.sort((left, right) => left - right);
}

function parseArgs(args) {
  const options = {
    json: false,
    cacheDir: defaultCacheDir,
    strictCache: false,
    strictN8nApi: false,
    summaryPath: defaultSummaryPath,
    htmlPath: null,
    htmlPathExplicit: false,
    viewportWidths: defaultViewportWidths,
    mobileHeight: defaultMobileHeight,
    desktop: false,
    desktopWidth: defaultDesktopWidth,
    desktopHeight: defaultDesktopHeight,
    overview: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--cache-dir') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--cache-dir requires a value');
      options.cacheDir = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--strict-cache') {
      options.strictCache = true;
    } else if (arg === '--strict-n8n-api') {
      options.strictN8nApi = true;
    } else if (arg === '--summary') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--summary requires a value');
      options.summaryPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--html') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--html requires a value');
      options.htmlPath = resolveProjectPath(value);
      options.htmlPathExplicit = true;
      index += 1;
    } else if (arg === '--multi-viewport') {
      options.viewportWidths = multiViewportWidths;
    } else if (arg === '--viewports') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--viewports requires a value');
      options.viewportWidths = parseViewportWidths(value);
      index += 1;
    } else if (arg === '--desktop') {
      options.desktop = true;
    } else if (arg === '--desktop-width') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--desktop-width requires a value');
      options.desktopWidth = Number.parseInt(value, 10);
      if (!Number.isFinite(options.desktopWidth) || options.desktopWidth < 900 || options.desktopWidth > 2400) {
        throw new Error('--desktop-width must be between 900 and 2400');
      }
      index += 1;
    } else if (arg === '--desktop-height') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--desktop-height requires a value');
      options.desktopHeight = Number.parseInt(value, 10);
      if (!Number.isFinite(options.desktopHeight) || options.desktopHeight < 700 || options.desktopHeight > 2400) {
        throw new Error('--desktop-height must be between 700 and 2400');
      }
      index += 1;
    } else if (arg === '--no-overview') {
      options.overview = false;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.htmlPathExplicit) options.htmlPath = defaultHtmlPathFor(options.summaryPath);
  return options;
}

function jsonFilesRecursive(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...jsonFilesRecursive(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function runNodeStep(id, title, args) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  const endedAt = new Date().toISOString();
  return {
    id,
    title,
    ok: result.status === 0,
    skipped: false,
    exit_code: result.status,
    command: ['node', ...args].join(' '),
    started_at: startedAt,
    ended_at: endedAt,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function skippedStep(id, title, reason) {
  const now = new Date().toISOString();
  return {
    id,
    title,
    ok: true,
    skipped: true,
    exit_code: 0,
    command: '',
    started_at: now,
    ended_at: now,
    stdout: '',
    stderr: '',
    reason,
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, data: null, error: '' };
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return { exists: true, data: JSON.parse(raw), error: '' };
  } catch (error) {
    return { exists: true, data: null, error: error.message };
  }
}

function summarizeN8nStatusForSummary(steps) {
  const n8nStep = steps.find((step) => step.id === 'n8n_status');
  if (!n8nStep) return null;

  const result = readJsonIfExists(defaultN8nStatusPath);
  if (!result.exists) {
    return {
      ok: false,
      status: '未生成',
      status_class: 'warn',
      file: defaultN8nStatusPath,
      generated_at: null,
      message: '本轮已运行 n8n 状态检查，但未找到状态文件。',
      facts: { page: '暂无', api: '暂无', crawler: '暂无', workflow_id: '暂无' },
      next_actions: ['重新运行：node tools/check_n8n_status.mjs'],
    };
  }
  if (!result.data) {
    return {
      ok: false,
      status: '读取失败',
      status_class: 'warn',
      file: defaultN8nStatusPath,
      generated_at: null,
      message: `n8n 状态文件无法解析：${result.error}`,
      facts: { page: '读取失败', api: '读取失败', crawler: '读取失败', workflow_id: '暂无' },
      next_actions: ['重新运行：node tools/check_n8n_status.mjs'],
    };
  }

  const checks = result.data.checks || {};
  const root = checks.n8n_root || {};
  const api = checks.n8n_workflow_api || {};
  const crawler = checks.crawler_health || {};
  return {
    ok: result.data.service_ok !== false,
    authorization_ok: result.data.authorization_ok === true,
    status: result.data.status || '暂无',
    status_class: result.data.status_class || 'muted',
    file: defaultN8nStatusPath,
    generated_at: result.data.generated_at || null,
    message: result.data.message || '暂无 n8n 状态摘要。',
    facts: {
      page: root.ok ? `HTTP ${root.status_code}` : root.error || '异常',
      api: api.status_label || (api.ok ? `HTTP ${api.status_code}` : api.error || '异常'),
      crawler: crawler.ok ? `HTTP ${crawler.status_code}` : crawler.error || '异常',
      workflow_id: result.data.workflow_id || '暂无',
    },
    next_actions: Array.isArray(result.data.next_actions) ? result.data.next_actions : [],
  };
}

function buildSummary(options, steps) {
  const failed = steps.filter((step) => !step.ok);
  const skipped = steps.filter((step) => step.skipped);
  const n8nStatusSummary = summarizeN8nStatusForSummary(steps);
  return {
    ok: failed.length === 0,
    generated_at: new Date().toISOString(),
    summary_path: options.summaryPath,
    html_report_path: options.htmlPath,
    regression_overview_json_path: defaultRegressionOverviewJsonPath,
    regression_overview_html_path: defaultRegressionOverviewHtmlPath,
    regression_overview_refresh: null,
    project_root: projectRoot,
    cache_dir: options.cacheDir,
    strict_cache: options.strictCache,
    strict_n8n_api: options.strictN8nApi,
    mobile_viewports: options.viewportWidths,
    mobile_height: options.mobileHeight,
    desktop_check: options.desktop,
    desktop_width: options.desktopWidth,
    desktop_height: options.desktopHeight,
    n8n_status_summary: n8nStatusSummary,
    counts: {
      total: steps.length,
      passed: steps.filter((step) => step.ok && !step.skipped).length,
      skipped: skipped.length,
      failed: failed.length,
    },
    steps,
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

function stripAnsi(value) {
  return String(value || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function shortOutput(value, limit = 3000) {
  const text = stripAnsi(value).trim();
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}\n...` : text;
}

function relativeOutputLink(filePath) {
  if (!filePath) return '';
  const relative = path.relative(path.dirname(filePath), filePath);
  return relative || path.basename(filePath);
}

function renderHtmlSummary(summary) {
  const counts = summary.counts || {};
  const viewportText = Array.isArray(summary.mobile_viewports) && summary.mobile_viewports.length
    ? summary.mobile_viewports.map((width) => `${width}px`).join(' / ')
    : '暂无数据';
  const screenshotArtifacts = (Array.isArray(summary.mobile_viewports) ? summary.mobile_viewports : [390]).flatMap((width) => {
    const suffix = summary.mobile_viewports?.length === 1 && width === 390 ? '' : `_${width}`;
    return [
      { label: `总览截图 ${width}px`, file: `overview_mobile_layout_check${suffix}.png` },
      { label: `单品截图 ${width}px`, file: `latest_report_mobile_layout_check${suffix}.png` },
      { label: `本地回归截图 ${width}px`, file: `local_regression_summary_mobile_layout_check${suffix}.png` },
    ];
  });
  if (summary.desktop_check) {
    const suffix = summary.desktop_width === defaultDesktopWidth ? '' : `_${summary.desktop_width}`;
    screenshotArtifacts.push(
      { label: `总览桌面截图 ${summary.desktop_width}px`, file: `overview_desktop_layout_check${suffix}.png` },
      { label: `单品桌面截图 ${summary.desktop_width}px`, file: `latest_report_desktop_layout_check${suffix}.png` },
      { label: `本地回归桌面截图 ${summary.desktop_width}px`, file: `local_regression_summary_desktop_layout_check${suffix}.png` },
    );
  }
  const statusText = summary.ok ? '通过' : '失败';
  const statusClass = summary.ok ? 'ok' : 'fail';
  const n8nStatus = summary.n8n_status_summary || null;
  const n8nPanel = n8nStatus
    ? `
    <section class="panel n8n-panel ${htmlEscape(n8nStatus.status_class || 'muted')}">
      <div class="n8n-head">
        <div>
          <strong>n8n 状态</strong>
          <p>${htmlEscape(n8nStatus.message || '暂无 n8n 状态摘要。')}</p>
        </div>
        <b>${htmlEscape(n8nStatus.status || '暂无')}</b>
      </div>
      <div class="n8n-facts">
        <span>页面 ${htmlEscape(n8nStatus.facts?.page || '暂无')}</span>
        <span>API ${htmlEscape(n8nStatus.facts?.api || '暂无')}</span>
        <span>爬虫 ${htmlEscape(n8nStatus.facts?.crawler || '暂无')}</span>
        <span>工作流 ${htmlEscape(n8nStatus.facts?.workflow_id || '暂无')}</span>
      </div>
      <p class="n8n-file">状态文件：${htmlEscape(n8nStatus.file || defaultN8nStatusPath)}</p>
      ${
        Array.isArray(n8nStatus.next_actions) && n8nStatus.next_actions.length
          ? `<ul class="n8n-actions">${n8nStatus.next_actions.map((action) => `<li>${htmlEscape(action)}</li>`).join('')}</ul>`
          : ''
      }
    </section>`
    : '';
  const stepsHtml = summary.steps
    .map((step) => {
      const stepStatus = step.skipped ? '跳过' : step.ok ? '通过' : '失败';
      const stepClass = step.skipped ? 'skip' : step.ok ? 'ok' : 'fail';
      const detail = step.skipped ? step.reason : step.ok ? shortOutput(step.stdout, 1200) : shortOutput(step.stderr || step.stdout, 1600);
      return `
        <article class="step ${stepClass}">
          <div>
            <strong>${htmlEscape(step.title)}</strong>
            <span>${htmlEscape(step.id)} · ${htmlEscape(step.ended_at)}</span>
          </div>
          <b>${htmlEscape(stepStatus)}</b>
          ${detail ? `<pre>${htmlEscape(detail)}</pre>` : ''}
        </article>`;
    })
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI选品系统本地回归检查</title>
  <style>
    :root { color-scheme: light; --ink:#102033; --muted:#607086; --line:#d9e2ef; --ok:#0f8f54; --fail:#b42318; --skip:#7a5c00; --bg:#f6f8fb; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
    main { max-width: 1080px; margin: 0 auto; padding: 24px 18px 40px; }
    header { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: start; margin-bottom: 18px; }
    h1 { margin: 0 0 6px; font-size: clamp(24px, 4vw, 38px); line-height: 1.15; }
    p { margin: 0; color: var(--muted); }
    .badge { min-width: 108px; border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px; text-align: center; }
    .badge strong { display: block; font-size: 30px; line-height: 1; }
    .ok { color: var(--ok); }
    .fail { color: var(--fail); }
    .skip { color: var(--skip); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 16px 0; }
    .metric, .panel, .step { border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    .metric { padding: 14px; }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; margin-top: 4px; font-size: 22px; }
    .panel { padding: 14px; margin: 12px 0; }
    .n8n-panel.ok { border-color: #bbf7d0; }
    .n8n-panel.warn { border-color: #fcd34d; background: #fffbeb; }
    .n8n-panel.fail { border-color: #fecaca; background: #fff7f7; }
    .n8n-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
    .n8n-head strong { display: block; font-size: 16px; }
    .n8n-head b { border-radius: 999px; padding: 5px 10px; background: #f1f5f9; }
    .n8n-panel.ok .n8n-head b { background: #dcfce7; color: var(--ok); }
    .n8n-panel.warn .n8n-head b { background: #fef3c7; color: var(--skip); }
    .n8n-panel.fail .n8n-head b { background: #fee2e2; color: var(--fail); }
    .n8n-facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .n8n-facts span { border: 1px solid #dce3ee; border-radius: 999px; background: #f8fafc; color: #475569; padding: 6px 10px; font-size: 12px; font-weight: 800; }
    .n8n-file { margin-top: 8px; overflow-wrap: anywhere; }
    .n8n-actions { margin: 10px 0 0; padding-left: 20px; color: #7a5c00; }
    .n8n-actions li { margin: 4px 0; overflow-wrap: anywhere; }
    .links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    a { color: #0b5cab; text-decoration: none; border: 1px solid #bfd7f3; border-radius: 999px; padding: 7px 10px; background: #f4f9ff; }
    .step { padding: 12px 14px; margin: 10px 0; display: grid; grid-template-columns: 1fr auto; gap: 12px; }
    .step span { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
    pre { grid-column: 1 / -1; margin: 8px 0 0; padding: 10px; border-radius: 6px; background: #f7f9fc; color: #26384d; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
    @media (max-width: 720px) {
      main { padding: 18px 12px 28px; }
      header { grid-template-columns: 1fr; }
      .badge { text-align: left; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .n8n-head { grid-template-columns: 1fr; }
      .n8n-facts { display: grid; grid-template-columns: minmax(0, 1fr); }
      .step { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>AI选品系统本地回归检查</h1>
        <p>生成时间：${htmlEscape(summary.generated_at)}。这份报告只检查本地文件、布局和 adapter 契约，不调用外部 API，也不触发 n8n 执行。</p>
      </div>
      <div class="badge">
        <span>总状态</span>
        <strong class="${statusClass}">${htmlEscape(statusText)}</strong>
      </div>
    </header>

    <section class="grid" aria-label="检查摘要">
      <article class="metric"><span>通过</span><strong>${htmlEscape(counts.passed ?? 0)}</strong></article>
      <article class="metric"><span>跳过</span><strong>${htmlEscape(counts.skipped ?? 0)}</strong></article>
      <article class="metric"><span>失败</span><strong>${htmlEscape(counts.failed ?? 0)}</strong></article>
      <article class="metric"><span>移动宽度</span><strong>${htmlEscape(viewportText)}</strong></article>
      <article class="metric"><span>桌面宽度</span><strong>${htmlEscape(summary.desktop_check ? `${summary.desktop_width}px` : '未检查')}</strong></article>
    </section>

    ${n8nPanel}

    <section class="panel">
      <strong>文件入口</strong>
      <p>Cache 严格模式：${htmlEscape(summary.strict_cache ? '开启' : '关闭')}</p>
      <p>n8n API 严格模式：${htmlEscape(summary.strict_n8n_api ? '开启' : '关闭')}</p>
      <p>回归总览刷新：${htmlEscape(summary.regression_overview_refresh?.status || '未执行')}</p>
      <div class="links">
        <a href="${htmlEscape(relativeOutputLink(summary.summary_path))}">JSON 明细</a>
        <a href="${htmlEscape(relativeOutputLink(summary.regression_overview_html_path))}">回归总览</a>
        ${screenshotArtifacts.map((item) => `<a href="${htmlEscape(item.file)}">${htmlEscape(item.label)}</a>`).join('')}
      </div>
    </section>

    <section aria-label="检查步骤">
      ${stepsHtml}
    </section>
  </main>
</body>
</html>`;
}

function writeSummary(summary) {
  fs.mkdirSync(path.dirname(summary.summary_path), { recursive: true });
  fs.writeFileSync(summary.summary_path, JSON.stringify(summary, null, 2), 'utf8');
  fs.mkdirSync(path.dirname(summary.html_report_path), { recursive: true });
  fs.writeFileSync(summary.html_report_path, renderHtmlSummary(summary), 'utf8');
}

function printHuman(summary) {
  const lines = [];
  lines.push('AI Selection Local Regression Checks');
  lines.push(`Overall: ${summary.ok ? 'OK' : 'FAILED'}`);
  lines.push(`Summary: ${summary.summary_path}`);
  lines.push(`HTML: ${summary.html_report_path}`);
  if (summary.regression_overview_refresh) {
    lines.push(`Overview: ${summary.regression_overview_refresh.status} (${summary.regression_overview_html_path})`);
  }
  if (summary.n8n_status_summary) {
    lines.push(`n8n: ${summary.n8n_status_summary.status} (API: ${summary.n8n_status_summary.facts?.api || '暂无'}, crawler: ${summary.n8n_status_summary.facts?.crawler || '暂无'})`);
  }
  lines.push('');
  for (const step of summary.steps) {
    const status = step.skipped ? 'SKIP' : step.ok ? 'OK' : 'FAIL';
    lines.push(`- ${status}: ${step.title}`);
    if (step.skipped && step.reason) lines.push(`  ${step.reason}`);
    if (!step.ok) {
      const output = step.stderr || step.stdout;
      if (output) lines.push(`  ${stripAnsi(output).split(/\r?\n/)[0]}`);
    }
  }
  console.log(lines.join('\n'));
}

function refreshRegressionOverview(options) {
  if (!options.overview) {
    return {
      status: 'SKIP',
      ok: true,
      exit_code: 0,
      stdout: '',
      stderr: '',
      reason: 'Disabled by --no-overview',
      refreshed_at: new Date().toISOString(),
    };
  }

  const result = spawnSync(process.execPath, ['tools/build_local_regression_overview.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  });

  return {
    status: result.status === 0 ? 'OK' : 'ATTENTION',
    ok: result.status === 0,
    exit_code: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    refreshed_at: new Date().toISOString(),
  };
}

function mobileLayoutStepArgs(scriptPath, width, screenshotBaseName, options) {
  if (options.viewportWidths.length === 1 && width === 390) return [scriptPath];
  return [
    scriptPath,
    '--width',
    String(width),
    '--height',
    String(options.mobileHeight),
    '--screenshot',
    path.join(outputDir, `${screenshotBaseName}_${width}.png`),
  ];
}

function pushMobileLayoutSteps(steps, options, config) {
  for (const width of options.viewportWidths) {
    const stepId = options.viewportWidths.length === 1 ? config.singleId : `${config.singleId}_${width}`;
    const title = options.viewportWidths.length === 1 ? config.singleTitle : `${config.singleTitle} (${width}px)`;
    steps.push(runNodeStep(
      stepId,
      title,
      mobileLayoutStepArgs(config.scriptPath, width, config.screenshotBaseName, options),
    ));
  }
}

function desktopScreenshotPath(baseName, options) {
  const suffix = options.desktopWidth === defaultDesktopWidth ? '' : `_${options.desktopWidth}`;
  return path.join(outputDir, `${baseName}${suffix}.png`);
}

function pushDesktopLayoutSteps(steps, options) {
  if (!options.desktop) return;
  steps.push(runNodeStep('overview_desktop_layout', `Overview desktop layout (${options.desktopWidth}px)`, [
    'tools/check_overview_mobile_layout.mjs',
    '--width',
    String(options.desktopWidth),
    '--height',
    String(options.desktopHeight),
    '--screenshot',
    desktopScreenshotPath('overview_desktop_layout_check', options),
  ]));
  steps.push(runNodeStep('latest_report_desktop_layout', `Latest product report desktop layout (${options.desktopWidth}px)`, [
    'tools/check_latest_report_mobile_layout.mjs',
    '--width',
    String(options.desktopWidth),
    '--height',
    String(options.desktopHeight),
    '--screenshot',
    desktopScreenshotPath('latest_report_desktop_layout_check', options),
  ]));
}

function pushLocalRegressionSummaryDesktopLayoutStep(steps, options) {
  if (!options.desktop) return;
  steps.push(runNodeStep('local_regression_summary_desktop_layout', `Local regression summary desktop layout (${options.desktopWidth}px)`, [
    'tools/check_regression_summary_mobile_layout.mjs',
    '--width',
    String(options.desktopWidth),
    '--height',
    String(options.desktopHeight),
    '--screenshot',
    desktopScreenshotPath('local_regression_summary_desktop_layout_check', options),
  ]));
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

  const steps = [];
  const configStep = runNodeStep('regression_config', 'Local regression config validation', [
    'tools/build_local_regression_overview.mjs',
    '--validate-config',
  ]);
  steps.push(configStep);
  if (!configStep.ok) {
    const summary = buildSummary(options, steps);
    summary.fail_fast = true;
    summary.fail_fast_reason = 'Local regression configuration is invalid.';
    writeSummary(summary);
    summary.regression_overview_refresh = refreshRegressionOverview(options);
    writeSummary(summary);
    if (options.json) console.log(JSON.stringify(summary, null, 2));
    else printHuman(summary);
    return 1;
  }

  steps.push(runNodeStep('data_source_health', 'Data source health', ['tools/adapters/check_data_source_health.mjs']));
  const n8nStatusArgs = ['tools/check_n8n_status.mjs'];
  if (options.strictN8nApi) n8nStatusArgs.push('--fail-on-api-unauthorized');
  steps.push(runNodeStep('n8n_status', 'n8n page, API authorization, and crawler status', n8nStatusArgs));
  steps.push(runNodeStep('adapter_fixtures', 'Adapter fixture contract and sensitive scan', ['tools/adapters/validate_adapter_contract.mjs', '--check-all-fixtures']));

  const cacheFiles = jsonFilesRecursive(options.cacheDir);
  if (cacheFiles.length) {
    const cacheArgs = ['tools/adapters/validate_adapter_contract.mjs', '--cache-dir', options.cacheDir];
    if (options.strictCache) cacheArgs.push('--strict-freshness');
    steps.push(runNodeStep(
      'adapter_cache',
      options.strictCache
        ? 'Adapter cache contract, sensitive scan, and strict freshness gate'
        : 'Adapter cache contract, sensitive scan, and freshness summary',
      cacheArgs,
    ));
  } else {
    if (options.strictCache) {
      steps.push({
        id: 'adapter_cache',
        title: 'Adapter cache contract, sensitive scan, and strict freshness gate',
        ok: false,
        skipped: false,
        exit_code: 1,
        command: '',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        stdout: '',
        stderr: `No JSON cache files found under ${options.cacheDir}`,
      });
    } else {
      steps.push(skippedStep('adapter_cache', 'Adapter cache contract, sensitive scan, and freshness summary', `No JSON cache files found under ${options.cacheDir}`));
    }
  }

  pushMobileLayoutSteps(steps, options, {
    singleId: 'overview_mobile_layout',
    singleTitle: 'Overview mobile layout',
    scriptPath: 'tools/check_overview_mobile_layout.mjs',
    screenshotBaseName: 'overview_mobile_layout_check',
  });
  pushMobileLayoutSteps(steps, options, {
    singleId: 'latest_report_mobile_layout',
    singleTitle: 'Latest product report mobile layout',
    scriptPath: 'tools/check_latest_report_mobile_layout.mjs',
    screenshotBaseName: 'latest_report_mobile_layout_check',
  });
  pushDesktopLayoutSteps(steps, options);

  let summary = buildSummary(options, steps);
  writeSummary(summary);
  pushMobileLayoutSteps(steps, options, {
    singleId: 'local_regression_summary_mobile_layout',
    singleTitle: 'Local regression summary mobile layout',
    scriptPath: 'tools/check_regression_summary_mobile_layout.mjs',
    screenshotBaseName: 'local_regression_summary_mobile_layout_check',
  });
  pushLocalRegressionSummaryDesktopLayoutStep(steps, options);
  summary = buildSummary(options, steps);
  writeSummary(summary);
  summary.regression_overview_refresh = refreshRegressionOverview(options);
  writeSummary(summary);

  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else printHuman(summary);

  return summary.ok ? 0 : 1;
}

process.exitCode = await main();
