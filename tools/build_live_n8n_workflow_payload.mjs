import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, 'n8n', 'workflows', 'amazon_product_analysis_crawlee_bailian_html.json');
const reportCodePath = path.join(root, 'tools', 'n8n_html_report_code_optimized.js');
const outputPath = path.join(root, 'output', 'amazon_product_analysis', 'live_workflow_update_payload.json');
const webhookNodeName = 'Webhook Trigger - Amazon Analysis';
const webhookPath = 'amazon-product-analysis';

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

const workflowJson = JSON.parse(readUtf8(workflowPath));
const workflow = Array.isArray(workflowJson) ? workflowJson[0] : workflowJson;
const reportCode = readUtf8(reportCodePath);

const reportNode = workflow.nodes.find(
  (node) => node.type === 'n8n-nodes-base.code' && node.parameters?.jsCode?.includes('amazon_product_analysis_latest.html'),
);

if (!reportNode) {
  throw new Error('Cannot find report node');
}

reportNode.parameters.jsCode = reportCode;

let webhookNode = workflow.nodes.find((node) => node.name === webhookNodeName);
if (!webhookNode) {
  webhookNode = {
    id: 'webhook-amazon-analysis',
    name: webhookNodeName,
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [-1152, 448],
    parameters: {
      httpMethod: 'POST',
      path: webhookPath,
      responseMode: 'lastNode',
      options: {},
    },
  };
  workflow.nodes.push(webhookNode);
} else {
  webhookNode.parameters = {
    ...webhookNode.parameters,
    httpMethod: 'POST',
    path: webhookPath,
    responseMode: 'lastNode',
    options: webhookNode.parameters?.options || {},
  };
}

workflow.connections[webhookNodeName] = {
  main: [
    [
      {
        node: 'Set the Input Fields',
        type: 'main',
        index: 0,
      },
    ],
  ],
};

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

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.log(
  JSON.stringify({
    outputPath,
    nodes: payload.nodes.length,
    hasWebhook: payload.nodes.some((node) => node.name === webhookNodeName),
    reportHasOptimized: reportNode.parameters.jsCode.includes('选品推荐指数'),
    reportHasPerspective: reportNode.parameters.jsCode.includes('机会位置'),
  }),
);
