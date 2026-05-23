# AI Selection Data Adapter Contracts

Last checked: 2026-05-23

This directory defines future adapter contracts only. It does not call Keepa, SP-API, Amazon Ads API, or any paid service.

## Design Rules

1. Adapters are read-only in V1.x.
2. No API key, refresh token, client secret, seller data, or ad account credential can be written to HTML, CSV, JSON evidence, screenshots, or logs.
3. Report generation reads cached adapter outputs. It must not fan out into paid APIs during normal HTML rendering.
4. Every adapter must return a stable status, evidence payload, cost hint, cache metadata, and error object.
5. Missing credentials must become `not_connected` or `missing_config`, not a workflow failure.
6. PII is out of scope for V1.x.

## Common Request

```json
{
  "trace_id": "amazon_product_analysis_B0BQXZ11B8_20260523",
  "source": "keepa",
  "marketplace": "amazon.in",
  "asin": "B0BQXZ11B8",
  "source_asin": "B0BQXZ11B8",
  "competitor_asins": ["B08FC6C75Y", "B09V4B6K53", "B0BY8QNV1C"],
  "target_keywords": ["ps5 controller", "dualsense controller"],
  "date_range": {
    "from": "2026-04-23",
    "to": "2026-05-23"
  },
  "cache_policy": {
    "mode": "read_through",
    "ttl_hours": 24,
    "allow_stale": true
  },
  "dry_run": true
}
```

## Common Response

```json
{
  "ok": true,
  "source": "keepa",
  "status": "connected",
  "status_label": "已接入",
  "fetched_at": "2026-05-23T06:30:00+08:00",
  "cache": {
    "hit": true,
    "stale": false,
    "cache_key": "amazon.in:B0BQXZ11B8:keepa:2026-05-23",
    "path": "output/amazon_product_analysis/cache/keepa/amazon.in/B0BQXZ11B8.json",
    "ttl_hours": 24
  },
  "cost": {
    "billable": false,
    "unit": "request_or_token",
    "estimated_units": 0,
    "note": "cache hit"
  },
  "data": {},
  "evidence": [],
  "risk_flags": [],
  "error": null,
  "next_retry_at": null
}
```

## Status Mapping

| Adapter status | Report status | Meaning |
| --- | --- | --- |
| `connected` | 已接入 | Adapter returned usable data. |
| `configured` | 已配置 | Credentials/config exist, but not verified in this run. |
| `not_connected` | 未接入 | Reserved or disabled. |
| `missing_config` | 配置缺失 | Required credential or config is absent. |
| `rate_limited` | 限流 | External API returned throttling or quota pressure. |
| `quota_exhausted` | 额度不足 | Paid quota/token pool is exhausted. |
| `permission_denied` | 权限不足 | Account/app lacks permission. |
| `auth_expired` | 授权过期 | Refresh or reauthorization required. |
| `failed` | 获取失败 | Non-recoverable adapter failure. |

## Keepa Adapter Contract

Purpose:

- Historical price.
- BSR / sales rank trend.
- Buy Box trend.
- Offer and seller count trend.
- Review/rating history if available.

Required config:

- `KEEPA_API_KEY`

Request additions:

```json
{
  "source": "keepa",
  "asin": "B0BQXZ11B8",
  "marketplace": "amazon.in",
  "history_days": 180,
  "metrics": ["price", "bsr", "buy_box", "seller_count", "rating", "reviews"]
}
```

Response `data` shape:

```json
{
  "price_history": [],
  "bsr_history": [],
  "buy_box_history": [],
  "seller_count_history": [],
  "review_history": [],
  "summary": {
    "price_trend": "stable",
    "bsr_trend": "unknown",
    "volatility_score": null,
    "last_observed_price": null
  }
}
```

Rules:

- Cache by `marketplace + asin + keepa + date`.
- Default TTL: 24 hours.
- If quota is exhausted, return `quota_exhausted` and keep the latest stale cache if available.
- Do not call Keepa from the n8n report node directly.

Official references:

- https://keepa.com/#!api
- https://keepaapi.readthedocs.io/en/stable/

## SP-API Adapter Contract

Purpose:

- Official catalog attributes.
- Product fee estimates.
- Seller-authorized inventory, orders, sales, and reports.
- Brand Analytics or Search Query Performance where authorized.

Required config:

- `SP_API_CLIENT_ID`
- `SP_API_CLIENT_SECRET`
- `SP_API_REFRESH_TOKEN`
- `SP_API_ROLE_ARN`
- `SP_API_REGION`
- `SP_API_MARKETPLACE_ID`

Request additions:

