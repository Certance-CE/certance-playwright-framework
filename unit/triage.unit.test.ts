import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';

/**
 * Failure triage (scripts/triage.js), Governed Loop stage 07. The fixture is a real Playwright
 * run of failures planted one per class (unit/fixtures/triage/), so the rules are held to what
 * Playwright actually reports. The real failures below come from this framework's own history.
 */
// A plain import (not require), so mutation testing can instrument the script it exercises.
// @ts-expect-error: a plain-Node CommonJS script without type declarations
import triageScript from '../scripts/triage.js';
const { classify, triage, render } = triageScript;
const report = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/triage/planted-results.json'), 'utf8'));
const failed = (message: string) => ({ status: 'unexpected', results: [{ status: 'failed', error: { message } }] });

describe('triage — the planted run, one failure per class', () => {
  const items: { title: string; class: string; healable: boolean }[] = triage(report);
  const expected: Record<string, string> = { product: 'product', test: 'test', env: 'environment', flake: 'flake' };

  it('finds all ten planted failures', () => {
    expect(items).toHaveLength(10);
  });

  for (const prefix of Object.keys(expected)) {
    it(`classifies every "${prefix}:" failure as ${expected[prefix]}`, () => {
      const group = items.filter((i) => i.title.split(' › ').pop()!.startsWith(`${prefix}:`));
      expect(group.length).toBeGreaterThan(0);
      for (const i of group)
        expect({ title: i.title, class: i.class }).toEqual({ title: i.title, class: expected[prefix] });
    });
  }

  it('lets the healer act on test defects, and on nothing else', () => {
    for (const i of items) expect(i.healable).toBe(i.class === 'test');
  });
});

describe('triage — real failures from this repository', () => {
  it('Quick Add losing labels (a Vikunja-on-SQLite defect) is a product defect, never healable', () => {
    const t = classify(
      failed(
        'Error: labels\n\nexpect(received).toEqual(expected) // deep equality\n\n- Expected  - 4\n+ Received  + 1\n\nExpected: ["logistics","urgent"]\nReceived: []',
      ),
    );
    expect(t).toMatchObject({ class: 'product', healable: false });
  });

  it('the shared session expiring mid-run is environment, not product', () => {
    const t = classify(
      failed(
        'Error: http://127.0.0.1:3456/api/v1/projects — {"code":11,"message":"missing, malformed, expired or otherwise invalid token provided"}\nExpected: 201\nReceived: 401',
      ),
    );
    expect(t).toMatchObject({ class: 'environment', confidence: 'medium' });
  });

  it('API contract drift is a product (provider) defect, high confidence', () => {
    expect(
      classify(
        failed('Error: API contract drift — GET /api/v1/info did not match its schema:\n · version — expected string'),
      ),
    ).toMatchObject({
      class: 'product',
      confidence: 'high',
    });
  });

  it('a web server that never started is environment', () => {
    expect(
      classify(failed('Error: Process from config.webServer was not able to start. Exit code: 127')),
    ).toMatchObject({
      class: 'environment',
      confidence: 'high',
    });
  });

  it('a page that never finished loading is environment, with medium confidence', () => {
    expect(
      classify(
        failed(
          'TimeoutError: page.goto: Timeout 60000ms exceeded.\nCall log:\n  - navigating to "http://127.0.0.1:3456/"',
        ),
      ),
    ).toMatchObject({
      class: 'environment',
      confidence: 'medium',
    });
  });
});

describe('triage — fail-safe', () => {
  it('an unrecognised failure is unclassified and not healable', () => {
    expect(classify(failed('Error: something nobody planned for'))).toMatchObject({
      class: 'unclassified',
      healable: false,
    });
  });

  it('a failure with no message at all is unclassified, not a test defect', () => {
    expect(classify({ status: 'unexpected', results: [{ status: 'failed' }] })).toMatchObject({
      class: 'unclassified',
    });
  });

  it('a value mismatch is never presented as a test defect, whatever the locator', () => {
    const t = classify(
      failed(
        'Error: expect(locator).toHaveText(expected) failed\nLocator: getByRole("heading")\nExpected: "10.00"\nReceived: "9.99"',
      ),
    );
    expect(t.class).toBe('product');
    expect(t.reason).toMatch(/never healed/);
  });
});

