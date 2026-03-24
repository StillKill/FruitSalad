# Changes Log

## 2026-03-24
- Updated `project.md`: restored persistent agent rules in a more explicit operational format.
- Added `changes.md` to the documented project structure and aligned deferred work with the final `Plan` section in `project.md`.
- Verification: re-read the updated markdown structure and checked that the new workflow rules are consistent with the current project layout.
- Refined the persistent rules in `project.md`: removed mandatory approval for `project.md` and `skills` edits, and compressed the wording without losing the workflow intent.
- Verification: reviewed the final rules block and confirmed that commit, validation, language, and planning requirements are still explicit.
- Added a PowerShell fallback rule to `project.md` for creating new files when `apply_patch` rejects them.
- Implemented fruit-card rendering and salad-card overlays with fruit icons, and changed deck setup so market slots are filled by flipping the top salad cards into their `backFruit` side.
- Added session tests for market refill and a shared test runner in `package.json`.
- Verification: `node tests/run-tests.js`; `node --check src/scenes/GameScene.js`; `node --check src/ui/cardRenderer.js`; `node --check src/core/sessionSetup.js`.
- Implemented interactive turn flow: market cards and deck tops are clickable, selections are highlighted, `Confirm` and `Reset` change state, and turns advance through `turn -> end_turn -> refresh -> turn/end_game`.
- Added session action tests for selection, confirm, reset, refill, and end-game transition; updated debug overlay to show selection and last action.
- Verification: `node tests/run-tests.js`; `node --check src/scenes/GameScene.js`; `node --check src/core/sessionActions.js`; `node --check src/ui/debugOverlay.js`; `node --check src/ui/boardLayout.js`.
