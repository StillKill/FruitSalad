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

test('buildSession fills market by flipping the top salad cards into fruit cards', () => {
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
  const options = {
    playerCount: 2,
    playerNames: ['A', 'B'],
    liveScoring: false
  };

  const session = buildSession(options, sessionRules, scoringCatalog);

  assert.deepEqual(session.decks[0].market.map((card) => card.fruit), ['kiwi', 'banana']);
  assert.deepEqual(session.decks[1].market.map((card) => card.fruit), ['orange', 'lime']);
  assert.deepEqual(session.decks[2].market.map((card) => card.fruit), ['apple', 'mango']);
  assert.equal(session.decks[0].cards[0].backFruit, 'kiwi');
  assert.equal(session.decks[1].cards[0].backFruit, 'orange');
  assert.equal(session.decks[2].cards[0].backFruit, 'apple');
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

  const cleanSession = buildSession({ playerCount: 2, playerNames: ['A', 'B'] }, sessionRules, scoringCatalog);

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

  const seededSession = buildSession({ playerCount: 2, playerNames: ['A', 'B'], seedDemoProgress: true }, sessionRules, scoringCatalog);

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
