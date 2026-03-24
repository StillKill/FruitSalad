# Fruit Salad (Фруктовый Салат)

Цифровая версия Point Salad на Phaser 3 с локальным hot-seat мультиплеером для 2-6 игроков.

## Краткое описание
- Жанр: set collection / filler.
- Тема: фрукты вместо овощей.
- Режим: Web, локальная игровая сессия на одном экране.
- Базовый визуальный ориентир: `Fruit Salad layout.png`, адаптированный под Phaser-сцену.

## Постоянные правила для работы агентов
- Комментарии в коде, docstrings, README-фрагменты и техническая документация внутри файлов проекта писать только на английском. Коммуникация с пользователем всегда на русском.
- После каждого завершенного этапа проверять результат: запускать релевантные тесты, выполнять ручную проверку или добавлять недостающие проверки, если текущей валидации недостаточно.
- После каждой содержательной серии изменений готовить отдельный git commit. Если commit временно невозможен из-за блокировки окружения или нужен отдельный confirm, явно сообщать об этом пользователю.
- Каждую завершенную задачу кратко фиксировать в `changes.md`: дата, что изменено, как проверено.
- Любые изменения в `project.md` и в описаниях или структуре `skills/` сначала согласовывать с пользователем, затем вносить в репозиторий.
- Если по ходу работы обнаружены полезные, но отложенные изменения, добавлять их в раздел `План` в конце `project.md`, а не оставлять в виде разрозненных TODO.

## Актуальная структура проекта
```text
project-root/
├── index.html
├── index.js
├── changes.md
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

## Модель карты
- Каждая физическая карта двусторонняя.
- `backFruit` — фруктовая сторона карты, то есть какая фруктовая карта достается игроку, если он берет эту сторону.
- `ruleType + saladFruits + scoring` — салатная сторона карты, которая остается у игрока как scoring card.
- `backFruit` не обязан совпадать ни с одним элементом `saladFruits`.
- В конце игры игрок оценивает все свои салатные карты по множеству собранных фруктовых карт.

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
- Для `compare-majority`, `compare-minority`, `parity-fruit` и `per-fruit-flat` целевой фрукт определяется по `saladFruits`, а не по `backFruit`.
- Для `compare-wealth` и `compare-poverty` всегда считается общая сумма фруктов игрока.
- Для `threshold-per-kind` и `missing-kind` правило всегда применяется ко всем 6 видам фруктов.
- Для `per-fruit-flat` в `saladFruits` должен быть ровно один фрукт.
- Для `per-fruit-multi` длина `scoring.points` должна совпадать с длиной `saladFruits`.
- Для `set-distinct-kind` количество разных фруктов в наборе всегда равно `setSize`, отдельное поле не нужно.
- Для `parity-fruit` используется `zeroScores = false`.
- Текущее допущение по compare-картам: если экстремум делят несколько игроков, карта дает `0`.

## End Game модель
- У игрока есть две отдельные коллекции:
  - фруктовые карты;
  - салатные scoring-карты.
- Подсчет в `end_game` идет по каждой салатной карте отдельно.
- Вход для scoring engine:
  - список салатов игрока;
  - агрегированные количества фруктов игрока;
  - при compare-правилах также snapshot всех игроков.

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
- Реализованы `scoreSaladCard(card, fruitCounts, tableSnapshot)`, `scorePlayerTotal(saladCards, fruitCounts, tableSnapshot)` и `buildTableSnapshot(players)`.
- Для `parity-fruit` учтено правило `zeroScores = false`.
- Для `per-fruit-multi` очки считаются по фруктам из `saladFruits`.
- Для compare-карт при ничьей по экстремуму начисляется `0`.

### Этап 3. End game state
- После истощения всех колод переходить в `refresh -> end_game`.
- Замораживать финальный snapshot стола.
- Считать очки по всем салатным картам каждого игрока.
- Собирать breakdown: карта -> формула -> очки.
- Показывать popup с местами, общими очками и детализацией.

### Этап 4. Unit tests
- Базовые unit-тесты на scoring engine добавлены на `node:test`.
- Покрыты parity / threshold / missing / sets / compare / per-fruit-multi / total aggregation.
- Отдельно проверена tie-механика compare-карт.

## План
- Поддерживать `changes.md` как краткий журнал завершенных задач и проверок.
- Интегрировать scoring engine в `end_game` и debug preview.
- Потом перейти к `settings`, `turn/end_turn`, `refresh`, `end_game`.
