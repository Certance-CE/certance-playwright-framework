---
epic: Task management
journey: Manage work in a project
priority: normal
---

# Performance (UI)

Page-load performance of the reference application, measured in a real browser on every
run: Core Web Vitals from the page (LCP, CLS, INP, TTFB, FCP) and main-thread engine time
from Chromium. A breach fails the scenario, and `npm run perf:summary` puts the budget
table in the CI run summary.

## REQ-PERF-001 — The signed-in overview loads within the Core Web Vitals budget

**Priority:** normal

The overview a signed-in user lands on meets the Core Web Vitals "good" thresholds:
LCP ≤ 2.5 s, CLS ≤ 0.1, TTFB ≤ 800 ms, and no more than 2 s of main-thread script.

- Covered by: `features/performance.feature` → _The signed-in overview loads within the Core Web Vitals budget_

## REQ-PERF-002 — A project's task list loads within a stricter budget

**Priority:** normal

A project's task list, with a task in it, renders its largest element within 1.5 s and
shifts its layout by no more than 0.05. A team's own target, tighter than the public
thresholds, written into the scenario where a reviewer can see and change it.

- Covered by: `features/performance.feature` → _A project's task list loads within the team's own, stricter budget_
