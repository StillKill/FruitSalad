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
