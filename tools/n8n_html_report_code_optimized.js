const fs = require('fs');

const env = typeof process !== 'undefined' && process.env ? process.env : {};
const outputDir = env.AMAZON_REPORT_OUTPUT_DIR || '/files/amazon_product_analysis';
const reportDir = outputDir + '/reports';
const csvFile = outputDir + '/amazon_product_analysis.csv';
const latestHtml = outputDir + '/amazon_product_analysis_latest.html';
const overviewHtml = outputDir + '/amazon_product_analysis_overview.html';
const competitorSnapshotFile = env.AMAZON_COMPETITOR_SNAPSHOT_FILE || outputDir + '/competitor_snapshot_latest.json';
const dataSourcesConfigFile = env.AMAZON_DATA_SOURCES_CONFIG_FILE || outputDir + '/data_sources.local.json';
const windowsOutputDir =
  env.AMAZON_REPORT_WINDOWS_DIR ||
  'C:\\Users\\96259\\Desktop\\AIcoding\\codex02\\AIkuajing\\output\\amazon_product_analysis';
const skipCsvAppend = env.AMAZON_REPORT_PREVIEW_NO_CSV === '1';

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function htmlEscape(value) {
  const text = value == null ? '' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function oneLine(value) {
  if (value == null) return '';
  if (typeof value !== 'string') value = JSON.stringify(value);
  return value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function paragraph(value) {
  const text = oneLine(value);
  return text && text !== '暂无数据' ? text : '暂无数据';
}

function firstUseful(...values) {
  for (const value of values) {
    const text = oneLine(value);
    if (text && text !== '0' && text !== '暂无数据' && text !== 'null' && text !== 'undefined') return text;
  }
  return '暂无数据';
}

function hasUseful(value) {
  return firstUseful(value) !== '暂无数据';
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = oneLine(value).replace(/,/g, '');
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shorten(value, max = 150) {
  const text = paragraph(value);
  if (text === '暂无数据' || text.length <= max) return text;
  return text.slice(0, max - 1).trim() + '…';
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(paragraph).filter((item) => item !== '暂无数据');
  const text = oneLine(value);
  if (!text || text === '暂无数据') return [];
  return text
    .split(/[,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAsin(value) {
  const text = oneLine(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return text.length === 10 ? text : '';
}

function normalizeMarketplace(value) {
  const text = oneLine(value).toLowerCase();
  if (!text || text === '暂无数据') return '';
  if (text.startsWith('amazon.')) return text;
  const map = {
    in: 'amazon.in',
    india: 'amazon.in',
    us: 'amazon.com',
    usa: 'amazon.com',
    com: 'amazon.com',
    uk: 'amazon.co.uk',
    gb: 'amazon.co.uk',
    ca: 'amazon.ca',
    de: 'amazon.de',
    fr: 'amazon.fr',
    it: 'amazon.it',
    es: 'amazon.es',
    jp: 'amazon.co.jp',
  };
  return map[text] || text;
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { ok: false, reason: '文件不存在' };
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const stat = fs.statSync(filePath);
    return { ok: true, data: JSON.parse(raw), filePath, mtime: stat.mtime.toISOString() };
  } catch (error) {
    return { ok: false, reason: error.message || '读取失败', filePath };
  }
}

const DEFAULT_DATA_SOURCE_CONFIG = {
  sources: {
    crawlee: {
      label: '页面抓取',
      status: 'enabled',
      detail: 'Crawlee + Playwright 本地低频抓取，免费兜底数据源。',
      priority: 1,
    },
    manual_inputs: {
      label: '手工增强字段',
      status: 'optional',
      detail: '成本、目标售价、关键词、竞品 ASIN 和运营备注。',
      priority: 2,
    },
    competitor_snapshot: {
      label: '竞品快照',
      status: 'enabled',
      detail: '读取 competitor_snapshot_latest.json，作为低频竞品价格、评分、评论对照。',
      priority: 3,
    },
    keepa: {
      label: 'Keepa 历史趋势',
      status: 'not_connected',
      detail: '预留历史价格、BSR、Buy Box、卖家数和库存趋势。',
      priority: 4,
    },
    sp_api: {
      label: 'SP-API / Brand Analytics',
      status: 'not_connected',
      detail: '预留 Catalog、Fees、Reports、Search Query Performance 和 Brand Analytics。',
      priority: 5,
    },
    amazon_ads_api: {
      label: 'Amazon Ads API',
      status: 'not_connected',
      detail: '预留关键词表现、广告报表、ACOS、TACOS 和投放验证数据。',
      priority: 6,
    },
  },
};

function statusFromConfig(value, fallback = '未接入') {
  const status = oneLine(value).toLowerCase();
  if (!status || status === '暂无数据') return fallback;
  const map = {
    enabled: '已接入',
    connected: '已接入',
    active: '已接入',
    configured: '已配置',
    optional: '可选',
    partial: '部分提供',
    not_connected: '未接入',
    reserved: '未接入',
    disabled: '未接入',
    missing_config: '配置缺失',
  };
  return map[status] || oneLine(value);
}

function loadDataSourceConfig() {
  const loaded = readJsonFile(dataSourcesConfigFile);
  const userSources = loaded.ok && loaded.data?.sources && typeof loaded.data.sources === 'object' ? loaded.data.sources : {};
  const sources = {};
  for (const [key, defaults] of Object.entries(DEFAULT_DATA_SOURCE_CONFIG.sources)) {
    const userSource = userSources[key] && typeof userSources[key] === 'object' ? userSources[key] : {};
    sources[key] = { ...defaults, ...userSource };
  }
  return {
    ok: loaded.ok,
    file: loaded.filePath || dataSourcesConfigFile,
    reason: loaded.reason || '',
    updated_at: loaded.ok ? firstUseful(loaded.data?.updated_at, loaded.mtime) : '暂无数据',
    last_checked_at: loaded.ok ? firstUseful(loaded.data?.last_checked_at) : '暂无数据',
    owner_notes: loaded.ok ? firstUseful(loaded.data?.owner_notes) : '暂无数据',
    sources,
  };
}

function configuredSource(config, key, statusOverride = '', detailOverride = '') {
  const source = config.sources[key] || DEFAULT_DATA_SOURCE_CONFIG.sources[key] || {};
  const detail = detailOverride || firstUseful(source.detail);
  const lastCheckedAt = firstUseful(source.last_checked_at);
  const ownerNotes = firstUseful(source.owner_notes);
  const metaParts = [];
  if (lastCheckedAt !== '暂无数据') metaParts.push(`检查：${lastCheckedAt}`);
  if (ownerNotes !== '暂无数据') metaParts.push(`备注：${ownerNotes}`);
  return {
    key,
    label: firstUseful(source.label, key),
    status: statusOverride || statusFromConfig(source.status),
    detail: metaParts.length ? `${detail}；${metaParts.join('；')}` : detail,
    meta: {
      mode: firstUseful(source.mode),
      priority: typeof source.priority === 'number' ? source.priority : null,
      required_env: Array.isArray(source.required_env) ? source.required_env : [],
      last_checked_at: lastCheckedAt,
      owner_notes: ownerNotes,
    },
  };
}

function dataSourceStatusByKey(sources, key, fallback = '未接入') {
  const source = sources.find((item) => item.key === key);
  return source ? firstUseful(source.status, fallback) : fallback;
}

function normalizeRate(value, fallback = 0) {
  const number = toNumber(value);
  if (!number) return fallback;
  return number > 1 ? number / 100 : number;
}

function moneyText(value) {
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : '0.00';
}

function getNodeJson(name) {
  try {
    return $node[name].json || {};
  } catch (error) {
    return {};
  }
}

function collectObjects(value, result = [], seen = new Set()) {
  if (value == null) return result;
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjects(item, result, seen));
    return result;
  }
  if (typeof value !== 'object') return result;
  if (seen.has(value)) return result;
  seen.add(value);
  result.push(value);
  if (value.json) collectObjects(value.json, result, seen);
  if (value.output) collectObjects(value.output, result, seen);
  return result;
}

function flattenOutput(aggregate) {
  if (Array.isArray(aggregate)) return aggregate.map((entry) => entry?.json ?? entry);
  return [aggregate?.json ?? aggregate].filter(Boolean);
}

function findString(objects, key) {
  for (const object of objects) {
    if (typeof object?.[key] === 'string' && object[key].trim()) return object[key];
  }
  return '';
}

function findObject(objects, predicate) {
  return objects.find((object) => object && typeof object === 'object' && predicate(object)) || {};
}

function cleanAvailability(value) {
  const text = paragraph(value);
  if (text === '暂无数据') return text;
  return text.split('{')[0].replace(/\s+/g, ' ').trim() || '暂无数据';
}

function sectionize(text, labels) {
  const source = paragraph(text);
  if (source === '暂无数据') return [];
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(?:^|\\s)(?:\\d+[.、．]\\s*)?(${escaped.join('|')})[：:]`, 'g');
  const matches = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    matches.push({ label: match[1], index: match.index, end: regex.lastIndex });
  }
  if (!matches.length) return [];
  return matches
    .map((entry, index) => {
      const next = matches[index + 1];
      return {
        label: entry.label,
        text: source.slice(entry.end, next ? next.index : source.length).trim(),
      };
    })
    .filter((entry) => entry.text);
}

function listHtml(items, limit = 5) {
  const safeItems = Array.isArray(items) ? items.map(paragraph).filter((item) => item !== '暂无数据') : [];
  if (!safeItems.length) return '<p class="muted">暂无数据</p>';
  return `<ul>${safeItems
    .slice(0, limit)
    .map((item) => `<li>${htmlEscape(shorten(item, 150))}</li>`)
    .join('')}</ul>`;
}

function objectListHtml(items, limit = 4) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, limit) : [];
  if (!safeItems.length) return '<p class="muted">暂无数据</p>';
  return `<ul>${safeItems
    .map((item) => {
      const title = item.label || item.title || item.severity || '项目';
      const text = item.text || item.value || item.action || item.reason || '';
      return `<li><strong>${htmlEscape(shorten(title, 36))}</strong>${text ? `：${htmlEscape(shorten(text, 130))}` : ''}</li>`;
    })
    .join('')}</ul>`;
}

function tableHtml(headers, rows) {
  if (!Array.isArray(rows) || !rows.length) return '<p class="muted">暂无数据</p>';
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows
            .map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join('')}</tr>`)
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function sectionCards(sections, fallback, limit = 5) {
  const usable = sections.slice(0, limit);
  if (!usable.length) {
    return `<div class="text-panel"><p>${htmlEscape(shorten(fallback, 360))}</p></div>`;
  }
  return usable
    .map(
      (section) => `
        <article class="mini-card">
          <div class="mini-label">${htmlEscape(section.label)}</div>
          <p>${htmlEscape(shorten(section.text, 190))}</p>
        </article>`,
    )
    .join('');
}

function bar(label, valueText, width, tone = '') {
  return `
    <div class="bar-row">
      <div class="bar-head"><span>${htmlEscape(label)}</span><strong>${htmlEscape(valueText)}</strong></div>
      <div class="bar-track"><span class="${tone}" style="width:${clamp(width, 4, 100).toFixed(0)}%"></span></div>
    </div>`;
}

function deriveScore({ priceNumber, ratingNumber, reviewsNumber, blocked }) {
  if (blocked) return 38;
  let score = 34;
  if (ratingNumber > 0) score += clamp((ratingNumber - 3.4) / 1.4, 0, 1) * 30;
  if (reviewsNumber > 0) score += clamp(Math.log10(reviewsNumber + 1) / 4, 0, 1) * 24;
  if (priceNumber > 0) score += 8;
  return Math.round(clamp(score, 20, 92));
}

function decisionLabel(score, blocked) {
  if (blocked) return '页面疑似受限，先换链接或重试';
  if (score >= 80) return '进入供应链和小批量验证';
  if (score >= 65) return '进入下一轮评估';
  if (score >= 50) return '暂缓，先补齐关键数据';
  return '不建议推进或需要人工复核';
}

function decisionClass(label) {
  if (label.includes('受限') || label.includes('不足')) return 'warn';
  if (label.includes('观察')) return 'mid';
  return 'good';
}

function buildFocusPoints({ price, rating, reviews, availability, ratingNumber, reviewsNumber, blocked }) {
  if (blocked) {
    return [
      '页面可能触发验证码或机器人检测，先降低频率或换商品链接验证。',
      '当前报告不应作为选品结论，只能作为抓取状态记录。',
      '重新抓取前先确认浏览器能正常打开该 Amazon 页面。',
    ];
  }
  const points = [];
  points.push(reviewsNumber > 0 ? `需求验证：已抓到评论数 ${reviews}，可作为热度判断入口。` : '需求验证：评论数缺失，先补抓或手动确认。');
  points.push(ratingNumber > 0 ? `口碑信号：评分 ${rating}，后续重点看低星差评原因。` : '口碑信号：评分缺失，暂不判断口碑强弱。');
  points.push(price !== '暂无数据' ? `价格信号：当前价格 ${price}，适合继续对比同类价格带。` : '价格信号：价格缺失，先确认页面是否展示价格。');
  if (availability !== '暂无数据') points.push(`库存状态：${availability}。`);
  return points.slice(0, 4);
}

function buildDecisionModel({
  blocked,
  price,
  rating,
  reviews,
  availability,
  priceNumber,
  ratingNumber,
  reviewsNumber,
  bullets,
  productDetails,
  summary,
  competitiveAnalysis,
  riskText,
  manual,
}) {
  if (blocked) {
    const breakdown = [
      { key: 'demand', label: '需求强度', score: 2, max: 20, evidence: '页面受限，不能用评论/热度判断需求。' },
      { key: 'competition', label: '竞争可控', score: 2, max: 15, evidence: '竞品和广告信息不足。' },
      { key: 'profit', label: '利润空间', score: 3, max: 20, evidence: '价格或成本信息不足。' },
      { key: 'listing', label: 'Listing 机会', score: 2, max: 15, evidence: '页面内容抓取不完整。' },
      { key: 'reputation', label: '口碑风险', score: 2, max: 10, evidence: '评分和评论不足。' },
      { key: 'operations', label: '运营复杂度', score: 3, max: 10, evidence: '尺寸、库存和合规信息不足。' },
      { key: 'trust', label: '数据可信度', score: 1, max: 10, evidence: '疑似验证码或 Continue Shopping 页面。' },
    ];
    return { score: 15, breakdown };
  }

  const demand = clamp(
    6 + (reviewsNumber > 0 ? clamp(Math.log10(reviewsNumber + 1) / 4, 0, 1) * 10 : 0) + (priceNumber > 0 ? 2 : 0) + (ratingNumber > 0 ? 2 : 0),
    3,
    20,
  );
  const competition = clamp(
    12 -
      (reviewsNumber > 8000 ? 5 : reviewsNumber > 2500 ? 3 : reviewsNumber > 800 ? 1 : 0) +
      (manual.competitorAsins.length ? 1 : 0),
    4,
    15,
  );
  const profitDetail = buildProfitDetail({ manual, priceNumber });
  const profit = profitDetail.net_margin == null ? 10 : clamp(5 + profitDetail.net_margin * 42, 2, 20);
  const listing = clamp(
    5 + Math.min(bullets.length, 5) * 1.2 + Math.min(productDetails.length, 4) * 0.8 + (manual.targetKeywords.length ? 2 : 0),
    3,
    15,
  );
  const reputation = clamp(ratingNumber > 0 ? 3 + ((ratingNumber - 3.2) / 1.6) * 7 : 5, 2, 10);
  const operations = clamp(
    6 +
      (availability !== '暂无数据' ? 1 : 0) +
      (manual.marketplace !== '暂无数据' ? 1 : 0) -
      (riskText !== '暂无数据' && /漂移|质量|退货|损坏|风险|限制|合规|安全/.test(riskText) ? 2 : 0),
    2,
    10,
  );
  const coverageFields = [
    price !== '暂无数据',
    rating !== '暂无数据',
    reviews !== '暂无数据',
    bullets.length > 0,
    productDetails.length > 0,
    summary !== '暂无数据',
    competitiveAnalysis !== '暂无数据',
    manual.targetKeywords.length > 0,
    manual.landedCost > 0 || manual.targetPrice > 0,
    manual.competitorAsins.length > 0,
  ];
  const trust = clamp((coverageFields.filter(Boolean).length / coverageFields.length) * 10, 2, 10);

  const breakdown = [
    { key: 'demand', label: '需求强度', score: demand, max: 20, evidence: reviewsNumber > 0 ? `评论数 ${reviews}，可作为需求热度弱信号。` : '缺少评论数，需求判断偏弱。' },
    { key: 'competition', label: '竞争可控', score: competition, max: 15, evidence: reviewsNumber > 2500 ? '评论护城河较高，竞争压力偏大。' : '评论护城河尚可，后续需补竞品集合。' },
    {
      key: 'profit',
      label: '利润空间',
      score: profit,
      max: 20,
      evidence:
        profitDetail.net_margin == null
          ? '未提供成本，利润只能给中性分。'
          : `扣除成本、运费、平台费、履约费和广告预算后，估算净利率 ${(profitDetail.net_margin * 100).toFixed(1)}%。`,
    },
    { key: 'listing', label: 'Listing 机会', score: listing, max: 15, evidence: manual.targetKeywords.length ? '已提供目标关键词，可评估覆盖缺口。' : '未提供目标关键词，Listing 机会判断有限。' },
    { key: 'reputation', label: '口碑风险', score: reputation, max: 10, evidence: ratingNumber > 0 ? `评分 ${rating}，需继续拆解低星评论。` : '评分缺失，口碑风险未知。' },
    { key: 'operations', label: '运营复杂度', score: operations, max: 10, evidence: availability !== '暂无数据' ? `库存状态：${availability}` : '库存和物流复杂度字段不足。' },
    { key: 'trust', label: '数据可信度', score: trust, max: 10, evidence: '按页面字段、AI 输出和手工字段覆盖率计算。' },
  ];
  return { score: Math.round(breakdown.reduce((sum, item) => sum + item.score, 0)), breakdown };
}

function buildProfitDetail({ manual, priceNumber }) {
  const salePrice = manual.targetPrice || priceNumber;
  const platformFeeRate = manual.platformFee > 0 ? 0 : normalizeRate(manual.platformFeeRate, 0.15);
  const platformFee = manual.platformFee > 0 ? manual.platformFee : salePrice > 0 ? salePrice * platformFeeRate : 0;
  const totalCost =
    manual.landedCost +
    manual.shippingCost +
    platformFee +
    manual.fulfillmentFee +
    manual.adCostEstimate;
  const netProfit = salePrice > 0 ? salePrice - totalCost : 0;
  const netMargin = manual.landedCost > 0 && salePrice > 0 ? netProfit / salePrice : null;
  return {
    sale_price: salePrice || 0,
    landed_cost: manual.landedCost || 0,
    shipping_cost: manual.shippingCost || 0,
    platform_fee_rate: platformFeeRate || 0,
    platform_fee: platformFee || 0,
    fulfillment_fee: manual.fulfillmentFee || 0,
    ad_cost_estimate: manual.adCostEstimate || 0,
    total_cost: totalCost || 0,
    net_profit: netProfit || 0,
    net_margin: netMargin,
    platform_fee_note: manual.platformFee > 0 ? '使用手工输入平台费' : '未输入平台费时按占位费率估算，非官方最终费用',
  };
}

function buildProfitRows(detail) {
  if (!detail || !detail.sale_price) return [];
  const netProfitText = detail.net_margin == null ? '未计算' : moneyText(detail.net_profit);
  const netProfitNote = detail.net_margin == null ? '缺少采购成本，不能计算净利润' : `净利率 ${(detail.net_margin * 100).toFixed(1)}%`;
  return [
    ['目标/页面售价', moneyText(detail.sale_price), 'target_price 优先，缺失时用页面价格数值'],
    ['采购成本', moneyText(detail.landed_cost), 'landed_cost'],
    ['物流运费', moneyText(detail.shipping_cost), 'shipping_cost'],
    ['平台费估算', moneyText(detail.platform_fee), detail.platform_fee_note],
    ['履约/FBA 费', moneyText(detail.fulfillment_fee), '未输入时按 0 处理'],
    ['广告预算', moneyText(detail.ad_cost_estimate), 'ad_cost_estimate'],
    ['估算净利润', netProfitText, netProfitNote],
  ];
}

function loadCompetitorSnapshot(asins, marketplace, sourceAsin = '') {
  const wanted = asins.map(normalizeAsin).filter(Boolean);
  if (!wanted.length) {
    return {
      status: '未提供',
      detail: '未填写竞品 ASIN',
      file: competitorSnapshotFile,
      rows: [],
      matched_count: 0,
      success_count: 0,
      failed_count: 0,
    };
  }

  const loaded = readJsonFile(competitorSnapshotFile);
  if (!loaded.ok) {
    return {
      status: '未生成',
      detail: `未读取到竞品快照：${loaded.reason}`,
      file: competitorSnapshotFile,
      rows: [],
      matched_count: 0,
      success_count: 0,
      failed_count: 0,
    };
  }

  const data = loaded.data || {};
  const dataSourceAsin = normalizeAsin(data.source_asin);
  const wantedSourceAsin = normalizeAsin(sourceAsin);
  if (dataSourceAsin && (!wantedSourceAsin || dataSourceAsin !== wantedSourceAsin)) {
    return {
      status: '未匹配',
      detail: `竞品快照属于主商品 ${dataSourceAsin}，当前商品 ${wantedSourceAsin || '暂无数据'}；请重新运行竞品快照。`,
      file: loaded.filePath,
      updated_at: loaded.mtime,
      dry_run: !!data.dry_run,
      marketplace: firstUseful(data.marketplace, marketplace),
      source_asin: dataSourceAsin,
      source_match: false,
      competitor_asin_key: firstUseful(data.competitor_asin_key),
      snapshot_scope_key: firstUseful(data.snapshot_scope_key),
      rows: wanted.map((asin) => ({
        asin,
        status: '待抓取',
        price: '暂无数据',
        rating: '暂无数据',
        reviews: '暂无数据',
        availability: '暂无数据',
        title: '',
        note: '最新竞品快照的主商品 ASIN 不匹配',
      })),
      matched_count: 0,
      success_count: 0,
      failed_count: 0,
    };
  }
  const sourceRows = Array.isArray(data.results) ? data.results : [];
  const byAsin = new Map();
  for (const row of sourceRows) {
    const key = normalizeAsin(row.input_asin || row.asin);
    if (key) byAsin.set(key, row);
  }

  const rows = wanted.map((asin) => {
    const row = byAsin.get(asin);
    if (!row) {
      return {
        asin,
        status: '待抓取',
        price: '暂无数据',
        rating: '暂无数据',
        reviews: '暂无数据',
        availability: '暂无数据',
        title: '',
        note: '最新竞品快照未包含该 ASIN',
      };
    }
    const ok = row.status === 'success' || row.ok === true;
    return {
      asin,
      status: ok ? '已抓取' : row.status === 'dry_run' ? 'DryRun' : '抓取失败',
      price: firstUseful(row.price, row.price_number),
      rating: firstUseful(row.rating, row.rating_number),
      reviews: firstUseful(row.reviews, row.reviews_number),
      availability: firstUseful(row.availability),
      title: firstUseful(row.title),
      product_url: firstUseful(row.loaded_url, row.product_url),
      note: ok ? firstUseful(row.availability, row.category, '已获取价格/评分/评论') : firstUseful(row.error, row.note, '本次快照未成功'),
    };
  });

  const successCount = rows.filter((row) => row.status === '已抓取').length;
  const failedCount = rows.filter((row) => row.status === '抓取失败').length;
  const marketplaceText = firstUseful(data.marketplace, marketplace);
  return {
    status: successCount === wanted.length ? '已接入' : successCount > 0 ? '部分成功' : data.dry_run ? 'DryRun' : '未完成',
    detail:
      successCount > 0
        ? `快照站点 ${marketplaceText}，匹配 ${successCount}/${wanted.length} 个竞品，更新时间 ${loaded.mtime || '暂无数据'}`
        : `快照已读取，但尚未匹配成功竞品，更新时间 ${loaded.mtime || '暂无数据'}`,
    file: loaded.filePath,
    updated_at: loaded.mtime,
    dry_run: !!data.dry_run,
    marketplace: marketplaceText,
    source_asin: dataSourceAsin,
    source_match: !dataSourceAsin || !wantedSourceAsin || dataSourceAsin === wantedSourceAsin,
    competitor_asin_key: firstUseful(data.competitor_asin_key),
    snapshot_scope_key: firstUseful(data.snapshot_scope_key),
    rows,
    matched_count: rows.filter((row) => row.status !== '待抓取').length,
    success_count: successCount,
    failed_count: failedCount,
  };
}

function buildCompetitorRows(asins, snapshot) {
  if (!Array.isArray(asins) || !asins.length) return [];
  const byAsin = new Map((snapshot?.rows || []).map((row) => [normalizeAsin(row.asin), row]));
  return asins.map((asin, index) => {
    const normalized = normalizeAsin(asin) || asin;
    const row = byAsin.get(normalized);
    if (!row) return [String(index + 1), asin, '待抓取', '暂无数据', '暂无数据', '暂无数据', '暂无竞品快照'];
    return [
      String(index + 1),
      normalized,
      row.status,
      row.price,
      row.rating,
      row.reviews,
      row.title && row.title !== '暂无数据' ? shorten(row.title, 70) : row.note,
    ];
  });
}

function buildRiskFlags({ blocked, ratingNumber, reviewsNumber, priceNumber, riskText, manual, profitDetail, competitorSnapshot }) {
  const flags = [];
  if (blocked) flags.push({ severity: '高', label: '抓取受限', text: '页面疑似验证码或 Continue Shopping，本轮不能作为选品结论。' });
  if (!priceNumber) flags.push({ severity: '中', label: '价格缺失', text: '价格缺失会影响利润和价格带判断。' });
  if (!manual.landedCost && !manual.targetPrice) flags.push({ severity: '中', label: '成本缺失', text: '未提供采购/目标售价，利润结论只能保持中性。' });
  if (manual.landedCost && !manual.fulfillmentFee) flags.push({ severity: '低', label: '履约费缺失', text: '未提供 FBA/履约费用，本轮按 0 处理，净利可能偏高。' });
  if (manual.landedCost && !manual.adCostEstimate) flags.push({ severity: '低', label: '广告成本缺失', text: '未提供广告预算数值，本轮按 0 处理，需用测试投放校准。' });
  if (profitDetail?.net_margin != null && profitDetail.net_margin < 0.15)
    flags.push({ severity: '中', label: '净利偏薄', text: `当前估算净利率 ${(profitDetail.net_margin * 100).toFixed(1)}%，需要复核平台费、广告成本和供应链报价。` });
  if (!manual.targetKeywords.length) flags.push({ severity: '中', label: '关键词缺失', text: '未提供目标关键词，无法判断搜索需求和 Listing 覆盖。' });
  if (!manual.competitorAsins.length) flags.push({ severity: '低', label: '竞品集合缺失', text: '暂未形成同款/同类竞品对照。' });
  if (manual.competitorAsins.length && !competitorSnapshot?.success_count)
    flags.push({ severity: '低', label: '竞品快照缺失', text: '已记录竞品 ASIN，但尚未形成真实价格、评分、评论对比。' });
  if (ratingNumber > 0 && ratingNumber < 4) flags.push({ severity: '高', label: '评分偏低', text: `当前评分 ${ratingNumber}，需优先查看差评主题。` });
  if (reviewsNumber > 8000) flags.push({ severity: '中', label: '头部护城河', text: '评论数很高，说明需求存在，也意味着头部竞争强。' });
  if (riskText !== '暂无数据') flags.push({ severity: '中', label: 'AI 风险提示', text: shorten(riskText, 130) });
  return flags.slice(0, 6);
}

function buildNextActions({ blocked, manual, score, profitDetail, competitorSnapshot }) {
  if (blocked) {
    return [
      { label: '重新抓取', text: '降低频率或换链接，确认不是验证码/Continue Shopping 页面。' },
      { label: '人工复核', text: '手动打开商品页，确认标题、价格、评分和评论是否可见。' },
    ];
  }
  const actions = [];
  if (!manual.landedCost) actions.push({ label: '补成本', text: '填写 landed_cost 和 shipping_cost，重新计算利润空间。' });
  if (manual.landedCost && !manual.fulfillmentFee) actions.push({ label: '补平台费用', text: '补充 fulfillment_fee 或后续接入 Product Fees API。' });
  if (manual.landedCost && !manual.adCostEstimate) actions.push({ label: '补广告预算', text: '填写 ad_cost_estimate，用小预算投放校准真实获客成本。' });
  if (!manual.targetKeywords.length) actions.push({ label: '补关键词', text: '填写 3-10 个目标关键词，后续用于 Listing 覆盖和需求判断。' });
  if (!manual.competitorAsins.length) actions.push({ label: '补竞品', text: '填写 3-5 个竞品 ASIN，形成价格、评分、评论对照。' });
  if (profitDetail?.net_margin != null && profitDetail.net_margin < 0.15)
    actions.push({ label: '复核利润', text: '净利率偏薄，先压低采购/物流成本或提高目标售价，再考虑投放。' });
  if (manual.competitorAsins.length && competitorSnapshot?.success_count)
    actions.push({ label: '复核竞品价差', text: '已读取竞品快照，下一步对比价格、评分和评论护城河。' });
  else if (manual.competitorAsins.length) actions.push({ label: '抓取竞品', text: '运行低频竞品快照，生成价格、评分、评论对比表。' });
  actions.push(
    score >= 80
      ? { label: '小批量验证', text: '进入供应链报价、样品和小批量投放验证。' }
      : score >= 65
        ? { label: '下一轮评估', text: '补强利润、竞品和关键词证据后再判断是否推进。' }
        : { label: '暂缓推进', text: '优先查找数据更完整或利润更清晰的候选品。' },
  );
  return actions.slice(0, 5);
}

function buildDataSources({ blocked, manual, competitorSnapshot }) {
  const config = loadDataSourceConfig();
  const configDetail = config.ok
    ? `配置文件：${config.file}；最后检查：${config.last_checked_at}；备注：${config.owner_notes}`
    : `未读取到配置文件：${config.file}；已使用内置默认状态。`;
  return [
    {
      key: 'data_source_config',
      label: '数据源配置',
      status: config.ok ? '已读取' : '配置缺失',
      detail: configDetail,
      meta: {
        file: config.file,
        updated_at: config.updated_at,
        last_checked_at: config.last_checked_at,
        owner_notes: config.owner_notes,
      },
    },
    configuredSource(config, 'crawlee', blocked ? '受限' : statusFromConfig(config.sources.crawlee.status), config.sources.crawlee.detail),
    configuredSource(config, 'manual_inputs', manual.hasAny ? '部分提供' : '未提供', config.sources.manual_inputs.detail),
    configuredSource(
      config,
      'competitor_snapshot',
      competitorSnapshot?.status || '未生成',
      competitorSnapshot?.detail || config.sources.competitor_snapshot.detail,
    ),
    configuredSource(config, 'keepa'),
    configuredSource(config, 'sp_api'),
    configuredSource(config, 'amazon_ads_api'),
  ];
}

function dataSourceHtml(sources) {
  return sources
    .map(
      (source) => `
        <article class="source-card ${['已接入', '已读取', '已配置', '部分提供', '部分成功'].includes(source.status) ? 'on' : ['受限', '未完成', 'DryRun', '配置缺失', '未匹配'].includes(source.status) ? 'warn' : ''}">
          <strong>${htmlEscape(source.label)}</strong>
          <span>${htmlEscape(source.status)}</span>
          <p>${htmlEscape(source.detail)}</p>
        </article>`,
    )
    .join('');
}

function metricCard(label, value, note = '') {
  return `
    <article class="metric">
      <div class="metric-label">${htmlEscape(label)}</div>
      <div class="metric-value">${htmlEscape(value)}</div>
      ${note ? `<div class="metric-note">${htmlEscape(note)}</div>` : ''}
    </article>`;
}

function pathForWindowsReport(filename) {
  const base = windowsOutputDir.replace(/[\\/]+$/, '');
  return `${base}\\reports\\${filename}`;
}

function ensureCsvHeader(file, csvHeaders) {
  if (skipCsvAppend) return;
  const headerLine = csvHeaders.map(csvEscape).join(',');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, headerLine + '\n', 'utf8');
    return;
  }
  const current = fs.readFileSync(file, 'utf8');
  const firstLineEnd = current.indexOf('\n');
  const firstLine = firstLineEnd >= 0 ? current.slice(0, firstLineEnd).replace(/\r$/, '') : current.trim();
  const missingHeader = csvHeaders.some((header) => !firstLine.includes(`"${header}"`));
  if (missingHeader) {
    const rest = firstLineEnd >= 0 ? current.slice(firstLineEnd + 1) : '';
    fs.writeFileSync(file, headerLine + '\n' + rest, 'utf8');
  }
}

function parseCsvRows(text) {
  const result = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      if (row.some((cell) => cell !== '')) result.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== '')) result.push(row);
  }
  return result;
}

