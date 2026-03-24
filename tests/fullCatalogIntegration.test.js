import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildSession } from '../src/core/sessionSetup.js';
import {
  canConfirmSelection,
  confirmSelection,
  selectDeckCard,
  selectMarketCard
} from '../src/core/sessionActions.js';

const scoringCatalog = JSON.parse(readFileSync(new URL('../data/cards/scoring-cards.json', import.meta.url), 'utf8'));
const sessionRules = JSON.parse(readFileSync(new URL('../data/sessions/session-rules.json', import.meta.url), 'utf8'));
const seeds = [1, 7, 19, 42, 99];

function totalFruitCount(player) {
  return Object.values(player.fruitCounts).reduce((sum, count) => sum + count, 0);
}

test('buildSession stays valid across full-catalog runtime seeds', () => {
  for (const seed of seeds) {
    for (const playerCount of [2, 4, 6]) {
      const session = buildSession({
        playerCount,
        playerNames: Array.from({ length: playerCount }, (_, index) => `P${index + 1}`),
        randomSeed: seed
      }, sessionRules, scoringCatalog);

      const selectedCardCount = sessionRules.playerCardPoolByCount[String(playerCount)].selectedCards;
      const allRuntimeIds = session.decks.flatMap((deck) => [
        ...deck.cards.map((card) => card.runtimeId),
        ...deck.market.map((card) => card.sourceRuntimeId)
      ]);

      assert.equal(session.players.length, playerCount, `seed ${seed} players`);
      assert.equal(session.decks.length, sessionRules.deckCount, `seed ${seed} deck count`);
      assert.equal(new Set(allRuntimeIds).size, allRuntimeIds.length, `seed ${seed} runtime ids unique`);
      assert.equal(session.decks.reduce((sum, deck) => sum + deck.cards.length + deck.market.length, 0), selectedCardCount, `seed ${seed} selected cards preserved`);
      assert.ok(session.decks.every((deck) => deck.market.length <= sessionRules.marketSlotsPerDeck), `seed ${seed} market slots limited`);
      assert.ok(session.players.every((player) => totalFruitCount(player) === 0 && player.salads.length === 0), `seed ${seed} starts clean`);
      assert.equal(session.stateMachine.state, 'turn', `seed ${seed} turn state`);
      assert.equal(session.options.randomSeed, seed, `seed ${seed} stored`);
    }
  }
});

test('runtime seed changes the initial market composition for the full catalog', () => {
  const sessionA = buildSession({ playerCount: 2, playerNames: ['A', 'B'], randomSeed: 1 }, sessionRules, scoringCatalog);
  const sessionB = buildSession({ playerCount: 2, playerNames: ['A', 'B'], randomSeed: 99 }, sessionRules, scoringCatalog);

  const marketA = sessionA.decks.flatMap((deck) => deck.market.map((card) => card.fruit));
  const marketB = sessionB.decks.flatMap((deck) => deck.market.map((card) => card.fruit));

  assert.notDeepEqual(marketA, marketB);
});

test('market confirmations stay consistent across full-catalog runtime seeds', () => {
  for (const seed of seeds) {
    const session = buildSession({
      playerCount: 2,
      playerNames: ['A', 'B'],
      randomSeed: seed
    }, sessionRules, scoringCatalog);

    const player = session.players[0];
    const firstDeck = session.decks.find((deck) => deck.market.length > 0);
    const secondDeck = session.decks.find((deck, index) => index !== session.decks.indexOf(firstDeck) && deck.market.length > 0) ?? firstDeck;
    const firstChoice = firstDeck.market[0];
    const secondChoice = secondDeck.market[0];

    assert.equal(selectMarketCard(session, firstDeck.id, firstChoice.id), true, `seed ${seed} first pick`);
    assert.equal(selectMarketCard(session, secondDeck.id, secondChoice.id), true, `seed ${seed} second pick`);
    assert.equal(canConfirmSelection(session), true, `seed ${seed} confirm enabled`);

    assert.equal(confirmSelection(session), true, `seed ${seed} market confirm`);
    assert.equal(totalFruitCount(player), 2, `seed ${seed} took two fruits`);
    assert.equal(session.activePlayerIndex, 1, `seed ${seed} advanced turn`);
    assert.ok(session.decks.every((deck) => deck.market.length <= sessionRules.marketSlotsPerDeck), `seed ${seed} refill respected slots`);
  }
});

test('deck confirmations stay consistent across full-catalog runtime seeds', () => {
  for (const seed of seeds) {
    const session = buildSession({
      playerCount: 2,
      playerNames: ['A', 'B'],
      randomSeed: seed
    }, sessionRules, scoringCatalog);

    const player = session.players[0];
    const targetDeck = session.decks.find((deck) => deck.cards.length > 0);
    const runtimeId = targetDeck.cards[0].runtimeId;

    assert.equal(selectDeckCard(session, targetDeck.id), true, `seed ${seed} deck select`);
    assert.equal(confirmSelection(session), true, `seed ${seed} deck confirm`);
    assert.equal(player.salads.length, 1, `seed ${seed} gained one salad`);
    assert.equal(player.salads[0].runtimeId, runtimeId, `seed ${seed} took selected card`);
    assert.equal(session.activePlayerIndex, 1, `seed ${seed} advanced turn after deck pick`);
  }
});
