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
- До получения полного списка карт используется prototype deck, разворачиваемый из шаблонов scoring-карт.

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
- В `data/cards/scoring-cards.json` сейчас хранится seed-каталог шаблонов, а не полный список 108 карт.
- После получения полного перечня карт заменить шаблоны на полную базу и убрать временное размножение шаблонов в setup.

## Названия типов scoring-карт
- `compare-majority`: больше всех фруктов указанного вида.
- `compare-minority`: меньше всех фруктов указанного вида.
- `compare-wealth`: больше всех фруктов суммарно.
- `compare-poverty`: меньше всех фруктов суммарно.
- `parity-fruit`: четное/нечетное количество указанного фрукта.
- `threshold-per-kind`: очки за каждый вид, достигший порога.
- `missing-kind`: очки за отсутствующие виды фруктов.
- `set-same-kind`: наборы одинаковых фруктов.
- `set-distinct-kind`: наборы разных фруктов.
- `set-rainbow-six`: набор из всех 6 фруктов.
- `per-fruit-flat`: фиксированные очки за фрукт одного вида.
- `per-fruit-ranking`: набор коэффициентов по нескольким указанным фруктам, включая отрицательные значения.

## Базовая сцена
- `preload`: грузит JSON-конфиги, seed-каталог карт и reference layout image.
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
- Зафиксировать полный список всех 108 карт.
- Для каждой карты хранить: `id`, `name`, `ruleType`, `saladFruits`, `backFruit`, `scoring`.
- Определить, какие правила считаются по игроку локально, а какие требуют сравнения всех игроков.

### Этап 2. Scoring engine
- Сделать `scorePlayerCard(card, playerSnapshot, tableSnapshot)`.
- Сделать `scorePlayerTotal(playerSnapshot, ownedCards, tableSnapshot)`.
- Для compare-типов отдельно определить правила тай-брейков.
- Для `per-fruit-ranking` считать вклад по каждому указанному фрукту независимо.

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
  - parity / threshold / missing;
  - same-kind / distinct-kind / rainbow;
  - compare-majority / compare-minority / wealth / poverty;
  - per-fruit-ranking с отрицательными очками;
  - tie cases.

## Запрос на следующую итерацию
Нужен полный список карт. Для каждой карты желательно передать:
- `name`
- `ruleType`
- описание scoring-условия
- список фруктов на салате
- фрукт на обратной стороне

Если удобно, можно прислать это таблицей или списком JSON-объектов.