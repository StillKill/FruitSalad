import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSession, rebalanceEmptyDeck, refillDeckMarket, refillSessionMarkets } from '../src/core/sessionSetup.js';

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

  const firstSession = buildSession({ mode: 'standard', playerCount: 2, playerNames: ['A', 'B'], randomSeed: 17 }, sessionRules, scoringCatalog);
  const secondSession = buildSession({ mode: 'standard', playerCount: 2, playerNames: ['A', 'B'], randomSeed: 17 }, sessionRules, scoringCatalog);

  assert.deepEqual(
    firstSession.decks.map((deck) => deck.market.map((card) => card.fruit)),
    secondSession.decks.map((deck) => deck.market.map((card) => card.fruit))
  );
  assert.equal(firstSession.decks.reduce((sum, deck) => sum + deck.market.length + deck.cards.length, 0), 9);
  assert.ok(firstSession.decks.every((deck) => deck.market.length === 2));
  assert.ok(new Set(firstSession.decks.flatMap((deck) => deck.market.map((card) => card.sourceRuntimeId))).size === 6);
});

test('buildSession uses the full deck in freestyle mode regardless of player count', () => {
  const scoringCatalog = {
    fruits,
    cards: Array.from({ length: 12 }, (_, index) => makeCard(String(index + 1).padStart(3, '0'), fruits[index % fruits.length]))
  };
  const sessionRules = {
    deckCount: 3,
    marketSlotsPerDeck: 2,
    cardsPerPlayer: 18,
    playerCardPoolByCount: {
      '2': { selectedCards: 9 }
    }
  };

  const standardSession = buildSession({ mode: 'standard', playerCount: 2, playerNames: ['A', 'B'], randomSeed: 17 }, sessionRules, scoringCatalog);
  const freestyleSession = buildSession({ mode: 'freestyle', playerCount: 2, playerNames: ['A', 'B'], randomSeed: 17 }, sessionRules, scoringCatalog);

  const countCards = (session) => session.decks.reduce((sum, deck) => sum + deck.market.length + deck.cards.length, 0);

  assert.equal(countCards(standardSession), 9);
  assert.equal(countCards(freestyleSession), scoringCatalog.cards.length);
  assert.equal(freestyleSession.options.mode, 'freestyle');
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

  const cleanSession = buildSession({ mode: 'standard', playerCount: 2, playerNames: ['A', 'B'], randomSeed: 22 }, sessionRules, scoringCatalog);

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

  const seededSession = buildSession({ mode: 'standard', playerCount: 2, playerNames: ['A', 'B'], seedDemoProgress: true, randomSeed: 22 }, sessionRules, scoringCatalog);

  assert.notDeepEqual(seededSession.players[0].fruitCounts, cleanSession.players[0].fruitCounts);
  assert.ok(seededSession.players[0].salads.length > 0);
  assert.ok(seededSession.players[1].salads.length > 0);
  assert.ok(seededSession.logs.includes('Prototype scoring preview seeded'));
});

test('rebalanceEmptyDeck restores an empty deck from the thickest remaining deck', () => {
  const logs = [];
  const decks = [
    {
      id: 'deck-1',
      market: [],
      cards: []
    },
    {
      id: 'deck-2',
      market: [],
      cards: [makeCard('020', 'kiwi'), makeCard('021', 'orange'), makeCard('022', 'apple'), makeCard('023', 'banana'), makeCard('024', 'lime')]
    },
    {
      id: 'deck-3',
      market: [],
      cards: [makeCard('030', 'mango'), makeCard('031', 'kiwi')]
    }
  ];

  assert.equal(rebalanceEmptyDeck(decks[0], decks, logs), true);
  assert.deepEqual(decks[0].cards.map((card) => card.id), ['023', '024']);
  assert.deepEqual(decks[1].cards.map((card) => card.id), ['020', '021', '022']);
  assert.match(logs[0], /deck-1 restored from deck-2 with 2 cards/);
});

test('rebalanceEmptyDeck picks the first tied deck to stay deterministic', () => {
  const logs = [];
  const decks = [
    {
      id: 'deck-1',
      market: [],
      cards: []
    },
    {
      id: 'deck-2',
      market: [],
      cards: [makeCard('040', 'kiwi'), makeCard('041', 'orange'), makeCard('042', 'apple'), makeCard('043', 'banana')]
    },
    {
      id: 'deck-3',
      market: [],
      cards: [makeCard('050', 'lime'), makeCard('051', 'mango'), makeCard('052', 'kiwi'), makeCard('053', 'orange')]
    }
  ];

  assert.equal(rebalanceEmptyDeck(decks[0], decks, logs), true);
  assert.deepEqual(decks[0].cards.map((card) => card.id), ['042', '043']);
  assert.deepEqual(decks[1].cards.map((card) => card.id), ['040', '041']);
  assert.deepEqual(decks[2].cards.map((card) => card.id), ['050', '051', '052', '053']);
});

test('refillSessionMarkets restores empty decks before filling their market slots', () => {
  const logs = [];
  const decks = [
    {
      id: 'deck-1',
      market: [],
      cards: []
    },
    {
      id: 'deck-2',
      market: [],
      cards: [makeCard('060', 'kiwi'), makeCard('061', 'orange'), makeCard('062', 'apple'), makeCard('063', 'banana'), makeCard('064', 'lime')]
    },
    {
      id: 'deck-3',
      market: [],
      cards: [makeCard('070', 'mango'), makeCard('071', 'kiwi'), makeCard('072', 'orange')]
    }
  ];

  refillSessionMarkets(decks, 2, logs);

  assert.deepEqual(decks[0].market.map((card) => card.fruit), ['banana', 'lime']);
  assert.deepEqual(decks[0].cards, []);
  assert.match(logs.join(' | '), /deck-1 restored from deck-2 with 2 cards/);
  assert.match(logs.join(' | '), /deck-1 refilled market with banana, lime/);
});

test('buildSession assigns runtime ids to seeded demo salads', () => {
  const scoringCatalog = makeSeededCatalog();
  const sessionRules = {
    deckCount: 3,
    marketSlotsPerDeck: 2,
    cardsPerPlayer: 18,
    playerCardPoolByCount: {
      '2': { selectedCards: 12 }
    }
  };

  const seededSession = buildSession({ mode: 'standard', playerCount: 2, playerNames: ['A', 'B'], seedDemoProgress: true, randomSeed: 22 }, sessionRules, scoringCatalog);
  const runtimeIds = seededSession.players.flatMap((player) => player.salads.map((card) => card.runtimeId));

  assert.ok(runtimeIds.every(Boolean));
  assert.equal(new Set(runtimeIds).size, runtimeIds.length);
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