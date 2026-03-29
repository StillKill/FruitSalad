# AGENTS.md

## Repository Workflow
- Before starting substantial work, read `project.md` for the current product context, goals, and plan.
- Use `skills/` as task-routing context: pick the relevant skill files before changing UI, gameplay flow, scoring data, layout, or session config.
- Keep comments and documentation inside project files in English; communicate with the user in Russian.
- Treat project text files (`.md`, `.js`, `.json`, `.html`, `.css`) as UTF-8 without BOM and keep LF line endings.
- When editing files that contain Cyrillic or other non-ASCII text, do not rewrite them through blind `Get-Content` / `Set-Content` flows; use `apply_patch` or explicit UTF-8 read/write APIs.
- After editing any non-ASCII file, verify the diff still shows readable text. If mojibake appears, restore the file from git and redo the edit before continuing.
- Prefer `apply_patch` for file edits. If creating a new file via patch fails, create it with PowerShell.
- After each completed logical task, run appropriate verification: tests, targeted checks, or manual validation if automated coverage is insufficient.
- Record each completed logical task in `changes.md` with a short note about what changed. Do not add separate `Verification:` entries to the log.
- Commit each completed logical task as a separate git commit.
- If a task changes architecture, system behavior, workflow, project structure, or other long-lived project assumptions, update `project.md` to keep the project description in sync.
- Add useful deferred follow-up work to the `План` section at the end of `project.md`.

## Project Files
- `project.md` is the project specification and roadmap, not the main operational instruction file.
- `changes.md` is the running log of completed work.
