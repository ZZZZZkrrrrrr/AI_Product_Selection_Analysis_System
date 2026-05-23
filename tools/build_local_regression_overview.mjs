#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output', 'amazon_product_analysis');

const defaultJsonPath = path.join(outputDir, 'local_regression_overview.json');
const defaultHtmlPath = path.join(outputDir, 'local_regression_overview.html');
const defaultReleaseReadinessJsonPath = path.join(outputDir, 'release_readiness_latest.json');
const defaultReleaseReadinessHtmlPath = path.join(outputDir, 'release_readiness_latest.html');
const defaultWorkflowContractJsonPath = path.join(outputDir, 'n8n_workflow_contract_latest.json');
const defaultWorkflowContractHtmlPath = path.join(outputDir, 'n8n_workflow_contract_latest.html');
const defaultConfigPath = path.join(projectRoot, 'config', 'local_regression.local.json');
const exampleConfigPath = path.join(projectRoot, 'config', 'local_regression.example.json');
const defaultDataSourcesPath = path.join(outputDir, 'data_sources.local.json');
const defaultN8nStatusPath = path.join(outputDir, 'n8n_status_latest.json');
const defaultFreshnessThresholdHours = 24;
const freshnessThresholdEnvVar = 'AI_SELECTION_REGRESSION_FRESHNESS_HOURS';
const expectedDataSourceKeys = [
  'crawlee',
  'manual_inputs',
  'competitor_snapshot',
  'keepa',
  'sp_api',
  'amazon_ads_api',
];
const activeLocalDataSourceKeys = new Set(['crawlee', 'manual_inputs', 'competitor_snapshot']);
const reservedDataSourceKeys = new Set(['keepa', 'sp_api', 'amazon_ads_api']);

const regressionSources = [
  {
    id: 'default',
    title: '默认回归',
    json: 'local_regression_latest.json',
    html: 'local_regression_latest.html',
    role: 'baseline',
    expectedFailure: false,
  },
  {
    id: 'multi_viewport',
    title: '多视口回归',
    json: 'local_regression_multi_viewport.json',
    html: 'local_regression_multi_viewport.html',
    role: 'visual',
    expectedFailure: false,
  },
  {
    id: 'desktop',
    title: '桌面回归',
    json: 'local_regression_desktop.json',
    html: 'local_regression_desktop.html',
    role: 'visual',
    expectedFailure: false,
  },
  {
    id: 'multi_viewport_desktop',
    title: '多视口 + 桌面回归',
    json: 'local_regression_multi_viewport_desktop.json',
    html: 'local_regression_multi_viewport_desktop.html',
    role: 'visual_full',
    expectedFailure: false,
  },
  {
    id: 'strict_cache_fixture',
    title: 'strict-cache 正向样例',
    json: 'local_regression_strict_cache_fixture.json',
    html: 'local_regression_strict_cache_fixture.html',
    role: 'cache_gate',
    expectedFailure: false,
  },
  {
    id: 'strict_cache_empty_expected_fail',
    title: 'strict-cache 空 cache 预期失败',
    json: 'local_regression_strict_cache_empty_expected_fail.json',
    html: 'local_regression_strict_cache_empty_expected_fail.html',
    role: 'negative_fixture',
    expectedFailure: true,
  },
];

const knownRegressionJsonFiles = new Set(regressionSources.map((source) => source.json));

function titleFromRegressionFile(fileName) {
  return fileName
    .replace(/^local_regression_/, '')
    .replace(/\.json$/i, '')
    .split('_')
    .filter(Boolean)
    .map((part) => {
      const map = {
        cache: 'Cache',
        fixture: 'Fixture',
        with: '含',
        desktop: '桌面',
        multi: '多',
        viewport: '视口',
        strict: 'Strict',
        latest: '默认',
      };
      return map[part] || part;
    })
    .join(' ');
}

function shouldIgnoreDiscoveredFile(fileName) {
  if (!/^local_regression_.*\.json$/i.test(fileName)) return '不是本地回归 JSON';
  if (/^local_regression_overview/i.test(fileName)) return '统一总览自身';
  if (knownRegressionJsonFiles.has(fileName)) return '固定清单已包含';
  if (/_test\.json$/i.test(fileName)) return '临时测试文件';
  return '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function discoverRegressionSources() {
  let files = [];
  try {
    files = fs.readdirSync(outputDir).filter((fileName) => /^local_regression_.*\.json$/i.test(fileName)).sort();
  } catch (_) {
    return { sources: regressionSources, discovered: [], ignored: [] };
  }

  const discovered = [];
  const ignored = [];
  for (const fileName of files) {
    const reason = shouldIgnoreDiscoveredFile(fileName);
    if (reason) {
      ignored.push({ file: fileName, reason });
      continue;
    }
    const htmlFile = fileName.replace(/\.json$/i, '.html');
    discovered.push({
      id: fileName.replace(/^local_regression_/, '').replace(/\.json$/i, ''),
      title: titleFromRegressionFile(fileName),
      json: fileName,
      html: htmlFile,
      role: 'auto_discovered',
      expectedFailure: /expected[_-]?fail|negative/i.test(fileName),
      discovered: true,
    });
  }

  return {
    sources: [...regressionSources, ...discovered],
    discovered,
    ignored,
  };
}

