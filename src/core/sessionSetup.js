import { TurnStateMachine } from './stateMachine.js';
import { createSeededRandom, expandCardTemplates, shuffleCards } from '../data/cardCatalog.js';
import { normalizeSessionOptions } from '../config/sessionDefaults.js';
import { buildPlayerName } from '../i18n/locale.js';

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

function generateSessionSeed() {
  return Math.floor(Math.random() * 0x100000000);
}

function moveBottomHalfToEmptyDeck(sourceDeck, targetDeck, logs = []) {
  const movedCount = Math.floor(sourceDeck.cards.length / 2);

  if (movedCount <= 0) {
    return false;
  }

  const movedCards = sourceDeck.cards.splice(sourceDeck.cards.length - movedCount, movedCount);
  targetDeck.cards.push(...movedCards);
  logs.push(`${targetDeck.id} restored from ${sourceDeck.id} with ${movedCount} cards`);
  return true;
}

export function rebalanceEmptyDeck(targetDeck, decks, logs = []) {
  if (targetDeck.cards.length > 0) {
    return false;
  }

  const donorDeck = decks.reduce((selectedDeck, deck) => {
    if (deck.id === targetDeck.id || deck.cards.length < 2) {
      return selectedDeck;
    }

    if (!selectedDeck || deck.cards.length > selectedDeck.cards.length) {
      return deck;
    }

    return selectedDeck;
  }, null);

  if (!donorDeck) {
    logs.push(`${targetDeck.id} cannot be restored from the remaining decks`);
    return false;
  }

  return moveBottomHalfToEmptyDeck(donorDeck, targetDeck, logs);
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

export function refillSessionMarkets(decks, slotsPerDeck, logs = []) {
  decks.forEach((deck) => {
    while (deck.market.length < slotsPerDeck) {
      if (deck.cards.length === 0 && !rebalanceEmptyDeck(deck, decks, logs)) {
        break;
      }

      refillDeckMarket(deck, slotsPerDeck, logs);

      if (deck.cards.length === 0 && deck.market.length >= slotsPerDeck) {
        break;
      }
    }
  });
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
    const name = options.playerNames[index] || buildPlayerName(index + 1, options.locale);

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

function instantiateCatalogCardsByIds(scoringCatalog, ids, runtimePrefix) {
  return findCardsByIds(scoringCatalog, ids).map((card, index) => ({
    ...structuredClone(card),
    runtimeId: `${runtimePrefix}__${card.id}__${index + 1}`,
    sourceId: card.id
  }));
}

function findPrototypeShowcaseCards(scoringCatalog) {
  const preferredIds = ['000', '030', '066', '067', '068', '069', '071', '102', '103', '104', '106'];
  return instantiateCatalogCardsByIds(scoringCatalog, preferredIds, 'demo-p2');
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
    kiwi: 3,
    orange: 2,
    apple: 1,
    banana: 4,
    lime: 2,
    mango: 5
  };

  playerOne.salads = instantiateCatalogCardsByIds(session.scoringCatalog, ['102', '071', '104', '054'], 'demo-p1');
  playerTwo.salads = findPrototypeShowcaseCards(session.scoringCatalog);

  session.logs.push('Prototype scoring preview seeded');
}

export function buildSession(options, sessionRules, scoringCatalog) {
  const normalizedOptions = normalizeSessionOptions(options, options?.locale ?? 'ru');
  const sessionSeed = normalizedOptions.randomSeed ?? generateSessionSeed();
  const selectedCardCount =
    sessionRules.playerCardPoolByCount[String(normalizedOptions.playerCount)]?.selectedCards ??
    sessionRules.cardsPerPlayer * normalizedOptions.playerCount;

  const expandedDeck = expandCardTemplates(scoringCatalog, selectedCardCount);
  const playableDeck = shuffleCards(expandedDeck, createSeededRandom(sessionSeed));
  const sessionOptions = {
    ...normalizedOptions,
    randomSeed: sessionSeed
  };
  const decks = splitIntoDecks(playableDeck, sessionRules.deckCount);
  const players = createPlayers(sessionOptions, scoringCatalog.fruits);
  const stateMachine = new TurnStateMachine('setup');
  const turnTimeLimitMs = Math.max(0, Number(sessionRules?.turnRules?.timeLimitSeconds ?? 0)) * 1000;
  const logs = [
    'Session created',
    `Players: ${sessionOptions.playerCount}`,
    `Selected cards: ${selectedCardCount}`,
    `Seed: ${sessionSeed}`
  ];

  const session = {
    options: sessionOptions,
    players,
    decks,
    scoringCatalog,
    rules: sessionRules,
    stateMachine,
    turnNumber: 1,
    activePlayerIndex: 0,
    viewedPlayerIndex: 0,
    turnTimer: {
      limitMs: turnTimeLimitMs,
      remainingMs: turnTimeLimitMs,
      deadlineAt: turnTimeLimitMs > 0 ? Date.now() + turnTimeLimitMs : null
    },
    pendingSelection: [],
    pendingFlip: null,
    logs
  };

  refillSessionMarkets(decks, sessionRules.marketSlotsPerDeck, logs);

  if (sessionOptions.seedDemoProgress) {
    seedPrototypeProgress(session);
  }

  stateMachine.transition('turn');
  session.logs.push('State changed to turn');

  return session;
}