describe('triage report', () => {
  it('puts product defects first, as findings, and says only test defects may be healed', () => {
    const md = render(triage(report));
    expect(md.indexOf('Findings: product defects')).toBeGreaterThan(-1);
    expect(md.indexOf('Findings: product defects')).toBeLessThan(md.indexOf('Test defects'));
    expect(md).toContain('only test defects are eligible for the healer');
  });

  it('says so plainly when there is nothing to triage', () => {
    expect(render([])).toContain('No failures to triage');
  });
});

describe('triage — each planted failure: class, confidence and the reason a person reads', () => {
  const byTitle = Object.fromEntries(
    triage(report).map((i: { title: string }) => [i.title.split(' › ').pop(), i]),
  ) as Record<string, { class: string; confidence: string; reason: string }>;
  const expected: [string, string, string, RegExp][] = [
    ['product: wrong value on a found element', 'product', 'medium', /never healed/],
    ['product: wrong count', 'product', 'medium', /never healed/],
    ['product: server error from the application', 'product', 'medium', /server error/],
    ['test: locator matches nothing', 'test', 'medium', /matches nothing/],
    ['test: assertion on a locator that matches nothing', 'test', 'medium', /matches nothing/],
    ['test: locator matches several', 'test', 'high', /more than one element/],
    ['env: application not reachable', 'environment', 'high', /not reachable/],
    ['env: session token rejected', 'environment', 'medium', /session or token/],
    ['env: rate limited', 'environment', 'high', /rate limit/],
    ['flake: fails on the first attempt only', 'flake', 'high', /passed on retry/],
  ];
  for (const [title, cls, confidence, reason] of expected) {
    it(title, () => {
      expect(byTitle[title]).toMatchObject({ class: cls, confidence });
      expect(byTitle[title]!.reason).toMatch(reason);
    });
  }
});

describe('triage — environment: every network failure the rule names', () => {
  const codes = [
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_CONNECTION_RESET',
    'net::ERR_NAME_NOT_RESOLVED',
    'net::ERR_INTERNET_DISCONNECTED',
    'net::ERR_ADDRESS_UNREACHABLE',
    'net::ERR_TIMED_OUT',
    'net::ERR_PROXY_CONNECTION_FAILED',
    'net::ERR_TUNNEL_CONNECTION_FAILED',
    'connect ECONNREFUSED 127.0.0.1:3456',
    'getaddrinfo ENOTFOUND staging.internal',
    'getaddrinfo EAI_AGAIN staging.internal',
  ];
  for (const code of codes) {
    it(code, () => {
      expect(classify(failed(`Error: page.goto: ${code} at http://x/`))).toMatchObject({
        class: 'environment',
        confidence: 'high',
      });
    });
  }

  it('an unrelated net:: error is not assumed to be the network', () => {
    expect(classify(failed('Error: page.goto: net::ERR_UNSAFE_PORT at http://127.0.0.1:9/')).class).not.toBe(
      'environment',
    );
  });

  it('a 403 that names the session is environment; a 403 that does not, with a value, is product', () => {
    expect(classify(failed('Error: forbidden — session expired\nExpected: 200\nReceived: 403')).class).toBe(
      'environment',
    );
    expect(classify(failed('Error: forbidden\nExpected: 200\nReceived: 403')).class).toBe('product');
  });

  it('an unauthorised 401 is environment', () => {
    expect(classify(failed('Error: Unauthorized\nExpected: 200\nReceived: 401')).class).toBe('environment');
  });

  it('a reload or a wait for a URL that times out is environment', () => {
    expect(classify(failed('TimeoutError: page.reload: Timeout 30000ms exceeded.')).class).toBe('environment');
    expect(classify(failed('TimeoutError: page.waitForURL: Timeout 30000ms exceeded.')).class).toBe('environment');
  });

  it('a 4xx that is not about access, with a value, is product', () => {
    expect(classify(failed('Error: GET /orders\nExpected: 200\nReceived: 404')).class).toBe('product');
  });
});

