// @ts-check
import comments from '@eslint-community/eslint-plugin-eslint-comments';
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

/**
 * Confidentialité (PROMPT §2) : aucune API réseau nulle part dans src/, adaptateurs compris.
 * `indexedDB` n'est autorisé que dans src/infrastructure/db (Dexie).
 */
const NETWORK_MESSAGE = 'Nutry n’envoie aucune donnée : pas d’API réseau dans src/.';
const NETWORK_APIS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'];
const STORAGE_MESSAGE = 'IndexedDB passe par l’adaptateur src/infrastructure/db.';

/** @param {readonly string[]} names @param {string} message */
const restrictGlobals = (names, message) => names.map((name) => ({ name, message }));

const NETWORK_GLOBALS = restrictGlobals(NETWORK_APIS, NETWORK_MESSAGE);
const STORAGE_GLOBALS = restrictGlobals(['indexedDB'], STORAGE_MESSAGE);

/**
 * Les mêmes API atteintes par un objet global (`window.fetch`, `globalThis.fetch`…) et
 * `navigator.sendBeacon` (toute forme `x.sendBeacon`).
 * @param {readonly string[]} names @param {string} message
 */
const restrictGlobalProperties = (names, message) =>
  ['window', 'globalThis', 'self'].flatMap((object) =>
    names.map((property) => ({ object, property, message })),
  );
const NETWORK_PROPERTIES = [
  ...restrictGlobalProperties(NETWORK_APIS, NETWORK_MESSAGE),
  { property: 'sendBeacon', message: NETWORK_MESSAGE },
];
const STORAGE_PROPERTIES = restrictGlobalProperties(['indexedDB'], STORAGE_MESSAGE);

/** Globals navigateur et d'exécution interdits dans le cœur (domain, application). */
const BROWSER_GLOBALS = restrictGlobals(
  [
    'window',
    'globalThis',
    'self',
    'document',
    'navigator',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'location',
    'crypto',
    'performance',
    'setTimeout',
    'setInterval',
    ...NETWORK_APIS,
  ],
  'Le cœur ne dépend pas du navigateur (ADR 0001).',
);

/**
 * Présentation : liste blanche des paquets (React, routeur). Tout le reste (dexie, zod…)
 * passe par l'application et ses ports ; les alias @domain, @application, @presentation et
 * les chemins relatifs (dont les .css / .module.css) sont contrôlés par boundaries.
 */
const PRESENTATION_IMPORT_ALLOWLIST =
  '^(?!(?:react|react-dom|react-dom/client|react-router-dom)$|(?:@domain|@application|@presentation)/|\\.{1,2}/).+';
const PRESENTATION_TEST_IMPORT_ALLOWLIST =
  '^(?!(?:react|react-dom|react-dom/client|react-router-dom|vitest|@testing-library/jest-dom/vitest|@testing-library/react|@testing-library/user-event)$|(?:@domain|@application|@presentation)/|\\.{1,2}/).+';
const PRESENTATION_IMPORT_MESSAGE =
  'La présentation n’importe que React et react-router-dom : le reste passe par les cas d’usage.';
/** @param {string} regex */
const presentationImports = (regex) => ({
  patterns: [{ regex, message: PRESENTATION_IMPORT_MESSAGE }],
});
/** `import()` dynamique : mêmes règles (no-restricted-imports ne le voit pas). */
const PRESENTATION_DYNAMIC_IMPORTS = [
  {
    // esquery ne tolère pas de « / » dans une regex de sélecteur : on l'écrit \x2F.
    selector: `ImportExpression[source.type='Literal'][source.value=/${PRESENTATION_IMPORT_ALLOWLIST.replaceAll('/', '\\x2F')}/]`,
    message: PRESENTATION_IMPORT_MESSAGE,
  },
  {
    selector: "ImportExpression[source.type!='Literal']",
    message: 'Import dynamique avec un chemin calculé interdit dans la présentation.',
  },
];

/** Règles interdites de désactivation par commentaire (frontières, confidentialité). */
const LOCKED_RULES = ['boundaries/*', 'no-restricted-*', '@typescript-eslint/no-restricted-*'];

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
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...STORAGE_GLOBALS],
      'no-restricted-properties': ['error', ...NETWORK_PROPERTIES, ...STORAGE_PROPERTIES],
    },
  },
  {
    // Seul l'adaptateur de base de données accède à IndexedDB ; le réseau reste interdit.
    files: ['src/infrastructure/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
      'no-restricted-properties': ['error', ...NETWORK_PROPERTIES],
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
        ...NETWORK_PROPERTIES,
        ...STORAGE_PROPERTIES,
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
    ignores: [
      '**/*.test.{ts,tsx}',
      'src/presentation/test-setup.ts',
      'src/presentation/testing/**',
    ],
    rules: {
      'no-restricted-imports': ['error', presentationImports(PRESENTATION_IMPORT_ALLOWLIST)],
      'no-restricted-properties': [
        'error',
        ...NETWORK_PROPERTIES,
        ...STORAGE_PROPERTIES,
        { object: 'Date', property: 'now', message: 'Utilise le cas d’usage today().' },
      ],
      'no-restricted-syntax': [
        'error',
        ...PRESENTATION_DYNAMIC_IMPORTS,
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Utilise le cas d’usage today() (horloge injectée).',
        },
      ],
    },
  },
  {
    // Tests et outillage de test de la présentation : liste blanche + Vitest, Testing Library.
    files: [
      'src/presentation/**/*.test.{ts,tsx}',
      'src/presentation/test-setup.ts',
      'src/presentation/testing/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', presentationImports(PRESENTATION_TEST_IMPORT_ALLOWLIST)],
      'no-restricted-syntax': ['error', ...PRESENTATION_DYNAMIC_IMPORTS],
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
  {
    // Les verrous ci-dessus ne se désactivent pas par commentaire.
    plugins: { '@eslint-community/eslint-comments': comments },
    rules: {
      '@eslint-community/eslint-comments/no-restricted-disable': ['error', ...LOCKED_RULES],
      // `/* eslint règle: off */`, `/* global */`, `/* eslint-env */` : interdits.
      '@eslint-community/eslint-comments/no-use': [
        'error',
        {
          allow: [
            'eslint-disable',
            'eslint-disable-line',
            'eslint-disable-next-line',
            'eslint-enable',
          ],
        },
      ],
      // Toute désactivation nomme ses règles et justifie l'exception.
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      '@eslint-community/eslint-comments/no-unused-disable': 'error',
    },
  },
  prettier,
);
