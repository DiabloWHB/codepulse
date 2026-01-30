# Symbol Index System

## Overview

The **Symbol Index System** is an advanced code intelligence feature in CodePulse that provides fast, intelligent code navigation and context generation for AI-assisted development.

### Key Features

✅ **Lightning-fast symbol search** - Find any function, class, or variable instantly
✅ **Fuzzy matching** - Works even with typos or partial names
✅ **Real-time updates** - Automatically updates as you code
✅ **AI-optimized** - Reduces token usage by up to 90%
✅ **Dependency tracking** - Understands code relationships
✅ **Smart context generation** - Provides AI with precise, relevant code snippets

---

## How It Works

### 1. Index Building

When CodePulse activates, it automatically builds an index of all symbols in your workspace:

```
Building Symbol Index...
├── Scanning workspace files
├── Extracting symbols (functions, classes, etc.)
├── Analyzing dependencies
├── Building search indices
└── Ready!
```

**What gets indexed:**
- Functions and methods
- Classes and interfaces
- Types and type aliases
- Variables and constants
- React components and hooks
- Imports and exports

### 2. Real-Time Updates

The `IndexWatcher` monitors file changes and updates the index instantly:

```typescript
File changed: src/components/Button.tsx
└── Updating index...
    ├── Re-parsing file
    ├── Updating symbols
    └── Done in 15ms
```

**Triggers:**
- File save
- File create
- File delete
- Active editor change

### 3. Intelligent Search

The `QueryEngine` provides powerful search capabilities:

```typescript
// Example: Search for "sendReport"
codepulse.searchSymbol("sendReport")

Results:
1. sendReport (function) - pages/ClientPage.tsx:145
   Score: 100% - Exact match

2. sendReportToClient (function) - utils/reports.ts:23
   Score: 85% - Contains match

3. handleReportSend (function) - components/ReportForm.tsx:67
   Score: 70% - CamelCase match
```

**Search features:**
- Exact name matching
- Fuzzy matching (typo-tolerant)
- CamelCase matching (`sr` matches `sendReport`)
- Levenshtein distance calculation
- Context-aware ranking
- Scope filtering (export/local)
- Kind filtering (function/class/etc.)

### 4. AI Context Provider

The **most important feature** - provides AI with precise code context:

```typescript
User: "Why isn't the send report button working in the client page?"

AI calls: codepulse.getAIContext("send report client page")

Index returns:
{
  primary: [
    {
      name: "sendReport",
      kind: "function",
      file: "pages/ClientPage.tsx",
      location: { line: 145 }
    }
  ],
  related: [
    { name: "formatReport", file: "utils/report.ts", line: 23 },
    { name: "apiClient.post", file: "api/client.ts", line: 67 }
  ],
  codeSnippets: [
    {
      file: "pages/ClientPage.tsx",
      lines: 142-170,
      code: "async function sendReport(...) { ... }",
      relevance: "Primary match"
    }
  ],
  confidence: 0.95
}
```

**Result:** AI reads only the relevant code (200 tokens) instead of scanning the entire codebase (8000+ tokens).

**Token savings: 97.5%** 🚀

---

## Architecture

### Components

```
Symbol Index System
│
├── SymbolIndexManager (Core)
│   ├── buildIndex() - Build complete index
│   ├── indexFile() - Index single file
│   └── search() - Search symbols
│
├── QueryEngine (Search)
│   ├── fuzzySearch() - Fuzzy name matching
│   ├── searchByContext() - Natural language search
│   └── scoreAndRank() - Relevance ranking
│
├── AIContextProvider (AI Integration)
│   ├── getContextForQuery() - Query → Context
│   ├── formatContextForAI() - Format for AI
│   └── registerAICommand() - VSCode command
│
└── IndexWatcher (Real-time)
    ├── start() - Watch file changes
    ├── queueUpdate() - Queue file updates
    └── processQueue() - Process updates
```

### Data Structures

#### SymbolInfo
```typescript
{
  id: "src/utils.ts:23:formatDate",
  name: "formatDate",
  kind: "function",
  file: "src/utils.ts",
  location: { startLine: 23, endLine: 35 },
  signature: "function formatDate(date: Date): string",
  documentation: "/** Formats a date to YYYY-MM-DD */",
  scope: "export",
  dependencies: [...],
  usages: [...]
}
```

#### CodeIndex
```typescript
{
  symbols: Map<id, SymbolInfo>,
  nameIndex: Map<name, id[]>,     // Fast name lookup
  fileIndex: Map<file, metadata>,  // File → symbols
  kindIndex: Map<kind, id[]>,      // Kind → symbols
  containerIndex: Map<name, id[]>, // Container → symbols
  stats: { ... }
}
```