```json
{
  "source": "sp_api",
  "asin": "B0BQXZ11B8",
  "marketplace_id": "A21TJRUUN4KGV",
  "operations": ["catalog_items", "product_fees", "reports"],
  "pii_allowed": false,
  "seller_authorization_ref": "n8n_credential_or_env_ref"
}
```

Response `data` shape:

```json
{
  "catalog": {},
  "fees": {},
  "inventory": {},
  "sales_summary": {},
  "reports": [],
  "brand_analytics": {}
}
```

Rules:

- V1.x must not request or persist PII.
- OAuth/LWA tokens must stay in credentials or environment variables.
- Respect operation-level rate limits and token bucket throttling.
- Use cache and backoff for 429 responses.
- Return `permission_denied` for 403 and `auth_expired` for refresh-token failure.

Official references:

- https://developer-docs.amazon.com/sp-api/lang-en_US/
- https://developer-docs.amazon.com/sp-api/lang-US/docs/connecting-to-the-selling-partner-api
- https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits

## Amazon Ads API Adapter Contract

Purpose:

- Read-only campaign, ad group, keyword, and report data.
- Impressions, clicks, spend, sales, conversions, ACOS, and TACOS.
- Keyword validation for Listing and small-budget tests.

Required config:

- `AMAZON_ADS_CLIENT_ID`
- `AMAZON_ADS_CLIENT_SECRET`
- `AMAZON_ADS_REFRESH_TOKEN`
- `AMAZON_ADS_PROFILE_ID`
- `AMAZON_ADS_REGION`

Request additions:

```json
{
  "source": "amazon_ads_api",
  "profile_id": "1234567890",
  "marketplace": "amazon.in",
  "asin": "B0BQXZ11B8",
  "keywords": ["ps5 controller", "dualsense controller"],
  "date_range": {
    "from": "2026-04-23",
    "to": "2026-05-23"
  },
  "read_only": true
}
```

Response `data` shape:

```json
{
  "profile": {},
  "campaigns": [],
  "keywords": [],
  "reports": [],
  "summary": {
    "impressions": 0,
    "clicks": 0,
    "spend": 0,
    "sales": 0,
    "acos": null,
    "tacos": null
  }
}
```

Rules:

- V1.x is read-only. Do not create campaigns, change bids, change budgets, or launch ads.
- API access and ad spend are separate concerns. The adapter must not imply free ad traffic.
- Missing profile ID returns `missing_config`.
- Report delay returns `failed` or `configured` with a retry hint, not a report failure.

Official reference:

- https://advertising.amazon.com/about-api

## Cache Layout

Future adapters should write only sanitized cache files:

```text
output/amazon_product_analysis/cache/
  keepa/{marketplace}/{asin}.json
  sp_api/{marketplace}/{asin}.json
  amazon_ads_api/{profile_id}/{asin_or_keyword_hash}.json
```

Cache files must not contain credentials.

## Local Validation

Use the local validator before any adapter cache is consumed by reports:

```text
node tools/adapters/validate_adapter_contract.mjs output/amazon_product_analysis/cache/keepa/amazon.in/B0BQXZ11B8.json
```

Self-test:

```text
node tools/adapters/validate_adapter_contract.mjs --self-test
```

The validator checks only local JSON structure. It does not call external APIs and does not need credentials.

Sanitized fixture check:

```text
node tools/adapters/validate_adapter_contract.mjs tools/adapters/fixtures/*.sample.json
```

Fixtures under `tools/adapters/fixtures/` are fake, sanitized examples. They must not be replaced with raw API responses or files containing credentials.

Sensitive-pattern scan:

```text
node tools/adapters/validate_adapter_contract.mjs --scan-sensitive tools/adapters/fixtures/*.sample.json
```

Run this scan before sharing cache samples or fixture files. It checks for common key, secret, token, authorization header, AWS access key, and password patterns.

One-command fixture check:

```text
node tools/adapters/validate_adapter_contract.mjs --check-all-fixtures
```

This runs self-test, fixture contract validation, and fixture sensitive-pattern scanning in sequence.

Use another sanitized fixture directory:

```text
node tools/adapters/validate_adapter_contract.mjs --check-all-fixtures --fixtures-dir tools/adapters/fixtures
```

The custom directory must contain `*.sample.json` files. Use this when a future Keepa, SP-API, or Amazon Ads adapter keeps its own sanitized examples outside the default fixture folder.

Data source health check:

```text
node tools/adapters/check_data_source_health.mjs
```

JSON output for automation or debugging:

```text
node tools/adapters/check_data_source_health.mjs --json
```

This reads only local files: `data_sources.local.json`, the latest HTML report, and sanitized adapter fixtures. It does not call external APIs and does not print credential values.

