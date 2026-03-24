# Fruit Salad (Фруктовый Салат)

Цифровая версия Point Salad на Phaser 3 с локальным hot-seat мультиплеером для 2-6 игроков.

## Краткое описание
- Жанр: set collection / filler.
- Тема: фрукты вместо овощей.
- Режим: Web, локальная игровая сессия на одном экране.
- Базовый визуальный ориентир: `Fruit Salad layout.png`, адаптированный под Phaser-сцену.

## Инструкции для агентов
- Операционные правила проекта вынесены в `AGENTS.md` в корне репозитория.
- `project.md` хранит описание проекта, целевую структуру и план.

## Routing по skills
- Папка `skills/` не участвует в runtime, но используется как слой task-routing и дополнительного контекста для агентов.
- Если задача связана с layout или компоновкой сцены, сначала смотреть `skills/board-layout/`.
- Если задача связана с gameplay flow, state transitions или turn rules, сначала смотреть `skills/gameplay-states/`.
- Если задача связана с каталогом карт, rule schema или scoring rules, сначала смотреть `skills/scoring-data/`.
- Если задача связана с настройками сессии и setup limits, сначала смотреть `skills/session-config/`.
- Если задача связана с интерфейсом, контролами, tabs, overlay, popup или settings dialog, сначала смотреть `skills/ui-shell/`.

## Актуальная структура проекта
```text
project-root/
├── AGENTS.md
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
├── skills/                # task-specific agent context and routing notes
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
- Количество игроков и имена задаются на этапе `settings`.
- На старте доступны два режима запуска: честная партия через `settings` и demo/simulation с seeded progress для быстрой проверки UI.
- Количество карт для партии берется из `playerCardPoolByCount`, а при отсутствии записи — из `cardsPerPlayer * количество игроков`.
- Перед раскладкой по 3 колодам выбранный пул карт перемешивается по seed, чтобы рынок не зависел от исходного порядка каталога.
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
- Отдельный demo launch для seeded prototype session.
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
- `create`: показывает `settings`, откуда можно запустить честную сессию или demo/simulation режим.
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
- После истощения всех колод переходить в `refresh -> end_game`.
- Замораживать финальный snapshot стола для итогового подсчета.
- Считать очки по всем салатным картам каждого игрока.
- Собирать breakdown: карта -> формула -> очки.
- Показывать popup с местами, общими очками и детализацией.

## План
- Поддерживать `changes.md` как краткий журнал завершенных задач и проверок.
- Добавить переключение просмотра игроков через tabs, чтобы `viewedPlayerIndex` влиял на правую панель.
- Довести `end_game`: финальный snapshot, итоговые места, breakdown по картам и popup.
- При необходимости расширить demo/simulation режим отдельными debug controls вместо простого seeded launch.
