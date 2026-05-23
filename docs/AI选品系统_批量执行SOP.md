# AI 选品分析系统批量执行 SOP

最后更新：2026-05-23

## 目标

用本地 CSV 批量触发现有 n8n webhook，逐个生成 Amazon 单品分析报告，并自动刷新总览看板。

## 文件位置

- 批量输入模板：`input/amazon_products_batch_template.csv`
- 批量执行脚本：`tools/run_amazon_batch_from_csv.ps1`
- 最新单品报告：`output/amazon_product_analysis/amazon_product_analysis_latest.html`
- 批量总览看板：`output/amazon_product_analysis/amazon_product_analysis_overview.html`
- 批量运行结果：`output/amazon_product_analysis/batch_run_时间.json`
- 批量失败行：`output/amazon_product_analysis/batch_failed_时间.csv`

## CSV 字段

- `product_url`：Amazon 商品链接，必填。
- `marketplace`：站点，例如 `amazon.in`、`amazon.com`。
- `target_keywords`：目标关键词，用英文逗号分隔。
- `competitor_asins`：竞品 ASIN，用英文逗号分隔。
- `landed_cost`：采购到岸成本。
- `target_price`：目标售价。
- `shipping_cost`：物流/运费。
- `platform_fee_rate`：平台费率，例如 `15%`。
- `platform_fee`：平台费固定值；填写后优先于费率。
- `fulfillment_fee`：履约/FBA 费用估算。
- `ad_cost_estimate`：广告成本估算。
- `ad_budget_hint`：广告预算备注。
- `notes`：补充说明。

## 推荐执行顺序

1. 先复制模板，另存为自己的批量输入文件。
2. 先干跑 1 行，确认 CSV 字段能被正确读取。
3. 小批量执行 1-3 行，观察报告、CSV 和总览看板。
4. 确认稳定后再提高 `Limit`，并保持合理延迟。
5. 如有失败，查看失败 CSV，修正后复跑失败行。

## 常用命令

查看帮助：

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_amazon_batch_from_csv.ps1 -ShowHelp
```

干跑 1 行，不触发 n8n：

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_amazon_batch_from_csv.ps1 -DryRun -Limit 1
```

低频执行前 3 行：

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_amazon_batch_from_csv.ps1 -Limit 3 -DelaySeconds 30
```

指定自己的 CSV：

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_amazon_batch_from_csv.ps1 -CsvPath input\my_products.csv -Limit 3 -DelaySeconds 30
```

复跑失败行：

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_amazon_batch_from_csv.ps1 -CsvPath output\amazon_product_analysis\batch_failed_YYYYMMDD_HHMMSS.csv -Limit 1
```

## 成本和频率建议

- 每次真实执行都会调用本地爬虫和阿里百炼。
- 批量前先用 `-DryRun`。
- 首次批量建议 `-Limit 3 -DelaySeconds 30`。
- 遇到 Amazon 验证码、Continue Shopping 或字段缺失时，降低频率并稍后重试。
- 失败行 CSV 可以复跑，不需要手工重新整理全部输入。

## 输出检查

每轮批量后优先检查：

1. `batch_run_时间.json`：确认成功和失败数量。
2. `batch_failed_时间.csv`：如存在，说明有失败行。
3. `amazon_product_analysis_latest.html`：最新单品报告。
4. `amazon_product_analysis_overview.html`：去重候选池、历史候选排序和风险排行。
5. `amazon_product_analysis.csv`：完整历史数据。

## 当前边界

- 这个脚本是本地批量入口，不是 n8n 内置 Split in Batches。
- 竞品 ASIN 当前只记录和展示，尚未逐个抓取。
- 平台费、履约费、广告成本仍是估算或手工输入，尚未接入 SP-API Product Fees 或 Ads API。
