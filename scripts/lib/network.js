/**
 * Corporate networks: the standard proxy variables, honoured by everything the framework runs.
 *
 * Measured with a logging proxy (docs/CORPORATE_NETWORK.md): npm and `playwright install`
 * honour HTTPS_PROXY by themselves. Node's own fetch does not, unless Node runs with
 * --use-env-proxy; nor do Playwright's browser and API client, which take a `proxy` option.
 * So a script that downloads with fetch calls ensureEnvProxy() first, and anything that
 * launches a browser or a request context passes proxyFromEnv().
 *
 * Dependency-free, for plain-Node scripts. playwright.config.ts has the same rule inline.
 */
const { spawnSync } = require('node:child_process');

const env = process.env;
const proxyUrl = () => env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || '';

/** The proxy for a Playwright browser or request context, or undefined when none is set. */
function proxyFromEnv() {
  const server = proxyUrl();
  if (!server) return undefined;
  // Loopback always goes direct: the reference application, and any app on localhost.
  const bypass = ['localhost', '127.0.0.1', '::1', ...String(env.NO_PROXY || env.no_proxy || '').split(',')]
    .map((h) => h.trim())
    .filter(Boolean)
    .join(',');
  return { server, bypass };
}

/**
 * Make Node's fetch use the proxy. When one is set and this process was not started with
 * --use-env-proxy, run the same script again with it, and exit with its status. On a Node
 * that does not know the flag, say so: the download would go around the proxy and fail.
 */
function ensureEnvProxy() {
  if (!proxyUrl() || env.NODE_USE_ENV_PROXY === '1' || process.execArgv.includes('--use-env-proxy')) return;
  if (!process.allowedNodeEnvironmentFlags.has('--use-env-proxy')) {
    console.warn(
      `A proxy is set (${proxyUrl()}), but Node ${process.versions.node} cannot route its own downloads through it.`,
    );
    console.warn('Use Node 22.21 / 24.5 or newer, or download behind the proxy another way.');
    return;
  }
  const run = spawnSync(process.execPath, ['--use-env-proxy', ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(run.status ?? 1);
}

module.exports = { proxyFromEnv, ensureEnvProxy };
