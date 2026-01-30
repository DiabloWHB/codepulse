#!/usr/bin/env node

/**
 * CodePulse MCP Server Entry Point
 *
 * This server exposes the CodePulse symbol index via Model Context Protocol.
 * It runs as a stdio-based MCP server and reads from the cached index file.
 *
 * Environment Variables:
 * - INDEX_CACHE_PATH: Path to the index cache file (.codepulse/index.cache.json)
 * - WORKSPACE_PATH: Workspace root path (optional, for reference)
 */

import { CodePulseServer } from './server.js';

async function main() {
  try {
    const server = new CodePulseServer();
    await server.run();
  } catch (error) {
    console.error('[CodePulse] Fatal error:', error);
    process.exit(1);
  }
}

main();
