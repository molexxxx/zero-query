// Flat ESLint config — minimal but strict enough to catch real bugs.
// Style is intentionally not enforced (no formatter rules).
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'cli/scaffold/**',
      'zquery-website/dist/**',
      'zquery-website/assets/scripts/zq-highlight.js',
      'zquery-website/assets/scripts/zquery.min.js',
    ],
  },

  // CLI: CommonJS Node.js
  {
    files: ['cli/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-inner-declarations': 'off',
    },
  },

  // Library source + main entry: ES modules
  {
    files: ['index.js', 'src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-inner-declarations': 'off',
    },
  },

  // Devtools panel scripts: loaded as separate <script> tags in a single
  // browser context, so they share top-level vars across files.
  {
    files: ['cli/commands/dev/devtools/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-prototype-builtins': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
    },
  },

  // Website app: browser globals + module syntax
  {
    files: ['zquery-website/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        $: 'readonly',
        z: 'readonly',
        ZQHighlight: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
    },
  },

  // Tests: vitest globals + Node
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-cond-assign': 'off',
      'no-constant-condition': 'off',
    },
  },
];
