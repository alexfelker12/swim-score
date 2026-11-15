## Agent skills

### Issue tracker

Issues und Specs liegen als GitHub Issues dieses Repos (gh CLI, Repo aus `git remote`). See `docs/agents/issue-tracker.md`.

### Triage labels

Standard-Labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: ein `CONTEXT.md` und `docs/adr/` im Repo-Root. See `docs/agents/domain.md`.

### Workflow

Ein Ticket = ein Branch = ein PR; Agents committen und pushen nicht. See `docs/agents/workflow.md`.

### UI

UI aus shadcn/ui auf Base UI (`src/components/ui`), Looks als Varianten, an Aufrufstellen nur Layout-Tailwind; Datum und Auswahl nativ. See `docs/adr/0009-ui-from-shadcn-on-base-ui.md` und `docs/design/README.md` › Bausteine.
