# AI 跨境电商选品分析系统

本仓库是本地版 Amazon / 跨境电商 AI 选品分析系统，核心流程为：

- n8n 编排工作流
- Crawlee + Playwright 本地免费抓取 Amazon 商品页
- 阿里百炼 OpenAI 兼容接口生成中文分析
- 可解释评分模型输出选品决策看板
- 本地 HTML、CSV 和回归总览报告

主文档：

- [AI 选品分析系统说明](README_AI选品分析系统.md)
- [Amazon 商品情报分析 SOP](docs/Amazon商品情报分析_Crawlee阿里百炼_HTML报告_SOP.md)
- [V1 数据源接入 SOP](docs/AI选品系统_V1数据源接入SOP.md)
- [方案与实现迭代记录](docs/AI选品系统_方案迭代.md)

本仓库不包含 API Key、n8n 本机凭据、运行输出、浏览器 profile、截图、视频或个人抓取数据。首次运行前请按主文档配置 Docker、n8n 凭据和本地爬虫服务。
