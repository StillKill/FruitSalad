# Fruit Salad (Фруктовый Салат)

Цифровая версия Point Salad на Phaser 3 с локальным hot-seat мультиплеером для 2-6 игроков.

## Краткое описание
- Жанр: set collection / filler.
- Тема: фрукты вместо овощей.
- Режим: Web, локальная игровая сессия на одном экране.
- Базовый визуальный ориентир: `Fruit Salad layout.png`, адаптированный под Phaser-сцену.

## Актуальная структура проекта
```text
project-root/
├── index.html
├── index.js
├── project.md
├── .gitattributes
├── .gitignore
├── assets/
│   ├── audio/
│   ├── cards/
│   │   ├── fruits/
│   │   └── salads/
│   ├── layout/
│   │   └── fruit-salad-layout.png
│   └── ui/
├── data/
│   ├── cards/
│   │   └── scoring-cards.json
│   ├── debug/
│   │   └── debug-overlay-fields.json
│   └── sessions/
│       └── session-rules.json
├── skills/
│   ├── board-layout/
│   ├── gameplay-states/
│   ├── scoring-data/
│   ├── session-config/
│   └── ui-shell/
└── src/
    ├── config/
    ├── core/
    ├── data/
    ├── scenes/
    └── ui/
```

## Модули проекта
### 1. Board Layout
- Левая часть экрана: 3 колоды и рынок по 2 карты под каждой.
- Правая часть: панель текущего игрока, счетчики фруктов, карты салатов.
- Нижняя часть справа: вкладки игроков и debug overlay.
- Исходный ориентир по пропорциям и зонам хранить в `assets/layout/fruit-salad-layout.png`.

### 2. Session Config
- Сессия поддерживает 2-6 игроков.
- Количество карт для партии пока считается как `18 * количество игроков`.
- Настройки партии и лимиты setup лежат в `data/sessions/session-rules.json`.
- Полный каталог scoring-карт уже загружен в `data/cards/scoring-cards.json`.

### 3. Gameplay States
- `settings`: ввод количества и имен игроков.
- `setup`: создание игровой сессии, отбор карт, деление на 3 колоды и открытие рынка.
- `turn`: ожидание действий игрока.
- `end_turn`: игрок закончил выбор, доступна кнопка Confirm.
- `refresh`: пополнение рынка, восстановление пустой колоды, проверка конца игры.
- `end_game`: итоговый подсчет очков и popup с победителем.

### 4. UI Shell
- Settings dialog.
- Панель управления ходом: `Confirm`, `Reset`, строка подсказки.
- Tabs игроков и scoreboard.
- Debug overlay справа снизу.
- Позже можно добавить постоянную нижнюю панель со сводкой по всем игрокам.

### 5. Card & Scoring Data
- Карта рассматривается как двухсторонняя сущность:
  - лицевая сторона: scoring-правило;
  - обратная сторона: один фрукт.
- Источник правды для карточки: `id`, `ruleType`, `backFruit`, `saladFruits`, `scoring`.
- `name`, `templateId`, `family` не используются.
- В `scoring` хранится только структура очков, без дублирования типов фруктов, если их можно вывести из `ruleType` и `saladFruits`.
- Полный импорт из CSV выполнен: 108 карт, ID `000`-`107`.

## Названия типов scoring-карт
- `compare-majority`: больше всех фруктов указанного вида.
- `compare-minority`: меньше всех фруктов указанного вида.
- `compare-wealth`: больше всех фруктов суммарно, без учета видов.
- `compare-poverty`: меньше всех фруктов суммарно, без учета видов.
- `parity-fruit`: четное/нечетное количество указанного фрукта, но 0 не дает очков.
- `threshold-per-kind`: очки за каждый вид, достигший порога.
- `missing-kind`: очки за отсутствующие виды фруктов.
- `set-same-kind`: наборы одинаковых фруктов.
- `set-distinct-kind`: наборы разных фруктов, где число разных фруктов всегда равно `setSize`.
- `per-fruit-flat`: фиксированные очки за фрукт одного вида.
- `per-fruit-multi`: очки за несколько фруктов, перечисленных в `saladFruits`; порядок очков совпадает с порядком фруктов.

## Правила интерпретации scoring
- Для `compare-majority`, `compare-minority`, `parity-fruit` и `per-fruit-flat` целевой фрукт определяется по `saladFruits`.
- Для `compare-wealth` и `compare-poverty` всегда считается общая сумма фруктов игрока.
- Для `threshold-per-kind` и `missing-kind` правило всегда применяется ко всем 6 видам фруктов.
- Для `per-fruit-flat` в `saladFruits` должен быть ровно один фрукт.
- Для `per-fruit-multi` длина `scoring.points` должна совпадать с длиной `saladFruits`.
- Для `set-distinct-kind` количество разных фруктов в наборе всегда равно `setSize`, отдельное поле не нужно.
- Для `parity-fruit` используется `zeroScores = false`.

## Базовая сцена
- `preload`: грузит JSON-конфиги, полный каталог карт и reference layout image.
- `create`: создает prototype session на 2 игроков, строит shell интерфейса.
- `setup`: сейчас встроен в `buildSession()` и подготавливает колоды, рынок, игроков и state machine.

## Полезные поля для debug overlay
- `state`
- `turnNumber`
- `activePlayer`
- `viewedPlayer`
- `pendingSelection`
- `deckCounts`
- `marketCards`
- `currentPlayerFruitCounts`
- `currentPlayerSaladCount`
- `liveScoring`
- `lastAction`
- `lastScorePreview`
- `emptyDeckRecovery`

## План на end_game и scoring
### Этап 1. Нормализация данных
- Полный список карт уже загружен.
- Для каждой карты хранить: `id`, `ruleType`, `saladFruits`, `backFruit`, `scoring`.
- Определить, какие правила считаются по игроку локально, а какие требуют сравнения всех игроков.
- Зафиксировать tie rules для compare-механик.

### Этап 2. Scoring engine
- Сделать `scorePlayerCard(card, playerSnapshot, tableSnapshot)`.
- Сделать `scorePlayerTotal(playerSnapshot, ownedCards, tableSnapshot)`.
- Для `parity-fruit` учесть правило `zeroScores = false`.
- Для `per-fruit-multi` считать очки по фруктам из `saladFruits`, а не хранить дублирующий список фруктов в `scoring`.

### Этап 3. End game state
- После истощения всех колод переходить в `refresh -> end_game`.
- Замораживать финальный snapshot стола.
- Считать очки по всем картам каждого игрока.
- Собирать breakdown: карта -> формула -> очки.
- Показывать popup с местами, общими очками и детализацией.

### Этап 4. Unit tests
- После реализации scoring engine добавить unit-тесты.
- Предпочтительная цель: Jest, если решим подключать отдельный тестовый стек.
- Практичный fallback без внешних зависимостей: `node:test`.
- Минимальный набор тестов:
  - parity с нулем и без нуля;
  - threshold / missing;
  - same-kind / distinct-kind / set of 6;
  - compare-majority / compare-minority / wealth / poverty;
  - per-fruit-multi с отрицательными очками;
  - tie cases.

## Следующий шаг
- Реализовать scoring engine и unit-тесты.
- Потом перейти к `settings`, `turn/end_turn`, `refresh`, `end_game`.