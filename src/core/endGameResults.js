import { scoreTable } from './scoring/scoringEngine.js';

function clonePlayerState(player) {
  return {
    id: player.id,
    name: player.name,
    playerId: player.id,
    playerName: player.name,
    fruitCounts: structuredClone(player.fruitCounts),
    salads: player.salads.map((card) => structuredClone(card))
  };
}

function assignPlacements(sortedEntries) {
  let previousPoints = null;
  let previousPlacement = 0;

  return sortedEntries.map((entry, index) => {
    const placement = previousPoints === entry.totalPoints ? previousPlacement : index + 1;
    previousPoints = entry.totalPoints;
    previousPlacement = placement;

    return {
      ...entry,
      placement
    };
  });
}

export function buildEndGameResults(players, fruits) {
  const frozenPlayers = players.map(clonePlayerState);
  const scoreEntries = scoreTable(frozenPlayers, fruits)
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      return left.playerName.localeCompare(right.playerName);
    });

  const rankedEntries = assignPlacements(scoreEntries);

  return {
    winner: rankedEntries[0] ?? null,
    standings: rankedEntries,
    playerStates: frozenPlayers
  };
}
