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
    files: [
      'tests/**/*.ts',
      'framework-tests/**/*.ts',
      'specs/**/*.ts',
      'features/**/*.ts',
      'fixtures/**/*.ts',
      'pages/**/*.ts',
      'utils/**/*.ts',
    ],
  },

  // Reinforce the golden rules beyond the plugin's defaults.
  {
    files: [
      'tests/**/*.ts',
      'framework-tests/**/*.ts',
      'specs/**/*.ts',
      'features/**/*.ts',
      'fixtures/**/*.ts',
      'pages/**/*.ts',
    ],
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
        {
          selector: 'CallExpression[callee.property.name=/^\\$\\$?$/]',
          message: 'Golden rule #1: page.$/page.$$ take CSS selectors — use getByRole/getByLabel/getByTestId.',
        },
      ],
    },
  },

  // Golden rule #2 — every UI interaction lives in a Page Object.
  //
  // Scoped to test code only: pages/ is where these calls are supposed to be, and
  // fixtures/ needs them to build reusable behaviour. A spec or step definition
  // driving the page directly is the thing this rule exists to stop.
  {
    files: ['tests/**/*.ts', 'framework-tests/**/*.ts', 'specs/**/*.ts', 'features/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='page'][callee.property.name=/^(click|dblclick|fill|type|press|check|uncheck|selectOption|hover|tap|focus|setInputFiles|dragAndDrop|selectText)$/]",
          message:
            'Golden rule #2: drive the UI through a Page Object in pages/, not directly from a spec or step definition.',
        },
        {
          selector: "CallExpression[callee.property.name='locator']",
          message: 'Golden rule #1: use getByRole/getByLabel/getByTestId — never .locator() (CSS/XPath).',
        },
        {
          selector: 'CallExpression[callee.property.name=/^\\$\\$?$/]',
          message: 'Golden rule #1: page.$/page.$$ take CSS selectors — use getByRole/getByLabel/getByTestId.',
        },
        {
          selector: 'CallExpression[callee.property.name=/^(getByText|getByAltText|getByTitle)$/]',
          message:
            'Golden rule #1: text-based locators are brittle and belong behind a Page Object. Prefer getByRole/getByLabel/getByTestId.',
        },
      ],
    },
  },

  // Golden rule #12 — the core stays application-agnostic. utils/ is shared
  // machinery, so it must not reach into the app-specific layers.
  {
    files: ['utils/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/pages/*', '**/features/*', '../pages/*', '../features/*'],
              message:
                'Golden rule #12: utils/ is the application-agnostic core and must not depend on pages/ or features/.',
            },
          ],
        },
      ],
    },
  },

  // Framework self-tests and the auth bootstrap deliberately do odd things
  // (throw-in-disposer, test.fail(), or asserting through a Page Object method,
  // which the expect-expect rule cannot see).
  {
    files: [
      'framework-tests/cleanup.spec.ts',
      'framework-tests/contract.spec.ts',
      'framework-tests/foundation.spec.ts',
      'tests/auth.setup.ts',
    ],
    rules: { 'playwright/expect-expect': 'off' },
  },

  prettier,
);
