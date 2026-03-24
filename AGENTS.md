# AGENTS.md

## Repository Workflow
- Before starting substantial work, read `project.md` for the current product context, goals, and plan.
- Use `skills/` as task-routing context: pick the relevant skill files before changing UI, gameplay flow, scoring data, layout, or session config.
- Keep comments and documentation inside project files in English; communicate with the user in Russian.
- Prefer `apply_patch` for file edits. If creating a new file via patch fails, create it with PowerShell.
- After each completed logical task, run appropriate verification: tests, targeted checks, or manual validation if automated coverage is insufficient.
- Record each completed logical task in `changes.md` with a short note about what changed and how it was verified.
- Commit each completed logical task as a separate git commit.
- If a task changes architecture, system behavior, workflow, project structure, or other long-lived project assumptions, update `project.md` to keep the project description in sync.
- Add useful deferred follow-up work to the `План` section at the end of `project.md`.

## Project Files
- `project.md` is the project specification and roadmap, not the main operational instruction file.
- `changes.md` is the running log of completed work and verification.