function stringOverride(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanOverride(value) {
  return typeof value === 'boolean' ? value : null;
}

function normalizeRegressionOverrideConfig(rawOverrides, options = {}) {
  const strict = options.strict === true;
  const overrides = {};
  const ignored = [];
  const warnings = [];
  const errors = [];
  const issue = (message) => {
    if (strict) errors.push(message);
    else warnings.push(message);
  };
  const ignore = (id, reason) => {
    ignored.push({ id, reason });
    if (strict) errors.push(`regression_overrides.${id || '<empty>'}: ${reason}`);
  };

  if (rawOverrides == null) return { overrides, ignored, warnings, errors };
  if (!isPlainObject(rawOverrides)) {
    issue('regression_overrides 需要是对象，当前值已被忽略。');
    return {
      overrides,
      ignored,
      warnings,
      errors,
    };
  }

  for (const [rawId, rawOverride] of Object.entries(rawOverrides)) {
    const id = String(rawId || '').trim();
    if (!id) {
      ignore(rawId, '覆盖项 id 为空');
      continue;
    }
    if (!isPlainObject(rawOverride)) {
      ignore(id, '覆盖项不是对象');
      continue;
    }

    const override = {};
    const title = stringOverride(rawOverride.title);
    const role = stringOverride(rawOverride.role);
    const expectedFailure = booleanOverride(rawOverride.expected_failure ?? rawOverride.expectedFailure);
    const includeInStatus = booleanOverride(rawOverride.include_in_status ?? rawOverride.includeInStatus);

    if (title) override.title = title;
    else if ('title' in rawOverride && rawOverride.title != null) issue(`${id}.title 需要是非空字符串，已忽略。`);

    if (role) override.role = role;
    else if ('role' in rawOverride && rawOverride.role != null) issue(`${id}.role 需要是非空字符串，已忽略。`);

    if (expectedFailure !== null) override.expectedFailure = expectedFailure;
    else if ('expected_failure' in rawOverride || 'expectedFailure' in rawOverride) {
      issue(`${id}.expected_failure 需要是布尔值，已忽略。`);
    }

    if (includeInStatus !== null) override.includeInStatus = includeInStatus;
    else if ('include_in_status' in rawOverride || 'includeInStatus' in rawOverride) {
      issue(`${id}.include_in_status 需要是布尔值，已忽略。`);
    }

    if ('json' in rawOverride || 'html' in rawOverride || 'json_file' in rawOverride || 'html_file' in rawOverride) {
      issue(`${id} 的 json/html 路径覆盖不被允许，已忽略。`);
    }

    if (Object.keys(override).length) overrides[id] = override;
    else ignore(id, '没有可用覆盖字段');
  }

  return { overrides, ignored, warnings, errors };
}

function readRegressionOverrideConfig(options) {
  const configPath = options.configPath || defaultConfigPath;
  const config = readConfigFile(configPath);
  if (!config.exists) {
    return {
      config_path: configPath,
      source: 'none',
      overrides: {},
      ignored: [],
      warnings: [],
      errors: [],
    };
  }
  if (config.error) {
    return {
      config_path: config.filePath,
      source: 'config',
      overrides: {},
      ignored: [],
      warnings: [],
      errors: [`回归覆盖配置无法解析：${config.error}`],
    };
  }

  const rawOverrides = config.data?.regression_overrides ?? config.data?.discovered_regression_overrides;
  const normalized = normalizeRegressionOverrideConfig(rawOverrides);
  return {
    config_path: config.filePath,
    source: 'config',
    overrides: normalized.overrides,
    ignored: normalized.ignored,
    warnings: normalized.warnings,
    errors: normalized.errors,
  };
}

function applyRegressionOverrides(sourcePlan, overrideConfig) {
  const overrides = overrideConfig.overrides || {};
  const availableIds = new Set(sourcePlan.sources.map((source) => source.id));
  const applied = [];
  const sources = sourcePlan.sources.map((source) => {
    const base = {
      ...source,
      includeInStatus: source.includeInStatus !== false,
      overrideApplied: false,
    };
    const override = overrides[source.id];
    if (!override) return base;

    const next = {
      ...base,
      overrideApplied: true,
    };
    if (override.title) next.title = override.title;
    if (override.role) next.role = override.role;
    if (typeof override.expectedFailure === 'boolean') next.expectedFailure = override.expectedFailure;
    if (typeof override.includeInStatus === 'boolean') next.includeInStatus = override.includeInStatus;

    applied.push({ id: source.id, fields: Object.keys(override) });
    return next;
  });

  const unknown = Object.keys(overrides)
    .filter((id) => !availableIds.has(id))
    .map((id) => ({ id, reason: '未知覆盖 id，当前没有匹配的回归项' }));
  const unknownIds = unknown.map((item) => item.id);
  const unknownWarnings = unknownIds.map((id) => `regression_overrides.${id}: 当前没有匹配的回归项，已作为提示保留但不阻断。`);

  return {
    sources,
    overrideSummary: {
      config_path: overrideConfig.config_path,
      source: overrideConfig.source,
      applied,
      ignored: [...(overrideConfig.ignored || []), ...unknown],
      unknown_ids: unknownIds,
      warnings: [...(overrideConfig.warnings || []), ...unknownWarnings],
      errors: overrideConfig.errors || [],
    },
  };
}

function usage() {
  return [
    'Usage:',
    '  node tools/build_local_regression_overview.mjs',
    '  node tools/build_local_regression_overview.mjs --json <json> --html <html>',
    '  node tools/build_local_regression_overview.mjs --freshness-hours 48',
    '  node tools/build_local_regression_overview.mjs --config config/local_regression.local.json',
    '  node tools/build_local_regression_overview.mjs --data-sources output/amazon_product_analysis/data_sources.local.json',
    '  node tools/build_local_regression_overview.mjs --validate-config',
    '',
    'Reads existing local regression JSON files and writes one combined JSON/HTML overview.',
    'Use --validate-config to check freshness, regression overrides, and data source configuration without writing reports.',
    'It does not run checks, call external APIs, or trigger n8n workflow execution.',
  ].join('\n');
}

function resolveProjectPath(inputPath) {
  if (!inputPath) return inputPath;
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(projectRoot, inputPath);
}

function parseArgs(args) {
  const options = {
    jsonPath: defaultJsonPath,
    htmlPath: defaultHtmlPath,
    configPath: defaultConfigPath,
    dataSourcesPath: defaultDataSourcesPath,
    freshnessHours: null,
    validateConfig: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--json requires a value');
      options.jsonPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--html') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--html requires a value');
      options.htmlPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--config') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--config requires a value');
      options.configPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--data-sources') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--data-sources requires a value');
      options.dataSourcesPath = resolveProjectPath(value);
      index += 1;
    } else if (arg === '--freshness-hours') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--freshness-hours requires a value');
      options.freshnessHours = value;
      index += 1;
    } else if (arg === '--validate-config') {
      options.validateConfig = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parsePositiveHours(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be a positive number`);
  return number;
}

function readConfigFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { exists: false, data: {}, filePath, error: '' };
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return { exists: true, data: JSON.parse(raw), filePath, error: '' };
  } catch (error) {
    return { exists: true, data: {}, filePath, error: error.message };
  }
}

function freshnessRepairSuggestions(configPath) {
  return [
    `确认配置文件是合法 JSON：${configPath}`,
    '把 freshness_threshold_hours 设置为正数，例如 24',
    '确认 regression_overrides 是对象，覆盖项 id 对应 local_regression_<id>.json',
    '覆盖字段只支持 title、role、expected_failure、include_in_status',
    '不要在 regression_overrides 里配置 json/html 路径',
    `临时覆盖可使用环境变量：${freshnessThresholdEnvVar}=24`,
    '也可以临时运行：node tools/build_local_regression_overview.mjs --freshness-hours 24',
  ];
}

function configValidationResult({
  ok,
  thresholdHours,
  source,
  configPath,
  errors = [],
  warnings = [],
  regressionOverrideValidation = null,
}) {
  return {
    ok,
    thresholdHours,
    source,
    configPath,
    envVar: freshnessThresholdEnvVar,
    errors,
    warnings,
    error: errors[0] || '',
    repair_suggestions: ok ? [] : freshnessRepairSuggestions(configPath),
    regression_override_validation: regressionOverrideValidation,
  };
}

function dataSourceRepairSuggestions(filePath) {
  return [
    `确认数据源配置文件存在：${filePath}`,
    '确认 data_sources.local.json 是合法 JSON，根对象包含 sources',
    `sources 至少包含：${expectedDataSourceKeys.join(', ')}`,
    '每个 source 需要提供 label、status、mode 和数字 priority',
    'required_env 如果存在，必须是字符串数组；未接入的 Keepa/SP-API/Ads API 可以保持 not_connected',
  ];
}

function validateRegressionOverridesForConfigData(configData) {
  const rawOverrides = configData?.regression_overrides ?? configData?.discovered_regression_overrides;
  const normalized = normalizeRegressionOverrideConfig(rawOverrides, { strict: true });
  return {
    ok: normalized.errors.length === 0,
    override_count: Object.keys(normalized.overrides).length,
    ignored: normalized.ignored,
    errors: normalized.errors,
    warnings: normalized.warnings,
  };
}

function withRegressionOverrideValidation(validation, configData) {
  const overrideValidation = validateRegressionOverridesForConfigData(configData);
  const errors = [...(validation.errors || []), ...overrideValidation.errors];
  const warnings = [...(validation.warnings || []), ...overrideValidation.warnings];
  const ok = validation.ok && overrideValidation.ok;
  return {
    ...validation,
    ok,
    errors,
    warnings,
    error: errors[0] || '',
    repair_suggestions: ok ? [] : Array.from(new Set([...(validation.repair_suggestions || []), ...freshnessRepairSuggestions(validation.configPath)])),
    regression_override_validation: overrideValidation,
  };
}

function withRegressionOverrideUnknownIdHints(validation) {
  const currentValidation = validation.regression_override_validation;
  if (!currentValidation || !currentValidation.ok) return validation;

  const config = readConfigFile(validation.configPath);
  if (!config.exists || config.error) return validation;

  const rawOverrides = config.data?.regression_overrides ?? config.data?.discovered_regression_overrides;
  const normalized = normalizeRegressionOverrideConfig(rawOverrides, { strict: false });
  const sourcePlan = discoverRegressionSources();
  const knownIds = new Set(sourcePlan.sources.map((source) => source.id));
  const unknownIds = Object.keys(normalized.overrides).filter((id) => !knownIds.has(id));
  if (!unknownIds.length) {
    return {
      ...validation,
      regression_override_validation: {
        ...currentValidation,
        unknown_ids: [],
      },
    };
  }

  const unknownWarnings = unknownIds.map((id) => `regression_overrides.${id}: 当前没有匹配的回归项，已作为提示保留但不阻断。`);
  return {
    ...validation,
    warnings: [...(validation.warnings || []), ...unknownWarnings],
    regression_override_validation: {
      ...currentValidation,
      unknown_ids: unknownIds,
      warnings: [...(currentValidation.warnings || []), ...unknownWarnings],
    },
  };
}

function validateDataSourcesConfig(options) {
  const dataSourcesPath = options.dataSourcesPath || defaultDataSourcesPath;
  const result = readConfigFile(dataSourcesPath);
  const errors = [];
  const warnings = [];

  if (!result.exists) {
    errors.push(`数据源配置文件不存在：${dataSourcesPath}`);
    return {
      ok: false,
      file: dataSourcesPath,
      exists: false,
      configured_source_count: 0,
      usable_source_count: 0,
      reserved_source_count: 0,
      missing_sources: expectedDataSourceKeys,
      extra_sources: [],
      errors,
      warnings,
    };
  }

  if (result.error) {
    errors.push(`数据源配置文件无法解析：${result.error}`);
    return {
      ok: false,
      file: result.filePath,
      exists: true,
      configured_source_count: 0,
      usable_source_count: 0,
      reserved_source_count: 0,
      missing_sources: expectedDataSourceKeys,
      extra_sources: [],
      errors,
      warnings,
    };
  }

  if (!isPlainObject(result.data)) {
    errors.push('数据源配置根节点必须是对象。');
  }

  const sources = isPlainObject(result.data?.sources) ? result.data.sources : {};
  if (!isPlainObject(result.data?.sources)) {
    errors.push('数据源配置需要包含 sources 对象。');
  }

  const configuredKeys = Object.keys(sources).sort();
  const missingSources = expectedDataSourceKeys.filter((key) => !(key in sources));
  const extraSources = configuredKeys.filter((key) => !expectedDataSourceKeys.includes(key));
  for (const key of missingSources) {
    errors.push(`缺少数据源配置：${key}`);
  }
  for (const key of extraSources) {
    warnings.push(`发现额外数据源配置：${key}，当前 V1 总览会保留但不作为必需项。`);
  }

  for (const [key, source] of Object.entries(sources)) {
    if (!isPlainObject(source)) {
      errors.push(`${key}: 配置必须是对象。`);
      continue;
    }

    const label = typeof source.label === 'string' ? source.label.trim() : '';
    const status = typeof source.status === 'string' ? source.status.trim() : '';
    const mode = typeof source.mode === 'string' ? source.mode.trim() : '';
    const priority = Number(source.priority);
    const requiredEnv = source.required_env;

    if (!label) errors.push(`${key}: label 必须是非空字符串。`);
    if (!status) errors.push(`${key}: status 必须是非空字符串。`);
    if (!mode) errors.push(`${key}: mode 必须是非空字符串。`);
    if (!Number.isFinite(priority)) errors.push(`${key}: priority 必须是数字。`);
    if (!source.last_checked_at) warnings.push(`${key}: 建议填写 last_checked_at，方便判断配置新鲜度。`);

    if (requiredEnv != null && (!Array.isArray(requiredEnv) || requiredEnv.some((item) => typeof item !== 'string' || !item.trim()))) {
      errors.push(`${key}: required_env 必须是非空字符串数组。`);
    }

    if (activeLocalDataSourceKeys.has(key)) {
      const allowed = key === 'manual_inputs' ? new Set(['enabled', 'optional']) : new Set(['enabled']);
      if (status && !allowed.has(status)) {
        errors.push(`${key}: V1 本地数据源状态应为 ${[...allowed].join(' 或 ')}，当前是 ${status}。`);
      }
    } else if (reservedDataSourceKeys.has(key)) {
      const allowedReserved = new Set(['not_connected', 'missing_config', 'configured', 'connected', 'enabled']);
      if (status && !allowedReserved.has(status)) {
        errors.push(`${key}: 预留适配器 status 不在允许列表中：${status}。`);
      }
      if (status === 'not_connected' && mode !== 'reserved_adapter') {
        warnings.push(`${key}: not_connected 状态建议使用 reserved_adapter 模式。`);
      }
    }
  }

  const sourceEntries = Object.entries(sources).filter(([, source]) => isPlainObject(source));
  const usableSourceCount = sourceEntries.filter(([key, source]) => activeLocalDataSourceKeys.has(key) && ['enabled', 'optional', 'connected'].includes(source.status)).length;
  const reservedSourceCount = sourceEntries.filter(([key]) => reservedDataSourceKeys.has(key)).length;

  return {
    ok: errors.length === 0,
    file: result.filePath,
    exists: true,
    configured_source_count: configuredKeys.length,
    expected_source_count: expectedDataSourceKeys.length,
    usable_source_count: usableSourceCount,
    reserved_source_count: reservedSourceCount,
    missing_sources: missingSources,
    extra_sources: extraSources,
    errors,
    warnings,
  };
}

function withDataSourceConfigValidation(validation, options) {
  const dataSourceValidation = validateDataSourcesConfig(options);
  const errors = [...(validation.errors || []), ...dataSourceValidation.errors];
  const warnings = [...(validation.warnings || []), ...dataSourceValidation.warnings];
  const ok = validation.ok && dataSourceValidation.ok;
  return {
    ...validation,
    ok,
    errors,
    warnings,
    error: errors[0] || '',
    repair_suggestions: ok
      ? []
      : Array.from(new Set([...(validation.repair_suggestions || []), ...dataSourceRepairSuggestions(dataSourceValidation.file)])),
    data_source_validation: dataSourceValidation,
  };
}

function parseFreshnessHoursForConfig(value, label) {
  try {
    return { ok: true, value: parsePositiveHours(value, label), error: '' };
  } catch (error) {
    return { ok: false, value: defaultFreshnessThresholdHours, error: error.message };
  }
}

function validateFreshnessConfig(options) {
  const configPath = options.configPath || defaultConfigPath;
  if (options.freshnessHours != null) {
    const parsed = parseFreshnessHoursForConfig(options.freshnessHours, '--freshness-hours');
    if (!parsed.ok) {
      return configValidationResult({
        ok: false,
        thresholdHours: defaultFreshnessThresholdHours,
        source: 'default',
        configPath,
        errors: [parsed.error],
      });
    }
    return {
      ok: true,
      thresholdHours: parsed.value,
      source: 'cli',
      configPath,
      envVar: freshnessThresholdEnvVar,
      errors: [],
      warnings: [],
      error: '',
      repair_suggestions: [],
    };
  }

  const envValue = process.env[freshnessThresholdEnvVar];
  if (envValue) {
    const parsed = parseFreshnessHoursForConfig(envValue, freshnessThresholdEnvVar);
    if (!parsed.ok) {
      return configValidationResult({
        ok: false,
        thresholdHours: defaultFreshnessThresholdHours,
        source: 'default',
        configPath,
        errors: [parsed.error],
      });
    }
    return {
      ok: true,
      thresholdHours: parsed.value,
      source: 'env',
      configPath,
      envVar: freshnessThresholdEnvVar,
      errors: [],
      warnings: [],
      error: '',
      repair_suggestions: [],
    };
  }

  const localConfig = readConfigFile(configPath);
  const fallbackConfig = localConfig.exists ? localConfig : readConfigFile(exampleConfigPath);
  if (fallbackConfig.exists && fallbackConfig.error) {
    return configValidationResult({
      ok: false,
      thresholdHours: defaultFreshnessThresholdHours,
      source: 'default',
      configPath: fallbackConfig.filePath,
      errors: [`配置文件无法解析：${fallbackConfig.error}`],
    });
  }

  const configuredHours = fallbackConfig.exists ? fallbackConfig.data?.freshness_threshold_hours : null;
  if (configuredHours != null) {
    const parsed = parseFreshnessHoursForConfig(configuredHours, 'freshness_threshold_hours');
    if (!parsed.ok) {
      return withRegressionOverrideValidation(configValidationResult({
        ok: false,
        thresholdHours: defaultFreshnessThresholdHours,
        source: 'default',
        configPath: fallbackConfig.filePath,
        errors: [parsed.error],
      }), fallbackConfig.data);
    }
    return withRegressionOverrideValidation({
      ok: true,
      thresholdHours: parsed.value,
      source: localConfig.exists ? 'config' : 'example_config',
      configPath: fallbackConfig.filePath,
      envVar: freshnessThresholdEnvVar,
      errors: [],
      warnings: [],
      error: '',
      repair_suggestions: [],
      regression_override_validation: null,
    }, fallbackConfig.data);
  }

  return withRegressionOverrideValidation(configValidationResult({
    ok: true,
    thresholdHours: defaultFreshnessThresholdHours,
    source: 'default',
    configPath,
    warnings: ['未找到 freshness_threshold_hours，已使用默认 24 小时窗口。'],
  }), fallbackConfig.data);
}

function resolveFreshnessConfig(options) {
  return validateLocalConfig(options);
}

function validateLocalConfig(options) {
  return withDataSourceConfigValidation(withRegressionOverrideUnknownIdHints(validateFreshnessConfig(options)), options);
}

function printConfigValidation(validation) {
  console.log(`local regression config: ${validation.ok ? 'OK' : 'ATTENTION'}`);
  console.log(`threshold_hours: ${validation.thresholdHours}`);
  console.log(`source: ${validation.source}`);
  console.log(`config: ${validation.configPath}`);
  console.log(`env_var: ${validation.envVar}`);
  if (validation.regression_override_validation) {
    console.log(
      `regression_overrides: ${validation.regression_override_validation.ok ? 'OK' : 'ATTENTION'} (${validation.regression_override_validation.override_count} item(s))`,
    );
    if (validation.regression_override_validation.unknown_ids?.length) {
      console.log(`regression_overrides_unknown_ids: ${validation.regression_override_validation.unknown_ids.join(', ')}`);
    }
  }
  if (validation.data_source_validation) {
    console.log(
      `data_sources: ${validation.data_source_validation.ok ? 'OK' : 'ATTENTION'} (${validation.data_source_validation.configured_source_count} source(s), ${validation.data_source_validation.usable_source_count} usable, ${validation.data_source_validation.reserved_source_count} reserved)`,
    );
  }
  if (validation.errors?.length) {
    console.log('errors:');
    validation.errors.forEach((error) => console.log(`- ${error}`));
  }
  if (validation.warnings?.length) {
    console.log('warnings:');
    validation.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
  if (validation.repair_suggestions?.length) {
    console.log('repair_suggestions:');
    validation.repair_suggestions.forEach((suggestion) => console.log(`- ${suggestion}`));
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, data: null, mtime: null, bytes: 0, error: '' };
  try {
    const stat = fs.statSync(filePath);
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return { exists: true, data: JSON.parse(raw), mtime: stat.mtime.toISOString(), bytes: stat.size, error: '' };
  } catch (error) {
    return { exists: true, data: null, mtime: null, bytes: 0, error: error.message };
  }
}

function levelForDataSource(source) {
  if (!source) return 'warn';
  if (['enabled', 'optional', 'connected'].includes(source.status)) return 'ok';
  if (source.status === 'not_connected' && source.mode === 'reserved_adapter') return 'info';
  return 'warn';
}

function summarizeDataSources(dataSourcesPath = defaultDataSourcesPath) {
  const result = readJsonIfExists(dataSourcesPath);
  if (!result.exists) {
    return {
      ok: false,
      status: '未找到',
      status_class: 'warn',
      file: dataSourcesPath,
      exists: false,
      updated_at: null,
      last_checked_at: null,
      owner_notes: '',
      counts: { total: 0, usable: 0, reserved: 0, attention: 1 },
      sources: [],
      message: '未找到数据源配置文件，数据源健康摘要不可用。',
    };
  }
  if (!result.data) {
    return {
      ok: false,
      status: '读取失败',
      status_class: 'warn',
      file: dataSourcesPath,
      exists: true,
      updated_at: result.mtime,
      last_checked_at: null,
      owner_notes: '',
      counts: { total: 0, usable: 0, reserved: 0, attention: 1 },
      sources: [],
      error: result.error,
      message: `数据源配置文件无法解析：${result.error}`,
    };
  }

  const entries = Object.entries(result.data.sources || {})
    .map(([key, source]) => ({
      key,
      label: source.label || key,
      status: source.status || 'unknown',
      mode: source.mode || '',
      priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 999,
      level: levelForDataSource(source),
      last_checked_at: source.last_checked_at || null,
      owner_notes: source.owner_notes || '',
    }))
    .sort((left, right) => left.priority - right.priority || left.key.localeCompare(right.key));

  const usable = entries.filter((source) => source.level === 'ok').length;
  const reserved = entries.filter((source) => source.level === 'info').length;
  const attention = entries.filter((source) => source.level === 'warn').length;
  return {
    ok: attention === 0,
    status: attention === 0 ? '正常' : '需关注',
    status_class: attention === 0 ? 'ok' : 'warn',
    file: dataSourcesPath,
    exists: true,
    updated_at: result.data.updated_at || result.mtime,
    last_checked_at: result.data.last_checked_at || null,
    owner_notes: result.data.owner_notes || '',
    counts: {
      total: entries.length,
      usable,
      reserved,
      attention,
    },
    sources: entries,
    message:
      attention === 0
        ? `V1 可用数据源 ${usable} 个，预留未接入 ${reserved} 个。`
        : `有 ${attention} 个数据源配置需要关注。`,
  };
}

function summarizeN8nStatus(statusPath = defaultN8nStatusPath) {
  const result = readJsonIfExists(statusPath);
  if (!result.exists) {
    return {
      ok: true,
      status: '未检查',
      status_class: 'muted',
      file: statusPath,
      exists: false,
      generated_at: null,
      message: '尚未生成 n8n 状态文件，运行 node tools/check_n8n_status.mjs 后会显示授权状态。',
      facts: {
        n8n_page: '未检查',
        n8n_api: '未检查',
        crawler: '未检查',
        workflow_id: '暂无',
      },
      api_key_present: false,
      api_key_source: 'none',
      api_key_rejected: false,
      stored_credential_present: false,
      credential_path: '',
      next_actions: ['运行：node tools/check_n8n_status.mjs'],
    };
  }
  if (!result.data) {
    return {
      ok: false,
      status: '读取失败',
      status_class: 'warn',
      file: statusPath,
      exists: true,
      generated_at: result.mtime,
      message: `n8n 状态文件无法解析：${result.error}`,
      facts: {
        n8n_page: '读取失败',
        n8n_api: '读取失败',
        crawler: '读取失败',
        workflow_id: '暂无',
      },
      api_key_present: false,
      api_key_source: 'none',
      api_key_rejected: false,
      stored_credential_present: false,
      credential_path: '',
      next_actions: ['重新运行：node tools/check_n8n_status.mjs'],
    };
  }

  const checks = result.data.checks || {};
  const n8nRoot = checks.n8n_root || {};
  const n8nApi = checks.n8n_workflow_api || {};
  const crawler = checks.crawler_health || {};
  return {
    ok: result.data.service_ok !== false,
    authorization_ok: result.data.authorization_ok === true,
    status: result.data.status || '暂无',
    status_class: result.data.status_class || (result.data.authorization_ok ? 'ok' : 'warn'),
    file: statusPath,
    exists: true,
    generated_at: result.data.generated_at || result.mtime,
    n8n_url: result.data.n8n_url || '',
    workflow_id: result.data.workflow_id || '',
    api_key_present: result.data.api_key_present === true,
    api_key_source: result.data.api_key_source || 'none',
    api_key_rejected: result.data.api_key_rejected === true,
    stored_credential_present: result.data.stored_credential_present === true,
    credential_path: result.data.credential_path || '',
    message: result.data.message || '暂无 n8n 状态摘要。',
    facts: {
      n8n_page: n8nRoot.ok ? `HTTP ${n8nRoot.status_code}` : n8nRoot.error || '异常',
      n8n_api: n8nApi.status_label || (n8nApi.ok ? `HTTP ${n8nApi.status_code}` : n8nApi.error || '异常'),
      crawler: crawler.ok ? `HTTP ${crawler.status_code}` : crawler.error || '异常',
      workflow_id: result.data.workflow_id || '暂无',
    },
    next_actions: Array.isArray(result.data.next_actions) ? result.data.next_actions : [],
  };
}

function fileInfo(fileName) {
  const filePath = path.join(outputDir, fileName);
  if (!fs.existsSync(filePath)) return { exists: false, file: fileName, mtime: null, bytes: 0 };
  const stat = fs.statSync(filePath);
  return { exists: true, file: fileName, mtime: stat.mtime.toISOString(), bytes: stat.size };
}

function statusFor(source, result) {
  if (!result.exists) return { text: '未生成', ok: source.expectedFailure ? true : false, className: 'muted' };
  if (!result.data) return { text: '读取失败', ok: false, className: 'fail' };
  if (source.expectedFailure) {
    return result.data.ok === false
      ? { text: '预期失败', ok: true, className: 'skip' }
      : { text: '预期失败未触发', ok: false, className: 'fail' };
  }
  return result.data.ok
    ? { text: '通过', ok: true, className: 'ok' }
    : { text: '失败', ok: false, className: 'fail' };
}

function formatViewports(data) {
  if (Array.isArray(data?.mobile_viewports) && data.mobile_viewports.length) {
    return data.mobile_viewports.map((width) => `${width}px`).join(' / ');
  }
  return '暂无';
}

function formatDesktop(data) {
  return data?.desktop_check && data.desktop_width ? `${data.desktop_width}px` : '未检查';
}

function cacheSummary(data) {
  const step = Array.isArray(data?.steps) ? data.steps.find((item) => item.id === 'adapter_cache') : null;
  if (!step) return '未检查';
  if (step.skipped) return '跳过';
  if (step.ok) return data.strict_cache ? '严格通过' : '通过';
  return data.strict_cache ? '严格失败' : '失败';
}

function stepStatus(data, stepId) {
  const step = Array.isArray(data?.steps) ? data.steps.find((item) => item.id === stepId) : null;
  if (!step) return { checked: false, ok: false, skipped: false, status: '未检查' };
  if (step.skipped) return { checked: true, ok: true, skipped: true, status: '跳过' };
  return { checked: true, ok: step.ok === true, skipped: false, status: step.ok ? '通过' : '失败' };
}

function freshnessForTimestamp(timestampText, exists, thresholdHours) {
  if (!exists) {
    return {
      status: '未生成',
      status_class: 'muted',
      is_stale: false,
      age_hours: null,
      stale_after: '暂无数据',
      message: '这项回归还没有生成，排查时需要先运行对应检查。',
    };
  }
  const timestamp = Date.parse(timestampText);
  if (!Number.isFinite(timestamp)) {
    return {
      status: '时间异常',
      status_class: 'warn',
      is_stale: true,
      age_hours: null,
      stale_after: '暂无数据',
      message: '这项回归的生成时间无法识别，建议重新运行本地回归。',
    };
  }
  const ageHours = (Date.now() - timestamp) / 36e5;
  const staleAfter = new Date(timestamp + thresholdHours * 36e5).toISOString();
  if (ageHours > thresholdHours) {
    return {
      status: '需重跑',
      status_class: 'warn',
      is_stale: true,
      age_hours: Number(ageHours.toFixed(2)),
      stale_after: staleAfter,
      message: `这项回归已经超过 ${thresholdHours} 小时，建议重新运行本地回归。`,
    };
  }
  return {
    status: '新鲜',
    status_class: 'ok',
    is_stale: false,
    age_hours: Number(Math.max(0, ageHours).toFixed(2)),
    stale_after: staleAfter,
    message: `这项回归在 ${thresholdHours} 小时窗口内，可以继续参考。`,
  };
}

function overviewFreshness(runs, generatedAt, thresholdHours) {
  const generatedRuns = runs.filter((run) => run.json_exists);
  const staleRuns = generatedRuns.filter((run) => run.freshness?.is_stale);
  const missingRuns = runs.filter((run) => !run.json_exists);
  const staleAfterValues = generatedRuns
    .map((run) => run.freshness?.stale_after)
    .filter((value) => value && value !== '暂无数据')
    .sort();
  if (!generatedRuns.length) {
    return {
      status: '未生成',
      status_class: 'muted',
      threshold_hours: thresholdHours,
      last_refreshed_at: generatedAt,
      fresh_until: '暂无数据',
      stale_run_count: 0,
      missing_run_count: missingRuns.length,
      message: '还没有任何本地回归结果，先运行一键本地回归。',
    };
  }
  if (staleRuns.length) {
    return {
      status: '需重跑',
      status_class: 'warn',
      threshold_hours: thresholdHours,
      last_refreshed_at: generatedAt,
      fresh_until: staleAfterValues[0] || '暂无数据',
      stale_run_count: staleRuns.length,
      missing_run_count: missingRuns.length,
      message: `有 ${staleRuns.length} 项回归超过 ${thresholdHours} 小时，建议重新运行一键本地回归后再判断系统状态。`,
    };
  }
  return {
    status: '新鲜',
    status_class: 'ok',
    threshold_hours: thresholdHours,
    last_refreshed_at: generatedAt,
    fresh_until: staleAfterValues[0] || '暂无数据',
    stale_run_count: 0,
    missing_run_count: missingRuns.length,
    message:
      missingRuns.length > 0
        ? `已生成的回归都在 ${thresholdHours} 小时窗口内，但还有 ${missingRuns.length} 项未生成。`
        : `全部回归都在 ${thresholdHours} 小时窗口内，可以继续参考。`,
  };
}

function operationalReadinessSummary({ failingRuns, freshness, n8nStatus, dataSourceHealth, gitStatus, defaultRun }) {
  const issues = [];
  const confirmations = [];
  const overviewLayout = defaultRun?.overview_layout_checks || {};

  if (failingRuns.length) issues.push(`有 ${failingRuns.length} 项计入总状态的回归需要关注`);
  else confirmations.push('回归总状态通过');

  if (freshness?.status_class === 'ok') confirmations.push('回归结果仍在新鲜度窗口内');
  else issues.push(`回归新鲜度为 ${freshness?.status || '暂无'}`);

  if (n8nStatus?.ok === false) issues.push(`n8n 服务状态为 ${n8nStatus.status || '异常'}`);
  else confirmations.push('n8n 页面和本地爬虫可用');

  if (n8nStatus?.authorization_ok === true) confirmations.push('n8n API 已授权');
  else issues.push('n8n API 未授权或未检查');

  if (dataSourceHealth?.ok === false) issues.push(`数据源健康为 ${dataSourceHealth.status || '需关注'}`);
  else confirmations.push('数据源配置健康');

  if (gitStatus?.ok === false) issues.push(`GitHub 同步状态为 ${gitStatus.status || '需关注'}`);
  else if (gitStatus?.status === '已同步') confirmations.push('GitHub 远端已同步');

  if (overviewLayout.mobile?.ok) confirmations.push('统一回归总览移动端布局通过');
  else issues.push('统一回归总览移动端布局未通过或未检查');

  if (defaultRun?.desktop_width_text && defaultRun.desktop_width_text !== '未检查') {
    if (overviewLayout.desktop?.ok) confirmations.push('统一回归总览桌面布局通过');
    else issues.push('统一回归总览桌面布局未通过或未检查');
  }

  return {
    ok: issues.length === 0,
    status: issues.length === 0 ? '可继续使用' : '需关注',
    status_class: issues.length === 0 ? 'ok' : 'warn',
    message:
      issues.length === 0
        ? '本地回归、n8n 授权、数据源配置和总览布局均可参考，可以继续使用当前 V1.0 流程。'
        : '存在需要处理的运维项，建议先按下方问题修复后再用结果做选品决策。',
    confirmations,
    issues,
  };
}

function rerunCommands() {
  return [
    {
      id: 'default_regression',
      label: '一键回归',
      command: 'node tools/run_local_regression_checks.mjs',
      when: '日常改完模板或脚本后先跑这一项。',
    },
    {
      id: 'config_check',
      label: '只校验配置',
      command: 'node tools/build_local_regression_overview.mjs --validate-config',
      when: '调整 local_regression.local.json 或新鲜度窗口后使用。',
    },
    {
      id: 'refresh_overview',
      label: '只刷新本页',
      command: 'node tools/build_local_regression_overview.mjs',
      when: '已有回归结果，只想更新统一总览时使用。',
    },
    {
      id: 'multi_viewport',
      label: '多视口回归',
      command: 'node tools/run_local_regression_checks.mjs --multi-viewport',
      when: '改动移动端布局、卡片密度或断点后使用。',
    },
    {
      id: 'desktop_regression',
      label: '桌面回归',
      command: 'node tools/run_local_regression_checks.mjs --desktop',
      when: '改动桌面看板、表格或宽屏布局后使用。',
    },
    {
      id: 'strict_cache',
      label: '严格 cache 回归',
      command: 'node tools/run_local_regression_checks.mjs --strict-cache',
      when: '排查缓存新鲜度、adapter cache 或数据源兜底时使用。',
    },
    {
      id: 'release_readiness',
      label: '可演示状态',
      command: 'node tools/check_release_readiness.mjs',
      when: '演示、交付或发给他人前，用来快速判断当前系统能否继续使用。',
    },
    {
      id: 'n8n_workflow_contract',
      label: 'n8n 合同检查',
      command: 'node tools/check_n8n_workflow_contract.mjs',
      when: '更新 n8n 节点、Webhook 或自动触发入口前，确认 live 工作流结构仍符合 V1.0。',
    },
  ];
}

function buildOverview(options) {
  const generatedAt = new Date().toISOString();
  const freshnessConfig = resolveFreshnessConfig(options);
  const freshnessThresholdHours = freshnessConfig.thresholdHours;
  const dataSourcesPath = options.dataSourcesPath || defaultDataSourcesPath;
  const sourcePlan = discoverRegressionSources();
  const overrideConfig = readRegressionOverrideConfig(options);
  const overriddenPlan = applyRegressionOverrides(sourcePlan, overrideConfig);
  const runs = overriddenPlan.sources.map((source) => {
    const jsonPath = path.join(outputDir, source.json);
    const result = readJsonIfExists(jsonPath);
    const status = statusFor(source, result);
    const data = result.data || {};
    const statusCounted = source.includeInStatus !== false;
    return {
      id: source.id,
      title: source.title,
      role: source.role,
      expected_failure: source.expectedFailure,
      status_counted: statusCounted,
      override_applied: source.overrideApplied === true,
      discovered: source.discovered === true,
      status: status.text,
      status_ok: status.ok,
      status_class: status.className,
      json_file: source.json,
      html_file: source.html,
      json_exists: result.exists,
      html_exists: fileInfo(source.html).exists,
      generated_at: data.generated_at || result.mtime || '暂无数据',
      freshness: freshnessForTimestamp(data.generated_at || result.mtime || '', result.exists, freshnessThresholdHours),
      counts: data.counts || { total: 0, passed: 0, skipped: 0, failed: 0 },
      mobile_viewports_text: formatViewports(data),
      desktop_width_text: formatDesktop(data),
      strict_cache: data.strict_cache === true,
      cache_status: cacheSummary(data),
      overview_layout_checks: {
        mobile: stepStatus(data, 'local_regression_overview_mobile_layout'),
        desktop: stepStatus(data, 'local_regression_overview_desktop_layout'),
      },
      error: result.error,
    };
  });

  const relevantRuns = runs.filter((run) => run.json_exists);
  const statusRuns = runs.filter((run) => run.status_counted !== false);
  const failingRuns = statusRuns.filter((run) => !run.status_ok);
  const discoveredRuns = overriddenPlan.sources.filter((source) => source.discovered === true);
  const unknownOverrideCount = Array.isArray(overriddenPlan.overrideSummary?.unknown_ids)
    ? overriddenPlan.overrideSummary.unknown_ids.length
    : 0;
  const dataSourceHealthSummary = summarizeDataSources(dataSourcesPath);
  const n8nStatusSummary = summarizeN8nStatus(defaultN8nStatusPath);
  const gitStatusSummary = summarizeGitStatus();
  const freshness = overviewFreshness(runs, generatedAt, freshnessThresholdHours);
  const defaultRun = runs.find((run) => run.id === 'default') || null;
  const operationalReadiness = operationalReadinessSummary({
    failingRuns,
    freshness,
    n8nStatus: n8nStatusSummary,
    dataSourceHealth: dataSourceHealthSummary,
    gitStatus: gitStatusSummary,
    defaultRun,
  });
  return {
    ok: failingRuns.length === 0,
    generated_at: generatedAt,
    project_root: projectRoot,
    command_working_directory: projectRoot,
    local_regression_config_path: freshnessConfig.configPath,
    data_source_config_path: dataSourcesPath,
    data_source_config_exists: fs.existsSync(dataSourcesPath),
    data_source_health_summary: dataSourceHealthSummary,
    n8n_status_path: defaultN8nStatusPath,
    n8n_status_summary: n8nStatusSummary,
    git_status_summary: gitStatusSummary,
    operational_readiness: operationalReadiness,
    output_dir: outputDir,
    summary_path: defaultJsonPath,
    html_report_path: defaultHtmlPath,
    release_readiness_json_path: defaultReleaseReadinessJsonPath,
    release_readiness_html_path: defaultReleaseReadinessHtmlPath,
    n8n_workflow_contract_json_path: defaultWorkflowContractJsonPath,
    n8n_workflow_contract_html_path: defaultWorkflowContractHtmlPath,
    counts: {
      configured: runs.length,
      status_counted: statusRuns.length,
      generated: relevantRuns.length,
      ok: statusRuns.filter((run) => run.status_ok && run.json_exists).length,
      attention: failingRuns.length,
      discovered: discoveredRuns.length,
      excluded_from_status: runs.length - statusRuns.length,
      unknown_overrides: unknownOverrideCount,
    },
    freshness,
    freshness_config: freshnessConfig,
    regression_overrides: overriddenPlan.overrideSummary,
    rerun_commands: rerunCommands(),
    discovery: {
      enabled: true,
      discovered: discoveredRuns.map((source) => ({
        id: source.id,
        title: source.title,
        role: source.role,
        expected_failure: source.expectedFailure,
        include_in_status: source.includeInStatus !== false,
        override_applied: source.overrideApplied === true,
        json_file: source.json,
        html_file: source.html,
      })),
      ignored: sourcePlan.ignored,
    },
    runs,
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

function n8nCredentialSourceLabel(status) {
  const source = status?.api_key_source || 'none';
  if (source === 'saved_windows_credential') return '已保存 Windows 凭据';
  if (source === 'N8N_API_KEY') return '环境变量 N8N_API_KEY';
  return status?.api_key_present ? source : '未配置';
}

function n8nCredentialStateLabel(status) {
  if (status?.api_key_rejected) return 'Key 被拒绝';
  if (status?.authorization_ok) return '可用';
  if (status?.api_key_present) return '未通过';
  return '未配置';
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function sanitizeRemoteUrl(value) {
  return String(value || '').replace(/^(https?:\/\/)([^/@\s]+)@/i, '$1***@');
}

function summarizeGitStatus() {
  const inside = runGit(['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || inside.stdout !== 'true') {
    return {
      ok: true,
      status: '未启用',
      status_class: 'muted',
      message: '当前目录不是 Git 工作区，无法展示 GitHub 同步状态。',
      branch: '暂无',
      upstream: '暂无',
      remote_url: '',
      local_commit: '',
      remote_commit: '',
      ahead: 0,
      behind: 0,
      dirty_tracked_count: 0,
      untracked_count: 0,
      untracked_preview: [],
    };
  }

  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || 'HEAD';
  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const remoteUrl = runGit(['remote', 'get-url', 'origin']);
  const localCommit = runGit(['rev-parse', '--short', 'HEAD']).stdout || '';
  const porcelain = runGit(['status', '--porcelain']);
  const statusLines = porcelain.ok && porcelain.stdout ? porcelain.stdout.split(/\r?\n/).filter(Boolean) : [];
  const untracked = statusLines.filter((line) => line.startsWith('??')).map((line) => line.slice(3).trim());
  const dirtyTracked = statusLines.filter((line) => !line.startsWith('??'));

  if (!upstream.ok) {
    return {
      ok: false,
      status: '未绑定远端',
      status_class: 'warn',
      message: '当前分支没有 upstream，无法判断是否已推送到 GitHub。',
      branch,
      upstream: '暂无',
      remote_url: sanitizeRemoteUrl(remoteUrl.stdout),
      local_commit: localCommit,
      remote_commit: '',
      ahead: 0,
      behind: 0,
      dirty_tracked_count: dirtyTracked.length,
      untracked_count: untracked.length,
      untracked_preview: untracked.slice(0, 5),
    };
  }

  const remoteCommit = runGit(['rev-parse', '--short', '@{u}']).stdout || '';
  const aheadBehind = runGit(['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
  const [aheadText, behindText] = aheadBehind.stdout.split(/\s+/);
  const ahead = Number.parseInt(aheadText, 10) || 0;
  const behind = Number.parseInt(behindText, 10) || 0;
  const hasTrackedChanges = dirtyTracked.length > 0;
  const ok = ahead === 0 && behind === 0 && !hasTrackedChanges;
  let status = '已同步';
  let message = '本地 HEAD 已和远端 upstream 同步。';
  if (ahead > 0 && behind > 0) {
    status = '分支分叉';
    message = `本地领先 ${ahead} 个提交，同时落后远端 ${behind} 个提交，需要先同步分支。`;
  } else if (ahead > 0) {
    status = '待推送';
    message = `本地还有 ${ahead} 个提交未推送到 GitHub。`;
  } else if (behind > 0) {
    status = '需拉取';
    message = `远端有 ${behind} 个提交本地尚未同步。`;
  } else if (hasTrackedChanges) {
    status = '有本地改动';
    message = `有 ${dirtyTracked.length} 个已跟踪文件存在未提交改动。`;
  } else if (untracked.length > 0) {
    message = `本地与远端提交一致；另有 ${untracked.length} 个未跟踪项未纳入同步判断。`;
  }

  return {
    ok,
    status,
    status_class: ok ? 'ok' : 'warn',
    message,
    branch,
    upstream: upstream.stdout,
    remote_url: sanitizeRemoteUrl(remoteUrl.stdout),
    local_commit: localCommit,
    remote_commit: remoteCommit,
    ahead,
    behind,
    dirty_tracked_count: dirtyTracked.length,
    untracked_count: untracked.length,
    untracked_preview: untracked.slice(0, 5),
  };
}

function renderHtml(overview) {
  const freshness = overview.freshness || {};
  const config = overview.freshness_config || {};
  const overrideConfig = overview.regression_overrides || {};
  const commands = Array.isArray(overview.rerun_commands) ? overview.rerun_commands : [];
  const commandWorkingDirectory = overview.command_working_directory || overview.project_root || projectRoot;
  const localRegressionConfigPath = overview.local_regression_config_path || config.configPath || defaultConfigPath;
  const dataSourceConfigPath = overview.data_source_config_path || defaultDataSourcesPath;
  const releaseReadinessHtmlPath = overview.release_readiness_html_path || defaultReleaseReadinessHtmlPath;
  const releaseReadinessJsonPath = overview.release_readiness_json_path || defaultReleaseReadinessJsonPath;
  const workflowContractHtmlPath = overview.n8n_workflow_contract_html_path || defaultWorkflowContractHtmlPath;
  const workflowContractJsonPath = overview.n8n_workflow_contract_json_path || defaultWorkflowContractJsonPath;
  const dataSourceConfigMissing = overview.data_source_config_exists === false;
  const dataSourceHealth = overview.data_source_health_summary || null;
  const dataSourceValidation = config.data_source_validation || null;
  const n8nStatus = overview.n8n_status_summary || null;
  const gitStatus = overview.git_status_summary || null;
  const operationalReadiness = overview.operational_readiness || null;
  const n8nStatusPath = overview.n8n_status_path || defaultN8nStatusPath;
  const dataSourceMessages = [
    ...(Array.isArray(dataSourceValidation?.errors) ? dataSourceValidation.errors : []),
    ...(Array.isArray(dataSourceValidation?.warnings) ? dataSourceValidation.warnings : []),
  ];
  const hasDataSourceProblems =
    dataSourceValidation?.ok === false ||
    dataSourceHealth?.ok === false ||
    Number(dataSourceHealth?.counts?.attention || 0) > 0 ||
    dataSourceConfigMissing;
  const dataSourceActionPanel = hasDataSourceProblems
    ? `
      <div class="source-actions" aria-label="数据源异常处理">
        <article class="source-action">
          <strong>1. 校验配置</strong>
          <code>node tools/build_local_regression_overview.mjs --validate-config</code>
          <p>先确认数据源结构、必需项和字段类型。</p>
        </article>
        <article class="source-action">
          <strong>2. 检查展示</strong>
          <code>node tools/adapters/check_data_source_health.mjs</code>
          <p>确认最新报告是否正确展示数据源详情。</p>
        </article>
        <article class="source-action">
          <strong>3. 重跑回归</strong>
          <code>node tools/run_local_regression_checks.mjs</code>
          <p>修复配置后刷新总览和移动端检查。</p>
        </article>
      </div>`
    : '';
  const appliedOverrides = Array.isArray(overrideConfig.applied) ? overrideConfig.applied : [];
  const ignoredOverrides = Array.isArray(overrideConfig.ignored) ? overrideConfig.ignored : [];
  const unknownOverrideIds = Array.isArray(overrideConfig.unknown_ids) ? overrideConfig.unknown_ids : [];
  const configMessages = [
    ...(Array.isArray(config.errors) ? config.errors : []),
    ...(Array.isArray(config.warnings) ? config.warnings : []),
    ...(Array.isArray(overrideConfig.errors) ? overrideConfig.errors : []),
    ...(Array.isArray(overrideConfig.warnings) ? overrideConfig.warnings : []),
  ];
  const hasConfigProblems = config.ok === false || (Array.isArray(overrideConfig.errors) && overrideConfig.errors.length > 0);
  const configNotice =
    configMessages.length || config.ok === false || appliedOverrides.length || ignoredOverrides.length || unknownOverrideIds.length
      ? `
    <section class="config-alert ${hasConfigProblems ? 'warn' : 'muted'}" aria-label="回归配置提示">
      <strong>${hasConfigProblems ? '配置需要修复' : '配置提示'}</strong>
      <p>当前来源：${htmlEscape(config.source || 'default')}；有效窗口：${htmlEscape(config.thresholdHours || defaultFreshnessThresholdHours)} 小时。</p>
      ${appliedOverrides.length ? `<p>回归覆盖：已应用 ${htmlEscape(appliedOverrides.length)} 项（${htmlEscape(appliedOverrides.map((item) => item.id).join(' / '))}）。</p>` : ''}
      ${unknownOverrideIds.length ? `<p>未知覆盖 id：${htmlEscape(unknownOverrideIds.join(' / '))}。不会阻断回归，但当前没有匹配的回归结果。</p>` : ''}
      ${ignoredOverrides.length ? `<p>忽略覆盖：${htmlEscape(ignoredOverrides.map((item) => `${item.id}: ${item.reason}`).join('；'))}</p>` : ''}
      ${configMessages.map((message) => `<p>${htmlEscape(message)}</p>`).join('')}
      ${
        Array.isArray(config.repair_suggestions) && config.repair_suggestions.length
          ? `<ul>${config.repair_suggestions.map((suggestion) => `<li>${htmlEscape(suggestion)}</li>`).join('')}</ul>`
          : ''
      }
    </section>`
      : '';
  const commandPanel = commands.length
    ? `
    <section class="command-panel" aria-label="重跑命令">
      <div class="command-head">
        <strong>重跑命令</strong>
        <span>先进入工作目录，再执行对应命令。</span>
      </div>
      <div class="command-cwd">
        <span>工作目录</span>
        <code>${htmlEscape(commandWorkingDirectory)}</code>
      </div>
      <div class="command-cwd command-config-path">
        <span>回归配置</span>
        <code>${htmlEscape(localRegressionConfigPath)}</code>
      </div>
      <div class="command-cwd command-data-source-path ${dataSourceConfigMissing ? 'warn' : ''}">
        <span>数据源配置</span>
        <code>${htmlEscape(dataSourceConfigPath)}${dataSourceConfigMissing ? '（未找到）' : ''}</code>
      </div>
      <div class="command-cwd command-release-path">
        <span>短报告 HTML</span>
        <code>${htmlEscape(releaseReadinessHtmlPath)}</code>
      </div>
      <div class="command-cwd command-release-json-path">
        <span>短报告 JSON</span>
        <code>${htmlEscape(releaseReadinessJsonPath)}</code>
      </div>
      <div class="command-cwd command-workflow-contract-path">
        <span>n8n合同 HTML</span>
        <code>${htmlEscape(workflowContractHtmlPath)}</code>
      </div>
      <div class="command-cwd command-workflow-contract-json-path">
        <span>n8n合同 JSON</span>
        <code>${htmlEscape(workflowContractJsonPath)}</code>
      </div>
      <div class="command-grid">
        ${commands
          .map(
            (item) => `
          <article class="command-item">
            <strong>${htmlEscape(item.label)}</strong>
            <code>${htmlEscape(item.command)}</code>
            <p>${htmlEscape(item.when)}</p>
          </article>`,
          )
          .join('')}
      </div>
    </section>`
    : '';
  const n8nPanel = n8nStatus
    ? `
    <section class="service-health ${htmlEscape(n8nStatus.status_class || 'muted')}" aria-label="n8n 服务状态">
      <div class="service-head">
        <div>
          <strong>n8n 服务状态</strong>
          <p>${htmlEscape(n8nStatus.message || '暂无 n8n 状态摘要。')}</p>
        </div>
        <b>${htmlEscape(n8nStatus.status || '暂无')}</b>
      </div>
      <div class="service-facts">
        <span>页面 ${htmlEscape(n8nStatus.facts?.n8n_page || '暂无')}</span>
        <span>API ${htmlEscape(n8nStatus.facts?.n8n_api || '暂无')}</span>
        <span>爬虫 ${htmlEscape(n8nStatus.facts?.crawler || '暂无')}</span>
        <span>工作流 ${htmlEscape(n8nStatus.facts?.workflow_id || '暂无')}</span>
        <span>授权来源 ${htmlEscape(n8nCredentialSourceLabel(n8nStatus))}</span>
        <span>保存凭据 ${htmlEscape(n8nStatus.stored_credential_present ? '已检测' : '未检测')}</span>
        <span>Key 状态 ${htmlEscape(n8nCredentialStateLabel(n8nStatus))}</span>
      </div>
      ${
        n8nStatus.credential_path
          ? `<div class="command-cwd service-status-path">
              <span>凭据位置</span>
              <code>${htmlEscape(n8nStatus.credential_path)}</code>
            </div>`
          : ''
      }
      <div class="command-cwd service-status-path">
        <span>状态文件</span>
        <code>${htmlEscape(n8nStatusPath)}</code>
      </div>
      ${
        Array.isArray(n8nStatus.next_actions) && n8nStatus.next_actions.length
          ? `<div class="service-actions">
              ${n8nStatus.next_actions
                .map(
                  (action, index) => `
                <article class="service-action">
                  <strong>${htmlEscape(index + 1)}. 下一步</strong>
                  <p>${htmlEscape(action)}</p>
                </article>`,
                )
                .join('')}
            </div>`
          : ''
      }
    </section>`
    : '';
  const gitPanel = gitStatus
    ? `
    <section class="git-health ${htmlEscape(gitStatus.status_class || 'muted')}" aria-label="GitHub 同步状态">
      <div class="git-head">
        <div>
          <strong>GitHub 同步</strong>
          <p>${htmlEscape(gitStatus.message || '暂无 GitHub 同步状态。')}</p>
        </div>
        <b>${htmlEscape(gitStatus.status || '暂无')}</b>
      </div>
      <div class="git-facts">
        <span>分支 ${htmlEscape(gitStatus.branch || '暂无')}</span>
        <span>远端 ${htmlEscape(gitStatus.upstream || '暂无')}</span>
        <span>本地 ${htmlEscape(gitStatus.local_commit || '暂无')}</span>
        <span>远端提交 ${htmlEscape(gitStatus.remote_commit || '暂无')}</span>
        <span>待推送 ${htmlEscape(gitStatus.ahead ?? 0)}</span>
        <span>待拉取 ${htmlEscape(gitStatus.behind ?? 0)}</span>
        <span>未提交 ${htmlEscape(gitStatus.dirty_tracked_count ?? 0)}</span>
        <span>未跟踪 ${htmlEscape(gitStatus.untracked_count ?? 0)}</span>
      </div>
      ${
        gitStatus.remote_url
          ? `<div class="command-cwd git-remote-path">
              <span>仓库</span>
              <code>${htmlEscape(gitStatus.remote_url)}</code>
            </div>`
          : ''
      }
      ${
        Array.isArray(gitStatus.untracked_preview) && gitStatus.untracked_preview.length
          ? `<p class="git-note">未跟踪示例：${htmlEscape(gitStatus.untracked_preview.join(' / '))}</p>`
          : ''
      }
    </section>`
    : '';
  const operationalPanel = operationalReadiness
    ? `
    <section class="ops-readiness ${htmlEscape(operationalReadiness.status_class || 'muted')}" aria-label="运维可用结论">
      <div class="ops-head">
        <div>
          <strong>运维结论</strong>
          <p>${htmlEscape(operationalReadiness.message || '暂无运维结论。')}</p>
        </div>
        <b>${htmlEscape(operationalReadiness.status || '暂无')}</b>
      </div>
      ${
        Array.isArray(operationalReadiness.confirmations) && operationalReadiness.confirmations.length
          ? `<div class="ops-facts">
              ${operationalReadiness.confirmations.map((item) => `<span>${htmlEscape(item)}</span>`).join('')}
            </div>`
          : ''
      }
      ${
        Array.isArray(operationalReadiness.issues) && operationalReadiness.issues.length
          ? `<ul class="ops-issues">${operationalReadiness.issues.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul>`
          : ''
      }
    </section>`
    : '';
  const dataSourcePanel = dataSourceHealth
    ? `
    <section class="source-health ${htmlEscape(dataSourceHealth.status_class || 'muted')}" aria-label="数据源健康摘要">
      <div class="source-head">
        <div>
          <strong>数据源健康</strong>
          <p>${htmlEscape(dataSourceHealth.message || '暂无数据源摘要。')}</p>
        </div>
        <b>${htmlEscape(dataSourceHealth.status || '暂无')}</b>
      </div>
      <div class="source-facts">
        <span>结构 ${htmlEscape(dataSourceValidation?.ok === false ? '需关注' : 'OK')}</span>
        <span>配置 ${htmlEscape(dataSourceValidation?.configured_source_count ?? '暂无')}/${htmlEscape(dataSourceValidation?.expected_source_count ?? expectedDataSourceKeys.length)}</span>
        <span>可用 ${htmlEscape(dataSourceHealth.counts?.usable ?? 0)}</span>
        <span>预留 ${htmlEscape(dataSourceHealth.counts?.reserved ?? 0)}</span>
        <span>关注 ${htmlEscape(dataSourceHealth.counts?.attention ?? 0)}</span>
        <span>检查 ${htmlEscape(dataSourceHealth.last_checked_at || '暂无')}</span>
      </div>
      ${
        dataSourceMessages.length
          ? `<ul class="source-issues">${dataSourceMessages.map((message) => `<li>${htmlEscape(message)}</li>`).join('')}</ul>`
          : ''
      }
      ${dataSourceActionPanel}
      ${
        dataSourceHealth.owner_notes
          ? `<p class="source-note">${htmlEscape(dataSourceHealth.owner_notes)}</p>`
          : ''
      }
      <div class="source-grid">
        ${(Array.isArray(dataSourceHealth.sources) ? dataSourceHealth.sources : [])
          .map(
            (source) => `
          <span class="source-chip ${htmlEscape(source.level || 'muted')}">
            <strong>${htmlEscape(source.label)}</strong>
            <em>${htmlEscape(source.status)} / ${htmlEscape(source.mode || 'n/a')}</em>
          </span>`,
          )
          .join('')}
      </div>
    </section>`
    : '';
  const cards = overview.runs
    .map(
      (run) => `
        <article class="run ${htmlEscape(run.status_class)}">
          <div class="run-head">
            <div>
              <strong>${htmlEscape(run.title)}</strong>
              <span>${htmlEscape(
                [
                  run.override_applied ? '配置覆盖' : '',
                  run.discovered ? '自动发现' : '',
                  run.status_counted === false ? '不计入总状态' : '',
                  run.generated_at,
                ]
                  .filter(Boolean)
                  .join(' · '),
              )}</span>
            </div>
            <b>${htmlEscape(run.status)}</b>
          </div>
          <div class="facts">
            <span>角色 ${htmlEscape(run.role || '暂无')}</span>
            <span>总状态 ${htmlEscape(run.status_counted === false ? '不计入' : '计入')}</span>
            <span>通过 ${htmlEscape(run.counts.passed ?? 0)}</span>
            <span>跳过 ${htmlEscape(run.counts.skipped ?? 0)}</span>
            <span>失败 ${htmlEscape(run.counts.failed ?? 0)}</span>
            <span>新鲜度 ${htmlEscape(run.freshness?.status || '暂无')}</span>
            <span>移动 ${htmlEscape(run.mobile_viewports_text)}</span>
            <span>桌面 ${htmlEscape(run.desktop_width_text)}</span>
            <span>Cache ${htmlEscape(run.cache_status)}</span>
          </div>
          ${run.error ? `<p class="error">${htmlEscape(run.error)}</p>` : ''}
          <div class="links">
            ${run.html_exists ? `<a href="${htmlEscape(run.html_file)}">HTML</a>` : '<span>HTML 未生成</span>'}
            ${run.json_exists ? `<a href="${htmlEscape(run.json_file)}">JSON</a>` : '<span>JSON 未生成</span>'}
          </div>
        </article>`,
    )
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI选品系统回归总览</title>
  <style>
    :root { color-scheme: light; --ink:#102033; --muted:#607086; --line:#d9e2ef; --ok:#0f8f54; --fail:#b42318; --skip:#7a5c00; --bg:#f6f8fb; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px 18px 42px; }
    header { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start; margin-bottom: 16px; }
    h1 { margin: 0 0 6px; font-size: clamp(24px, 4vw, 38px); line-height: 1.15; }
    p { margin: 0; color: var(--muted); }
    .badge, .metric, .run { border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    .badge { min-width: 116px; padding: 14px; text-align: center; }
    .badge strong { display: block; font-size: 30px; line-height: 1; }
    .ok { color: var(--ok); }
    .fail { color: var(--fail); }
    .skip { color: var(--skip); }
    .muted { color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 16px 0; }
    .metric { padding: 14px; }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; margin-top: 4px; font-size: 22px; }
    .freshness { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px; margin: 14px 0; }
    .freshness-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
    .freshness-head strong { display: block; font-size: 16px; }
    .freshness-head b { border-radius: 999px; padding: 5px 10px; background: #f1f5f9; }
    .freshness.ok .freshness-head b { background: #dcfce7; color: var(--ok); }
    .freshness.warn .freshness-head b { background: #fee2e2; color: var(--fail); }
    .freshness.muted .freshness-head b { color: var(--muted); }
    .freshness p { margin-top: 8px; }
    .freshness .dynamic-note { display: block; margin-top: 8px; color: var(--muted); font-size: 12px; }
    .config-alert { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px; margin: 14px 0; }
    .config-alert.warn { border-color: #fecaca; background: #fff7f7; }
    .config-alert strong { display: block; margin-bottom: 6px; font-size: 16px; }
    .config-alert p { margin-top: 4px; overflow-wrap: anywhere; }
    .config-alert ul { margin: 10px 0 0; padding-left: 20px; color: var(--muted); }
    .config-alert li { margin: 4px 0; overflow-wrap: anywhere; }
    .command-panel { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px; margin: 14px 0; }
    .command-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
    .command-head strong { display: block; font-size: 16px; }
    .command-head span { color: var(--muted); font-size: 12px; }
    .command-cwd { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 10px; align-items: start; margin-top: 10px; border: 1px solid #dbe7f5; border-radius: 8px; background: #f8fafc; padding: 10px; }
    .command-cwd.warn { border-color: #fecaca; background: #fff7f7; }
    .command-cwd span { color: var(--muted); font-size: 12px; font-weight: 800; }
    .command-cwd code { display: block; color: #16324f; overflow-wrap: anywhere; font: 12px/1.45 Consolas, "SFMono-Regular", monospace; }
    .command-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
    .command-item { border: 1px solid #dce3ee; border-radius: 8px; background: #f8fafc; padding: 12px; min-width: 0; }
    .command-item strong { display: block; margin-bottom: 8px; }
    .command-item code { display: block; border: 1px solid #dbe7f5; border-radius: 6px; background: #fff; color: #16324f; padding: 8px; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.45 Consolas, "SFMono-Regular", monospace; }
    .command-item p { margin-top: 8px; font-size: 12px; }
    .service-health { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px; margin: 14px 0; }
    .service-health.ok { border-color: #bbf7d0; }
    .service-health.warn { border-color: #fcd34d; background: #fffbeb; }
    .service-health.fail { border-color: #fecaca; background: #fff7f7; }
    .service-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
    .service-head strong { display: block; font-size: 16px; }
    .service-head b { border-radius: 999px; padding: 5px 10px; background: #f1f5f9; }
    .service-health.ok .service-head b { background: #dcfce7; color: var(--ok); }
    .service-health.warn .service-head b { background: #fef3c7; color: var(--skip); }
    .service-health.fail .service-head b { background: #fee2e2; color: var(--fail); }
    .service-facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .service-facts span { border: 1px solid #dce3ee; border-radius: 999px; background: #f8fafc; color: #475569; padding: 6px 10px; font-size: 12px; font-weight: 800; }
    .service-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
    .service-action { border: 1px solid #fcd34d; border-radius: 8px; background: #fffdf2; padding: 10px; min-width: 0; }
    .service-action strong { display: block; margin-bottom: 6px; }
    .service-action p { overflow-wrap: anywhere; }
    .git-health { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px; margin: 14px 0; }
    .git-health.ok { border-color: #bbf7d0; }
    .git-health.warn { border-color: #fcd34d; background: #fffbeb; }
    .git-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
    .git-head strong { display: block; font-size: 16px; }
    .git-head b { border-radius: 999px; padding: 5px 10px; background: #f1f5f9; }
    .git-health.ok .git-head b { background: #dcfce7; color: var(--ok); }
    .git-health.warn .git-head b { background: #fef3c7; color: var(--skip); }
    .git-facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .git-facts span { border: 1px solid #dce3ee; border-radius: 999px; background: #f8fafc; color: #475569; padding: 6px 10px; font-size: 12px; font-weight: 800; }
    .git-note { margin-top: 8px; overflow-wrap: anywhere; }
    .ops-readiness { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px; margin: 14px 0; }
    .ops-readiness.ok { border-color: #bbf7d0; }
    .ops-readiness.warn { border-color: #fcd34d; background: #fffbeb; }
    .ops-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
    .ops-head strong { display: block; font-size: 16px; }
    .ops-head b { border-radius: 999px; padding: 5px 10px; background: #f1f5f9; }
    .ops-readiness.ok .ops-head b { background: #dcfce7; color: var(--ok); }
    .ops-readiness.warn .ops-head b { background: #fef3c7; color: var(--skip); }
    .ops-facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .ops-facts span { border: 1px solid #dce3ee; border-radius: 999px; background: #f8fafc; color: #475569; padding: 6px 10px; font-size: 12px; font-weight: 800; }
    .ops-issues { margin: 10px 0 0; padding-left: 20px; color: #7a5c00; }
    .ops-issues li { margin: 4px 0; overflow-wrap: anywhere; }
    .source-health { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px; margin: 14px 0; }
    .source-health.ok { border-color: #bbf7d0; }
    .source-health.warn { border-color: #fecaca; background: #fff7f7; }
    .source-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
    .source-head strong { display: block; font-size: 16px; }
    .source-head b { border-radius: 999px; padding: 5px 10px; background: #f1f5f9; }
    .source-health.ok .source-head b { background: #dcfce7; color: var(--ok); }
    .source-health.warn .source-head b { background: #fee2e2; color: var(--fail); }
    .source-facts, .source-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .source-facts span { border: 1px solid #dce3ee; border-radius: 999px; background: #f8fafc; color: #475569; padding: 6px 10px; font-size: 12px; font-weight: 800; }
    .source-note { margin-top: 8px; overflow-wrap: anywhere; }
    .source-issues { margin: 10px 0 0; padding-left: 20px; color: var(--fail); }
    .source-issues li { margin: 4px 0; overflow-wrap: anywhere; }
    .source-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
    .source-action { border: 1px solid #fecaca; border-radius: 8px; background: #fff7f7; padding: 10px; min-width: 0; }
    .source-action strong { display: block; margin-bottom: 8px; }
    .source-action code { display: block; border: 1px solid #fecaca; border-radius: 6px; background: #fff; color: #7f1d1d; padding: 8px; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.45 Consolas, "SFMono-Regular", monospace; }
    .source-action p { margin-top: 8px; font-size: 12px; }
    .source-chip { border: 1px solid #dce3ee; border-radius: 8px; background: #f8fafc; padding: 8px 10px; min-width: 160px; }
    .source-chip.ok { border-color: #bbf7d0; background: #f0fdf4; }
    .source-chip.info { border-color: #bfdbfe; background: #eff6ff; }
    .source-chip.warn { border-color: #fecaca; background: #fff7f7; }
    .source-chip strong, .source-chip em { display: block; }
    .source-chip em { color: var(--muted); font-style: normal; font-size: 12px; margin-top: 2px; overflow-wrap: anywhere; }
    .run { padding: 14px; margin: 10px 0; }
    .run-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
    .run-head span { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; overflow-wrap: anywhere; }
    .run-head b { border-radius: 999px; padding: 5px 9px; background: #f1f5f9; }
    .run.ok .run-head b { background: #dcfce7; color: var(--ok); }
    .run.fail .run-head b { background: #fee2e2; color: var(--fail); }
    .run.skip .run-head b { background: #fef3c7; color: var(--skip); }
    .facts, .links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .facts span, .links a, .links span { border: 1px solid #dce3ee; border-radius: 999px; background: #f8fafc; color: #475569; padding: 6px 10px; font-size: 12px; font-weight: 800; }
    .links a { color: #0b5cab; text-decoration: none; border-color: #bfdbfe; background: #eff6ff; }
    .error { color: var(--fail); margin-top: 8px; overflow-wrap: anywhere; }
    @media (max-width: 720px) {
      main { padding: 18px 12px 28px; }
      header, .run-head { grid-template-columns: 1fr; }
      .badge { text-align: left; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .freshness-head { grid-template-columns: 1fr; }
      .command-head, .command-cwd, .command-grid { grid-template-columns: 1fr; }
      .service-head, .service-actions { grid-template-columns: 1fr; }
      .service-facts { display: grid; grid-template-columns: minmax(0, 1fr); }
      .git-head { grid-template-columns: 1fr; }
      .git-facts { display: grid; grid-template-columns: minmax(0, 1fr); }
      .ops-head { grid-template-columns: 1fr; }
      .ops-facts { display: grid; grid-template-columns: minmax(0, 1fr); }
      .source-head { grid-template-columns: 1fr; }
      .source-actions { grid-template-columns: 1fr; }
      .source-facts, .source-grid { display: grid; grid-template-columns: minmax(0, 1fr); }
      .facts, .links { display: grid; grid-template-columns: minmax(0, 1fr); }
      .facts span, .links a, .links span { border-radius: 8px; text-align: center; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>AI选品系统回归总览</h1>
        <p>生成时间：${htmlEscape(overview.generated_at)}。这份报告合并展示默认、多视口、桌面和 cache 相关回归结果，不运行检查、不调用外部 API。</p>
      </div>
      <div class="badge">
        <span>总状态</span>
        <strong class="${overview.ok ? 'ok' : 'fail'}">${overview.ok ? '通过' : '需关注'}</strong>
      </div>
    </header>
    <section class="grid" aria-label="回归总览摘要">
      <article class="metric"><span>配置项</span><strong>${htmlEscape(overview.counts.configured)}</strong></article>
      <article class="metric"><span>已生成</span><strong>${htmlEscape(overview.counts.generated)}</strong></article>
      <article class="metric"><span>正常</span><strong>${htmlEscape(overview.counts.ok)}</strong></article>
      <article class="metric"><span>需关注</span><strong>${htmlEscape(overview.counts.attention)}</strong></article>
      <article class="metric"><span>自动发现</span><strong>${htmlEscape(overview.counts.discovered ?? 0)}</strong></article>
      <article class="metric"><span>未计入总状态</span><strong>${htmlEscape(overview.counts.excluded_from_status ?? 0)}</strong></article>
      <article class="metric"><span>未知覆盖</span><strong>${htmlEscape(overview.counts.unknown_overrides ?? unknownOverrideIds.length)}</strong></article>
    </section>
    ${operationalPanel}
    <section
      class="freshness ${htmlEscape(freshness.status_class || 'muted')}"
      aria-label="回归新鲜度"
      data-freshness-panel
      data-fresh-until="${htmlEscape(freshness.fresh_until || '')}"
      data-threshold-hours="${htmlEscape(freshness.threshold_hours || defaultFreshnessThresholdHours)}"
    >
      <div class="freshness-head">
        <div>
          <strong>刷新时间：${htmlEscape(freshness.last_refreshed_at || overview.generated_at)}</strong>
          <p>最早过期：${htmlEscape(freshness.fresh_until || '暂无数据')}；有效窗口：${htmlEscape(freshness.threshold_hours || defaultFreshnessThresholdHours)} 小时。</p>
        </div>
        <b data-freshness-status>${htmlEscape(freshness.status || '暂无数据')}</b>
      </div>
      <p data-freshness-message>${htmlEscape(freshness.message || '暂无刷新状态。')}</p>
      <span class="dynamic-note" data-freshness-live-note>打开页面时会再次检查是否过期。</span>
    </section>
    ${configNotice}
    ${commandPanel}
    ${n8nPanel}
    ${gitPanel}
    ${dataSourcePanel}
    <section aria-label="回归结果">
      ${cards}
    </section>
  </main>
  <script>
    (() => {
      const panel = document.querySelector('[data-freshness-panel]');
      if (!panel) return;
      const deadlineText = panel.dataset.freshUntil || '';
      const deadline = Date.parse(deadlineText);
      if (!Number.isFinite(deadline)) return;
      const status = panel.querySelector('[data-freshness-status]');
      const message = panel.querySelector('[data-freshness-message]');
      const note = panel.querySelector('[data-freshness-live-note]');
      const threshold = panel.dataset.thresholdHours || '24';
      const formatTime = (date) => {
        try {
          return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
        } catch (_) {
          return date.toISOString();
        }
      };
      const now = new Date();
      const deadlineDate = new Date(deadline);
      if (Date.now() > deadline) {
        panel.classList.remove('ok', 'muted');
        panel.classList.add('warn');
        if (status) status.textContent = '需重跑';
        if (message) {
          message.textContent =
            '打开时重新检查：这份总览已超过最早过期时间（' +
            formatTime(deadlineDate) +
            '），请重新运行一键本地回归后再参考。';
        }
      }
      if (note) {
        note.textContent =
          '页面打开时间：' +
          formatTime(now) +
          '；有效窗口：' +
          threshold +
          ' 小时；最早过期：' +
          formatTime(deadlineDate) +
          '。';
      }
    })();
  </script>
</body>
</html>`;
}

function writeOverview(overview, options) {
  fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
  fs.writeFileSync(options.jsonPath, JSON.stringify({ ...overview, summary_path: options.jsonPath, html_report_path: options.htmlPath }, null, 2), 'utf8');
  fs.mkdirSync(path.dirname(options.htmlPath), { recursive: true });
  fs.writeFileSync(options.htmlPath, renderHtml({ ...overview, summary_path: options.jsonPath, html_report_path: options.htmlPath }), 'utf8');
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

  if (options.validateConfig) {
    const validation = validateLocalConfig(options);
    printConfigValidation(validation);
    return validation.ok ? 0 : 1;
  }

  const overview = buildOverview(options);
  writeOverview(overview, options);
  console.log(`regression overview: ${overview.ok ? 'OK' : 'ATTENTION'}`);
  console.log(`JSON: ${options.jsonPath}`);
  console.log(`HTML: ${options.htmlPath}`);
  if (overview.freshness_config?.ok === false) {
    printConfigValidation(overview.freshness_config);
  }
  return overview.ok && overview.freshness_config?.ok !== false ? 0 : 1;
}

process.exitCode = await main();
