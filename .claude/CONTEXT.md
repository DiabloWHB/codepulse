# CodePulse Context

<default_to_action>
MANDATORY: Use codepulse_search before Grep, codepulse_get_symbols_in_file before Read, codepulse_get_impact before modifying code.
</default_to_action>

## 🚨 CRITICAL: MCP Tools Usage Policy

**MANDATORY: ALWAYS use CodePulse MCP tools BEFORE Grep/Read/Glob!**

This workspace has MCP server with:
- Symbol index (79k+ symbols indexed)
- Impact analysis (callers, risk levels)
- File risk detection

### Required Tool Order:
1. **`codepulse_search`** - INSTEAD of Grep for finding code
2. **`codepulse_get_impact`** - BEFORE modifying any function (shows callers/risk)
3. **`codepulse_get_symbols_in_file`** - INSTEAD of Read for file overview
4. **`codepulse_get_file_risks`** - See risky functions in file

**❌ NEVER use Grep/Read directly for code search - use MCP first!**

---

## What We're Building
VS Code extension that shows code health AND dependency relationships.

## The Core Innovation: Impact Analysis
When AI changes a function, it sees:
- Who calls this function (via MCP: codepulse_get_impact)
- What will break if this changes
- Risk level of the change

## Tech Stack
- TypeScript 5.3
- tree-sitter 0.21.0
- VS Code Extension API 1.85
- Vitest for testing
- esbuild for bundling

## Architecture
```
src/
├── types/          # Type definitions including graph types
├── core/           # EventBus, StateManager (with graph), Cache, Config
├── analysis/
│   ├── analyzers/  # Static, Import, Env, Supabase
│   └── dependencies/  # ⭐ DependencyGraphBuilder, ImpactAnalyzer
├── integrations/   # Supabase
├── ui/             # Decorations, Diagnostics, StatusBar, TreeView
└── utils/          # Logger, debounce, hash, paths
```

## Key Types
- FunctionInfo.calls → functions this calls
- FunctionInfo.calledBy → functions that call this
- ImpactAnalysis → what breaks if you change this
