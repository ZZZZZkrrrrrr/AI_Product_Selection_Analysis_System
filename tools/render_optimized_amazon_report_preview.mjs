import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'output', 'amazon_product_analysis');
const csvPath = path.join(outputDir, 'amazon_product_analysis.csv');
const codePath = path.join(__dirname, 'n8n_html_report_code_optimized.js');

function parseCsv(text) {
  const rows = [];
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
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const [headers, ...records] = rows.filter((item) => item.length > 1);
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] || ''])));
}

async function scrape(productUrl) {
  try {
    const response = await fetch('http://localhost:8787/scrape', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: productUrl, timeoutMs: 20000 }),
    });
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

const rows = parseCsv(readUtf8(csvPath));
const latest = rows.at(-1);
if (!latest) throw new Error('CSV 中没有可用于预览的数据');

const scraped = await scrape(latest.product_url);
const details = {
  source: scraped.source || 'Crawlee + Playwright local',
  product_url: scraped.requested_url || latest.product_url,
  loaded_url: scraped.loaded_url || latest.product_url,
  asin: scraped.asin || latest.asin,
  title: scraped.title || latest.product_title,
  brand: scraped.brand || '暂无数据',
  price_hint: scraped.price || latest.price,
  price_number: scraped.price_number || 0,
  rating_hint: scraped.rating || latest.rating,
  rating_number: scraped.rating_number || 0,
  reviews_hint: scraped.reviews || latest.reviews,
  reviews_number: scraped.reviews_number || 0,
  availability: scraped.availability || '暂无数据',
  breadcrumbs: scraped.breadcrumbs || [],
  bullets: scraped.bullets || [],
  product_details: scraped.details || [],
  description: scraped.description || '暂无数据',
  image: scraped.image || '',
  blocked: !!scraped.blocked,
  extraction_note: latest.notes || '数据来自本机 Crawlee + Playwright 免费爬虫服务。',
};

const inputItems = [
  {
    json: {
      output: [
        {
          summary: {
            total_items: 1,
            unique_asins: details.asin && details.asin !== '暂无数据' ? 1 : 0,
            duplicated_asins_with_counts: {},
            average_price: details.price_number || 0,
            min_price: details.price_number || 0,
            max_price: details.price_number || 0,
            average_reviews: details.reviews_number || 0,
          },
          product_insights: {
            best_value_item: {
              asin: details.asin,
              price: details.price_number || 0,
              reviews: details.reviews_number || 0,
            },
            rating_insights: details.rating_hint,
          },
          recommendations: {
            pricing_strategy: latest.pricing_strategy,
            listing_quality_improvements: latest.listing_improvement,
          },
          metadata: { image_quality_notes: latest.notes },
        },
        { summary: latest.product_summary },
        { competitive_analysis: latest.competitive_analysis },
      ],
    },
  },
];

process.env.AMAZON_REPORT_OUTPUT_DIR = outputDir;
process.env.AMAZON_REPORT_WINDOWS_DIR = outputDir;
process.env.AMAZON_REPORT_PREVIEW_NO_CSV = '1';

const code = readUtf8(codePath);
const fn = new Function('$node', '$input', 'require', code);
const result = fn(
  {
    'Extract Product Details': { json: details },
    'Set the Input Fields': {
      json: {
        product_url: latest.product_url,
        marketplace: latest.marketplace,
        target_keywords: latest.target_keywords,
        competitor_asins: latest.competitor_asins,
        landed_cost: latest.landed_cost,
        target_price: latest.target_price,
        shipping_cost: latest.shipping_cost,
        platform_fee_rate: latest.platform_fee_rate,
        platform_fee: latest.platform_fee,
        fulfillment_fee: latest.fulfillment_fee,
        ad_cost_estimate: latest.ad_cost_estimate,
        ad_budget_hint: latest.ad_budget_hint,
        notes: latest.notes,
      },
    },
  },
  { all: () => inputItems },
  require,
);

console.log(JSON.stringify(result, null, 2));
