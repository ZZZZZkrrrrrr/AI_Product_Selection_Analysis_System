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

const defaultReportPath = path.join(outputDir, 'amazon_product_analysis_overview.html');
const defaultScreenshotPath = path.join(outputDir, 'overview_mobile_layout_check.png');

function usage() {
  return [
    'Usage:',
    '  node tools/check_overview_mobile_layout.mjs',
    '  node tools/check_overview_mobile_layout.mjs --json',
    '  node tools/check_overview_mobile_layout.mjs --report <html> --screenshot <png>',
    '  node tools/check_overview_mobile_layout.mjs --width 390 --height 1400',
    '',
    'This opens a local HTML report in headless Chrome/Edge, captures a mobile screenshot, and checks layout stability.',
    'It does not call external APIs.',
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
  if (!found) {
    throw new Error('No Chrome or Edge executable found. Install Chrome/Edge or pass --chrome <path>.');
  }
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
    const visibleTables = Array.from(document.querySelectorAll('table')).filter(isVisible).length;
    const visibleCards = Array.from(document.querySelectorAll('.overview-card')).filter(isVisible).length;
    const visibleDesktopBlocks = Array.from(document.querySelectorAll('.desktop-table')).filter(isVisible).length;
    const visibleMobileLists = Array.from(document.querySelectorAll('.mobile-card-list')).filter(isVisible).length;
    const checkSummaryVisible = isVisible(document.querySelector('.check-summary'));
    const checkLinks = Array.from(document.querySelectorAll('.check-links a')).filter(isVisible).length;
    const anchors = Array.from(document.querySelectorAll('a')).filter(isVisible).map((a) => String(a.textContent || '').trim()).filter(Boolean).slice(0, 20);
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
      overviewBoundaryVisible: isVisible(document.querySelector('.overview-boundary')),
      sourceHealthVisible: isVisible(document.querySelector('.source-health')),
      sourceChipCount: Array.from(document.querySelectorAll('.source-chip')).filter(isVisible).length,
      checkSummaryVisible,
      checkLinks,
      visibleCards,
      visibleMobileLists,
      visibleTables,
      visibleDesktopBlocks,
      anchorSample: anchors,
      overflowingNodes
    });
  } catch (error) {
    return JSON.stringify({ error: error.message, stack: error.stack });
  } })()`;
}

function buildChecks(metrics, options) {
  const checks = [
    { name: 'no horizontal overflow', ok: metrics.hasHorizontalOverflow === false },
    { name: 'overview boundary visible', ok: metrics.overviewBoundaryVisible === true },
    { name: 'source health summary visible', ok: metrics.sourceHealthVisible === true },
    { name: 'source status chips visible', ok: metrics.sourceChipCount >= 6 },
    { name: 'local regression summary visible', ok: metrics.checkSummaryVisible === true },
    { name: 'local regression links visible', ok: metrics.checkLinks >= 2 },
    { name: 'no overflowing visible nodes', ok: Array.isArray(metrics.overflowingNodes) && metrics.overflowingNodes.length === 0 },
  ];

  if (options.width <= 560) {
    checks.push(
      { name: 'mobile cards visible', ok: metrics.visibleCards > 0 },
      { name: 'mobile card groups visible', ok: metrics.visibleMobileLists > 0 },
      { name: 'desktop tables hidden', ok: metrics.visibleTables === 0 && metrics.visibleDesktopBlocks === 0 },
    );
  } else if (options.width >= 900) {
    checks.push(
      { name: 'desktop tables visible', ok: metrics.visibleTables > 0 && metrics.visibleDesktopBlocks > 0 },
      { name: 'mobile cards hidden on desktop', ok: metrics.visibleCards === 0 && metrics.visibleMobileLists === 0 },
    );
  }

  return checks;
}

async function run(options) {
  if (!fs.existsSync(options.reportPath)) {
    throw new Error(`Report not found: ${options.reportPath}`);
  }

  const chromePath = findChrome(options.chromePath);
  const port = await freePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-selection-layout-'));
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
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: options.width,
      height: options.height,
      deviceScaleFactor: options.deviceScaleFactor,
      mobile: true,
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

    const checks = buildChecks(metrics, options);
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
  lines.push('Overview Mobile Layout Check');
  lines.push(`Overall: ${result.ok ? 'OK' : 'FAILED'}`);
  lines.push(`Report: ${result.report}`);
  lines.push(`Screenshot: ${result.screenshot}`);
  lines.push(`Viewport: ${result.viewport.width}x${result.viewport.height}`);
  lines.push('');
  lines.push('Metrics:');
  lines.push(`- horizontal overflow: ${result.metrics.hasHorizontalOverflow ? 'yes' : 'no'}`);
  lines.push(`- overview boundary visible: ${result.metrics.overviewBoundaryVisible ? 'yes' : 'no'}`);
  lines.push(`- source health visible: ${result.metrics.sourceHealthVisible ? 'yes' : 'no'}`);
  lines.push(`- source chips: ${result.metrics.sourceChipCount}`);
  lines.push(`- local regression visible: ${result.metrics.checkSummaryVisible ? 'yes' : 'no'}`);
  lines.push(`- local regression links: ${result.metrics.checkLinks}`);
  lines.push(`- visible cards: ${result.metrics.visibleCards}`);
  lines.push(`- visible mobile groups: ${result.metrics.visibleMobileLists}`);
  lines.push(`- visible tables: ${result.metrics.visibleTables}`);
  lines.push(`- visible desktop blocks: ${result.metrics.visibleDesktopBlocks}`);
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
