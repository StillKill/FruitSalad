import { buildPlayerName, normalizeLocale } from '../i18n/locale.js';

export const MIN_PLAYER_COUNT = 2;
export const MAX_PLAYER_COUNT = 6;

export function buildDefaultPlayerNames(playerCount, locale = 'ru') {
  const resolvedLocale = normalizeLocale(locale);
  return Array.from({ length: playerCount }, (_, index) => buildPlayerName(index + 1, resolvedLocale));
}

export function relocalizePlayerNames(playerNames = [], playerCount, fromLocale = 'ru', toLocale = 'ru') {
  const sourceNames = buildDefaultPlayerNames(playerCount, fromLocale);
  const targetNames = buildDefaultPlayerNames(playerCount, toLocale);

  return Array.from({ length: playerCount }, (_, index) => {
    const currentName = typeof playerNames[index] === 'string' ? playerNames[index].trim() : '';
    if (!currentName) {
      return targetNames[index];
    }

    return currentName === sourceNames[index] ? targetNames[index] : currentName;
  });
}

export function normalizeSessionOptions(options = {}, locale = 'ru') {
  const requestedCount = Number.isInteger(options.playerCount) ? options.playerCount : MIN_PLAYER_COUNT;
  const playerCount = Math.min(MAX_PLAYER_COUNT, Math.max(MIN_PLAYER_COUNT, requestedCount));
  const resolvedLocale = normalizeLocale(options.locale ?? locale);
  const fallbackNames = buildDefaultPlayerNames(playerCount, resolvedLocale);
  const providedNames = Array.isArray(options.playerNames) ? options.playerNames : [];
  const playerNames = fallbackNames.map((fallbackName, index) => {
    const candidate = typeof providedNames[index] === 'string' ? providedNames[index].trim() : '';
    return candidate || fallbackName;
  });

  return {
    playerCount,
    playerNames,
    locale: resolvedLocale,
    liveScoring: options.liveScoring === true,
    seedDemoProgress: options.seedDemoProgress === true,
    randomSeed: Number.isInteger(options.randomSeed) ? options.randomSeed : null
  };
}

export const defaultSessionOptions = normalizeSessionOptions({
  playerCount: MIN_PLAYER_COUNT,
  playerNames: buildDefaultPlayerNames(MIN_PLAYER_COUNT, 'ru'),
  locale: 'ru',
  liveScoring: false,
  seedDemoProgress: false,
  randomSeed: null
}, 'ru');
