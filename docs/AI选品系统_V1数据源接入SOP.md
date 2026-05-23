# AI 选品分析系统 V1 数据源接入 SOP

最后确认时间：2026-05-23

适用系统：Amazon 商品情报分析 - Crawlee 免费抓取 + 阿里百炼 + HTML 报告

## 1. 目标

把 V1 系统的数据源分成“当前可用、免费兜底、付费增强、官方增强”四类，并统一管理接入状态。

当前 V1 的原则：

1. Crawlee + Playwright 是免费本地兜底数据源。
2. 手工增强字段是利润、关键词、竞品判断的必要补充。
3. 竞品快照是低频、免费、可审计的竞品对照。
4. Keepa、SP-API、Amazon Ads API 暂不强制接入；未配置时必须显示“未接入”，不能报错。
5. AI 只负责摘要、解释和建议；关键评分仍由可解释字段和证据驱动。

## 2. 当前配置文件

示例配置：

```text
C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\config\data_sources.example.json
```

本地运行配置：

```text
C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\data_sources.local.json
```

报告生成节点默认读取：

```text
outputDir + '/data_sources.local.json'
```

也可以通过环境变量覆盖：

```text
AMAZON_DATA_SOURCES_CONFIG_FILE
```

状态约定：

| 配置值 | 报告显示 | 含义 |
| --- | --- | --- |
| `enabled` | 已接入 | 当前可用 |
| `configured` | 已配置 | 凭据或配置已准备，待运行验证 |
| `optional` | 可选 | 手工增强类字段 |
| `partial` | 部分提供 | 数据不完整但可用 |
| `not_connected` | 未接入 | V1 预留，当前不调用 |
| `missing_config` | 配置缺失 | 文件或关键配置缺失 |
| `disabled` | 未接入 | 手动禁用 |

## 3. 数据源优先级

### P0：Crawlee + Playwright 本地抓取

用途：

- 抓取 Amazon 商品页公开字段。
- 提取标题、价格、评分、评论数、品牌、库存、五点描述、详情、图片、页面文本。
- 作为系统免费运行的基础。

当前状态：

- 已接入。
- 由 `amazon-crawler` 容器提供服务。

健康检查：

```text
http://localhost:8787/health
```

边界：

- 不绕过验证码。
- 不做高频抓取。
- 不保证 Amazon 页面结构稳定。
- 如果返回验证码、机器人检测或 Continue Shopping 页面，报告必须标记为受限。

降级：

- 页面受限时，评分里的“数据可信度”下降。
- 报告显示“暂无数据”或“抓取受限”。
- 用户应换链接、稍后重试或降低频率。

依据：

- Crawlee `PlaywrightCrawler` 的 `requestHandler` 可拿到 `request`、`page`、`response` 等浏览器上下文。
- Crawlee 支持 `maxRequestRetries`、`requestHandlerTimeoutSecs`、`sameDomainDelaySecs`、`respectRobotsTxtFile` 等控制项。
- 官方文档链接：https://crawlee.dev/js/api/3.14/playwright-crawler/interface/PlaywrightCrawlerOptions

### P1：手工增强字段

用途：

- 补齐爬虫无法稳定判断的商业信息。
- 支持可解释评分、利润测算和运营决策。

字段：

- `landed_cost`
- `target_price`
- `shipping_cost`
- `platform_fee_rate`
- `fulfillment_fee`
- `ad_cost_estimate`
- `target_keywords`
- `competitor_asins`
- `marketplace`
- `notes`

当前状态：

- 可选。
- 如果用户填写，报告显示“部分提供”。

边界：

- 手工字段不自动校验供应链真实性。
- 成本、费用、广告预算只是估算输入。

降级：

- 缺成本时，不给最终利润结论。
- 缺关键词时，不做关键词覆盖判断。
- 缺竞品 ASIN 时，不做竞品快照对比。

### P2：竞品快照

用途：

- 低频抓取竞品 ASIN。
- 对比竞品价格、评分、评论数、库存状态。
- 为总览页提供竞品验证状态。

当前状态：

- 已接入。
- 使用同一个本地 `amazon-crawler` 服务。

核心文件：

```text
output\amazon_product_analysis\competitor_snapshot_latest.json
output\amazon_product_analysis\competitor_snapshot_latest.html
```

推荐命令：

```powershell
& 'C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\tools\run_competitor_snapshot.ps1' -MissingOnly -Limit 2 -DelaySeconds 20
```

边界：

- 仍然是免费本地爬虫，不是官方 Amazon 销售、库存或广告数据。
- `carried_forward` 表示沿用历史成功结果，不等于本轮重新验证页面。
- 必须绑定 `source_asin + marketplace + competitor_asin_key`，避免不同主商品误用同一份快照。

降级：

- 快照不存在：报告显示“未生成”。
- 主商品不匹配：报告显示“未匹配”。
- 部分失败：总览页显示部分覆盖率，并保留失败 ASIN。

## 4. 预留增强数据源

