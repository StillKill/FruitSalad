import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDefaultPlayerNames,
  createMenuSettingsDraft,
  createSettingsDraft,
  defaultSessionOptions,
  relocalizePlayerNames,
  normalizeSessionOptions,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT
} from '../src/config/sessionDefaults.js';

test('buildDefaultPlayerNames creates sequential localized fallback names', () => {
  assert.deepEqual(buildDefaultPlayerNames(4, 'en'), ['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  assert.deepEqual(buildDefaultPlayerNames(2, 'ru'), ['\u0418\u0433\u0440\u043e\u043a 1', '\u0418\u0433\u0440\u043e\u043a 2']);
});

test('relocalizePlayerNames updates only untouched default names', () => {
  assert.deepEqual(
    relocalizePlayerNames(['Player 1', 'Mila', 'Player 3'], 3, 'en', 'ru'),
    ['\u0418\u0433\u0440\u043e\u043a 1', 'Mila', '\u0418\u0433\u0440\u043e\u043a 3']
  );
});

test('normalizeSessionOptions clamps player count and fills missing names', () => {
  const result = normalizeSessionOptions({
    mode: 'freestyle',
    playerCount: 9,
    playerNames: ['Ana', '  ', null, 'Drew'],
    liveScoring: true,
    seedDemoProgress: false,
    randomSeed: 77,
    locale: 'en'
  }, 'en');

  assert.equal(result.mode, 'freestyle');
  assert.equal(result.playerCount, MAX_PLAYER_COUNT);
  assert.deepEqual(result.playerNames, ['Ana', 'Player 2', 'Player 3', 'Drew', 'Player 5', 'Player 6']);
  assert.equal(result.locale, 'en');
  assert.equal(result.liveScoring, true);
  assert.equal(result.seedDemoProgress, false);
  assert.equal(result.randomSeed, 77);
});

test('normalizeSessionOptions enforces minimum player count and default options', () => {
  const result = normalizeSessionOptions({ playerCount: 1, playerNames: ['Solo'], locale: 'en' }, 'en');

  assert.equal(result.mode, 'standard');
  assert.equal(result.playerCount, MIN_PLAYER_COUNT);
  assert.deepEqual(result.playerNames, ['Solo', 'Player 2']);
  assert.equal(result.liveScoring, false);
  assert.equal(result.seedDemoProgress, false);
  assert.equal(result.randomSeed, null);
});

test('defaultSessionOptions starts with a clean two-player ru setup', () => {
  assert.equal(defaultSessionOptions.mode, 'standard');
  assert.equal(defaultSessionOptions.playerCount, 2);
  assert.deepEqual(defaultSessionOptions.playerNames, ['\u0418\u0433\u0440\u043e\u043a 1', '\u0418\u0433\u0440\u043e\u043a 2']);
  assert.equal(defaultSessionOptions.locale, 'ru');
  assert.equal(defaultSessionOptions.seedDemoProgress, false);
  assert.equal(defaultSessionOptions.randomSeed, null);
});

test('createSettingsDraft preserves session mode and relocalizes untouched default names', () => {
  const result = createSettingsDraft({
    mode: 'freestyle',
    playerCount: 4,
    playerNames: ['Player 1', 'Mila', 'Player 3', 'Noah'],
    locale: 'en',
    seedDemoProgress: false
  }, 'ru');
  assert.equal(result.mode, 'freestyle');
  assert.equal(result.playerCount, 4);
  assert.deepEqual(result.playerNames, ['\u0418\u0433\u0440\u043e\u043a 1', 'Mila', '\u0418\u0433\u0440\u043e\u043a 3', 'Noah']);
  assert.equal(result.locale, 'ru');
});

test('createMenuSettingsDraft ignores demo-session setup and falls back to default menu names', () => {
  const result = createMenuSettingsDraft({
    mode: 'freestyle',
    playerCount: 2,
    playerNames: ['Player 1 Demo', 'Player 2 Demo'],
    locale: 'en',
    seedDemoProgress: true
  }, 'en');
  assert.equal(result.mode, 'standard');
  assert.equal(result.playerCount, 2);
  assert.deepEqual(result.playerNames, ['Player 1', 'Player 2']);
  assert.equal(result.locale, 'en');
});