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

## Text Encoding Policy
- Canonical text encoding for project files is UTF-8 without BOM.
- Canonical line ending for project text files is LF.
- Repository-local git config should keep `core.autocrlf=false` so Windows checkouts do not reintroduce CRLF into tracked text files.
- Any edit to files with Cyrillic or other non-ASCII text must preserve readable UTF-8 content in both the file and `git diff`.
- If an edit tool produces mojibake, restore the file from git immediately and redo the change with explicit UTF-8 handling.
- If patch-based edits begin rejecting hunks, use `npm run text:check` and `npm run text:fix` before retrying.

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
- Правая часть: панель просматриваемого игрока, счетчики фруктов и карты салатов; во время своего хода можно переключать просмотр через tabs.
- Нижняя часть справа: вкладки игроков и debug overlay.
- Исходный ориентир по пропорциям и зонам хранить в `assets/layout/fruit-salad-layout.png`.

### 2. Session Config
- Сессия поддерживает 2-6 игроков.
- Количество игроков и имена задаются на этапе `settings`.
- На старте доступны два режима запуска: честная партия через `settings` и demo/simulation с seeded progress для быстрой проверки UI.
- Количество карт для партии берется из `playerCardPoolByCount`, а при отсутствии записи — из `cardsPerPlayer * количество игроков`.
- Перед раскладкой по 3 колодам выбранный пул карт перемешивается по seed, чтобы рынок не зависел от исходного порядка каталога.
- Если при пополнении рынка колода пуста, она восстанавливается за счёт нижней половины самой толстой из оставшихся колод; при равенстве для детерминизма берётся первая подходящая колода по порядку.
- Настройки партии и лимиты setup лежат в `data/sessions/session-rules.json`.
- Turn timer defaults to `timeLimitSeconds` from `data/sessions/session-rules.json`; the current prototype value is 120 seconds per player.
- Полный каталог scoring-карт уже загружен в `data/cards/scoring-cards.json`.

### 3. Gameplay States
- `settings`: ввод количества и имен игроков.
- `setup`: создание игровой сессии, отбор карт, деление на 3 колоды и открытие рынка.
- `turn`: ожидание действий игрока, включая необязательный переворот 1 салатной карты в `backFruit` один раз за ход.
- `end_turn`: игрок закончил основной выбор; pending flip не блокирует и не требует Confirm сам по себе.
- `refresh`: пополнение рынка, восстановление пустой колоды по правилу split-the-thickest-deck, проверка конца игры.
- `end_game`: замораживание финального snapshot, итоговый подсчет очков, места, breakdown по картам и popup результатов.
- If the timer expires with a confirmable selection, the game auto-confirms it; otherwise pending selection and pending flip are cleared and the turn is skipped.

### 4. UI Shell
- Settings dialog.
- Runtime localization supports `ru` and `en`. The scene resolves locale from `?lang=` first and browser language second, exposes a manual `RU/EN` switch in settings and during play, and English fruit cards reuse the same bilingual fruit asset by flipping the image on both axes instead of duplicating PNG files.
- Settings and control-panel layout should stay resilient to localization: section spacing is driven by rendered text height, name fields scale to the available column width, and the in-game language toggle keeps its own reserved area instead of sharing button space with `Confirm` / `Reset`.
- Market deck headers should use localized player-facing labels, and salad-card center copy should prefer compact localized phrasing so bilingual gameplay text stays legible before a later icon-first redesign.
- Панель управления ходом: `Confirm`, `Reset`, строка подсказки и статус pending flip.
- Tabs игроков и scoreboard; активный игрок и просматриваемый игрок различаются визуально.
- Для верхней карты выбранной колоды доступна отдельная кнопка переворота в `backFruit`, а для салатов в области активного игрока используется кнопка-переключатель `Flip Mode` с выбором одной карты следующим кликом.
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
- `per-fruit-multi`: очки за несколько фруктов, перечисленных в `saladFruits`; в данных порядок очков совпадает с порядком фруктов, но на карте список отображается по убыванию очков.

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
- При переходе в `end_game` игра замораживает финальный snapshot игроков: фруктовые количества, салатные карты и рассчитанные totals больше не зависят от дальнейших изменений runtime-состояния.
- Итоговый overlay показывает:
  - победителя;
  - места всех игроков с учетом tie placements;
  - summary-метрики выбранного игрока;
  - визуальный breakdown выбранного игрока по каждой салатной карте с мини-картой и явными очками за карту.
- Для breakdown каждая запись хранит:
  - `cardId` и `ruleType`;
  - очки за конкретную карту;
  - формульный breakdown из scoring engine для UI-рендера.
- Выбор игрока в итогах переиспользует `viewedPlayerIndex`, поэтому детализацию можно переключать по существующим tabs или по строкам standings в popup.

## Базовая сцена
- `preload`: грузит JSON-конфиги, полный каталог карт, reference layout image и базовые SFX (game_start, round_start, button_click, tab_select).
- `create`: показывает `settings`, откуда можно запустить честную сессию или demo/simulation режим.
- `setup`: сейчас встроен в `buildSession()` и подготавливает колоды, рынок, игроков и state machine.
- Для живого дебага в DevTools сцена экспортирует `window.__FRUIT_SALAD_DEBUG__` с доступом к текущим `game`, `scene`, `session`, `logs`, `seed`, а также helper-методами `snapshot()` и `deckSummary()`.

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

## План
- Языки: RU.
- Улучшение дизайна под mid-res presentation.
- Деплой и онлайн-сессия, чтобы игру можно было показать вне локальной машины.
- Анимации.
- Local scoreboard.
- При необходимости расширить demo/simulation режим отдельными debug controls вместо простого seeded launch.
- Пересобрать тексты salad-карт в полноценный icon-first/abbreviation layout для RU/EN, чтобы длинные правила не упирались в центральную область карты.
