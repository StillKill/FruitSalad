export const MIN_PLAYER_COUNT = 2;
export const MAX_PLAYER_COUNT = 6;

export function buildDefaultPlayerNames(playerCount) {
  return Array.from({ length: playerCount }, (_, index) => `Player ${index + 1}`);
}

export function normalizeSessionOptions(options = {}) {
  const requestedCount = Number.isInteger(options.playerCount) ? options.playerCount : MIN_PLAYER_COUNT;
  const playerCount = Math.min(MAX_PLAYER_COUNT, Math.max(MIN_PLAYER_COUNT, requestedCount));
  const fallbackNames = buildDefaultPlayerNames(playerCount);
  const providedNames = Array.isArray(options.playerNames) ? options.playerNames : [];
  const playerNames = fallbackNames.map((fallbackName, index) => {
    const candidate = typeof providedNames[index] === 'string' ? providedNames[index].trim() : '';
    return candidate || fallbackName;
  });

  return {
    playerCount,
    playerNames,
    liveScoring: options.liveScoring === true,
    seedDemoProgress: options.seedDemoProgress === true
  };
}

export const defaultSessionOptions = normalizeSessionOptions({
  playerCount: MIN_PLAYER_COUNT,
  playerNames: buildDefaultPlayerNames(MIN_PLAYER_COUNT),
  liveScoring: false,
  seedDemoProgress: false
});
