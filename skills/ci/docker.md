# Docker — Containerised Test Execution

Load this guide when: containerising the test suite, building a custom Docker
image, or running tests in an isolated Docker environment locally.

---

## Official Playwright Docker image

Always use the official Microsoft Playwright image — it includes all browser
dependencies pre-installed and matches the Playwright version exactly.

```bash
# Pull the image matching your @playwright/test version
docker pull mcr.microsoft.com/playwright:v1.52.0-noble

# Run tests in the container
docker run --rm \
  -e BASE_URL="https://staging.your-app.com" \
  -e TEST_USER_EMAIL="qa@your-app.com" \
  -e TEST_USER_PASSWORD="your-secret" \
  -e APP_LIST_URL="https://staging.your-app.com/app/list" \
  -v $(pwd):/app \
  -w /app \
  --user 1001 \
  mcr.microsoft.com/playwright:v1.52.0-noble \
  bash -c "npm ci && npm run test:seed && npm run bdd:gen && npx playwright test --project=bdd:chromium"
```

---

## Custom Dockerfile (if you need additional tools)

```dockerfile
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci

# Copy project files
COPY . .

# Run tests
CMD ["bash", "-c", "npm run test:seed && npm run bdd:gen && npx playwright test"]
```

Build and run:

```bash
docker build -t certance-playwright .
docker run --env-file .env certance-playwright
```

---

## Version matching

The Docker image tag must match your `@playwright/test` version:

```
mcr.microsoft.com/playwright:v{version}-noble
```

Update both together in `package.json` and CI pipeline when upgrading.

---

## Local Docker vs. CI

Running in Docker locally ensures your local environment matches CI exactly
(same browser binaries, same OS libraries). Use this to reproduce CI-only failures:

```bash
# Run exactly as CI would
docker run --rm --env-file .env \
  -v $(pwd):/app -w /app \
  --user 1001 \
  mcr.microsoft.com/playwright:v1.52.0-noble \
  npm run bdd:test
```
