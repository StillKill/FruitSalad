import * as Phaser from '../../node_modules/phaser/dist/phaser.esm.js';
import { layoutConfig } from '../config/layoutConfig.js';
import {
  buildDefaultPlayerNames,
  defaultSessionOptions,
  normalizeSessionOptions,
  relocalizePlayerNames,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT
} from '../config/sessionDefaults.js';
import { buildSession } from '../core/sessionSetup.js';
import {
  canConfirmSelection,
  confirmSelection,
  expireTurn,
  getTurnHint,
  resetPendingSelection,
  selectDeckCard,
  selectMarketCard,
  togglePlayerSaladFlip,
  toggleSelectedDeckFlip
} from '../core/sessionActions.js';
import { drawPanel, drawCardPlaceholder } from '../ui/boardLayout.js';
import { preloadCardTextures, drawFruitCard, drawFruitCounter, drawSaladCard } from '../ui/cardRenderer.js';
import { buildDebugSnapshot } from '../ui/debugOverlay.js';
import { scoreTable } from '../core/scoring/scoringEngine.js';
import { buildEndGameResults } from '../core/endGameResults.js';
import { detectGameLocale, getCardCopy, getFruitName, getLocaleCopy, getParityLabel, normalizeLocale } from '../i18n/locale.js';

const SETTINGS_NAME_MAX_LENGTH = 18;

function createSettingsDraft(options = defaultSessionOptions, locale = defaultSessionOptions.locale ?? 'ru') {
  const draftLocale = normalizeLocale(locale);
  const optionsLocale = normalizeLocale(options?.locale ?? draftLocale);
  const requestedCount = Number.isInteger(options?.playerCount) ? options.playerCount : defaultSessionOptions.playerCount;
  const playerCount = Math.min(MAX_PLAYER_COUNT, Math.max(MIN_PLAYER_COUNT, requestedCount));
  const playerNames = optionsLocale === draftLocale
    ? options?.playerNames
    : relocalizePlayerNames(options?.playerNames ?? [], playerCount, optionsLocale, draftLocale);
  const normalized = normalizeSessionOptions({
    ...options,
    locale: draftLocale,
    playerNames
  }, draftLocale);
  return {
    playerCount: normalized.playerCount,
    playerNames: [...normalized.playerNames],
    locale: normalized.locale
  };
}

