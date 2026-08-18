import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config — machine-enforces the golden rules that were previously
 * only grep/manually verified, and stops AI-generator drift.
 *
 * Run: `npm run lint` (CI gate) · `npm run lint:fix` (autofix).
 * Prettier handles formatting (`npm run format`); eslint-config-prettier last
 * disables any eslint rule that would fight it.
 */
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.features-gen/**',
      'allure-results/**',
      'allure-report*/**',
      'playwright-report/**',
      'test-results/**',
      'ctrf/**',
      'blob-report/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Dep-free CommonJS Node scripts — require() is correct here, and they use
  // Node/web globals + intentional control-char regexes (ANSI stripping).
  {
    files: ['scripts/**/*.js', '*.cjs'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-control-regex': 'off',
    },
  },

  // Playwright rules on all test + framework code.
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**/*.ts', 'specs/**/*.ts', 'features/**/*.ts', 'fixtures/**/*.ts', 'pages/**/*.ts', 'utils/**/*.ts'],
  },

  // Reinforce the golden rules beyond the plugin's defaults.
  {
    files: ['tests/**/*.ts', 'specs/**/*.ts', 'features/**/*.ts', 'fixtures/**/*.ts', 'pages/**/*.ts'],
    rules: {
      'playwright/no-wait-for-timeout': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/missing-playwright-await': 'error',
      // expectSchema() (utils/contract.ts) is an assertion — it throws on drift.
      'playwright/expect-expect': ['error', { assertFunctionNames: ['expectSchema'] }],
      // The gated API example uses test.skip legitimately; self-tests use try/catch.
      'playwright/no-skipped-test': 'off',
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-standalone-expect': 'off',
      // Golden rule #1 — locators are getByRole/getByLabel/getByTestId only.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='locator']",
          message: 'Golden rule #1: use getByRole/getByLabel/getByTestId — never .locator() (CSS/XPath).',
        },
      ],
    },
  },

  // Framework self-tests + the auth-seed bootstrap deliberately do odd things
  // (throw-in-disposer, test.fail(), or asserting via a Page Object method).
  {
    files: ['tests/cleanup.spec.ts', 'tests/contract.spec.ts', 'tests/foundation.spec.ts', 'tests/seed.spec.ts'],
    rules: { 'playwright/expect-expect': 'off' },
  },

  prettier,
);
