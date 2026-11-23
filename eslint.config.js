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

/** Globals navigateur interdits dans le cœur (domain, application). */
const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'location',
  'crypto',
].map((name) => ({ name, message: 'Le cœur ne dépend pas du navigateur (ADR 0001).' }));

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'playwright-report',
      'test-results',
      'node_modules',
      '.claude/worktrees',
    ],
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
    files: ['src/domain/**/*.{ts,tsx}', 'src/application/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', PURE_CORE_RESTRICTIONS],
      // Aucun accès au navigateur : le cœur reçoit tout par ses ports.
      'no-restricted-globals': ['error', ...BROWSER_GLOBALS],
      // Le temps et l'aléa passent par les ports Clock et RandomSource.
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Utilise le port Clock.' },
        { object: 'Math', property: 'random', message: 'Utilise le port RandomSource.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Utilise le port Clock (new Date() sans argument interdit dans le cœur).',
        },
        {
          selector: 'ImportExpression',
          message: 'Import dynamique interdit dans le domain et l’application.',
        },
      ],
    },
  },
  {
    // Pas de JSX dans le cœur.
    files: ['src/domain/**/*.tsx', 'src/application/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Program', message: 'Aucun fichier .tsx dans le domain ou l’application.' },
      ],
    },
  },
  {
    // Les ports ne contiennent que des types : rien d’exécutable (exclus de la couverture).
    files: ['src/application/ports/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: ':matches(FunctionDeclaration, ClassDeclaration, VariableDeclaration)',
          message: 'Un port ne déclare que des types et interfaces.',
        },
      ],
    },
  },
  {
    // La date du jour vient du port Clock, via le cas d'usage `today()`.
    files: ['src/presentation/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Utilise le cas d’usage today().' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Utilise le cas d’usage today() (horloge injectée).',
        },
      ],
    },
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
