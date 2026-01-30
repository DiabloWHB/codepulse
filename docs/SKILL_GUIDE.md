# CodePulse Skill Guide

## Overview

The CodePulse custom skill guides AI assistants (especially Claude Code) to use the symbol index efficiently, achieving **90-97% token savings** compared to traditional file scanning.

## What is the Skill?

The skill is a markdown file (`.claude/skills/codepulse-index/SKILL.md`) with YAML frontmatter that provides:
- **Instructions**: How and when to use the index
- **Policy**: Token-saving best practices
- **Examples**: Correct and incorrect usage patterns

## Location

```
.claude/
  └── skills/
      └── codepulse-index/
          ├── SKILL.md           # Main skill definition
          └── examples/
              ├── good.md         # Correct usage examples
              └── bad.md          # Anti-patterns to avoid
```

## How It Works

When Claude Code opens your project:
1. Reads `.claude/skills/codepulse-index/SKILL.md`
2. Learns about the index and its benefits
3. Is instructed to query the index before using Read/Grep/Glob
4. Follows the token-saving policy

## Skill Content

### YAML Frontmatter

```yaml
---
name: codepulse-index
description: Use CodePulse symbol index for efficient code navigation (saves 90%+ tokens)
user-invocable: false
allowed-tools: Read, Grep, Glob, Bash(npm *)
---
```

- **name**: Skill identifier
- **description**: What the skill does
- **user-invocable**: false (automatic, not manually triggered)
- **allowed-tools**: Tools the skill can use

### Policy Section

The skill defines a clear policy:

**BEFORE using Read, Grep, or Glob:**
- ✅ Query the index first
- ✅ Use natural language
- ✅ Read only returned locations
- ✅ Report token savings

**Example workflow:**
```
User Query
    ↓
codepulse.getAIContext('<query>')
    ↓
Receive precise locations
    ↓
Read only specific lines
    ↓
Report savings
```

## Examples

### ✅ Correct Usage

**Finding a Function:**
```
User: "Where is the sendPDF function?"

AI:
1. Call: codepulse.getAIContext("sendPDF function")
2. Receive: page.tsx:978-1006
3. Read: page.tsx lines 970-1010
4. Report: "📊 Used index: Found in 1 file, read 40 lines (saved ~14,500 tokens)"

Result: 450 tokens vs 15,000 tokens without index
Savings: 97%
```

**Understanding Integration:**
```
User: "How does email sending work?"

AI:
1. Call: codepulse.getAIContext("email sending integration")
2. Receive: sendPDFEmail, postmarkClient, buildEmailTemplate
3. Read: Only those specific functions
4. Report: "📊 Used index: Found 3 symbols (saved ~29,400 tokens)"

Result: 600 tokens vs 30,000 tokens
Savings: 98%
```

### ❌ Incorrect Usage (Anti-Patterns)

**Blind Grep Search:**
```
User: "Find the sendPDF function"

AI (WRONG):
1. Grep "sendPDF" → 50 matches
2. Read all 50 files
3. Manually identify function

Result: 15,000 tokens wasted!
Should have: Used index → 400 tokens
```

**Explore Agent Overuse:**
```
User: "How does email work?"

AI (WRONG):
1. Launch Explore agent
2. Scan 200+ files
3. Read everything email-related

Result: 30,000 tokens wasted!
Should have: Used index → 600 tokens
```

## Integration Commands

The skill references these VSCode commands:

### 1. `codepulse.getAIContext`

**Purpose**: Get AI-optimized context for a query

**Usage in Code:**
```javascript
await vscode.commands.executeCommand(
  'codepulse.getAIContext',
  'your search query'
);
```

**Returns:**
```javascript
{
  primary: [
    {
      name: "sendPDFEmail",
      file: "api/tickets/[id]/send-pdf-email/route.ts",
      location: { startLine: 332, endLine: 350 }
    }
  ],
  related: [...],
  codeSnippets: [...],
  files: [...],
  confidence: 0.95
}
```

### 2. `codepulse.searchSymbol`

**Purpose**: Search for specific symbols

**Usage**: Command palette or Quick Actions

**Returns**: Searchable list of symbols with locations

### 3. `codepulse.showIndexStats`

**Purpose**: Check index health and coverage

**Returns**: Statistics (total symbols, files, kinds, etc.)

## When to Use the Index

### ✅ Use the Index For:

- Finding functions, classes, components
- Understanding code structure
- Locating specific features
- Tracing dependencies
- Any symbol-based search

### ❌ Skip the Index For:

- Searching for text patterns (not symbols)
- Finding TODO comments
- Searching in non-code files (markdown, JSON)
- Grep-style pattern matching

## Token Savings Report

The skill instructs AI to report savings after each query:

**Format:**
```
📊 Used CodePulse index:
   - Found in X files
   - Read Y lines
   - Saved ~Z tokens (vs blind search)
```

**Example:**
```
📊 Used CodePulse index:
   - Found in 2 files
   - Read 85 lines
   - Saved ~14,550 tokens (97% reduction!)
```

## Skill Maintenance

