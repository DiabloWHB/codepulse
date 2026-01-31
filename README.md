# CodePulse

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/DiabloWHB.codepulse-ai?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=DiabloWHB.codepulse-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-MCP%20Ready-blueviolet)](https://claude.ai/code)

**AI-Aware Code Health Monitoring + Symbol Index** - Real-time dependency tracking designed specifically for AI-assisted development.

> 🤖 **Built for AI Developers**: CodePulse shows AI assistants (like Claude, Copilot) which functions will break _before_ making changes, preventing cascade failures in large codebases.

> ⚡ **Claude Code Integration**: 90-97% token savings with built-in MCP server and symbol indexing. Claude Code can find any function in 1-5ms instead of scanning thousands of files. **NEW: Real-time impact analysis** shows Claude which functions will break before making changes!

## Features

### 🤖 Claude Code Integration (NEW!)

> **90-97% Token Savings** for AI-assisted development with Claude Code

- **Symbol Index**: Fast, semantic search across your entire codebase
- **MCP Server**: Exposes symbol index via Model Context Protocol
- **Custom Skills**: Auto-configures Claude Code to use the index instead of blind file scanning
- **Automatic Setup**: Skills and MCP config created automatically on first use
- **Token Efficiency**: Find functions in 400 tokens instead of 15,000+ tokens
- **Speed**: Index queries return in 1-5ms vs. seconds for file scanning

[See Claude Code Integration Guide](#claude-code-integration)

### 🎯 AI-Aware Impact Analysis

- **CodeLens Warnings**: Impact alerts appear directly above functions - visible to both you AND your AI assistant
- **AI Alert Messages**: Special markdown reports designed for AI consumption
- **Smart Path Resolution**: Shows full relative paths (e.g., `src/app/suppliers/[id]/page.tsx`) - perfect for Next.js projects
- **Copy-to-Clipboard**: One-click to copy impact analysis for pasting to AI

### 📊 Dependency Graph & Impact Analysis

- **Import-Aware Resolution**: Advanced algorithm that uses import statements to accurately resolve function calls (no more false negatives!)
- **Track Function Dependencies**: Automatically builds a graph of which functions call which
- **Impact Analysis**: "If I change this function, what breaks?" - see all affected code instantly
- **Risk Assessment**: Functions are rated by impact level (low/medium/high/critical)

### 💚 Real-Time Health Monitoring

- **Inline Decorations**: Health status icons (🟢🟡🔴) appear next to functions
- **Rich Hover Messages**: Detailed issue descriptions with AI-friendly formatting
  - Shows direct callers with full file paths
  - Displays total impact count
  - Suggests fixes when available
- **Ignore Functionality**: Mark issues as "won't fix" to clean up your health dashboard
- **Tree View**: Browse functions grouped by health status
- **Status Bar**: Quick overview of workspace health
- **Details Panel**: Click any function to see full impact analysis with visual risk indicators

### Supabase Integration

- **Schema Validation**: Validates queries against your local Supabase types
- **Table/Column Checking**: Warns about non-existent tables or columns
- **Migration Support**: Reads schema from `supabase/types.ts` or migration files

### 🔍 Advanced Code Analysis

- **Tree-Sitter Parser**: Fast, accurate syntax analysis for TypeScript/JavaScript
- **No File Size Limits**: Handles files of any size (no 32KB limitation)
- **Function Extraction**: Detects functions, methods, arrow functions, React components
- **Advanced Import Analysis**:
  - Supports default, named, and namespace imports
  - Handles import aliasing (e.g., `import { foo as bar }`)
  - Resolves local file imports accurately
  - Detects duplicate and missing imports
- **Smart Call Resolution**: Uses import data to accurately match function calls to definitions
- **Environment Variable Detection**: Finds `.env` usage patterns
- **Content Security Policy**: Secure webviews with CSP headers

## Why CodePulse for AI Development?

When using AI assistants (Claude, GitHub Copilot, etc.) to modify code in large projects, they often **can't see the full dependency graph**. This leads to:

❌ **Breaking changes**: AI modifies a function without knowing 50 other functions depend on it
❌ **Cascade failures**: One "small change" breaks multiple features across the app
❌ **Hidden dependencies**: AI doesn't know about calls in other files

**CodePulse solves this** by:

✅ **Making dependencies visible**: CodeLens shows impact directly in the code
✅ **AI-readable reports**: Formatted markdown that AI can understand
✅ **Full path resolution**: No confusion about which `page.tsx` file (critical for Next.js)
✅ **Copy-paste ready**: One click to copy full impact analysis to your AI chat

### Example: AI Sees This

```typescript
// 🔴 25 callers | Critical Risk  ← AI sees this CodeLens!
export function fetchUserData(userId: string) {
  // Hover shows:
  // ⚠️ AI Alert: This function has dependencies
  // Direct Callers:
  // - getUserProfile in src/app/profile/page.tsx:45
  // - validateUser in src/middleware/auth.tsx:120
  // - ... and 23 more

  return supabase.from('users').select('*').eq('id', userId);
}
```

Now your AI knows: "I can't just change this function's signature - I need to update 25 callers!"

## Claude Code Integration

CodePulse provides **native integration with Claude Code** via a Symbol Index System that saves **90-97% tokens** on code navigation tasks.

### How It Works

When you use Claude Code with CodePulse installed:

1. **Automatic Setup**: CodePulse creates:
   - `.claude/skills/` - Instructions for Claude Code to use the index
   - `.mcp.json` - MCP server configuration
   - `.codepulse/` - Symbol index cache (auto-updated)

2. **Smart Indexing**: CodePulse builds a searchable index of all symbols:
   - Functions, classes, components, types
   - File locations and line numbers
   - Signatures and documentation
   - Export/import relationships

3. **Automatic Analysis**: CodePulse automatically:
   - Builds dependency graph on workspace startup
   - Updates impact data when files change
   - Keeps the index synchronized in real-time

4. **Token-Efficient Search**: Claude Code queries the index instead of scanning files:

   **Without Index (traditional):**
   ```
   User: "Find the RateLimiter class"
   Claude: Grep "RateLimiter" → 50 files found
   Claude: Read all 50 files → 15,000 tokens
   ```

   **With CodePulse Index:**
   ```
   User: "Find the RateLimiter class"
   Claude: Query MCP → Found in rate-limiter.ts:54-195
   Claude: Read only that file → 400 tokens

   📊 Savings: 96% reduction!
   ```

### MCP Tools Available

Claude Code gets access to these tools automatically:

- `codepulse_search` - Search symbols with natural language
- `codepulse_get_context` - Get AI-optimized context for understanding code
- `codepulse_get_symbols_in_file` - List all symbols in a specific file
- `codepulse_get_impact` - **NEW!** Get impact analysis (callers, risk level) for any function
- `codepulse_get_file_risks` - **NEW!** List all high-risk functions in a file
- `codepulse_stats` - Show index statistics

### Impact Analysis for AI (NEW!)

CodePulse now provides **real-time impact analysis** to Claude Code:

- **Before Changes**: Claude Code can query `codepulse_get_impact` to see:
  - How many functions call this one (e.g., "123 callers")
  - Risk level (Low/Medium/High/Critical)
  - Affected files and locations
  - Direct callers with line numbers

- **Automatic Updates**: Impact data refreshes automatically when you:
  - Save a file
  - Change code structure
  - Add/remove function calls

- **Prevents Breaking Changes**: Claude Code sees warnings like:
  ```
  ⚠️ Function 'handleSubmit' has 42 callers (High Risk)
  Affected files:
  - src/components/Form.tsx:156
  - src/pages/checkout.tsx:89
  - ... and 40 more
  ```

This prevents AI from making changes that would break dozens of files!

### Setup for Claude Code Users

**CodePulse automatically sets up everything!** Just:

1. Install CodePulse extension in VS Code
2. Open your project
3. Wait for index to build (~30 seconds for large projects)
4. Open Claude Code terminal in the same workspace
5. Ask: "Find the [YourClass] class" - Claude will use the index!

### Recommended .gitignore

Add these to your project's `.gitignore`:

```gitignore
# CodePulse cache (regenerates automatically)
.codepulse/

# Optional: MCP config (if workspace-specific)
.mcp.json
```

The cache rebuilds automatically when files change, so no need to commit it.

### Token Savings Examples

Real-world comparisons:

| Task | Without Index | With Index | Savings |
|------|---------------|------------|---------|
| Find 1 function | 15,000 tokens | 400 tokens | **97%** |
| Understand integration | 30,000 tokens | 600 tokens | **98%** |
| List 5 components | 25,000 tokens | 800 tokens | **97%** |
| Trace dependencies | 20,000 tokens | 500 tokens | **98%** |

**Average: 97% token reduction** 🎯

### Learn More

- [MCP Integration Guide](docs/MCP_INTEGRATION.md) - Technical details
- [Skills Guide](docs/SKILL_GUIDE.md) - How skills work
- [Index System](docs/INDEX_SYSTEM.md) - Architecture

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "CodePulse"
4. Click Install

Or install from VSIX:

```bash
code --install-extension codepulse-ai-0.2.1.vsix
```

## Usage

### Commands

| Command                           | Description                                     |
| --------------------------------- | ----------------------------------------------- |
| `CodePulse: Analyze Current File` | Analyze the active file                         |
| `CodePulse: Analyze Workspace`    | Analyze all files in workspace (shows progress) |
| `CodePulse: Show Dashboard`       | View overall health metrics and statistics      |
| `CodePulse: Show Impact Analysis` | Show impact for current file's functions        |
| `CodePulse: Show Dependencies`    | Browse function call relationships              |
| `CodePulse: Show Project Report`  | Generate comprehensive project health report    |
| `CodePulse: Refresh`              | Clear cache and re-analyze all open files       |
| **Symbol Index**                  |                                                 |
| `CodePulse: Search Symbol`        | Search for functions, classes, components       |
| `CodePulse: Show Index Stats`     | View symbol index statistics and health         |
| `CodePulse: Rebuild Symbol Index` | Force rebuild of symbol index (if needed)       |

### UI Components

- **CodeLens**: Impact warnings appear above each function
- **Hover Messages**: Detailed issue descriptions and impact analysis
- **Health Status Panel**: Tree view of all functions grouped by health
- **Quick Access Panel**: Fast navigation to problem functions
- **Details Webview**: Full impact analysis with visual risk indicators
- **Status Bar**: At-a-glance health percentage

### Settings

| Setting                      | Default | Description                          |
| ---------------------------- | ------- | ------------------------------------ |
| `codepulse.enabled`          | `true`  | Enable/disable CodePulse             |
| `codepulse.debounceDelay`    | `300`   | Debounce delay for file changes (ms) |
| `codepulse.supabase.enabled` | `true`  | Enable Supabase integration          |
| `codepulse.graph.enabled`    | `true`  | Enable dependency graph building     |
| `codepulse.graph.maxDepth`   | `5`     | Maximum depth for impact analysis    |

## How It Works

### Dependency Tracking

CodePulse uses advanced static analysis to build an accurate dependency graph:

1. **Parse Files**: Uses tree-sitter to parse TypeScript/JavaScript AST
2. **Extract Functions**: Identifies all functions, methods, and arrow functions with precise locations
3. **Track Imports**: Records all import statements with full specifier details:
   - Default imports: `import Foo from './foo'`
   - Named imports: `import { bar, baz as qux } from './bar'`
   - Namespace imports: `import * as Utils from './utils'`
4. **Resolve Calls**: Uses import map to accurately match function calls to their definitions
   - **Step 1**: Check if function is imported (high accuracy)
   - **Step 2**: Fallback to name matching in same file
   - **Result**: ~90%+ resolution rate vs. 26% with naive matching
5. **Build Graph**: Creates directed graph of function dependencies
6. **Calculate Impact**: DFS traversal to find all affected functions (direct + indirect)

### Health Status

Functions are assigned health status based on detected issues:

- **Healthy** (green): No issues detected
- **Warning** (yellow): Minor issues (info-level diagnostics)
- **Error** (red): Significant issues detected

### Impact Levels

Functions are categorized by the number of other functions that depend on them:

- 🟢 **Low Risk**: 0-3 affected functions - safe to modify
- 🟡 **Medium Risk**: 4-10 affected functions - proceed with caution
- 🟠 **High Risk**: 11-25 affected functions - review all callers first
- 🔴 **Critical Risk**: 25+ affected functions - high-impact change, needs careful planning

Each level shows:

- **Direct callers**: Functions that call this one immediately
- **Indirect impact**: Functions affected through the call chain (with depth)
- **Full file paths**: No ambiguity about which file (crucial for monorepos/Next.js)

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.85+

### Setup

```bash
npm install
```

### Build

```bash
# Build extension
npm run build

# Build MCP server
npm run build:mcp

# Build both (for release)
npm run vscode:prepublish
```

### Test

```bash
npm test
```

### Watch Mode

```bash
npm run watch
```

### Package

```bash
npm run package
```

## Architecture

```
src/
├── analysis/                    # Code analysis engine
│   ├── analyzers/               # Individual analyzers
│   │   ├── BaseAnalyzer.ts
│   │   ├── ImportAnalyzer.ts   # Import tracking & resolution
│   │   ├── FunctionAnalyzer.ts
│   │   ├── SupabaseAnalyzer.ts
│   │   └── ProductionReadinessAnalyzer.ts
│   ├── dependencies/            # Dependency graph & impact analysis
│   │   ├── DependencyGraphBuilder.ts
│   │   └── ImpactAnalyzer.ts
│   ├── AnalysisEngine.ts
│   ├── FunctionExtractor.ts
│   └── Parser.ts                # Tree-sitter parser
├── core/                        # Core infrastructure
│   ├── CacheManager.ts
│   ├── ConfigManager.ts
│   ├── EventBus.ts
│   └── StateManager.ts          # Central state with import map
├── index/                       # Symbol Index System (NEW!)
│   ├── SymbolIndexManager.ts   # Core indexing engine
│   ├── AIContextProvider.ts    # AI-optimized context generation
│   ├── QueryEngine.ts          # Fuzzy search with scoring
│   ├── IndexWatcher.ts         # Real-time index updates
│   └── types.ts                # Symbol index types
├── mcp/                         # MCP Server (NEW!)
│   ├── server.ts               # MCP server implementation
│   ├── tools.ts                # Tool definitions
│   ├── index.ts                # Entry point
│   └── types.ts                # MCP types
├── skills/                      # Claude Code Skills (NEW!)
│   └── templates/              # Skill templates
│       ├── SKILL.md            # Main skill definition
│       └── examples/           # Usage examples
│           ├── good.md         # Best practices
│           └── bad.md          # Anti-patterns
├── integrations/                # External integrations
│   └── supabase/
│       ├── SchemaFetcher.ts
│       └── types.ts
├── reports/                     # Report generation
│   └── ProjectReport.ts
├── types/                       # TypeScript types
│   ├── analysis.ts              # ImportInfo, ImportSpecifier
│   ├── function.ts
│   ├── health.ts
│   └── errors.ts
├── ui/                          # VS Code UI components
│   ├── DecorationManager.ts    # Health icons + hover
│   ├── DiagnosticManager.ts
│   ├── StatusBarManager.ts
│   ├── TreeViewProvider.ts
│   ├── QuickAccessView.ts
│   ├── DetailsWebviewView.ts   # Main details panel (CSP-secured)
│   ├── DetailsWebview.ts        # Alternative panel
│   └── ImpactCodeLensProvider.ts # CodeLens for AI
├── utils/                       # Utilities
│   ├── logger.ts
│   ├── debounce.ts
│   └── paths.ts
└── extension.ts                 # Extension entry point
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/DiabloWHB/codepulse.git
cd codepulse

# Install dependencies
npm install

# Run in watch mode
npm run watch

# Press F5 in VS Code to launch Extension Development Host
```

## Roadmap

### ✅ Completed (v0.2.1)
- [x] **Symbol Index System**: Fast semantic search
- [x] **MCP Server Integration**: Claude Code support
- [x] **Custom Skills**: Auto-configuration for AI assistants
- [x] **Token Optimization**: 90-97% savings on code navigation
- [x] **Impact Analysis MCP Tools**: Real-time caller tracking for AI
- [x] **Auto-Analyze Workspace**: Automatic dependency graph on startup
- [x] **Auto-Update Index**: Real-time updates on file changes
- [x] **Automatic MCP Usage**: Claude Code uses MCP tools by default

### 🔜 Coming Soon
- [ ] **Index Optimization**: Exported-only symbols option for huge projects
- [ ] **SQLite Backend**: Faster queries for 100k+ symbols
- [ ] **VS Code Command Palette**: Direct symbol search in Command Palette
- [ ] **Export analysis**: Track what each file exports
- [ ] **React hooks tracking**: Understand React component dependencies
- [ ] **GraphQL integration**: Validate GraphQL queries
- [ ] **Test coverage integration**: Show which functions need tests
- [ ] **AI auto-fix**: Let AI automatically fix issues with user approval
- [ ] **Multi-language support**: Python, Go, Rust, etc.
- [ ] **CI/CD integration**: Run CodePulse in GitHub Actions

## License

MIT

---

**Built with ❤️ for AI-first development**

If CodePulse helps you build better software with AI, please star the repo! ⭐
