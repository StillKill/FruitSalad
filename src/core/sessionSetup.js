import { TurnStateMachine } from './stateMachine.js';
import { expandCardTemplates } from '../data/cardCatalog.js';

function splitIntoDecks(cards, count) {
  const decks = Array.from({ length: count }, (_, index) => ({
    id: `deck-${index + 1}`,
    cards: [],
    market: []
  }));

  cards.forEach((card, index) => {
    decks[index % count].cards.push(card);
  });

  decks.forEach((deck) => {
    deck.market = deck.cards.splice(0, 2);
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
    logs: ['Session created', `Selected cards: ${selectedCardCount}`]
  };

  seedPrototypeProgress(session);
  stateMachine.transition('turn');
  session.logs.push('State changed to turn');

  return session;
}