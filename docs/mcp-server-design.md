# MCP Server Design Document

## 1. Background

### 1.1 Motivation

Zotero is a powerful reference manager, but its data (library items, notes, PDF annotations, full-text content) is largely siloed. By exposing Zotero's data through the **Model Context Protocol (MCP)**, external AI-powered tools (e.g., Siyuan Note Copilot, Claude Desktop, Cursor) can directly query the Zotero library to assist with academic writing, literature reviews, and knowledge synthesis.

### 1.2 What is MCP?

**Model Context Protocol (MCP)** is an open standard (by Anthropic) that allows applications to provide context to LLMs in a standardized way. It uses **JSON-RPC 2.0** as its wire format and defines three core primitives:

- **Tools**: Actions an LLM can invoke (e.g., search items, get notes)
- **Resources**: Read-only data endpoints at stable URIs
- **Prompts**: Reusable message templates for consistent LLM interactions

### 1.3 Existing Implementations

Two mature Zotero MCP servers already exist:

| Project | Approach | Language | Transport | Stars |
|---------|----------|----------|-----------|-------|
| [cookjohn/zotero-mcp](https://github.com/cookjohn/zotero-mcp) | Zotero plugin (XPI) with embedded MCP server | TypeScript | Streamable HTTP (port 23120) | ~413 |
| [54yyyu/zotero-mcp](https://github.com/54yyyu/zotero-mcp) | Standalone server connecting via Zotero local API | Python | stdio, Streamable HTTP, SSE | ~popular |

**cookjohn/zotero-mcp** is architecturally closest to what ZutiloRE would implement: a Zotero plugin that embeds an MCP server, giving direct access to internal Zotero APIs.

### 1.4 Decision

Given these existing tools, this document serves as a reference design for potential future implementation in ZutiloRE, or as a guide for integration with existing solutions.

---

## 2. Architecture

### 2.1 High-Level Design

```
MCP Client (Siyuan Copilot / Claude Desktop / etc.)
    |
    | HTTP POST (JSON-RPC 2.0)
    v
[Transport Layer] -- configurable
    SocketTransport (nsIServerSocket, default port 23120)
    -- OR --
    ZoteroServerTransport (Zotero.Server.Endpoints, port 23119)
    |
    v
[McpProtocolHandler] -- JSON-RPC dispatch, session management
    |
    v
[ToolRegistry] -> [Tool Handlers] -> Zotero Internal APIs -> JSON response
```

### 2.2 Transport Options

MCP defines several transport mechanisms. For a Zotero plugin, the relevant ones are:

#### Option A: Streamable HTTP (Recommended)

- **Spec version**: 2025-03-26
- Client sends JSON-RPC via HTTP POST; server responds with JSON or SSE stream
- Supports stateful sessions via `Mcp-Session-Id` header
- Best for: web-based clients, multi-client scenarios

#### Option B: stdio

- Communication via stdin/stdout of a spawned process
- Not directly applicable for a Zotero plugin (Zotero is not spawned by the MCP client)
- Could be supported via a thin CLI wrapper that proxies to the HTTP server

### 2.3 Server Implementation Options

#### Option 1: Independent Port via nsIServerSocket

Creates a standalone TCP server on a configurable port (e.g., 23120) using Mozilla's XPCOM `nsIServerSocket` interface.

```typescript
const socket = Cc['@mozilla.org/network/server-socket;1']
  .createInstance(Ci.nsIServerSocket);
socket.init(port, true /* loopbackOnly */, -1);
socket.asyncListen(listener);
```

**Pros:**
- Full control over HTTP protocol (custom headers, SSE streaming, sessions)
- Isolated from Zotero's server -- no interference with connector
- Can implement complete MCP Streamable HTTP spec

**Cons:**
- Must manually parse HTTP requests and construct responses
- Must handle UTF-8 encoding via `nsIConverterInputStream` / `nsIConverterOutputStream`
- Requires a separate port (risk of conflicts)
- Must track and clean up active connections on shutdown

#### Option 2: Zotero Built-in Server Endpoints

Registers custom endpoints on Zotero's existing HTTP server (port 23119).

```typescript
Zotero.Server.Endpoints['/zutilore/mcp'] = function () {};
Zotero.Server.Endpoints['/zutilore/mcp'].prototype = {
  supportedMethods: ['POST', 'GET', 'OPTIONS', 'DELETE'],
  supportedDataTypes: ['application/json'],
  init: async function (requestData) {
    // requestData: { method, pathname, pathParams, searchParams, headers, data }
    // data is already parsed JSON
    // Return: [statusCode, contentTypeOrHeaders, body]
    return [200, 'application/json', JSON.stringify(result)];
  },
};
```

**Pros:**
- Very simple -- a few lines of code
- Zotero handles HTTP parsing, UTF-8, content-type negotiation
- No port conflicts

**Cons:**
- Limited control over raw HTTP details (no SSE streaming)
- Subject to Zotero's built-in security filters (browser requests without special headers are blocked)
- Cannot fully implement MCP Streamable HTTP (no SSE support)

#### Option 3: Mozilla's httpd.sys.mjs (Middle Ground)

Use the same HTTP server module that Zotero itself uses, on a separate port:

```typescript
const { HttpServer } = ChromeUtils.importESModule(
  'chrome://remote/content/server/httpd.sys.mjs'
);
const server = new HttpServer();
server.registerPathHandler('/mcp', handler);
server.start(port);
```

**Pros:**
- Proper HTTP handling without manual parsing
- Separate port for isolation
- More control than Option 2

**Cons:**
- Less community precedent in plugin ecosystem
- Still may not support SSE streaming natively

### 2.4 Recommendation

Support **both Option 1 and Option 2** behind a common `ITransport` interface, selectable via Zotero preferences. Default to Option 1 (nsIServerSocket) for full MCP compliance.

---

## 3. Module Structure

```
src/modules/mcp/
  index.ts                -- Public API: startMcpServer(), stopMcpServer(), getMcpStatus()
  config.ts               -- Configuration via Zotero.Prefs
  protocol.ts             -- MCP JSON-RPC 2.0 protocol handler
  transport.ts            -- ITransport interface definition
  transport-socket.ts     -- nsIServerSocket implementation (standalone port)
  transport-zotero.ts     -- Zotero.Server.Endpoints implementation
  tool-registry.ts        -- Tool registration and dispatch framework
  tools/
    helpers.ts            -- Shared item serialization utilities
    search-items.ts       -- search_items tool
    get-item.ts           -- get_item_details tool
    get-notes.ts          -- get_item_notes tool
    get-annotations.ts    -- get_pdf_annotations tool
    get-fulltext.ts       -- get_fulltext tool
    list-collections.ts   -- list_collections tool
    get-collection-items.ts -- get_collection_items tool
```

---

## 4. Protocol Layer

### 4.1 MCP Streamable HTTP Flow

```
Client                                        Server
  |                                              |
  |  POST /mcp  {method: "initialize", ...}      |
  |--------------------------------------------->|
  |                                              |
  |  200 OK  {result: {capabilities, ...}}       |
  |  Mcp-Session-Id: <uuid>                      |
  |<---------------------------------------------|
  |                                              |
  |  POST /mcp  {method: "notifications/initialized"}
  |  Mcp-Session-Id: <uuid>                      |
  |--------------------------------------------->|
  |                                              |
  |  POST /mcp  {method: "tools/list"}           |
  |  Mcp-Session-Id: <uuid>                      |
  |--------------------------------------------->|
  |                                              |
  |  200 OK  {result: {tools: [...]}}            |
  |<---------------------------------------------|
  |                                              |
  |  POST /mcp  {method: "tools/call", ...}      |
  |  Mcp-Session-Id: <uuid>                      |
  |--------------------------------------------->|
  |                                              |
  |  200 OK  {result: {content: [...]}}          |
  |<---------------------------------------------|
  |                                              |
  |  DELETE /mcp                                 |
  |  Mcp-Session-Id: <uuid>                      |
  |--------------------------------------------->|
  |                                              |
  |  200 OK                                      |
  |<---------------------------------------------|
```

### 4.2 JSON-RPC 2.0 Message Format

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_items",
    "arguments": { "query": "machine learning", "limit": 10 }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "[{\"title\": \"...\", ...}]" }
    ]
  }
}
```

**Error Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found: unknown/method"
  }
}
```

