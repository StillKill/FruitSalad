---
name: board-layout
description: Design and maintain the Phaser board composition for Fruit Salad. Use when work touches screen zoning, deck and market placement, player area layout, visual hierarchy, or adapting the layout reference image into concrete UI coordinates.
---

# Board Layout

## Workflow
1. Read `project.md` for the latest screen requirements.
2. Use `assets/layout/fruit-salad-layout.png` as the baseline composition, but allow pragmatic adjustments for playability.
3. Keep the left side focused on decks and market, and the right side focused on the active player, controls, tabs, and debug information.
4. Store reusable numbers in `src/config/layoutConfig.js`.
5. Prefer layout helpers in `src/ui/boardLayout.js` instead of hardcoding geometry inside scenes.

## Guardrails
- Preserve a readable split between market space and player space.
- Keep room for 3 deck slots and 6 market slots at all times.
- Reserve a stable region for debug output so logs do not overlap gameplay.
- Favor prototype-friendly primitives first; replace them with final art later.