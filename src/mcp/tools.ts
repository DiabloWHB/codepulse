/**
 * MCP Tool Definitions for CodePulse Symbol Index.
 */

export const CODEPULSE_TOOLS = [
  {
    name: 'codepulse_search',
    description:
      '⚡ ALWAYS USE THIS FIRST before Grep/Read! Search code symbols (functions, classes, components, etc.) using natural language. ' +
      'This is 10-100x faster and more accurate than Grep. Returns precise locations instantly. ' +
      'Saves 90-97% tokens. CRITICAL: Use this instead of grep/find/read for ANY code search!',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language search query. Examples: ' +
            '"sendPDF function", "client email handler", "React ticket components", ' +
            '"database connection code", "authentication middleware"'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
          default: 10
        },
        kinds: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['function', 'class', 'interface', 'method', 'property', 'variable', 'constant', 'type', 'component', 'hook']
          },
          description: 'Filter by symbol kind (optional)'
        }
      },
      required: ['query']
    }
  },

  {
    name: 'codepulse_get_context',
    description:
      '🎯 PRIMARY TOOL - Use this FIRST for any code understanding task! ' +
      'Get comprehensive AI-optimized context instantly with symbol index. ' +
      'Returns symbols, snippets, dependencies. Replaces: Read+Grep+multiple file operations. ' +
      'MANDATORY: Use this instead of reading multiple files manually!',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'What code are you trying to understand? Examples: ' +
            '"email sending integration", "ticket PDF generation", ' +
            '"client page authentication", "report formatting logic"'
        },
        includeSnippets: {
          type: 'boolean',
          description: 'Include actual code snippets in response (default: true)',
          default: true
        }
      },
      required: ['query']
    }
  },

  {
    name: 'codepulse_get_symbols_in_file',
    description:
      '📋 ALWAYS use before reading files! Get instant overview of file contents. ' +
      'Returns all functions/classes/exports without reading entire file. ' +
      'Use this instead of Read when you need to understand file structure!',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'File path (relative to workspace root or absolute)'
        }
      },
      required: ['filePath']
    }
  },

  {
    name: 'codepulse_stats',
    description:
      'Show symbol index statistics: total symbols, files, coverage by kind, etc. ' +
      'Useful for understanding codebase size and composition.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  {
    name: 'codepulse_get_impact',
    description:
      '🔴 CRITICAL: Get impact analysis for a function (callers, risk level, affected files). ' +
      'USE THIS BEFORE modifying any function to understand dependencies and avoid breaking changes! ' +
      'Shows exactly what will be affected if you change this function.',
    inputSchema: {
      type: 'object',
      properties: {
        symbolId: {
          type: 'string',
          description:
            'Symbol ID (e.g., "file.ts:42:functionName") or function name to analyze. ' +
            'You can get symbol IDs from codepulse_search or codepulse_get_symbols_in_file.'
        }
      },
      required: ['symbolId']
    }
  },

  {
    name: 'codepulse_get_file_risks',
    description:
      'Get all high-risk functions in a file (functions with many callers). ' +
      'Useful for understanding which parts of a file are most critical.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'File path (relative to workspace root or absolute)'
        },
        minRisk: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Minimum risk level to show (default: medium)',
          default: 'medium'
        }
      },
      required: ['filePath']
    }
  }
];
