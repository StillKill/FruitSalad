export function buildDebugSnapshot(session) {
  const activePlayer = session.players[session.activePlayerIndex];
  const viewedPlayer = session.players[session.viewedPlayerIndex];
  const deckSummary = session.decks
    .map((deck) => `${deck.id}:${deck.cards.length}/${deck.market.length}`)
    .join(' | ');
  const previewLeader = session.scorePreview?.[0] ?? null;

  return [
    `state=${session.stateMachine.state}`,
    `turn=${session.turnNumber}`,
    `active=${activePlayer.name}`,
    `view=${viewedPlayer.name}`,
    `selected=${session.pendingSelection.length}`,
    `decks=${deckSummary}`,
    `liveScoring=${session.options.liveScoring}`,
    `activeScore=${activePlayer.score}`,
    `salads=${activePlayer.salads.length}`,
    `leader=${previewLeader ? `${previewLeader.playerName}:${previewLeader.totalPoints}` : 'n/a'}`
  ];
}