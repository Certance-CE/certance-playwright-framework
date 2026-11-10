import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';

/**
 * scripts/lib/network.js: the proxy rule for everything the framework launches. Measured with
 * a logging proxy (docs/CORPORATE_NETWORK.md): Playwright's browser and API client ignore
 * HTTPS_PROXY unless given a `proxy` option, and Node's fetch unless run with --use-env-proxy.
 * These cases pin how the option is built and when the rerun is skipped.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const network = require(path.join(__dirname, '../scripts/lib/network.js'));
const KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'NO_PROXY', 'no_proxy', 'NODE_USE_ENV_PROXY'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const set = (vars: Record<string, string>) => {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
};
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('proxyFromEnv', () => {
  it('is undefined with no proxy set, so nothing changes off a corporate network', () => {
    set({});
    expect(network.proxyFromEnv()).toBeUndefined();
  });

  it('reads HTTPS_PROXY, then the lower-case and HTTP_ forms', () => {
    set({ http_proxy: 'http://lower-http:3128' });
    expect(network.proxyFromEnv().server).toBe('http://lower-http:3128');
    set({ HTTP_PROXY: 'http://http:3128', HTTPS_PROXY: 'http://https:3128' });
    expect(network.proxyFromEnv().server).toBe('http://https:3128');
  });

  it('always bypasses loopback, so the reference application keeps working', () => {
    set({ HTTPS_PROXY: 'http://proxy:8080' });
    expect(network.proxyFromEnv().bypass.split(',')).toEqual(['localhost', '127.0.0.1', '::1']);
  });

  it('adds NO_PROXY hosts to the bypass list, trimmed, ignoring empty entries', () => {
    set({ HTTPS_PROXY: 'http://proxy:8080', NO_PROXY: ' .corp.example, staging.internal ,,' });
    expect(network.proxyFromEnv().bypass).toBe('localhost,127.0.0.1,::1,.corp.example,staging.internal');
  });
});

describe('ensureEnvProxy', () => {
  it('does nothing without a proxy', () => {
    set({});
    expect(network.ensureEnvProxy()).toBeUndefined();
  });

  it('does nothing when Node is already routing through the proxy', () => {
    set({ HTTPS_PROXY: 'http://proxy:8080', NODE_USE_ENV_PROXY: '1' });
    expect(network.ensureEnvProxy()).toBeUndefined();
  });
});
