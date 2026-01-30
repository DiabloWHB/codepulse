# MCP Integration Guide

## Overview

CodePulse provides a Model Context Protocol (MCP) server that exposes the symbol index to AI assistants. This enables **90-97% token savings** by allowing AI to query the index directly instead of blindly searching through files.

## What is MCP?

Model Context Protocol is a standardized way for AI assistants to access external data sources and tools. The CodePulse MCP server runs as a stdio-based process and provides fast, indexed access to your codebase symbols.

## Benefits

- **Massive Token Savings**: 90-97% reduction in tokens used for code navigation
- **Faster Responses**: Index queries return in 1-5ms vs. seconds for file scanning
- **More Accurate**: Fuzzy matching and semantic search find exactly what you need
- **Always Up-to-Date**: Cache is automatically refreshed when files change

## Architecture

```
Claude Code / AI Assistant
    ↓ (stdio: JSON-RPC)
MCP Server (Node.js process)
    ↓ (reads from)
Index Cache File (.codepulse/index.cache.json)
    ↑ (written by)
VSCode Extension (SymbolIndexManager)
```

The system works by:
1. VSCode extension builds and maintains the symbol index
2. Index is periodically exported to `.codepulse/index.cache.json`
3. MCP server reads the cached index on each query
4. AI gets precise code locations without scanning files

## Setup

### 1. Build the Extension

The MCP server is automatically built when you build the extension:

```bash
npm run build        # Builds extension
npm run build:mcp    # Builds MCP server
```

Or build both at once:

```bash
npm run vscode:prepublish
```

### 2. Configure Claude Code

The `.mcp.json` file at the project root configures the MCP server for Claude Code:

```json
{
  "mcpServers": {
    "codepulse": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp/index.js"],
      "env": {
        "WORKSPACE_PATH": "${workspaceFolder}",
        "INDEX_CACHE_PATH": "${workspaceFolder}/.codepulse/index.cache.json"
      }
    }
  }
}
```

This configuration is automatically detected by Claude Code when you open the project.

### 3. Verify Setup

To verify the MCP server is working:

1. Open the project in Claude Code
2. The MCP server should auto-start (check `.claude/logs/` for MCP logs)
3. Try querying the index:
   ```
   User: "Find the sendPDF function"
   Claude: [Should use codepulse_search tool]
   ```

## Available Tools

The MCP server exposes 4 tools:

### 1. `codepulse_search`

Search symbols using natural language.

**Parameters:**
- `query` (string, required): Natural language search (e.g., "sendPDF function", "client email handler")
- `limit` (number, optional): Max results (default: 10)
- `kinds` (string[], optional): Filter by kind (function, class, component, etc.)

**Example:**
```javascript
{
  "query": "PDF send function in client page",
  "limit": 5,
  "kinds": ["function"]
}
```

**Returns:**
- Symbol names, file paths, line numbers
- Match scores and reasons
- Code signatures and documentation
- Precise locations for Read tool

### 2. `codepulse_get_context`

Get comprehensive AI-optimized context for understanding code.

**Parameters:**
- `query` (string, required): What you're trying to understand
- `includeSnippets` (boolean, optional): Include code snippets (default: true)

**Example:**
```javascript
{
  "query": "email sending integration",
  "includeSnippets": true
}
```

**Returns:**
- Primary symbols related to query
- Related/dependent symbols
- Code snippets with relevance explanations
- Files involved
- Confidence score

### 3. `codepulse_get_symbols_in_file`

Get all symbols in a specific file.

**Parameters:**
- `filePath` (string, required): File path (relative or absolute)

**Example:**
```javascript
{
  "filePath": "app/tickets/[id]/page.tsx"
}
```

**Returns:**
- All symbols in the file
- Exports and imports
- Symbol kinds, scopes, and locations

### 4. `codepulse_stats`

Show index statistics.

**Parameters:** None

**Returns:**
- Total symbols and files
- Breakdown by kind
- Export vs. local counts
- Index age and freshness

## Usage Examples

### Example 1: Finding a Function

**Without MCP (wasteful):**
```
User: "Find the sendPDF function"
AI:
1. Grep "sendPDF" across all files → 50 matches
2. Read 50 files → 15,000 tokens
3. Manually identify the right function
Total: 15,000+ tokens
```

**With MCP (efficient):**
```
User: "Find the sendPDF function"
AI:
1. Call codepulse_search("sendPDF function") → 400 tokens
2. Get exact location: app/tickets/[id]/page.tsx:978-1006
3. Read only those lines
Total: ~450 tokens (97% savings!)
```

### Example 2: Understanding Integration

**Without MCP:**
```
User: "How does email sending work?"
AI:
1. Launch Explore agent → scans 200 files
2. Reads email-related code → 30,000 tokens
3. Attempts to piece together the flow
Total: 30,000+ tokens
```

