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
 *
 * Which of the twelve rules are enforced HERE, which are enforced by config or CI,
 * and which are irreducibly a review judgement, is set out in docs/GOLDEN_RULES.md.
 * Three of the twelve are not statically decidable and are not claimed to be.
 *
 * ── A NOTE ON no-restricted-syntax ──────────────────────────────────────────────
 * That rule does NOT merge across config blocks: a later block matching the same
 * file REPLACES the earlier selector list rather than adding to it. Composing the
 * lists from named constants below is what stops a new block silently switching
 * off an older rule — a failure that would be invisible in review and is exactly
 * what unit/golden-rules.unit.test.ts exists to catch.
 */

/** Golden rule #1 — locators are getByRole/getByLabel/getByTestId only. */
const NO_CSS_LOCATORS = [
  {
    selector: "CallExpression[callee.property.name='locator']",
    message: 'Golden rule #1: use getByRole/getByLabel/getByTestId — never .locator() (CSS/XPath).',
  },
  {
    selector: 'CallExpression[callee.property.name=/^\\$\\$?$/]',
    message: 'Golden rule #1: page.$/page.$$ take CSS selectors — use getByRole/getByLabel/getByTestId.',
  },
];

/** Golden rule #1, continued — text locators are legal, but belong behind a Page Object. */
const NO_TEXT_LOCATORS = [
  {
    selector: 'CallExpression[callee.property.name=/^(getByText|getByAltText|getByTitle)$/]',
    message:
      'Golden rule #1: text-based locators are brittle and belong behind a Page Object. Prefer getByRole/getByLabel/getByTestId.',
  },
];

/** Golden rule #2 — every UI interaction lives in a Page Object. */
const NO_DIRECT_UI_DRIVING = [
  {
    selector:
      "CallExpression[callee.object.name='page'][callee.property.name=/^(click|dblclick|fill|type|press|check|uncheck|selectOption|hover|tap|focus|setInputFiles|dragAndDrop|selectText)$/]",
    message:
      'Golden rule #2: drive the UI through a Page Object in pages/, not directly from a spec or step definition.',
  },
];

/** Golden rule #3 — shared setup lives in fixtures/, not in a hook in every file. */
const NO_SETUP_HOOKS = [
  {
    selector: "CallExpression[callee.object.name='test'][callee.property.name=/^(beforeEach|beforeAll)$/]",
    message:
      'Golden rule #3: put shared setup in a fixture (fixtures/), not a beforeEach. Fixtures compose, are typed, and run per test without being copied between files.',
  },
];

/**
 * Golden rule #4 — tests run in isolation.
 *
 * Independence cannot be decided statically, so this bans the two constructs that
 * CREATE order dependence rather than trying to detect it: serial mode, and mutable
 * state hoisted to module scope where every test in the file can reach it.
 */
const NO_ORDER_DEPENDENCE = [
  {
    selector: "CallExpression[callee.property.name='configure'] Property[key.name='mode'][value.value='serial']",
    message:
      'Golden rule #4: serial mode makes a test depend on the one before it. If a scenario needs state, create it in that scenario.',
  },
  {
    selector: "CallExpression[callee.object.property.name='describe'][callee.property.name='serial']",
    message: 'Golden rule #4: test.describe.serial couples tests to each other and to their order.',
  },
  {
    selector: 'Program > VariableDeclaration[kind=/^(let|var)$/]',
    message:
      'Golden rule #4: module-scoped mutable state is shared by every test in the file. Use a fixture, or a const created inside the test.',
  },
];

/** Golden rule #6 — third parties are mocked through the `network` fixture. */
const NO_RAW_ROUTE = [
  {
    selector: "CallExpression[callee.object.name='page'][callee.property.name=/^(route|unroute|routeFromHAR)$/]",
    message:
      'Golden rule #6: mock through the `network` fixture (mock/degrade), not page.route() directly — the fixture unroutes on teardown and keeps mocks out of individual specs.',
  },
];

/** Golden rule #7 — synthetic data only, from the `data` fixture. */
const NO_REAL_PII = [
  {
    selector: 'Literal[value=/^[\\w.+-]+@[\\w-]+\\.[\\w.]+$/]',
    message:
      'Golden rule #7: no literal email addresses in test code — use the `data` fixture (data.email() / data.realistic.*). A literal is either real PII or a collision waiting to happen.',
  },
  {
    selector: "ImportDeclaration[source.value='@faker-js/faker']",
    message:
      'Golden rule #7: import synthetic data from the `data` fixture, not faker directly — the fixture is what guarantees uniqueness across parallel workers.',
  },
];

