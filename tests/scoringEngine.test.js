import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTableSnapshot, scorePlayerTotal, scoreSaladCard } from '../src/core/scoring/scoringEngine.js';

const fruits = ['kiwi', 'orange', 'apple', 'banana', 'lime', 'mango'];

function makeCounts(overrides = {}) {
  return Object.assign(
    {
      kiwi: 0,
      orange: 0,
      apple: 0,
      banana: 0,
      lime: 0,
      mango: 0
    },
    overrides
  );
}

test('parity-fruit scores zero when target fruit count is zero', () => {
  const card = {
    id: '068',
    ruleType: 'parity-fruit',
    saladFruits: ['mango'],
    scoring: { evenPoints: 7, oddPoints: 3, zeroScores: false }
  };

  const result = scoreSaladCard(card, makeCounts(), [], fruits);
  assert.equal(result.points, 0);
});

test('parity-fruit scores even and odd correctly when count is non-zero', () => {
  const card = {
    id: '080',
    ruleType: 'parity-fruit',
    saladFruits: ['apple'],
    scoring: { evenPoints: 7, oddPoints: 3, zeroScores: false }
  };

  assert.equal(scoreSaladCard(card, makeCounts({ apple: 4 }), [], fruits).points, 7);
  assert.equal(scoreSaladCard(card, makeCounts({ apple: 3 }), [], fruits).points, 3);
});

test('threshold-per-kind scores all qualifying fruit types', () => {
  const card = {
    id: '104',
    ruleType: 'threshold-per-kind',
    saladFruits: fruits,
    scoring: { threshold: 2, pointsPerQualifiedKind: 3 }
  };

  const result = scoreSaladCard(card, makeCounts({ kiwi: 2, apple: 3, lime: 2, mango: 1 }), [], fruits);
  assert.equal(result.points, 9);
});

test('missing-kind scores each missing fruit type', () => {
  const card = {
    id: '106',
    ruleType: 'missing-kind',
    saladFruits: fruits,
    scoring: { pointsPerMissingKind: 5 }
  };

  const result = scoreSaladCard(card, makeCounts({ kiwi: 1, banana: 4 }), [], fruits);
  assert.equal(result.points, 20);
});

test('set-same-kind scores completed sets of one fruit', () => {
  const card = {
    id: '099',
    ruleType: 'set-same-kind',
    saladFruits: ['kiwi'],
    scoring: { setSize: 2, pointsPerSet: 5 }
  };

  const result = scoreSaladCard(card, makeCounts({ kiwi: 5 }), [], fruits);
  assert.equal(result.points, 10);
});

test('set-distinct-kind scores completed distinct sets', () => {
  const card = {
    id: '107',
    ruleType: 'set-distinct-kind',
    saladFruits: fruits,
    scoring: { setSize: 6, pointsPerSet: 12 }
  };

  const result = scoreSaladCard(card, makeCounts({ kiwi: 2, orange: 2, apple: 1, banana: 3, lime: 4, mango: 1 }), [], fruits);
  assert.equal(result.points, 12);
});

test('per-fruit-flat scores one fruit type only', () => {
  const card = {
    id: '101',
    ruleType: 'per-fruit-flat',
    saladFruits: ['kiwi'],
    scoring: { pointsPerFruit: 2 }
  };

  const result = scoreSaladCard(card, makeCounts({ kiwi: 4, apple: 10 }), [], fruits);
  assert.equal(result.points, 8);
});

test('per-fruit-multi scores each listed fruit with matching coefficient', () => {
  const card = {
    id: '019',
    ruleType: 'per-fruit-multi',
    saladFruits: ['orange', 'lime', 'kiwi'],
    scoring: { points: [2, 2, -4] }
  };

  const result = scoreSaladCard(card, makeCounts({ orange: 3, lime: 2, kiwi: 1 }), [], fruits);
  assert.equal(result.points, 6);
});

test('compare-majority awards points only to a unique leader', () => {
  const card = {
    id: '096',
    ruleType: 'compare-majority',
    saladFruits: ['kiwi'],
    scoring: { points: 10 }
  };

  const players = [
    { id: 'p1', name: 'A', fruitCounts: makeCounts({ kiwi: 5 }) },
    { id: 'p2', name: 'B', fruitCounts: makeCounts({ kiwi: 3 }) },
    { id: 'p3', name: 'C', fruitCounts: makeCounts({ kiwi: 4 }) }
  ];

  const table = buildTableSnapshot(players);
  assert.equal(scoreSaladCard(card, players[0].fruitCounts, table, fruits).points, 10);
  assert.equal(scoreSaladCard(card, players[1].fruitCounts, table, fruits).points, 0);
});

test('compare-majority gives zero on tie for first', () => {
  const card = {
    id: '096',
    ruleType: 'compare-majority',
    saladFruits: ['kiwi'],
    scoring: { points: 10 }
  };

  const players = [
    { id: 'p1', name: 'A', fruitCounts: makeCounts({ kiwi: 5 }) },
    { id: 'p2', name: 'B', fruitCounts: makeCounts({ kiwi: 5 }) },
    { id: 'p3', name: 'C', fruitCounts: makeCounts({ kiwi: 1 }) }
  ];

  const table = buildTableSnapshot(players);
  assert.equal(scoreSaladCard(card, players[0].fruitCounts, table, fruits).points, 0);
  assert.equal(scoreSaladCard(card, players[1].fruitCounts, table, fruits).points, 0);
});

test('compare-poverty uses total fruit counts across all kinds', () => {
  const card = {
    id: '103',
    ruleType: 'compare-poverty',
    saladFruits: fruits,
    scoring: { points: 7 }
  };

  const players = [
    { id: 'p1', name: 'A', fruitCounts: makeCounts({ kiwi: 1, orange: 1 }) },
    { id: 'p2', name: 'B', fruitCounts: makeCounts({ kiwi: 4 }) },
    { id: 'p3', name: 'C', fruitCounts: makeCounts({ banana: 2, lime: 2 }) }
  ];

  const table = buildTableSnapshot(players);
  assert.equal(scoreSaladCard(card, players[0].fruitCounts, table, fruits).points, 7);
});

test('scorePlayerTotal aggregates multiple salad cards with breakdowns', () => {
  const saladCards = [
    {
      id: '071',
      ruleType: 'per-fruit-flat',
      saladFruits: ['mango'],
      scoring: { pointsPerFruit: 2 }
    },
    {
      id: '106',
      ruleType: 'missing-kind',
      saladFruits: fruits,
      scoring: { pointsPerMissingKind: 5 }
    }
  ];

  const result = scorePlayerTotal(saladCards, makeCounts({ mango: 3, kiwi: 1 }), [], fruits);
  assert.equal(result.totalPoints, 26);
  assert.equal(result.cardScores.length, 2);
});
