import { getLocaleCopy, getFruitName, normalizeLocale } from '../i18n/locale.js';

export function buildDebugSnapshot(session, locale = session?.options?.locale) {
  const resolvedLocale = normalizeLocale(locale ?? session?.options?.locale ?? 'ru');
  const copy = getLocaleCopy(resolvedLocale);
  const activePlayer = session.players[session.activePlayerIndex];
  const viewedPlayer = session.players[session.viewedPlayerIndex];
  const deckSummary = session.decks
    .map((deck, index) => {
      const marketFruits = deck.market.map((card) => getFruitName(card.fruit, resolvedLocale)).join(',');
      const deckId = `D${index + 1}`;
      return marketFruits
        ? `${deckId}:${deck.cards.length}/${deck.market.length}[${marketFruits}]`
        : `${deckId}:${deck.cards.length}/${deck.market.length}`;
    })
    .join('  ');
  const previewLeader = session.scorePreview?.[0] ?? null;
  const lastAction = session.lastAction ?? copy.none;
  const selected = session.pendingSelection.length > 0
    ? session.pendingSelection.map((selection) => selection.type === 'deck'
      ? copy.pendingSelectionDeck(selection.deckId)
      : `${selection.deckId}:${getFruitName(selection.fruit, resolvedLocale)}`).join(', ')
    : copy.none;
  const pendingFlip = session.pendingFlip
    ? session.pendingFlip.type === 'player-salad'
      ? copy.pendingFlipArea(session.pendingFlip.cardId)
      : copy.pendingFlipDeck(session.pendingFlip.deckId, session.pendingFlip.cardId)
    : copy.none;

  return [
    `lang=${resolvedLocale}`,
    copy.debugStateLine({ state: session.stateMachine.state, turnNumber: session.turnNumber, activePlayer: activePlayer.name, viewedPlayer: viewedPlayer.name }),
    copy.debugSelectedLine({ selected, pendingFlip, salads: activePlayer.salads.length, score: activePlayer.score }),
    copy.debugLeaderLine({ leader: previewLeader ? `${previewLeader.playerName}:${previewLeader.totalPoints}` : copy.none, decks: deckSummary }),
    copy.debugLastLine({ lastAction })
  ];
}