/** Golden rule #11 — Page Objects arrive via fixtures, never `new`. */
const NO_MANUAL_PAGE_OBJECTS = [
  {
    selector: 'NewExpression[callee.name=/Page$/]',
    message:
      'Golden rule #11: receive Page Objects from a fixture (async ({ loginPage }) => …), do not construct them. Register new ones in fixtures/pages.fixture.ts.',
  },
];

/** Golden rule #12 — no application name in the reusable core. */
const NO_APP_NAMES_IN_CORE = [
  {
    selector: 'Literal[value=/vikunja/i]',
    message:
      'Golden rule #12: utils/ and fixtures/ are the application-agnostic core. Name the application in pages/, features/ or .env, never here.',
  },
];

/** Everything that applies to code testing an application. */
const APPLICATION_TEST_RULES = [
  ...NO_CSS_LOCATORS,
  ...NO_TEXT_LOCATORS,
  ...NO_DIRECT_UI_DRIVING,
  ...NO_SETUP_HOOKS,
  ...NO_RAW_ROUTE,
  ...NO_REAL_PII,
  ...NO_MANUAL_PAGE_OBJECTS,
];

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

  // Golden rule #5 — web-first assertions, and no escape hatches around them.
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
      'playwright/valid-expect': 'error',
      'playwright/no-useless-await': 'error',
      // `force: true` switches off the actionability checks — the very checks that
      // tell you a control is invisible, disabled or covered. A test that forces its
      // way through passes against a control no person could operate. This repo hit
      // exactly that on a screen-reader-only checkbox; the answer was to activate it
      // from the keyboard, not to force a click. See pages/ProjectPage.ts.
      'playwright/no-force-option': 'error',
      // Element handles and page.$eval opt out of auto-waiting and take CSS.
      'playwright/no-element-handle': 'error',
      'playwright/no-eval': 'error',
      // networkidle is discouraged upstream and flakes under a busy SPA — this repo
      // has one that polls. Assert on what the user sees instead.
      'playwright/no-networkidle': 'error',
      'playwright/no-page-pause': 'error',
      // expectSchema() (utils/contract.ts) is an assertion — it throws on drift.
      'playwright/expect-expect': ['error', { assertFunctionNames: ['expectSchema'] }],
      // The gated API example uses test.skip legitimately; self-tests use try/catch.
      'playwright/no-skipped-test': 'off',
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-standalone-expect': 'off',
      'no-restricted-syntax': ['error', ...NO_CSS_LOCATORS],
    },
  },

  // Framework self-tests: they test this framework's own helpers, so they may hold
  // state across tests deliberately (see framework-tests/cleanup.spec.ts, which
  // proves teardown runs after a FAILING test and therefore must be ordered).
  // Everything else that applies to test code still applies.
  {
    files: ['framework-tests/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...APPLICATION_TEST_RULES] },
  },

  // Code that tests an application. Independence is required here.
  {
    files: ['tests/**/*.ts', 'specs/**/*.ts', 'features/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...APPLICATION_TEST_RULES, ...NO_ORDER_DEPENDENCE] },
  },

  // Setup projects bootstrap the session BEFORE any fixture exists, so they are the
  // one place a Page Object is legitimately constructed by hand.
  {
    files: ['tests/**/*.setup.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...APPLICATION_TEST_RULES.filter((r) => !NO_MANUAL_PAGE_OBJECTS.includes(r)),
        ...NO_ORDER_DEPENDENCE,
      ],
    },
  },

  // Golden rule #12 — the core stays application-agnostic. utils/ and fixtures/ are
  // shared machinery: they must not reach into the app-specific layers, and must not
  // name the application either.
  {
    files: ['utils/**/*.ts', 'fixtures/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_APP_NAMES_IN_CORE],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/pages/*', '**/features/*', '../pages/*', '../features/*'],
              message: 'Golden rule #12: the core is application-agnostic and must not depend on pages/ or features/.',
            },
          ],
        },
      ],
    },
  },

  // fixtures/pages.fixture.ts is the one file whose JOB is to import Page Objects
  // and construct them — that is what golden rule #11 asks every other file to
  // delegate to. The import restriction is lifted here and nowhere else.
  {
    files: ['fixtures/pages.fixture.ts'],
    rules: { 'no-restricted-imports': 'off' },
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
