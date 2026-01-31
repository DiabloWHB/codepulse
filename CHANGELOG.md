# Changelog

All notable changes to CodePulse will be documented in this file.

## [0.2.1] - 2026-01-31

### Added

- **Impact Analysis MCP Tools** - Real-time caller tracking for Claude Code
  - `codepulse_get_impact` - Get impact analysis (callers count, risk level) for any function
  - `codepulse_get_file_risks` - List all high-risk functions in a file
  - Shows "123 callers | Critical Risk" before Claude Code makes changes
  - Prevents AI from unknowingly breaking dependencies

- **Auto-Analyze Workspace** - Automatic dependency graph building
  - Runs automatically on workspace startup (in background)
  - Builds complete function call graph
  - Generates impact data for all functions
  - No manual triggering required

- **Auto-Update Impact Data** - Real-time synchronization
  - Impact data updates automatically when files change
  - IndexWatcher now receives StateManager reference
  - Cache exports include latest impact analysis
  - Keeps MCP data fresh and accurate

- **Automatic MCP Tool Usage** - Claude Code integration enhancements
  - Added `<default_to_action>` block in CONTEXT.md
  - Updated SKILL.md with "MUST BE USED" directive
  - Created settings.local.json for auto-permissions
  - Claude Code now uses MCP tools automatically

### Changed

- **SymbolIndexManager** - Added `buildImpactDataFromIndex()` method
  - Builds impact data directly from symbol index
  - Uses signature matching to find callers
  - Calculates risk levels (low/medium/high/critical)
  - Independent of StateManager for initial build

- **IndexWatcher** - Enhanced to update impact data
  - Now accepts StateManager parameter
  - Passes StateManager to exportCache on updates
  - Impact data refreshes on every file change
  - Real-time synchronization with code changes

- **Extension Activation** - Added auto-analyze workspace
  - Calls `analyzeWorkspace()` automatically on startup
  - Runs in background without blocking UI
  - Ensures dependency graph is ready immediately

### Fixed

- **MCP Cache Updates** - Impact data now updates on file changes
  - Previously only built on initial index creation
  - Now regenerates on every cache export
  - Keeps Claude Code data synchronized

## [0.3.0] - 2026-01-30

### Added

- **🎨 Professional Webview Details Panel** - Complete redesign using Webview for rich UI
  - Beautiful HTML/CSS interface with modern design
  - Seamlessly integrates with VS Code themes (dark/light mode)
  - Color-coded risk indicators with pulsing animations
  - Professional styled buttons (primary, secondary, AI gradient)
  - Hover effects and transitions for better UX
  - Collapsible sections with smooth expand/collapse animations
  - No more TreeView limitations - full custom styling
  - Embedded directly in sidebar for unified experience

- **Enhanced Visual Design**
  - Gradient header with function name and location
  - Color-coded issue badges (ERROR/WARNING/INFO)
  - Risk meter with animated pulse effect
  - Clickable function cards with hover states
  - Professional button styling matching modern IDEs
  - Empty states with helpful messages

- **Interactive Features**
  - Click any issue to jump to its location
  - Click any affected function to navigate to it
  - Smooth collapsible sections for better organization
  - Message passing between webview and extension
  - Maintains state when hidden (retainContextWhenHidden)

### Changed

- **Replaced TreeView with Webview** for Details panel
  - Old: Simple list-based TreeView with limited styling
  - New: Full HTML/CSS Webview with complete design control
  - Better UX with professional appearance
  - Matches quality of top VS Code extensions (GitLens, Thunder Client, etc.)

### Fixed

- **UX Improvement: Embedded Webview** - Changed from WebviewPanel to WebviewViewProvider
  - Old: Webview opened in separate editor window (ViewColumn.Two)
  - New: Webview embedded directly in sidebar Details tab
  - Everything now appears in one place - no more split windows
  - Uses proper VS Code theme variables instead of hardcoded colors
  - Professional appearance that adapts to user's theme (dark/light)

### Technical Details

- Implemented WebviewViewProvider instead of WebviewPanel for better sidebar integration
- XSS protection with HTML escaping
- Efficient state management - only one function loaded at a time
- Embeds in sidebar Details tab (viewType: 'codepulse.detailsView')
- Uses CSS variables (--vscode-*) for theme consistency
- Full TypeScript type safety maintained
- retainContextWhenHidden for performance

## [0.2.0] - 2026-01-30

### Fixed

- **Parser: Empty File Support** - Fixed crash when analyzing empty TypeScript files. Parser now gracefully handles empty files instead of throwing errors.
- **Dependency Graph: Zero Connections Bug** - Fixed critical issue where dependency graph showed 0 connections despite finding function calls. Root cause was incorrect AST field mapping (`node.function` → `node.expression` for TypeScript).
  - Updated `childForFieldName()` in Parser.ts to correctly map tree-sitter field names to TypeScript AST properties
  - Fixed function call extraction - now correctly resolves 22+ connections in test workspace
  - Impact Analysis now properly shows CRITICAL/HIGH/MEDIUM/LOW risk levels instead of only LOW
