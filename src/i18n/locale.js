const SUPPORTED_LOCALES = ['ru', 'en'];

const FRUIT_NAMES = {
  ru: {
    kiwi: 'Киви',
    orange: 'Апельсин',
    apple: 'Яблоко',
    banana: 'Банан',
    lime: 'Лайм',
    mango: 'Манго'
  },
  en: {
    kiwi: 'Kiwi',
    orange: 'Orange',
    apple: 'Apple',
    banana: 'Banana',
    lime: 'Lime',
    mango: 'Mango'
  }
};

const PARITY_LABELS = {
  ru: {
    even: 'чёт',
    odd: 'нечёт',
    zero: 'ноль'
  },
  en: {
    even: 'even',
    odd: 'odd',
    zero: 'zero'
  }
};

const CARD_COPY = {
  ru: {
    compareMajority: 'Больше всех',
    compareMinority: 'Меньше всех',
    compareWealth: 'Больше фруктов',
    comparePoverty: 'Меньше фруктов',
    parity: 'Чёт / Нечёт',
    thresholdKinds: (threshold) => `${threshold}+ видов`,
    thresholdEachKind: (threshold) => `${threshold}+ каждого`,
    each: 'за каждый',
    missingKinds: 'Отсутств. виды',
    missingKind: 'Отсутств. вид',
    setOf: (size) => `Набор из ${size}`,
    kinds: (size) => `${size} вида`
  },
  en: {
    compareMajority: 'Most wins',
    compareMinority: 'Least wins',
    compareWealth: 'Most fruit',
    comparePoverty: 'Least fruit',
    parity: 'Even / Odd',
    thresholdKinds: (threshold) => `${threshold}+ kinds`,
    thresholdEachKind: (threshold) => `${threshold}+ each kind`,
    each: 'each',
    missingKinds: 'Missing kinds',
    missingKind: 'Missing kind',
    setOf: (size) => `Set of ${size}`,
    kinds: (size) => `${size} kinds`
  }
};

