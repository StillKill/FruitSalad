import { TurnStateMachine } from './stateMachine.js';
import { expandCardTemplates } from '../data/cardCatalog.js';

function createMarketFruitCard(card) {
  return {
    id: `${card.runtimeId ?? card.id}::fruit`,
    kind: 'fruit',
    fruit: card.backFruit,
    sourceCardId: card.id,
    sourceRuntimeId: card.runtimeId ?? card.id,
    sourceCard: card
  };
}

export function refillDeckMarket(deck, slotsPerDeck, logs = []) {
  const filledSlots = [];

  while (deck.market.length < slotsPerDeck && deck.cards.length > 0) {
    const drawnCard = deck.cards.shift();
    const fruitCard = createMarketFruitCard(drawnCard);

    deck.market.push(fruitCard);
    filledSlots.push(fruitCard.fruit);
  }

  if (filledSlots.length > 0) {
    logs.push(`${deck.id} refilled market with ${filledSlots.join(', ')}`);
  }

  if (deck.market.length < slotsPerDeck && deck.cards.length === 0) {
    logs.push(`${deck.id} cannot fully refill market`);
  }
}

function splitIntoDecks(cards, count) {
  const decks = Array.from({ length: count }, (_, index) => ({
    id: `deck-${index + 1}`,
    cards: [],
    market: []
  }));

  cards.forEach((card, index) => {
    decks[index % count].cards.push(card);
  });

  return decks;
}

function createPlayers(options, fruits) {
  return Array.from({ length: options.playerCount }, (_, index) => {
    const name = options.playerNames[index] || `Player ${index + 1}`;

    return {
      id: `player-${index + 1}`,
      name,
      fruitCounts: Object.fromEntries(fruits.map((fruit) => [fruit, 0])),
      salads: [],
      score: 0
    };
  });
}

function findCardsByIds(scoringCatalog, ids) {
  const index = new Map(scoringCatalog.cards.map((card) => [card.id, card]));
  return ids.map((id) => index.get(id)).filter(Boolean);
}

function seedPrototypeProgress(session) {
  if (session.players.length < 2) {
    return;
  }

  const [playerOne, playerTwo] = session.players;

  playerOne.fruitCounts = {
    kiwi: 1,
    orange: 2,
    apple: 0,
    banana: 2,
    lime: 1,
    mango: 4
  };

  playerTwo.fruitCounts = {
    kiwi: 5,
    orange: 1,
    apple: 1,
    banana: 0,
    lime: 0,
    mango: 2
  };

  playerOne.salads = findCardsByIds(session.scoringCatalog, ['102', '071', '104', '054']);
  playerTwo.salads = findCardsByIds(session.scoringCatalog, ['096', '106', '000', '080']);

  session.logs.push('Prototype scoring preview seeded');
}

export function buildSession(options, sessionRules, scoringCatalog) {
  const selectedCardCount =
    sessionRules.playerCardPoolByCount[String(options.playerCount)]?.selectedCards ??
    sessionRules.cardsPerPlayer * options.playerCount;

  const playableDeck = expandCardTemplates(scoringCatalog, selectedCardCount);
  const decks = splitIntoDecks(playableDeck, sessionRules.deckCount);
  const players = createPlayers(options, scoringCatalog.fruits);
  const stateMachine = new TurnStateMachine('setup');
  const logs = ['Session created', `Selected cards: ${selectedCardCount}`];

  const session = {
    options,
    players,
    decks,
    scoringCatalog,
    rules: sessionRules,
    stateMachine,
    turnNumber: 1,
    activePlayerIndex: 0,
    viewedPlayerIndex: 0,
    pendingSelection: [],
    logs
  };

  decks.forEach((deck) => {
    refillDeckMarket(deck, sessionRules.marketSlotsPerDeck, logs);
  });

  seedPrototypeProgress(session);
  stateMachine.transition('turn');
  session.logs.push('State changed to turn');

  return session;
}
