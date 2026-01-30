import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/extension.ts', 'src/ui/**/*.ts']
    },
    setupFiles: ['./test/setup.ts']
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, './test/__mocks__/vscode.ts')
    }
  }
});
