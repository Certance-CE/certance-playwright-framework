# 🔐 GitHub Secrets Setup Guide

## **Why the Pipeline Failed**

Your test tried to navigate to `http://localhost:3000/`, but:

- Repository secrets weren't configured
- No application server was running
- Environment variables were empty

## **Required Repository Secrets**

Navigate to: `https://github.com/<your-org>/<your-repo>/settings/secrets/actions`

Add these 4 secrets:

| Secret Name          | Example Value                           | Description                  |
| -------------------- | --------------------------------------- | ---------------------------- |
| `BASE_URL`           | `https://staging.yourapp.com`           | Your staging environment URL |
| `TEST_USER_EMAIL`    | `qa-test@yourcompany.com`               | Test user email for login    |
| `TEST_USER_PASSWORD` | `your-secure-password`                  | Test user password           |
| `APP_LIST_URL`       | `https://staging.yourapp.com/dashboard` | Post-login navigation URL    |

## **What These Do**

- `BASE_URL`: Where the test navigates first (your login page)
- `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`: Credentials for authentication
- `APP_LIST_URL`: Where to go after successful login

## **Next Steps**

1. ✅ **Set up staging environment** (if you don't have one)
2. ✅ **Create test user account** in that environment
3. ✅ **Add the 4 repository secrets** above
4. ✅ **Push a commit** to trigger the pipeline again

## **Expected Flow**

1. Tests navigate to your staging login page
2. Enter test credentials and log in
3. Wait for the app under test's authenticated view to appear
4. Save authentication state for other tests
5. Run your BDD test suite with saved auth

## **Local Development**

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your local/staging values
# Then run tests locally:
npm run test:auth
```