const UI_COPY = {
  ru: {
    gameTitle: 'Фруктовый Салат',
    setupTitle: 'Настройка партии',
    setupLead: 'Выберите число игроков, затем кликните по полю имени и введите текст. Нажмите Enter, чтобы начать обычную партию.',
    setupDemo: 'Нужен быстрый просмотр интерфейса и подсчёта? Запустите демо-партию с предзаполненным прогрессом.',
    players: 'Игроки',
    names: 'Имена',
    openDemo: 'Открыть демо',
    startFairGame: 'Начать партию',
    typeName: 'Введите имя',
    turn: (name) => `Ход: ${name}`,
    endGameReached: 'Игра завершена',
    confirm: 'Подтвердить',
    reset: 'Сброс',
    leader: 'Лидер',
    flip: 'Переворот',
    none: 'нет',
    marketTitle: 'Колоды и рынок',
    saladsLeft: (count) => `${count} салатов`,
    deckEmpty: 'Колода пуста',
    keepAsSalad: 'Оставить салатом',
    flipToFruit: 'Перевернуть во фрукт',
    playerArea: (name) => `Зона: ${name}`,
    activePlayer: (name) => `Активный: ${name}`,
    saladCards: (count) => `Карты салата (${count})`,
    flipMode: 'Режим переворота',
    preview: (score) => `Превью: ${score}`,
    debugOverlay: 'Отладочный оверлей',
    finalResults: 'Итоги партии',
    winner: (name, points) => `${name} побеждает с ${points} очками`,
    gameFinished: 'Партия завершена',
    breakdown: (name) => `Разбор: ${name}`,
    placement: 'Место',
    total: 'Сумма',
    scoringCards: 'Карты подсчёта',
    fruits: 'Фрукты',
    standings: 'Рейтинг',
    noScoredSalads: 'В этой партии не было зачтённых салатных карт.',
    playerLabel: (index) => `Игрок ${index}`,
    placementShort: (placement) => `${placement}-е`,
    debugStateLine: ({ state, turnNumber, activePlayer, viewedPlayer }) =>
      `сост=${state}  ход=${turnNumber}  активный=${activePlayer}  просмотр=${viewedPlayer}`,
    debugSelectedLine: ({ selected, pendingFlip, salads, score }) =>
      `выбор=${selected}  переворот=${pendingFlip}  салаты=${salads}  счёт=${score}`,
    debugLeaderLine: ({ leader, decks }) => `лидер=${leader}  колоды=${decks}`,
    debugLastLine: ({ lastAction }) => `посл=${lastAction}`,
    pendingFlipArea: (fruit) => `зона:${fruit}`,
    pendingFlipDeck: (deckId, fruit) => `${deckId}:${fruit}`,
    pendingSelectionDeck: (deckId) => `${deckId}:салат`,
    breakdownCompare: (ruleType, metric, points) => `${ruleType} -> метрика ${metric}, карта ${points}`,
    breakdownParity: (fruit, parity, count, points) => `${fruit} ${parity} (${count}) -> ${points}`,
    breakdownThreshold: (qualifiedKinds, threshold, points) => `${qualifiedKinds} видов по ${threshold}+ -> ${points}`,
    breakdownMissing: (missingKinds, points) => `${missingKinds} отсутствует -> ${points}`,
    breakdownSameKind: (fruit, count, sets, points) => `${fruit} x${count}, наборов ${sets} -> ${points}`,
    breakdownDistinct: (sets, size, points) => `${sets} разных наборов по ${size} -> ${points}`,
    breakdownPerFruitFlat: (fruit, count, perFruit, points) => `${fruit} x${count} @ ${perFruit} -> ${points}`
  },
  en: {
    gameTitle: 'Fruit Salad Prototype',
    setupTitle: 'Fruit Salad Setup',
    setupLead: 'Choose the player count, then click a name field to type. Press Enter to start a fair session.',
    setupDemo: 'Need a fast UI/scoring preview instead? Launch the demo session with seeded progress.',
    players: 'Players',
    names: 'Names',
    openDemo: 'Open Demo',
    startFairGame: 'Start Fair Game',
    typeName: 'Type a name',
    turn: (name) => `${name} turn`,
    endGameReached: 'End game reached',
    confirm: 'Confirm',
    reset: 'Reset',
    leader: 'Leader',
    flip: 'Flip',
    none: 'none',
    marketTitle: 'Decks & Market',
    saladsLeft: (count) => `${count} salads left`,
    deckEmpty: 'Deck empty',
    keepAsSalad: 'Keep as Salad',
    flipToFruit: 'Flip to Fruit',
    playerArea: (name) => `${name} area`,
    activePlayer: (name) => `Active: ${name}`,
    saladCards: (count) => `Salad cards (${count})`,
    flipMode: 'Flip Mode',
    preview: (score) => `Preview: ${score}`,
    debugOverlay: 'Debug overlay',
    finalResults: 'Final Results',
    winner: (name, points) => `${name} wins with ${points} points`,
    gameFinished: 'Game finished',
    breakdown: (name) => `${name} Breakdown`,
    placement: 'Placement',
    total: 'Total',
    scoringCards: 'Scoring cards',
    fruits: 'Fruits',
    standings: 'Standings',
    noScoredSalads: 'No salad cards scored in this game.',
    playerLabel: (index) => `Player ${index}`,
    placementShort: (placement) => {
      const suffix = placement === 1 ? 'st' : placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th';
      return `${placement}${suffix}`;
    },
    debugStateLine: ({ state, turnNumber, activePlayer, viewedPlayer }) =>
      `state=${state}  turn=${turnNumber}  active=${activePlayer}  view=${viewedPlayer}`,
    debugSelectedLine: ({ selected, pendingFlip, salads, score }) =>
      `selected=${selected}  flip=${pendingFlip}  salads=${salads}  score=${score}`,
    debugLeaderLine: ({ leader, decks }) => `leader=${leader}  decks=${decks}`,
    debugLastLine: ({ lastAction }) => `last=${lastAction}`,
    pendingFlipArea: (fruit) => `area:${fruit}`,
    pendingFlipDeck: (deckId, fruit) => `${deckId}:${fruit}`,
    pendingSelectionDeck: (deckId) => `${deckId}:salad`,
    breakdownCompare: (ruleType, metric, points) => `${ruleType} -> metric ${metric}, card ${points}`,
    breakdownParity: (fruit, parity, count, points) => `${fruit} ${parity} (${count}) -> ${points}`,
    breakdownThreshold: (qualifiedKinds, threshold, points) => `${qualifiedKinds} kinds at ${threshold}+ -> ${points}`,
    breakdownMissing: (missingKinds, points) => `${missingKinds} missing kinds -> ${points}`,
    breakdownSameKind: (fruit, count, sets, points) => `${fruit} x${count}, ${sets} sets -> ${points}`,
    breakdownDistinct: (sets, size, points) => `${sets} distinct sets of ${size} -> ${points}`,
    breakdownPerFruitFlat: (fruit, count, perFruit, points) => `${fruit} x${count} @ ${perFruit} -> ${points}`
  }
};

export function normalizeLocale(locale) {
  if (typeof locale !== 'string') {
    return 'ru';
  }

  const shortLocale = locale.trim().toLowerCase().slice(0, 2);
  return SUPPORTED_LOCALES.includes(shortLocale) ? shortLocale : 'ru';
}

export function detectGameLocale() {
  try {
    const queryLocale = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    if (queryLocale) {
      return normalizeLocale(queryLocale);
    }
  } catch {}

  const navigatorLocale = globalThis.navigator?.languages?.[0] ?? globalThis.navigator?.language ?? 'ru';
  return normalizeLocale(navigatorLocale);
}

export function getLocaleCopy(locale) {
  return UI_COPY[normalizeLocale(locale)];
}

export function getFruitName(fruit, locale) {
  const normalizedLocale = normalizeLocale(locale);
  return FRUIT_NAMES[normalizedLocale][fruit] ?? fruit;
}

export function getFruitCounterLabel(fruit, locale) {
  const localizedFruit = getFruitName(fruit, locale);
  return normalizeLocale(locale) === 'en' ? localizedFruit.toUpperCase() : localizedFruit;
}

export function getParityLabel(parity, locale) {
  const normalizedLocale = normalizeLocale(locale);
  return PARITY_LABELS[normalizedLocale][parity] ?? parity;
}

export function getCardCopy(locale) {
  return CARD_COPY[normalizeLocale(locale)];
}

export function buildPlayerName(index, locale) {
  return getLocaleCopy(locale).playerLabel(index);
}

export function shouldFlipFruitCard(locale) {
  return normalizeLocale(locale) === 'en';
}