### 4.3 Session Management

- Sessions are created on `initialize`, stored in an in-memory `Map<string, McpSession>`
- Session ID is returned via `Mcp-Session-Id` response header
- All subsequent requests must include `Mcp-Session-Id` header
- Sessions are destroyed via `DELETE /mcp` or on server shutdown
- Session ID generated via `crypto.randomUUID()`

### 4.4 CORS

All responses include CORS headers to enable cross-origin access:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Mcp-Session-Id, Accept
Access-Control-Expose-Headers: Mcp-Session-Id
```

### 4.5 Standard JSON-RPC Error Codes

| Code | Meaning |
|------|---------|
| -32700 | Parse error (invalid JSON) |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |

---

## 5. MCP Tools

### 5.1 search_items

Search the Zotero library by keyword, field, or tag.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "Search query string" },
    "field": {
      "type": "string",
      "enum": ["title", "creator", "tag", "everything"],
      "description": "Field to search (default: everything)"
    },
    "libraryID": { "type": "number", "description": "Library ID (default: user library)" },
    "limit": { "type": "number", "description": "Max results (default: 25, max: 100)" }
  },
  "required": ["query"]
}
```

**Implementation:**
```typescript
const search = new Zotero.Search();
search.libraryID = libraryID || Zotero.Libraries.userLibraryID;
search.addCondition('quicksearch-titleCreatorYear', 'contains', query);
const ids = await search.search();
const items = await Zotero.Items.getAsync(ids.slice(0, limit));
// Serialize to summary format
```

