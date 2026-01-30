# Bad Examples - Wasteful Patterns to Avoid

These examples show **inefficient, token-wasting approaches** that bypass the CodePulse index.

⚠️ **Don't do these!** They waste 90-97% of tokens compared to using the index.

---

## ❌ Example 1: Blind Grep Search

**User Request:** "Find the sendPDF function"

**Wrong Approach:**

```javascript
// Step 1: Grep the entire codebase
await Grep("sendPDF", { glob: "**/*.{ts,tsx}" });

// Result: 50+ files match
// Must read all to find the right one

// Step 2: Read many files
for (const file of matchedFiles) {
  await Read(file); // Reading ENTIRE files
}

// Step 3: Manually find the actual function
// Scan through thousands of lines of code
```

**Problems:**
- Searched entire workspace (wasteful)
- Read 50+ complete files (massive token waste)
- Still need to manually identify correct function
- **Tokens used: ~15,000**
- **Should have been: ~400** (with index)
- **Waste: 97%!** ❌❌❌

---

## ❌ Example 2: Task Agent Overuse

**User Request:** "How does email sending work?"

**Wrong Approach:**

```javascript
// Launch explore agent without checking index first
await Task({
  subagent_type: "Explore",
  prompt: "Find all email-related code in the project"
});

// Agent scans:
// - 200+ files
// - Reads lib/, api/, components/ directories entirely
// - Returns massive context dump
```

**Problems:**
- Wasted an entire agent on something index could answer instantly
- Agent read hundreds of files
- **Tokens used: ~30,000** (agent exploration)
- **Should have been: ~600** (index query)
- **Waste: 98%!** ❌❌❌

---

## ❌ Example 3: Reading Files Without Location

**User Request:** "What's in the ticket page?"

**Wrong Approach:**

```javascript
// Guess the file path
await Read("app/tickets/page.tsx");
// Wrong file!

await Read("app/tickets/[id]/page.tsx");
// Right file, but reads ENTIRE 2000+ line file
```

**Problems:**
- Guessed file paths (error-prone)
- Read entire massive file (2000+ lines)
- **Tokens used: ~8,000**
- **Should have used index to:**
  - Confirm exact path
  - Get specific component locations
  - Read only relevant sections
- **Waste: 95%** ❌❌❌

---

## ❌ Example 4: Multiple Redundant Searches

**User Request:** "Find formatReport function and its callers"

**Wrong Approach:**

```javascript
// Search #1: Find function
await Grep("formatReport", { output_mode: "content" });
// Returns 30 matches

// Search #2: Find imports
await Grep("import.*formatReport", { output_mode: "content" });
// Returns 15 matches

// Search #3: Find calls
await Grep("formatReport\\(", { output_mode: "content" });
// Returns 20 matches

// Then read all matching files
// Total: 65+ file reads
```

**Problems:**
- Multiple redundant searches
- Overlapping results
- Read same files multiple times
- **Tokens used: ~20,000**
- **Index would return everything in ONE query: ~500 tokens**
- **Waste: 97.5%!** ❌❌❌

---

## ❌ Example 5: Directory Traversal

**User Request:** "Show me all React components for tickets"

**Wrong Approach:**

```javascript
// Step 1: Find component directory
await Glob("**/tickets/**/*.tsx");
// Returns 40 files

// Step 2: Read each file to check if it's a component
for (const file of files) {
  await Read(file); // Reading entire files to check
}

// Step 3: Filter manually
// Scan through all files looking for "export" statements
```

**Problems:**
- Read 40+ complete files
- Manual filtering needed
- **Tokens used: ~25,000**
- **Index query "ticket React components": ~800 tokens**
- **Waste: 96.8%!** ❌❌❌

---

## ❌ Example 6: Not Using Code Snippets

**User Request:** "What does the sendPDFEmail function do?"

**Wrong Approach:**

```javascript
// Even if found the right file, reads it all
await Read("api/tickets/[id]/send-pdf-email/route.ts");
// File is 400 lines, only need 30 lines
```

**Should Have Done:**

