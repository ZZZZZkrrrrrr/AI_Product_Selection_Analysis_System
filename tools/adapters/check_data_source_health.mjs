#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'output', 'amazon_product_analysis');

const defaultDataSourcesPath = path.join(outputDir, 'data_sources.local.json');
const defaultReportPath = path.join(outputDir, 'amazon_product_analysis_latest.html');
const defaultFixturesDir = path.join(__dirname, 'fixtures');
const validatorPath = path.join(__dirname, 'validate_adapter_contract.mjs');

const expectedSources = [
  'crawlee',
  'manual_inputs',
  'competitor_snapshot',
  'keepa',
  'sp_api',
  'amazon_ads_api',
];
const activeLocalSources = new Set(['crawlee', 'manual_inputs', 'competitor_snapshot']);
const reservedAdapterSources = new Set(['keepa', 'sp_api', 'amazon_ads_api']);

function usage() {
  return [
    'Usage:',
    '  node tools/adapters/check_data_source_health.mjs',
    '  node tools/adapters/check_data_source_health.mjs --json',
    '  node tools/adapters/check_data_source_health.mjs --data-sources <path> --report <path> --fixtures-dir <dir>',
    '',
    'This is a read-only local health check. It never calls external APIs and never prints credential values.',
  ].join('\n');
}

function resolveProjectPath(inputPath) {
  if (!inputPath) return inputPath;
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(projectRoot, inputPath);
}

function parseArgs(args) {
  const options = {
    json: false,
    dataSourcesPath: defaultDataSourcesPath,
    reportPath: defaultReportPath,
    fixturesDir: defaultFixturesDir,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--data-sources') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--data-sources requires a value');
      options.dataSourcesPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--report') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--report requires a value');
      options.reportPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--fixtures-dir') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--fixtures-dir requires a value');
      options.fixturesDir = resolveProjectPath(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fileInfo(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false };
  const stat = fs.statSync(filePath);
  return {
    exists: true,
    bytes: stat.size,
    updated_at: stat.mtime.toISOString(),
  };
}

function listFixtureFiles(fixturesDir) {
  if (!fs.existsSync(fixturesDir)) return [];
  return fs
    .readdirSync(fixturesDir)
    .filter((name) => name.endsWith('.sample.json'))
    .sort()
    .map((name) => path.join(fixturesDir, name));
}