**Output:** Array of item summaries (id, key, title, creators, date, DOI, itemType, tags).

### 5.2 get_item_details

Get comprehensive metadata for a single item.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "itemKey": { "type": "string", "description": "Item key (8-char alphanumeric)" },
    "itemID": { "type": "number", "description": "Item ID" },
    "libraryID": { "type": "number", "description": "Library ID" }
  }
}
```

**Implementation:** Uses `Zotero.Items.get(id)`, then `item.getField()` for all standard fields (title, abstractNote, date, DOI, ISBN, url, publicationTitle, journalAbbreviation, volume, issue, pages, etc.), `item.getCreators()`, `item.getTags()`.

**Output:** Full metadata object with all available fields.

### 5.3 get_item_notes

Get notes attached to an item.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "itemKey": { "type": "string" },
    "itemID": { "type": "number" },
    "libraryID": { "type": "number" }
  }
}
```

**Implementation:**
```typescript
const noteIDs = item.getNotes();
const notes = await Zotero.Items.getAsync(noteIDs);
// For each note: noteItem.getNote() returns HTML content
// Strip HTML tags for plain text output
```

**Output:** Array of `{ id, key, title, content, dateModified }`.

### 5.4 get_pdf_annotations

Get PDF annotations (highlights, comments, underlines) for an item.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "itemKey": { "type": "string" },
    "itemID": { "type": "number" },
    "libraryID": { "type": "number" },
    "annotationType": {
      "type": "string",
      "enum": ["highlight", "underline", "note", "image", "ink"]
    }
  }
}
```

**Implementation:**
```typescript
const attachmentIDs = item.getAttachments();
const attachments = await Zotero.Items.getAsync(attachmentIDs);
for (const att of attachments) {
  if (att.attachmentContentType === 'application/pdf' && att.getAnnotations) {
    const annotations = att.getAnnotations();
    // For each: annotationType, annotationText, annotationComment,
    //           annotationColor, annotationPageLabel, annotationSortIndex
  }
}
```

**Output:** Array of annotations sorted by `annotationSortIndex`.

### 5.5 get_fulltext

Get the full-text content of PDF attachments.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "itemKey": { "type": "string" },
    "itemID": { "type": "number" },
    "libraryID": { "type": "number" }
  }
}
```

**Implementation:** For regular items, finds the first PDF attachment and retrieves cached full-text via `Zotero.Fulltext.getTextForItem(itemID)`.

**Output:** `{ content: "full text...", indexedChars, totalChars }`.

### 5.6 list_collections