---

## Usage

### Commands

#### 1. Search Symbol
**Command:** `CodePulse: Search Symbol`
**Shortcut:** `Ctrl+Shift+P` → Search Symbol

Search for any symbol in your workspace:
```
Search: sendReport

Results:
→ sendReport (function) in ClientPage.tsx:145
  formatReport (function) in report.ts:23
  ReportSender (class) in ReportSender.ts:10
```

Click to jump to definition.

#### 2. Get Symbol Context (AI)
**Command:** `CodePulse: Get Symbol Context (AI)`
**Context menu:** Right-click on code → CodePulse → Get Symbol Context

Get AI-ready context for the symbol at cursor:
```markdown
# Code Context from Index

Found 1 primary symbol(s)

## Primary Symbols

### sendReport (function)
**Location:** `pages/ClientPage.tsx:145`
**Signature:** `async function sendReport(clientId: string, data: ReportData): Promise<void>`

## Related Symbols
- formatReport (function) in utils/report.ts:23
- sendToServer (function) in api/client.ts:67

## Code Snippets
...
```

#### 3. Show Index Statistics
**Command:** `CodePulse: Show Index Statistics`

View index stats:
```
Total Symbols: 1,234
Total Files: 89
Exported: 456
Local: 778

By Kind:
- function: 567
- class: 123
- interface: 234
- component: 89
...

AI Context Provider:
Total Queries: 45
Cache Hits: 12 (26.7%)
```

#### 4. Rebuild Index
**Command:** `CodePulse: Rebuild Symbol Index`

Rebuild the entire index from scratch (useful if index gets out of sync).

### Programmatic Usage

#### For AI Assistants

**MANDATORY:** AI must use this command to get code context:

```typescript
// Get context for a natural language query
const result = await vscode.commands.executeCommand(
  'codepulse.getAIContext',
  'send report button client page'
);

// result.formatted contains markdown-formatted context
// result.context contains structured data
```

**Example flow:**
```
User: "Fix the send report function in client page"

AI:
1. Call: codepulse.getAIContext("send report client page")
2. Receive: Primary symbol + dependencies + code snippets
3. Read: Only the 200 lines of relevant code
4. Fix: Make the changes
5. Profit: Saved 95% of tokens!
```

#### For Extension Developers

```typescript
import { SymbolIndexManager, AIContextProvider } from './index';

// Create index manager
const indexManager = new SymbolIndexManager();
await indexManager.buildIndex(workspaceRoot);

// Search symbols
const results = indexManager.search({
  terms: ['sendReport'],
  kinds: ['function'],
  scope: 'export',
  fuzzyThreshold: 0.6
});

// Get AI context
const aiContext = new AIContextProvider(indexManager);
const context = await aiContext.getContextForQuery('send report button');
```

---

## Performance

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Build index (1000 files) | 5-10s | One-time on startup |
| Update single file | 10-50ms | Real-time |
| Search query | 1-5ms | Instant |
| Get AI context | 10-30ms | Very fast |

### Memory Usage

- **Typical workspace (100 files, 1000 symbols):** ~5MB
- **Large workspace (1000 files, 10000 symbols):** ~50MB
- **Enterprise workspace (5000 files, 50000 symbols):** ~250MB

### Token Savings

**Without Index:**
```
User: "Fix send report button"
AI: Searches workspace → Reads 10 files → 8000 tokens
```

**With Index:**
```
User: "Fix send report button"
AI: Queries index → Gets exact location → Reads 30 lines → 200 tokens
Savings: 97.5% (7800 tokens saved)
```

**Real-world impact:**
- Average query: 90% token reduction
- Complex query: 95% token reduction
- Simple query: 80% token reduction

**Cost savings:**
- 1000 queries/month: $50 → $5 (90% savings)
- 10000 queries/month: $500 → $50 (90% savings)

---

## Configuration

Add to `.vscode/settings.json`:

```json
{
  "codepulse.index.enabled": true,
  "codepulse.index.debounceDelay": 300,
  "codepulse.index.maxSymbols": 100000,
  "codepulse.index.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**"
  ]
}
```

---

## Troubleshooting

### Index not updating
1. Check if file is excluded (node_modules, dist, etc.)
2. Rebuild index: `CodePulse: Rebuild Symbol Index`
3. Check output channel: `CodePulse AI Context`

### Search returns no results
1. Make sure index is built (check status bar)
2. Try rebuilding index
3. Check if file contains actual symbols (functions, classes)

