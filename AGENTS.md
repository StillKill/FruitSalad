# AGENTS.md

## Repository Workflow
- Before starting substantial work, read `project.md` for the current product context, goals, and plan.
- Use `skills/` as task-routing context: pick the relevant skill files before changing UI, gameplay flow, scoring data, layout, or session config.
- Keep comments and documentation inside project files in English; communicate with the user in Russian.
- Treat project text files (`.md`, `.js`, `.json`, `.html`, `.css`) as UTF-8 without BOM and keep LF line endings.
- Keep the repository-local git setting `core.autocrlf=false`; on Windows, enabling automatic CRLF conversion makes `apply_patch` and other patch-based edits fail more often.
- When editing files that contain Cyrillic or other non-ASCII text, do not rewrite them through blind `Get-Content` / `Set-Content` flows; use `apply_patch` or explicit UTF-8 read/write APIs.
- After editing any non-ASCII file, verify the diff still shows readable text. If mojibake appears, restore the file from git and redo the edit before continuing.
- Prefer `apply_patch` for file edits. If creating a new file via patch fails, create it with PowerShell.
- If patch application starts failing unexpectedly, run `npm run text:check` first and then `npm run text:fix` to restore UTF-8/LF normalization before retrying the edit.
- If `apply_patch` still rejects after encoding checks, refresh the exact current file contents before retrying, split the edit into smaller hunks, and avoid patching the same file from stale context after any shell-based rewrite.
- After each completed logical task, run appropriate verification: tests, targeted checks, or manual validation if automated coverage is insufficient.
- Record each completed logical task in `changes.md` with a short note about what changed. Do not add separate `Verification:` entries to the log.
- Commit each completed logical task as a separate git commit.
- If a task changes architecture, system behavior, workflow, project structure, or other long-lived project assumptions, update `project.md` to keep the project description in sync.
- Add useful deferred follow-up work to the `План` section at the end of `project.md`.

## Project Files
- `project.md` is the project specification and roadmap, not the main operational instruction file.
- `changes.md` is the running log of completed work.
