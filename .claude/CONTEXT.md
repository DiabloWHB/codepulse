# CodePulse Context

## What We're Building
VS Code extension that shows code health AND dependency relationships.

## The Core Innovation: Impact Analysis
When AI changes a function, it sees:
- Who calls this function
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
