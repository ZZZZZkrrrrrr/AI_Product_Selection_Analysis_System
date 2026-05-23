#!/usr/bin/env node

import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output', 'amazon_product_analysis');

const defaultReportPath = path.join(outputDir, 'local_regression_overview.html');
const defaultScreenshotPath = path.join(outputDir, 'local_regression_overview_mobile_layout_check.png');
const desktopMinWidth = 900;

function usage() {
  return [
    'Usage:',
    '  node tools/check_regression_overview_layout.mjs',
    '  node tools/check_regression_overview_layout.mjs --json',
    '  node tools/check_regression_overview_layout.mjs --report <html> --screenshot <png>',
    '  node tools/check_regression_overview_layout.mjs --width 390 --height 1400',
    '  node tools/check_regression_overview_layout.mjs --width 1366 --height 1000 --screenshot output/amazon_product_analysis/local_regression_overview_desktop_layout_check.png',
    '',
    'This opens local_regression_overview.html in headless Chrome/Edge, captures a screenshot, and checks the unified regression overview layout.',
    'Widths below 900px use mobile emulation; 900px and above use desktop emulation.',
    'It does not call external APIs or trigger n8n workflow execution.',
  ].join('\n');
}

function resolveProjectPath(inputPath) {
  if (!inputPath) return inputPath;
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(projectRoot, inputPath);
}