Browse the collection hierarchy.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "parentCollectionKey": { "type": "string", "description": "Parent collection key for sub-collections. Omit for top-level." },
    "libraryID": { "type": "number" },
    "recursive": { "type": "boolean", "description": "Include all descendants (default: false)" }
  }
}
```

**Implementation:**
```typescript
// Top-level
const collections = Zotero.Collections.getByLibrary(libraryID);
// Or sub-collections
const collections = Zotero.Collections.getByParent(parentID);
```

**Output:** Array of `{ id, key, name, parentKey, childCount }`.

### 5.7 get_collection_items

Get items in a specific collection.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "collectionKey": { "type": "string" },
    "collectionID": { "type": "number" },
    "libraryID": { "type": "number" },
    "limit": { "type": "number", "description": "Max results (default: 50)" },
    "recursive": { "type": "boolean", "description": "Include items from sub-collections (default: false)" }
  }
}
```

**Implementation:**
```typescript
const search = new Zotero.Search();
search.libraryID = libraryID;
search.addCondition('collection', 'is', collectionKey);
if (recursive) search.addCondition('recursive', 'true');
const ids = await search.search();
```

**Output:** Array of item summaries.

---

## 6. Key Interfaces

### 6.1 ITransport

```typescript
interface McpHttpRequest {
  method: string;         // "POST", "GET", "DELETE", "OPTIONS"
  path: string;           // e.g., "/mcp"
  headers: Record<string, string>;
  body: string | null;
}

interface McpHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

interface ITransport {
  start(): void;
  stop(): void;
  readonly isRunning: boolean;
  readonly port: number;
  setRequestHandler(handler: (req: McpHttpRequest) => Promise<McpHttpResponse>): void;
}
```

### 6.2 Tool Registration

```typescript
interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolCallResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  isError?: boolean;
}

interface McpTool {
  definition: McpToolDefinition;
  handler: (args: Record<string, unknown>) => Promise<McpToolCallResult>;
}

class ToolRegistry {
  register(tool: McpTool): void;
  listTools(): McpToolDefinition[];
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
}
```

---

## 7. Configuration

Preferences are managed via Zotero's Prefs system:

| Preference Key | Type | Default | Description |
|---------------|------|---------|-------------|
| `extensions.zutilore.mcp.enabled` | boolean | `true` | Enable/disable MCP server |
| `extensions.zutilore.mcp.serverMode` | string | `"standalone"` | `"standalone"` (nsIServerSocket) or `"zotero"` (built-in endpoints) |
| `extensions.zutilore.mcp.port` | number | `23120` | Port for standalone mode |

Users can edit these via Zotero's Config Editor (`about:config` in Zotero).

---

## 8. Plugin Lifecycle Integration

### 8.1 Startup

In `hooks.ts` `onStartup()`, after `zutiloRE.init()`:

```typescript
try {
  await startMcpServer();
  Zotero.debug('ZutiloRE: MCP server started');
} catch (e) {
  Zotero.debug(`ZutiloRE: MCP server failed to start - ${e}`);
  // Don't throw -- MCP failure shouldn't block plugin startup
}
```

### 8.2 Shutdown

In `hooks.ts` `onShutdown()`:

```typescript
try {
  stopMcpServer();
} catch (e) {
  Zotero.debug(`ZutiloRE: MCP server shutdown error - ${e}`);
}
```

### 8.3 Build

No changes needed to `build.mjs` or `package.json`. esbuild bundles all imports from `src/index.ts` into the IIFE output. No npm runtime dependencies are required -- the MCP protocol is implemented using only standard JavaScript and Zotero's XPCOM APIs.

---

## 9. Security

### 9.1 Localhost-Only Binding

- **SocketTransport**: `socket.init(port, true, -1)` -- the `true` parameter restricts to 127.0.0.1 only
- **ZoteroServerTransport**: Zotero's built-in server already binds to 127.0.0.1

### 9.2 CORS

CORS headers are required for cross-origin access from web-based MCP clients. All responses include permissive CORS headers. In production, this could be restricted to specific origins.

### 9.3 Input Validation

Each tool handler validates its input parameters and returns descriptive `isError: true` results for invalid inputs. No SQL injection risk since Zotero's APIs use parameterized queries internally.

---

## 10. Comparison with Existing Solutions

### 10.1 vs cookjohn/zotero-mcp

| Aspect | cookjohn/zotero-mcp | ZutiloRE MCP (proposed) |
|--------|-------------------|------------------------|
| Architecture | Standalone Zotero plugin (XPI) | Embedded in an existing Zotero plugin |
| Transport | Streamable HTTP only | Both Streamable HTTP and Zotero built-in server |
| Server | nsIServerSocket | nsIServerSocket + Zotero.Server.Endpoints |
| Tools | 5 tools + semantic search | 7 tools (no semantic search) |
| Semantic Search | Yes (OpenAI/Ollama embeddings + SQLite-vec) | No |
| Full-text | Yes | Yes |
| Annotations | Yes | Yes |