- **Details View: Out Of Memory Crashes** - Completely rewrote Details view to prevent memory crashes
  - Implemented lazy loading - only loads data for the SELECTED function
  - Changed from auto-expanded to collapsed state to prevent premature data loading
  - Added limits: max 20 issues, 50 direct impacts, 50 indirect impacts per function
  - View starts with "No function selected" instead of loading all data
- **TreeView: Reveal Command Error** - Fixed "Required registered TreeDataProvider to implement 'getParent' method" error
  - Added `getParent()` method implementation to DetailsViewProvider
  - Removed problematic `treeView.reveal()` call that caused errors

### Added

- **Details View Panel** - New comprehensive details panel for selected functions
  - Function information header (name, file, line number)
  - Expandable Issues section (up to 20 issues with severity indicators)
  - Expandable Impact Analysis section with risk level calculation
  - Direct Callers list - shows which functions directly call the selected function (up to 50)
  - Indirect Impact list - shows functions affected through call chain (up to 50)
  - Actions section with command buttons
  - All sections use collapsed state by default for performance

- **Enhanced "Fix with AI" Feature** - Significantly improved AI context for better fixes
  - Now includes complete list of affected functions (10 direct + 10 indirect)
  - Shows file names and line numbers for all affected functions
  - Lists files that will need review after changes (up to 15)
  - Includes risk level calculation (LOW/MEDIUM/HIGH/CRITICAL)
  - Provides specific instructions to AI about backward compatibility
  - Warns about breaking changes and migration needs

- **Function Navigation** - Click on any function in Impact Analysis to:
  - See its details in the Details panel
  - View its dependencies and dependents
  - Jump to source code location
  - Access quick actions

### Improved

- **Impact Analysis Display** - Better visualization of function dependencies
  - Risk levels now calculated correctly: LOW (0-3), MEDIUM (4-10), HIGH (11-25), CRITICAL (25+)
  - Shows both direct and indirect impact with expandable lists
  - Displays actual function names instead of just counts
  - Color-coded risk indicators (🟢🟡🟠🔴)

- **TreeView Integration** - Health Status and Impact Analysis views now connect to Details
  - Clicking any function in Health Status shows its details
  - Clicking any function in Impact Analysis shows its details
  - Seamless navigation between views

- **Dependency Graph Performance** - Improved graph building with better logging
  - Added comprehensive logging for debugging connection issues
  - Better function call resolution with name-based lookup
  - Prevents OOM with MAX_DEPTH=5 and MAX_AFFECTED=100 limits

### Technical Improvements

- **Parser AST Mapping** - Fixed TypeScript AST property access
  - `call_expression.function` → `node.expression`
  - `member_expression.object` → `node.expression`
  - `member_expression.property` → `node.name`
  - Enables proper extraction of function calls from code

- **State Management** - Better separation of concerns
  - Details view only loads one function at a time
  - No automatic workspace-wide calculations
  - Lazy loading pattern prevents memory issues

- **Error Handling** - More robust error handling
  - Empty files no longer crash the parser
  - Missing getParent() no longer causes reveal errors
  - Better null checks throughout Details view

### Developer Notes

- Dependency graph now correctly identifies function calls using proper TypeScript AST traversal
- TreeDataProvider pattern updated to support VS Code's reveal() requirements
- Memory optimization through lazy loading and data limiting
- Ready for future Webview implementation for richer UI

## [0.1.0] - 2026-01-29

### Added

- **Dependency Graph**: Build and visualize function dependency graphs
- **Impact Analysis**: See what breaks when you change a function
- **Real-Time Monitoring**: Automatic analysis on file save/change
- **Inline Decorations**: Health status icons next to functions
- **Hover Information**: Issues and impact details on hover
- **Tree View**: Browse functions by health status
- **Status Bar**: Workspace health overview
- **Supabase Integration**: Schema validation for Supabase queries
- **Function Extraction**: Detect functions, methods, arrow functions
- **Import Analysis**: Track file dependencies
- **Environment Variable Detection**: Find `.env` usage

### Commands

- `CodePulse: Analyze Current File`
- `CodePulse: Analyze Workspace`
- `CodePulse: Show Impact Analysis`
- `CodePulse: Show Dashboard`
- `CodePulse: Refresh`

### Configuration

- `codepulse.enabled`: Enable/disable extension
- `codepulse.debounceDelay`: File change debounce delay
- `codepulse.supabase.enabled`: Enable Supabase integration
- `codepulse.graph.enabled`: Enable dependency graph
- `codepulse.graph.maxDepth`: Impact analysis depth limit
