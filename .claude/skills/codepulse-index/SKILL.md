---
name: codepulse-index
description: MUST BE USED - Mandatory CodePulse MCP tools for code navigation (saves 90%+ tokens, prevents breaking changes)
user-invocable: false
proactive: true
priority: critical
---

# CodePulse Symbol Index - MANDATORY Usage Policy

## 🚨 CRITICAL RULE
**ALWAYS use CodePulse MCP tools BEFORE Read/Grep/Glob for ANY code search!**

This workspace has **CodePulse MCP server** with impact analysis and symbol indexing.

## 📋 MANDATORY: Use These Tools First

### For ANY code search, use ONE of these (in priority order):

1. **`codepulse_search`** - Search for functions/classes/symbols
   - Use INSTEAD of Grep for finding code
   - Returns precise locations instantly

2. **`codepulse_get_impact`** - Check function impact BEFORE modifying
   - Shows callers, risk level, affected files
   - CRITICAL: Use before ANY code modification!

3. **`codepulse_get_symbols_in_file`** - Get file overview
   - Use INSTEAD of Read for understanding file structure

4. **`codepulse_get_file_risks`** - See risky functions in file
   - Use when working with critical files

### Why This Matters
- **Without MCP:** Grep 50 files + Read all → **10,000+ tokens**
- **With MCP:** codepulse_search + Read targeted lines → **400 tokens**
- **Savings:** 96% reduction = **massive cost & speed improvement**
- **Impact data:** Know callers/risks BEFORE making changes!

## ✅ Correct Workflow

```
User asks about code
    ↓
1. Use: codepulse_search with natural language query
    ↓
2. Get: Precise symbol locations instantly
    {
      name: "sendPDF",
      file: "page.tsx:978-1006",
      score: 100%
    }
    ↓
3. BEFORE modifying: codepulse_get_impact('sendPDF')
    ↓
4. See: "🔴 206 callers | Critical Risk - affects 45 files!"
    ↓
5. Read: Only specific lines if needed
```

## 📚 Examples

### ✅ CORRECT: Using MCP Tools
```
User: "Where is the sendPDF function?"

Step 1: codepulse_search
→ codepulse_search("sendPDF function")

Step 2: Get instant results
← "sendPDF (function) - File: page.tsx:978, Score: 100%"

Step 3: Check impact BEFORE modifying
→ codepulse_get_impact("sendPDF")
← "🔴 42 callers | High Risk - 12 files affected"

Step 4: Read specific lines
→ Read page.tsx:970-1010 (40 lines)

📊 Result: ~400 tokens + impact awareness!
```

### ❌ WRONG: Using Grep/Read
```
User: "Where is the sendPDF function?"

Step 1: Grep (WRONG!)
→ Grep "sendPDF"

Step 2: Many matches
← 50 files

Step 3: Read everything
→ Read 50 files

📊 Result: ~15,000 tokens
❌ Wasted: 14,600 tokens
❌ No impact data - might break code!
```

See `examples/good.md` for more correct approaches.
See `examples/bad.md` for wasteful patterns to avoid.

## 🎓 When to Use MCP Tools

**ALWAYS use MCP for** (saves massive tokens + gives impact data):
- ✅ Finding ANY function, class, component
- ✅ Understanding code structure
- ✅ Locating features ("send email", "PDF generation")
- ✅ **BEFORE modifying code** (check impact!)
- ✅ Understanding file risks
- ✅ Any code search/navigation task

**Only skip MCP for**:
- ❌ Text pattern searches (not code symbols)
- ❌ TODO/FIXME comments
- ❌ Markdown/docs
- ❌ User explicitly asks "grep all files"

## 🔍 MCP Tools Reference

### codepulse_search
```
Use for: Finding functions/classes/symbols
Query: Natural language - "send PDF function", "email handler", etc.
Returns: Precise locations with scores
```

### codepulse_get_impact (CRITICAL!)
```
Use BEFORE: Modifying any function
Query: Function name or ID
Returns: Callers count, risk level, affected files
Example: "🔴 206 callers | Critical - 45 files"
```

### codepulse_get_symbols_in_file
```
Use for: Understanding file structure
Query: File path
Returns: All functions/classes/exports
```

### codepulse_get_file_risks
```
Use for: Finding risky functions in file
Query: File path + min risk level
Returns: High-risk functions sorted by impact
```

## 📊 Report Your Savings

After using the index, mention:
```
"📊 Used CodePulse index: Found in 2 files, read 85 lines (saved ~9,500 tokens)"
```

## 🚨 Exception Handling

If index query returns no results:
1. Check index is built: `vscode.commands.executeCommand('codepulse.showIndexStats')`
2. If stats show 0 symbols, index needs building
3. Fall back to traditional search only if index unavailable

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
