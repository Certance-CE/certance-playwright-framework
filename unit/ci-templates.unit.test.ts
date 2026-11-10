import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

/**
 * The Azure DevOps and GitLab templates (ci/) are not run on those platforms by Certance; the
 * GitHub workflow is, on every pull request. So the templates are held to it here: a gate the
 * GitHub workflow runs and a template drops is the drift that would let a customer's pipeline
 * pass what ours fails.
 */
const ROOT = path.join(__dirname, '..');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');
const scripts = Object.keys(JSON.parse(read('package.json')).scripts);

/** Every npm script a pipeline runs: `npm run <name>`, plus `npm test`. */
function npmScripts(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(/\bnpm run ([\w:-]+)/g)) found.add(m[1]!);
  if (/\bnpm test\b/.test(text)) found.add('test');
  return found;
}

const github = npmScripts(read('.github/workflows/playwright.yml'));
const templates = { azure: 'ci/azure-pipelines.yml', gitlab: 'ci/gitlab-ci.yml' };

describe('CI templates mirror the GitHub workflow', () => {
  for (const [name, file] of Object.entries(templates)) {
    describe(name, () => {
      const text = read(file);

      it('is valid YAML', () => {
        expect(() => parse(text)).not.toThrow();
      });

      it('runs every gate the GitHub workflow runs', () => {
        const missing = [...github].filter((s) => !npmScripts(text).has(s));
        expect(missing).toEqual([]);
      });

      it('calls only npm scripts that exist', () => {
        expect([...npmScripts(text)].filter((s) => s !== 'test' && !scripts.includes(s))).toEqual([]);
      });

      it('passes every sign-in secret to the suite', () => {
        for (const v of ['TEST_USER_EMAIL', 'TEST_USER_PASSWORD', 'TEST_USER_TOTP_SECRET', 'STORAGE_STATE_BASE64']) {
          expect(text).toContain(v);
        }
      });

      it('gives the integrity gate the full history it diffs against', () => {
        expect(text).toMatch(/fetchDepth: 0|GIT_DEPTH: '0'/);
      });

      it('keeps the quality report as an artifact even when the suite fails', () => {
        expect(text).toContain('allure-report/index.html');
        expect(text).toMatch(/condition: always\(\)|when: always/);
      });
    });
  }

  it('found the GitHub gates to compare against', () => {
    // A guard on the guard: if the workflow stopped naming scripts, the comparison would be empty.
    for (const s of [
      'lint',
      'typecheck',
      'check:docs',
      'agents:sync',
      'gate:skips',
      'test:unit',
      'test:mutation',
      'test',
      'report',
    ]) {
      expect(github.has(s)).toBe(true);
    }
  });
});
