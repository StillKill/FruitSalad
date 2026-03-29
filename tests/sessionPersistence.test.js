import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSession } from '../src/core/sessionSetup.js';
import {
  buildFairSessionSnapshot,
  loadFairSessionState,
  restoreFairSessionSnapshot,
  saveFairSessionState
} from '../src/core/sessionPersistence.js';
import { selectMarketCard, togglePlayerSaladFlip } from '../src/core/sessionActions.js';

const fruits = ['kiwi', 'orange', 'apple', 'banana', 'lime', 'mango'];

function makeCard(id, backFruit) {
  return {
    id,
    backFruit,
    ruleType: 'per-fruit-flat',
    saladFruits: [backFruit],
    scoring: { pointsPerFruit: 1 }
  };
}

function makeSessionRules() {
  return {
    deckCount: 3,
    marketSlotsPerDeck: 2,
    cardsPerPlayer: 18,
    playerCardPoolByCount: {
      '2': { selectedCards: 12 }
    },
    turnRules: {
      marketPickLimit: 2,
      deckPickLimit: 1,
      confirmState: 'end_turn',
      timeLimitSeconds: 120
    }
  };
}

function makeScoringCatalog() {
  return {
    fruits,
    cards: [
      makeCard('001', 'kiwi'),
      makeCard('002', 'orange'),
      makeCard('003', 'apple'),
      makeCard('004', 'banana'),
      makeCard('005', 'lime'),
      makeCard('006', 'mango'),
      makeCard('007', 'kiwi'),
      makeCard('008', 'orange'),
      makeCard('009', 'apple'),
      makeCard('010', 'banana'),
      makeCard('011', 'lime'),
      makeCard('012', 'mango')
    ]
  };
}

function makeSession(seedDemoProgress = false) {
  return buildSession({
    playerCount: 2,
    playerNames: ['A', 'B'],
    locale: 'en',
    liveScoring: false,
    seedDemoProgress,
    randomSeed: 11
  }, makeSessionRules(), makeScoringCatalog());
}

function makeStorage() {
  const items = new Map();
  return {
    getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    setItem(key, value) {
      items.set(key, String(value));
    },
    removeItem(key) {
      items.delete(key);
    }
  };
}

test('buildFairSessionSnapshot skips demo sessions', () => {
  const demoSession = makeSession(true);
  const snapshot = buildFairSessionSnapshot({
    locale: 'en',
    lastFairSessionOptions: null,
    session: demoSession
  }, 1000);

  assert.equal(snapshot, null);
});

test('restoreFairSessionSnapshot rebuilds fair session state and adjusts the timer from save time', () => {
  const session = makeSession(false);
  const savedAt = 1000;

  selectMarketCard(session, session.decks[0].id, session.decks[0].market[0].id);
  const ownedSalad = session.decks[0].cards.shift();
  session.players[0].salads.push(ownedSalad);
  togglePlayerSaladFlip(session, ownedSalad.runtimeId);
  session.viewedPlayerIndex = 1;
  session.turnTimer.deadlineAt = savedAt + 45000;
  session.turnTimer.remainingMs = 45000;

  const snapshot = buildFairSessionSnapshot({
    locale: 'en',
    lastFairSessionOptions: { playerCount: 2, playerNames: ['A', 'B'], locale: 'en' },
    session
  }, savedAt);
  const restored = restoreFairSessionSnapshot(snapshot, makeSessionRules(), makeScoringCatalog(), savedAt + 5000);

  assert.ok(restored);
  assert.equal(restored.locale, 'en');
  assert.equal(restored.session.stateMachine.state, session.stateMachine.state);
  assert.equal(restored.session.pendingSelection.length, 1);
  assert.equal(restored.session.pendingFlip.runtimeId, ownedSalad.runtimeId);
  assert.equal(restored.session.viewedPlayerIndex, 1);
  assert.equal(restored.session.turnTimer.remainingMs, 40000);
  assert.equal(restored.session.turnTimer.deadlineAt, savedAt + 5000 + 40000);
});

test('saveFairSessionState and loadFairSessionState round-trip the last fair session options', () => {
  const session = makeSession(false);
  const storage = makeStorage();
  const lastFairSessionOptions = {
    playerCount: 2,
    playerNames: ['A', 'B'],
    locale: 'en',
    liveScoring: false,
    seedDemoProgress: false,
    randomSeed: 11
  };

  session.turnTimer.deadlineAt = 25000;
  session.turnTimer.remainingMs = 20000;

  assert.equal(saveFairSessionState({
    locale: 'en',
    lastFairSessionOptions,
    session
  }, storage, 5000), true);

  const restored = loadFairSessionState(makeSessionRules(), makeScoringCatalog(), storage, 9000);

  assert.ok(restored);
  assert.deepEqual(restored.lastFairSessionOptions.playerNames, ['A', 'B']);
  assert.equal(restored.session.options.randomSeed, 11);
  assert.equal(restored.session.turnTimer.remainingMs, 16000);
});
