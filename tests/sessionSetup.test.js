import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSession, refillDeckMarket } from '../src/core/sessionSetup.js';

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

function makeSeededCatalog() {
  const seedIds = ['000', '030', '054', '066', '067', '068', '069', '071', '102', '103', '104', '106'];
  return {
    fruits,
    cards: seedIds.map((id, index) => makeCard(id, fruits[index % fruits.length]))
  };
}

test('buildSession fills market by flipping top salad cards after seeded shuffle', () => {
  const scoringCatalog = {
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
      makeCard('009', 'apple')
    ]
  };
  const sessionRules = {
    deckCount: 3,
    marketSlotsPerDeck: 2,
    cardsPerPlayer: 18,
    playerCardPoolByCount: {
      '2': { selectedCards: 9 }
    }
  };

  const firstSession = buildSession({ playerCount: 2, playerNames: ['A', 'B'], randomSeed: 17 }, sessionRules, scoringCatalog);
  const secondSession = buildSession({ playerCount: 2, playerNames: ['A', 'B'], randomSeed: 17 }, sessionRules, scoringCatalog);

  assert.deepEqual(
    firstSession.decks.map((deck) => deck.market.map((card) => card.fruit)),
    secondSession.decks.map((deck) => deck.market.map((card) => card.fruit))
  );
  assert.equal(firstSession.decks.reduce((sum, deck) => sum + deck.market.length + deck.cards.length, 0), 9);
  assert.ok(firstSession.decks.every((deck) => deck.market.length === 2));
  assert.ok(new Set(firstSession.decks.flatMap((deck) => deck.market.map((card) => card.sourceRuntimeId))).size === 6);
});

test('buildSession starts with empty player progress unless demo seeding is enabled', () => {
  const scoringCatalog = makeSeededCatalog();
  const sessionRules = {
    deckCount: 3,
    marketSlotsPerDeck: 2,
    cardsPerPlayer: 18,
    playerCardPoolByCount: {
      '2': { selectedCards: 12 }
    }
  };

  const cleanSession = buildSession({ playerCount: 2, playerNames: ['A', 'B'], randomSeed: 22 }, sessionRules, scoringCatalog);

  assert.deepEqual(cleanSession.players[0].fruitCounts, {
    kiwi: 0,
    orange: 0,
    apple: 0,
    banana: 0,
    lime: 0,
    mango: 0
  });
  assert.equal(cleanSession.players[0].salads.length, 0);
  assert.equal(cleanSession.players[1].salads.length, 0);

  const seededSession = buildSession({ playerCount: 2, playerNames: ['A', 'B'], seedDemoProgress: true, randomSeed: 22 }, sessionRules, scoringCatalog);

  assert.notDeepEqual(seededSession.players[0].fruitCounts, cleanSession.players[0].fruitCounts);
  assert.ok(seededSession.players[0].salads.length > 0);
  assert.ok(seededSession.players[1].salads.length > 0);
  assert.ok(seededSession.logs.includes('Prototype scoring preview seeded'));
});

test('refillDeckMarket only flips enough cards to fill empty slots', () => {
  const logs = [];
  const deck = {
    id: 'deck-1',
    market: [{ kind: 'fruit', fruit: 'apple' }],
    cards: [makeCard('010', 'banana'), makeCard('011', 'lime')]
  };

  refillDeckMarket(deck, 2, logs);

  assert.deepEqual(deck.market.map((card) => card.fruit), ['apple', 'banana']);
  assert.equal(deck.cards.length, 1);
  assert.equal(deck.cards[0].backFruit, 'lime');
  assert.match(logs[0], /banana/);
});
