import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDefaultPlayerNames,
  defaultSessionOptions,
  normalizeSessionOptions,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT
} from '../src/config/sessionDefaults.js';

test('buildDefaultPlayerNames creates sequential fallback names', () => {
  assert.deepEqual(buildDefaultPlayerNames(4), ['Player 1', 'Player 2', 'Player 3', 'Player 4']);
});

test('normalizeSessionOptions clamps player count and fills missing names', () => {
  const result = normalizeSessionOptions({
    playerCount: 9,
    playerNames: ['Ana', '  ', null, 'Drew'],
    liveScoring: true,
    seedDemoProgress: false
  });

  assert.equal(result.playerCount, MAX_PLAYER_COUNT);
  assert.deepEqual(result.playerNames, ['Ana', 'Player 2', 'Player 3', 'Drew', 'Player 5', 'Player 6']);
  assert.equal(result.liveScoring, true);
  assert.equal(result.seedDemoProgress, false);
});

test('normalizeSessionOptions enforces minimum player count and default options', () => {
  const result = normalizeSessionOptions({ playerCount: 1, playerNames: ['Solo'] });

  assert.equal(result.playerCount, MIN_PLAYER_COUNT);
  assert.deepEqual(result.playerNames, ['Solo', 'Player 2']);
  assert.equal(result.liveScoring, false);
  assert.equal(result.seedDemoProgress, false);
});

test('defaultSessionOptions starts with a clean two-player setup', () => {
  assert.equal(defaultSessionOptions.playerCount, 2);
  assert.deepEqual(defaultSessionOptions.playerNames, ['Player 1', 'Player 2']);
  assert.equal(defaultSessionOptions.seedDemoProgress, false);
});