function runFixtureValidation(fixturesDir) {
  const result = spawnSync(process.execPath, [validatorPath, '--check-all-fixtures', '--fixtures-dir', fixturesDir], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    exit_code: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function sourceHealth(key, source) {
  if (!isObject(source)) {
    return {
      key,
      level: 'issue',
      status: 'missing',
      label: key,
      mode: 'unknown',
      last_checked_at: null,
      owner_notes: '',
      message: 'Source is missing from data_sources.local.json.',
    };
  }

  const status = String(source.status || 'unknown');
  const mode = String(source.mode || 'unknown');
  const requiredEnv = Array.isArray(source.required_env) ? source.required_env : [];
  const requiredEnvSetCount = requiredEnv.filter((name) => !!process.env[name]).length;
  let level = 'ok';
  let message = 'Source is usable for V1.';

  if (activeLocalSources.has(key)) {
    const allowed = key === 'manual_inputs' ? new Set(['enabled', 'optional']) : new Set(['enabled']);
    if (!allowed.has(status)) {
      level = 'issue';
      message = `Expected local V1 source status ${[...allowed].join(' or ')}, got ${status}.`;
    }
  } else if (reservedAdapterSources.has(key)) {
    if (status === 'not_connected' || status === 'missing_config') {
      level = 'info';
      message = 'Reserved adapter is not connected; this is expected for the free V1 flow.';
    } else if (status === 'configured' || status === 'connected' || status === 'enabled') {
      level = requiredEnv.length > 0 && requiredEnvSetCount === 0 ? 'warning' : 'ok';
      message = level === 'warning'
        ? 'Adapter is marked active, but no required environment variables are visible to this local check.'
        : 'Adapter is marked active; verify cache output before using it in reports.';
    } else {
      level = 'warning';
      message = `Adapter status needs review: ${status}.`;
    }
  }

  if (!source.last_checked_at && level !== 'issue') {
    level = 'warning';
    message = 'Source has no last_checked_at value.';
  }

  return {
    key,
    level,
    status,
    label: String(source.label || key),
    mode,
    detail: String(source.detail || ''),
    last_checked_at: source.last_checked_at || null,
    owner_notes: String(source.owner_notes || ''),
    required_env_count: requiredEnv.length,
    required_env_set_count: requiredEnvSetCount,
    message,
  };
}

function inspectReport(reportPath, sources) {
  const info = fileInfo(reportPath);
  if (!info.exists) {
    return {
      ...info,
      has_data_source_details: false,
      source_labels_present: {},
    };
  }

  const text = fs.readFileSync(reportPath, 'utf8');
  const sourceLabelsPresent = {};
  for (const source of sources) {
    sourceLabelsPresent[source.key] = source.label ? text.includes(source.label) : false;
  }

  return {
    ...info,
    has_data_source_details: text.includes('data_source_details'),
    has_source_confidence: text.includes('数据源') || text.includes('data source'),
    source_labels_present: sourceLabelsPresent,
  };
}

function buildHealth(options) {
  const issues = [];
  const warnings = [];
  let config = null;

  const dataSourcesInfo = fileInfo(options.dataSourcesPath);
  if (!dataSourcesInfo.exists) {
    issues.push(`Data source config not found: ${options.dataSourcesPath}`);
  } else {
    try {
      config = readJsonFile(options.dataSourcesPath);
    } catch (error) {
      issues.push(`Data source config is invalid JSON: ${error.message}`);
    }
  }

  const configuredSources = isObject(config?.sources) ? config.sources : {};
  const sources = expectedSources.map((key) => sourceHealth(key, configuredSources[key]));
  for (const source of sources) {
    if (source.level === 'issue') issues.push(`${source.key}: ${source.message}`);
    if (source.level === 'warning') warnings.push(`${source.key}: ${source.message}`);
  }

  const report = inspectReport(options.reportPath, sources);
  if (!report.exists) {
    issues.push(`Latest report not found: ${options.reportPath}`);
  } else if (!report.has_data_source_details) {
    warnings.push('Latest report does not contain data_source_details.');
  }

  const missingReportLabels = Object.entries(report.source_labels_present || {})
    .filter(([, present]) => !present)
    .map(([key]) => key);
  if (report.exists && missingReportLabels.length) {
    warnings.push(`Latest report does not show labels for: ${missingReportLabels.join(', ')}`);
  }

  const fixtureFiles = listFixtureFiles(options.fixturesDir);
  const fixtures = {
    directory: options.fixturesDir,
    count: fixtureFiles.length,
    files: fixtureFiles.map((filePath) => path.basename(filePath)),
    validation: null,
  };
  if (!fixtureFiles.length) {
    warnings.push(`No sanitized fixture files found under ${options.fixturesDir}`);
  } else {
    fixtures.validation = runFixtureValidation(options.fixturesDir);
    if (!fixtures.validation.ok) {
      issues.push('Adapter fixture validation failed.');
    }
  }

  return {
    ok: issues.length === 0,
    generated_at: new Date().toISOString(),
    paths: {
      data_sources: options.dataSourcesPath,
      latest_report: options.reportPath,
      fixtures_dir: options.fixturesDir,
    },
    data_sources_file: dataSourcesInfo,
    config_summary: config
      ? {
          version: config.version ?? null,
          updated_at: config.updated_at ?? null,
          last_checked_at: config.last_checked_at ?? null,
          owner_notes: config.owner_notes ?? '',
        }
      : null,
    sources,
    report,
    fixtures,
    warnings,
    issues,
  };
}

function printHuman(health) {
  const lines = [];
  lines.push('AI Selection Data Source Health');
  lines.push(`Overall: ${health.ok ? 'OK' : 'ISSUES FOUND'}`);
  lines.push(`Data sources: ${health.paths.data_sources}`);
  lines.push(`Latest report: ${health.paths.latest_report}`);
  lines.push(`Fixtures: ${health.paths.fixtures_dir}`);
  lines.push('');
  lines.push('Sources:');
  for (const source of health.sources) {
    lines.push(`- [${source.level.toUpperCase()}] ${source.key}: ${source.status} / ${source.mode} - ${source.message}`);
  }
  lines.push('');
  lines.push('Report checks:');
  lines.push(`- Exists: ${health.report.exists ? 'yes' : 'no'}`);
  lines.push(`- Contains data_source_details: ${health.report.has_data_source_details ? 'yes' : 'no'}`);
  if (health.report.exists) {
    const presentCount = Object.values(health.report.source_labels_present || {}).filter(Boolean).length;
    lines.push(`- Source labels present: ${presentCount}/${health.sources.length}`);
  }
  lines.push('');
  lines.push('Fixture checks:');
  lines.push(`- Sample files: ${health.fixtures.count}`);
  lines.push(`- Validation: ${health.fixtures.validation ? (health.fixtures.validation.ok ? 'ok' : 'failed') : 'not run'}`);
  lines.push('');
  lines.push('Warnings:');
  lines.push(...(health.warnings.length ? health.warnings.map((item) => `- ${item}`) : ['- none']));
  lines.push('');
  lines.push('Issues:');
  lines.push(...(health.issues.length ? health.issues.map((item) => `- ${item}`) : ['- none']));
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

  const health = buildHealth(options);
  if (options.json) {
    console.log(JSON.stringify(health, null, 2));
  } else {
    printHuman(health);
  }

  return health.ok ? 0 : 1;
}

process.exitCode = main();