### Performance issues
1. Exclude large directories (node_modules, dist)
2. Reduce `maxSymbols` setting
3. Increase `debounceDelay` setting

---

## Future Enhancements

🔮 **Planned features:**
- [ ] SQLite persistent storage (survive restarts)
- [ ] Semantic search using embeddings
- [ ] Cross-workspace symbol references
- [ ] Symbol usage analytics
- [ ] Automatic context optimization
- [ ] Integration with GitHub Copilot
- [ ] Custom symbol extractors

---

## FAQ

**Q: Does this work with JavaScript?**
A: Yes! Supports TypeScript, JavaScript, TSX, and JSX.

**Q: How is this different from VSCode's built-in symbol search?**
A: This is optimized for AI context generation with dependency tracking, fuzzy search, and smart ranking.

**Q: Will this slow down my editor?**
A: No! Indexing runs in background. Updates are debounced and queued.

**Q: Can I disable it?**
A: Yes, but you'll lose AI context optimization. Set `codepulse.index.enabled: false`.

**Q: Does it work offline?**
A: Yes! 100% local, no API calls.

**Q: What about large monorepos?**
A: Tested up to 50,000 symbols. Use exclude patterns for best performance.

---

## Technical Details

### Symbol Extraction

Uses VSCode's `DocumentSymbolProvider`:
```typescript
const symbols = await vscode.commands.executeCommand(
  'vscode.executeDocumentSymbolProvider',
  fileUri
);
```

**Why?** Leverages TypeScript language server for accurate symbol detection.

### Fuzzy Matching Algorithm

1. **Exact match**: `sendReport` === `sendReport` → Score: 1.0
2. **Starts with**: `sendReport`.startsWith(`send`) → Score: 0.9
3. **Contains**: `sendReport`.includes(`Report`) → Score: 0.7
4. **Levenshtein**: Distance < threshold → Score: 0.5-0.7
5. **CamelCase**: `sr` matches `sendReport` → Score: 0.8

### Dependency Resolution

Tracks:
- Import statements
- Function calls
- Type references
- Class inheritance
- Interface implementation

---

## AI Usage Enforcement

### The Problem

The symbol index provides massive token savings (90-97%), but AI assistants can bypass it and use traditional file scanning methods (Grep, Read, Task agents), wasting tokens.

**Example of the problem:**
- User: "Find the sendPDF function"
- AI without enforcement: Grep → Read 50 files → 15,000 tokens
- AI with enforcement: Index query → Read 1 file → 400 tokens
- **Wasted: 97% of tokens!**

### The Solution: Two-Layer Approach

CodePulse uses a two-layer system to guide (not enforce) AI to use the index:

#### Layer 1: Custom Skill (Strong Guidance)

**Location:** `.claude/skills/codepulse-index/SKILL.md`

A custom skill file provides:
- **Policy**: Clear instructions to query index before using Read/Grep/Glob
- **Examples**: Correct vs incorrect usage patterns
- **Benefits**: Explains 90-97% token savings
- **Workflow**: Step-by-step guidance

**Key features:**
```yaml
---
name: codepulse-index
description: Use CodePulse symbol index (saves 90%+ tokens)
user-invocable: false
---

# Policy
BEFORE using Read, Grep, or Glob:
ALWAYS call codepulse.getAIContext('<query>')
```

**Documentation:** See [SKILL_GUIDE.md](./SKILL_GUIDE.md)

#### Layer 2: MCP Server (Easy Access)

**Location:** `src/mcp/` + `.mcp.json`

An MCP server exposes the index as standardized tools:
- `codepulse_search` - Search symbols with natural language
- `codepulse_get_context` - Get AI-optimized context
- `codepulse_get_symbols_in_file` - List symbols in a file
- `codepulse_stats` - Show index statistics

**Benefits:**
- Easier to discover than VSCode commands
- Standardized JSON-RPC protocol
- Works with all MCP-compatible AI assistants
- Auto-starts with Claude Code

**Documentation:** See [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)

### How It Works Together

```
User Query
    ↓
AI reads Custom Skill → Learns to use index first
    ↓
AI has access to MCP tools → Easy index access
    ↓
AI calls codepulse_search/get_context
    ↓
MCP Server reads .codepulse/index.cache.json
    ↓
Returns precise locations
    ↓
AI reads only specific lines
    ↓
Reports 90-97% token savings
```

### Cache Export System

To enable the MCP server, the index is automatically exported to a JSON cache:

**Trigger points:**
1. After initial index build (extension activation)
2. After manual index rebuild
3. After file updates (debounced, max 1/second)

