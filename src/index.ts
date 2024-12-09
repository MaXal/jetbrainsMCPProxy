#!/usr/bin/env node
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    CallToolResult,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema, Tool,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = process.env.IDE_PORT || "63343";
const IDE_ENDPOINT = `http://localhost:${PORT}/api`;

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

server.setRequestHandler(ListToolsRequestSchema, async () => (
    fetchWithConfig("/mcp/list_tools", "Unable to list tools").then((tools) => {
        return {
            tools: tools ? JSON.parse(tools) as Tool[] : [],
        };
    }
)));

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

async function postWithConfig(
    endpoint: string,
    data: any,
    errorMessage: string,
): Promise<string> {
    const response = await fetch(`${IDE_ENDPOINT}${endpoint}`, {
        method: 'POST',
        headers: {
            "User-Agent": "jetbrains-mcp-server",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error(errorMessage + " code " + response.status + " " + response.statusText);
    }

    return response.text();
}

async function handleToolCall(name: string, args: any): Promise<CallToolResult> {
    try {
        const text = await postWithConfig(`/mcp/${name}`, args, "???");
        return {
            content: [{
                type: "text",
                text: text,
            }],
            isError: false,
        };
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