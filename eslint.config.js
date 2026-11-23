// @ts-check
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Frontières entre couches (docs/adr/0001-clean-architecture-frontieres.md) :
 *   domain         → domain
 *   application    → application, domain
 *   infrastructure → infrastructure, application, domain
 *   presentation   → presentation, application, domain (jamais infrastructure)
 *   main.tsx       → tout (composition root)
 */
const LAYER_RULES = {
  default: 'disallow',
  policies: [
    { from: { element: { type: 'domain' } }, allow: { to: { element: { types: ['domain'] } } } },
    {
      from: { element: { type: 'application' } },
      allow: { to: { element: { types: ['application', 'domain'] } } },
    },
    {
      from: { element: { type: 'infrastructure' } },
      allow: { to: { element: { types: ['infrastructure', 'application', 'domain'] } } },
    },
    {
      from: { element: { type: 'presentation' } },
      allow: { to: { element: { types: ['presentation', 'application', 'domain'] } } },
    },
    {
      from: { file: { categories: 'composition-root' } },
      allow: {
        to: { element: { types: ['domain', 'application', 'infrastructure', 'presentation'] } },
      },
    },
  ],
};

/** Le cœur (domain, application) reste pur : aucune bibliothèque externe ni API Node. */
const PURE_CORE_RESTRICTIONS = {
  patterns: [
    {
      // Les alias internes sont contrôlés par boundaries/dependencies ; ici, tout le reste.
      regex: '^(?!(?:@domain|@application|@infrastructure|@presentation)/|\\.{1,2}/).+',
      message:
        'Le domain et l’application ne dépendent d’aucune bibliothèque externe (voir ADR 0001).',
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.app.json', alwaysTryTypes: true },
      },
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain' },
        { type: 'application', pattern: 'src/application' },
        { type: 'infrastructure', pattern: 'src/infrastructure' },
        { type: 'presentation', pattern: 'src/presentation' },
      ],
      'boundaries/files': [{ category: 'composition-root', pattern: 'src/main.tsx' }],
    },
    rules: {
      'boundaries/dependencies': ['error', LAYER_RULES],
      'boundaries/no-unknown-files': 'error',
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-imports': ['error', PURE_CORE_RESTRICTIONS] },
  },
  {
    files: ['src/presentation/**/*.tsx', 'src/main.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['scripts/**/*.ts', 'e2e/**/*.ts', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      // Les assertions Vitest acceptent librement des valeurs `any` issues de JSON.
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
