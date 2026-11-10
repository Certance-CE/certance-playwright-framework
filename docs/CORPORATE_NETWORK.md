# Running inside a corporate network

What to set when the framework runs behind a proxy, with a private package registry, a
browser-download mirror or TLS inspection. Every row marked **measured** was checked with a
logging proxy on 2026-11-10; the rest is the tools' documented behaviour, marked as such.

## What goes through the proxy

Set the standard variables, and the framework honours them everywhere:

```bash
export HTTPS_PROXY=http://proxy.corp.example:8080
export HTTP_PROXY=http://proxy.corp.example:8080
export NO_PROXY=.corp.example,staging.internal   # hosts reached directly, comma-separated
```

| What runs                                                                                             | Honours `HTTPS_PROXY` by itself?                                  | What the framework does                                                                              |          |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| `npm install` / `npm ci`                                                                              | yes                                                               | nothing needed                                                                                       | measured |
| `npx playwright install` (browser download)                                                           | yes                                                               | nothing needed                                                                                       | measured |
| Node's `fetch`: the demo app download (`npm run setup`) and the requirements agent's document fetcher | **no**: it goes direct, and fails where direct traffic is blocked | reruns the script with Node's `--use-env-proxy`; on a Node without it (before 22.21 / 24.5), says so | measured |
| Playwright's browser and API client: every test, `npm run init`, `npm run auth:capture`               | **no**: they take a `proxy` option                                | passes the proxy from the variables, with `NO_PROXY` as the bypass list                              | measured |

**Loopback always goes direct** (`localhost`, `127.0.0.1`, `::1`), so the reference
application, started on this machine, keeps working behind a proxy. Measured: with a proxy
set, the external TodoMVC lane went through it and nothing on loopback did.

**Put your test environment in `NO_PROXY`** when it is reachable directly, as internal staging
usually is. Sending it through an internet proxy is a common cause of tests that time out.

## A private package registry

Point npm at it in `.npmrc` (in the repository, or the CI agent's home directory):

```ini
registry=https://artifactory.corp.example/api/npm/npm-remote/
cafile=/etc/ssl/certs/corp-ca.pem
//artifactory.corp.example/api/npm/npm-remote/:_authToken=${NPM_TOKEN}
```

`package-lock.json` records `registry.npmjs.org` addresses. npm rewrites them to the
configured registry by default (its `replace-registry-host` setting), so the lockfile does
not need regenerating. _npm's documented behaviour; not measured here._

## Browser downloads

`npx playwright install chromium` downloads from `cdn.playwright.dev`. Three ways round a
block, in order of preference:

1. **Through the proxy**: works as is (measured).
2. **From your mirror**: `export PLAYWRIGHT_DOWNLOAD_HOST=https://artifactory.corp.example/playwright`,
   a mirror of `cdn.playwright.dev`. _Playwright's documented behaviour._
3. **Installed once, shared**: install into a folder the CI agents can read, then
   `export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` and
   `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` on the agents. Or run in Playwright's container image
   (`mcr.microsoft.com/playwright`, matching the version in `package-lock.json`).

On Linux agents, `npx playwright install --with-deps` installs system packages and needs root.
Without it, use the container image, or ask for the packages it lists to be preinstalled.

## TLS inspection

If the network re-signs HTTPS traffic with a corporate certificate:

- **Node and npm**: `export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/corp-ca.pem`, and `cafile` in
  `.npmrc` as above.
- **The browser**: trust the corporate certificate in the operating system's store. Chromium
  uses it; `NODE_EXTRA_CA_CERTS` does not reach the browser.

Do not set `ignoreHTTPSErrors: true` in the shared configuration to get past a certificate
error. It switches off the check for every site the suite visits, including the application
under test.

## When the demo application cannot be downloaded

`npm run setup` fetches the reference application from GitHub. It is only needed for the
reference suite: once `BASE_URL` points at your application (or after `npm run init`), the
download is skipped. To keep the reference suite inside a closed network, bring the release
in by hand: unpack the binary for your platform from the `github.com/go-vikunja/vikunja`
release that `scripts/fetch-app.js` names (`VERSION`) to `.bin/vikunja` (`.bin\vikunja.exe` on
Windows), and write that version, for example `v2.5.0`, to `.bin/.version`. `npm run setup`
then reports it as already present.

## Checking it

With the variables set, `npm test` behind the proxy should pass. To see what goes
through it, run any logging proxy and watch: the four rows above are exactly what this file
was checked against.