### Updating the Skill

Edit `.claude/skills/codepulse-index/SKILL.md`:

```bash
# Edit skill
code .claude/skills/codepulse-index/SKILL.md

# Restart Claude Code to reload
```

### Adding Examples

Add new examples to:
- `examples/good.md` - Best practices
- `examples/bad.md` - Anti-patterns

### Disabling the Skill

To temporarily disable:
```bash
# Rename to .SKILL.md.disabled
mv .claude/skills/codepulse-index/SKILL.md \
   .claude/skills/codepulse-index/SKILL.md.disabled
```

## Skill Effectiveness

### Success Indicators

The skill is working when:
- ✅ AI queries index before reading files
- ✅ Token usage is 90-97% lower
- ✅ Responses are faster and more accurate
- ✅ AI reports token savings

### Failure Indicators

The skill needs improvement if:
- ❌ AI uses Grep/Read without querying index
- ❌ Token usage remains high
- ❌ AI ignores index suggestions
- ❌ No savings reports

## Best Practices

### 1. Clear Query Language

**Good:**
- "sendPDF function in client page"
- "React components for tickets"
- "database connection logic"

**Bad:**
- "send.*PDF.*"  (regex, not natural language)
- "stuff in page.tsx"  (vague)
- "find code"  (too broad)

### 2. Verify Before Reading

Always check index results before reading files:
```
1. Query index → Get locations
2. Verify relevance → Check names/paths
3. Read targeted → Only relevant lines
4. Report savings → Show efficiency
```

### 3. Combine with Read Tool

Use index to find, Read to retrieve:
```javascript
// 1. Find with index
const context = await codepulse.getAIContext("sendPDF");

// 2. Read only specific lines
for (const symbol of context.primary) {
  const { file, location } = symbol;
  await Read(file, {
    offset: location.startLine - 5,
    limit: location.endLine - location.startLine + 10
  });
}
```

### 4. Monitor Index Health

Periodically check index stats:
```
User: "Show index stats"
AI: Calls codepulse.showIndexStats()
Result: 1,234 symbols in 89 files (healthy)
```

## Troubleshooting

### AI Not Using Index

**Symptoms:**
- AI uses Grep/Read directly
- High token usage
- No savings reports

**Solutions:**
1. Check skill file exists: `.claude/skills/codepulse-index/SKILL.md`
2. Verify YAML frontmatter is valid
3. Restart Claude Code
4. Manually remind: "Please use the CodePulse index"

### Index Queries Failing

**Symptoms:**
- "Index not found" errors
- Empty results for valid queries

**Solutions:**
1. Rebuild index: "CodePulse: Rebuild Symbol Index"
2. Check cache exists: `.codepulse/index.cache.json`
3. Verify extension is active
4. Check index stats for coverage

### Poor Search Results

**Symptoms:**
- Index returns irrelevant symbols
- Missing expected functions

**Solutions:**
1. Use more specific queries
2. Add context: "sendPDF function in client page" vs "sendPDF"
3. Check if file is indexed (might be in node_modules, excluded)
4. Rebuild index if recently added

## Example Workflow

Complete example of efficient code navigation:

```
User: "I need to fix the ticket PDF sending feature"

AI:
1. Query index:
   codepulse.getAIContext("ticket PDF sending")

2. Receive locations:
   - handleSendPDFWhatsApp: app/tickets/[id]/page.tsx:952-1006
   - handleSendPDFEmail: app/tickets/[id]/page.tsx:1010-1054
   - TicketQuickActions: components/tickets/TicketQuickActions.tsx:109-146

3. Read targeted code:
   Read app/tickets/[id]/page.tsx (lines 945-1060)
   Read components/tickets/TicketQuickActions.tsx (lines 105-150)

4. Report:
   📊 Used CodePulse index:
      - Found 3 related symbols
      - Read 170 lines from 2 files
      - Saved ~28,800 tokens (99% reduction)

5. Provide solution based on targeted reading
```

## Metrics

### Token Usage Comparison

| Scenario | Without Skill | With Skill | Savings |
|----------|---------------|------------|---------|
| Find 1 function | 15,000 | 400 | 97.3% |
| Understand integration | 30,000 | 600 | 98% |
| Find 5 components | 25,000 | 800 | 96.8% |
| Trace dependencies | 20,000 | 500 | 97.5% |
| **Average** | **22,500** | **575** | **97.4%** |

### Time Savings

- **Index query**: 1-5ms
- **File scan**: 5-30 seconds
- **Speed improvement**: 1000-6000x faster

## Related Documentation

- [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) - MCP server setup
- [INDEX_SYSTEM.md](./INDEX_SYSTEM.md) - How indexing works
- [examples/good.md](../.claude/skills/codepulse-index/examples/good.md) - Best practices
- [examples/bad.md](../.claude/skills/codepulse-index/examples/bad.md) - Anti-patterns

## Support

For issues or questions:
- GitHub Issues: https://github.com/DiabloWHB/codepulse/issues
- Discussions: https://github.com/DiabloWHB/codepulse/discussions