### P3：Keepa 历史趋势

适合解决的问题：

- 历史价格走势。
- BSR / Sales Rank 趋势。
- Buy Box、卖家数、报价历史。
- 评论数、评分、价格是否短期异常。

配置状态：

- 当前 `not_connected`。
- 不接入时报告显示“未接入”。

建议配置项：

```text
KEEPA_API_KEY
```

推荐接入方式：

1. 先只做单 ASIN 历史趋势查询。
2. 缓存结果到本地 JSON。
3. 每个 ASIN 设置最小刷新周期，例如 24 小时。
4. 评分模型只读取缓存，不在报告生成时大量实时请求。

边界：

- Keepa 是第三方数据源，不是 Amazon 官方销售数据。
- API 通常需要 access key 和订阅。
- 请求会消耗 token 或额度，必须缓存和限流。

降级：

- 没有 API key：显示“未接入”。
- token 不足：显示“额度不足”，沿用最近一次缓存。
- 查询失败：显示“获取失败”，不影响主报告生成。

依据：

- Keepa Python 客户端文档说明其用于查询 Amazon 商品信息和历史，并需要 access key 与 Keepa API 订阅。
- 文档链接：https://keepaapi.readthedocs.io/en/stable/
- Keepa 官方 API 入口：https://keepa.com/#!api

### P4：Amazon SP-API

适合解决的问题：

- 官方目录信息。
- 官方费用估算。
- 库存、订单、销售、补货、财务等卖家授权数据。
- Brand Analytics / Search Query Performance 等卖家或品牌相关报表。

配置状态：

- 当前 `not_connected`。
- 不接入时报告显示“未接入”。

建议配置项：

```text
SP_API_CLIENT_ID
SP_API_CLIENT_SECRET
SP_API_REFRESH_TOKEN
SP_API_ROLE_ARN
SP_API_REGION
SP_API_MARKETPLACE_ID
```

推荐接入顺序：

1. Catalog Items：补官方目录和属性。
2. Product Fees：补平台费用估算。
3. Reports / Sales / Inventory：补销售、库存、补货信号。
4. Brand Analytics / SQP：补关键词和搜索表现。

认证要求：

- 应用需要注册。
- 需要 selling partner 授权或私有应用自授权。
- 公共应用授权基于 Login with Amazon OAuth 2.0。
- 运行时使用 LWA access token 调用。
- Access token 有有效期，refresh token 需要安全保存。

限流要求：

- SP-API 使用 token bucket 限流。
- 每个 operation 有 rate limit 和 burst limit。
- `x-amzn-RateLimit-Limit` 可能返回操作限流，但不能假设每次都有。
- 429 应按退避策略重试。

合规要求：

- 只读取已经授权的卖家/品牌数据。
- 不跨账号聚合敏感数据。
- 不把 refresh token、client secret 写进 HTML、CSV 或日志。
- 涉及 PII 的 restricted operation 必须使用 RDT，并单独做权限和存储控制；V1 不接入 PII。

降级：

- 凭据缺失：显示“配置缺失”。
- 授权过期：显示“授权过期”，不调用相关模块。
- 429 限流：延后重试，并沿用缓存。
- 403 权限不足：显示“权限不足”，提示检查角色。

依据：

- SP-API 官方文档入口：https://developer-docs.amazon.com/sp-api/lang-en_US/
- 公共应用授权基于 LWA OAuth 2.0：https://developer-docs.amazon.com/sp-api/docs/authorize-public-applications
- 连接 SP-API 需要注册、授权、LWA access token：https://developer-docs.amazon.com/sp-api/lang-US/docs/connecting-to-the-selling-partner-api
- SP-API 限流使用 token bucket，并按 operation、账号应用对、区域等因素确定：https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits

### P5：Amazon Ads API

适合解决的问题：

- 广告活动、广告组、关键词、投放报表。
- ACOS、TACOS、点击、曝光、转化。
- 小预算验证真实获客成本。
- Listing 关键词投放角度。

配置状态：

- 当前 `not_connected`。
- 不接入时报告显示“未接入”。

建议配置项：

```text
AMAZON_ADS_CLIENT_ID
AMAZON_ADS_CLIENT_SECRET
AMAZON_ADS_REFRESH_TOKEN
AMAZON_ADS_PROFILE_ID
AMAZON_ADS_REGION
```

推荐接入顺序：

1. Profiles：确认广告账号和 marketplace。
2. Reports：先拉关键词、广告活动和投放结果报表。
3. Campaign Management：后续再考虑自动调价和预算。
4. Marketing Stream / AMC：V1 不接入，留作高级分析。

边界：

- 需要申请 Amazon Ads API access。
- API 本身不等于免费广告投放；广告活动仍会产生广告成本。
- 测试应优先使用 test accounts 或只读报表。

降级：

- 未申请通过：显示“未接入”。
- 缺 profile：显示“配置缺失”。
- 报表延迟：显示“等待报表”，不影响主报告。
- 预算风险：禁止自动开启投放，V1 只读。

