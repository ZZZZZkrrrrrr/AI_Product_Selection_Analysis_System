import express from 'express';
import { Configuration, PlaywrightCrawler } from 'crawlee';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '1mb' }));

function normalizeUrl(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseNumber(text) {
  if (!text) return null;
  const match = String(text).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseAsin(url) {
  const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

async function scrapeAmazon(url, options = {}) {
  const storageDir = path.join(os.tmpdir(), `crawlee-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const config = new Configuration({ storageDir });
  const timeoutMs = Math.min(Number(options.timeoutMs || 45000), 90000);
  let result = null;
  let failure = null;

  const crawler = new PlaywrightCrawler(
    {
      maxRequestsPerCrawl: 1,
      maxRequestRetries: 0,
      requestHandlerTimeoutSecs: Math.ceil(timeoutMs / 1000) + 10,
      launchContext: {
        launchOptions: {
          headless: true,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox',
          ],
        },
      },
      preNavigationHooks: [
        async ({ page }, gotoOptions) => {
          await page.setViewportSize({ width: 1365, height: 900 });
          await page.setExtraHTTPHeaders({
            'accept-language': 'en-US,en;q=0.9',
            'upgrade-insecure-requests': '1',
          });
          gotoOptions.waitUntil = 'domcontentloaded';
          gotoOptions.timeout = timeoutMs;
        },
      ],
      async requestHandler({ page, request }) {
        await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
        await page.waitForTimeout(1500);

        result = await page.evaluate(() => {
          const text = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() || '';
          const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || '';
          const allText = (selector) =>
            Array.from(document.querySelectorAll(selector))
              .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
              .filter(Boolean);

          const title =
            text('#productTitle') ||
            text('#title') ||
            text('h1') ||
            document.title.replace(/\s*-\s*Amazon.*$/i, '').trim();

          const price =
            text('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen') ||
            text('#corePrice_feature_div .a-price .a-offscreen') ||
            text('.a-price .a-offscreen') ||
            text('#priceblock_ourprice') ||
            text('#priceblock_dealprice') ||
            text('#price_inside_buybox');

          const rating =
            text('#acrPopover .a-icon-alt') ||
            text('#averageCustomerReviews .a-icon-alt') ||
            text('[data-hook="rating-out-of-text"]');

          const reviews =
            text('#acrCustomerReviewText') ||
            text('[data-hook="total-review-count"]') ||
            text('#reviewsMedley .a-size-base');

          const brand =
            text('#bylineInfo') ||
            text('a#bylineInfo') ||
            text('#brand') ||
            text('tr.po-brand td:nth-child(2)');

          const availability = text('#availability') || text('#outOfStock') || text('#availabilityInsideBuyBox_feature_div');
          const bullets = allText('#feature-bullets li span.a-list-item').slice(0, 12);
          const details = allText('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, #detailBullets_feature_div li').slice(0, 30);
          const description = text('#productDescription') || text('#aplus') || text('#feature-bullets');
          const breadcrumbs = allText('#wayfinding-breadcrumbs_feature_div li a').slice(0, 8);
          const image = attr('#landingImage', 'src') || attr('#imgTagWrapperId img', 'src') || attr('meta[property="og:image"]', 'content');
          const canonical = attr('link[rel="canonical"]', 'href');
          const bodyText = document.body?.innerText?.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || '';
          const blocked = /captcha|robot check|automated access|enter the characters you see below|click the button below to continue shopping|continue shopping/i.test(bodyText);

          return {
            page_title: document.title,
            title,
            price,
            rating,
            reviews,
            brand,
            availability,
            bullets,
            details,
            description,
            breadcrumbs,
            image,
            canonical,
            blocked,
            raw_text: bodyText.slice(0, 30000),
          };
        });

        result = {
          ok: true,
          source: 'Crawlee + Playwright local',
          requested_url: request.url,
          loaded_url: page.url(),
          asin: parseAsin(request.url) || parseAsin(page.url()),
          scraped_at: new Date().toISOString(),
          ...result,
          price_number: parseNumber(result?.price),
          rating_number: parseNumber(result?.rating),
          reviews_number: parseNumber(result?.reviews),
        };
      },
      failedRequestHandler({ request, error }) {
        failure = {
          ok: false,
          requested_url: request.url,
          error: error?.message || 'Request failed',
          scraped_at: new Date().toISOString(),
        };
      },
    },
    config,
  );

  try {
    await crawler.run([url]);
    return result || failure || { ok: false, requested_url: url, error: 'No result returned' };
  } finally {
    await rm(storageDir, { recursive: true, force: true }).catch(() => {});
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'amazon-crawler-local', crawler: 'Crawlee + Playwright' });
});

app.post('/scrape', async (req, res) => {
  const url = normalizeUrl(req.body?.url);
  if (!url) {
    res.status(400).json({ ok: false, error: 'Missing or invalid url' });
    return;
  }

  try {
    const data = await scrapeAmazon(url, { timeoutMs: req.body?.timeoutMs });
    res.status(data.ok ? 200 : 502).json(data);
  } catch (error) {
    res.status(500).json({
      ok: false,
      requested_url: url,
      error: error?.message || String(error),
      scraped_at: new Date().toISOString(),
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`amazon-crawler-local listening on ${port}`);
});
