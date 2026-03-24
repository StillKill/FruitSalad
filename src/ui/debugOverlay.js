import { getPendingSelectionSummary } from '../core/sessionActions.js';

export function buildDebugSnapshot(session) {
  const activePlayer = session.players[session.activePlayerIndex];
  const viewedPlayer = session.players[session.viewedPlayerIndex];
  const deckSummary = session.decks
    .map((deck) => {
      const marketFruits = deck.market.map((card) => card.fruit).join(',');
      return `${deck.id}:${deck.cards.length}/${deck.market.length}[${marketFruits}]`;
    })
    .join(' | ');
  const previewLeader = session.scorePreview?.[0] ?? null;

  return [
    `state=${session.stateMachine.state}`,
    `turn=${session.turnNumber}`,
    `active=${activePlayer.name}`,
    `view=${viewedPlayer.name}`,
    `selected=${getPendingSelectionSummary(session)}`,
    `decks=${deckSummary}`,
    `liveScoring=${session.options.liveScoring}`,
    `activeScore=${activePlayer.score}`,
    `salads=${activePlayer.salads.length}`,
    `lastAction=${session.lastAction ?? 'n/a'}`,
    `leader=${previewLeader ? `${previewLeader.playerName}:${previewLeader.totalPoints}` : 'n/a'}`
  ];
}
