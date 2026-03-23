---
name: scoring-data
description: Maintain the Fruit Salad card catalog and scoring rule schema. Use when adding scoring card definitions, simplifying redundant fields, clarifying how card front and back interact, expanding the card database, or preparing data for score calculation and tests.
---

# Scoring Data

## Workflow
1. Keep card data in `data/cards/scoring-cards.json`.
2. Model each card with `id`, `ruleType`, `saladFruits`, `backFruit`, and `scoring`.
3. Treat `backFruit` as the fruit-side payload of the same physical card, not as part of salad scoring conditions.
4. Treat `ruleType + saladFruits + scoring` as the salad-side scoring definition.
5. Keep `scoring` limited to point structure when fruit targets can already be inferred from `ruleType` and `saladFruits`.

## Guardrails
- Do not infer salad scoring targets from `backFruit`.
- Infer target fruit for `compare-majority`, `compare-minority`, `parity-fruit`, and `per-fruit-flat` from `saladFruits`.
- Treat `compare-wealth` and `compare-poverty` as total-fruit-count comparisons.
- Treat `threshold-per-kind` and `missing-kind` as rules over all 6 fruit kinds.
- Treat `set-distinct-kind` as a rule where required unique kinds always equal `setSize`.
- Ensure `per-fruit-multi.scoring.points.length === saladFruits.length`.
- Treat `parity-fruit` with `zeroScores = false`.

## Current status
- The repository contains the full 108-card catalog.
- `src/data/cardCatalog.js` currently expands from the card catalog to build prototype draw pools.
- Future scoring should operate on a player's salad cards plus separately aggregated fruit counts.