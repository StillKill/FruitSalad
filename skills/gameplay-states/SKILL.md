---
name: gameplay-states
description: Implement and evolve the Fruit Salad gameplay flow. Use when adding or changing settings, setup, turn, end_turn, refresh, or end_game state behavior, including state transitions and turn rules.
---

# Gameplay States

## Core flow
1. `settings`
2. `setup`
3. `turn`
4. `end_turn`
5. `refresh`
6. `end_game`

## Workflow
1. Keep state names aligned with `project.md`.
2. Centralize transition logic in `src/core/stateMachine.js` or adjacent session modules.
3. Treat setup as deterministic from session config plus card data.
4. Log important transitions for the debug overlay.

## Guardrails
- A player may take either 2 market cards or 1 deck card.
- `Confirm` belongs to `end_turn`.
- `refresh` owns market refill and empty-deck recovery.
- `end_game` starts only when no deck can continue play.