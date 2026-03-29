import { refillSessionMarkets } from './sessionSetup.js';
import { getFruitName, normalizeLocale } from '../i18n/locale.js';

const TURN_HINTS = {
  ru: {
    none: '\u043d\u0435\u0442',
    missing: '\u043d\u0435\u0442',
    pendingFlip: (summary) => `\u041f\u0435\u0440\u0435\u0432\u043e\u0440\u043e\u0442: ${summary}. `,
    endGame: '\u041d\u0438 \u043e\u0434\u043d\u0430 \u043a\u043e\u043b\u043e\u0434\u0430 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0442\u044c \u0438\u0433\u0440\u0443. \u041f\u0430\u0440\u0442\u0438\u044f \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430.',
    confirmDeckFruit: (fruit) => `\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c, \u0447\u0442\u043e\u0431\u044b \u0437\u0430\u0431\u0440\u0430\u0442\u044c ${fruit} \u0438\u0437 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u043a\u043e\u043b\u043e\u0434\u044b, \u0438\u043b\u0438 \u0421\u0431\u0440\u043e\u0441, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.`,
    confirmDeckSalad: '\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c, \u0447\u0442\u043e\u0431\u044b \u0437\u0430\u0431\u0440\u0430\u0442\u044c \u0432\u0435\u0440\u0445\u043d\u044e\u044e \u0441\u0430\u043b\u0430\u0442\u043d\u0443\u044e \u043a\u0430\u0440\u0442\u0443 \u0438\u0437 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u043a\u043e\u043b\u043e\u0434\u044b, \u0438\u043b\u0438 \u0421\u0431\u0440\u043e\u0441, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.',
    pickMoreFruit: (count) => `\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0435\u0449\u0451 ${count} \u0444\u0440\u0443\u043a\u0442(\u0430) \u0441 \u0440\u044b\u043d\u043a\u0430.`,
    confirmFruitCards: '\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c, \u0447\u0442\u043e\u0431\u044b \u0437\u0430\u0431\u0440\u0430\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0444\u0440\u0443\u043a\u0442\u043e\u0432\u044b\u0435 \u043a\u0430\u0440\u0442\u044b, \u0438\u043b\u0438 \u0421\u0431\u0440\u043e\u0441, \u0447\u0442\u043e\u0431\u044b \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0437\u0430\u043d\u043e\u0432\u043e.',
    defaultTurn: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 2 \u0444\u0440\u0443\u043a\u0442\u043e\u0432\u044b\u0435 \u043a\u0430\u0440\u0442\u044b \u0441 \u0440\u044b\u043d\u043a\u0430 \u0438\u043b\u0438 1 \u0441\u0430\u043b\u0430\u0442\u043d\u0443\u044e \u043a\u0430\u0440\u0442\u0443 \u0441 \u0432\u0435\u0440\u0445\u0430 \u043b\u044e\u0431\u043e\u0439 \u043a\u043e\u043b\u043e\u0434\u044b.',
    selectionDeck: (deckId) => `${deckId}:\u0441\u0430\u043b\u0430\u0442`,
    pendingFlipArea: (fruit) => `\u0437\u043e\u043d\u0430:${fruit}`,
    pendingFlipDeck: (deckId, fruit) => `${deckId}:${fruit}`,
    tookMarket: (name, fruits) => `${name} \u0432\u0437\u044f\u043b \u0444\u0440\u0443\u043a\u0442\u044b: ${fruits.join(', ')}`,
    tookMarketShort: (name, fruits) => `${name} \u0432\u0437\u044f\u043b ${fruits.join(', ')}`,
    flippedDeckLog: (name, deckId, fruit) => `${name} \u043f\u0435\u0440\u0435\u0432\u0435\u0440\u043d\u0443\u043b ${deckId} \u0432 ${fruit}`,
    flippedDeckShort: (name, deckId, fruit) => `${name} \u043f\u0435\u0440\u0435\u0432\u0435\u0440\u043d\u0443\u043b ${deckId} \u0432 ${fruit}`,
    tookSaladLog: (name, deckId) => `${name} \u0432\u0437\u044f\u043b \u0441\u0430\u043b\u0430\u0442 \u0438\u0437 ${deckId}`,
    tookSaladShort: (name, deckId) => `${name} \u0432\u0437\u044f\u043b \u0441\u0430\u043b\u0430\u0442 \u0438\u0437 ${deckId}`,
    flippedAreaLog: (name, fruit) => `${name} \u043f\u0435\u0440\u0435\u0432\u0435\u0440\u043d\u0443\u043b ${fruit}`,
    flippedAreaShort: (name, fruit) => `${name} \u043f\u0435\u0440\u0435\u0432\u0435\u0440\u043d\u0443\u043b ${fruit}`,
    cleared: '\u041e\u0436\u0438\u0434\u0430\u044e\u0449\u0438\u0439 \u0432\u044b\u0431\u043e\u0440 \u043e\u0447\u0438\u0449\u0435\u043d',
    cancelledArea: (fruit) => `\u041e\u0442\u043c\u0435\u043d\u0451\u043d \u043f\u0435\u0440\u0435\u0432\u043e\u0440\u043e\u0442 ${fruit}`,
    queuedArea: (fruit) => `\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d \u043f\u0435\u0440\u0435\u0432\u043e\u0440\u043e\u0442 ${fruit}`,
    cancelledDeck: (deckId) => `\u041e\u0442\u043c\u0435\u043d\u0451\u043d \u043f\u0435\u0440\u0435\u0432\u043e\u0440\u043e\u0442 ${deckId}`,
    queuedDeck: (deckId) => `\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d \u043f\u0435\u0440\u0435\u0432\u043e\u0440\u043e\u0442 ${deckId}`,
    deselectedMarket: (fruit, deckId) => `\u0421\u043d\u044f\u0442 \u0432\u044b\u0431\u043e\u0440 ${fruit} \u0438\u0437 ${deckId}`,
    selectedMarket: (fruit, deckId) => `\u0412\u044b\u0431\u0440\u0430\u043d ${fruit} \u0438\u0437 ${deckId}`,
    selectedDeck: (deckId) => `\u0412\u044b\u0431\u0440\u0430\u043d \u0441\u0430\u043b\u0430\u0442 \u0438\u0437 ${deckId}`,
    turnState: (name) => `\u0425\u043e\u0434: ${name}`,
    timeoutAutoConfirm: (name) => `\u0412\u0440\u0435\u043c\u044f ${name} \u0438\u0441\u0442\u0435\u043a\u043b\u043e, \u0432\u044b\u0431\u043e\u0440 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438`,
    timeoutSkipped: (name) => `\u0412\u0440\u0435\u043c\u044f ${name} \u0438\u0441\u0442\u0435\u043a\u043b\u043e, \u0445\u043e\u0434 \u043f\u0440\u043e\u043f\u0443\u0449\u0435\u043d`
  },
  en: {
    none: 'none',
    missing: 'missing',
    pendingFlip: (summary) => `Pending flip: ${summary}. `,
    endGame: 'No deck can continue play. Session reached end game.',
    confirmDeckFruit: (fruit) => `Confirm to take ${fruit} from the selected deck, or Reset to cancel.`,
    confirmDeckSalad: 'Confirm to take the top salad card from the selected deck, or Reset to cancel.',
    pickMoreFruit: (count) => `Pick ${count} more fruit card from the market.`,
    confirmFruitCards: 'Confirm to take the selected fruit cards, or Reset to choose again.',
    defaultTurn: 'Pick 2 fruit cards from the market or 1 salad card from the top of any deck.',
    selectionDeck: (deckId) => `${deckId}:salad`,
    pendingFlipArea: (fruit) => `area:${fruit}`,
    pendingFlipDeck: (deckId, fruit) => `${deckId}:${fruit}`,
    tookMarket: (name, fruits) => `${name} took market fruits: ${fruits.join(', ')}`,
    tookMarketShort: (name, fruits) => `${name} took ${fruits.join(', ')}`,
    flippedDeckLog: (name, deckId, fruit) => `${name} flipped the top salad card from ${deckId} into ${fruit}`,
    flippedDeckShort: (name, deckId, fruit) => `${name} flipped ${deckId} into ${fruit}`,
    tookSaladLog: (name, deckId) => `${name} took a salad card from ${deckId}`,
    tookSaladShort: (name, deckId) => `${name} took a salad from ${deckId}`,
    flippedAreaLog: (name, fruit) => `${name} flipped ${fruit} from the player area`,
    flippedAreaShort: (name, fruit) => `${name} flipped ${fruit}`,
    cleared: 'Pending selection cleared',
    cancelledArea: (fruit) => `Cancelled pending flip for ${fruit} in player area`,
    queuedArea: (fruit) => `Queued flip for ${fruit} in player area`,
    cancelledDeck: (deckId) => `Cancelled pending flip for ${deckId}`,
    queuedDeck: (deckId) => `Queued flip for top card from ${deckId}`,
    deselectedMarket: (fruit, deckId) => `Deselected market card ${fruit} from ${deckId}`,
    selectedMarket: (fruit, deckId) => `Selected market card ${fruit} from ${deckId}`,
    selectedDeck: (deckId) => `Selected top salad card from ${deckId}`,
    turnState: (name) => `State changed to turn for ${name}`,
    timeoutAutoConfirm: (name) => `${name} ran out of time, selection auto-confirmed`,
    timeoutSkipped: (name) => `${name} ran out of time, turn skipped`
  }
};

