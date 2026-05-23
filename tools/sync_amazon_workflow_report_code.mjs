import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const codePath = path.join(__dirname, 'n8n_html_report_code_optimized.js');
const workflowPath = path.join(root, 'n8n', 'workflows', 'amazon_product_analysis_crawlee_bailian_html.json');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

const code = readUtf8(codePath);
const workflowJson = JSON.parse(readUtf8(workflowPath));
const workflows = Array.isArray(workflowJson) ? workflowJson : [workflowJson];

let changed = false;
for (const workflow of workflows) {
  const node = workflow.nodes?.find((item) => item.name === '生成 HTML 可视化报告');
  if (!node) continue;
  node.parameters ||= {};
  node.parameters.jsCode = code;
  workflow.description =
    '使用本地 Crawlee + Playwright 免费抓取 Amazon 页面，通过阿里百炼输出中文分析，并生成带数据透视、重点摘要和本地 CSV 备份的 HTML 可视化报告。';
  changed = true;
}

if (!changed) {
  throw new Error('未找到 n8n 节点：生成 HTML 可视化报告');
}

fs.writeFileSync(workflowPath, JSON.stringify(workflowJson, null, 2) + '\n', 'utf8');
console.log(`synced ${path.relative(root, codePath)} -> ${path.relative(root, workflowPath)}`);
