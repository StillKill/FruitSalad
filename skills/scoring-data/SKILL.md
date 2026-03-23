---
name: scoring-data
description: Maintain the Fruit Salad card catalog and scoring rule schema. Use when adding scoring card definitions, simplifying redundant fields, changing rule type names, expanding the card database, or preparing data for score calculation and tests.
---

# Scoring Data

## Workflow
1. Keep card data in `data/cards/scoring-cards.json`.
2. Model each card with `id`, `ruleType`, `saladFruits`, `backFruit`, and `scoring`.
3. Do not add `name`, `templateId`, or `family` unless the project requirements change.
4. Keep `scoring` limited to point structure when fruit targets can already be inferred from `ruleType` and `saladFruits`.
5. Prefer stable machine-friendly rule names such as `compare-majority`, `set-distinct-kind`, or `per-fruit-multi`.

## Guardrails
- Infer target fruit for `compare-majority`, `compare-minority`, `parity-fruit`, and `per-fruit-flat` from `saladFruits`.
- Treat `compare-wealth` and `compare-poverty` as total-fruit-count comparisons.
- Treat `threshold-per-kind` and `missing-kind` as rules over all 6 fruit kinds.
- Treat `set-distinct-kind` as a rule where required unique kinds always equal `setSize`.
- Ensure `per-fruit-multi.scoring.points.length === saladFruits.length`.
- Treat `parity-fruit` with `zeroScores = false`.

## Current status
- The repository contains a seed card catalog, not the final full deck.
- `src/data/cardCatalog.js` temporarily expands seed cards into a playable prototype pool.
- Replace the temporary expansion once the full card list is available.