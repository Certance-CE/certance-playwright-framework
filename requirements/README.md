# requirements/

Optional source requirements for the requirements → BDD pipeline. Drop a
`REQ-*.md` here and the `requirements-to-bdd` agent turns each acceptance
criterion into a tagged Gherkin scenario; `npm run coverage:requirements` then
maps requirements to the features that cover them. Empty by default — the TodoMVC
reference example ships its features directly under `features/`.
