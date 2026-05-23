import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const livePath = path.join(root, 'output', 'amazon_product_analysis', 'live_workflow_current.json');
const reportCodePath = path.join(root, 'tools', 'n8n_html_report_code_optimized.js');
const outputPath = path.join(root, 'output', 'amazon_product_analysis', 'live_workflow_report_only_payload.json');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

const workflow = JSON.parse(readUtf8(livePath));
const reportCode = readUtf8(reportCodePath);
const reportNode = workflow.nodes.find(
  (node) => node.type === 'n8n-nodes-base.code' && node.parameters?.jsCode?.includes('amazon_product_analysis_latest.html'),
);

if (!reportNode) throw new Error('Cannot find report node');
reportNode.parameters.jsCode = reportCode;

const payload = {
  name: workflow.name,
  description:
    'Local Crawlee + Playwright Amazon product analysis with Bailian AI and optimized HTML/CSV output.',
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings || { executionOrder: 'v1' },
  staticData: workflow.staticData || null,
  pinData: workflow.pinData || {},
};

fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(
  JSON.stringify({
    outputPath,
    nodes: payload.nodes.length,
    reportHasOptimized: reportNode.parameters.jsCode.includes('选品推荐指数'),
  }),
);