function parseInteger(value, label) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be a positive integer`);
  return number;
}

function parseArgs(args) {
  const options = {
    json: false,
    reportPath: defaultReportPath,
    screenshotPath: defaultScreenshotPath,
    width: 390,
    height: 1400,
    deviceScaleFactor: 2,
    chromePath: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--report') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--report requires a value');
      options.reportPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--screenshot') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--screenshot requires a value');
      options.screenshotPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--width') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--width requires a value');
      options.width = parseInteger(value, '--width');
      index += 1;
    } else if (arg === '--height') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--height requires a value');
      options.height = parseInteger(value, '--height');
      index += 1;
    } else if (arg === '--chrome') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--chrome requires a value');
      options.chromePath = resolveProjectPath(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error('Could not allocate a free port'));
      });
    });
  });
}

function chromeCandidates() {
  return [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : null,
    process.platform === 'linux' ? '/usr/bin/google-chrome' : null,
    process.platform === 'linux' ? '/usr/bin/chromium' : null,
    process.platform === 'linux' ? '/usr/bin/chromium-browser' : null,
  ].filter(Boolean);
}

function findChrome(explicitPath) {
  if (explicitPath) {
    if (!fs.existsSync(explicitPath)) throw new Error(`Chrome path not found: ${explicitPath}`);
    return explicitPath;
  }
  const found = chromeCandidates().find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('No Chrome or Edge executable found. Install Chrome/Edge or pass --chrome <path>.');
  return found;
}

async function waitForChrome(port) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      return await getJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }
  throw lastError || new Error('Chrome did not start');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket === 'undefined') {
      reject(new Error('This Node.js runtime does not provide WebSocket.'));
      return;
    }

    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();

    ws.onopen = () => {
      resolve({
        send(method, params = {}) {
          const id = nextId;
          nextId += 1;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
        close() {
          ws.close();
        },
      });
    };

    ws.onerror = reject;
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) item.rej(new Error(JSON.stringify(message.error)));
        else item.res(message.result || {});
      }
    };
  });
}

function metricsExpression() {
  return `(() => { try {
    const isVisible = (el) => !!(el && el.getClientRects && el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
    const textIncludes = (needle) => String(document.body.textContent || '').includes(needle);
    const visibleHeader = isVisible(document.querySelector('header h1'));
    const visibleBadge = isVisible(document.querySelector('.badge'));
    const visibleMetrics = Array.from(document.querySelectorAll('.metric')).filter(isVisible).length;
    const visibleFreshness = isVisible(document.querySelector('.freshness'));
    const visibleCommandPanel = isVisible(document.querySelector('.command-panel'));
    const visibleServiceHealth = isVisible(document.querySelector('.service-health'));
    const visibleServiceFacts = Array.from(document.querySelectorAll('.service-facts span')).filter(isVisible).length;
    const visibleSourceHealth = isVisible(document.querySelector('.source-health'));
    const visibleSourceFacts = Array.from(document.querySelectorAll('.source-facts span')).filter(isVisible).length;
    const visibleSourceChips = Array.from(document.querySelectorAll('.source-chip')).filter(isVisible).length;
    const visibleRunCards = Array.from(document.querySelectorAll('.run')).filter(isVisible).length;
    const visibleRunFacts = Array.from(document.querySelectorAll('.run .facts span')).filter(isVisible).length;
    const visibleLinks = Array.from(document.querySelectorAll('.links a')).filter(isVisible).length;
    const overflowingNodes = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!isVisible(el)) continue;
      const style = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 2 && style.overflowX === 'visible') {
        overflowingNodes.push({
          tag: el.tagName.toLowerCase(),
          className: String(el.getAttribute('class') || '').slice(0, 90),
          text: String(el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80),
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth
        });
        if (overflowingNodes.length >= 12) break;
      }
    }
    return JSON.stringify({
      title: document.title,
      viewportWidth: window.innerWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 || document.body.scrollWidth > document.body.clientWidth + 2,
      visibleHeader,
      visibleBadge,
      visibleMetrics,
      visibleFreshness,
      visibleCommandPanel,
      visibleServiceHealth,
      visibleServiceFacts,
      visibleSourceHealth,
      visibleSourceFacts,
      visibleSourceChips,
      visibleRunCards,
      visibleRunFacts,
      visibleLinks,
      hasUnknownOverrideMetric: textIncludes('未知覆盖'),
      hasAuthorizationSource: textIncludes('授权来源') && (textIncludes('已保存 Windows 凭据') || textIncludes('环境变量 N8N_API_KEY') || textIncludes('未配置')),
      hasDataSourceText: textIncludes('数据源健康'),
      hasRegressionCardText: textIncludes('默认回归') || textIncludes('桌面回归') || textIncludes('多视口回归'),
      overflowingNodes
    });
  } catch (error) {
    return JSON.stringify({ error: error.message, stack: error.stack });
  } })()`;
}

function buildChecks(metrics) {
  return [
    { name: 'no horizontal overflow', ok: metrics.hasHorizontalOverflow === false },
    { name: 'header visible', ok: metrics.visibleHeader === true },
    { name: 'status badge visible', ok: metrics.visibleBadge === true },
    { name: 'summary metrics visible', ok: metrics.visibleMetrics >= 6 },
    { name: 'unknown override metric visible', ok: metrics.hasUnknownOverrideMetric === true },
    { name: 'freshness panel visible', ok: metrics.visibleFreshness === true },
    { name: 'rerun command panel visible', ok: metrics.visibleCommandPanel === true },
    { name: 'n8n service status visible', ok: metrics.visibleServiceHealth === true },
    { name: 'n8n service facts visible', ok: metrics.visibleServiceFacts >= 6 },
    { name: 'n8n authorization source visible', ok: metrics.hasAuthorizationSource === true },
    { name: 'data source health visible', ok: metrics.visibleSourceHealth === true },
    { name: 'data source facts visible', ok: metrics.visibleSourceFacts >= 5 },
    { name: 'data source chips visible', ok: metrics.visibleSourceChips >= 6 },
    { name: 'regression cards visible', ok: metrics.visibleRunCards >= 3 },
    { name: 'regression card facts visible', ok: metrics.visibleRunFacts >= 12 },
    { name: 'artifact links visible', ok: metrics.visibleLinks >= 2 },
    { name: 'data source text visible', ok: metrics.hasDataSourceText === true },
    { name: 'regression card text visible', ok: metrics.hasRegressionCardText === true },
    { name: 'no overflowing visible nodes', ok: Array.isArray(metrics.overflowingNodes) && metrics.overflowingNodes.length === 0 },
  ];
}

function viewportMode(options) {
  return options.width >= desktopMinWidth ? 'desktop' : 'mobile';
}

async function run(options) {
  if (!fs.existsSync(options.reportPath)) throw new Error(`Report not found: ${options.reportPath}`);

  const chromePath = findChrome(options.chromePath);
  const port = await freePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-selection-regression-overview-layout-'));
  let chrome;
  let cleanupError = null;

  try {
    chrome = spawn(chromePath, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      'about:blank',
    ], { stdio: 'ignore', windowsHide: true });

    await waitForChrome(port);
    const pages = await getJson(`http://127.0.0.1:${port}/json`);
    const page = pages.find((candidate) => candidate.type === 'page') || pages[0];
    const client = await connect(page.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    const mode = viewportMode(options);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: options.width,
      height: options.height,
      deviceScaleFactor: options.deviceScaleFactor,
      mobile: mode === 'mobile',
    });
    await client.send('Page.navigate', { url: pathToFileURL(options.reportPath).href });
    await delay(2200);

    const raw = await client.send('Runtime.evaluate', {
      expression: metricsExpression(),
      returnByValue: true,
    });
    const metrics = JSON.parse(raw.result.value);
    if (metrics.error) throw new Error(metrics.error);

    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
    });
    fs.mkdirSync(path.dirname(options.screenshotPath), { recursive: true });
    fs.writeFileSync(options.screenshotPath, Buffer.from(screenshot.data, 'base64'));
    client.close();

    const checks = buildChecks(metrics);
    return {
      ok: checks.every((check) => check.ok),
      generated_at: new Date().toISOString(),
      report: options.reportPath,
      screenshot: options.screenshotPath,
      chrome: chromePath,
      viewport: {
        width: options.width,
        height: options.height,
        deviceScaleFactor: options.deviceScaleFactor,
        mode,
      },
      metrics,
      checks,
      cleanup_error: cleanupError,
    };
  } finally {
    try {
      if (chrome) chrome.kill();
    } catch (_) {
      // Best-effort cleanup only.
    }
    await delay(1000);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (error) {
      cleanupError = error.message;
    }
  }
}

