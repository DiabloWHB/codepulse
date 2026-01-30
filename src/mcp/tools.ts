/**
 * MCP Tool Definitions for CodePulse Symbol Index.
 */

export const CODEPULSE_TOOLS = [
  {
    name: 'codepulse_search',
    description:
      'Search code symbols (functions, classes, components, etc.) using natural language. ' +
      'This is MUCH faster and more accurate than using Grep or Read tools. ' +
      'Returns precise locations so you can read only relevant code. ' +
      'Saves 90-97% tokens compared to blind searching.',
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
      'Get comprehensive AI-optimized context for a code query. ' +
      'Returns primary symbols, related symbols, code snippets, and dependencies. ' +
      'This is the RECOMMENDED tool for understanding code structure. ' +
      'Saves massive amounts of tokens by providing only relevant context.',
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
      'Get all symbols (functions, classes, etc.) in a specific file. ' +
      'Faster than reading the entire file when you just need an overview.',
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
  }
];