describe('triage — reading the message', () => {
  it('ignores terminal colour codes in the message', () => {
    const coloured = '\x1b[31mError: page.goto: net::ERR_CONNECTION_REFUSED at http://x/\x1b[39m';
    expect(classify(failed(coloured))).toMatchObject({
      class: 'environment',
      evidence: 'Error: page.goto: net::ERR_CONNECTION_REFUSED at http://x/',
    });
  });

  it('takes the first non-empty line as the evidence', () => {
    expect(classify(failed('\n\n  Error: the real first line\nmore')).evidence).toBe('  Error: the real first line');
  });

  it('reads the received value with surrounding spaces trimmed', () => {
    expect(classify(failed('Error: x\nExpected: 200\nReceived:    503   ')).reason).toMatch(/server error/);
  });

  it('reads the message from the first attempt that has an error', () => {
    const t = {
      status: 'unexpected',
      results: [
        { status: 'failed' },
        { status: 'failed', error: { message: 'Error: page.goto: net::ERR_CONNECTION_REFUSED' } },
      ],
    };
    expect(classify(t).class).toBe('environment');
  });

  it('only triages failed and flaky tests, never passed or skipped ones', () => {
    const r = {
      suites: [
        {
          title: 'f',
          specs: [
            {
              title: 's',
              tests: [
                { status: 'expected', results: [] },
                { status: 'skipped', results: [] },
              ],
            },
          ],
        },
      ],
    };
    expect(triage(r)).toEqual([]);
  });

  it('names a test by its suites and title, and keeps its file and project', () => {
    const r = {
      suites: [
        {
          title: 'file.ts',
          suites: [
            {
              title: 'Area',
              specs: [{ title: 'does x', file: 'f.ts', tests: [{ projectName: 'p', status: 'flaky', results: [] }] }],
            },
          ],
        },
      ],
    };
    expect(triage(r)[0]).toMatchObject({
      title: 'file.ts › Area › does x',
      file: 'f.ts',
      project: 'p',
      class: 'flake',
    });
  });
});

describe('triage report — what a person reads', () => {
  const md = render(triage(report));

  it('counts each class in the opening line', () => {
    expect(md).toContain('**10 failure(s):** 3 product, 3 test, 3 environment, 1 flake.');
  });

  it('has one section per class present, in order of what matters most', () => {
    const at = (h: string) => md.indexOf(h);
    expect(at('Findings: product defects')).toBeLessThan(at('Test defects: the only failures the healer may act on'));
    expect(at('Test defects: the only failures')).toBeLessThan(at('Environment: rerun, do not edit'));
    expect(at('Environment: rerun')).toBeLessThan(at('Flakes: passed on retry'));
    expect(md).not.toContain('Unclassified: a person looks');
  });

  it('keeps table cells intact when a title or message contains a pipe', () => {
    const out = render([
      {
        title: 'a | b',
        class: 'product',
        confidence: 'medium',
        reason: 'r',
        evidence: 'x | y'.padEnd(200, 'z'),
        healable: false,
      },
    ]);
    expect(out).toContain('| a \\| b | medium | r | `x \\| y');
    expect(out.split('\n').find((l: string) => l.startsWith('| a'))!.length).toBeLessThan(200);
  });

  it('escapes a backslash before a pipe, and a backtick cannot end the evidence code span', () => {
    const out = render([
      {
        title: 'a \\| b',
        class: 'product',
        confidence: 'medium',
        reason: 'r',
        evidence: 'C:\\x | `y`',
        healable: false,
      },
    ]);
    // `\|` in the input becomes `\\\|`: the backslash is literal and the pipe still escaped.
    expect(out).toContain("| a \\\\\\| b | medium | r | `C:\\\\x \\| 'y'` |");
  });
});

describe('triage — each signal on its own', () => {
  it('a 429 status alone is a rate limit, and so is the words alone', () => {
    expect(classify(failed('Error: POST /login\nExpected: 200\nReceived: 429')).reason).toMatch(/rate limit/);
    expect(classify(failed('Error: {"message":"Too Many Requests"}')).reason).toMatch(/rate limit/);
  });

  it('a 401 with no word about tokens or sessions is not assumed to be the session', () => {
    expect(classify(failed('Error: GET /admin\nExpected: 200\nReceived: 401')).class).toBe('product');
  });

  it('an unclassified failure says so plainly: low confidence, and a person looks', () => {
    expect(classify(failed('Error: something nobody planned for'))).toMatchObject({
      confidence: 'low',
      reason: 'no rule decided it; a person looks',
    });
  });

  it('an empty message leaves the evidence empty, rather than inventing some', () => {
    expect(classify({ status: 'unexpected', results: [{ status: 'failed', error: { message: '' } }] }).evidence).toBe(
      '',
    );
  });

  it('a "Received" inside a sentence is not read as the received value', () => {
    expect(classify(failed('Error: payment not Received: 500 queued')).class).toBe('unclassified');
  });
});
