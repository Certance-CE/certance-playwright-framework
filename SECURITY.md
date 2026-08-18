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

The framework is designed to keep credentials out of source control: they are supplied via
environment variables / CI secrets and captured into a `storageState` artifact that is never
committed. If you must store a password locally, obfuscate it with `utils/obfuscation.ts` — but
prefer environment injection.
