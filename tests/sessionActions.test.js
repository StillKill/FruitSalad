import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSession } from '../src/core/sessionSetup.js';
import { getFruitName } from '../src/i18n/locale.js';
import {
  canConfirmSelection,
  confirmSelection,
  getPendingFlipSummary,
  getPendingSelectionSummary,
  getTurnHint,
  resetPendingSelection,
  selectDeckCard,
  selectMarketCard,
  togglePlayerSaladFlip,
  toggleSelectedDeckFlip
} from '../src/core/sessionActions.js';

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

function makeSession() {
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
      makeCard('009', 'apple'),
      makeCard('010', 'banana'),
      makeCard('011', 'lime'),
      makeCard('012', 'mango')
    ]
  };
  const sessionRules = {
    deckCount: 3,
    marketSlotsPerDeck: 2,
    cardsPerPlayer: 18,
    playerCardPoolByCount: {
      '2': { selectedCards: 12 }
    },
    turnRules: {
      marketPickLimit: 2,
      deckPickLimit: 1,
      confirmState: 'end_turn'
    }
  };
  const options = {
    playerCount: 2,
    playerNames: ['A', 'B'],
    liveScoring: false,
    locale: 'en',
    randomSeed: 11
  };

  const session = buildSession(options, sessionRules, scoringCatalog);

  session.players.forEach((player) => {
    player.fruitCounts = Object.fromEntries(fruits.map((fruit) => [fruit, 0]));
    player.salads = [];
    player.score = 0;
  });

  return session;
}

test('market selection requires exactly two fruit cards before confirm', () => {
  const session = makeSession();
  const firstCard = session.decks[0].market[0];
  const secondCard = session.decks[1].market[0];

  assert.equal(selectMarketCard(session, 'deck-1', firstCard.id), true);
  assert.equal(canConfirmSelection(session), false);
  assert.match(getTurnHint(session), /Pick 1 more fruit/);

  assert.equal(selectMarketCard(session, 'deck-2', secondCard.id), true);
  assert.equal(canConfirmSelection(session), true);
  assert.equal(getPendingSelectionSummary(session), `deck-1:${getFruitName(firstCard.fruit, 'en')}, deck-2:${getFruitName(secondCard.fruit, 'en')}`);
});

test('confirmSelection applies market fruits, refills slots, and advances the active player', () => {
  const session = makeSession();
  const [firstDeck, secondDeck] = session.decks;
  const firstFruit = firstDeck.market[0].fruit;
  const secondFruit = secondDeck.market[0].fruit;

  session.viewedPlayerIndex = 0;
  selectMarketCard(session, firstDeck.id, firstDeck.market[0].id);
  selectMarketCard(session, secondDeck.id, secondDeck.market[0].id);

  assert.equal(confirmSelection(session), true);
  assert.equal(session.players[0].fruitCounts[firstFruit], 1);
  assert.equal(session.players[0].fruitCounts[secondFruit], 1);
  assert.equal(session.activePlayerIndex, 1);
  assert.equal(session.viewedPlayerIndex, 1);
  assert.equal(session.turnNumber, 2);
  assert.equal(session.stateMachine.state, 'turn');
  assert.equal(session.decks[0].market.length, 2);
  assert.equal(session.decks[1].market.length, 2);
});

test('deck selection is exclusive and confirm moves the salad card to the player area', () => {
  const session = makeSession();
  const player = session.players[0];
  const saladsBefore = player.salads.length;
  const topRuntimeId = session.decks[0].cards[0].runtimeId;

  assert.equal(selectDeckCard(session, 'deck-1'), true);
  assert.equal(selectMarketCard(session, 'deck-2', session.decks[1].market[0].id), false);
  assert.equal(canConfirmSelection(session), true);

  assert.equal(confirmSelection(session), true);
  assert.equal(player.salads.length, saladsBefore + 1);
  assert.equal(player.salads.at(-1).runtimeId, topRuntimeId);
  assert.equal(session.activePlayerIndex, 1);
});


test('player-area salad flip is optional and resolves together with a market pick', () => {
  const session = makeSession();
  const player = session.players[0];
  const ownedSalad = session.decks[0].cards.shift();
  const firstFruit = session.decks[0].market[0].fruit;
  const secondFruit = session.decks[1].market[0].fruit;

  player.salads.push(ownedSalad);

  assert.equal(togglePlayerSaladFlip(session, ownedSalad.runtimeId), true);
  assert.equal(getPendingFlipSummary(session), `area:${getFruitName(ownedSalad.backFruit, 'en')}`);
  assert.equal(canConfirmSelection(session), false);

  selectMarketCard(session, session.decks[0].id, session.decks[0].market[0].id);
  selectMarketCard(session, session.decks[1].id, session.decks[1].market[0].id);

  assert.equal(confirmSelection(session), true);
  assert.equal(player.salads.length, 0);
  assert.equal(player.fruitCounts[ownedSalad.backFruit], 1);
  assert.equal(player.fruitCounts[firstFruit], 1);
  assert.equal(player.fruitCounts[secondFruit], 1);
  assert.equal(session.pendingFlip, null);
});

test('selected deck card can be flipped into its back fruit before confirm', () => {
  const session = makeSession();
  const player = session.players[0];
  const topCard = session.decks[0].cards[0];

  assert.equal(selectDeckCard(session, 'deck-1'), true);
  assert.equal(toggleSelectedDeckFlip(session, 'deck-1'), true);
  assert.equal(getPendingFlipSummary(session), `deck-1:${getFruitName(topCard.backFruit, 'en')}`);
  assert.equal(canConfirmSelection(session), true);

  assert.equal(confirmSelection(session), true);
  assert.equal(player.salads.length, 0);
  assert.equal(player.fruitCounts[topCard.backFruit], 1);
  assert.equal(session.pendingFlip, null);
});

test('resetPendingSelection clears the current choice and pending flip', () => {
  const session = makeSession();
  const ownedSalad = session.decks[0].cards.shift();

  session.players[0].salads.push(ownedSalad);
  selectDeckCard(session, 'deck-2');
  togglePlayerSaladFlip(session, ownedSalad.runtimeId);
  assert.equal(session.stateMachine.state, 'end_turn');

  resetPendingSelection(session);
  assert.equal(session.pendingSelection.length, 0);
  assert.equal(session.pendingFlip, null);
  assert.equal(session.stateMachine.state, 'turn');
  assert.equal(getPendingSelectionSummary(session), 'none');
});

test('confirmSelection reaches end_game when no deck and not enough market cards remain', () => {
  const session = makeSession();

  session.decks = [
    {
      id: 'deck-1',
      cards: [],
      market: [{ id: 'fruit-1', kind: 'fruit', fruit: 'apple' }]
    },
    {
      id: 'deck-2',
      cards: [],
      market: []
    },
    {
      id: 'deck-3',
      cards: [],
      market: [{ id: 'fruit-2', kind: 'fruit', fruit: 'banana' }, { id: 'fruit-3', kind: 'fruit', fruit: 'lime' }]
    }
  ];

  selectMarketCard(session, 'deck-3', 'fruit-2');
  selectMarketCard(session, 'deck-3', 'fruit-3');

  assert.equal(confirmSelection(session), true);
  assert.equal(session.stateMachine.state, 'end_game');
  assert.match(getTurnHint(session), /end game/i);
});
