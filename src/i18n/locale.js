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
    compareWealth: 'Больше фр.',
    comparePoverty: 'Меньше фр.',
    parity: 'Чёт / Нечёт',
    thresholdKinds: (threshold) => `${threshold}+ видов`,
    thresholdEachKind: (threshold) => `${threshold}+ / вид`,
    each: '/вид',
    missingKinds: 'Нет видов',
    missingKind: 'Нет вида',
    setOf: (size) => `Сет из ${size}`,
    kinds: (size) => `${size} вида`
  },
  en: {
    compareMajority: 'Most wins',
    compareMinority: 'Least wins',
    compareWealth: 'Most fruit',
    comparePoverty: 'Least fruit',
    parity: 'Even / Odd',
    thresholdKinds: (threshold) => `${threshold}+ kinds`,
    thresholdEachKind: (threshold) => `${threshold}+ / kind`,
    each: '/kind',
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
    setupLead: 'Настройте честную партию, затем нажмите New Game. Если есть сохранение, можно сразу продолжить текущую сессию.',
    setupDemo: 'Быстрый просмотр интерфейса и подсчёта с предзаполненным прогрессом, без сохранения.',
    fairGame: 'Fair Game',
    demoMode: 'Demo Mode',
    savedFairSessionReady: 'Найдена сохранённая честная партия. Continue восстановит её с текущего хода, а New Game начнёт новую и сотрёт старый сейв.',
    soundSettings: '\u0417\u0432\u0443\u043a',
    soundVolume: (value) => '\u0413\u0440\u043e\u043c\u043a\u043e\u0441\u0442\u044c ' + value + '%',
    soundMuted: '\u0411\u0435\u0437 \u0437\u0432\u0443\u043a\u0430',
    muteSound: '\u0412\u044b\u043a\u043b\u044e\u0447\u0438\u0442\u044c',
    unmuteSound: '\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c',
    players: 'Игроки',
    names: 'Имена',
    openDemo: 'Open Demo',
    continueGame: 'Continue',
    newGame: 'New Game',
    startFairGame: 'Начать партию',
    backToSettings: 'В меню',
    typeName: 'Введите имя',
    turn: (name) => `Ход: ${name}`,
    turnTimer: (value) => `\u0422\u0430\u0439\u043c\u0435\u0440: ${value}`,
    endGameReached: 'Игра завершена',
    confirm: 'Подтвердить',
    reset: 'Сброс',
    leader: 'Лидер',
    flip: 'Переворот',
    none: 'нет',
    marketTitle: 'Колоды и рынок',
    saladsLeft: (count) => `${count} салатов`,
    deckLabel: (index) => `Колода ${index}`,
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
    debugStateLine: ({ state, turnNumber, activePlayer, viewedPlayer, timer }) =>
      `\u0441\u043e\u0441\u0442=${state}  \u0445\u043e\u0434=${turnNumber}  \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0439=${activePlayer}  \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440=${viewedPlayer}  \u0442\u0430\u0439\u043c\u0435\u0440=${timer}`,
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
    setupLead: 'Set up a fair game, then press New Game. If a save exists, you can continue the current session right away.',
    setupDemo: 'A quick UI and scoring preview with seeded progress and no persistence.',
    fairGame: 'Fair Game',
    demoMode: 'Demo Mode',
    savedFairSessionReady: 'A saved fair session is ready. Continue restores it from the current turn, while New Game starts fresh and clears the old save.',
    soundSettings: 'Sound',
    soundVolume: (value) => 'Volume ' + value + '%',
    soundMuted: 'Muted',
    muteSound: 'Mute',
    unmuteSound: 'Unmute',
    players: 'Players',
    names: 'Names',
    openDemo: 'Open Demo',
    continueGame: 'Continue',
    newGame: 'New Game',
    startFairGame: 'Start Fair Game',
    backToSettings: 'Back to Menu',
    typeName: 'Type a name',
    turn: (name) => `${name} turn`,
    turnTimer: (value) => `Timer: ${value}`,
    endGameReached: 'End game reached',
    confirm: 'Confirm',
    reset: 'Reset',
    leader: 'Leader',
    flip: 'Flip',
    none: 'none',
    marketTitle: 'Decks & Market',
    saladsLeft: (count) => `${count} salads left`,
    deckLabel: (index) => `Deck ${index}`,
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
    debugStateLine: ({ state, turnNumber, activePlayer, viewedPlayer, timer }) =>
      `state=${state}  turn=${turnNumber}  active=${activePlayer}  view=${viewedPlayer}  timer=${timer}`,
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
  const normalizedLocale = normalizeLocale(locale);
  const copy = UI_COPY[normalizedLocale];

  if (normalizedLocale === 'ru') {
    return {
      ...copy,
      setupLead: '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u0442\u0435 \u0438\u0433\u0440\u0443, \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0436\u0438\u043c \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 New Game. \u0415\u0441\u043b\u0438 \u0435\u0441\u0442\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435, \u043c\u043e\u0436\u043d\u043e \u0441\u0440\u0430\u0437\u0443 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0443\u044e \u0441\u0435\u0441\u0441\u0438\u044e.',
      savedFairSessionReady: '\u041d\u0430\u0439\u0434\u0435\u043d\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0430\u044f \u0438\u0433\u0440\u0430. Continue \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442 \u0435\u0451 \u0441 \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u0445\u043e\u0434\u0430, \u0430 New Game \u043d\u0430\u0447\u043d\u0451\u0442 \u043d\u043e\u0432\u0443\u044e \u0438 \u0441\u043e\u0442\u0440\u0451\u0442 \u0441\u0442\u0430\u0440\u044b\u0439 \u0441\u0435\u0439\u0432.',
      mode: '\u0420\u0435\u0436\u0438\u043c',
      modeGame: '\u0418\u0433\u0440\u0430',
      modeGameHint: '\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u043d\u044b\u0439 \u043f\u0443\u043b \u043a\u0430\u0440\u0442 \u043f\u043e \u0447\u0438\u0441\u043b\u0443 \u0438\u0433\u0440\u043e\u043a\u043e\u0432.',
      modeFreestyle: 'Freestyle',
      modeFreestyleHint: '\u0412\u0441\u0435\u0433\u0434\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f \u0432\u0441\u044f \u043a\u043e\u043b\u043e\u0434\u0430, \u043d\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043c\u043e \u043e\u0442 \u0447\u0438\u0441\u043b\u0430 \u0438\u0433\u0440\u043e\u043a\u043e\u0432.'
    };
  }

  return {
    ...copy,
    setupLead: 'Set up a game, choose a mode, then press New Game. If a save exists, you can continue the current session right away.',
    savedFairSessionReady: 'A saved game is ready. Continue restores it from the current turn, while New Game starts fresh and clears the old save.',
    mode: 'Mode',
    modeGame: 'Game',
    modeGameHint: 'Standard player-based card pool.',
    modeFreestyle: 'Freestyle',
    modeFreestyleHint: 'Always uses the full deck regardless of player count.'
  };
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
