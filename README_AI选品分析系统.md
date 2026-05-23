# 跨境电商选品 AI 分析系统

这是“实现3：AI选品分析系统”的本地落地版本。系统把一个 Amazon 商品链接处理成 HTML 可视化分析报告，并同步追加 CSV 备份。

## 组成

- `n8n`：编排抓取、阿里百炼分析、报告生成。
- `amazon-crawler`：本地 Crawlee + Playwright 免费抓取服务。
- `output/amazon_product_analysis`：HTML 报告、历史报告和 CSV 数据备份。

## 关键文件

- `docker-compose.yml`：同时启动 n8n 和 amazon-crawler。
- `local-services/amazon-crawler`：本地爬虫服务源码。
- `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`：n8n 工作流导入文件。
- `docs/Amazon商品情报分析_Crawlee阿里百炼_HTML报告_SOP.md`：完整使用 SOP。

## 启动

在本目录启动服务：

```powershell
docker compose up -d --build
```

访问：

- n8n：`http://localhost:5678`
- 爬虫健康检查：`http://localhost:8787/health`

## n8n 配置

1. 在 n8n 导入 `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`。
2. 配置凭据“阿里百炼 OpenAI兼容 API”。
3. Base URL 使用：`https://dashscope.aliyuncs.com/compatible-mode/v1`
4. 模型使用：`qwen-turbo`
5. 在 `Set the Input Fields` 节点替换 `product_url`。
6. 点击 `Execute workflow`。

## 输出

- 最新 HTML：`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\amazon_product_analysis_latest.html`
- 历史 HTML：`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\reports`
- CSV 备份：`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\amazon_product_analysis.csv`

## 当前可视化版本

报告模板已优化为“结论优先 + 数据透视 + 简洁重点”的结构：

- 顶部直接显示选品推荐指数和是否进入下一轮评估。
- 中部用价格、评分、评论热度做数据透视。
- 增加机会位置矩阵，快速判断当前商品处在高口碑/高热度还是低口碑/低热度区域。
- AI 长文本拆成摘要卡、竞品卡、风险与动作卡，完整原文放入折叠区。
- 商品图使用轻微透视展示，桌面端更有层次，移动端自动改为单列易读布局。

## 本地检查

数据源健康检查：

```powershell
node tools/adapters/check_data_source_health.mjs
```

一键本地回归检查：

```powershell
node tools/run_local_regression_checks.mjs
```

一键检查结束后会自动刷新统一回归总览；如只想生成单次检查结果，可加：

```powershell
node tools/run_local_regression_checks.mjs --no-overview
```

覆盖 360/390/414 三个常见手机宽度的一键回归检查：

```powershell
node tools/run_local_regression_checks.mjs --multi-viewport
```

严格检查 cache 新鲜度的一键回归检查：

```powershell
node tools/run_local_regression_checks.mjs --strict-cache
```

增加 1366px 桌面布局检查的一键回归检查：

```powershell
node tools/run_local_regression_checks.mjs --desktop
```

手动生成默认、多视口、桌面和 cache 回归的统一总览报告：

```powershell
node tools/build_local_regression_overview.mjs
```

总览页移动端布局检查：

```powershell
node tools/check_overview_mobile_layout.mjs
```

单品最新报告移动端布局检查：

```powershell
node tools/check_latest_report_mobile_layout.mjs
```

移动端检查会打开本地总览 HTML，生成截图，并确认无横向溢出、移动卡片可见、桌面表格已隐藏。默认截图输出到：

`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\overview_mobile_layout_check.png`

单品报告检查会打开最新 HTML，生成截图，并确认第一屏决策区、推荐指数、移动摘要卡、商品视觉区和数据源卡片可见。默认截图输出到：

`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\latest_report_mobile_layout_check.png`

一键检查会串联数据源健康、adapter fixture、可选 cache、总览移动端、单品移动端和本地回归报告移动端检查。默认检查 390px 手机宽度；`--multi-viewport` 会同时检查 360px、390px、414px，并额外输出对应宽度截图；`--strict-cache` 会把 stale、expired 或缺少新鲜度字段的 cache 视为失败；`--desktop` 会额外检查 1366px 桌面总览、单品报告和本地回归报告布局。结果默认写入：

一键检查会先校验本地回归配置；如果配置文件格式错误，或 `freshness_threshold_hours` 不是正数，会先写出失败报告和修复建议，然后停止后续布局/数据源检查，避免浪费时间排查下游结果。

`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\local_regression_latest.json`

同时会生成一份适合直接打开查看的 HTML 回归报告：

`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\local_regression_latest.html`

统一回归总览报告：

`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\local_regression_overview.html`

总览看板会读取最近一次本地回归结果，默认只突出统一回归总览 HTML/JSON；单次回归、多视口、桌面和截图入口会折叠在“高级明细”里，排查时再展开。统一回归总览会显示最近刷新时间、最早过期时间和“新鲜/需重跑”状态，并在浏览器打开时再次判断是否已经过期。如果已经运行过 `--multi-viewport`，总览页也会展示 360/390/414 覆盖宽度和多视口状态；如果已经运行过 `--desktop`，总览页会展示桌面宽度和桌面状态。回归结果超过 24 小时会标记为“需重跑”。如果启用 `--strict-cache` 后失败，总览页会解释是 cache 为空、过期或缺少新鲜度字段。

统一回归总览会固定展示核心 6 类检查，同时自动发现新的正式回归结果文件：