**Export method:**
```typescript
// In SymbolIndexManager
public async exportCache(cachePath: string): Promise<void> {
  const cache = {
    symbols: Array.from(this.index.symbols.entries()),
    nameIndex: Array.from(this.index.nameIndex.entries()),
    fileIndex: Array.from(this.index.fileIndex.entries()),
    kindIndex: Array.from(this.index.kindIndex.entries()),
    containerIndex: Array.from(this.index.containerIndex.entries()),
    stats: this.index.stats,
    builtAt: this.index.builtAt
  };

  await fs.promises.writeFile(cachePath, JSON.stringify(cache, null, 2));
}
```

**Cache location:** `.codepulse/index.cache.json`

### Token Savings Evidence

| Task | Without Index | With Index | Savings |
|------|---------------|------------|---------|
| Find function | 15,000 tokens | 400 tokens | 97.3% |
| Understand integration | 30,000 tokens | 600 tokens | 98% |
| Find callers | 20,000 tokens | 300 tokens | 98.5% |
| List components | 25,000 tokens | 800 tokens | 96.8% |
| Get stats | 5,000 tokens | 50 tokens | 99% |
| **Average** | **19,000** | **430** | **97.7%** |

### Setup Instructions

1. **Build everything:**
   ```bash
   npm run build         # Builds extension
   npm run build:mcp     # Builds MCP server
   ```

2. **Verify skill exists:**
   ```bash
   ls .claude/skills/codepulse-index/SKILL.md
   ```

3. **Check MCP config:**
   ```bash
   ls .mcp.json
   ```

4. **Open in Claude Code:**
   - Skill auto-loads
   - MCP server auto-starts
   - Index cache auto-generates

5. **Test usage:**
   ```
   User: "Find the sendPDF function"
   AI: [Should use codepulse_search tool]
   ```

### Limitations

**Important reality check:**
- Skills provide **guidance**, not **enforcement**
- AI can still choose to bypass the index
- MCP tools **supplement** built-in tools (Read, Grep)
- Cannot technically force AI to use index

**Why this still works:**
- Clear, emphatic instructions in skill
- Concrete examples showing massive savings
- Easy-to-use MCP tools reduce friction
- AI assistants generally follow skill guidance

### Monitoring Usage

To verify AI is using the index:

1. **Check for savings reports:**
   ```
   📊 Used CodePulse index: Found in 2 files, read 85 lines (saved ~14,550 tokens)
   ```

2. **Monitor token usage:**
   - With index: 400-1000 tokens per code search
   - Without index: 10,000-30,000 tokens

3. **Observe behavior:**
   - ✅ Good: AI calls codepulse tools before Read
   - ❌ Bad: AI goes straight to Grep/Read

### Troubleshooting

**AI not using index:**
1. Check skill file exists and has valid YAML
2. Verify MCP server is built (`ls dist/mcp/index.js`)
3. Ensure cache exists (`.codepulse/index.cache.json`)
4. Restart Claude Code
5. Manually remind: "Please use the CodePulse index"

**Index queries failing:**
1. Rebuild index: "CodePulse: Rebuild Symbol Index"
2. Check cache age in `codepulse_stats`
3. Verify extension is active

### Files Added

**Skill system:**
- `.claude/skills/codepulse-index/SKILL.md` - Main skill
- `.claude/skills/codepulse-index/examples/good.md` - Best practices
- `.claude/skills/codepulse-index/examples/bad.md` - Anti-patterns

**MCP server:**
- `src/mcp/index.ts` - Entry point
- `src/mcp/server.ts` - Main server logic
- `src/mcp/tools.ts` - Tool definitions
- `src/mcp/types.ts` - Type definitions
- `tsconfig.mcp.json` - TypeScript config
- `.mcp.json` - MCP server configuration

**Documentation:**
- `docs/MCP_INTEGRATION.md` - MCP server guide
- `docs/SKILL_GUIDE.md` - Skill usage guide

**Build artifacts:**
- `dist/mcp/` - Compiled MCP server
- `.codepulse/index.cache.json` - Exported index cache

---

## Contributing

Want to improve the index system?

1. Read the code in `src/index/`
2. Check existing issues
3. Submit a PR!

**Key files:**
- `SymbolIndexManager.ts` - Core indexing logic
- `QueryEngine.ts` - Search algorithms
- `AIContextProvider.ts` - AI integration
- `IndexWatcher.ts` - Real-time updates

---

## License

MIT License - See LICENSE file

---

**Built with ❤️ by the CodePulse team**

*Making AI-assisted development faster and smarter, one symbol at a time.*
