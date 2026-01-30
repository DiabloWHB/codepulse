# Good Examples - Using CodePulse Index Correctly

These examples show the **correct, token-efficient way** to find code using the CodePulse index.

---

## Example 1: Finding a Function

**User Request:** "Where is the sendPDF function?"

**✅ Correct Approach:**

```javascript
// Step 1: Query the index
const result = // Use MCP tool: codepulse_search or codepulse_get_context
// Query:
  'sendPDF function'
);

// Step 2: Review the response
{
  primary: [
    {
      name: "handleSendPDFWhatsApp",
      file: "app/tickets/[id]/page.tsx",
      location: { startLine: 952, endLine: 1006 }
    },
    {
      name: "handleSendPDFEmail",
      file: "app/tickets/[id]/page.tsx",
      location: { startLine: 1010, endLine: 1054 }
    }
  ],
  related: [
    {
      name: "TicketQuickActions",
      file: "components/tickets/TicketQuickActions.tsx",
      location: { startLine: 109, endLine: 146 }
    }
  ],
  files: ["app/tickets/[id]/page.tsx", "components/tickets/TicketQuickActions.tsx"],
  confidence: 0.95
}

// Step 3: Read ONLY the specific locations
await Read("app/tickets/[id]/page.tsx", { offset: 945, limit: 65 });  // Lines 945-1010
await Read("app/tickets/[id]/page.tsx", { offset: 1005, limit: 55 }); // Lines 1005-1060
await Read("components/tickets/TicketQuickActions.tsx", { offset: 105, limit: 45 }); // Lines 105-150
```

**Result:**
- Files read: 2
- Lines read: ~165
- **Tokens used: ~450**
- Time: Fast

---

## Example 2: Understanding an Integration

**User Request:** "How does the email integration work?"

**✅ Correct Approach:**

```javascript
// Step 1: Query index
const emailContext = // Use MCP tool: codepulse_search or codepulse_get_context
// Query:
  'email integration send'
);

// Step 2: Index returns:
{
  primary: [
    { name: "sendPDFEmail", file: "api/tickets/[id]/send-pdf-email/route.ts" },
    { name: "postmarkClient", file: "lib/email/email-builder.ts" },
    { name: "buildEmailTemplate", file: "lib/email/email-template.ts" }
  ],
  codeSnippets: [
    {
      file: "api/tickets/[id]/send-pdf-email/route.ts",
      startLine: 332,
      endLine: 350,
      code: "... actual code snippet ...",
      relevance: "Main email sending logic"
    }
  ]
}

// Step 3: Review code snippets first (already included!)
// Then read full functions if needed
```

**Result:**
- Code snippets provided directly
- No need to read full files initially
- **Tokens used: ~600**
- Complete understanding achieved

---

## Example 3: Finding Where a Function is Called

**User Request:** "What calls the formatReport function?"

**✅ Correct Approach:**

```javascript
// Step 1: Query index for usages
const usages = // Use MCP tool: codepulse_search or codepulse_get_context
// Query:
  'formatReport function callers'
);

// Step 2: Index returns callers with locations
{
  primary: [
    {
      name: "formatReport",
      file: "utils/reportFormatter.ts",
      location: { startLine: 23, endLine: 45 }
    }
  ],
  related: [
    // Functions that call formatReport
    { name: "handleSendPDFWhatsApp", file: "app/tickets/[id]/page.tsx", line: 978 },
    { name: "generatePDFReport", file: "lib/pdf/generator.ts", line: 156 }
  ]
}

// Step 3: Read the relevant call sites
```

**Result:**
- Direct answer with exact call locations
- **Tokens used: ~300**
- No manual code tracing needed

---

## Example 4: Exploring a Component

**User Request:** "Show me the Ticket Quick Actions component"

**✅ Correct Approach:**

```javascript
// Step 1: Query for component
const component = // Use MCP tool: codepulse_search or codepulse_get_context
// Query:
  'TicketQuickActions component'
);

// Step 2: Get complete component info
{
  primary: [{
    name: "TicketQuickActions",
    kind: "component",
    file: "components/tickets/TicketQuickActions.tsx",
    location: { startLine: 45, endLine: 420 },
    signature: "const TicketQuickActions: React.FC<Props>",
    documentation: "/** Quick action buttons for ticket operations */"
  }],
  dependencies: [
    { name: "Button", source: "@/components/ui/button" },
    { name: "DropdownMenu", source: "@/components/ui/dropdown-menu" }
  ]
}

// Step 3: Read the component with context
```

**Result:**
- Got signature, docs, dependencies
- **Tokens used: ~500**
- Complete component understanding

---

## Example 5: Finding API Routes

**User Request:** "Find the API route for sending WhatsApp messages"

**✅ Correct Approach:**

```javascript
// Natural language query
const routes = // Use MCP tool: codepulse_search or codepulse_get_context
// Query:
  'WhatsApp send API route'
);

// Returns exact route file
{
  primary: [{
    name: "POST",
    file: "app/api/tickets/[id]/send-pdf-whatsapp/route.ts",
    location: { startLine: 142, endLine: 280 }
  }]
}
```

**Result:**
- Found specific API route instantly
- **Tokens used: ~200**
- No directory traversal needed

---

## Key Patterns for Success

### Pattern 1: Index First, Read Second
```javascript
// ✅ Always do this:
1. Query index → Get locations
2. Read specific files/lines
3. Process targeted code

// ❌ Never do this:
1. Grep entire codebase
2. Read many files
3. Filter manually
```

### Pattern 2: Natural Language Queries
```javascript
// ✅ Use natural language:
- "PDF send function"
- "email integration"
- "React ticket components"
- "database connection code"

// ❌ Don't use patterns:
- "send.*PDF.*"
- "email|mail"
- ".*Component"
```

### Pattern 3: Check Index First
```javascript
// Before ANY file operation:
if (needToFindCode) {
  // Step 1: Query index
  const context = await vscode.commands.executeCommand('codepulse.getAIContext', query);

  // Step 2: Use returned locations
  for (const symbol of context.primary) {
    await Read(symbol.file, {
      offset: symbol.location.startLine - 5,
      limit: symbol.location.endLine - symbol.location.startLine + 10
    });
  }
}
```

### Pattern 4: Report Savings
```javascript
// After using index, report to user:
const linesRead = 85;
const filesRead = 2;
const tokensUsed = 450;
const tokensSaved = 10000 - 450; // Estimated savings vs blind search

console.log(`📊 Used CodePulse index: Found in ${filesRead} files, read ${linesRead} lines (saved ~${tokensSaved} tokens)`);
```

---

## Success Metrics

When using the index correctly, you should see:
- ✅ < 5 file Read operations per query (vs 20-50 without index)
- ✅ < 200 lines total read (vs 1000s)
- ✅ < 1000 tokens per code search (vs 10,000+)
- ✅ Faster, more accurate responses
- ✅ User satisfaction with precise answers

**Remember:** Every index query is a massive token and time saving! 🚀
