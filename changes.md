# Changes Log

## 2026-03-29
- Added core UI sound hooks: game_start now plays when a session begins, round_start on each new turn after the first, button_click on button presses, and tab_select when switching the viewed player tab.
- Improved control-panel readability and state feedback: the timer now uses a high-contrast badge, turns red and blinks at low time, settings panels are cleaned up when gameplay starts, and `Flip Mode` now has a clearly distinct active style.
- Refined the turn-timer UX: moved the countdown into its own control-panel row, removed the duplicated Leader/Timer/Flip summary from the controls, and switched timer ticking to an absolute deadline so it no longer stalls when the scene redraw is heavy.
- Added a per-turn 2-minute timer from session rules, rendered the live countdown in the controls panel, and exposed the remaining time in the debug overlay.
- Added timeout handling so a ready selection auto-confirms at 0:00, while incomplete picks are cleared and the turn is skipped; covered both flows with session tests.
- Normalized the repo text-file workflow to reduce rejected patches on Windows: set the local clone back to LF-friendly git behavior, added `npm run text:check` / `npm run text:fix`, and documented `core.autocrlf=false` plus the recovery flow in the repo instructions.
- Added a manual `RU/EN` language switch to the settings screen and in-game controls, synchronized default player names when the locale changes, and exposed the active language in the debug overlay to make mixed-locale state easy to spot.
- Localized the playable UI, turn hints, debug labels, fruit counters, and end-game copy for `ru`/`en`; English fruit cards now reuse the same bilingual art by flipping the existing fruit image on both axes instead of duplicating assets.
- Reworked the end_game overlay into a visual card-by-card breakdown with mini salad cards, per-card point pills, and stronger summary metrics for the viewed player.
- Documented a repo-wide UTF-8/LF policy in AGENTS.md, project.md, .gitattributes, and .editorconfig to prevent recurring mojibake when editing Cyrillic text.
- Updated `project.md` planning: removed the completed `end_game` execution checklist, rewrote the End Game model section into a current-state spec, and added new follow-up items for spacing, end-game breakdown visuals, RU language, turn timer, design, deploy/online session, animations, sounds, and local scoreboard.
- Verification: reviewed the updated `project.md` sections for consistency with the current codebase and existing roadmap.
- Exposed a browser-side debug bridge as `window.__FRUIT_SALAD_DEBUG__` so the active Phaser scene, live session, seed, logs, and compact deck snapshots can be inspected from DevTools during a running match.
- Cleaned up `changes.md` formatting and updated `AGENTS.md` plus `project.md` so the log stays a short record of completed work.

## 2026-03-28
- Implemented the `end_game` results overlay with a frozen final snapshot, winner banner, placements, clickable standings, and per-player scoring breakdown with scrollable details.
- Added a dedicated end-game results helper plus tests for ranking, tied placements, and snapshot freezing before the popup is rendered.
- Simplified the player-area flip control to a single `Flip Mode` toggle and removed the extra helper caption that appeared after activation.
- Reworked player-area salad flipping UX into an explicit flip mode instead of making every salad card look active at once; the selected card highlight now stays clipped inside the scroll viewport.
- Fixed demo-seeded salads to receive unique `runtimeId` values so player-area flips target the chosen card instead of falling back to the first seeded salad.
- Added an optional once-per-turn pending flip action: one salad card can be queued to turn into its `backFruit` without affecting Confirm availability, including the selected top deck card or a salad already in the active player's area.
- Updated the session UI with pending-flip status, clickable owned salads, and a deck-side flip button for selected top cards; added turn-action tests that cover both flip paths and Reset behaviour.
- Added empty-deck recovery that restores the exhausted deck from the bottom half of the thickest remaining deck before market refill, matching the original Point Salad rule with deterministic tie-breaking.
- Covered deck redistribution with setup-level tests for thickest-deck selection, stable tie resolution, and restored market refill.
- Changed `per-fruit-multi` card rendering so the fruit list is shown by descending point value on the card, while gameplay data and scoring order remain unchanged.
- Added a renderer-level regression test for the sorted display order, including stable ordering for equal point values.
- Made player tabs interactive so `viewedPlayerIndex` now switches the right-side player panel during a turn, while the active player remains separately highlighted.
- Updated session coverage and project notes for the viewed-player flow, including the turn-advance reset back to the new active player.

## 2026-03-24
- Updated `AGENTS.md` to require syncing `project.md` whenever a task changes architecture, long-lived behavior, workflow, or project structure.
- Fixed session setup shuffling: the selected card pool is now shuffled by seed before being split into decks, so the initial market no longer mirrors the catalog order.
- Stored the runtime seed in session options/logs and covered the setup with deterministic seed-based tests on both fixture decks and the full scoring catalog.
- Added a real `settings` launcher flow in the Phaser scene: player count `2-6`, editable player names, and a fair-game start path that builds a clean session instead of auto-starting the prototype match.
- Added a parallel demo launch mode from the same screen so UI/scoring preview can still start with seeded prototype progress without blocking honest playtesting.
- Added session option normalization tests and full-catalog seeded integration tests so setup and turn flow are exercised against shuffled real card data.
- Added root `AGENTS.md` and moved repository operational workflow rules there so `project.md` stays focused on project specification and planning.
- Updated `project.md`: restored persistent agent rules in a more explicit operational format.
- Added `changes.md` to the documented project structure and aligned deferred work with the final `Plan` section in `project.md`.
- Refined the persistent rules in `project.md`: removed mandatory approval for `project.md` and `skills` edits, and compressed the wording without losing the workflow intent.
- Added a PowerShell fallback rule to `project.md` for creating new files when `apply_patch` rejects them.
- Implemented fruit-card rendering and salad-card overlays with fruit icons, and changed deck setup so market slots are filled by flipping the top salad cards into their `backFruit` side.
- Added session tests for market refill and a shared test runner in `package.json`.
- Implemented interactive turn flow: market cards and deck tops are clickable, selections are highlighted, `Confirm` and `Reset` change state, and turns advance through `turn -> end_turn -> refresh -> turn/end_game`.
- Added session action tests for selection, confirm, reset, refill, and end-game transition; updated debug overlay to show selection and last action.
- Removed the reference layout image from the scene, compacted debug overlay lines to stay inside the frame, and changed the player salad area to render all current salads in a compact grid.
- Added a generated fruit-basket icon, switched all-6-fruit scoring cards to use it, made salad cards larger again, added wheel-scrollable salad/debug panels, and changed `per-fruit-multi` cards to a vertical icon-plus-points layout.
- Tuned panel spacing and typography so the title, player tabs, market header, and control hints stay inside their frames; updated prototype seeding so Player 2 now shows one sample of each salad rule type for visual QA.
- Lowered short vertical icon lists on salad cards and changed `per-fruit-flat` to an `icon / points` presentation.

- Fixed the first-start locale mismatch so default player names now initialize in the active UI language instead of inheriting Russian names from the base session defaults.
- Reworked settings and in-session control layout to measure localized text flow, widen player-name fields, and reserve a dedicated language-toggle zone that no longer overlaps Confirm/Reset.

- Tightened the settings form spacing so the 6-player localized name grid stays clear of the start buttons.
- Localized market deck headers as Колода N / Deck N instead of exposing runtime deck ids in the UI.
- Shortened dense salad-card labels and slightly rebalanced card text/icon placement so localized rule text fits more reliably in the center oval.
