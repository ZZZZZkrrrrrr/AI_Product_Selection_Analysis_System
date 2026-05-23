# Amazon Crawler Local Service

本服务给 n8n 工作流提供本地 Amazon 商品页抓取接口。

## 接口

- 健康检查：`GET http://localhost:8787/health`
- 商品抓取：`POST http://localhost:8787/scrape`

请求示例：

```json
{
  "url": "https://www.amazon.in/Sony-DualSense-Controller-Grey-PlayStation/dp/B0BQXZ11B8",
  "timeoutMs": 45000
}
```

返回字段包含：ASIN、标题、价格、评分、评论数、品牌、库存状态、五点描述、商品详情、分类路径、商品图片和页面文本。

## 边界

这是免费本地爬虫，不使用代理池和验证码服务。如果 Amazon 返回验证码或机器人检测页面，接口会尽量返回 `blocked: true`，工作流报告会提示“暂无数据”或需要重试。
