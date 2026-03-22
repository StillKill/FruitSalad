---
name: scoring-data
description: Maintain the Fruit Salad card catalog and scoring rule schema. Use when adding scoring card definitions, naming rule types, expanding the card database, or preparing data for score calculation and tests.
---

# Scoring Data

## Workflow
1. Keep card data in `data/cards/scoring-cards.json`.
2. Model each card with `id or templateId`, `name`, `ruleType`, `saladFruits`, `backFruit`, and `scoring`.
3. Prefer stable machine-friendly rule names such as `compare-majority` or `set-rainbow-six`.
4. Separate data concerns from rendering concerns.

## Current status
- The repository contains a seed template catalog, not the final 108-card list.
- `src/data/cardCatalog.js` temporarily expands templates into a playable prototype pool.
- Replace template expansion once the full deck list is available.

## Guardrails
- Preserve explicit scoring payloads so the future scoring engine can stay data-driven.
- Keep negative scoring values in data rather than hardcoding them.
- When uncertain, update `project.md` with rule assumptions.