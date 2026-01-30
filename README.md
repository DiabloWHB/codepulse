# CodePulse

**AI-Aware Code Health Monitoring** - Real-time dependency tracking designed specifically for AI-assisted development.

> 🤖 **Built for AI Developers**: CodePulse shows AI assistants (like Claude, Copilot) which functions will break *before* making changes, preventing cascade failures in large codebases.

## Features

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

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "CodePulse"
4. Click Install

Or install from VSIX:
```bash
code --install-extension codepulse-0.1.0.vsix
```

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `CodePulse: Analyze Current File` | Analyze the active file |
| `CodePulse: Analyze Workspace` | Analyze all files in workspace (shows progress) |
| `CodePulse: Show Dashboard` | View overall health metrics and statistics |
| `CodePulse: Show Impact Analysis` | Show impact for current file's functions |
| `CodePulse: Show Dependencies` | Browse function call relationships |
| `CodePulse: Show Project Report` | Generate comprehensive project health report |
| `CodePulse: Refresh` | Clear cache and re-analyze all open files |

### UI Components

- **CodeLens**: Impact warnings appear above each function
- **Hover Messages**: Detailed issue descriptions and impact analysis
- **Health Status Panel**: Tree view of all functions grouped by health
- **Quick Access Panel**: Fast navigation to problem functions
- **Details Webview**: Full impact analysis with visual risk indicators
- **Status Bar**: At-a-glance health percentage

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codepulse.enabled` | `true` | Enable/disable CodePulse |
| `codepulse.debounceDelay` | `300` | Debounce delay for file changes (ms) |
| `codepulse.supabase.enabled` | `true` | Enable Supabase integration |
| `codepulse.graph.enabled` | `true` | Enable dependency graph building |
| `codepulse.graph.maxDepth` | `5` | Maximum depth for impact analysis |

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
npm run build
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
git clone https://github.com/YOUR_USERNAME/codepulse.git
cd codepulse

# Install dependencies
npm install

# Run in watch mode
npm run watch

# Press F5 in VS Code to launch Extension Development Host
```

## Roadmap

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