function getLocale(session, locale) {
  return normalizeLocale(locale ?? session?.options?.locale ?? 'ru');
}

function getCopy(session, locale) {
  return TURN_HINTS[getLocale(session, locale)];
}

function formatFruit(session, fruit, locale) {
  return getFruitName(fruit, getLocale(session, locale));
}

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

  return { selection, deck, card: topCard };
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

function resetTurnTimer(session) {
  if (!session.turnTimer) {
    return;
  }

  session.turnTimer.remainingMs = session.turnTimer.limitMs;
}

function setTurnStateFromSelection(session) {
  if (session.pendingSelection.length === 0) {
    session.stateMachine.transition('turn');
    return;
  }

  session.stateMachine.transition('end_turn');
}

export function getPendingSelectionSummary(session, locale) {
  const copy = getCopy(session, locale);
  if (session.pendingSelection.length === 0) {
    return copy.none;
  }

  return session.pendingSelection.map((selection) => {
    if (selection.type === 'deck') {
      return copy.selectionDeck(selection.deckId);
    }

    return `${selection.deckId}:${formatFruit(session, selection.fruit, locale)}`;
  }).join(', ');
}

export function getPendingFlipSummary(session, locale) {
  const copy = getCopy(session, locale);
  if (!session.pendingFlip) {
    return copy.none;
  }

  const targetCard = getPendingFlipCard(session);
  const fruit = targetCard?.backFruit ? formatFruit(session, targetCard.backFruit, locale) : copy.missing;

  if (session.pendingFlip.type === 'player-salad') {
    return copy.pendingFlipArea(fruit);
  }

  return copy.pendingFlipDeck(session.pendingFlip.deckId, fruit);
}

