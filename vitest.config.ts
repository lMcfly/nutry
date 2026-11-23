import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
            environment: 'node',
            include: [
              'src/{domain,application,infrastructure}/**/*.test.ts',
              'scripts/**/*.test.ts',
            ],
          },
        },
        {
          extends: true,
          test: {
            name: 'dom',
            environment: 'jsdom',
            include: ['src/presentation/**/*.test.{ts,tsx}', 'src/main.test.tsx'],
            setupFiles: ['./src/presentation/test-setup.ts'],
          },
        },
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
        // Seuls les ports (interfaces pures, garanties par ESLint) et les tests sont exclus.
        exclude: ['src/application/ports/**', '**/*.test.ts'],
        thresholds: {
          'src/domain/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
          'src/application/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        },
      },
    },
  }),
);