function csvRecordsFromFile(file) {
  if (!fs.existsSync(file)) return [];
  const csvRows = parseCsvRows(fs.readFileSync(file, 'utf8'));
  const [csvHeaders, ...records] = csvRows;
  if (!csvHeaders?.length) return [];
  return records.map((record) => Object.fromEntries(csvHeaders.map((header, index) => [header, record[index] || ''])));
}

function parseJsonSafe(value, fallback) {
  const text = oneLine(value);
  if (!text || text === '暂无数据') return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function reportRelativeLink(value) {
  const text = oneLine(value);
  const match = text.match(/reports[\\/]+([^\\/]+\.html)$/i);
  return match ? `reports/${match[1]}` : '';
}

function buildOverviewReport(records) {
  const generatedAt = new Date().toISOString();
  const overviewSourceConfig = loadDataSourceConfig();
  const overviewSources = Object.keys(DEFAULT_DATA_SOURCE_CONFIG.sources)
    .map((key) => configuredSource(overviewSourceConfig, key))
    .sort((a, b) => (a.meta?.priority || 99) - (b.meta?.priority || 99));
  const localSourceKeys = new Set(['crawlee', 'manual_inputs', 'competitor_snapshot']);
  const reservedSourceKeys = new Set(['keepa', 'sp_api', 'amazon_ads_api']);
  const offlineStatuses = new Set(['未接入', '配置缺失']);
  const localUsableCount = overviewSources.filter((source) => localSourceKeys.has(source.key) && !offlineStatuses.has(source.status)).length;
  const reservedOfflineCount = overviewSources.filter((source) => reservedSourceKeys.has(source.key) && offlineStatuses.has(source.status)).length;
  const regressionOverviewSummaryFile = readJsonFile(outputDir + '/local_regression_overview.json');
  const regressionSummaryFile = readJsonFile(outputDir + '/local_regression_latest.json');
  const regressionMultiSummaryFile = readJsonFile(outputDir + '/local_regression_multi_viewport.json');
  const regressionDesktopSummaryFile = readJsonFile(outputDir + '/local_regression_desktop.json');
  const regressionArtifacts = [
    { label: '回归总览 HTML', file: 'local_regression_overview.html' },
    { label: '回归总览 JSON', file: 'local_regression_overview.json' },
    { label: '回归报告 HTML', file: 'local_regression_latest.html' },
    { label: '回归结果 JSON', file: 'local_regression_latest.json' },
    { label: '多视口报告 HTML', file: 'local_regression_multi_viewport.html' },
    { label: '多视口结果 JSON', file: 'local_regression_multi_viewport.json' },
    { label: '桌面报告 HTML', file: 'local_regression_desktop.html' },
    { label: '桌面结果 JSON', file: 'local_regression_desktop.json' },
    { label: '总览移动截图', file: 'overview_mobile_layout_check.png' },
    { label: '单品移动截图', file: 'latest_report_mobile_layout_check.png' },
    { label: '总览桌面截图', file: 'overview_desktop_layout_check.png' },
    { label: '单品桌面截图', file: 'latest_report_desktop_layout_check.png' },
  ].map((artifact) => {
    const filePath = outputDir + '/' + artifact.file;
    try {
      if (!fs.existsSync(filePath)) return { ...artifact, exists: false, updated_at: '暂无数据', bytes: 0 };
      const stat = fs.statSync(filePath);
      return { ...artifact, exists: true, updated_at: stat.mtime.toISOString(), bytes: stat.size };
    } catch (error) {
      return { ...artifact, exists: false, updated_at: '暂无数据', bytes: 0 };
    }
  });
  const latestSnapshotFile = readJsonFile(competitorSnapshotFile);
  const latestSnapshotAsinKey =
    latestSnapshotFile.ok && Array.isArray(latestSnapshotFile.data?.results)
      ? asinSetKey(latestSnapshotFile.data.results.map((row) => row.input_asin || row.asin))
      : '';
  const latestSnapshotSourceAsin = latestSnapshotFile.ok ? normalizeAsin(latestSnapshotFile.data?.source_asin) : '';
  const latestSnapshotMarketplace = latestSnapshotFile.ok ? normalizeMarketplace(latestSnapshotFile.data?.marketplace) : '';
  const latestSnapshotLogLink = latestSnapshotFile.ok
    ? htmlFileRelativeLink(latestSnapshotFile.data?.html_path) || 'competitor_snapshot_latest.html'
    : '';
  const latestSnapshotHistoryLink = latestSnapshotFile.ok ? htmlFileRelativeLink(latestSnapshotFile.data?.history_html_path) : '';

  function htmlFileRelativeLink(value) {
    const text = oneLine(value);
    const match = text.match(/([^\\/]+\.html)$/i);
    return match ? match[1] : '';
  }

  function asinSetKey(values) {
    const asins = parseList(values)
      .map(normalizeAsin)
      .filter(Boolean)
      .sort();
    return asins.length ? [...new Set(asins)].join('|') : '';
  }

  function matchingLatestCompetitorSnapshot(asins, marketplace, sourceAsin) {
    const wantedKey = asinSetKey(asins);
    if (!wantedKey || !latestSnapshotAsinKey || wantedKey !== latestSnapshotAsinKey) return null;
    const wantedSourceAsin = normalizeAsin(sourceAsin);
    if (latestSnapshotSourceAsin && (!wantedSourceAsin || latestSnapshotSourceAsin !== wantedSourceAsin)) return null;
    const wantedMarketplace = normalizeMarketplace(marketplace);
    if (latestSnapshotMarketplace && wantedMarketplace && latestSnapshotMarketplace !== wantedMarketplace) return null;
    const snapshot = loadCompetitorSnapshot(parseList(asins), marketplace, sourceAsin);
    if (!snapshot?.rows?.length || snapshot.dry_run) return null;
    return {
      ...snapshot,
      source: 'latest_competitor_snapshot_file',
      source_match: !latestSnapshotSourceAsin || latestSnapshotSourceAsin === wantedSourceAsin,
    };
  }

  const normalized = records
    .map((record) => {
      const risks = parseJsonSafe(record.risk_flags_json, []);
      const actions = parseJsonSafe(record.next_actions_json, []);
      const evidence = parseJsonSafe(record.evidence_json, {});
      const productAsin = firstUseful(record.asin);
      const evidenceManualInputs = evidence?.manual_inputs && typeof evidence.manual_inputs === 'object' ? evidence.manual_inputs : {};
      const competitorAsins = parseList(record.competitor_asins).length
        ? parseList(record.competitor_asins)
        : parseList(evidenceManualInputs.competitor_asins);
      const marketplace = firstUseful(record.marketplace, evidenceManualInputs.marketplace);
      const csvCompetitorSnapshot = evidence?.competitor_snapshot && typeof evidence.competitor_snapshot === 'object' ? evidence.competitor_snapshot : {};
      const latestCompetitorSnapshot = matchingLatestCompetitorSnapshot(competitorAsins, marketplace, productAsin);
      const competitorSnapshot = latestCompetitorSnapshot || csvCompetitorSnapshot;
      const competitorSnapshotRows = Array.isArray(competitorSnapshot.rows) ? competitorSnapshot.rows : [];
      const competitorTotal = competitorSnapshotRows.length;
      const competitorSuccess =
        typeof competitorSnapshot.success_count === 'number'
          ? competitorSnapshot.success_count
          : competitorSnapshotRows.filter((row) => row.status === '已抓取' || row.status === 'success' || row.ok === true).length;
      const competitorCoverage = competitorTotal > 0 ? competitorSuccess / competitorTotal : null;
      const competitorStatus =
        competitorTotal > 0
          ? `${competitorSuccess}/${competitorTotal} ${firstUseful(competitorSnapshot.status)}`
          : firstUseful(competitorSnapshot.status, '未接入');
      const competitorUpdatedAt = firstUseful(competitorSnapshot.updated_at);
      const score = toNumber(record.recommendation_score);
      return {
        createdAt: firstUseful(record.created_at),
        time: Date.parse(record.created_at) || 0,
        asin: productAsin,
        title: firstUseful(record.product_title),
        price: firstUseful(record.price),
        rating: firstUseful(record.rating),
        reviews: firstUseful(record.reviews),
        score,
        decision: firstUseful(record.decision),
        risks: Array.isArray(risks) ? risks : [],
        actions: Array.isArray(actions) ? actions : [],
        margin: typeof evidence?.profit_estimate?.net_margin === 'number' ? evidence.profit_estimate.net_margin : null,
        competitorStatus,
        competitorSuccess,
        competitorTotal,
        competitorCoverage,
        competitorUpdatedAt,
        competitorUpdatedTime: Date.parse(competitorUpdatedAt) || 0,
        competitorNeedsVerification: competitorTotal === 0 || competitorSuccess < competitorTotal,
        reportLink: reportRelativeLink(record.html_report),
      };
    })
    .filter((record) => record.title !== '暂无数据' || record.asin !== '暂无数据');

  const scored = normalized.filter((record) => record.score > 0);
  const avgScore = scored.length ? Math.round(scored.reduce((sum, record) => sum + record.score, 0) / scored.length) : 0;
  const ready = scored.filter((record) => record.score >= 80).length;
  const review = scored.filter((record) => record.score >= 65 && record.score < 80).length;
  const hold = scored.filter((record) => record.score > 0 && record.score < 65).length;
  const sortedByScore = [...normalized].sort((a, b) => b.score - a.score || b.time - a.time).slice(0, 12);
  const sortedByTime = [...normalized].sort((a, b) => b.time - a.time).slice(0, 10);
  const latestByAsin = new Map();
  for (const record of [...normalized].sort((a, b) => b.time - a.time)) {
    const key = record.asin !== '暂无数据' ? record.asin : `${record.title}|${record.reportLink}`;
    if (!latestByAsin.has(key)) latestByAsin.set(key, record);
  }
  const deduped = [...latestByAsin.values()].sort((a, b) => b.score - a.score || b.time - a.time).slice(0, 12);
  const competitorVerified = deduped.filter((record) => record.competitorSuccess > 0).length;
  const competitorPending = deduped.filter((record) => record.competitorNeedsVerification).length;
  const competitorCoverageRows = deduped.filter((record) => record.competitorCoverage != null);
  const avgCompetitorCoverage = competitorCoverageRows.length
    ? Math.round((competitorCoverageRows.reduce((sum, record) => sum + record.competitorCoverage, 0) / competitorCoverageRows.length) * 100)
    : 0;
  const verificationSorted = [...deduped].sort((a, b) => b.competitorUpdatedTime - a.competitorUpdatedTime || b.time - a.time).slice(0, 12);
  const unverifiedCandidates = deduped
    .filter((record) => record.competitorNeedsVerification)
    .sort((a, b) => b.score - a.score || b.time - a.time)
    .slice(0, 12);
  const riskMap = new Map();
  for (const record of normalized) {
    for (const risk of record.risks) {
      const label = firstUseful(risk.label, risk.severity);
      if (label === '暂无数据') continue;
      riskMap.set(label, (riskMap.get(label) || 0) + 1);
    }
  }
  const riskRows = [...riskMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => [label, String(count)]);
  const competitorStatusRows = deduped.slice(0, 8).map((record) => [
    record.asin,
    shorten(record.title, 36),
    record.competitorCoverage == null ? '暂无' : `${Math.round(record.competitorCoverage * 100)}%`,
    record.competitorStatus,
    record.competitorUpdatedAt,
  ]);

  const candidateRows = sortedByScore.map((record) => [
    record.score ? String(record.score) : '暂无',
    record.decision,
    record.asin,
    shorten(record.title, 54),
    record.margin == null ? '暂无' : `${(record.margin * 100).toFixed(1)}%`,
    record.competitorCoverage == null ? '暂无' : `${Math.round(record.competitorCoverage * 100)}%`,
    record.risks.map((risk) => risk.label).filter(Boolean).slice(0, 2).join(' / ') || '暂无',
    record.reportLink ? `<a href="${htmlEscape(record.reportLink)}">打开</a>` : '暂无',
  ]);
  const dedupRows = deduped.map((record) => [
    record.score ? String(record.score) : '暂无',
    record.decision,
    record.asin,
    shorten(record.title, 60),
    record.margin == null ? '暂无' : `${(record.margin * 100).toFixed(1)}%`,
    record.competitorCoverage == null ? '暂无' : `${Math.round(record.competitorCoverage * 100)}%`,
    record.actions.map((action) => action.label).filter(Boolean).slice(0, 2).join(' / ') || '暂无',
    record.createdAt,
    record.reportLink ? `<a href="${htmlEscape(record.reportLink)}">打开</a>` : '暂无',
  ]);
  const latestRows = sortedByTime.map((record) => [
    record.createdAt,
    record.score ? String(record.score) : '暂无',
    record.asin,
    shorten(record.title, 60),
    record.competitorStatus,
    record.actions.map((action) => action.label).filter(Boolean).slice(0, 2).join(' / ') || '暂无',
  ]);
  const verificationRows = verificationSorted.map((record) => [
    record.competitorUpdatedAt,
    record.competitorCoverage == null ? '暂无' : `${Math.round(record.competitorCoverage * 100)}%`,
    record.competitorStatus,
    record.score ? String(record.score) : '暂无',
    record.asin,
    shorten(record.title, 54),
    record.actions.map((action) => action.label).filter(Boolean).slice(0, 2).join(' / ') || '暂无',
    record.reportLink ? `<a href="${htmlEscape(record.reportLink)}">打开</a>` : '暂无',
  ]);
  const unverifiedRows = unverifiedCandidates.map((record) => [
    record.score ? String(record.score) : '暂无',
    record.asin,
    shorten(record.title, 54),
    record.competitorCoverage == null ? '暂无' : `${Math.round(record.competitorCoverage * 100)}%`,
    record.competitorStatus,
    record.actions.map((action) => action.label).filter(Boolean).slice(0, 2).join(' / ') || '暂无',
    record.reportLink ? `<a href="${htmlEscape(record.reportLink)}">打开</a>` : '暂无',
  ]);

  function rawTable(headersForTable, rowsForTable) {
    if (!rowsForTable.length) return '<p class="muted desktop-table">暂无数据</p>';
    return `
      <div class="table-wrap desktop-table">
        <table>
          <thead><tr>${headersForTable.map((header) => `<th>${htmlEscape(header)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rowsForTable
              .map((row) => `<tr>${row.map((cell) => `<td>${String(cell).startsWith('<a ') ? cell : htmlEscape(cell)}</td>`).join('')}</tr>`)
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  function actionSummary(record) {
    return record.actions.map((action) => action.label).filter(Boolean).slice(0, 2).join(' / ') || '暂无';
  }

  function riskSummary(record) {
    return record.risks.map((risk) => risk.label).filter(Boolean).slice(0, 2).join(' / ') || '暂无';
  }

  function coverageText(record) {
    return record.competitorCoverage == null ? '暂无' : `${Math.round(record.competitorCoverage * 100)}%`;
  }

  function marginText(record) {
    return record.margin == null ? '暂无' : `${(record.margin * 100).toFixed(1)}%`;
  }

  function cardLink(record) {
    return record.reportLink ? `<a href="${htmlEscape(record.reportLink)}">打开报告</a>` : '<span class="muted">暂无报告</span>';
  }

  function snapshotLogLinks() {
    if (!latestSnapshotLogLink) return '';
    return `
      <div class="log-links">
        <a href="${htmlEscape(latestSnapshotLogLink)}">打开竞品快照日志</a>
        ${latestSnapshotHistoryLink ? `<a href="${htmlEscape(latestSnapshotHistoryLink)}">打开本轮历史日志</a>` : ''}
      </div>`;
  }

  function overviewSourceClass(status) {
    if (['已接入', '已读取', '已配置', '可选', '部分提供', '部分成功'].includes(status)) return 'on';
    if (['受限', '未完成', 'DryRun', '配置缺失', '未匹配'].includes(status)) return 'warn';
    return 'off';
  }

  function overviewSourceHealthHtml() {
    const configLine = overviewSourceConfig.ok
      ? `配置更新 ${shorten(overviewSourceConfig.updated_at, 24)}；最近检查 ${shorten(overviewSourceConfig.last_checked_at, 24)}`
      : `配置读取失败：${shorten(firstUseful(overviewSourceConfig.reason), 40)}`;
    return `
      <section class="source-health" aria-label="数据源健康摘要">
        <div class="source-health-head">
          <div>
            <strong>数据源健康</strong>
            <span>本地可用 ${localUsableCount}/3 · 高级预留未接入 ${reservedOfflineCount}/3</span>
          </div>
          <em class="${overviewSourceConfig.ok ? 'ok' : 'warn'}">${overviewSourceConfig.ok ? '配置正常' : '需检查配置'}</em>
        </div>
        <div class="source-chip-list">
          ${overviewSources
            .map(
              (source) => `
                <span class="source-chip ${overviewSourceClass(source.status)}" title="${htmlEscape(source.detail)}">
                  <strong>${htmlEscape(shorten(source.label, 24))}</strong>
                  <small>${htmlEscape(source.status)}</small>
                </span>`,
            )
            .join('')}
        </div>
        <p class="source-health-note">${htmlEscape(configLine)}。未接入的高级数据源不参与评分，当前结论按本地抓取、手工字段和竞品快照生成。</p>
      </section>`;
  }

  function localRegressionHtml() {
    const summary =
      regressionSummaryFile.ok && regressionSummaryFile.data && typeof regressionSummaryFile.data === 'object'
        ? regressionSummaryFile.data
        : null;
    const multiSummary =
      regressionMultiSummaryFile.ok && regressionMultiSummaryFile.data && typeof regressionMultiSummaryFile.data === 'object'
        ? regressionMultiSummaryFile.data
        : null;
    const desktopSummary =
      regressionDesktopSummaryFile.ok && regressionDesktopSummaryFile.data && typeof regressionDesktopSummaryFile.data === 'object'
        ? regressionDesktopSummaryFile.data
        : null;
    const overviewSummary =
      regressionOverviewSummaryFile.ok && regressionOverviewSummaryFile.data && typeof regressionOverviewSummaryFile.data === 'object'
        ? regressionOverviewSummaryFile.data
        : null;
    const counts = summary?.counts && typeof summary.counts === 'object' ? summary.counts : {};
    const statusText = summary ? (summary.ok ? 'OK' : 'FAILED') : '未生成';
    const statusClass = summary?.ok ? 'ok' : summary ? 'warn' : 'muted';
    const multiStatusText = multiSummary ? (multiSummary.ok ? 'OK' : 'FAILED') : '未生成';
    const multiStatusClass = multiSummary?.ok ? 'ok' : multiSummary ? 'warn' : 'muted';
    const desktopStatusText = desktopSummary ? (desktopSummary.ok ? 'OK' : 'FAILED') : '未生成';
    const desktopStatusClass = desktopSummary?.ok ? 'ok' : desktopSummary ? 'warn' : 'muted';
    const generated = firstUseful(summary?.generated_at, regressionSummaryFile.mtime);
    const multiGenerated = firstUseful(multiSummary?.generated_at, regressionMultiSummaryFile.mtime);
    const desktopGenerated = firstUseful(desktopSummary?.generated_at, regressionDesktopSummaryFile.mtime);
    const viewportText = (item) =>
      Array.isArray(item?.mobile_viewports) && item.mobile_viewports.length
        ? item.mobile_viewports.map((width) => `${width}px`).join(' / ')
        : '暂无数据';
    const desktopText =
      desktopSummary?.desktop_check && desktopSummary.desktop_width
        ? `${desktopSummary.desktop_width}px`
        : '暂无数据';
    const cacheStep = Array.isArray(summary?.steps) ? summary.steps.find((step) => step.id === 'adapter_cache') : null;
    const cacheStrict = summary?.strict_cache === true;
    const cacheReason = shorten(firstUseful(cacheStep?.reason, cacheStep?.stderr, cacheStep?.stdout), 150);
    const cacheStatus = (() => {
      if (!cacheStep) return { text: '未检查', className: 'muted' };
      if (cacheStep.skipped) return { text: '未生成', className: 'muted' };
      if (cacheStep.ok) return { text: cacheStrict ? '严格通过' : '检查通过', className: 'ok' };
      return { text: cacheStrict ? '严格失败' : '失败', className: 'warn' };
    })();
    const cacheGuidance = (() => {
      if (!cacheStep) return '尚未执行 cache 检查。';
      if (cacheStep.skipped) return '默认回归会跳过空 cache，不影响当前免费本地流程；接入 Keepa、SP-API 或 Ads cache 后再启用严格检查。';
      if (cacheStep.ok) return cacheStrict ? '严格 cache 已通过，可作为高级数据源回归门禁。' : 'cache 结构和敏感信息扫描通过。';
      if (cacheStrict && /No JSON cache files found/i.test(cacheReason)) {
        return 'strict-cache 已开启，但 cache 目录没有 JSON；先生成高级数据源 cache，或在免费流程中关闭 strict-cache。';
      }
      if (cacheStrict) return 'strict-cache 失败，优先检查 cache 是否 stale、expired，或缺少 fetched_at / ttl_hours。';
      return 'cache 检查失败，先查看回归 HTML 或 JSON 明细。';
    })();
    const freshness = (item, file) => {
      if (!item) return { text: '未生成', className: 'muted' };
      const timestampText = firstUseful(item.generated_at, file.mtime);
      const timestamp = Date.parse(timestampText);
      if (!Number.isFinite(timestamp)) return { text: '时间异常', className: 'warn' };
      const ageHours = (Date.now() - timestamp) / 36e5;
      if (ageHours > 24) return { text: '需重跑', className: 'warn' };
      return { text: '新鲜', className: 'ok' };
    };
    const defaultFreshness = freshness(summary, regressionSummaryFile);
    const multiFreshness = freshness(multiSummary, regressionMultiSummaryFile);
    const desktopFreshness = freshness(desktopSummary, regressionDesktopSummaryFile);
    const overviewFreshnessRaw = overviewSummary?.freshness && typeof overviewSummary.freshness === 'object' ? overviewSummary.freshness : null;
    const overviewFreshnessClass = ['ok', 'warn', 'muted'].includes(overviewFreshnessRaw?.status_class)
      ? overviewFreshnessRaw.status_class
      : overviewSummary
        ? 'ok'
        : 'muted';
    const overviewFreshnessText = firstUseful(overviewFreshnessRaw?.status, overviewSummary ? '新鲜' : '未生成');
    const overviewGenerated = firstUseful(overviewFreshnessRaw?.last_refreshed_at, overviewSummary?.generated_at, regressionOverviewSummaryFile.mtime);
    const overviewFreshUntil = firstUseful(overviewFreshnessRaw?.fresh_until);
    const overviewFreshnessMessage = firstUseful(overviewFreshnessRaw?.message, overviewSummary ? '统一回归总览已生成。' : '统一回归总览未生成。');
    const passed = typeof counts.passed === 'number' ? counts.passed : 0;
    const skipped = typeof counts.skipped === 'number' ? counts.skipped : 0;
    const failed = typeof counts.failed === 'number' ? counts.failed : 0;
    const primaryRegressionArtifacts = regressionArtifacts.filter((artifact) => artifact.label.startsWith('回归总览'));
    const detailRegressionArtifacts = regressionArtifacts.filter((artifact) => !artifact.label.startsWith('回归总览'));
    const detailGeneratedCount = detailRegressionArtifacts.filter((artifact) => artifact.exists).length;
    const artifactLinks = (artifacts) =>
      artifacts
        .map((artifact) =>
          artifact.exists
            ? `<a href="${htmlEscape(artifact.file)}">${htmlEscape(artifact.label)}</a>`
            : `<span>${htmlEscape(artifact.label)}未生成</span>`,
        )
        .join('');
    return `
      <section class="panel check-summary" aria-label="本地回归检查">
        <div class="check-head">
          <div>
            <h2>本地回归检查</h2>
            <p>统一总览：${htmlEscape(overviewGenerated)}。先看回归总览，再决定是否重新同步或执行 workflow。</p>
          </div>
          <strong class="${statusClass}">${htmlEscape(statusText)}</strong>
        </div>
        <div class="check-stats">
          <span>总览新鲜度 <b class="${overviewFreshnessClass}">${htmlEscape(overviewFreshnessText)}</b></span>
          <span>最早过期 <b>${htmlEscape(overviewFreshUntil)}</b></span>
          <span>通过 <b>${htmlEscape(passed)}</b></span>
          <span>跳过 <b>${htmlEscape(skipped)}</b></span>
          <span>失败 <b>${htmlEscape(failed)}</b></span>
          <span>默认宽度 <b>${htmlEscape(viewportText(summary))}</b></span>
          <span>默认新鲜度 <b class="${defaultFreshness.className}">${htmlEscape(defaultFreshness.text)}</b></span>
        </div>
        <div class="check-stats check-stats-secondary">
          <span>多视口 <b>${htmlEscape(viewportText(multiSummary))}</b></span>
          <span>多视口状态 <b class="${multiStatusClass}">${htmlEscape(multiStatusText)}</b></span>
          <span>多视口新鲜度 <b class="${multiFreshness.className}">${htmlEscape(multiFreshness.text)}</b></span>
          <span>多视口检查 <b>${htmlEscape(multiGenerated)}</b></span>
        </div>
        <div class="check-stats check-stats-secondary">
          <span>桌面宽度 <b>${htmlEscape(desktopText)}</b></span>
          <span>桌面状态 <b class="${desktopStatusClass}">${htmlEscape(desktopStatusText)}</b></span>
          <span>桌面新鲜度 <b class="${desktopFreshness.className}">${htmlEscape(desktopFreshness.text)}</b></span>
          <span>桌面检查 <b>${htmlEscape(desktopGenerated)}</b></span>
        </div>
        <p class="check-note">
          <strong>Cache 状态</strong>
          <b class="${cacheStatus.className}">${htmlEscape(cacheStatus.text)}</b>
          <span>${htmlEscape(cacheGuidance)}${cacheReason !== '暂无数据' ? ` 原因：${htmlEscape(cacheReason)}` : ''}</span>
        </p>
        <p class="check-note">
          <strong>总览提示</strong>
          <b class="${overviewFreshnessClass}">${htmlEscape(overviewFreshnessText)}</b>
          <span>${htmlEscape(overviewFreshnessMessage)}</span>
        </p>
        <div class="check-links check-links-primary">
          ${artifactLinks(primaryRegressionArtifacts)}
        </div>
        <details class="check-details">
          <summary>高级明细：单次回归、多视口、桌面和截图（已生成 ${htmlEscape(detailGeneratedCount)}/${htmlEscape(detailRegressionArtifacts.length)}）</summary>
          <div class="check-links check-links-detail">
            ${artifactLinks(detailRegressionArtifacts)}
          </div>
        </details>
      </section>`;
  }

  function verificationTimeText(record) {
    return record.competitorUpdatedAt === '暂无数据' ? '未验证' : shorten(record.competitorUpdatedAt, 24);
  }

  function overviewCardList(recordsForCards, mode = 'action') {
    if (!recordsForCards.length) return '<div class="mobile-card-list"><p class="muted">暂无数据</p></div>';
    return `
      <div class="mobile-card-list">
        ${recordsForCards
          .map((record) => {
            const detailLabel = mode === 'risk' ? '主要风险' : '下一步';
            const detailText = mode === 'risk' ? riskSummary(record) : actionSummary(record);
            return `
              <article class="overview-card">
                <div class="card-head">
                  <span class="score-pill">${htmlEscape(record.score ? String(record.score) : '暂无')}</span>
                  <strong>${htmlEscape(shorten(record.decision, 22))}</strong>
                </div>
                <div class="card-title">${htmlEscape(shorten(record.title, 56))}</div>
                <div class="card-meta">
                  <span>ASIN<br><strong>${htmlEscape(record.asin)}</strong></span>
                  <span>净利<br><strong>${htmlEscape(marginText(record))}</strong></span>
                  <span>竞品<br><strong>${htmlEscape(coverageText(record))}</strong></span>
                </div>
                <div class="card-line"><span>${htmlEscape(detailLabel)}</span><strong>${htmlEscape(shorten(detailText, 34))}</strong></div>
                <div class="card-foot"><span>${htmlEscape(shorten(record.createdAt, 24))}</span>${cardLink(record)}</div>
              </article>`;
          })
          .join('')}
      </div>`;
  }

  function latestCardList(recordsForCards) {
    if (!recordsForCards.length) return '<div class="mobile-card-list"><p class="muted">暂无数据</p></div>';
    return `
      <div class="mobile-card-list">
        ${recordsForCards
          .map(
            (record) => `
              <article class="overview-card">
                <div class="card-head">
                  <span class="score-pill">${htmlEscape(record.score ? String(record.score) : '暂无')}</span>
                  <strong>${htmlEscape(shorten(record.asin, 18))}</strong>
                </div>
                <div class="card-title">${htmlEscape(shorten(record.title, 56))}</div>
                <div class="card-line"><span>竞品快照</span><strong>${htmlEscape(shorten(record.competitorStatus, 34))}</strong></div>
                <div class="card-line"><span>下一步</span><strong>${htmlEscape(shorten(actionSummary(record), 34))}</strong></div>
                <div class="card-foot"><span>${htmlEscape(shorten(record.createdAt, 24))}</span>${cardLink(record)}</div>
              </article>`,
          )
          .join('')}
      </div>`;
  }

  function competitorCardList(recordsForCards) {
    if (!recordsForCards.length) return '<div class="mobile-card-list"><p class="muted">暂无数据</p></div>';
    return `
      <div class="mobile-card-list">
        ${recordsForCards
          .map(
            (record) => `
              <article class="overview-card compact-card">
                <div class="card-head">
                  <span class="score-pill">${htmlEscape(coverageText(record))}</span>
                  <strong>${htmlEscape(record.asin)}</strong>
                </div>
                <div class="card-title">${htmlEscape(shorten(record.title, 46))}</div>
                <div class="card-line"><span>状态</span><strong>${htmlEscape(shorten(record.competitorStatus, 34))}</strong></div>
                <div class="card-foot"><span>${htmlEscape(shorten(record.competitorUpdatedAt, 24))}</span>${cardLink(record)}</div>
              </article>`,
          )
          .join('')}
      </div>`;
  }

  function riskCardList(rowsForCards) {
    if (!rowsForCards.length) return '<div class="mobile-card-list"><p class="muted">暂无数据</p></div>';
    return `
      <div class="mobile-card-list">
        ${rowsForCards
          .map(
            ([label, count]) => `
              <article class="overview-card compact-card">
                <div class="card-head">
                  <span class="score-pill">${htmlEscape(count)}</span>
                  <strong>${htmlEscape(shorten(label, 30))}</strong>
                </div>
              </article>`,
          )
          .join('')}
      </div>`;
  }

  function verificationCardList(recordsForCards) {
    if (!recordsForCards.length) return '<div class="mobile-card-list"><p class="muted">暂无数据</p></div>';
    return `
      <div class="mobile-card-list">
        ${recordsForCards
          .map(
            (record) => `
              <article class="overview-card">
                <div class="card-head">
                  <span class="score-pill">${htmlEscape(record.score ? String(record.score) : '暂无')}</span>
                  <strong>${htmlEscape(shorten(record.decision, 22))}</strong>
                </div>
                <div class="card-title">${htmlEscape(shorten(record.title, 56))}</div>
                <div class="card-meta">
                  <span>ASIN<br><strong>${htmlEscape(record.asin)}</strong></span>
                  <span>竞品<br><strong>${htmlEscape(coverageText(record))}</strong></span>
                  <span>验证<br><strong>${htmlEscape(verificationTimeText(record))}</strong></span>
                </div>
                <div class="card-line"><span>状态</span><strong>${htmlEscape(shorten(record.competitorStatus, 34))}</strong></div>
                <div class="card-line"><span>下一步</span><strong>${htmlEscape(shorten(actionSummary(record), 34))}</strong></div>
                <div class="card-foot"><span>${htmlEscape(shorten(record.createdAt, 24))}</span>${cardLink(record)}</div>
              </article>`,
          )
          .join('')}
      </div>`;
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI 选品批量总览看板</title>
  <style>
    * { box-sizing: border-box; }
    html, body { max-width: 100%; overflow-x: hidden; }
    body { margin: 0; background: #f4f7fb; color: #17202c; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; line-height: 1.55; }
    .page { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 40px; }
    .hero, .panel, .metric { min-width: 0; background: #fff; border: 1px solid #dce3ee; border-radius: 8px; box-shadow: 0 14px 30px rgba(20, 32, 44, 0.07); }
    .hero { padding: 22px; margin-bottom: 14px; }
    .kicker { color: #0f766e; font-size: 13px; font-weight: 900; margin-bottom: 8px; }
    h1 { margin: 0 0 10px; font-size: 28px; line-height: 1.25; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    p { margin: 0; color: #536173; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
    .overview-boundary { margin-top: 10px; border-left: 3px solid #0f766e; background: #f0fdfa; color: #31584f; padding: 9px 11px; border-radius: 6px; font-size: 13px; line-height: 1.55; }
    .source-health { margin-top: 12px; border: 1px solid #dce3ee; border-radius: 8px; background: #f8fafc; padding: 12px; }
    .source-health-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .source-health-head strong { display: block; font-size: 15px; color: #17202c; }
    .source-health-head span { display: block; color: #64748b; font-size: 12px; margin-top: 3px; }
    .source-health-head em { flex: 0 0 auto; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-style: normal; font-weight: 900; }
    .source-health-head em.ok { background: #dcfce7; color: #166534; }
    .source-health-head em.warn { background: #ffedd5; color: #9a3412; }
    .source-chip-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .source-chip { min-width: 0; display: inline-flex; align-items: center; gap: 6px; max-width: 100%; border: 1px solid #dce3ee; border-radius: 999px; background: #fff; padding: 6px 9px; }
    .source-chip strong { min-width: 0; color: #17202c; font-size: 12px; overflow-wrap: anywhere; word-break: break-word; }
    .source-chip small { flex: 0 0 auto; font-size: 11px; font-weight: 900; color: #64748b; }
    .source-chip.on { background: #ecfdf5; border-color: #bbf7d0; }
    .source-chip.on small { color: #047857; }
    .source-chip.warn { background: #fff7ed; border-color: #fed7aa; }
    .source-chip.warn small { color: #c2410c; }
    .source-chip.off { background: #f8fafc; border-color: #dce3ee; }
    .source-health-note { margin-top: 9px; color: #64748b; font-size: 12px; line-height: 1.55; }
    .check-summary { margin-bottom: 14px; }
    .check-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .check-head h2 { margin-bottom: 4px; }
    .check-head strong { flex: 0 0 auto; border-radius: 999px; padding: 5px 10px; font-size: 12px; }
    .check-head strong.ok { background: #dcfce7; color: #166534; }
    .check-head strong.warn { background: #ffedd5; color: #9a3412; }
    .check-head strong.muted { background: #eef2f7; color: #64748b; }
    .check-stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .check-stats span { border: 1px solid #dce3ee; border-radius: 999px; background: #f8fafc; color: #64748b; font-size: 12px; padding: 6px 10px; }
    .check-stats b { color: #17202c; }
    .check-stats-secondary { margin-top: 8px; }
    .check-stats b.ok { color: #047857; }
    .check-stats b.warn { color: #9a3412; }
    .check-stats b.muted { color: #64748b; }
    .check-note { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0 0; color: #475569; font-size: 13px; }
    .check-note strong { color: #17202c; }
    .check-note b { border-radius: 999px; padding: 4px 8px; background: #f1f5f9; }
    .check-note b.ok { background: #dcfce7; color: #047857; }
    .check-note b.warn { background: #ffedd5; color: #9a3412; }
    .check-note b.muted { background: #eef2f7; color: #64748b; }
    .check-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .check-links a, .check-links span { border: 1px solid #bfdbfe; border-radius: 999px; background: #eff6ff; padding: 7px 12px; font-size: 13px; font-weight: 800; }
    .check-links span { border-color: #dce3ee; background: #f8fafc; color: #64748b; }
    .check-links-primary a:first-child { background: #0f766e; border-color: #0f766e; color: #fff; }
    .check-links-primary a:nth-child(2) { background: #f0fdfa; border-color: #99f6e4; color: #0f766e; }
    .check-details { margin-top: 10px; border: 1px solid #dce3ee; border-radius: 8px; background: #f8fafc; }
    .check-details summary { cursor: pointer; padding: 10px 12px; color: #17202c; font-size: 13px; font-weight: 900; list-style: none; }
    .check-details summary::-webkit-details-marker { display: none; }
    .check-details summary::after { content: '展开'; float: right; color: #0f766e; font-size: 12px; }
    .check-details[open] summary::after { content: '收起'; }
    .check-details:not([open]) .check-links-detail { display: none; }
    .check-links-detail { margin: 0; padding: 0 12px 12px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 14px; }
    .metric { padding: 15px; min-height: 92px; }
    .metric span { color: #64748b; font-size: 13px; display: block; margin-bottom: 7px; }
    .metric strong { font-size: 24px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.65fr); gap: 14px; }
    .grid > * { min-width: 0; }
    .panel { padding: 18px; margin-bottom: 14px; }
    .table-wrap { width: 100%; max-width: 100%; overflow-x: auto; border: 1px solid #dce3ee; border-radius: 8px; background: #fff; }
    table { width: 100%; border-collapse: collapse; min-width: 720px; font-size: 13px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #dce3ee; vertical-align: top; }
    th { color: #64748b; background: #f8fafc; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    a { color: #2563eb; text-decoration: none; font-weight: 800; }
    .muted { color: #64748b; }
    .footer { color: #64748b; font-size: 12px; margin-top: 10px; }
    .log-links { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 12px; }
    .log-links a { border: 1px solid #bfdbfe; border-radius: 999px; background: #eff6ff; padding: 7px 12px; font-size: 13px; }
    .segmented { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .view-button { border: 1px solid #dce3ee; border-radius: 999px; background: #fff; color: #334155; cursor: pointer; font: inherit; font-size: 13px; font-weight: 900; padding: 7px 12px; }
    .view-button.is-active { background: #0f766e; border-color: #0f766e; color: #fff; }
    .view-panel[hidden] { display: none !important; }
    .mobile-card-list { display: none; }
    .overview-card { min-width: 0; border: 1px solid #dce3ee; border-radius: 8px; background: #fff; padding: 12px; box-shadow: 0 8px 20px rgba(20, 32, 44, 0.05); }
    .card-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .card-head strong, .card-title, .card-line strong, .card-foot { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
    .score-pill { flex: 0 0 auto; min-width: 38px; border-radius: 999px; background: #e6f4f1; color: #0f766e; text-align: center; font-size: 13px; font-weight: 900; padding: 3px 8px; }
    .card-title { margin-top: 8px; color: #17202c; font-weight: 800; line-height: 1.35; }
    .card-meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
    .card-meta span { min-width: 0; border: 1px solid #e5edf6; border-radius: 8px; background: #f8fafc; color: #64748b; font-size: 11px; padding: 7px; }
    .card-meta strong { display: block; margin-top: 2px; color: #17202c; font-size: 12px; overflow-wrap: anywhere; word-break: break-word; }
    .card-line { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; align-items: start; margin-top: 9px; font-size: 13px; }
    .card-line span { color: #64748b; }
    .card-foot { display: flex; justify-content: space-between; gap: 10px; margin-top: 10px; color: #64748b; font-size: 12px; }
    @media (max-width: 860px) { .metrics, .grid { grid-template-columns: 1fr; } h1 { font-size: 23px; } }
    @media (max-width: 560px) {
      .page { width: 100%; max-width: 100%; padding: 14px 10px 40px; }
      .hero, .metric, .overview-card { width: 100%; max-width: 100%; }
      .hero, .metric { padding: 14px; }
      .panel { padding: 0; border: 0; background: transparent; box-shadow: none; }
      .panel h2 { margin: 0 0 10px; font-size: 16px; }
      .metrics { width: 100%; max-width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .metric { min-height: 78px; }
      .metric strong { font-size: 20px; }
      .log-links { display: grid; grid-template-columns: minmax(0, 1fr); }
      .log-links a { text-align: center; }
      .source-health-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
      .source-chip-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .source-chip { border-radius: 8px; justify-content: space-between; }
      .check-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
      .check-note { display: grid; grid-template-columns: minmax(0, 1fr); }
      .check-links { display: grid; grid-template-columns: minmax(0, 1fr); }
      .check-links a, .check-links span { text-align: center; border-radius: 8px; }
      .check-details summary::after { float: none; display: block; margin-top: 4px; }
      .segmented { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .view-button { width: 100%; }
      .desktop-table { display: none; }
      .mobile-card-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 9px; }
      .hero p, .muted, .footer, .card-title, .card-line strong { overflow-wrap: anywhere; word-break: break-all; }
      .card-foot { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="kicker">AI 选品批量总览看板</div>
      <h1>候选商品池总览</h1>
      <p>生成时间：${htmlEscape(generatedAt)}。数据来自本地 CSV 历史记录，用于快速排序、复核风险和安排下一步动作。</p>
      <p class="overview-boundary">数据边界：本看板汇总本地 CSV、单品报告证据和低频竞品快照；Keepa、SP-API、Amazon Ads API 未接入时，不代表 Amazon 官方销售、库存或广告市场数据。</p>
      ${overviewSourceHealthHtml()}
    </section>

    <section class="metrics">
      <article class="metric"><span>历史记录</span><strong>${normalized.length}</strong></article>
      <article class="metric"><span>去重候选</span><strong>${deduped.length}</strong></article>
      <article class="metric"><span>平均分</span><strong>${avgScore || '暂无'}</strong></article>
      <article class="metric"><span>可验证候选</span><strong>${ready}</strong></article>
      <article class="metric"><span>需复核/暂缓</span><strong>${review + hold}</strong></article>
      <article class="metric"><span>竞品已验</span><strong>${competitorVerified}</strong><div class="footer">平均覆盖 ${avgCompetitorCoverage || 0}%</div></article>
      <article class="metric"><span>待验竞品</span><strong>${competitorPending}</strong></article>
    </section>

    ${localRegressionHtml()}

    <section class="panel verification-workbench" data-verification-workbench data-default-view="unverified">
      <h2>竞品验证工作台</h2>
      ${snapshotLogLinks()}
      <div class="segmented" role="tablist" aria-label="竞品验证视图">
        <button class="view-button is-active" type="button" data-view-button="unverified">仅看未验证</button>
        <button class="view-button" type="button" data-view-button="recent">按验证时间</button>
      </div>
      <div class="view-panel" data-view-panel="unverified">
        ${verificationCardList(unverifiedCandidates)}
        ${rawTable(['分数', 'ASIN', '商品', '竞品覆盖', '状态', '下一步', '报告'], unverifiedRows)}
      </div>
      <div class="view-panel" data-view-panel="recent" hidden>
        ${verificationCardList(verificationSorted)}
        ${rawTable(['验证时间', '竞品覆盖', '状态', '分数', 'ASIN', '商品', '下一步', '报告'], verificationRows)}
      </div>
    </section>

    <section class="grid">
      <div>
        <article class="panel">
          <h2>去重候选池</h2>
          ${overviewCardList(deduped, 'action')}
          ${rawTable(['分数', '结论', 'ASIN', '商品', '净利率', '竞品覆盖', '下一步', '最新时间', '报告'], dedupRows)}
        </article>
        <article class="panel">
          <h2>历史候选排序</h2>
          ${overviewCardList(sortedByScore, 'risk')}
          ${rawTable(['分数', '结论', 'ASIN', '商品', '净利率', '竞品覆盖', '风险', '报告'], candidateRows)}
        </article>
        <article class="panel">
          <h2>最近运行</h2>
          ${latestCardList(sortedByTime)}
          ${rawTable(['时间', '分数', 'ASIN', '商品', '竞品快照', '下一步动作'], latestRows)}
        </article>
      </div>
      <aside>
        <article class="panel">
          <h2>竞品快照状态</h2>
          ${snapshotLogLinks()}
          ${competitorCardList(deduped.slice(0, 8))}
          ${rawTable(['ASIN', '商品', '覆盖', '状态', '更新时间'], competitorStatusRows)}
        </article>
        <article class="panel">
          <h2>风险排行</h2>
          ${riskCardList(riskRows)}
          ${rawTable(['风险', '次数'], riskRows)}
        </article>
        <article class="panel">
          <h2>使用说明</h2>
          <p class="muted">这是 V1.0 的批量总览雏形。当前按 CSV 历史记录汇总，已读取单品报告中的竞品快照证据。</p>
          <div class="footer">外部数据源未接入时，Keepa、SP-API、Ads API 不影响此看板生成，也不会参与分数或结论。</div>
        </article>
      </aside>
    </section>
  </main>
  <script>
    (() => {
      const root = document.querySelector('[data-verification-workbench]');
      if (!root) return;
      const buttons = Array.from(root.querySelectorAll('[data-view-button]'));
      const panels = Array.from(root.querySelectorAll('[data-view-panel]'));
      const activate = (view) => {
        buttons.forEach((button) => button.classList.toggle('is-active', button.dataset.viewButton === view));
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.viewPanel !== view;
        });
      };
      buttons.forEach((button) => {
        button.addEventListener('click', () => activate(button.dataset.viewButton));
      });
      activate(root.dataset.defaultView || 'unverified');
    })();
  </script>
</body>
</html>`;
}

fs.mkdirSync(reportDir, { recursive: true });

const headers = [
  'created_at',
  'asin',
  'product_url',
  'product_title',
  'price',
  'rating',
  'reviews',
  'product_summary',
  'competitive_analysis',
  'pricing_strategy',
  'listing_improvement',
  'html_report',
  'notes',
  'recommendation_score',
  'decision',
  'score_breakdown_json',
  'evidence_json',
  'risk_flags_json',
  'next_actions_json',
  'data_sources_json',
  'marketplace',
  'target_keywords',
  'competitor_asins',
  'landed_cost',
  'target_price',
  'shipping_cost',
  'platform_fee_rate',
  'platform_fee',
  'fulfillment_fee',
  'ad_cost_estimate',
  'ad_budget_hint',
];

ensureCsvHeader(csvFile, headers);

const details = getNodeJson('Extract Product Details');
const input = getNodeJson('Set the Input Fields');
const rows = [];
const reports = [];

for (const item of $input.all()) {
  const aggregate = item.json.output ?? item.json;
  const parts = flattenOutput(aggregate);
  const objects = collectObjects(parts);
  const insight = findObject(
    objects,
    (object) => object.product_insights || object.recommendations || (object.summary && typeof object.summary === 'object'),
  );
  const recommendations = insight.recommendations || findObject(objects, (object) => object.pricing_strategy || object.listing_quality_improvements);
  const bestValue = insight.product_insights?.best_value_item || {};

  const createdAt = new Date().toISOString();
  const asin = firstUseful(details.asin, bestValue.asin, insight.asin);
  const productUrl = firstUseful(details.product_url, input.product_url);
  const productTitle = firstUseful(details.title, input.product_title);
  const brand = firstUseful(details.brand);
  const price = firstUseful(details.price_hint, bestValue.price);
  const rating = firstUseful(details.rating_hint, insight.product_insights?.rating_insights);
  const reviews = firstUseful(details.reviews_hint, bestValue.reviews, insight.product_insights?.reviews_hint);
  const availability = cleanAvailability(details.availability);
  const image = firstUseful(details.image);
  const category = Array.isArray(details.breadcrumbs) && details.breadcrumbs.length ? details.breadcrumbs.join(' / ') : '暂无数据';
  const summary = paragraph(findString(objects, 'summary'));
  const competitiveAnalysis = paragraph(findString(objects, 'competitive_analysis'));
  const pricingStrategy = paragraph(recommendations.pricing_strategy);
  const listingImprovement = paragraph(recommendations.listing_quality_improvements);
  const rawPageText = oneLine(details.raw_page_text);
  const pageLooksBlocked =
    /captcha|robot check|automated access|enter the characters you see below|click the button below to continue shopping|continue shopping/i.test(
      rawPageText,
    );
  const notes = paragraph(
    pageLooksBlocked
      ? 'Amazon 当前返回了 Continue shopping、验证码或机器人检测页面；这是免费本地爬虫的限制，建议稍后重试、降低频率或更换商品链接验证。'
      : details.extraction_note || insight.metadata?.image_quality_notes,
  );
  const bullets = Array.isArray(details.bullets) ? details.bullets : [];
  const productDetails = Array.isArray(details.product_details) ? details.product_details : [];
  const blocked =
    !!details.blocked ||
    pageLooksBlocked ||
    /^Amazon\.[a-z.]+$/i.test(productTitle) ||
    (productTitle === 'Amazon.in' && price === '暂无数据' && rating === '暂无数据' && reviews === '暂无数据');

  const priceNumber = toNumber(details.price_number || price);
  const ratingNumber = toNumber(details.rating_number || rating);
  const reviewsNumber = toNumber(details.reviews_number || reviews);

  const summarySections = sectionize(summary, ['产品定位', '核心卖点', '主要规格或功能', '适合人群', '潜在风险']);
  const competitiveSections = sectionize(competitiveAnalysis, [
    '市场定位',
    '主要竞争优势',
    '竞争优势',
    '可能的劣势和转化风险',
    '劣势和转化风险',
    '适合的标题、五点描述和广告角度',
    '标题、五点描述和广告角度',
    '给跨境卖家的选品建议',
    '跨境卖家选品建议',
  ]);
  const riskText =
    summarySections.find((section) => section.label === '潜在风险')?.text ||
    competitiveSections.find((section) => section.label.includes('风险'))?.text ||
    '暂无数据';

  const manual = {
    marketplace: firstUseful(input.marketplace, details.marketplace),
    targetKeywords: parseList(input.target_keywords),
    competitorAsins: parseList(input.competitor_asins),
    landedCost: toNumber(input.landed_cost),
    targetPrice: toNumber(input.target_price),
    shippingCost: toNumber(input.shipping_cost),
    platformFeeRate: firstUseful(input.platform_fee_rate),
    platformFee: toNumber(input.platform_fee),
    fulfillmentFee: toNumber(input.fulfillment_fee),
    adCostEstimate: toNumber(input.ad_cost_estimate),
    adBudgetHint: firstUseful(input.ad_budget_hint),
    notes: firstUseful(input.notes),
  };
  manual.hasAny =
    manual.marketplace !== '暂无数据' ||
    manual.targetKeywords.length > 0 ||
    manual.competitorAsins.length > 0 ||
    manual.landedCost > 0 ||
    manual.targetPrice > 0 ||
    manual.shippingCost > 0 ||
    manual.platformFeeRate !== '暂无数据' ||
    manual.platformFee > 0 ||
    manual.fulfillmentFee > 0 ||
    manual.adCostEstimate > 0 ||
    manual.adBudgetHint !== '暂无数据' ||
    manual.notes !== '暂无数据';

  const model = buildDecisionModel({
    blocked,
    price,
    rating,
    reviews,
    availability,
    priceNumber,
    ratingNumber,
    reviewsNumber,
    bullets,
    productDetails,
    summary,
    competitiveAnalysis,
    riskText,
    manual,
  });
  const score = model.score;
  const status = decisionLabel(score, blocked);
  const focusPoints = buildFocusPoints({ price, rating, reviews, availability, ratingNumber, reviewsNumber, blocked });
  const profitDetail = buildProfitDetail({ manual, priceNumber });
  const competitorSnapshot = loadCompetitorSnapshot(manual.competitorAsins, manual.marketplace, asin);
  const riskFlags = buildRiskFlags({ blocked, ratingNumber, reviewsNumber, priceNumber, riskText, manual, profitDetail, competitorSnapshot });
  const nextActions = buildNextActions({ blocked, manual, score, profitDetail, competitorSnapshot });
  const dataSources = buildDataSources({ blocked, manual, competitorSnapshot });
  const profitRows = buildProfitRows(profitDetail);
  const competitorRows = buildCompetitorRows(manual.competitorAsins, competitorSnapshot);
  const evidence = {
    page: {
      asin,
      product_url: productUrl,
      title: productTitle,
      brand,
      price,
      rating,
      reviews,
      availability,
      category,
      bullet_count: bullets.length,
      detail_count: productDetails.length,
      blocked,
    },
    manual_inputs: {
      marketplace: manual.marketplace,
      target_keywords: manual.targetKeywords,
      competitor_asins: manual.competitorAsins,
      landed_cost: manual.landedCost || null,
      target_price: manual.targetPrice || null,
      shipping_cost: manual.shippingCost || null,
      platform_fee_rate: manual.platformFeeRate,
      platform_fee: manual.platformFee || null,
      fulfillment_fee: manual.fulfillmentFee || null,
      ad_cost_estimate: manual.adCostEstimate || null,
      ad_budget_hint: manual.adBudgetHint,
      notes: manual.notes,
    },
    profit_estimate: profitDetail,
    competitor_snapshot: competitorSnapshot,
    competitor_status: competitorRows.map((row) => ({
      order: row[0],
      asin: row[1],
      status: row[2],
      price: row[3],
      rating: row[4],
      reviews: row[5],
      note: row[6],
    })),
    ai_outputs: {
      summary_available: summary !== '暂无数据',
      competitive_analysis_available: competitiveAnalysis !== '暂无数据',
      pricing_strategy_available: pricingStrategy !== '暂无数据',
      listing_improvement_available: listingImprovement !== '暂无数据',
    },
    data_source_config: {
      file: dataSourcesConfigFile,
      status: dataSourceStatusByKey(dataSources, 'data_source_config', '配置缺失'),
      last_checked_at: dataSources.find((source) => source.key === 'data_source_config')?.meta?.last_checked_at || '暂无数据',
      owner_notes: dataSources.find((source) => source.key === 'data_source_config')?.meta?.owner_notes || '暂无数据',
    },
    data_source_details: dataSources.map((source) => ({
      key: source.key,
      label: source.label,
      status: source.status,
      detail: source.detail,
      last_checked_at: source.meta?.last_checked_at || '暂无数据',
      owner_notes: source.meta?.owner_notes || '暂无数据',
    })),
    optional_sources: {
      keepa: dataSourceStatusByKey(dataSources, 'keepa'),
      sp_api_brand_analytics: dataSourceStatusByKey(dataSources, 'sp_api'),
      amazon_ads_api: dataSourceStatusByKey(dataSources, 'amazon_ads_api'),
    },
    extraction_note: notes,
  };
  const scoreBreakdownJson = JSON.stringify(model.breakdown);
  const evidenceJson = JSON.stringify(evidence);
  const riskFlagsJson = JSON.stringify(riskFlags);
  const nextActionsJson = JSON.stringify(nextActions);
  const dataSourcesJson = JSON.stringify(dataSources);

  const safeAsin = asin === '暂无数据' ? 'unknown' : asin.replace(/[^A-Za-z0-9_-]/g, '');
  const stamp = createdAt.replace(/[:.]/g, '-');
  const reportFilename = `amazon_product_analysis_${safeAsin}_${stamp}.html`;
  const reportFile = reportDir + '/' + reportFilename;
  const reportFileWindows = pathForWindowsReport(reportFilename);
  const latestHtmlWindows = windowsOutputDir.replace(/[\\/]+$/, '') + '\\amazon_product_analysis_latest.html';

  const ratingWidth = ratingNumber > 0 ? (ratingNumber / 5) * 100 : 6;
  const reviewWidth = reviewsNumber > 0 ? clamp((Math.log10(reviewsNumber + 1) / 5) * 100, 8, 100) : 6;
  const priceWidth = priceNumber > 0 ? clamp((Math.log10(priceNumber + 1) / 5) * 100, 12, 100) : 6;
  const bubbleLeft = ratingNumber > 0 ? clamp((ratingNumber / 5) * 100, 8, 92) : 50;
  const bubbleTop = reviewsNumber > 0 ? 100 - clamp((Math.log10(reviewsNumber + 1) / 5) * 100, 10, 90) : 62;
  const mobileTitle = shorten(productTitle, 58);
  const primaryRisk = riskFlags[0] || { label: '暂无风险', text: '暂无关键风险' };
  const primaryAction = nextActions[0] || { label: '暂无动作', text: '暂无下一步动作' };
  const competitorSnapshotNote =
    competitorSnapshot?.rows?.length > 0
      ? `${competitorSnapshot.success_count}/${competitorSnapshot.rows.length} 已抓取`
      : '未提供竞品';
  const mobileCategory = shorten(category, 44);

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Amazon 商品情报分析 - ${htmlEscape(asin)}</title>
  <style>
    :root {
      --bg: #f5f7fb;
      --ink: #17202c;
      --sub: #5f6b7a;
      --line: #dce3ee;
      --panel: #ffffff;
      --teal: #0f766e;
      --blue: #2563eb;
      --amber: #b45309;
      --red: #b42318;
      --green: #047857;
      --shadow: 0 16px 34px rgba(20, 32, 44, 0.08);
    }
    * { box-sizing: border-box; }
    html, body { max-width: 100%; overflow-x: hidden; }
    body {
      margin: 0;
      background:
        linear-gradient(180deg, #eef3fb 0, #f8fafc 360px, var(--bg) 100%);
      color: var(--ink);
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      line-height: 1.55;
    }
    .page { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 40px; }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
      gap: 18px;
      align-items: stretch;
      margin-bottom: 16px;
    }
    .panel, .metric, .mini-card, .text-panel, .focus {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .intro { padding: 22px; }
    .kicker { color: var(--teal); font-size: 13px; font-weight: 800; margin-bottom: 8px; }
    h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.28; letter-spacing: 0; overflow-wrap: anywhere; word-break: break-word; }
    h2 { margin: 0 0 12px; font-size: 18px; line-height: 1.35; }
    p { margin: 0; color: #263341; overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; color: var(--sub); font-size: 13px; }
    .meta span, .decision, .product-mini, li { min-width: 0; overflow-wrap: anywhere; }
    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 800;
      background: #eef6f5;
      color: var(--teal);
    }
    .badge.good { background: #ecfdf5; color: var(--green); }
    .badge.mid { background: #eff6ff; color: var(--blue); }
    .badge.warn { background: #fff7ed; color: var(--amber); }
    .score-line { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
    .score-ring {
      width: 86px;
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: conic-gradient(var(--teal) ${score * 1}%, #e6edf5 0);
      position: relative;
      flex: 0 0 auto;
    }
    .score-ring::after { content: ""; position: absolute; inset: 9px; border-radius: 50%; background: #fff; }
    .score-ring strong { position: relative; z-index: 1; font-size: 24px; }
    .decision strong { display: block; font-size: 18px; margin-bottom: 4px; }
    .decision span { color: var(--sub); font-size: 13px; }
    .focus { margin-top: 16px; padding: 14px 16px; box-shadow: none; }
    .focus-title { font-weight: 800; margin-bottom: 8px; }
    .decision-board { margin-top: 16px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .board-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfdff;
      padding: 14px;
      min-height: 132px;
    }
    .board-card h2 { font-size: 15px; margin-bottom: 8px; color: var(--ink); }
    .board-card ul { font-size: 13px; }
    .board-card li { margin: 4px 0; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 5px 0; }
    .visual { padding: 18px; overflow: hidden; }
    .perspective { perspective: 1100px; min-height: 100%; display: grid; align-items: center; }
    .product-card {
      min-width: 0;
      min-height: 310px;
      transform: rotateY(-8deg) rotateX(2deg);
      transform-origin: center;
      border: 1px solid #d8e1ec;
      border-radius: 8px;
      background: linear-gradient(145deg, #fff, #eef5fb);
      box-shadow: 20px 22px 34px rgba(21, 40, 72, 0.14);
      padding: 18px;
      display: grid;
      grid-template-rows: 1fr auto;
      gap: 14px;
    }
    .product-image {
      width: 100%;
      height: 220px;
      object-fit: contain;
      display: block;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e5ebf3;
    }
    .image-fallback {
      height: 220px;
      display: grid;
      place-items: center;
      color: var(--sub);
      background: #fff;
      border-radius: 8px;
      border: 1px dashed #c9d4e3;
    }
    .product-mini { font-size: 13px; color: var(--sub); }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }
    .metric { padding: 15px; min-height: 96px; box-shadow: 0 8px 20px rgba(20, 32, 44, 0.05); }
    .metric-label { color: var(--sub); font-size: 13px; margin-bottom: 8px; }
    .metric-value { font-size: 18px; font-weight: 900; overflow-wrap: anywhere; }
    .metric-note { color: var(--sub); font-size: 12px; margin-top: 6px; }
    .dashboard { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr); gap: 14px; margin-bottom: 14px; }
    .bars { padding: 18px; }
    .bar-row + .bar-row { margin-top: 16px; }
    .bar-head { display: flex; justify-content: space-between; gap: 12px; color: var(--sub); font-size: 13px; margin-bottom: 7px; }
    .bar-head strong { color: var(--ink); }
    .bar-track { height: 10px; background: #e7edf5; border-radius: 999px; overflow: hidden; }
    .bar-track span { display: block; height: 100%; background: var(--teal); border-radius: inherit; }
    .bar-track .blue { background: var(--blue); }
    .bar-track .amber { background: var(--amber); }
    .breakdown { display: grid; gap: 12px; }
    .source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-top: 10px; }
    .source-note { margin: 6px 0 12px; color: var(--sub); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; word-break: break-word; }
    .source-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f8fafc;
      padding: 12px;
      min-height: 108px;
    }
    .source-card.on { background: #ecfdf5; border-color: #bbf7d0; }
    .source-card.warn { background: #fff7ed; border-color: #fed7aa; }
    .source-card strong { display: block; font-size: 13px; margin-bottom: 5px; }
    .source-card span { display: inline-flex; color: var(--teal); font-weight: 900; font-size: 12px; margin-bottom: 7px; }
    .source-card.warn span { color: var(--amber); }
    .source-card p { color: var(--sub); font-size: 12px; }
    .table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--sub); background: #f8fafc; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    .matrix { padding: 18px; }
    .matrix-box {
      position: relative;
      height: 220px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background:
        linear-gradient(90deg, transparent calc(50% - 1px), #dce3ee 0, #dce3ee calc(50% + 1px), transparent 0),
        linear-gradient(0deg, transparent calc(50% - 1px), #dce3ee 0, #dce3ee calc(50% + 1px), transparent 0),
        linear-gradient(135deg, #fff, #f0f7f6);
      overflow: hidden;
    }
    .quad { position: absolute; color: #6b7787; font-size: 12px; font-weight: 700; }
    .q1 { top: 10px; right: 12px; }
    .q2 { top: 10px; left: 12px; }
    .q3 { bottom: 10px; left: 12px; }
    .q4 { bottom: 10px; right: 12px; }
    .bubble {
      position: absolute;
      left: ${bubbleLeft.toFixed(1)}%;
      top: ${bubbleTop.toFixed(1)}%;
      transform: translate(-50%, -50%);
      width: 18px;
      aspect-ratio: 1;
      border-radius: 50%;
      background: var(--teal);
      box-shadow: 0 0 0 8px rgba(15, 118, 110, 0.16);
    }
    .axis { color: var(--sub); font-size: 12px; margin-top: 8px; display: flex; justify-content: space-between; }
    .section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
    .span-2 { grid-column: 1 / -1; }
    .mini-card, .text-panel { padding: 16px; box-shadow: 0 8px 20px rgba(20, 32, 44, 0.05); }
    .mini-label { color: var(--teal); font-size: 13px; font-weight: 900; margin-bottom: 8px; }
    .mini-card p, .text-panel p { font-size: 14px; }
    .muted { color: var(--sub); }
    .link { color: var(--blue); word-break: break-all; text-decoration: none; }
    .mobile-only { display: none; }
    .mobile-brief { display: none; }
    details { margin-top: 14px; }
    summary { cursor: pointer; font-weight: 800; color: var(--blue); }
    .raw { margin-top: 10px; padding: 14px; background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; }
    .json-block { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; color: #334155; }
    .footer { color: var(--sub); font-size: 12px; margin-top: 16px; }
    @media (max-width: 960px) {
      .hero, .dashboard, .section-grid, .decision-board { grid-template-columns: 1fr; }
      .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .source-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      h1 { font-size: 24px; }
      .product-card { transform: none; }
    }
    @media (max-width: 560px) {
      body { font-size: 13px; }
      .page { width: 100%; max-width: 1180px; padding: 14px 10px 40px; }
      .hero { display: block; width: 100%; max-width: calc(100vw - 20px); }
      .hero > .panel + .panel { margin-top: 14px; }
      .intro, .visual, .bars, .matrix, .mini-card, .text-panel { padding: 14px; }
      .intro, .visual, .panel, .metric, .product-card, .board-card { width: 100%; max-width: calc(100vw - 20px); }
      h1 { font-size: 18px; line-height: 1.25; overflow-wrap: anywhere; word-break: break-all; }
      h1, h2, .decision, .product-mini, .link, .metric-value, li, td { max-width: calc(100vw - 48px); overflow-wrap: anywhere; word-break: break-all; }
      .decision strong { font-size: 16px; }
      .desktop-title, .desktop-url { display: none; }
      .mobile-only { display: inline; }
      .meta { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; }
      .metric-grid { grid-template-columns: 1fr; }
      .source-grid { grid-template-columns: 1fr; }
      .score-line { display: block; }
      .score-ring { width: 68px; margin-bottom: 10px; }
      .decision-board { display: none; }
      .mobile-brief { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; margin-top: 14px; }
      .brief-card { min-width: 0; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; background: #fbfdff; padding: 10px; }
      .brief-card span { display: block; color: var(--sub); font-size: 12px; margin-bottom: 4px; }
      .brief-card strong { display: block; font-size: 14px; line-height: 1.28; }
      .brief-card strong, .brief-card p, .product-mini strong { max-width: 100%; white-space: normal; overflow-wrap: anywhere; word-break: break-all; }
      .brief-card p { margin-top: 4px; color: var(--sub); font-size: 12px; line-height: 1.35; }
      .product-card { min-height: 260px; padding: 12px; }
      .product-image, .image-fallback { height: 180px; }
      .matrix-box { height: 190px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="panel intro">
        <div class="kicker">AI 选品决策看板</div>
        <h1><span class="desktop-title">${htmlEscape(productTitle)}</span><span class="mobile-only">${htmlEscape(mobileTitle)}</span></h1>
        <div class="meta">
          <span class="badge ${decisionClass(status)}">${htmlEscape(status)}</span>
          <span>ASIN：${htmlEscape(asin)}</span>
          <span>品牌：${htmlEscape(brand)}</span>
          <span>站点：${htmlEscape(manual.marketplace)}</span>
          <span>生成时间：${htmlEscape(createdAt)}</span>
        </div>
        <div class="score-line">
          <div class="score-ring"><strong>${score}</strong></div>
          <div class="decision">
            <strong>选品推荐指数</strong>
            <span>基于需求、竞争、利润、Listing、口碑、运营复杂度和数据可信度的可解释评分。</span>
          </div>
        </div>
        <div class="mobile-brief">
          <article class="brief-card">
            <span>结论</span>
            <strong>${htmlEscape(status)}</strong>
            <p>${htmlEscape(score)} / 100</p>
          </article>
          <article class="brief-card">
            <span>首要风险</span>
            <strong>${htmlEscape(shorten(primaryRisk.label, 18))}</strong>
            <p>${htmlEscape(shorten(primaryRisk.text, 34))}</p>
          </article>
          <article class="brief-card">
            <span>下一步</span>
            <strong>${htmlEscape(shorten(primaryAction.label, 18))}</strong>
            <p>${htmlEscape(shorten(primaryAction.text, 34))}</p>
          </article>
          <article class="brief-card">
            <span>关键证据</span>
            <strong>竞品快照：${htmlEscape(competitorSnapshot.status)}</strong>
            <p>${htmlEscape(competitorSnapshotNote)}</p>
          </article>
        </div>
        <div class="decision-board">
          <article class="board-card">
            <h2>关键证据</h2>
            ${listHtml(focusPoints, 4)}
          </article>
          <article class="board-card">
            <h2>关键风险</h2>
            ${objectListHtml(riskFlags, 4)}
          </article>
          <article class="board-card">
            <h2>下一步动作</h2>
            ${objectListHtml(nextActions, 4)}
          </article>
        </div>
      </div>
      <div class="panel visual">
        <div class="perspective">
          <div class="product-card">
            ${image !== '暂无数据' ? `<img class="product-image" src="${htmlEscape(image)}" alt="${htmlEscape(productTitle)}">` : '<div class="image-fallback">暂无商品图片</div>'}
            <div class="product-mini">
              <strong><span class="desktop-title">${htmlEscape(category)}</span><span class="mobile-only">${htmlEscape(mobileCategory)}</span></strong><br>
              <a class="link" href="${htmlEscape(productUrl)}" target="_blank" rel="noopener noreferrer"><span class="desktop-url">${htmlEscape(productUrl)}</span><span class="mobile-only">打开商品链接</span></a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="metric-grid">
      ${metricCard('价格', price, priceNumber ? `提取数值：${priceNumber}` : '暂无价格数值')}
      ${metricCard('评分', rating, ratingNumber ? `满分 5 分中的 ${ratingNumber}` : '暂无评分数值')}
      ${metricCard('评论数', reviews, reviewsNumber ? `提取数值：${reviewsNumber}` : '暂无评论数值')}
      ${metricCard('库存', availability, '来自商品页抓取')}
    </section>

    <section class="panel intro">
      <h2>数据来源可信度</h2>
      <p class="source-note">当前结论优先基于本地免费抓取、手工成本字段和低频竞品快照；Keepa 历史趋势、SP-API 官方销售/库存、Amazon Ads 关键词和广告数据按配置显示，未接入时不参与评分。</p>
      <div class="source-grid">
        ${dataSourceHtml(dataSources)}
      </div>
    </section>

    <section class="dashboard">
      <div class="panel bars">
        <h2>评分拆解</h2>
        <div class="breakdown">
          ${model.breakdown.map((item) => bar(item.label, `${Math.round(item.score)}/${item.max}`, (item.score / item.max) * 100, item.key === 'trust' ? 'blue' : item.key === 'profit' ? 'amber' : '')).join('')}
        </div>
      </div>
      <div class="panel matrix">
        <h2>机会位置</h2>
        <div class="matrix-box">
          <span class="quad q1">高口碑 / 高热度</span>
          <span class="quad q2">低口碑 / 高热度</span>
          <span class="quad q3">低口碑 / 低热度</span>
          <span class="quad q4">高口碑 / 低热度</span>
          <span class="bubble" title="当前商品位置"></span>
        </div>
        <div class="axis"><span>评分低</span><span>评分高</span></div>
      </div>
    </section>

    <section class="section-grid">
      <div class="panel intro">
        <h2>利润估算</h2>
        ${profitRows.length ? tableHtml(['项目', '金额/比例', '说明'], profitRows) : '<p class="muted">未提供成本或售价，暂无利润估算。</p>'}
      </div>

      <div class="panel intro">
        <h2>竞品 ASIN 跟踪</h2>
        ${competitorRows.length ? tableHtml(['序号', 'ASIN', '快照状态', '价格', '评分', '评论', '说明'], competitorRows) : '<p class="muted">未提供竞品 ASIN，下一轮建议填写 3-5 个同类竞品。</p>'}
      </div>

      <div class="span-2 panel intro">
        <h2>商品摘要</h2>
        <div class="section-grid">
          ${sectionCards(summarySections, summary, 5)}
        </div>
      </div>

      <div class="panel intro">
        <h2>竞品视角</h2>
        <div class="section-grid">
          ${sectionCards(competitiveSections, competitiveAnalysis, 4)}
        </div>
      </div>

      <div class="panel intro">
        <h2>风险与动作</h2>
        <article class="mini-card">
          <div class="mini-label">主要风险</div>
          ${objectListHtml(riskFlags, 5)}
        </article>
        <article class="mini-card" style="margin-top:12px">
          <div class="mini-label">下一步动作</div>
          ${objectListHtml(nextActions, 5)}
        </article>
        <article class="mini-card" style="margin-top:12px">
          <div class="mini-label">定价建议</div>
          <p>${htmlEscape(shorten(pricingStrategy, 190))}</p>
        </article>
        <article class="mini-card" style="margin-top:12px">
          <div class="mini-label">Listing 优化</div>
          <p>${htmlEscape(shorten(listingImprovement, 190))}</p>
        </article>
      </div>

      <div class="panel intro">
        <h2>卖点提取</h2>
        ${listHtml(bullets, 6)}
      </div>

      <div class="panel intro">
        <h2>商品详情</h2>
        ${listHtml(productDetails, 6)}
      </div>
    </section>

    <section class="panel intro">
      <h2>数据说明</h2>
      <p>${htmlEscape(notes)}</p>
      <details>
        <summary>查看完整 AI 原文</summary>
        <div class="raw">
          <p><strong>商品摘要：</strong>${htmlEscape(summary)}</p>
          <p style="margin-top:10px"><strong>竞品分析：</strong>${htmlEscape(competitiveAnalysis)}</p>
        </div>
      </details>
      <details>
        <summary>查看结构化证据 JSON</summary>
        <div class="raw json-block">${htmlEscape(
          JSON.stringify(
            {
              recommendation_score: score,
              decision: status,
              score_breakdown: model.breakdown,
              evidence,
              risk_flags: riskFlags,
              next_actions: nextActions,
              data_sources: dataSources,
            },
            null,
            2,
          ),
        )}</div>
      </details>
      <div class="footer">本地免费爬虫不使用付费代理和验证码服务；如果 Amazon 返回验证码或屏蔽页面，报告会显示“暂无数据”。</div>
    </section>
  </main>
</body>
</html>`;

  fs.writeFileSync(reportFile, html, 'utf8');
  fs.writeFileSync(latestHtml, html, 'utf8');

  rows.push(
    [
      createdAt,
      asin,
      productUrl,
      productTitle,
      price,
      rating,
      reviews,
      summary,
      competitiveAnalysis,
      pricingStrategy,
      listingImprovement,
      reportFileWindows,
      notes,
      score,
      status,
      scoreBreakdownJson,
      evidenceJson,
      riskFlagsJson,
      nextActionsJson,
      dataSourcesJson,
      manual.marketplace,
      manual.targetKeywords.join('; '),
      manual.competitorAsins.join('; '),
      manual.landedCost || '',
      manual.targetPrice || '',
      manual.shippingCost || '',
      manual.platformFeeRate,
      manual.platformFee || '',
      manual.fulfillmentFee || '',
      manual.adCostEstimate || '',
      manual.adBudgetHint,
    ]
      .map(csvEscape)
      .join(','),
  );

  reports.push({
    asin,
    product_title: productTitle,
    score,
    decision: status,
    score_breakdown_json: scoreBreakdownJson,
    evidence_json: evidenceJson,
    risk_flags_json: riskFlagsJson,
    next_actions_json: nextActionsJson,
    html_report_in_container: reportFile,
    html_report_on_windows: reportFileWindows,
    latest_html_on_windows: latestHtmlWindows,
  });
}

if (!skipCsvAppend && rows.length) {
  fs.appendFileSync(csvFile, rows.join('\n') + '\n', 'utf8');
}

const overviewHtmlWindows = windowsOutputDir.replace(/[\\/]+$/, '') + '\\amazon_product_analysis_overview.html';
try {
  const overviewRecords = csvRecordsFromFile(csvFile);
  fs.writeFileSync(overviewHtml, buildOverviewReport(overviewRecords), 'utf8');
  for (const report of reports) {
    report.overview_html_in_container = overviewHtml;
    report.overview_html_on_windows = overviewHtmlWindows;
  }
} catch (error) {
  for (const report of reports) {
    report.overview_error = oneLine(error?.message || error);
  }
}

return reports.map((report) => ({ json: { saved: true, ...report } }));
