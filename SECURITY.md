# Security Policy

## Reporting a vulnerability

If you find a security issue, please report it **privately** — do not open a public issue or PR.

Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository, or email **security@certance.eu**. We aim to acknowledge within a few
business days and will keep you informed of the fix.

## Scope

This is a test-automation framework. The most relevant risks are:

- **Secrets in the repo or in test artifacts.** Never commit `.env`, `storageState`, tokens, or
  real credentials. Auth state belongs in CI secrets and is injected at runtime; `test-data/.auth/`
  is git-ignored. Synthetic data (faker) is used everywhere else.
- **Dependency vulnerabilities.** Dependabot is enabled; please keep PRs that bump dependencies
  green.

## Handling credentials

The framework is designed to keep credentials out of source control. They are supplied via
environment variables / CI secrets, used once to sign in, and captured into a `storageState`
artifact that is never committed (`test-data/.auth/` is git-ignored).

**We deliberately ship no home-grown credential encoding.** Encoding a password so it is not
human-readable is obfuscation, not encryption — it offers no real protection and invites treating
an encoded secret as a safe one. Use your platform's secret manager (GitHub Actions secrets, Vault,
AWS/GCP/Azure secret managers) and inject at runtime.
