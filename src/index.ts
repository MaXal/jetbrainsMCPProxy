#!/usr/bin/env node
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    CallToolResult,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";


const PORT = process.env.IDE_PORT || "63343";
const IDE_ENDPOINT = `http://localhost:${PORT}/api/mcp`;

const server = new Server(
    {
        name: "jetbrains/proxy",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
            resources: {},
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
    {
        name: "get_selected_text",
        description:
            "Get the current selected contents of a file in JetBrains IDE",
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

async function fetchWithConfig(endpoint: string, errorMessage: string): Promise<string> {
    const response = await fetch(`${IDE_ENDPOINT}${endpoint}`, {
        headers: {
            "User-Agent": "jetbrains-mcp-server"
        }
    });

    if (!response.ok) {
        throw new Error(errorMessage);
    }

    return response.text();
}

async function handleToolCall(name: string, args: any): Promise<CallToolResult> {
    try {
        switch (name) {
            case "get_file_content": {
                const text = await fetchWithConfig("/current_file", "Current file not found");
                return {
                    content: [{
                        type: "text",
                        text: text,
                    }],
                    isError: false,
                };
            }
            case "get_selected_text": {
                const text = await fetchWithConfig("/selected_text", "There is no selected text");
                return {
                    content: [{
                        type: "text",
                        text: text,
                    }],
                    isError: false,
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return {
            content: [{
                type: "text",
                text: error instanceof Error ? error.message : "Unknown error",
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