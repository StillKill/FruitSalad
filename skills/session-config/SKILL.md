---
name: session-config
description: Manage setup configuration for Fruit Salad sessions. Use when changing player-count rules, deck sizing, default options, setup constraints, prototype session generation, or other match configuration data.
---

# Session Config

## Workflow
1. Keep static setup rules in `data/sessions/session-rules.json`.
2. Keep default runtime options in `src/config/sessionDefaults.js`.
3. Build sessions through `src/core/sessionSetup.js`.
4. Prefer data-driven player-count behavior over scattered conditionals.

## Current assumptions
- Prototype deck size is `18 * playerCount`.
- Three decks are created every game.
- Two market cards sit under each deck.
- Full balancing may change after the final card list is provided.

## Guardrails
- Support 2-6 players.
- Preserve deterministic setup for the same inputs.
- Log setup outcomes important to debugging.