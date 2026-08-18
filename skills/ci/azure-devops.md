# Azure DevOps Pipeline

Load this guide when: setting up the Playwright suite in an Azure DevOps
(ADO) environment.

---

## Pipeline YAML — smoke tests on PR

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include: [main, develop]

pr:
  branches:
    include: [main, develop]

pool:
  vmImage: ubuntu-latest

container:
  image: mcr.microsoft.com/playwright:v1.52.0-noble
  options: --user 1001

variables:
  BASE_URL: $(BASE_URL)
  TEST_USER_EMAIL: $(TEST_USER_EMAIL)
  TEST_USER_PASSWORD: $(TEST_USER_PASSWORD)
  APP_LIST_URL: $(APP_LIST_URL)
  CI: 'true'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'

  - script: npm ci
    displayName: Install dependencies

  - script: npm run test:seed
    displayName: Seed auth state

  - script: npm run bdd:gen
    displayName: Generate BDD specs

  - script: npx playwright test --project=bdd:chromium --grep @smoke
    displayName: Run smoke tests

  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: test-results/results.xml

  - task: PublishPipelineArtifact@1
    condition: always()
    inputs:
      targetPath: playwright-report
      artifact: playwright-report
```

---

## Adding secrets (ADO Variable Groups)

1. Go to **Pipelines → Library → Variable groups**
2. Create a variable group named `playwright-e2e-secrets`
3. Add variables: `BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `APP_LIST_URL`
4. Mark sensitive variables as **Secret**
5. Link the variable group to your pipeline

---

## JUnit reporter for ADO test results

Add to `playwright.config.ts` reporters:

```typescript
reporter: [
  ['html'],
  ['json', { outputFile: 'test-results/results.json' }],
  ['junit', { outputFile: 'test-results/results.xml' }],  // ADO integration
],
```

Install the JUnit reporter:

```bash
npm install --save-dev playwright-junit-reporter
```
