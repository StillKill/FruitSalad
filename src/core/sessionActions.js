import { refillDeckMarket } from './sessionSetup.js';

function getActivePlayer(session) {
  return session.players[session.activePlayerIndex];
}

function getDeck(session, deckId) {
  return session.decks.find((deck) => deck.id === deckId) ?? null;
}

function hasDeckSelection(session) {
  return session.pendingSelection.some((selection) => selection.type === 'deck');
}

function hasMarketSelection(session) {
  return session.pendingSelection.some((selection) => selection.type === 'market');
}

function setTurnStateFromSelection(session) {
  if (session.pendingSelection.length === 0) {
    session.stateMachine.transition('turn');
    return;
  }

  session.stateMachine.transition('end_turn');
}

export function getPendingSelectionSummary(session) {
  if (session.pendingSelection.length === 0) {
    return 'none';
  }

  return session.pendingSelection
    .map((selection) => {
      if (selection.type === 'deck') {
        return `${selection.deckId}:salad`;
      }

      return `${selection.deckId}:${selection.fruit}`;
    })
    .join(', ');
}

export function getTurnHint(session) {
  if (session.stateMachine.state === 'end_game') {
    return 'No deck can continue play. Session reached end game.';
  }

  if (hasDeckSelection(session)) {
    return 'Confirm to take the top salad card from the selected deck, or Reset to cancel.';
  }

  if (hasMarketSelection(session)) {
    if (session.pendingSelection.length < session.rules.turnRules.marketPickLimit) {
      return `Pick ${session.rules.turnRules.marketPickLimit - session.pendingSelection.length} more fruit card from the market.`;
    }

    return 'Confirm to take the selected fruit cards, or Reset to choose again.';
  }

  return 'Pick 2 fruit cards from the market or 1 salad card from the top of any deck.';
}

export function resetPendingSelection(session) {
  session.pendingSelection = [];
  session.logs.push('Pending selection cleared');
  setTurnStateFromSelection(session);
}

export function selectMarketCard(session, deckId, cardId) {
  if (!['turn', 'end_turn'].includes(session.stateMachine.state)) {
    return false;
  }

  if (hasDeckSelection(session)) {
    return false;
  }

  const deck = getDeck(session, deckId);
  const card = deck?.market.find((marketCard) => marketCard.id === cardId) ?? null;

  if (!card) {
    return false;
  }

  const existingIndex = session.pendingSelection.findIndex((selection) => selection.type === 'market' && selection.cardId === cardId);

  if (existingIndex >= 0) {
    session.pendingSelection.splice(existingIndex, 1);
    session.logs.push(`Deselected market card ${card.fruit} from ${deckId}`);
    setTurnStateFromSelection(session);
    return true;
  }

  if (session.pendingSelection.length >= session.rules.turnRules.marketPickLimit) {
    return false;
  }

  session.pendingSelection.push({
    type: 'market',
    deckId,
    cardId,
    fruit: card.fruit
  });
  session.logs.push(`Selected market card ${card.fruit} from ${deckId}`);
  setTurnStateFromSelection(session);
  return true;
}

export function selectDeckCard(session, deckId) {
  if (!['turn', 'end_turn'].includes(session.stateMachine.state)) {
    return false;
  }

  if (hasMarketSelection(session)) {
    return false;
  }

  const deck = getDeck(session, deckId);
  const card = deck?.cards[0] ?? null;

  if (!card) {
    return false;
  }

  const existing = session.pendingSelection[0];

  if (existing?.type === 'deck' && existing.deckId === deckId && existing.runtimeId === card.runtimeId) {
    resetPendingSelection(session);
    return true;
  }

  session.pendingSelection = [{
    type: 'deck',
    deckId,
    runtimeId: card.runtimeId,
    cardId: card.id
  }];
  session.logs.push(`Selected top salad card from ${deckId}`);
  setTurnStateFromSelection(session);
  return true;
}

export function canConfirmSelection(session) {
  if (session.stateMachine.state !== 'end_turn' || session.pendingSelection.length === 0) {
    return false;
  }

  if (hasDeckSelection(session)) {
    return session.pendingSelection.length === 1;
  }

  return session.pendingSelection.length === session.rules.turnRules.marketPickLimit;
}

function applyMarketSelection(session) {
  const player = getActivePlayer(session);
  const takenFruits = [];

  session.pendingSelection.forEach((selection) => {
    const deck = getDeck(session, selection.deckId);
    const cardIndex = deck.market.findIndex((marketCard) => marketCard.id === selection.cardId);

    if (cardIndex < 0) {
      return;
    }

    const [takenCard] = deck.market.splice(cardIndex, 1);
    player.fruitCounts[takenCard.fruit] += 1;
    takenFruits.push(takenCard.fruit);
  });

  session.logs.push(`${player.name} took market fruits: ${takenFruits.join(', ')}`);
  session.lastAction = `${player.name} took ${takenFruits.join(', ')}`;
}

function applyDeckSelection(session) {
  const player = getActivePlayer(session);
  const selection = session.pendingSelection[0];
  const deck = getDeck(session, selection.deckId);
  const topCard = deck?.cards[0] ?? null;

  if (!topCard || topCard.runtimeId !== selection.runtimeId) {
    return false;
  }

  player.salads.push(deck.cards.shift());
  session.logs.push(`${player.name} took a salad card from ${selection.deckId}`);
  session.lastAction = `${player.name} took a salad from ${selection.deckId}`;
  return true;
}

function refreshMarket(session) {
  session.stateMachine.transition('refresh');
  session.decks.forEach((deck) => {
    refillDeckMarket(deck, session.rules.marketSlotsPerDeck, session.logs);
  });
}

function canContinuePlay(session) {
  const totalMarketCards = session.decks.reduce((sum, deck) => sum + deck.market.length, 0);
  const hasDeckCards = session.decks.some((deck) => deck.cards.length > 0);

  return hasDeckCards || totalMarketCards >= session.rules.turnRules.marketPickLimit;
}

function advanceTurn(session) {
  session.turnNumber += 1;
  session.activePlayerIndex = (session.activePlayerIndex + 1) % session.players.length;
  session.viewedPlayerIndex = session.activePlayerIndex;
}

export function confirmSelection(session) {
  if (!canConfirmSelection(session)) {
    return false;
  }

  const applied = hasDeckSelection(session) ? applyDeckSelection(session) : (applyMarketSelection(session), true);

  if (!applied) {
    return false;
  }

  session.pendingSelection = [];
  refreshMarket(session);

  if (!canContinuePlay(session)) {
    session.stateMachine.transition('end_game');
    session.logs.push('State changed to end_game');
    return true;
  }

  advanceTurn(session);
  session.stateMachine.transition('turn');
  session.logs.push(`State changed to turn for ${getActivePlayer(session).name}`);
  return true;
}