export function getTurnHint(session, locale) {
  const copy = getCopy(session, locale);
  const flipHint = session.pendingFlip ? copy.pendingFlip(getPendingFlipSummary(session, locale)) : '';

  if (session.stateMachine.state === 'end_game') {
    return `${flipHint}${copy.endGame}`.trim();
  }

  if (hasDeckSelection(session)) {
    const selectedDeckCard = getSelectedDeckCard(session);
    const deckHint = session.pendingFlip?.type === 'selected-deck' && selectedDeckCard
      ? copy.confirmDeckFruit(formatFruit(session, selectedDeckCard.card.backFruit, locale))
      : copy.confirmDeckSalad;
    return `${flipHint}${deckHint}`.trim();
  }

  if (hasMarketSelection(session)) {
    if (session.pendingSelection.length < session.rules.turnRules.marketPickLimit) {
      return `${flipHint}${copy.pickMoreFruit(session.rules.turnRules.marketPickLimit - session.pendingSelection.length)}`.trim();
    }

    return `${flipHint}${copy.confirmFruitCards}`.trim();
  }

  return `${flipHint}${copy.defaultTurn}`.trim();
}

export function resetPendingSelection(session) {
  session.pendingSelection = [];
  session.pendingFlip = null;
  session.logs.push(getCopy(session).cleared);
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

  const copy = getCopy(session);
  const fruit = formatFruit(session, card.backFruit);
  if (session.pendingFlip?.type === 'player-salad' && session.pendingFlip.runtimeId === runtimeId) {
    session.pendingFlip = null;
    session.logs.push(copy.cancelledArea(fruit));
    return true;
  }

  session.pendingFlip = { type: 'player-salad', runtimeId, cardId: card.id };
  session.logs.push(copy.queuedArea(fruit));
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

  const copy = getCopy(session);
  if (session.pendingFlip?.type === 'selected-deck' && session.pendingFlip.deckId == deckId && session.pendingFlip.runtimeId === selectedDeckCard.card.runtimeId) {
    session.pendingFlip = null;
    session.logs.push(copy.cancelledDeck(deckId));
    return true;
  }

  session.pendingFlip = {
    type: 'selected-deck',
    deckId,
    runtimeId: selectedDeckCard.card.runtimeId,
    cardId: selectedDeckCard.card.id
  };
  session.logs.push(copy.queuedDeck(deckId));
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
  const fruit = formatFruit(session, card.fruit);
  const copy = getCopy(session);

  if (existingIndex >= 0) {
    session.pendingSelection.splice(existingIndex, 1);
    session.logs.push(copy.deselectedMarket(fruit, deckId));
    setTurnStateFromSelection(session);
    return true;
  }

  if (session.pendingSelection.length >= session.rules.turnRules.marketPickLimit) {
    return false;
  }

  session.pendingSelection.push({ type: 'market', deckId, cardId, fruit: card.fruit });
  session.logs.push(copy.selectedMarket(fruit, deckId));
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
  session.pendingSelection = [{ type: 'deck', deckId, runtimeId: card.runtimeId, cardId: card.id }];
  session.logs.push(getCopy(session).selectedDeck(deckId));
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
    takenFruits.push(formatFruit(session, takenCard.fruit));
  });

  const copy = getCopy(session);
  session.logs.push(copy.tookMarket(player.name, takenFruits));
  return copy.tookMarketShort(player.name, takenFruits);
}