依据：

- Amazon Ads API 用于程序化管理和报告广告活动。
- Amazon Ads 官方说明其需要 application 和 approval process。
- 官方 FAQ 说明 Amazon Ads API 本身没有额外 API 费用，但仍有标准账户费用和广告产品投放成本。
- 文档链接：https://advertising.amazon.com/en-gb/about-api

## 5. 状态展示规则

报告应始终展示以下数据来源：

1. 数据源配置
2. 页面抓取
3. 手工增强字段
4. 竞品快照
5. Keepa 历史趋势
6. SP-API / Brand Analytics
7. Amazon Ads API

状态优先级：

1. 运行时真实状态优先。
2. 配置文件状态第二。
3. 内置默认状态兜底。

示例：

- 页面被验证码拦截，即使 `crawlee.status = enabled`，报告也显示“受限”。
- 用户没有填写成本字段，即使 `manual_inputs.status = optional`，报告也显示“未提供”。
- 竞品快照主商品不匹配，报告显示“未匹配”。
- Keepa 未配置 API key，报告显示“未接入”。

## 6. 成本控制

免费：

- n8n 本机 Docker
- Crawlee
- Playwright
- 本地 HTML / CSV
- 竞品快照脚本

可能产生费用：

- 阿里百炼模型调用
- Keepa API 订阅或 token
- SP-API 相关开发、运维和合规成本
- Amazon Ads 广告投放成本
- 未来代理池或验证码服务

控制策略：

1. 默认不接入付费数据源。
2. 付费数据源必须走缓存。
3. 报告生成不直接批量实时调用付费 API。
4. 批量处理必须设置批次大小、延迟、失败重试和最大预算。
5. 数据源配置不得包含真实密钥。

## 7. 合规边界

必须遵守：

- 不绕过验证码。
- 不隐藏或伪造数据来源。
- 不把第三方 API key 写进报告、CSV、截图、日志或 Git。
- 不采集未经授权的卖家后台、订单、财务或广告数据。
- 不把 SP-API / Ads API 数据跨账号混用。
- PII 数据不进入 V1 报告。

V1 明确不做：

- 自动下单。
- 自动改价。
- 自动开启广告。
- 自动绕过 Amazon 风控。
- 大规模高频抓取。

## 8. 故障降级

| 场景 | 报告状态 | 处理 |
| --- | --- | --- |
| `data_sources.local.json` 缺失 | 配置缺失 | 使用内置默认状态 |
| Crawlee 健康检查失败 | 页面抓取受限 | 检查 `amazon-crawler` 容器 |
| Amazon 返回验证码 | 抓取受限 | 降低频率，稍后重试 |
| 竞品快照缺失 | 未生成 | 运行 `run_competitor_snapshot.ps1` |
| 竞品快照主商品不匹配 | 未匹配 | 指定 `-SourceAsin` 重新生成 |
| Keepa API key 缺失 | 未接入 | 不调用 Keepa |
| Keepa token 不足 | 额度不足 | 使用缓存，延后刷新 |
| SP-API 授权过期 | 授权过期 | 重新授权 |
| SP-API 429 | 限流 | 退避重试，降低批量 |
| Ads API 未批准 | 未接入 | 保持只读免费流程 |

## 9. V1 到 V1.5 升级路径

第一阶段：配置中心

- 已完成 `data_sources.local.json`。
- 报告可显示各数据源状态。

第二阶段：缓存层

- 新增 `output/amazon_product_analysis/cache/`。
- 每个外部数据源单独缓存。
- 缓存 key 使用 `marketplace + asin + source + date`。

第三阶段：Keepa 适配器

- 只读历史价格、BSR、Buy Box。
- 每 ASIN 24 小时刷新一次。
- 缓存失败不影响主报告。

第四阶段：SP-API 适配器

- 从 Catalog 和 Product Fees 开始。
- 严格避免 PII。
- 所有凭据只放环境变量或 n8n credentials。

第五阶段：Ads API 适配器

- 只读报表。
- 不自动创建或修改广告活动。
- 把 ACOS、点击、转化作为评分辅助字段。

## 10. 日常检查清单

运行前：

1. Docker Desktop 已启动。
2. n8n 可打开：`http://localhost:5678`
3. crawler 健康检查正常：`http://localhost:8787/health`
4. `data_sources.local.json` 存在。
5. `Set the Input Fields` 的商品链接和手工字段已确认。

运行后：

1. 看最新报告：`amazon_product_analysis_latest.html`
2. 看总览：`amazon_product_analysis_overview.html`
3. 看竞品快照：`competitor_snapshot_latest.html`
4. 检查 CSV 是否追加。
5. 检查“数据来源可信度”里是否出现异常状态。

外部数据源接入前：

1. 先把配置状态从 `not_connected` 改为 `configured`。
2. 只做 DryRun 或单 ASIN 测试。
3. 写入缓存。
4. 验证报告能读取缓存。
5. 再考虑批量。
