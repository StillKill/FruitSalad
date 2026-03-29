import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEndGameResults } from '../src/core/endGameResults.js';

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

test('buildEndGameResults ranks players by total score and keeps tied placements', () => {
  const players = [
    {
      id: 'p1',
      name: 'Ava',
      fruitCounts: makeCounts({ mango: 2 }),
      salads: [
        { id: '071', ruleType: 'per-fruit-flat', saladFruits: ['mango'], scoring: { pointsPerFruit: 2 } }
      ]
    },
    {
      id: 'p2',
      name: 'Ben',
      fruitCounts: makeCounts({ kiwi: 3 }),
      salads: [
        { id: '101', ruleType: 'per-fruit-flat', saladFruits: ['kiwi'], scoring: { pointsPerFruit: 3 } }
      ]
    },
    {
      id: 'p3',
      name: 'Cara',
      fruitCounts: makeCounts({ orange: 3 }),
      salads: [
        { id: '021', ruleType: 'per-fruit-flat', saladFruits: ['orange'], scoring: { pointsPerFruit: 3 } }
      ]
    }
  ];

  const results = buildEndGameResults(players, fruits);

  assert.equal(results.winner?.playerName, 'Ben');
  assert.deepEqual(
    results.standings.map((entry) => ({ name: entry.playerName, points: entry.totalPoints, placement: entry.placement })),
    [
      { name: 'Ben', points: 9, placement: 1 },
      { name: 'Cara', points: 9, placement: 1 },
      { name: 'Ava', points: 4, placement: 3 }
    ]
  );
});

test('buildEndGameResults freezes cloned player state for the popup', () => {
  const players = [
    {
      id: 'p1',
      name: 'Ava',
      fruitCounts: makeCounts({ mango: 3 }),
      salads: [
        { id: '071', ruleType: 'per-fruit-flat', saladFruits: ['mango'], scoring: { pointsPerFruit: 2 } }
      ]
    }
  ];

  const results = buildEndGameResults(players, fruits);
  players[0].fruitCounts.mango = 99;
  players[0].salads.length = 0;

  assert.equal(results.playerStates[0].fruitCounts.mango, 3);
  assert.equal(results.playerStates[0].salads.length, 1);
  assert.equal(results.standings[0].cardScores[0].cardSnapshot.id, '071');
  assert.equal(results.standings[0].cardScores[0].cardSnapshot.scoring.pointsPerFruit, 2);
});
