#!/usr/bin/env node
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema, Tool, CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import {zodToJsonSchema} from "zod-to-json-schema";

const server = new Server(
    {
        name: "jetbrains/proxy",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
            resources: {}, // Required for image resources
        },
    },
);

const TOOLS: Tool[] = [
    {
        name: "get_file_content",
        description:
            "Get the current contents of a file in JetBrains IDE",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
]


server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
}));

server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "jetbrains://current_file",
                mimeType: "text/plain",
                name: "Current File inside JetBrains IDE",
            },
        ],
    };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri.toString();
    if (uri === "jetbrains://current_file") {
        return {
            contents: [{
                uri,
                mimeType: "text/plain",
                text: "Hello world!",
            }],
        };
    }
    throw new Error("Resource not found");
});

async function handleToolCall(name: string, args: any): Promise<CallToolResult> {
    try {
        switch (name) {
            case "get_file_content": {
                const response = await fetch(
                    `http://localhost:63343/api/mcp/current_file`,
                    {
                        headers: {
                            "User-Agent": "github-mcp-server",
                        },
                    }
                );
                if (!response.ok) {
                    throw new Error(`Current file not found`);
                }
                return {
                    content: [{
                        type: "text",
                        text: await response.text(),
                    }],
                    isError: false,
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        if (error instanceof Error) {
            return {
                content: [{
                    type: "text",
                    text: error.message,
                }],
                isError: true,
            };
        }
        return {
            content: [{
                type: "text",
                text: "Unknown error",
            }],
            isError: true,
        };
    }
}

server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleToolCall(request.params.name, request.params.arguments ?? {})
);

async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("JetBrains Proxy MCP Server running on stdio");
}

runServer().catch(console.error);