**With MCP:**
```
User: "How does email sending work?"
AI:
1. Call codepulse_get_context("email sending") → 600 tokens
2. Gets: sendPDFEmail, postmarkClient, buildEmailTemplate
3. Reads specific functions
Total: ~700 tokens (98% savings!)
```

## Cache Management

### Automatic Updates

The cache is automatically updated:
- After initial index build (on extension activation)
- When files are saved (debounced, max 1/second)
- When index is manually rebuilt

### Cache Location

The cache is stored at: `.codepulse/index.cache.json`

This file should be:
- ✅ Committed to git (speeds up clone/checkout)
- ✅ Ignored if very large (>5MB)
- ✅ Refreshed automatically

### Manual Rebuild

To force a cache rebuild:
1. Open command palette (Ctrl+Shift+P)
2. Run "CodePulse: Rebuild Symbol Index"
3. Cache will be regenerated

## Troubleshooting

### MCP Server Not Starting

**Symptoms:**
- AI not using index tools
- No MCP logs in `.claude/logs/`

**Solutions:**
1. Check that extension is built: `npm run build && npm run build:mcp`
2. Verify `.mcp.json` exists at project root
3. Check `.codepulse/index.cache.json` exists
4. Restart Claude Code

### Index Not Found Error

**Symptoms:**
- MCP server errors: "Index cache not found"

**Solutions:**
1. Open VSCode and activate the extension (open a TypeScript file)
2. Wait for index to build (notification will appear)
3. Check `.codepulse/index.cache.json` was created
4. Retry MCP query

### Stale Index

**Symptoms:**
- MCP returns old/missing symbols
- Recent code changes not reflected

**Solutions:**
1. Check index age: Run `codepulse_stats` tool
2. Manually rebuild: "CodePulse: Rebuild Symbol Index"
3. Verify file watcher is running (check extension logs)

### TypeScript Compilation Errors

**Symptoms:**
- `npm run build:mcp` fails

**Solutions:**
1. Check `tsconfig.mcp.json` is present
2. Verify `@modelcontextprotocol/sdk` is installed: `npm install`
3. Clean and rebuild: `rm -rf dist/mcp && npm run build:mcp`

## Performance

### Index Build Time

- Small project (< 50 files): 1-2 seconds
- Medium project (50-500 files): 5-15 seconds
- Large project (500+ files): 30-60 seconds

### Query Performance

- Symbol search: 1-5ms
- Context retrieval: 5-20ms
- Stats: < 1ms

### Cache Size

- Typical: 100-500KB
- Large projects: 1-5MB
- Huge projects: 10MB+ (consider gitignore)

## Integration with Custom Skill

The MCP server works alongside the custom skill (`.claude/skills/codepulse-index/`):

- **Skill**: Provides guidance and instructions to AI
- **MCP Server**: Provides tools for executing index queries

Both work together to ensure AI uses the index efficiently.

## Advanced Configuration

### Custom Cache Path

Modify `.mcp.json` to use a different cache location:

```json
{
  "mcpServers": {
    "codepulse": {
      "env": {
        "INDEX_CACHE_PATH": "/custom/path/index.cache.json"
      }
    }
  }
}
```

### Disable Auto-Start

To manually start the MCP server:

```json
{
  "mcpServers": {
    "codepulse": {
      "metadata": {
        "autoStart": false
      }
    }
  }
}
```

## Best Practices

1. **Always build before using**: Run `npm run build && npm run build:mcp`
2. **Commit the cache**: Speeds up CI/CD and team onboarding
3. **Monitor index age**: Use `codepulse_stats` to check freshness
4. **Rebuild on major changes**: After rebasing, refactoring, etc.
5. **Use natural language**: Queries like "email handler" work better than "sendEmail.*"

## Token Savings Comparison

| Task | Without Index | With MCP | Savings |
|------|---------------|----------|---------|
| Find function | 15,000 | 400 | 97.3% |
| Understand flow | 30,000 | 600 | 98% |
| List components | 25,000 | 800 | 96.8% |
| Get function info | 5,000 | 300 | 94% |
| **Average** | **18,750** | **525** | **97%** |

## Next Steps

1. Read [SKILL_GUIDE.md](./SKILL_GUIDE.md) for skill usage
2. Check [INDEX_SYSTEM.md](./INDEX_SYSTEM.md) for index details
3. See [examples/good.md](../.claude/skills/codepulse-index/examples/good.md) for best practices
4. Avoid [examples/bad.md](../.claude/skills/codepulse-index/examples/bad.md) anti-patterns

## Support

- Issues: https://github.com/DiabloWHB/codepulse/issues
- Discussions: https://github.com/DiabloWHB/codepulse/discussions
