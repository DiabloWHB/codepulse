---
name: codepulse-index
description: Use CodePulse symbol index for efficient code navigation (saves 90%+ tokens)
user-invocable: false
allowed-tools: Read, Grep, Glob, Bash(npm *)
---

# CodePulse Symbol Index - Token-Saving Policy

## 🎯 Purpose
This workspace uses **CodePulse Symbol Index** - an intelligent code navigation system that reduces token usage by **90-97%**.

**Critical:** Before searching for code, query the index first to get precise locations.

## 📋 Policy (MANDATORY - You Must Follow)

### Before using Read, Grep, or Glob:
**ALWAYS query the index first** using the **MCP tool**:
- Use: `codepulse_search` for finding specific symbols (classes, functions, etc.)
- Use: `codepulse_get_context` for understanding integrations and relationships

**DO NOT use Grep or file scanning as a first step. Always start with MCP tools.**

### Why This Matters
- **Without index:** Grep 50 files + Read all → **10,000+ tokens**
- **With index:** Query MCP + Read targeted lines → **400 tokens**
- **Savings:** 96% reduction = **massive cost & speed improvement**

## ✅ Correct Workflow

```
User Query
    ↓
1. Call MCP tool: codepulse_search
   Query: "your search query"
    ↓
2. Receive: Precise locations from MCP
   - SymbolIndexManager (class)
   - File: src/index/SymbolIndexManager.ts
   - Location: Lines 45-320
    ↓
3. Read: Only the specific files/lines returned
    ↓
4. Process: Use the targeted code
```

## 📚 Examples

### ✅ Good Example: Finding a Function
```
User: "Where is the sendPDF function?"

Step 1: Query index
→ codepulse_search MCP tool with query: "sendPDF function"

Step 2: Receive precise location
← Returns: page.tsx:978-1006, TicketQuickActions.tsx:109-146

Step 3: Read only those lines
→ Read page.tsx lines 970-1010 (40 lines)
→ Read TicketQuickActions.tsx lines 105-150 (45 lines)

📊 Result: ~400 tokens
```

### ❌ Bad Example: Blind Search
```
User: "Where is the sendPDF function?"

Step 1: Grep for pattern
→ Grep "sendPDF"

Step 2: Get many matches
← 50 files match

Step 3: Read all files
→ Read 50 files (thousands of lines)

📊 Result: ~15,000 tokens
❌ Wasted: 14,600 tokens (97% waste!)
```

See `examples/good.md` for more correct approaches.
See `examples/bad.md` for wasteful patterns to avoid.

## 🎓 When to Use Index

**Use index for** (these save massive tokens):
- ✅ Finding functions, classes, components
- ✅ Understanding code structure
- ✅ Locating specific features ("send email", "PDF generation")
- ✅ Tracing dependencies
- ✅ Any symbol-based search

**Skip index for** (these are pattern-based):
- ❌ Searching for text patterns (not symbols)
- ❌ Finding TODO/FIXME comments
- ❌ Searching in markdown/docs
- ❌ User explicitly asks to "grep all files"

## 🔍 How to Query the Index

Use **natural language** - the index is smart:

```javascript
// Good queries:
- "send PDF function"
- "client email handler"
- "React components for tickets"
- "database integration code"
- "API route for billing"

// Avoid grep-style patterns:
- NOT: "send.*PDF.*email"
- NOT: "handle[A-Z]+"
```

## 📊 Report Your Savings

After using the index, mention:
```
"📊 Used CodePulse index: Found in 2 files, read 85 lines (saved ~9,500 tokens)"
```

## 🚨 Exception Handling

If index query returns no results:
1. Check index stats: Use `codepulse_stats` MCP tool
2. If stats show 0 symbols, index needs building
3. Fall back to traditional search (Grep/Read) only if index is unavailable or empty

## 💡 Pro Tips

1. **Start specific, then broaden:** Try "sendPDF email function" before "email"
2. **Use index for every file operation:** Even if you think you know the file
3. **Chain queries:** If first result unclear, query related symbols
4. **Check the summary:** Index response includes summary with stats

## 🎯 Success Indicators

You're using the index correctly when:
- ✅ You call `codepulse.getAIContext` before most Read operations
- ✅ You read < 100 lines for typical queries (vs 1000s without index)
- ✅ Your responses include "📊 Used CodePulse index" with savings stats
- ✅ You complete tasks faster with fewer tool calls

## 📖 More Information

- Full documentation: `docs/INDEX_SYSTEM.md`
- MCP integration: `docs/MCP_INTEGRATION.md`
- Skill guide: `docs/SKILL_GUIDE.md`

---

**Remember:** Every index query saves thousands of tokens. Use it liberally! 🚀
