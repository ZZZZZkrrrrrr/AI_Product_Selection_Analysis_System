#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const schemaPath = path.join(__dirname, 'adapter_contract.schema.json');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const allowedSources = new Set(schema.properties.source.enum);
const allowedStatuses = new Set(schema.properties.status.enum);
const allowedConfidence = new Set(schema.properties.evidence.items.properties.confidence.enum);
const allowedSeverity = new Set(schema.properties.risk_flags.items.properties.severity.enum);

function usage() {
  return [
    'Usage:',
    '  node tools/adapters/validate_adapter_contract.mjs <adapter-output.json> [more.json]',
    '  node tools/adapters/validate_adapter_contract.mjs --scan-sensitive <adapter-output.json> [more.json]',
    '  node tools/adapters/validate_adapter_contract.mjs --check-all-fixtures [--fixtures-dir <dir>]',
    '  node tools/adapters/validate_adapter_contract.mjs --cache-dir <dir> [--strict-freshness]',
    '  node tools/adapters/validate_adapter_contract.mjs --self-test',
    '',
    'This validator checks local cache/adapter JSON only. It never calls external APIs.',
    '--strict-freshness turns cache freshness warnings into failures for CI/regression gates.',
  ].join('\n');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function checkString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateAdapterPayload(payload, label = 'payload') {
  const errors = [];

  if (!isObject(payload)) {
    return [`${label}: root must be an object`];
  }

  for (const key of schema.required) {
    if (!hasOwn(payload, key)) errors.push(`${label}: missing required field "${key}"`);
  }

  if (hasOwn(payload, 'ok') && typeof payload.ok !== 'boolean') errors.push(`${label}: ok must be boolean`);
  if (hasOwn(payload, 'source') && !allowedSources.has(payload.source)) {
    errors.push(`${label}: source must be one of ${[...allowedSources].join(', ')}`);
  }
  if (hasOwn(payload, 'status') && !allowedStatuses.has(payload.status)) {
    errors.push(`${label}: status must be one of ${[...allowedStatuses].join(', ')}`);
  }
  if (hasOwn(payload, 'fetched_at') && !checkString(payload.fetched_at)) errors.push(`${label}: fetched_at must be non-empty string`);
  if (hasOwn(payload, 'data') && !isObject(payload.data)) errors.push(`${label}: data must be object`);
  if (hasOwn(payload, 'evidence') && !Array.isArray(payload.evidence)) errors.push(`${label}: evidence must be array`);
  if (hasOwn(payload, 'risk_flags') && !Array.isArray(payload.risk_flags)) errors.push(`${label}: risk_flags must be array`);

  if (hasOwn(payload, 'cache')) {
    if (!isObject(payload.cache)) {
      errors.push(`${label}: cache must be object`);
    } else {
      for (const key of ['hit', 'stale', 'cache_key', 'path', 'ttl_hours']) {
        if (!hasOwn(payload.cache, key)) errors.push(`${label}: cache missing "${key}"`);
      }
      if (hasOwn(payload.cache, 'hit') && typeof payload.cache.hit !== 'boolean') errors.push(`${label}: cache.hit must be boolean`);
      if (hasOwn(payload.cache, 'stale') && typeof payload.cache.stale !== 'boolean') errors.push(`${label}: cache.stale must be boolean`);
      if (hasOwn(payload.cache, 'cache_key') && !checkString(payload.cache.cache_key)) errors.push(`${label}: cache.cache_key must be non-empty string`);
      if (hasOwn(payload.cache, 'path') && !checkString(payload.cache.path)) errors.push(`${label}: cache.path must be non-empty string`);
      if (hasOwn(payload.cache, 'ttl_hours') && (typeof payload.cache.ttl_hours !== 'number' || payload.cache.ttl_hours < 0)) {
        errors.push(`${label}: cache.ttl_hours must be non-negative number`);
      }
    }
  }

  if (hasOwn(payload, 'cost')) {
    if (!isObject(payload.cost)) {
      errors.push(`${label}: cost must be object`);
    } else {
      for (const key of ['billable', 'unit', 'estimated_units', 'note']) {
        if (!hasOwn(payload.cost, key)) errors.push(`${label}: cost missing "${key}"`);
      }
      if (hasOwn(payload.cost, 'billable') && typeof payload.cost.billable !== 'boolean') errors.push(`${label}: cost.billable must be boolean`);
      if (hasOwn(payload.cost, 'unit') && !checkString(payload.cost.unit)) errors.push(`${label}: cost.unit must be non-empty string`);
      if (hasOwn(payload.cost, 'estimated_units') && (typeof payload.cost.estimated_units !== 'number' || payload.cost.estimated_units < 0)) {
        errors.push(`${label}: cost.estimated_units must be non-negative number`);
      }
      if (hasOwn(payload.cost, 'note') && typeof payload.cost.note !== 'string') errors.push(`${label}: cost.note must be string`);
    }
  }

  if (Array.isArray(payload.evidence)) {
    payload.evidence.forEach((item, index) => {
      const prefix = `${label}: evidence[${index}]`;
      if (!isObject(item)) {
        errors.push(`${prefix} must be object`);
        return;
      }
      for (const key of ['label', 'value', 'source']) {
        if (!hasOwn(item, key)) errors.push(`${prefix} missing "${key}"`);
      }
      if (hasOwn(item, 'label') && !checkString(item.label)) errors.push(`${prefix}.label must be non-empty string`);
      if (hasOwn(item, 'source') && !checkString(item.source)) errors.push(`${prefix}.source must be non-empty string`);
      if (hasOwn(item, 'confidence') && !allowedConfidence.has(item.confidence)) {
        errors.push(`${prefix}.confidence must be one of ${[...allowedConfidence].join(', ')}`);
      }
    });
  }

  if (Array.isArray(payload.risk_flags)) {
    payload.risk_flags.forEach((item, index) => {
      const prefix = `${label}: risk_flags[${index}]`;
      if (!isObject(item)) {
        errors.push(`${prefix} must be object`);
        return;
      }
      for (const key of ['severity', 'label', 'text']) {
        if (!hasOwn(item, key)) errors.push(`${prefix} missing "${key}"`);
      }
      if (hasOwn(item, 'severity') && !allowedSeverity.has(item.severity)) {
        errors.push(`${prefix}.severity must be one of ${[...allowedSeverity].join(', ')}`);
      }
      if (hasOwn(item, 'label') && !checkString(item.label)) errors.push(`${prefix}.label must be non-empty string`);
      if (hasOwn(item, 'text') && !checkString(item.text)) errors.push(`${prefix}.text must be non-empty string`);
    });
  }

  if (hasOwn(payload, 'error') && payload.error !== null) {
    if (!isObject(payload.error)) {
      errors.push(`${label}: error must be object or null`);
    } else {
      if (hasOwn(payload.error, 'code') && typeof payload.error.code !== 'string') errors.push(`${label}: error.code must be string`);
      if (hasOwn(payload.error, 'message') && typeof payload.error.message !== 'string') errors.push(`${label}: error.message must be string`);
      if (hasOwn(payload.error, 'retryable') && typeof payload.error.retryable !== 'boolean') errors.push(`${label}: error.retryable must be boolean`);
    }
  }

  if (hasOwn(payload, 'next_retry_at') && payload.next_retry_at !== null && typeof payload.next_retry_at !== 'string') {
    errors.push(`${label}: next_retry_at must be string or null`);
  }

  return errors;
}

function validSample() {
  return {
    ok: true,
    source: 'keepa',
    status: 'connected',
    status_label: '已接入',
    fetched_at: '2026-05-23T06:45:00+08:00',
    cache: {
      hit: true,
      stale: false,
      cache_key: 'amazon.in:B0BQXZ11B8:keepa:2026-05-23',
      path: 'output/amazon_product_analysis/cache/keepa/amazon.in/B0BQXZ11B8.json',
      ttl_hours: 24,
    },
    cost: {
      billable: false,
      unit: 'request_or_token',
      estimated_units: 0,
      note: 'self test',
    },
    data: {},
    evidence: [{ label: 'price_trend', value: 'stable', source: 'keepa', confidence: 'medium' }],
    risk_flags: [{ severity: 'low', label: 'cache only', text: 'Self-test payload does not contain live API data.' }],
    error: null,
    next_retry_at: null,
  };
}

function loadJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

const SENSITIVE_PATTERNS = [
  { label: 'OpenAI-style secret key', pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  { label: 'AWS access key id', pattern: /AKIA[A-Z0-9]{16}/g },
  { label: 'Bearer token', pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
  { label: 'API key field with value', pattern: /["']?(?:api_key|apikey|access_key)["']?\s*[:=]\s*["'][^"']{8,}["']/gi },
  { label: 'client secret field with value', pattern: /["']?client_secret["']?\s*[:=]\s*["'][^"']{8,}["']/gi },
  { label: 'refresh token field with value', pattern: /["']?refresh_token["']?\s*[:=]\s*["'][^"']{8,}["']/gi },
  { label: 'access token field with value', pattern: /["']?access_token["']?\s*[:=]\s*["'][^"']{8,}["']/gi },
  { label: 'authorization field with value', pattern: /["']?authorization["']?\s*[:=]\s*["'][^"']{8,}["']/gi },
  { label: 'password field with value', pattern: /["']?password["']?\s*[:=]\s*["'][^"']{8,}["']/gi },
];

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function scanSensitiveText(text, label = 'payload') {
  const findings = [];
  for (const { label: patternLabel, pattern } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      findings.push({
        label: patternLabel,
        line: lineNumberAt(text, match.index),
        sample: match[0].slice(0, 80),
      });
    }
  }
  return findings.map((finding) => `${label}: line ${finding.line}: ${finding.label}: ${finding.sample}`);
}

function scanSensitiveFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return scanSensitiveText(raw, filePath);
}

function defaultFixturesDir() {
  return path.join(__dirname, 'fixtures');
}

function resolveInputPath(inputPath) {
  if (!inputPath) return inputPath;
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(projectRoot, inputPath);
}

function optionValue(args, optionName) {
  const index = args.indexOf(optionName);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }
  return value;
}

function fixtureFiles(fixturesDir = defaultFixturesDir()) {
  if (!fs.existsSync(fixturesDir)) return [];
  return fs
    .readdirSync(fixturesDir)
    .filter((name) => name.endsWith('.sample.json'))
    .sort()
    .map((name) => path.join(fixturesDir, name));
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

function runSelfTest() {
  const errors = validateAdapterPayload(validSample(), 'self-test');
  if (errors.length) {
    console.error(errors.join('\n'));
    return 1;
  }
  console.log('self-test: ok');
  return 0;
}

function validateFiles(filePaths) {
  let exitCode = 0;
  for (const filePath of filePaths) {
    try {
      const payload = loadJsonFile(filePath);
      const errors = validateAdapterPayload(payload, filePath);
      if (errors.length) {
        exitCode = 1;
        console.error(`${filePath}: invalid`);
        console.error(errors.map((error) => `  - ${error}`).join('\n'));
      } else {
        console.log(`${filePath}: ok`);
      }
    } catch (error) {
      exitCode = 1;
      console.error(`${filePath}: invalid`);
      console.error(`  - ${error.message}`);
    }
  }
  return exitCode;
}

function scanSensitiveFiles(filePaths) {
  let exitCode = 0;
  for (const filePath of filePaths) {
    try {
      const findings = scanSensitiveFile(filePath);
      if (findings.length) {
        exitCode = 1;
        console.error(`${filePath}: sensitive patterns found`);
        console.error(findings.map((finding) => `  - ${finding}`).join('\n'));
      } else {
        console.log(`${filePath}: no sensitive patterns found`);
      }
    } catch (error) {
      exitCode = 1;
      console.error(`${filePath}: scan failed`);
      console.error(`  - ${error.message}`);
    }
  }
  return exitCode;
}

function isoOrNone(value) {
  return value ? new Date(value).toISOString() : 'none';
}

function incrementMap(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function summarizeCacheFiles(filePaths) {
  const now = Date.now();
  const bySource = new Map();
  const warnings = [];
  const strictIssues = [];

  function recordFreshnessIssue(message) {
    warnings.push(message);
    strictIssues.push(message);
  }

  for (const filePath of filePaths) {
    let payload;
    try {
      payload = loadJsonFile(filePath);
    } catch (error) {
      warnings.push(`${filePath}: cannot summarize invalid JSON: ${error.message}`);
      continue;
    }

    const source = checkString(payload.source) ? payload.source : 'unknown';
    if (!bySource.has(source)) {
      bySource.set(source, {
        source,
        files: 0,
        statuses: new Map(),
        stale: 0,
        expired: 0,
        ttl_missing: 0,
        fetched_missing: 0,
        oldest_fetched_at: null,
        newest_fetched_at: null,
      });
    }

    const summary = bySource.get(source);
    summary.files += 1;
    incrementMap(summary.statuses, checkString(payload.status) ? payload.status : 'unknown');

    const cache = isObject(payload.cache) ? payload.cache : {};
    const fetchedMs = Date.parse(payload.fetched_at || '');
    const ttlHours = typeof cache.ttl_hours === 'number' ? cache.ttl_hours : null;

    if (cache.stale === true) {
      summary.stale += 1;
      recordFreshnessIssue(`${filePath}: cache is marked stale`);
    }
    if (!Number.isFinite(fetchedMs)) {
      summary.fetched_missing += 1;
      recordFreshnessIssue(`${filePath}: fetched_at is missing or invalid`);
    } else {
      if (!summary.oldest_fetched_at || fetchedMs < summary.oldest_fetched_at) summary.oldest_fetched_at = fetchedMs;
      if (!summary.newest_fetched_at || fetchedMs > summary.newest_fetched_at) summary.newest_fetched_at = fetchedMs;
      if (ttlHours !== null && fetchedMs + ttlHours * 60 * 60 * 1000 < now) {
        summary.expired += 1;
        recordFreshnessIssue(`${filePath}: cache TTL expired`);
      }
    }
    if (ttlHours === null) {
      summary.ttl_missing += 1;
      recordFreshnessIssue(`${filePath}: cache.ttl_hours is missing or invalid`);
    }
  }

  return {
    summaries: [...bySource.values()]
      .sort((a, b) => a.source.localeCompare(b.source))
      .map((summary) => ({
        ...summary,
        statuses: [...summary.statuses.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    })),
    warnings,
    strictIssues,
  };
}

function printCacheFreshnessSummary(filePaths, options = {}) {
  const { summaries, warnings, strictIssues } = summarizeCacheFiles(filePaths);
  console.log('[3/3] cache source and freshness summary');
  for (const summary of summaries) {
    const statuses = summary.statuses.map(([status, count]) => `${status}:${count}`).join(', ') || 'none';
    console.log(
      `${summary.source}: files=${summary.files}, statuses=${statuses}, stale=${summary.stale}, expired=${summary.expired}, ttl_missing=${summary.ttl_missing}, fetched_missing=${summary.fetched_missing}, oldest=${isoOrNone(summary.oldest_fetched_at)}, newest=${isoOrNone(summary.newest_fetched_at)}`,
    );
  }
  if (warnings.length) {
    console.log('cache freshness warnings:');
    for (const warning of warnings.slice(0, 20)) {
      console.log(`  - ${warning}`);
    }
    if (warnings.length > 20) console.log(`  - ... ${warnings.length - 20} more`);
  } else {
    console.log('cache freshness warnings: none');
  }
  if (options.strictFreshness) {
    if (strictIssues.length) {
      console.error('strict freshness failures:');
      for (const issue of strictIssues.slice(0, 20)) {
        console.error(`  - ${issue}`);
      }
      if (strictIssues.length > 20) console.error(`  - ... ${strictIssues.length - 20} more`);
    } else {
      console.log('strict freshness: ok');
    }
  }
  return { summaries, warnings, strictIssues };
}

function checkCacheDir(cacheDir, options = {}) {
  if (!fs.existsSync(cacheDir)) {
    console.error(`Cache directory not found: ${cacheDir}`);
    return 1;
  }
  if (!fs.statSync(cacheDir).isDirectory()) {
    console.error(`Cache path is not a directory: ${cacheDir}`);
    return 1;
  }

  const files = jsonFilesRecursive(cacheDir);
  if (!files.length) {
    console.error(`No JSON cache files found under ${cacheDir}`);
    return 1;
  }

  let exitCode = 0;
  console.log(`cache directory: ${cacheDir}`);
  console.log(`cache files: ${files.length}`);
  console.log('[1/3] cache contract validation');
  exitCode = Math.max(exitCode, validateFiles(files));
  console.log('[2/3] cache sensitive-pattern scan');
  exitCode = Math.max(exitCode, scanSensitiveFiles(files));
  const freshness = printCacheFreshnessSummary(files, options);
  if (options.strictFreshness && freshness.strictIssues.length) exitCode = Math.max(exitCode, 1);
  if (exitCode === 0) console.log('all cache checks: ok');
  return exitCode;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }

  if (args.includes('--self-test')) {
    return runSelfTest();
  }

  if (args.includes('--cache-dir')) {
    const cacheIndex = args.indexOf('--cache-dir');
    const strictFreshness = args.includes('--strict-freshness');
    const extraArgs = args.filter((arg, index) => index !== cacheIndex && index !== cacheIndex + 1 && arg !== '--strict-freshness');
    if (extraArgs.length) {
      console.error('--cache-dir can only be combined with --strict-freshness');
      console.error(usage());
      return 1;
    }
    let cacheDir;
    try {
      cacheDir = resolveInputPath(optionValue(args, '--cache-dir'));
    } catch (error) {
      console.error(error.message);
      console.error(usage());
      return 1;
    }
    return checkCacheDir(cacheDir, { strictFreshness });
  }

  if (args.includes('--check-all-fixtures')) {
    let fixturesDir;
    try {
      fixturesDir = resolveInputPath(optionValue(args, '--fixtures-dir')) || defaultFixturesDir();
    } catch (error) {
      console.error(error.message);
      console.error(usage());
      return 1;
    }

    const files = fixtureFiles(fixturesDir);
    if (!files.length) {
      console.error(`No fixture files found under ${fixturesDir}`);
      return 1;
    }
    let exitCode = 0;
    console.log(`fixtures directory: ${fixturesDir}`);
    console.log('[1/3] self-test');
    exitCode = Math.max(exitCode, runSelfTest());
    console.log('[2/3] fixture contract validation');
    exitCode = Math.max(exitCode, validateFiles(files));
    console.log('[3/3] fixture sensitive-pattern scan');
    exitCode = Math.max(exitCode, scanSensitiveFiles(files));
    if (exitCode === 0) console.log('all fixture checks: ok');
    return exitCode;
  }

  if (args.includes('--fixtures-dir') || args.includes('--cache-dir') || args.includes('--strict-freshness')) {
    console.error('--fixtures-dir can only be used with --check-all-fixtures; --cache-dir and --strict-freshness must be used together');
    console.error(usage());
    return 1;
  }

  const scanSensitive = args.includes('--scan-sensitive');
  const fileArgs = args.filter((arg) => arg !== '--scan-sensitive');
  if (scanSensitive) {
    if (!fileArgs.length) {
      console.error(usage());
      return 1;
    }
    return scanSensitiveFiles(fileArgs);
  }

  return validateFiles(fileArgs);
}

process.exitCode = main();
