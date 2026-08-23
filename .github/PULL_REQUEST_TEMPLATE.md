## What and why

<!-- What changed, and what problem it solves. If it fixes a defect, say what the
     defect actually was — the mechanism, not just the symptom. -->

## How it was verified

<!-- What you ran, and what it produced. "Tests pass" is weaker than the output.
     If you fixed a flake, say how many clean runs you observed. -->

## Checklist

- [ ] `npm run lint` — nine of the twelve golden rules are enforced here
- [ ] `npm run typecheck`
- [ ] `npm run test:unit` — includes the tests of the lint rules themselves
- [ ] `npm run check:docs` — every npm script and path referenced in Markdown resolves
- [ ] Requirements updated if coverage changed, including any gap left deliberately
- [ ] No test made to pass by weakening an assertion, adding a retry, or `force: true`
