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

import fs from "fs";


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

const TOOLS: Tool[] = [
    {
        name: "get_current_file_text",
        description:
            "Get the current contents of the file in JetBrains IDE",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "get_current_file_path",
        description:
            "Get the current file path in JetBrains IDE",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "get_selected_text",
        description:
            "Get the currently selected text in the JetBrains IDE",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "get_terminal_text",
        description:
            "Get the current contents of a terminal in JetBrains IDE",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "execute_terminal_command",
        description:
            "Execute any terminal command in JetBrains IDE",
        inputSchema: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The command to execute in the terminal",
                },
            },
            required: ["command"],
        },
    },
    {
        name: "replace_selected_text",
        description:
            "Replace the currently selected text in the JetBrains IDE with new text",
        inputSchema: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "The new text to replace the selected text with",
                },
            },
            required: ["text"],
        },
    },
    {
        name: "replace_current_file_text",
        description:
            "Replace the entire contents of the current file in JetBrains IDE with new text",
        inputSchema: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "The new text for the entire file",
                },
            },
            required: ["text"],
        },
    },
];

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
        throw new Error(errorMessage);
    }

    return response.text();
}

async function handleToolCall(name: string, args: any): Promise<CallToolResult> {
    try {
        switch (name) {
            case "get_current_file_text": {
                const text = await fetchWithConfig("/mcp/get_current_file_text", "Current file not found");
                return {
                    content: [{
                        type: "text",
                        text: text,
                    }],
                    isError: false,
                };
            }
            case "get_current_file_path": {
                const path = await fetchWithConfig("/mcp/get_current_file_path", "Current file not found");
                return {
                    content: [{
                        type: "text",
                        text: path,
                    }],
                    isError: false,
                };
            }
            case "get_selected_text": {
                const text = await fetchWithConfig("/mcp/selected_text", "There is no selected text");
                return {
                    content: [{
                        type: "text",
                        text: text,
                    }],
                    isError: false,
                };
            }
            case "get_terminal_text": {
                const text = await fetchWithConfig("/terminalMcp/current_text", "There is no opened terminal");
                return {
                    content: [{
                        type: "text",
                        text: text,
                    }],
                    isError: false,
                };
            }
            case "execute_terminal_command": {
                await postWithConfig("/terminalMcp/execute_command", args, "There is no opened terminal");
                return {
                    content: [{
                        type: "text",
                        text: "OK",
                    }],
                    isError: false,
                };
            }

            case "replace_selected_text": {
                await postWithConfig("/mcp/replace_selected_text", args, "Unable to replace selected text");
                return {
                    content: [{
                        type: "text",
                        text: "OK",
                    }],
                    isError: false,
                };
            }
            case "replace_current_file_text": {
                // args should contain { text: "..."}
                await postWithConfig("/mcp/replace_current_file_text", args, "Unable to replace current file text");
                return {
                    content: [{
                        type: "text",
                        text: "OK",
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