`local_regression_*.json`

自动发现会排除统一总览自身和 `*_test.json` 临时测试文件，避免测试输出污染正式运维看板。

回归总览的新鲜度窗口可在这里调整：

`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\config\local_regression.local.json`

字段：

`freshness_threshold_hours`

临时覆盖可用环境变量：

```powershell
$env:AI_SELECTION_REGRESSION_FRESHNESS_HOURS = "48"
node tools/build_local_regression_overview.mjs
```

单独校验本地回归配置，不生成报告：

```powershell
node tools/build_local_regression_overview.mjs --validate-config
```

如果配置文件 JSON 格式错误、`freshness_threshold_hours` 不是正数、`regression_overrides` 字段类型不正确，或 `data_sources.local.json` 结构不完整，校验会返回 `ATTENTION`，并输出修复建议。统一回归总览 JSON/HTML 也会记录 `freshness_config.ok`、`errors`、`warnings`、`regression_override_validation`、`data_source_validation` 和 `repair_suggestions`，方便排查配置问题。

需要临时验证另一份数据源配置时，可以指定路径：

```powershell
node tools/build_local_regression_overview.mjs --data-sources output/amazon_product_analysis/data_sources.local.json --validate-config
```

统一回归总览 HTML 还会显示“重跑命令”区块，包含工作目录、当前回归配置文件、数据源配置文件、日常一键回归、只校验配置、只刷新总览、多视口回归、桌面回归和严格 cache 回归。打开报告后可以先确认执行目录和配置文件，再按场景选择下一步命令。

统一回归总览还会读取 `data_sources.local.json` 并展示数据源健康摘要，包括当前可用数据源、预留未接入数据源、需关注数量和最近检查时间。

数据源健康区块会同时显示结构校验结果，例如 `结构 OK` 和 `配置 6/6`。如果数据源配置缺失、字段类型错误或健康状态需关注，HTML 会直接显示三条处理命令：先校验配置、再检查报告展示、最后重跑一键回归。

统一回归总览还会读取 `n8n_status_latest.json` 并展示 n8n 服务状态。状态文件由下面的只读命令生成，不触发工作流执行：

```powershell
node tools/check_n8n_status.mjs
```

总览里的 n8n 状态会直接显示授权来源、是否检测到已保存凭据、Key 是否可用，以及凭据文件位置；日常排查时不需要先打开 JSON。

一键本地回归报告 `local_regression_latest.html` 的顶部也会显示同一份 n8n 状态摘要，方便先看本轮回归结果时直接判断 API 是否授权。

一键本地回归还会单独打开 `local_regression_latest.html` 做移动端布局检查，并生成截图：

`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\local_regression_summary_mobile_layout_check.png`

开启 `--desktop` 时，也会打开同一份本地回归报告做桌面布局检查，并生成截图：

`C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\local_regression_summary_desktop_layout_check.png`

单独检查命令：

```powershell
node tools/check_regression_summary_mobile_layout.mjs
node tools/check_regression_summary_mobile_layout.mjs --width 1366 --height 1000 --screenshot output\amazon_product_analysis\local_regression_summary_desktop_layout_check.png
```

授权有两种方式：

1. 推荐方式：运行本地保存脚本，API Key 会保存到当前 Windows 用户的加密凭据文件，后续 Codex 脚本会自动读取。

```powershell
powershell -ExecutionPolicy Bypass -File tools\set_n8n_api_key.ps1
node tools/check_n8n_status.mjs
```

2. 临时方式：只在当前终端设置环境变量，关闭终端后失效。

```powershell
$env:N8N_API_KEY = "你的 n8n API Key"
node tools/check_n8n_status.mjs
```

如果没有保存凭据，也没有设置 `N8N_API_KEY`，n8n 页面和爬虫健康检查仍可显示为正常，但 API 会显示“未授权”。

如果已经保存凭据或设置了 `N8N_API_KEY`，但状态显示“API Key 被拒绝”，说明当前 key 被 n8n 返回了 401/403。通常是复制不完整、带了多余空格/换行、key 已删除/过期，或当前 n8n 实例不是创建这个 key 的实例。重新在 n8n API 页面复制完整 key 后，再运行 `tools\set_n8n_api_key.ps1` 或重新设置环境变量。

默认情况下，n8n API 未授权只作为运维提醒，不会让本地回归失败。需要在 API 自动执行前强制校验授权时，使用严格模式：

```powershell
node tools/check_n8n_status.mjs --fail-on-api-unauthorized
node tools/run_local_regression_checks.mjs --strict-n8n-api
```

自动发现的 `local_regression_*.json` 回归项可以在本地回归配置里覆盖展示名称、角色、预期失败状态和是否计入总状态。路径覆盖不开放，避免配置误指向其他文件。

如果 `regression_overrides` 配置了当前不存在的回归项 id，校验和总览会显示“未知覆盖 id”提示，但不会阻断回归。这适合先预留未来回归项配置，等对应 `local_regression_<id>.json` 生成后自动生效。统一回归总览的摘要指标也会显示“未知覆盖”数量，打开首页就能判断是否有预留项还没有生成。

```json
{
  "freshness_threshold_hours": 24,
  "regression_overrides": {
    "with_fixture_cache": {
      "title": "Fixture Cache 合同回归",
      "role": "adapter_cache",
      "expected_failure": false,
      "include_in_status": true
    }
  }
}
```
