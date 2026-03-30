---
name: ui-shell
description: Build and refine the Fruit Salad interface shell for Phaser scenes. Use when work involves settings UI, turn controls, player tabs, score panels, hint text, popups, or debug overlay presentation.
---

# UI Shell

## Workflow
1. Read `project.md` for current UI requirements and planned widgets.
2. Keep structural UI logic in scene helpers and shared UI modules under `src/ui/`.
3. When the work touches `GameScene`, route by helper first instead of opening the full scene shell:
   - `src/scenes/gameScene/settingsOverlayMethods.js` for settings overlay, locale toggle, save banner, and rules/help UI.
   - `src/scenes/gameScene/boardLayoutMethods.js` for desktop controls, tabs, score panels, and end-game popup layout.
   - `src/scenes/gameScene/mobileLayoutMethods.js` for mobile landscape controls and gameplay views.
   - `src/scenes/gameScene/sharedUiMethods.js` for shared buttons, scrollbars, click zones, and interaction visuals.
3. Use clear placeholder components before final art arrives.
4. Keep labels and debug text concise enough to fit the 1600x900 prototype layout.

## Required areas
- Controls panel with `Confirm`, `Reset`, and hint text.
- Player tabs and scoreboard strip.
- Active player summary with fruit counters and salad card area.
- Debug overlay with state, turn, and deck information.

## Guardrails
- Make active player emphasis obvious.
- Do not let control states depend on hidden rules; expose them through text or disabled visuals later.
- Keep UI additions compatible with hot-seat play.