```javascript
// Index provides code snippets automatically!
const context = await vscode.commands.executeCommand(
  'codepulse.getAIContext',
  'sendPDFEmail function'
);

// Returns code snippets in response:
{
  codeSnippets: [{
    file: "api/tickets/[id]/send-pdf-email/route.ts",
    startLine: 332,
    endLine: 350,
    code: "... relevant code only ...",
    relevance: "Main email sending logic"
  }]
}

// No need to read the file at all!
```

**Waste: Read 400 lines instead of getting 20-line snippet** ❌

---

## ❌ Example 7: Ignoring Index Stats

**User Request:** "How many functions are in this project?"

**Wrong Approach:**

```javascript
// Manually count
await Glob("**/*.{ts,tsx,js,jsx}");
// Read all files and count functions
// Huge waste of time and tokens
```

**Should Have Done:**

```javascript
// Index has stats!
await vscode.commands.executeCommand('codepulse.showIndexStats');

// Returns instantly:
{
  totalSymbols: 1234,
  totalFiles: 89,
  byKind: {
    function: 567,
    class: 123,
    component: 89,
    ...
  }
}

// Tokens used: ~50 vs thousands
```

---

## Common Anti-Patterns

### Anti-Pattern 1: "Explore First" Mentality
```javascript
// ❌ Wrong mindset:
"Let me explore the codebase to understand it"
→ Launches agent, scans everything, wastes tokens

// ✅ Correct mindset:
"Let me query the index for what I need"
→ Gets precise answer, minimal tokens
```

### Anti-Pattern 2: Pattern-Based Instead of Symbol-Based
```javascript
// ❌ Wrong:
Grep("handle.*PDF.*send")  // Pattern matching

// ✅ Correct:
codepulse.getAIContext("PDF send handler")  // Symbolic search
```

### Anti-Pattern 3: Reading Entire Files
```javascript
// ❌ Wrong:
Read("huge-file.tsx")  // 2000 lines

// ✅ Correct:
// Query index first, get line numbers
Read("huge-file.tsx", { offset: 945, limit: 65 })  // 65 lines
```

### Anti-Pattern 4: Multiple Tools When One Would Do
```javascript
// ❌ Wrong:
Grep → Read → Grep again → Read again

// ✅ Correct:
codepulse.getAIContext → Read (once)
```

### Anti-Pattern 5: Ignoring the Guidance
```javascript
// ❌ Wrong:
"I know where the code is, I'll just read it"
→ Reads wrong file or entire file

// ✅ Correct:
"Let me confirm with the index"
→ Gets exact location, reads minimal code
```

---

## Token Waste Comparison Table

| Task | Without Index | With Index | Waste |
|------|---------------|------------|-------|
| Find function | 15,000 tokens | 400 tokens | 97.3% |
| Understand integration | 12,000 tokens | 600 tokens | 95% |
| Find callers | 20,000 tokens | 300 tokens | 98.5% |
| List components | 25,000 tokens | 800 tokens | 96.8% |
| Get function stats | 5,000 tokens | 50 tokens | 99% |

**Average waste: 97.3%** when not using the index! ❌

---

## How to Avoid These Mistakes

### Before ANY code search:
1. ✅ Ask yourself: "Should I query the index first?"
2. ✅ The answer is almost always: **YES**
3. ✅ Call `codepulse.getAIContext` with your query
4. ✅ Use the returned locations/snippets
5. ✅ Only read specific targeted code

### Remember:
- 🚫 Never Grep without checking index first
- 🚫 Never Read entire files when you need specific functions
- 🚫 Never launch Explore agents for symbol searches
- 🚫 Never guess file paths
- 🚫 Never ignore index code snippets

### Always:
- ✅ Index first, read second
- ✅ Use natural language queries
- ✅ Read only returned locations
- ✅ Report token savings
- ✅ Be amazed at how much faster and cheaper it is! 🚀

---

**Bottom line:** Using these wasteful patterns costs 10-100x more tokens and takes 5-10x longer. **Always use the index!**