function buildDeckDebugSnapshot(deck) {
  return {
    id: deck.id,
    saladsLeft: deck.cards.length,
    topSalad: deck.cards[0]
      ? {
        runtimeId: deck.cards[0].runtimeId,
        cardId: deck.cards[0].id,
        backFruit: deck.cards[0].backFruit
      }
      : null,
    market: deck.market.map((card) => ({
      id: card.id,
      fruit: card.fruit,
      sourceCardId: card.sourceCardId
    }))
  };
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.locale = detectGameLocale();
    this.copy = getLocaleCopy(this.locale);
    this.fruitSaladLocale = this.locale;
    this.session = null;
    this.sessionRules = null;
    this.scoringCards = null;
    this.dynamicObjects = [];
    this.settingsDraft = createSettingsDraft(defaultSessionOptions, this.locale);
    this.activeSettingsField = 0;
    this.scrollState = {
      salads: 0,
      debug: 0,
      results: 0
    };
    this.scrollMeta = {};
    this.playerAreaFlipMode = false;
    this.turnTimerText = null;
    this.turnTimerLabel = null;
  }

  update() {
    if (!this.session || !['turn', 'end_turn'].includes(this.session.stateMachine.state)) {
      return;
    }

    const turnTimer = this.session.turnTimer;
    if (!turnTimer || turnTimer.limitMs <= 0 || !turnTimer.deadlineAt) {
      return;
    }

    const remainingMs = Math.max(0, turnTimer.deadlineAt - Date.now());
    turnTimer.remainingMs = remainingMs;
    const nextLabel = this.formatTurnTimer(remainingMs);
    const visualState = this.getTurnTimerVisualState(remainingMs);

    if (this.turnTimerLabel && this.turnTimerLabel.active) {
      this.turnTimerLabel.setColor(visualState.labelColor);
      this.turnTimerLabel.setAlpha(visualState.alpha);
    }

    if (this.turnTimerText && this.turnTimerText.active) {
      if (this.turnTimerText.text !== nextLabel) {
        this.turnTimerText.setText(nextLabel);
      }
      this.turnTimerText.setColor(visualState.color);
      this.turnTimerText.setAlpha(visualState.alpha);
    }

    if (remainingMs <= 0) {
      if (expireTurn(this.session)) {
        this.playerAreaFlipMode = false;
        this.renderDynamicUi();
      }
    }
  }

  preload() {
    this.load.json('sessionRules', 'data/sessions/session-rules.json');
    this.load.json('scoringCards', 'data/cards/scoring-cards.json');
    preloadCardTextures(this);
  }

  create() {
    this.sessionRules = this.cache.json.get('sessionRules');
    this.scoringCards = this.cache.json.get('scoringCards');
    this.settingsDraft = createSettingsDraft(defaultSessionOptions, this.locale);

    this.input.on('wheel', this.handleWheel, this);
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);

    this.installDebugBridge();
    this.drawBackground();
    this.renderDynamicUi();
  }

  installDebugBridge() {
    if (typeof globalThis !== 'object' || !globalThis) {
      return;
    }

    const scene = this;
    globalThis.__FRUIT_SALAD_DEBUG__ = {
      get game() {
        return globalThis.__FRUIT_SALAD_GAME__ ?? null;
      },
      get scene() {
        return scene;
      },
      get session() {
        return scene.session;
      },
      get logs() {
        return scene.session?.logs ?? [];
      },
      get seed() {
        return scene.session?.options?.randomSeed ?? null;
      },
      snapshot() {
        if (!scene.session) {
          return null;
        }

        return {
          seed: scene.session.options?.randomSeed ?? null,
          state: scene.session.stateMachine.state,
          turnNumber: scene.session.turnNumber,
          activePlayerIndex: scene.session.activePlayerIndex,
          viewedPlayerIndex: scene.session.viewedPlayerIndex,
          lastAction: scene.session.lastAction ?? null,
          decks: scene.session.decks.map(buildDeckDebugSnapshot),
          pendingSelection: structuredClone(scene.session.pendingSelection),
          pendingFlip: scene.session.pendingFlip ? structuredClone(scene.session.pendingFlip) : null,
          logs: [...scene.session.logs]
        };
      },
      deckSummary() {
        return scene.session?.decks.map(buildDeckDebugSnapshot) ?? [];
      }
    };
  }

  applyScoringPreview() {
    if (!this.session) {
      return;
    }

    const preview = scoreTable(this.session.players, this.session.scoringCatalog.fruits)
      .sort((left, right) => right.totalPoints - left.totalPoints);

    this.session.scorePreview = preview;

    preview.forEach((entry) => {
      const player = this.session.players.find((candidate) => candidate.id === entry.playerId);
      if (player) {
        player.score = entry.totalPoints;
      }
    });
  }

  getEndGameResults() {
    if (!this.session) {
      return null;
    }

    if (!this.session.endGameResults || this.session.endGameResults.turnNumber !== this.session.turnNumber) {
      this.session.endGameResults = {
        turnNumber: this.session.turnNumber,
        ...buildEndGameResults(this.session.players, this.session.scoringCatalog.fruits)
      };
    }

    return this.session.endGameResults;
  }

  getEndGameViewedEntry() {
    const results = this.getEndGameResults();
    if (!results) {
      return null;
    }

    return results.standings.find((entry) => entry.playerId === this.session.players[this.session.viewedPlayerIndex]?.id) ?? results.standings[0] ?? null;
  }

  formatPlacement(placement) {
    return this.copy.placementShort(placement);
  }

  formatTurnTimer(remainingMs) {
    const totalSeconds = Math.max(0, Math.ceil((remainingMs ?? 0) / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  getTurnTimerVisualState(remainingMs) {
    if (remainingMs <= 10000) {
      return {
        color: '#ff6b6b',
        labelColor: '#ffb3b3',
        alpha: 0.45 + Math.abs(Math.sin(Date.now() / 140)) * 0.55
      };
    }

    if (remainingMs <= 30000) {
      return {
        color: '#ff8f6b',
        labelColor: '#ffd2c7',
        alpha: 1
      };
    }

    return {
      color: '#f8f4ea',
      labelColor: '#c7c2b8',
      alpha: 1
    };
  }

  formatFruitSummary(fruitCounts) {
    return Object.entries(fruitCounts)
      .map(([fruit, count]) => `${getFruitName(fruit, this.locale)}:${count}`)
      .join('  ');
  }

  formatRuleType(ruleType) {
    const cardCopy = getCardCopy(this.locale);

    switch (ruleType) {
      case 'compare-majority':
        return cardCopy.compareMajority;
      case 'compare-minority':
        return cardCopy.compareMinority;
      case 'compare-wealth':
        return cardCopy.compareWealth;
      case 'compare-poverty':
        return cardCopy.comparePoverty;
      case 'parity-fruit':
        return cardCopy.parity;
      case 'threshold-per-kind':
        return this.locale === 'ru' ? '\u041f\u043e\u0440\u043e\u0433 \u043f\u043e \u0432\u0438\u0434\u0430\u043c' : 'Threshold per kind';
      case 'missing-kind':
        return this.locale === 'ru' ? '\u041e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044e\u0449\u0438\u0435 \u0432\u0438\u0434\u044b' : 'Missing kind';
      case 'set-same-kind':
        return this.locale === 'ru' ? '\u041d\u0430\u0431\u043e\u0440 \u043e\u0434\u0438\u043d\u0430\u043a\u043e\u0432\u044b\u0445' : 'Same-kind set';
      case 'set-distinct-kind':
        return this.locale === 'ru' ? '\u041d\u0430\u0431\u043e\u0440 \u0440\u0430\u0437\u043d\u044b\u0445' : 'Distinct-kind set';
      case 'per-fruit-flat':
        return this.locale === 'ru' ? '\u041e\u0447\u043a\u0438 \u0437\u0430 \u0444\u0440\u0443\u043a\u0442' : 'Per-fruit flat';
      case 'per-fruit-multi':
        return this.locale === 'ru' ? '\u041e\u0447\u043a\u0438 \u0437\u0430 \u0444\u0440\u0443\u043a\u0442\u044b' : 'Per-fruit multi';
      default:
        return ruleType;
    }
  }

  formatBreakdownLine(cardScore) {
    const { breakdown } = cardScore;

    switch (breakdown.kind) {
      case 'compare':
        return this.copy.breakdownCompare(this.formatRuleType(cardScore.ruleType), breakdown.metric, cardScore.points);
      case 'parity':
        return this.copy.breakdownParity(getFruitName(breakdown.targetFruit, this.locale), getParityLabel(breakdown.parity, this.locale), breakdown.count, cardScore.points);
      case 'threshold':
        return this.copy.breakdownThreshold(breakdown.qualifiedKinds, breakdown.threshold, cardScore.points);
      case 'missing':
        return this.copy.breakdownMissing(breakdown.missingKinds, cardScore.points);
      case 'same-kind-set':
        return this.copy.breakdownSameKind(getFruitName(breakdown.targetFruit, this.locale), breakdown.count, breakdown.completedSets, cardScore.points);
      case 'distinct-kind-set':
        return this.copy.breakdownDistinct(breakdown.completedSets, breakdown.setSize, cardScore.points);
      case 'per-fruit-flat':
        return this.copy.breakdownPerFruitFlat(getFruitName(breakdown.targetFruit, this.locale), breakdown.count, breakdown.pointsPerFruit, cardScore.points);
      case 'per-fruit-multi':
        return breakdown.contributions
          .map((item) => `${getFruitName(item.fruit, this.locale)} ${item.count}x${item.pointsPerFruit}=${item.subtotal}`)
          .join('  ');
      default:
        return `${this.formatRuleType(cardScore.ruleType)} -> ${cardScore.points}`;
    }
  }

  drawSummaryMetricPill(x, y, width, label, value, accentColor = 0x343a44) {
    const { palette } = layoutConfig;
    const pill = this.track(this.add.graphics());
    pill.fillStyle(accentColor, 0.96);
    pill.lineStyle(2, 0x171b20, 1);
    pill.fillRoundedRect(x, y, width, 66, 14);
    pill.strokeRoundedRect(x, y, width, 66, 14);

    this.track(this.add.text(x + 14, y + 12, label, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '13px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(x + 14, y + 35, value, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
  }

  drawEndGameBreakdownEntry(container, viewport, y, cardScore, rowWidth) {
    const { palette } = layoutConfig;
    const row = this.add.graphics();
    row.fillStyle(0x20262d, 0.98);
    row.lineStyle(2, 0x171b20, 1);
    row.fillRoundedRect(viewport.x, y, rowWidth, 134, 16);
    row.strokeRoundedRect(viewport.x, y, rowWidth, 134, 16);
    container.add(row);
    this.track(row);

    const card = drawSaladCard(this, viewport.x + 18, y + 14, 86, 106, {
      ...cardScore.cardSnapshot,
      runtimeId: cardScore.cardSnapshot.runtimeId ?? `endgame-${cardScore.cardId}`
    });
    container.add(card);
    this.track(card);

    const pointsPill = this.add.graphics();
    pointsPill.fillStyle(cardScore.points >= 0 ? 0x37553a : 0x6c3a3a, 1);
    pointsPill.lineStyle(2, 0x171b20, 1);
    pointsPill.fillRoundedRect(viewport.x + rowWidth - 112, y + 16, 92, 34, 12);
    pointsPill.strokeRoundedRect(viewport.x + rowWidth - 112, y + 16, 92, 34, 12);
    container.add(pointsPill);
    this.track(pointsPill);

    const pointsLabel = this.add.text(viewport.x + rowWidth - 66, y + 33, `${cardScore.points >= 0 ? '+' : ''}${cardScore.points}`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '20px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(pointsLabel);
    this.track(pointsLabel);

    const title = this.add.text(viewport.x + 122, y + 18, `#${cardScore.cardId}  ${this.formatRuleType(cardScore.ruleType)}`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '17px',
      color: palette.textPrimary,
      fontStyle: 'bold',
      wordWrap: { width: rowWidth - 258 }
    });
    container.add(title);
    this.track(title);

    const subtitle = this.add.text(viewport.x + 122, y + 50, this.formatBreakdownLine(cardScore), {
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      color: palette.textMuted,
      wordWrap: { width: rowWidth - 160 }
    });
    container.add(subtitle);
    this.track(subtitle);
  }

  handleKeyDown(event) {
    if (this.session) {
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = Phaser.Math.Wrap(this.activeSettingsField + direction, 0, this.settingsDraft.playerCount);
      this.activeSettingsField = nextIndex;
      this.renderDynamicUi();
      return;
    }

    if (event.key === 'Enter') {
      this.startSessionFromSettings();
      return;
    }

    if (event.key === 'Escape') {
      this.activeSettingsField = null;
      this.renderDynamicUi();
      return;
    }

    if (this.activeSettingsField === null) {
      return;
    }

    const currentName = this.settingsDraft.playerNames[this.activeSettingsField] ?? '';

    if (event.key === 'Backspace') {
      this.settingsDraft.playerNames[this.activeSettingsField] = currentName.slice(0, -1);
      this.renderDynamicUi();
      return;
    }

    if (event.key === ' ' || event.key.length === 1) {
      if (currentName.length >= SETTINGS_NAME_MAX_LENGTH) {
        return;
      }

      const nextName = `${currentName}${event.key}`;
      this.settingsDraft.playerNames[this.activeSettingsField] = nextName;
      this.renderDynamicUi();
    }
  }

  handleWheel(pointer, currentlyOver, deltaX, deltaY) {
    if (!this.session) {
      return;
    }

    const delta = Math.sign(deltaY) * 36;

    if (delta === 0) {
      return;
    }

    if (this.session.stateMachine.state === 'end_game' && this.updateScrollFromPointer('results', pointer, delta)) {
      this.renderDynamicUi();
      return;
    }

    if (this.updateScrollFromPointer('salads', pointer, delta)) {
      this.renderDynamicUi();
      return;
    }

    if (this.updateScrollFromPointer('debug', pointer, delta)) {
      this.renderDynamicUi();
    }
  }

  updateScrollFromPointer(key, pointer, delta) {
    const meta = this.scrollMeta[key];
    if (!meta || meta.maxScroll <= 0) {
      return false;
    }

    const insideViewport =
      pointer.x >= meta.viewport.x &&
      pointer.x <= meta.viewport.x + meta.viewport.width &&
      pointer.y >= meta.viewport.y &&
      pointer.y <= meta.viewport.y + meta.viewport.height;

    if (!insideViewport) {
      return false;
    }

    const nextOffset = Phaser.Math.Clamp(this.scrollState[key] + delta, 0, meta.maxScroll);
    if (nextOffset === this.scrollState[key]) {
      return false;
    }

    this.scrollState[key] = nextOffset;
    return true;
  }

  renderDynamicUi() {
    this.dynamicObjects.forEach((object) => object.destroy());
    this.dynamicObjects = [];
    this.scrollMeta = {};
    this.turnTimerText = null;
    this.turnTimerLabel = null;

    if (!this.session) {
      this.drawSettingsScreen();
      return;
    }

    this.applyScoringPreview();
    this.drawShell();
    this.drawControls();
    this.drawMarket();
    this.drawPlayerArea();
    this.drawScoreTabs();
    this.drawDebugPanel();

    if (this.session.stateMachine.state === 'end_game') {
      this.drawEndGameOverlay();
    }
  }

  track(object) {
    this.dynamicObjects.push(object);
    return object;
  }

  drawBackground() {
    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x14181d, 0x14181d, 0x0c0e10, 0x0c0e10, 1);
    gradient.fillRect(0, 0, layoutConfig.width, layoutConfig.height);
  }

  drawShell() {
    const { regions, palette } = layoutConfig;
    drawPanel(this, regions.market, palette.panel);
    drawPanel(this, regions.controls, palette.panelAlt);
    drawPanel(this, regions.player, palette.panel);
    drawPanel(this, regions.scoreTabs, palette.panelAlt);
    drawPanel(this, regions.debug, palette.panelAlt);

    this.track(this.add.text(30, 10, this.copy.gameTitle, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
  }

  getLanguageLabel() {
    return this.locale === 'ru' ? '\u042f\u0437\u044b\u043a' : 'Language';
  }

  syncSettingsDraftLocale(previousLocale, nextLocale) {
    const playerCount = this.settingsDraft.playerCount ?? defaultSessionOptions.playerCount;
    this.settingsDraft = {
      playerCount,
      playerNames: relocalizePlayerNames(this.settingsDraft.playerNames ?? [], playerCount, previousLocale, nextLocale),
      locale: nextLocale
    };
  }

  syncSessionLocale(previousLocale, nextLocale) {
    if (!this.session) {
      return;
    }

    this.session.options.locale = nextLocale;
    const nextNames = relocalizePlayerNames(
      this.session.players.map((player) => player.name),
      this.session.players.length,
      previousLocale,
      nextLocale
    );

    this.session.players.forEach((player, index) => {
      player.name = nextNames[index];
    });
  }

  setLocale(nextLocale) {
    const resolvedLocale = normalizeLocale(nextLocale);
    if (resolvedLocale === this.locale) {
      return;
    }

    const previousLocale = this.locale;
    this.locale = resolvedLocale;
    this.copy = getLocaleCopy(this.locale);
    this.fruitSaladLocale = this.locale;
    this.syncSettingsDraftLocale(previousLocale, this.locale);
    this.syncSessionLocale(previousLocale, this.locale);
    this.renderDynamicUi();
  }

  drawLocaleToggle(x, y, width = 58, height = 28, showLabel = false) {
    const { palette } = layoutConfig;

    if (showLabel) {
      this.track(this.add.text(x, y, this.getLanguageLabel(), {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '15px',
        color: palette.textMuted,
        fontStyle: 'bold'
      }));
    }

    const buttonY = showLabel ? y + 22 : y;
    ['ru', 'en'].forEach((localeKey, index) => {
      const buttonX = x + index * (width + 8);
      const isSelected = this.locale === localeKey;
      const graphics = this.track(this.add.graphics());
      graphics.fillStyle(isSelected ? palette.accent : 0x343a44, 1);
      graphics.lineStyle(2, isSelected ? 0xf6f1c7 : 0x171b20, 1);
      graphics.fillRoundedRect(buttonX, buttonY, width, height, 10);
      graphics.strokeRoundedRect(buttonX, buttonY, width, height, 10);

      this.track(this.add.text(buttonX + width / 2, buttonY + height / 2, localeKey.toUpperCase(), {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '15px',
        color: isSelected ? '#111315' : palette.textPrimary,
        fontStyle: 'bold'
      }).setOrigin(0.5));

      this.addClickZone(buttonX, buttonY, width, height, () => {
        this.setLocale(localeKey);
      });
    });
  }

  drawSettingsScreen() {
    const { palette } = layoutConfig;
    const panelX = 360;
    const panelY = 92;
    const panelWidth = 880;
    const panelHeight = 716;
    const contentX = panelX + 42;
    const contentWidth = panelWidth - 84;
    const contentRight = contentX + contentWidth;
    const fieldGap = 28;
    const fieldWidth = Math.floor((contentWidth - fieldGap) / 2);
    const nameRowGap = 86;
    let cursorY = panelY + 28;

    drawPanel(this, { x: panelX, y: panelY, width: panelWidth, height: panelHeight }, palette.panelAlt);

    const title = this.track(this.add.text(contentX, cursorY, this.copy.setupTitle, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '34px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
    cursorY = title.y + title.height + 18;

    const localeLabel = this.track(this.add.text(contentX, cursorY + 6, this.getLanguageLabel(), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '15px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }));
    this.drawLocaleToggle(contentRight - 124, cursorY, 58, 28, false);
    cursorY = localeLabel.y + localeLabel.height + 20;

    const lead = this.track(this.add.text(contentX, cursorY, this.copy.setupLead, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted,
      wordWrap: { width: contentWidth }
    }));
    cursorY = lead.y + lead.height + 10;

    const demo = this.track(this.add.text(contentX, cursorY, this.copy.setupDemo, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '16px',
      color: palette.textMuted,
      wordWrap: { width: contentWidth }
    }));
    cursorY = demo.y + demo.height + 26;

    const playersHeading = this.track(this.add.text(contentX, cursorY, this.copy.players, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
    cursorY = playersHeading.y + playersHeading.height + 16;

    for (let playerCount = MIN_PLAYER_COUNT; playerCount <= MAX_PLAYER_COUNT; playerCount += 1) {
      const index = playerCount - MIN_PLAYER_COUNT;
      const buttonX = contentX + index * 92;
      const isSelected = this.settingsDraft.playerCount === playerCount;
      this.drawSettingsCountButton(buttonX, cursorY, 72, 48, playerCount, isSelected);
    }
    cursorY += 76;

    const namesHeading = this.track(this.add.text(contentX, cursorY, this.copy.names, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
    cursorY = namesHeading.y + namesHeading.height + 18;

    for (let index = 0; index < this.settingsDraft.playerCount; index += 1) {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const fieldX = contentX + column * (fieldWidth + fieldGap);
      const fieldY = cursorY + row * nameRowGap;
      this.drawSettingsNameField(fieldX, fieldY, fieldWidth, 62, index);
    }

    this.drawActionButton(
      panelX + panelWidth - 406,
      panelY + panelHeight - 86,
      172,
      48,
      0x7f8a98,
      this.copy.openDemo,
      true,
      () => this.startDemoSession()
    );

    this.drawActionButton(
      panelX + panelWidth - 214,
      panelY + panelHeight - 86,
      172,
      48,
      palette.accent,
      this.copy.startFairGame,
      true,
      () => this.startSessionFromSettings()
    );
  }

  drawSettingsCountButton(x, y, width, height, playerCount, isSelected) {
    const { palette } = layoutConfig;
    const fill = isSelected ? palette.accent : 0x343a44;
    const textColor = isSelected ? '#111315' : palette.textPrimary;
    const graphics = this.track(this.add.graphics());

    graphics.fillStyle(fill, 1);
    graphics.lineStyle(2, 0x171b20, 1);
    graphics.fillRoundedRect(x, y, width, height, 12);
    graphics.strokeRoundedRect(x, y, width, height, 12);

    this.track(this.add.text(x + width / 2, y + height / 2, String(playerCount), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: textColor,
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.addClickZone(x, y, width, height, () => {
      this.updateSettingsPlayerCount(playerCount);
    });
  }

  drawSettingsNameField(x, y, width, height, index) {
    const { palette } = layoutConfig;
    const isActive = this.activeSettingsField === index;
    const label = this.copy.playerLabel(index + 1);
    const value = this.settingsDraft.playerNames[index] ?? '';
    const graphics = this.track(this.add.graphics());

    graphics.fillStyle(0x1a1f25, 1);
    graphics.lineStyle(3, isActive ? palette.accent : palette.border, 1);
    graphics.fillRoundedRect(x, y, width, height, 14);
    graphics.strokeRoundedRect(x, y, width, height, 14);

    this.track(this.add.text(x, y - 24, label, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '16px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }));

    const displayValue = value || this.copy.typeName;
    const suffix = isActive ? '|' : '';
    this.track(this.add.text(x + 16, y + 18, `${displayValue}${suffix}`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: value ? palette.textPrimary : palette.textMuted
    }));

    this.addClickZone(x, y, width, height, () => {
      this.activeSettingsField = index;
      this.renderDynamicUi();
    });
  }

  updateSettingsPlayerCount(playerCount) {
    const previousNames = [...this.settingsDraft.playerNames];
    const defaultNames = buildDefaultPlayerNames(playerCount, this.locale);

    this.settingsDraft.playerCount = playerCount;
    this.settingsDraft.playerNames = defaultNames.map((fallbackName, index) => {
      const candidate = typeof previousNames[index] === 'string' ? previousNames[index].trim() : '';
      return candidate || fallbackName;
    });
    this.activeSettingsField = Phaser.Math.Clamp(this.activeSettingsField ?? 0, 0, playerCount - 1);
    this.renderDynamicUi();
  }

  startSessionFromSettings() {
    const options = normalizeSessionOptions({
      playerCount: this.settingsDraft.playerCount,
      playerNames: this.settingsDraft.playerNames,
      locale: this.locale,
      liveScoring: false,
      seedDemoProgress: false
    }, this.locale);

    this.settingsDraft = createSettingsDraft(options, this.locale);
    this.launchSession(options);
  }

  startDemoSession() {
    const options = normalizeSessionOptions({
      playerCount: 2,
      playerNames: [`${this.copy.playerLabel(1)} Demo`, `${this.copy.playerLabel(2)} Demo`],
      locale: this.locale,
      liveScoring: false,
      seedDemoProgress: true
    }, this.locale);

    this.launchSession(options);
  }

  launchSession(options) {
    this.activeSettingsField = null;
    this.scrollState = {
      salads: 0,
      debug: 0,
      results: 0
    };
    this.playerAreaFlipMode = false;
    this.session = buildSession(options, this.sessionRules, this.scoringCards);
    this.renderDynamicUi();
  }

  drawControls() {
    const { palette, regions } = layoutConfig;
    const contentX = regions.controls.x + 24;
    const contentRight = regions.controls.x + regions.controls.width - 24;
    const titleY = regions.controls.y + 14;
    const buttonY = regions.controls.y + 34;
    const buttonWidth = 132;
    const buttonGap = 16;
    const localeToggleWidth = 124;
    const localeX = contentRight - localeToggleWidth;
    const resetX = localeX - 18 - buttonWidth;
    const confirmX = resetX - buttonGap - buttonWidth;
    const infoWidth = confirmX - contentX - 24;
    const activePlayer = this.session.players[this.session.activePlayerIndex];
    const title = this.session.stateMachine.state === 'end_game'
      ? this.copy.endGameReached
      : this.copy.turn(activePlayer.name);
    const timerValue = this.formatTurnTimer(this.session.turnTimer?.remainingMs ?? 0);

    this.track(this.add.text(localeX, titleY + 2, this.getLanguageLabel(), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '13px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }));
    this.drawLocaleToggle(localeX, titleY + 22, 58, 24, false);

    this.track(this.add.text(contentX, titleY, title, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold',
      wordWrap: { width: infoWidth }
    }));

    if (this.session.stateMachine.state !== 'end_game') {
      const timerVisualState = this.getTurnTimerVisualState(this.session.turnTimer?.remainingMs ?? 0);
      const timerBadge = this.track(this.add.graphics());
      timerBadge.fillStyle(0x1a1f25, 0.98);
      timerBadge.lineStyle(2, 0x343c46, 1);
      timerBadge.fillRoundedRect(contentX - 2, regions.controls.y + 36, 168, 36, 12);
      timerBadge.strokeRoundedRect(contentX - 2, regions.controls.y + 36, 168, 36, 12);

      this.turnTimerLabel = this.track(this.add.text(contentX + 10, regions.controls.y + 46, this.copy.turnTimer(''), {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '13px',
        color: timerVisualState.labelColor,
        fontStyle: 'bold'
      }).setAlpha(timerVisualState.alpha));

      this.turnTimerText = this.track(this.add.text(contentX + 76, regions.controls.y + 39, timerValue, {
        fontFamily: 'Consolas, monospace',
        fontSize: '24px',
        color: timerVisualState.color,
        fontStyle: 'bold',
        stroke: '#111315',
        strokeThickness: 3
      }).setAlpha(timerVisualState.alpha));
    }

    this.drawActionButton(
      confirmX,
      buttonY,
      buttonWidth,
      42,
      palette.accent,
      this.copy.confirm,
      canConfirmSelection(this.session),
      () => {
        if (confirmSelection(this.session)) {
          this.playerAreaFlipMode = false;
          this.renderDynamicUi();
        }
      },
      '18px'
    );

    this.drawActionButton(
      resetX,
      buttonY,
      buttonWidth,
      42,
      palette.warning,
      this.copy.reset,
      (this.session.pendingSelection.length > 0 || !!this.session.pendingFlip) && this.session.stateMachine.state !== 'end_game',
      () => {
        resetPendingSelection(this.session);
        this.playerAreaFlipMode = false;
        this.renderDynamicUi();
      },
      '18px'
    );

    this.track(this.add.text(
      contentX,
      regions.controls.y + 72,
      getTurnHint(this.session, this.locale),
      {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '13px',
        color: palette.textMuted,
        wordWrap: { width: infoWidth }
      }
    ));
  }

  drawActionButton(x, y, width, height, fillColor, label, enabled, onClick, fontSize = '20px', options = {}) {
    const container = this.track(this.add.container(x, y));
    const graphics = this.add.graphics();
    const alpha = enabled ? 1 : 0.32;
    const borderColor = enabled ? (options.borderColor ?? 0x171b20) : 0x171b20;
    const textColor = enabled ? (options.textColor ?? '#111315') : '#43474d';

    graphics.fillStyle(fillColor, alpha);
    graphics.lineStyle(2, borderColor, enabled ? 1 : 0.45);
    graphics.fillRoundedRect(0, 0, width, height, 10);
    graphics.strokeRoundedRect(0, 0, width, height, 10);
    container.add(graphics);

    const text = this.add.text(width / 2, height / 2, label, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize,
      color: textColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(text);

    if (enabled) {
      const hitArea = this.add.zone(x + width / 2, y + height / 2, width, height).setInteractive({ useHandCursor: true });
      hitArea.on('pointerup', onClick);
      this.track(hitArea);
    }
  }

  drawMarket() {
    const { card, palette, regions } = layoutConfig;
    const deckX = regions.market.x + 24;
    const deckY = regions.market.y + 26;

    this.track(this.add.text(deckX, deckY - 6, this.copy.marketTitle, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.session.decks.forEach((deck, index) => {
      const columnX = deckX + index * 220;
      const titleY = deckY + 30;
      const topSalad = deck.cards[0] ?? null;
      const deckSelected = topSalad ? this.isDeckSelected(deck.id, topSalad.runtimeId) : false;
      const deckFlipQueued = topSalad ? this.isPendingDeckFlip(deck.id, topSalad.runtimeId) : false;
      const deckEnabled = topSalad && this.canInteractWithDeck(deck.id);

      this.track(this.add.text(columnX, titleY, `${this.copy.deckLabel(index + 1)} (${this.copy.saladsLeft(deck.cards.length)})`, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '17px',
        color: palette.textMuted
      }));

      const deckVisual = topSalad
        ? drawSaladCard(this, columnX, titleY + 24, card.width, card.height, topSalad)
        : drawCardPlaceholder(this, columnX, titleY + 24, card.width, card.height, palette.deckBack, this.copy.deckEmpty);
      this.track(deckVisual);

      if (!deckEnabled && topSalad) {
        deckVisual.setAlpha(0.72);
      }

      if (deckSelected) {
        this.drawSelectionOutline(columnX, titleY + 24, card.width, card.height, deckFlipQueued ? 0xf5c451 : 0x7ed957);
      }

      if (deckEnabled) {
        this.addClickZone(columnX, titleY + 24, card.width, card.height, () => {
          if (selectDeckCard(this.session, deck.id)) {
            this.renderDynamicUi();
          }
        });
      }

      if (deckSelected) {
        this.drawActionButton(
          columnX,
          titleY + 24 + card.height + 2,
          card.width,
          18,
          deckFlipQueued ? 0xc7b672 : 0xf5c451,
          deckFlipQueued ? this.copy.keepAsSalad : this.copy.flipToFruit,
          this.canToggleSelectedDeckFlip(deck.id),
          () => {
            if (toggleSelectedDeckFlip(this.session, deck.id)) {
              this.playerAreaFlipMode = false;
              this.renderDynamicUi();
            }
          },
          '13px'
        );
      }

      deck.market.forEach((marketCard, marketIndex) => {
        const slotY = titleY + 220 + marketIndex * (card.height + 16);
        const selected = this.isMarketSelected(deck.id, marketCard.id);
        const marketEnabled = this.canInteractWithMarketCard(deck.id, marketCard.id);
        const fruitCard = drawFruitCard(this, columnX, slotY, card.width, card.height, marketCard.fruit);
        this.track(fruitCard);

        if (!marketEnabled) {
          fruitCard.setAlpha(0.72);
        }

        if (selected) {
          this.drawSelectionOutline(columnX, slotY, card.width, card.height, 0x7ed957);
        }

        if (marketEnabled) {
          this.addClickZone(columnX, slotY, card.width, card.height, () => {
            if (selectMarketCard(this.session, deck.id, marketCard.id)) {
              this.renderDynamicUi();
            }
          });
        }
      });
    });
  }

  drawPlayerArea() {
    const { palette, regions } = layoutConfig;
    const activePlayer = this.session.players[this.session.activePlayerIndex];
    const viewedPlayer = this.session.players[this.session.viewedPlayerIndex];
    const fruits = Object.entries(viewedPlayer.fruitCounts);
    const saladCardWidth = 124;
    const saladCardHeight = 172;
    const saladGapX = 14;
    const saladGapY = 14;
    const saladColumns = 4;
    const canFlipViewedSalads = this.canInteractWithOwnedSalads() && viewedPlayer.id === activePlayer.id;
    const hasPendingPlayerFlip = this.session.pendingFlip?.type === 'player-salad';
    const showPlayerFlipMode = canFlipViewedSalads && this.playerAreaFlipMode && !hasPendingPlayerFlip;
    const saladViewport = {
      x: regions.player.x + 24,
      y: regions.player.y + 226,
      width: regions.player.width - 56,
      height: 250
    };

    if (!canFlipViewedSalads) {
      this.playerAreaFlipMode = false;
    }

    this.track(this.add.text(regions.player.x + 24, regions.player.y + 18, this.copy.playerArea(viewedPlayer.name), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(regions.player.x + regions.player.width - 24, regions.player.y + 24, this.copy.activePlayer(activePlayer.name), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '14px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    fruits.forEach(([fruit, count], index) => {
      const x = regions.player.x + 24 + index * 124;
      const y = regions.player.y + 72;
      this.track(drawFruitCounter(this, x, y, fruit, count));
    });

    this.track(this.add.text(regions.player.x + 24, regions.player.y + 196, this.copy.saladCards(viewedPlayer.salads.length), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted
    }));

    if (canFlipViewedSalads) {
      const playerFlipLabel = this.copy.flipMode;
      const flipModeActive = hasPendingPlayerFlip || this.playerAreaFlipMode;
      const playerFlipColor = flipModeActive ? palette.warning : 0x3b4350;
      const playerFlipBorderColor = flipModeActive ? 0xf6f1c7 : 0x56606d;
      const playerFlipTextColor = flipModeActive ? '#111315' : palette.textPrimary;

      this.drawActionButton(
        regions.player.x + regions.player.width - 196,
        regions.player.y + 190,
        172,
        28,
        playerFlipColor,
        playerFlipLabel,
        true,
        () => {
          if (hasPendingPlayerFlip) {
            togglePlayerSaladFlip(this.session, this.session.pendingFlip.runtimeId);
            this.playerAreaFlipMode = false;
          } else {
            this.playerAreaFlipMode = !this.playerAreaFlipMode;
          }
          this.renderDynamicUi();
        },
        '13px',
        {
          borderColor: playerFlipBorderColor,
          textColor: playerFlipTextColor
        }
      );
    }

    const saladRows = Math.max(1, Math.ceil(viewedPlayer.salads.length / saladColumns));
    const saladContentHeight = saladRows * saladCardHeight + Math.max(0, saladRows - 1) * saladGapY;
    const saladOffset = this.registerScrollRegion('salads', saladViewport, saladContentHeight);
    const saladContent = this.track(this.add.container(0, -saladOffset));
    saladContent.setMask(this.createViewportMask(saladViewport));

    viewedPlayer.salads.forEach((cardData, index) => {
      const column = index % saladColumns;
      const row = Math.floor(index / saladColumns);
      const x = saladViewport.x + column * (saladCardWidth + saladGapX);
      const y = saladViewport.y + row * (saladCardHeight + saladGapY);
      const renderedY = y - saladOffset;
      const card = drawSaladCard(this, x, y, saladCardWidth, saladCardHeight, cardData);
      saladContent.add(card);
      this.track(card);

      if (this.isPendingPlayerSaladFlip(cardData.runtimeId)) {
        const outline = this.drawSelectionOutline(x, y, saladCardWidth, saladCardHeight, 0xf5c451);
        saladContent.add(outline);
      }

      if (showPlayerFlipMode && this.isVisibleInViewport(renderedY, saladCardHeight, saladViewport)) {
        this.addClickZone(x, renderedY, saladCardWidth, saladCardHeight, () => {
          if (togglePlayerSaladFlip(this.session, cardData.runtimeId)) {
            this.playerAreaFlipMode = false;
            this.renderDynamicUi();
          }
        });
      }
    });

    this.drawScrollBar('salads');
  }

  drawScoreTabs() {
    const { palette, regions } = layoutConfig;

    this.session.players.forEach((player, index) => {
      const x = regions.scoreTabs.x + 18 + index * 132;
      const y = regions.scoreTabs.y + 10;
      const isActive = index === this.session.activePlayerIndex;
      const isViewed = index === this.session.viewedPlayerIndex;
      const fill = isViewed ? palette.accent : 0x343a44;
      const pill = this.track(this.add.graphics());

      pill.fillStyle(fill, 1);
      pill.lineStyle(2, isActive ? 0xf6f1c7 : 0x171b20, 1);
      pill.fillRoundedRect(x, y, 118, 38, 12);
      pill.strokeRoundedRect(x, y, 118, 38, 12);

      this.track(this.add.text(x + 12, y + 7, player.name, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '16px',
        color: isViewed ? '#111315' : palette.textPrimary,
        fontStyle: 'bold'
      }));

      this.track(this.add.text(x + 12, y + 44, this.copy.preview(player.score), {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '12px',
        color: palette.textMuted
      }));

      this.addClickZone(x, y, 118, 38, () => {
        this.setViewedPlayerIndex(index);
      });
    });
  }

  setViewedPlayerIndex(index) {
    if (!this.session) {
      return;
    }

    const nextIndex = Phaser.Math.Clamp(index, 0, this.session.players.length - 1);
    if (nextIndex === this.session.viewedPlayerIndex) {
      return;
    }

    this.session.viewedPlayerIndex = nextIndex;
    this.playerAreaFlipMode = false;
    this.scrollState.salads = 0;
    this.renderDynamicUi();
  }

  drawDebugPanel() {
    const { palette, regions } = layoutConfig;
    const debugLines = buildDebugSnapshot(this.session, this.locale);
    const debugViewport = {
      x: regions.debug.x + 18,
      y: regions.debug.y + 30,
      width: regions.debug.width - 42,
      height: regions.debug.height - 38
    };
    const lineHeight = 15;
    const debugContentHeight = debugLines.length * lineHeight;
    const debugOffset = this.registerScrollRegion('debug', debugViewport, debugContentHeight);
    const debugContent = this.track(this.add.container(0, -debugOffset));
    debugContent.setMask(this.createViewportMask(debugViewport));

    this.track(this.add.text(regions.debug.x + 18, regions.debug.y + 10, this.copy.debugOverlay, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '17px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    debugLines.forEach((line, index) => {
      const text = this.add.text(debugViewport.x, debugViewport.y + index * lineHeight, line, {
        fontFamily: 'Consolas, monospace',
        fontSize: '11px',
        color: palette.textMuted,
        wordWrap: { width: debugViewport.width - 10 }
      });
      debugContent.add(text);
      this.track(text);
    });

    this.drawScrollBar('debug');
  }


  drawEndGameOverlay() {
    const { palette } = layoutConfig;
    const overlay = this.track(this.add.graphics());
    overlay.fillStyle(0x0b0d10, 0.72);
    overlay.fillRect(0, 0, layoutConfig.width, layoutConfig.height);
    const blocker = this.track(this.add.zone(layoutConfig.width / 2, layoutConfig.height / 2, layoutConfig.width, layoutConfig.height).setInteractive());
    blocker.on('pointerdown', () => {});

    const popup = {
      x: 120,
      y: 92,
      width: 1360,
      height: 716
    };
    drawPanel(this, popup, palette.panelAlt);

    const results = this.getEndGameResults();
    const viewedEntry = this.getEndGameViewedEntry();
    if (!results || !viewedEntry) {
      return;
    }

    const viewedState = results.playerStates.find((player) => player.playerId === viewedEntry.playerId) ?? null;
    const winner = results.winner;
    const leftX = popup.x + 28;
    const rightX = popup.x + 528;
    const topY = popup.y + 28;
    const standingsRowHeight = 56;
    const breakdownViewport = {
      x: rightX,
      y: popup.y + 224,
      width: popup.width - 574,
      height: popup.height - 250
    };

    this.track(this.add.text(leftX, topY, this.copy.finalResults, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '34px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(leftX, topY + 46, winner ? this.copy.winner(winner.playerName, winner.totalPoints) : this.copy.gameFinished, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(rightX, popup.y + 76, this.copy.breakdown(viewedEntry.playerName), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.drawSummaryMetricPill(rightX, popup.y + 104, 156, this.copy.placement, this.formatPlacement(viewedEntry.placement), 0x343a44);
    this.drawSummaryMetricPill(rightX + 170, popup.y + 104, 156, this.copy.total, String(viewedEntry.totalPoints), 0x37553a);
    this.drawSummaryMetricPill(rightX + 340, popup.y + 104, 186, this.copy.scoringCards, String(viewedEntry.cardScores.length), 0x3a4658);

    if (viewedState) {
      this.track(this.add.text(rightX, popup.y + 190, `${this.copy.fruits}: ${this.formatFruitSummary(viewedState.fruitCounts)}`, {
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
        color: palette.textMuted
      }));
    }

    this.track(this.add.text(leftX, popup.y + 108, this.copy.standings, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    results.standings.forEach((entry, index) => {
      const rowY = popup.y + 146 + index * standingsRowHeight;
      const isViewed = entry.playerId === viewedEntry.playerId;
      const row = this.track(this.add.graphics());
      row.fillStyle(isViewed ? 0x343a44 : 0x242a31, 0.96);
      row.lineStyle(2, isViewed ? palette.accent : 0x171b20, 1);
      row.fillRoundedRect(leftX, rowY, 384, 44, 12);
      row.strokeRoundedRect(leftX, rowY, 384, 44, 12);

      this.track(this.add.text(leftX + 14, rowY + 8, `${this.formatPlacement(entry.placement)}  ${entry.playerName}`, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '18px',
        color: isViewed ? palette.accent : palette.textPrimary,
        fontStyle: 'bold'
      }));

      this.track(this.add.text(leftX + 334, rowY + 10, String(entry.totalPoints), {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '20px',
        color: palette.textPrimary,
        fontStyle: 'bold'
      }).setOrigin(1, 0));

      this.addClickZone(leftX, rowY, 384, 44, () => {
        this.setViewedPlayerIndex(results.playerStates.findIndex((player) => player.playerId === entry.playerId));
      });
    });

    const breakdownRowHeight = 148;
    const breakdownContentHeight = viewedEntry.cardScores.length > 0
      ? viewedEntry.cardScores.length * breakdownRowHeight
      : 40;
    const breakdownOffset = this.registerScrollRegion('results', breakdownViewport, breakdownContentHeight);
    const breakdownContent = this.track(this.add.container(0, -breakdownOffset));
    breakdownContent.setMask(this.createViewportMask(breakdownViewport));

    if (viewedEntry.cardScores.length === 0) {
      const emptyState = this.add.text(breakdownViewport.x, breakdownViewport.y, this.copy.noScoredSalads, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '16px',
        color: palette.textMuted
      });
      breakdownContent.add(emptyState);
      this.track(emptyState);
    } else {
      viewedEntry.cardScores.forEach((cardScore, index) => {
        const rowY = breakdownViewport.y + index * breakdownRowHeight;
        this.drawEndGameBreakdownEntry(breakdownContent, breakdownViewport, rowY, cardScore, breakdownViewport.width - 14);
      });
    }

    this.drawScrollBar('results');
  }
  registerScrollRegion(key, viewport, contentHeight) {
    const maxScroll = Math.max(0, contentHeight - viewport.height);
    this.scrollState[key] = Phaser.Math.Clamp(this.scrollState[key] ?? 0, 0, maxScroll);
    this.scrollMeta[key] = { viewport, contentHeight, maxScroll };
    return this.scrollState[key];
  }

  createViewportMask(viewport) {
    const graphics = this.track(this.add.graphics());
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
    graphics.visible = false;
    return graphics.createGeometryMask();
  }

  drawScrollBar(key) {
    const meta = this.scrollMeta[key];
    if (!meta || meta.maxScroll <= 0) {
      return;
    }

    const { viewport, contentHeight } = meta;
    const trackWidth = 6;
    const trackX = viewport.x + viewport.width - trackWidth;
    const track = this.track(this.add.graphics());
    track.fillStyle(0x20262d, 1);
    track.fillRoundedRect(trackX, viewport.y, trackWidth, viewport.height, 3);

    const thumbHeight = Math.max(26, Math.round((viewport.height / contentHeight) * viewport.height));
    const thumbTravel = viewport.height - thumbHeight;
    const progress = meta.maxScroll === 0 ? 0 : this.scrollState[key] / meta.maxScroll;
    const thumbY = viewport.y + thumbTravel * progress;
    const thumb = this.track(this.add.graphics());
    thumb.fillStyle(0x7f8a98, 1);
    thumb.fillRoundedRect(trackX, thumbY, trackWidth, thumbHeight, 3);
  }

  drawSelectionOutline(x, y, width, height, color) {
    const graphics = this.track(this.add.graphics());
    graphics.lineStyle(4, color, 1);
    graphics.strokeRoundedRect(x - 4, y - 4, width + 8, height + 8, 16);
    return graphics;
  }

  addClickZone(x, y, width, height, onClick) {
    const zone = this.track(this.add.zone(x + width / 2, y + height / 2, width, height).setInteractive({ useHandCursor: true }));
    zone.on('pointerup', onClick);
    return zone;
  }

  isVisibleInViewport(y, height, viewport) {
    return y < viewport.y + viewport.height && y + height > viewport.y;
  }

  isDeckSelected(deckId, runtimeId) {
    return this.session.pendingSelection.some((selection) => selection.type === 'deck' && selection.deckId === deckId && selection.runtimeId === runtimeId);
  }

  isMarketSelected(deckId, cardId) {
    return this.session.pendingSelection.some((selection) => selection.type === 'market' && selection.deckId === deckId && selection.cardId === cardId);
  }

  isPendingDeckFlip(deckId, runtimeId) {
    return this.session.pendingFlip?.type === 'selected-deck'
      && this.session.pendingFlip.deckId === deckId
      && this.session.pendingFlip.runtimeId === runtimeId;
  }

  isPendingPlayerSaladFlip(runtimeId) {
    return this.session.pendingFlip?.type === 'player-salad' && this.session.pendingFlip.runtimeId === runtimeId;
  }

  canToggleSelectedDeckFlip(deckId) {
    if (!['turn', 'end_turn'].includes(this.session.stateMachine.state)) {
      return false;
    }

    const selection = this.session.pendingSelection.find((item) => item.type === 'deck');
    return selection?.deckId === deckId;
  }

  canInteractWithOwnedSalads() {
    return ['turn', 'end_turn'].includes(this.session.stateMachine.state);
  }

  canInteractWithDeck(deckId) {
    if (!['turn', 'end_turn'].includes(this.session.stateMachine.state)) {
      return false;
    }

    if (this.session.pendingSelection.some((selection) => selection.type === 'market')) {
      return false;
    }

    return !!this.session.decks.find((deck) => deck.id === deckId)?.cards[0];
  }

  canInteractWithMarketCard(deckId, cardId) {
    if (!['turn', 'end_turn'].includes(this.session.stateMachine.state)) {
      return false;
    }

    if (this.session.pendingSelection.some((selection) => selection.type === 'deck')) {
      return false;
    }

    const selected = this.isMarketSelected(deckId, cardId);
    if (selected) {
      return true;
    }

    return this.session.pendingSelection.length < this.session.rules.turnRules.marketPickLimit;
  }
}


