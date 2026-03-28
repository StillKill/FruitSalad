import { refillSessionMarkets } from './sessionSetup.js';

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

function getOwnedSaladByRuntimeId(session, runtimeId) {
  return getActivePlayer(session).salads.find((card) => card.runtimeId === runtimeId) ?? null;
}

function getSelectedDeckCard(session) {
  const selection = session.pendingSelection.find((item) => item.type === 'deck') ?? null;

  if (!selection) {
    return null;
  }

  const deck = getDeck(session, selection.deckId);
  const topCard = deck?.cards[0] ?? null;

  if (!topCard || topCard.runtimeId !== selection.runtimeId) {
    return null;
  }

  return {
    selection,
    deck,
    card: topCard
  };
}

function getPendingFlipCard(session) {
  if (!session.pendingFlip) {
    return null;
  }

  if (session.pendingFlip.type === 'player-salad') {
    return getOwnedSaladByRuntimeId(session, session.pendingFlip.runtimeId);
  }

  const selectedDeckCard = getSelectedDeckCard(session);
  if (!selectedDeckCard) {
    return null;
  }

  return selectedDeckCard.selection.deckId === session.pendingFlip.deckId ? selectedDeckCard.card : null;
}

function clearSelectedDeckFlip(session) {
  if (session.pendingFlip?.type === 'selected-deck') {
    session.pendingFlip = null;
  }
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

export function getPendingFlipSummary(session) {
  if (!session.pendingFlip) {
    return 'none';
  }

  const targetCard = getPendingFlipCard(session);
  const fruit = targetCard?.backFruit ?? 'missing';

  if (session.pendingFlip.type === 'player-salad') {
    return `area:${fruit}`;
  }

  return `${session.pendingFlip.deckId}:${fruit}`;
}

export function getTurnHint(session) {
  const flipHint = session.pendingFlip ? `Pending flip: ${getPendingFlipSummary(session)}. ` : '';

  if (session.stateMachine.state === 'end_game') {
    return `${flipHint}No deck can continue play. Session reached end game.`.trim();
  }

  if (hasDeckSelection(session)) {
    const selectedDeckCard = getSelectedDeckCard(session);
    const deckHint = session.pendingFlip?.type === 'selected-deck' && selectedDeckCard
      ? `Confirm to take ${selectedDeckCard.card.backFruit} from the selected deck, or Reset to cancel.`
      : 'Confirm to take the top salad card from the selected deck, or Reset to cancel.';
    return `${flipHint}${deckHint}`.trim();
  }

  if (hasMarketSelection(session)) {
    if (session.pendingSelection.length < session.rules.turnRules.marketPickLimit) {
      return `${flipHint}Pick ${session.rules.turnRules.marketPickLimit - session.pendingSelection.length} more fruit card from the market.`.trim();
    }

    return `${flipHint}Confirm to take the selected fruit cards, or Reset to choose again.`.trim();
  }

  if (session.pendingFlip) {
    return `${flipHint}Pick 2 fruit cards from the market or 1 salad card from the top of any deck.`.trim();
  }

  return 'Pick 2 fruit cards from the market or 1 salad card from the top of any deck.';
}

export function resetPendingSelection(session) {
  session.pendingSelection = [];
  session.pendingFlip = null;
  session.logs.push('Pending selection cleared');
  setTurnStateFromSelection(session);
}

export function togglePlayerSaladFlip(session, runtimeId) {
  if (!['turn', 'end_turn'].includes(session.stateMachine.state)) {
    return false;
  }

  const card = getOwnedSaladByRuntimeId(session, runtimeId);
  if (!card) {
    return false;
  }

  if (session.pendingFlip?.type === 'player-salad' && session.pendingFlip.runtimeId === runtimeId) {
    session.pendingFlip = null;
    session.logs.push(`Cancelled pending flip for ${card.backFruit} in player area`);
    return true;
  }

  session.pendingFlip = {
    type: 'player-salad',
    runtimeId,
    cardId: card.id
  };
  session.logs.push(`Queued flip for ${card.backFruit} in player area`);
  return true;
}

export function toggleSelectedDeckFlip(session, deckId) {
  if (!['turn', 'end_turn'].includes(session.stateMachine.state)) {
    return false;
  }

  const selectedDeckCard = getSelectedDeckCard(session);
  if (!selectedDeckCard || selectedDeckCard.selection.deckId !== deckId) {
    return false;
  }

  if (session.pendingFlip?.type === 'selected-deck' && session.pendingFlip.deckId === deckId && session.pendingFlip.runtimeId === selectedDeckCard.card.runtimeId) {
    session.pendingFlip = null;
    session.logs.push(`Cancelled pending flip for ${deckId}`);
    return true;
  }

  session.pendingFlip = {
    type: 'selected-deck',
    deckId,
    runtimeId: selectedDeckCard.card.runtimeId,
    cardId: selectedDeckCard.card.id
  };
  session.logs.push(`Queued flip for top card from ${deckId}`);
  return true;
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

  clearSelectedDeckFlip(session);
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
  return `${player.name} took ${takenFruits.join(', ')}`;
}

function applyDeckSelection(session) {
  const player = getActivePlayer(session);
  const selectedDeckCard = getSelectedDeckCard(session);

  if (!selectedDeckCard) {
    return null;
  }

  const { selection, deck, card } = selectedDeckCard;
  if (session.pendingFlip?.type === 'selected-deck' && session.pendingFlip.deckId === selection.deckId && session.pendingFlip.runtimeId === card.runtimeId) {
    deck.cards.shift();
    player.fruitCounts[card.backFruit] += 1;
    session.logs.push(`${player.name} flipped the top salad card from ${selection.deckId} into ${card.backFruit}`);
    return `${player.name} flipped ${selection.deckId} into ${card.backFruit}`;
  }

  player.salads.push(deck.cards.shift());
  session.logs.push(`${player.name} took a salad card from ${selection.deckId}`);
  return `${player.name} took a salad from ${selection.deckId}`;
}

function applyPlayerAreaFlip(session) {
  if (session.pendingFlip?.type !== 'player-salad') {
    return null;
  }

  const player = getActivePlayer(session);
  const saladIndex = player.salads.findIndex((card) => card.runtimeId === session.pendingFlip.runtimeId);

  if (saladIndex < 0) {
    return null;
  }

  const [flippedCard] = player.salads.splice(saladIndex, 1);
  player.fruitCounts[flippedCard.backFruit] += 1;
  session.logs.push(`${player.name} flipped ${flippedCard.backFruit} from the player area`);
  return `${player.name} flipped ${flippedCard.backFruit}`;
}

function refreshMarket(session) {
  session.stateMachine.transition('refresh');
  refillSessionMarkets(session.decks, session.rules.marketSlotsPerDeck, session.logs);
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
  session.pendingFlip = null;
}

export function confirmSelection(session) {
  if (!canConfirmSelection(session)) {
    return false;
  }

  const actionSummaries = [];
  const appliedPlayerFlip = applyPlayerAreaFlip(session);
  if (session.pendingFlip?.type === 'player-salad' && !appliedPlayerFlip) {
    return false;
  }

  if (appliedPlayerFlip) {
    actionSummaries.push(appliedPlayerFlip);
  }

  const appliedSelection = hasDeckSelection(session) ? applyDeckSelection(session) : applyMarketSelection(session);

  if (!appliedSelection) {
    return false;
  }

  actionSummaries.push(appliedSelection);
  session.lastAction = actionSummaries.join(' + ');
  session.pendingSelection = [];
  session.pendingFlip = null;
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