Cache directory validation:

```text
node tools/adapters/validate_adapter_contract.mjs --cache-dir output/amazon_product_analysis/cache
```

This recursively checks local `.json` cache files for the adapter contract and common sensitive patterns. Use it only after an adapter writes sanitized cache output; it does not create cache files and does not call external APIs.

The cache check also prints a source-level freshness summary:

- files per `source`
- status counts
- stale cache count
- TTL-expired cache count
- oldest and newest `fetched_at`

Stale or expired cache entries are warnings. They do not fail the command unless the JSON contract or sensitive-pattern scan fails.

## Pre-Integration Checklist

Use this checklist before changing any adapter status from `not_connected` to `configured` or `connected`.

### 1. Scope

- Confirm the adapter is read-only.
- Confirm the target marketplace, source ASIN, competitor ASINs, and date range.
- Confirm the adapter output will improve a specific score, evidence field, risk flag, or next action.
- Keep PII out of scope for V1.x.

### 2. Configuration

- Put secrets only in environment variables or n8n credentials.
- Do not write API keys, refresh tokens, client secrets, seller identifiers, ad account secrets, or authorization headers to files in this repo.
- Update `output/amazon_product_analysis/data_sources.local.json` from `not_connected` to `configured` only after credentials exist outside the repo.
- Add or update `last_checked_at` and `owner_notes` before the first test.

### 3. Dry Run

- Run one ASIN only.
- Keep Amazon Ads API read-only; do not create campaigns, change bids, change budgets, or launch ads.
- Keep SP-API PII operations disabled.
- Record the adapter status as `configured`, `missing_config`, `permission_denied`, `auth_expired`, `rate_limited`, or `quota_exhausted` instead of throwing a report-level failure.

### 4. Cache

- Write sanitized cache output under `output/amazon_product_analysis/cache/`.
- Use a cache key that includes source, marketplace, ASIN or keyword hash, and date.
- Do not store credentials, authorization headers, raw error traces with tokens, seller PII, or ad account secrets in cache files.
- Set a TTL before batch usage. Keepa-style trend data should start with a 24-hour TTL.
- Allow stale cache fallback when live refresh fails.

### 5. Validation

- Validate the cache file locally:

```text
node tools/adapters/validate_adapter_contract.mjs <cache-file.json>
```

- Re-run fixture checks:

```text
node tools/adapters/validate_adapter_contract.mjs tools/adapters/fixtures/*.sample.json
```

- Scan any new fixture or cache sample for obvious sensitive strings before committing or sharing.
- Run `--scan-sensitive` on every fixture/cache sample before it is used in documentation, screenshots, or reports.
- Use `--check-all-fixtures` after changing the schema, validator, or fixture files.
- Use `--check-all-fixtures --fixtures-dir <dir>` when validating sanitized samples from a non-default adapter fixture directory.
- Run `check_data_source_health.mjs` before changing report scoring logic or enabling a reserved adapter.
- Run `--cache-dir <dir>` before allowing a real adapter cache directory to feed report evidence.
- Treat stale/expired cache warnings as a prompt to refresh the adapter cache before relying on trend or ad-performance evidence.

### 6. Cost And Rate Limits

- Estimate whether the request is billable before enabling it.
- Keep adapter calls out of the n8n report-rendering node.
- Batch jobs must set a batch size, delay, retry limit, and daily budget or request cap.
- SP-API 429 responses must use backoff and cache fallback.
- Keepa quota or token exhaustion must return `quota_exhausted`.
- Amazon Ads report delay must return a retry hint, not a workflow failure.

### 7. Report Integration

- Reports read adapter cache only.
- Evidence must state the source and confidence.
- Missing adapter data must not reduce report generation reliability.
- Update `data_sources.local.json` after verification:
  - `configured` after credentials and dry-run are ready.
  - `connected` only after one sanitized cache output validates.
  - `not_connected` when disabled.

### 8. Rollback

- Set the adapter status back to `not_connected`.
- Keep the latest valid cache only if it is sanitized and still useful.
- Do not delete the base Crawlee + manual input + competitor snapshot flow.
- Confirm n8n still generates the report without the adapter.

## Integration Points

Current V1 files:

- `config/data_sources.example.json`
- `output/amazon_product_analysis/data_sources.local.json`
- `tools/n8n_html_report_code_optimized.js`
- `docs/AI选品系统_V1数据源接入SOP.md`

When an adapter becomes real:

1. Change its config status from `not_connected` to `configured`.
2. Run one ASIN in dry-run or read-only mode.
3. Write sanitized cache output.
4. Let the report read cache.
5. Only then allow batch usage.