function applyDeckSelection(session) {
  const player = getActivePlayer(session);
  const selectedDeckCard = getSelectedDeckCard(session);
  if (!selectedDeckCard) {
    return null;
  }

  const { selection, deck, card } = selectedDeckCard;
  const fruit = formatFruit(session, card.backFruit);
  const copy = getCopy(session);
  if (session.pendingFlip?.type === 'selected-deck' && session.pendingFlip.deckId === selection.deckId && session.pendingFlip.runtimeId === card.runtimeId) {
    deck.cards.shift();
    player.fruitCounts[card.backFruit] += 1;
    session.logs.push(copy.flippedDeckLog(player.name, selection.deckId, fruit));
    return copy.flippedDeckShort(player.name, selection.deckId, fruit);
  }

  player.salads.push(deck.cards.shift());
  session.logs.push(copy.tookSaladLog(player.name, selection.deckId));
  return copy.tookSaladShort(player.name, selection.deckId);
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
  const fruit = formatFruit(session, flippedCard.backFruit);
  const copy = getCopy(session);
  session.logs.push(copy.flippedAreaLog(player.name, fruit));
  return copy.flippedAreaShort(player.name, fruit);
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
  resetTurnTimer(session);
}

export function expireTurn(session) {
  if (!['turn', 'end_turn'].includes(session.stateMachine.state)) {
    return false;
  }

  if ((session.turnTimer?.limitMs ?? 0) <= 0) {
    return false;
  }

  if (canConfirmSelection(session)) {
    session.logs.push(getCopy(session).timeoutAutoConfirm(getActivePlayer(session).name));
    return confirmSelection(session);
  }

  session.pendingSelection = [];
  session.pendingFlip = null;
  session.lastAction = getCopy(session).timeoutSkipped(getActivePlayer(session).name);
  session.logs.push(session.lastAction);

  if (!canContinuePlay(session)) {
    session.stateMachine.transition('end_game');
    session.logs.push('State changed to end_game');
    return true;
  }

  advanceTurn(session);
  session.stateMachine.transition('turn');
  session.logs.push(getCopy(session).turnState(getActivePlayer(session).name));
  return true;
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
  session.logs.push(getCopy(session).turnState(getActivePlayer(session).name));
  return true;
}
