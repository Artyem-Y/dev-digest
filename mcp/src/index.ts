import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HttpDevDigestApi } from './http-client.js';
import { createToolDefinitions } from './tools/definitions.js';

const server = new McpServer({ name: 'devdigest-mcp', version: '0.0.0' });
for (const tool of createToolDefinitions(new HttpDevDigestApi())) {
  server.registerTool(tool.name, {
    title: tool.title,
    description: tool.description,
    ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
    annotations: tool.annotations,
  }, tool.handler);
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('devdigest-mcp connected over stdio');