function printHuman(result) {
  const lines = [];
  const modeLabel = result.viewport.mode === 'desktop' ? 'Desktop' : 'Mobile';
  lines.push(`Regression Overview ${modeLabel} Layout Check`);
  lines.push(`Overall: ${result.ok ? 'OK' : 'FAILED'}`);
  lines.push(`Report: ${result.report}`);
  lines.push(`Screenshot: ${result.screenshot}`);
  lines.push(`Viewport: ${result.viewport.width}x${result.viewport.height}`);
  lines.push('');
  lines.push('Metrics:');
  lines.push(`- horizontal overflow: ${result.metrics.hasHorizontalOverflow ? 'yes' : 'no'}`);
  lines.push(`- header visible: ${result.metrics.visibleHeader ? 'yes' : 'no'}`);
  lines.push(`- summary metrics: ${result.metrics.visibleMetrics}`);
  lines.push(`- n8n service facts: ${result.metrics.visibleServiceFacts}`);
  lines.push(`- data source chips: ${result.metrics.visibleSourceChips}`);
  lines.push(`- regression cards: ${result.metrics.visibleRunCards}`);
  lines.push(`- regression facts: ${result.metrics.visibleRunFacts}`);
  lines.push(`- unknown override metric: ${result.metrics.hasUnknownOverrideMetric ? 'yes' : 'no'}`);
  lines.push(`- authorization source: ${result.metrics.hasAuthorizationSource ? 'yes' : 'no'}`);
  lines.push(`- overflowing nodes: ${result.metrics.overflowingNodes.length}`);
  lines.push('');
  lines.push('Checks:');
  for (const check of result.checks) {
    lines.push(`- ${check.ok ? 'OK' : 'FAIL'}: ${check.name}`);
  }
  if (result.cleanup_error) {
    lines.push('');
    lines.push(`Cleanup warning: ${result.cleanup_error}`);
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
    const result = await run(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printHuman(result);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

process.exitCode = await main();
