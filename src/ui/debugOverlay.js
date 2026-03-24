export function buildDebugSnapshot(session) {
  const activePlayer = session.players[session.activePlayerIndex];
  const viewedPlayer = session.players[session.viewedPlayerIndex];
  const deckSummary = session.decks
    .map((deck, index) => {
      const marketFruits = deck.market.map((card) => card.fruit).join(',');
      const deckId = `D${index + 1}`;
      return marketFruits
        ? `${deckId}:${deck.cards.length}/${deck.market.length}[${marketFruits}]`
        : `${deckId}:${deck.cards.length}/${deck.market.length}`;
    })
    .join('  ');
  const previewLeader = session.scorePreview?.[0] ?? null;
  const lastAction = session.lastAction ?? 'n/a';
  const selected = session.pendingSelection.length > 0
    ? session.pendingSelection.map((selection) => selection.type === 'deck' ? `${selection.deckId}:salad` : `${selection.deckId}:${selection.fruit}`).join(', ')
    : 'none';

  return [
    `state=${session.stateMachine.state}  turn=${session.turnNumber}  active=${activePlayer.name}  view=${viewedPlayer.name}`,
    `selected=${selected}  salads=${activePlayer.salads.length}  score=${activePlayer.score}  leader=${previewLeader ? `${previewLeader.playerName}:${previewLeader.totalPoints}` : 'n/a'}`,
    `decks=${deckSummary}`,
    `last=${lastAction}`
  ];
}