**Key differentiator of cookjohn/zotero-mcp**: Semantic search with vector embeddings -- a significant feature that would require substantial additional work to replicate.

### 10.2 vs 54yyyu/zotero-mcp

| Aspect | 54yyyu/zotero-mcp | ZutiloRE MCP (proposed) |
|--------|------------------|------------------------|
| Architecture | Standalone Python server | Embedded in Zotero plugin |
| Zotero access | Via local API (port 23119) or web API | Direct internal API access |
| Transport | stdio, Streamable HTTP, SSE | Streamable HTTP |
| Setup | External process (pip install) | Zero additional setup |
| Tools | 16+ tools | 7 tools |
| Semantic Search | Yes | No |

**Key advantage of embedded approach**: No external process to manage; direct access to internal Zotero APIs with richer data access.

**Key advantage of standalone approach**: Works without modifying Zotero; supports multiple transport modes; more tools.

### 10.3 Recommendation

Given the maturity of existing solutions:

1. **For immediate use**: Install [cookjohn/zotero-mcp](https://github.com/cookjohn/zotero-mcp) as a separate plugin. It is the most feature-complete embedded solution.
2. **For standalone use**: Use [54yyyu/zotero-mcp](https://github.com/54yyyu/zotero-mcp) if you prefer not to install a Zotero plugin and want more transport options.
3. **For ZutiloRE integration**: Implement the MCP server described in this document only if:
   - You need tighter integration with ZutiloRE's existing features (e.g., metadata update, smart tag operations)
   - You want to avoid installing a separate plugin
   - You want the Zotero built-in server transport option (port 23119 sharing)

---

## 11. Client Configuration Examples

### 11.1 Claude Desktop (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "zotero": {
      "url": "http://127.0.0.1:23120/mcp"
    }
  }
}
```

### 11.2 Siyuan Note Copilot

Configure MCP server URL as: `http://127.0.0.1:23120/mcp`

### 11.3 Cursor

```json
{
  "mcpServers": {
    "zotero": {
      "url": "http://127.0.0.1:23120/mcp"
    }
  }
}
```

### 11.4 curl Testing

```bash
# 1. Initialize session
curl -s -X POST http://127.0.0.1:23120/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "test", "version": "1.0" }
    }
  }'

# 2. List available tools (use Mcp-Session-Id from step 1)
curl -s -X POST http://127.0.0.1:23120/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: SESSION_ID" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}'

# 3. Search for items
curl -s -X POST http://127.0.0.1:23120/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_items",
      "arguments": { "query": "machine learning", "limit": 5 }
    }
  }'

# 4. Terminate session
curl -s -X DELETE http://127.0.0.1:23120/mcp \
  -H "Mcp-Session-Id: SESSION_ID"
```

---

## 12. Implementation Checklist

If proceeding with implementation, follow this order:

1. [ ] Extend `typings/index.d.ts` with Zotero.Search, Server, Fulltext, annotation APIs, XPCOM socket interfaces
2. [ ] Create `src/modules/mcp/config.ts` -- preferences management
3. [ ] Create `src/modules/mcp/transport.ts` -- ITransport interface
4. [ ] Create `src/modules/mcp/protocol.ts` -- MCP JSON-RPC handler
5. [ ] Create `src/modules/mcp/tool-registry.ts` -- tool framework
6. [ ] Create `src/modules/mcp/transport-socket.ts` -- nsIServerSocket implementation
7. [ ] Create `src/modules/mcp/tools/helpers.ts` -- shared item serialization
8. [ ] Create `src/modules/mcp/tools/search-items.ts` -- first tool
9. [ ] Create remaining tools (get-item, get-notes, get-annotations, get-fulltext, list-collections, get-collection-items)
10. [ ] Create `src/modules/mcp/transport-zotero.ts` -- Zotero.Server.Endpoints backend
11. [ ] Create `src/modules/mcp/index.ts` -- public API
12. [ ] Integrate into `src/hooks.ts` and `src/index.ts`
13. [ ] Build and test with curl
14. [ ] Test with Siyuan Note Copilot
