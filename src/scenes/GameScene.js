import * as Phaser from '../../node_modules/phaser/dist/phaser.esm.js';
import { layoutConfig } from '../config/layoutConfig.js';
import {
  buildDefaultPlayerNames,
  createMenuSettingsDraft,
  createSettingsDraft,
  defaultSessionOptions,
  normalizeSessionOptions,
  relocalizePlayerNames,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT
} from '../config/sessionDefaults.js';
import { buildSession } from '../core/sessionSetup.js';
import {
  clearFairSessionState,
  loadFairSessionState,
  saveFairSessionState
} from '../core/sessionPersistence.js';
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
import { buildSettingsOverlayMarkup, ensureSettingsOverlayStyles, SETTINGS_RULES_PDF_PATHS } from '../ui/settingsLayout.js';
import { preloadCardTextures, drawFruitCard, drawFruitCounter, drawSaladCard } from '../ui/cardRenderer.js';
import { buildDebugSnapshot } from '../ui/debugOverlay.js';
import { scoreTable } from '../core/scoring/scoringEngine.js';
import { buildEndGameResults } from '../core/endGameResults.js';
import { detectGameLocale, getCardCopy, getFruitName, getLocaleCopy, getParityLabel, normalizeLocale } from '../i18n/locale.js';

const SETTINGS_NAME_MAX_LENGTH = 18;
const DEFAULT_SOUND_VOLUME = 0.5;
const SOUND_KEYS = {
  gameStart: 'game_start',
  tabSelect: 'tab_select',
  buttonClick: 'button_click',
  cardSelect: 'card_select',
  roundStart: 'round_start',
  timerEnds: 'timer_ends',
  endGame: 'end_game'
};

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
    this.settingsDraft = createMenuSettingsDraft(null, this.locale);
    this.lastFairSessionOptions = null;
    this.savedFairSessionState = null;
    this.activeSettingsField = 0;
    this.settingsInput = null;
    this.settingsOverlay = null;
    this.settingsAudioExpanded = false;
    this.mobileSection = 'market';
    this.settingsFieldBounds = new Map();
    this.pendingSettingsInputFocus = false;
    this.scrollState = {
      salads: 0,
      debug: 0,
      results: 0
    };
    this.scrollMeta = {};
    this.playerAreaFlipMode = false;
    this.turnTimerText = null;
    this.turnTimerLabel = null;
    this.audioState = {
      session: null,
      turnNumber: null,
      state: null,
      nextTurnSound: null
    };
    this.audioSettings = {
      volume: DEFAULT_SOUND_VOLUME,
      muted: false
    };
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
      const shouldUseTimerEnds = !canConfirmSelection(this.session);
      if (expireTurn(this.session)) {
        if (shouldUseTimerEnds && this.session.stateMachine.state !== 'end_game') {
          this.audioState.nextTurnSound = SOUND_KEYS.timerEnds;
        }
        this.persistFairSession();
        this.playerAreaFlipMode = false;
        this.renderDynamicUi();
      }
    }
  }

  preload() {
    this.load.json('sessionRules', 'data/sessions/session-rules.json');
    this.load.json('scoringCards', 'data/cards/scoring-cards.json');
    preloadCardTextures(this);
    this.preloadAudioAssets();
  }

  create() {
    this.sessionRules = this.cache.json.get('sessionRules');
    this.scoringCards = this.cache.json.get('scoringCards');
    this.refreshSavedFairSessionState();
    this.settingsDraft = createMenuSettingsDraft(this.lastFairSessionOptions, this.locale);

    this.input.on('wheel', this.handleWheel, this);
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.scale.on('resize', this.syncSettingsOverlay, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroySettingsOverlay, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.destroySettingsOverlay, this);
    this.ensureSettingsOverlay();

    this.installDebugBridge();
    this.drawBackground();
    this.renderDynamicUi();
  }

  preloadAudioAssets() {
    this.load.audio(SOUND_KEYS.gameStart, 'assets/audio/snd_game_start.wav');
    this.load.audio(SOUND_KEYS.tabSelect, 'assets/audio/snd_tab_select.wav');
    this.load.audio(SOUND_KEYS.buttonClick, 'assets/audio/snd_button_click.wav');
    this.load.audio(SOUND_KEYS.cardSelect, 'assets/audio/snd_card_select.WAV');
    this.load.audio(SOUND_KEYS.roundStart, 'assets/audio/snd_round_start.wav');
    this.load.audio(SOUND_KEYS.timerEnds, 'assets/audio/snd_timer_ends.wav');
    this.load.audio(SOUND_KEYS.endGame, 'assets/audio/snd_end_game.wav');
  }

  playSound(key, config = {}) {
    if (!key || !this.cache.audio.exists(key) || this.audioSettings.muted) {
      return;
    }

    const resolvedVolume = Phaser.Math.Clamp((config.volume ?? 1) * this.audioSettings.volume, 0, 1);
    if (resolvedVolume <= 0) {
      return;
    }

    this.sound.play(key, {
      ...config,
      volume: resolvedVolume
    });
  }

  getAudioVolumePercent() {
    return Math.round(this.audioSettings.volume * 100);
  }

  setAudioVolume(volume, { preview = true } = {}) {
    const nextVolume = Phaser.Math.Clamp(volume, 0, 1);
    if (nextVolume === this.audioSettings.volume) {
      return;
    }

    this.audioSettings.volume = nextVolume;
    if (preview && !this.audioSettings.muted) {
      this.playSound(SOUND_KEYS.buttonClick);
    }
    this.renderDynamicUi();
  }

  toggleAudioMuted({ preview = true } = {}) {
    this.audioSettings.muted = !this.audioSettings.muted;
    if (!this.audioSettings.muted && preview) {
      this.playSound(SOUND_KEYS.buttonClick);
    }
    this.renderDynamicUi();
  }

  syncTurnAudio() {
    if (!this.session) {
      this.audioState.session = null;
      this.audioState.turnNumber = null;
      this.audioState.state = null;
      this.audioState.nextTurnSound = null;
      return;
    }

    if (this.audioState.session !== this.session) {
      this.audioState.session = this.session;
      this.audioState.turnNumber = this.session.turnNumber;
      this.audioState.state = this.session.stateMachine.state;
      this.audioState.nextTurnSound = null;
      return;
    }

    const currentState = this.session.stateMachine.state;
    if (this.audioState.state !== currentState) {
      this.audioState.state = currentState;
      if (currentState === 'end_game') {
        this.playSound(SOUND_KEYS.endGame);
        this.audioState.nextTurnSound = null;
        return;
      }
    }

    if (this.audioState.turnNumber === this.session.turnNumber) {
      return;
    }

    this.audioState.turnNumber = this.session.turnNumber;
    if (this.session.turnNumber > 1 && currentState !== 'end_game') {
      const nextTurnSound = this.audioState.nextTurnSound ?? SOUND_KEYS.roundStart;
      this.audioState.nextTurnSound = null;
      this.playSound(nextTurnSound);
    }
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

    const activeElement = globalThis.document?.activeElement ?? null;
    const overlayFocused = !!this.settingsOverlay && !!activeElement && this.settingsOverlay.contains(activeElement);

    if (event.key === 'Escape') {
      if (this.settingsAudioExpanded) {
        this.settingsAudioExpanded = false;
        this.renderSettingsOverlay();
      }
      activeElement?.blur?.();
      return;
    }

    if (event.key === 'Enter' && !overlayFocused) {
      this.startSessionFromSettings();
    }
  }

  ensureSettingsDomInput() {
    if (this.settingsInput || typeof document === 'undefined') {
      return;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = SETTINGS_NAME_MAX_LENGTH;
    input.autocomplete = 'off';
    input.autocapitalize = 'words';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Player name');
    Object.assign(input.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '0',
      height: '0',
      opacity: '0.01',
      border: '0',
      padding: '0',
      margin: '0',
      background: 'transparent',
      color: 'transparent',
      caretColor: 'transparent',
      pointerEvents: 'none',
      zIndex: '10000'
    });

    input.addEventListener('input', () => {
      if (this.session || this.activeSettingsField === null) {
        return;
      }

      const nextName = input.value.slice(0, SETTINGS_NAME_MAX_LENGTH);
      if (this.settingsDraft.playerNames[this.activeSettingsField] === nextName) {
        return;
      }

      this.settingsDraft.playerNames[this.activeSettingsField] = nextName;
      this.renderDynamicUi();
    });

    document.body.appendChild(input);
    this.settingsInput = input;
  }

  destroySettingsDomInput() {
    this.scale?.off('resize', this.syncSettingsDomInput, this);
    if (this.settingsInput?.parentNode) {
      this.settingsInput.parentNode.removeChild(this.settingsInput);
    }
    this.settingsInput = null;
    this.settingsOverlay = null;
    this.settingsAudioExpanded = false;
  }

  syncSettingsDomInput() {
    if (!this.settingsInput) {
      return;
    }

    if (this.session || this.activeSettingsField === null) {
      this.settingsInput.style.pointerEvents = 'none';
      this.settingsInput.style.width = '0';
      this.settingsInput.style.height = '0';
      this.settingsInput.style.opacity = '0';
      return;
    }

    const fieldBounds = this.settingsFieldBounds.get(this.activeSettingsField);
    const canvas = this.game.canvas;
    if (!fieldBounds || !canvas) {
      this.settingsInput.style.pointerEvents = 'none';
      this.settingsInput.style.opacity = '0';
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / layoutConfig.width;
    const scaleY = canvasRect.height / layoutConfig.height;
    const inputLeft = canvasRect.left + fieldBounds.x * scaleX;
    const inputTop = canvasRect.top + fieldBounds.y * scaleY;
    const inputWidth = fieldBounds.width * scaleX;
    const inputHeight = fieldBounds.height * scaleY;
    const nextValue = this.settingsDraft.playerNames[this.activeSettingsField] ?? '';

    if (this.settingsInput.value !== nextValue) {
      this.settingsInput.value = nextValue;
    }

    Object.assign(this.settingsInput.style, {
      left: `${inputLeft}px`,
      top: `${inputTop}px`,
      width: `${Math.max(1, inputWidth)}px`,
      height: `${Math.max(1, inputHeight)}px`,
      opacity: '0.01',
      pointerEvents: 'auto',
      fontSize: `${Math.max(16, 24 * scaleY)}px`
    });

    if (this.pendingSettingsInputFocus) {
      this.pendingSettingsInputFocus = false;
      this.settingsInput.focus({ preventScroll: true });
      this.settingsInput.setSelectionRange(this.settingsInput.value.length, this.settingsInput.value.length);
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
    this.settingsFieldBounds = new Map();
    this.turnTimerText = null;
    this.turnTimerLabel = null;

    if (!this.session) {
      this.renderSettingsOverlay();
      return;
    }

    this.hideSettingsOverlay();

    this.applyScoringPreview();
    this.syncMobileSectionWithSession();

    if (this.isMobilePortraitBlocked()) {
      this.drawRotatePrompt();
      this.syncTurnAudio();
      return;
    }

    this.drawShell();
    this.drawControls();
    this.drawMarket();
    this.drawPlayerArea();
    this.drawScoreTabs();
    this.drawDebugPanel();

    if (this.session.stateMachine.state === 'end_game') {
      this.drawEndGameOverlay();
    }

    this.syncTurnAudio();
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
    if (this.isMobileLandscapeLayout()) {
      this.drawMobileShell();
      this.drawMobileNavigation();
      return;
    }

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

  getViewportMetrics() {
    const canvas = this.game?.canvas ?? null;
    const rect = canvas?.getBoundingClientRect?.();
    return {
      width: rect?.width ?? globalThis.innerWidth ?? layoutConfig.width,
      height: rect?.height ?? globalThis.innerHeight ?? layoutConfig.height
    };
  }
  isMobileViewport() {
    return this.getViewportMetrics().width <= 960;
  }
  isMobileLandscapeLayout() {
    const viewport = this.getViewportMetrics();
    return viewport.width <= 960 && viewport.width > viewport.height;
  }
  isMobilePortraitBlocked() {
    const viewport = this.getViewportMetrics();
    return viewport.width <= 960 && viewport.width <= viewport.height;
  }
  getMobileUiRegions() {
    return {
      topBar: { x: 20, y: 16, width: 1560, height: 82 },
      nav: { x: 20, y: 110, width: 88, height: 770 },
      content: { x: 122, y: 110, width: 1458, height: 770 }
    };
  }
  getMobileNavEntries() {
    if (!this.session) {
      return [];
    }
    return [
      { section: 'market', label: 'Mkt' },
      ...this.session.players.map((player, index) => ({
        section: `player-${index}`,
        label: String(index + 1),
        title: player.name
      })),
      { section: 'debug', label: 'Dbg' }
    ];
  }
  resolveMobileSection(section = this.mobileSection) {
    if (!this.session) {
      return 'market';
    }
    if (section === 'market' || section === 'debug') {
      return section;
    }
    if (typeof section === 'string' && section.startsWith('player-')) {
      const parsedIndex = Number(section.slice('player-'.length));
      const playerIndex = Phaser.Math.Clamp(Number.isFinite(parsedIndex) ? parsedIndex : 0, 0, this.session.players.length - 1);
      return `player-${playerIndex}`;
    }
    return 'market';
  }
  syncMobileSectionWithSession() {
    if (!this.session) {
      return;
    }
    this.mobileSection = this.resolveMobileSection();
    if (this.mobileSection.startsWith('player-')) {
      const playerIndex = Number(this.mobileSection.slice('player-'.length));
      this.session.viewedPlayerIndex = playerIndex;
    }
  }
  setMobileSection(section) {
    if (!this.session) {
      return;
    }
    const nextSection = this.resolveMobileSection(section);
    const currentSection = this.resolveMobileSection();
    if (nextSection === currentSection) {
      return;
    }
    this.mobileSection = nextSection;
    this.syncMobileSectionWithSession();
    this.persistFairSession();
    this.playSound(SOUND_KEYS.tabSelect);
    this.playerAreaFlipMode = false;
    this.scrollState.salads = 0;
    this.renderDynamicUi();
  }
  drawRotatePrompt() {
    const { palette } = layoutConfig;
    const popup = { x: 330, y: 230, width: 940, height: 440 };
    drawPanel(this, popup, palette.panelAlt);
    this.track(this.add.text(layoutConfig.width / 2, popup.y + 104, 'Rotate device', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '40px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }).setOrigin(0.5));
    this.track(this.add.text(layoutConfig.width / 2, popup.y + 182, 'Use landscape orientation for mobile play.', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }).setOrigin(0.5));
    this.track(this.add.text(layoutConfig.width / 2, popup.y + 252, this.copy.turn(this.session.players[this.session.activePlayerIndex].name), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textMuted
    }).setOrigin(0.5));
  }
  getLanguageLabel() {
    return this.locale === 'ru' ? '\u042f\u0437\u044b\u043a' : 'Language';
  }

  syncSettingsDraftLocale(previousLocale, nextLocale) {
    const playerCount = this.settingsDraft.playerCount ?? defaultSessionOptions.playerCount;
    this.settingsDraft = {
      mode: this.settingsDraft.mode ?? defaultSessionOptions.mode,
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

  refreshSavedFairSessionState() {
    this.savedFairSessionState = loadFairSessionState(this.sessionRules, this.scoringCards);
    if (this.savedFairSessionState && !this.lastFairSessionOptions) {
      this.lastFairSessionOptions = this.savedFairSessionState.lastFairSessionOptions;
    }
    return this.savedFairSessionState;
  }

  persistFairSession() {
    if (!this.session || this.session.options?.seedDemoProgress === true) {
      return false;
    }

    const saved = saveFairSessionState({
      locale: this.locale,
      lastFairSessionOptions: this.lastFairSessionOptions,
      session: this.session
    });

    if (saved) {
      this.refreshSavedFairSessionState();
    }

    return saved;
  }

  clearSavedFairSession() {
    clearFairSessionState();
    this.savedFairSessionState = null;
  }

  resetSessionViewState(activeSettingsField = null) {
    this.activeSettingsField = activeSettingsField;
    this.scrollState = {
      salads: 0,
      debug: 0,
      results: 0
    };
    this.playerAreaFlipMode = false;
    this.mobileSection = 'market';
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
    if (this.session && this.session.options?.seedDemoProgress !== true) {
      this.persistFairSession();
    }
    this.renderDynamicUi();
  }

  ensureSettingsOverlay() {
    if (this.settingsOverlay || typeof document === 'undefined') {
      return;
    }
    ensureSettingsOverlayStyles(document);
    const overlay = document.createElement('div');
    overlay.className = 'fs-settings-overlay';
    overlay.hidden = true;
    overlay.addEventListener('click', (event) => this.handleSettingsOverlayClick(event));
    overlay.addEventListener('input', (event) => this.handleSettingsOverlayInput(event));
    overlay.addEventListener('change', (event) => this.handleSettingsOverlayChange(event));
    document.body.appendChild(overlay);
    this.settingsOverlay = overlay;
  }
  destroySettingsOverlay() {
    this.scale?.off('resize', this.syncSettingsOverlay, this);
    if (this.settingsOverlay?.parentNode) {
      this.settingsOverlay.parentNode.removeChild(this.settingsOverlay);
    }
    this.settingsOverlay = null;
  }
  syncSettingsOverlay() {
    if (this.session) {
      this.hideSettingsOverlay();
      return;
    }
    this.renderSettingsOverlay();
  }
  hideSettingsOverlay() {
    if (!this.settingsOverlay) {
      return;
    }
    this.settingsOverlay.hidden = true;
    this.settingsOverlay.innerHTML = '';
  }
  renderSettingsOverlay() {
    this.ensureSettingsOverlay();
    if (!this.settingsOverlay) {
      return;
    }
    this.settingsOverlay.hidden = false;
    this.settingsOverlay.innerHTML = buildSettingsOverlayMarkup({
      copy: this.copy,
      locale: this.locale,
      settingsDraft: this.settingsDraft,
      hasSavedFairSession: !!this.savedFairSessionState,
      audioSettings: this.audioSettings,
      audioExpanded: this.settingsAudioExpanded,
      volumePercent: this.getAudioVolumePercent()
    });
  }
  handleSettingsOverlayClick(event) {
    if (this.session) {
      return;
    }
    const target = event.target.closest('[data-action]');
    if (!target) {
      return;
    }
    const action = target.dataset.action;
    switch (action) {
      case 'set-locale':
        this.playSound(SOUND_KEYS.buttonClick);
        this.setLocale(target.dataset.locale);
        return;
      case 'toggle-audio-panel':
        this.playSound(SOUND_KEYS.buttonClick);
        this.settingsAudioExpanded = !this.settingsAudioExpanded;
        this.renderSettingsOverlay();
        return;
      case 'toggle-mute':
        this.toggleAudioMuted();
        return;
      case 'open-rules-help':
        this.playSound(SOUND_KEYS.buttonClick);
        this.openRulesHelp();
        return;
      case 'set-mode':
        this.playSound(SOUND_KEYS.buttonClick);
        this.updateSettingsMode(target.dataset.mode);
        return;
      case 'start-demo':
        this.playSound(SOUND_KEYS.buttonClick);
        this.startDemoSession();
        return;
      case 'set-player-count':
        this.playSound(SOUND_KEYS.buttonClick);
        this.updateSettingsPlayerCount(Number(target.dataset.playerCount));
        return;
      case 'continue-game':
        this.playSound(SOUND_KEYS.buttonClick);
        this.continueSavedSession();
        return;
      case 'new-game':
        this.playSound(SOUND_KEYS.buttonClick);
        this.startSessionFromSettings();
        return;
      default:
        return;
    }
  }
  handleSettingsOverlayInput(event) {
    if (this.session) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.dataset.role === 'player-name') {
      const playerIndex = Number(target.dataset.playerIndex);
      this.settingsDraft.playerNames[playerIndex] = target.value.slice(0, SETTINGS_NAME_MAX_LENGTH);
      return;
    }
    if (target.dataset.role === 'volume-range') {
      this.setAudioVolume(Number(target.value) / 100, { preview: false });
    }
  }
  handleSettingsOverlayChange(event) {
    if (this.session) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.dataset.role === 'player-count-select') {
      this.playSound(SOUND_KEYS.buttonClick);
      this.updateSettingsPlayerCount(Number(target.value));
      return;
    }
    if (target.dataset.role === 'volume-range') {
      this.setAudioVolume(Number(target.value) / 100);
    }
  }
  async openRulesHelp() {
    if (typeof globalThis.fetch !== 'function' || typeof globalThis.open !== 'function') {
      return;
    }
    const rulesPdfPath = SETTINGS_RULES_PDF_PATHS[this.locale] ?? SETTINGS_RULES_PDF_PATHS.en;
    try {
      const response = await globalThis.fetch(rulesPdfPath, { method: 'HEAD' });
      if (response.ok) {
        globalThis.open(rulesPdfPath, '_blank', 'noopener');
        return;
      }
    } catch {}
    globalThis.alert?.('Rules PDF is not attached to the project yet.');
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
        this.playSound(SOUND_KEYS.buttonClick);
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
    const hasSavedFairSession = !!this.savedFairSessionState;
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
    cursorY = localeLabel.y + localeLabel.height + 18;

    this.drawSettingsAudioPanel(contentX, cursorY, contentWidth);
    cursorY += 78;

    const lead = this.track(this.add.text(contentX, cursorY, this.copy.setupLead, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted,
      wordWrap: { width: contentWidth }
    }));
    cursorY = lead.y + lead.height + 24;

    const modeHeading = this.track(this.add.text(contentX, cursorY, this.copy.mode, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
    cursorY = modeHeading.y + modeHeading.height + 12;

    if (hasSavedFairSession) {
      const savedLabel = this.track(this.add.text(contentX, cursorY, this.copy.savedFairSessionReady, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '15px',
        color: palette.textMuted,
        wordWrap: { width: contentWidth }
      }));
      cursorY = savedLabel.y + savedLabel.height + 18;
    }

    const modeButtonY = cursorY;
    const modeButtonWidth = Math.floor((contentWidth - 18) / 2);
    const standardSelected = (this.settingsDraft.mode ?? defaultSessionOptions.mode) === 'standard';
    const freestyleSelected = (this.settingsDraft.mode ?? defaultSessionOptions.mode) === 'freestyle';
    this.drawActionButton(
      contentX,
      modeButtonY,
      modeButtonWidth,
      44,
      standardSelected ? palette.accent : 0x343a44,
      this.copy.modeGame,
      true,
      () => {
        this.playSound(SOUND_KEYS.buttonClick);
        this.updateSettingsMode('standard');
      },
      '18px',
      {
        soundKey: null,
        textColor: standardSelected ? '#111315' : palette.textPrimary,
        borderColor: standardSelected ? 0xf6f1c7 : 0x171b20
      }
    );
    this.drawActionButton(
      contentX + modeButtonWidth + 18,
      modeButtonY,
      modeButtonWidth,
      44,
      freestyleSelected ? palette.accent : 0x343a44,
      this.copy.modeFreestyle,
      true,
      () => {
        this.playSound(SOUND_KEYS.buttonClick);
        this.updateSettingsMode('freestyle');
      },
      '18px',
      {
        soundKey: null,
        textColor: freestyleSelected ? '#111315' : palette.textPrimary,
        borderColor: freestyleSelected ? 0xf6f1c7 : 0x171b20
      }
    );
    this.track(this.add.text(contentX, modeButtonY + 50, this.copy.modeGameHint, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '12px',
      color: standardSelected ? '#dbe6ef' : palette.textMuted,
      wordWrap: { width: modeButtonWidth - 6 }
    }));
    this.track(this.add.text(contentX + modeButtonWidth + 18, modeButtonY + 50, this.copy.modeFreestyleHint, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '12px',
      color: freestyleSelected ? '#dbe6ef' : palette.textMuted,
      wordWrap: { width: modeButtonWidth - 6 }
    }));
    cursorY += 94;
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

    const actionButtonY = panelY + panelHeight - 86;
    if (hasSavedFairSession) {
      this.drawActionButton(
        panelX + panelWidth - 406,
        actionButtonY,
        172,
        48,
        palette.accent,
        this.copy.continueGame,
        true,
        () => this.continueSavedSession(),
        '20px',
        { soundKey: null }
      );
    }

    this.drawActionButton(
      panelX + panelWidth - 214,
      actionButtonY,
      172,
      48,
      hasSavedFairSession ? 0x7f8a98 : palette.accent,
      this.copy.newGame,
      true,
      () => this.startSessionFromSettings(),
      '20px',
      {
        soundKey: null,
        textColor: hasSavedFairSession ? palette.textPrimary : '#111315'
      }
    );

    const demoPanel = {
      x: contentX,
      y: panelY + panelHeight - 154,
      width: 430,
      height: 108
    };
    drawPanel(this, demoPanel, 0x242a31);

    this.track(this.add.text(demoPanel.x + 18, demoPanel.y + 16, this.copy.demoMode, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '20px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(demoPanel.x + 18, demoPanel.y + 44, this.copy.setupDemo, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '14px',
      color: palette.textMuted,
      wordWrap: { width: demoPanel.width - 174 }
    }));

    this.drawActionButton(
      demoPanel.x + demoPanel.width - 146,
      demoPanel.y + 30,
      128,
      42,
      0x7f8a98,
      this.copy.openDemo,
      true,
      () => this.startDemoSession(),
      '18px',
      { soundKey: null }
    );
  }

  drawSettingsAudioPanel(x, y, width) {
    const { palette } = layoutConfig;
    const panelHeight = 56;
    const muteButtonWidth = 132;
    const sliderGap = 8;
    const sliderWidth = width - muteButtonWidth - 28;
    const sliderX = x;
    const sliderY = y + 26;
    const segmentCount = 10;
    const segmentGap = 6;
    const segmentWidth = Math.floor((sliderWidth - segmentGap * (segmentCount - 1)) / segmentCount);
    const activeSegments = Math.max(1, Math.round(this.audioSettings.volume * segmentCount));

    this.track(this.add.text(x, y, this.copy.soundSettings, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '16px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }));

    const statusLabel = this.audioSettings.muted
      ? this.copy.soundMuted
      : this.copy.soundVolume(this.getAudioVolumePercent());
    this.track(this.add.text(x + sliderWidth - 2, y, statusLabel, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '16px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    for (let index = 0; index < segmentCount; index += 1) {
      const segmentX = sliderX + index * (segmentWidth + segmentGap);
      const isActive = index < activeSegments;
      const fillColor = this.audioSettings.muted
        ? (isActive ? 0x56606d : 0x242a31)
        : (isActive ? palette.accent : 0x343a44);
      const textColor = this.audioSettings.muted ? palette.textMuted : '#111315';
      const segment = this.track(this.add.graphics());
      segment.fillStyle(fillColor, 1);
      segment.lineStyle(2, 0x171b20, 1);
      segment.fillRoundedRect(segmentX, sliderY, segmentWidth, panelHeight - 18, 8);
      segment.strokeRoundedRect(segmentX, sliderY, segmentWidth, panelHeight - 18, 8);

      this.track(this.add.text(segmentX + segmentWidth / 2, sliderY + 10, String((index + 1) * 10), {
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
        color: isActive ? textColor : palette.textMuted,
        fontStyle: 'bold'
      }).setOrigin(0.5, 0));

      this.addClickZone(segmentX, sliderY, segmentWidth, panelHeight - 18, () => {
        this.setAudioVolume((index + 1) / segmentCount);
      });
    }

    this.drawActionButton(
      x + width - muteButtonWidth,
      y + 16,
      muteButtonWidth,
      36,
      this.audioSettings.muted ? palette.warning : 0x3b4350,
      this.audioSettings.muted ? this.copy.unmuteSound : this.copy.muteSound,
      true,
      () => {
        this.toggleAudioMuted();
      },
      '16px',
      {
        soundKey: null,
        textColor: this.audioSettings.muted ? '#111315' : palette.textPrimary,
        borderColor: this.audioSettings.muted ? 0xf6f1c7 : 0x56606d
      }
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
      this.playSound(SOUND_KEYS.buttonClick);
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

    this.settingsFieldBounds.set(index, { x, y, width, height });

    this.addClickZone(x, y, width, height, () => {
      this.activeSettingsField = index;
      this.pendingSettingsInputFocus = true;
      this.renderDynamicUi();
    });
  }

  updateSettingsMode(mode) {
    if (this.settingsDraft.mode === mode) {
      return;
    }

    this.settingsDraft.mode = mode;
    this.renderDynamicUi();
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
      mode: this.settingsDraft.mode,
      playerCount: this.settingsDraft.playerCount,
      playerNames: this.settingsDraft.playerNames,
      locale: this.locale,
      liveScoring: false,
      seedDemoProgress: false
    }, this.locale);

    this.clearSavedFairSession();
    this.settingsDraft = createSettingsDraft(options, this.locale);
    this.launchSession(options);
  }

  startDemoSession() {
    const options = normalizeSessionOptions({
      mode: 'standard',
      playerCount: 2,
      playerNames: [`${this.copy.playerLabel(1)} Demo`, `${this.copy.playerLabel(2)} Demo`],
      locale: this.locale,
      liveScoring: false,
      seedDemoProgress: true
    }, this.locale);

    this.launchSession(options);
  }

  continueSavedSession() {
    const restoredState = this.savedFairSessionState ?? this.refreshSavedFairSessionState();
    if (!restoredState?.session) {
      return;
    }

    this.locale = normalizeLocale(restoredState.locale ?? this.locale);
    this.copy = getLocaleCopy(this.locale);
    this.fruitSaladLocale = this.locale;
    this.lastFairSessionOptions = restoredState.lastFairSessionOptions;
    this.session = restoredState.session;
    this.settingsDraft = createMenuSettingsDraft(this.lastFairSessionOptions, this.locale);
    this.resetSessionViewState(null);
    this.renderDynamicUi();
    this.playSound(SOUND_KEYS.gameStart);
    this.persistFairSession();
  }

  launchSession(options) {
    this.resetSessionViewState(null);
    if (options.seedDemoProgress !== true) {
      this.lastFairSessionOptions = normalizeSessionOptions(options, options?.locale ?? this.locale);
    }
    this.session = buildSession(options, this.sessionRules, this.scoringCards);
    if (options.seedDemoProgress !== true) {
      this.persistFairSession();
    }
    this.renderDynamicUi();
    this.playSound(SOUND_KEYS.gameStart);
  }

  returnToSettings() {
    if (this.session?.options?.seedDemoProgress !== true) {
      this.clearSavedFairSession();
    }

    this.session = null;
    this.resetSessionViewState(0);
    this.settingsDraft = createMenuSettingsDraft(this.lastFairSessionOptions, this.locale);
    this.renderDynamicUi();
  }
  drawMobileShell() {
    const { palette } = layoutConfig;
    const regions = this.getMobileUiRegions();
    drawPanel(this, regions.topBar, palette.panelAlt);
    drawPanel(this, regions.nav, palette.panelAlt);
    drawPanel(this, regions.content, palette.panel);
  }
  drawMobileNavButton(x, y, width, height, label, state, onClick) {
    const { palette } = layoutConfig;
    const fill = state.selected ? palette.accent : 0x343a44;
    const textColor = state.selected ? '#111315' : palette.textPrimary;
    const borderColor = state.selected ? 0xf6f1c7 : state.activePlayer ? 0xf5c451 : 0x171b20;
    const borderWidth = state.selected || state.activePlayer ? 3 : 2;
    const button = this.track(this.add.graphics());
    button.fillStyle(fill, 1);
    button.lineStyle(borderWidth, borderColor, 1);
    button.fillRoundedRect(x, y, width, height, 16);
    button.strokeRoundedRect(x, y, width, height, 16);
    this.track(this.add.text(x + width / 2, y + height / 2, label, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: textColor,
      fontStyle: 'bold'
    }).setOrigin(0.5));
    this.addClickZone(x, y, width, height, onClick);
  }
  drawMobileNavigation() {
    const regions = this.getMobileUiRegions();
    const entries = this.getMobileNavEntries();
    const activeSection = this.resolveMobileSection();
    const activePlayerSection = this.session ? `player-${this.session.activePlayerIndex}` : null;
    const buttonHeight = 56;
    const gap = 12;
    let y = regions.nav.y + 18;
    entries.forEach((entry) => {
      this.drawMobileNavButton(
        regions.nav.x + 14,
        y,
        regions.nav.width - 28,
        buttonHeight,
        entry.label,
        {
          selected: activeSection === entry.section,
          activePlayer: entry.section === activePlayerSection
        },
        () => this.setMobileSection(entry.section)
      );
      y += buttonHeight + gap;
    });
  }
  drawMobileControls() {
    const { palette } = layoutConfig;
    const regions = this.getMobileUiRegions();
    const activePlayer = this.session.players[this.session.activePlayerIndex];
    const topBar = regions.topBar;
    const timerValue = this.formatTurnTimer(this.session.turnTimer?.remainingMs ?? 0);
    const helpX = topBar.x + topBar.width - 182;
    const localeX = topBar.x + topBar.width - 138;
    const resetX = helpX - 120;
    const confirmX = resetX - 114;
    const titleWidth = helpX - (topBar.x + 194) - 14;
    const hintWidth = helpX - (topBar.x + 194) - 14;
    const timerVisualState = this.getTurnTimerVisualState(this.session.turnTimer?.remainingMs ?? 0);
    const timerBadge = this.track(this.add.graphics());
    timerBadge.fillStyle(0x1a1f25, 0.98);
    timerBadge.lineStyle(2, 0x343c46, 1);
    timerBadge.fillRoundedRect(topBar.x + 16, topBar.y + 16, 150, 50, 14);
    timerBadge.strokeRoundedRect(topBar.x + 16, topBar.y + 16, 150, 50, 14);
    this.turnTimerLabel = this.track(this.add.text(topBar.x + 28, topBar.y + 24, '', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '12px',
      color: timerVisualState.labelColor,
      fontStyle: 'bold'
    }).setAlpha(timerVisualState.alpha));
    this.turnTimerText = this.track(this.add.text(topBar.x + 90, topBar.y + 41, timerValue, {
      fontFamily: 'Consolas, monospace',
      fontSize: '21px',
      color: timerVisualState.color,
      fontStyle: 'bold',
      stroke: '#111315',
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(timerVisualState.alpha));
    this.track(this.add.text(topBar.x + 194, topBar.y + 16, this.session.stateMachine.state === 'end_game' ? this.copy.endGameReached : this.copy.turn(activePlayer.name), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '21px',
      color: palette.textPrimary,
      fontStyle: 'bold',
      wordWrap: { width: titleWidth }
    }));
    this.track(this.add.text(topBar.x + 194, topBar.y + 48, getTurnHint(this.session, this.locale), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '12px',
      color: palette.textPrimary,
      wordWrap: { width: hintWidth }
    }));
    this.drawActionButton(
      confirmX,
      topBar.y + 20,
      98,
      38,
      palette.accent,
      this.copy.confirm,
      canConfirmSelection(this.session),
      () => {
        if (confirmSelection(this.session)) {
          this.persistFairSession();
          this.playerAreaFlipMode = false;
          this.renderDynamicUi();
        }
      },
      '16px'
    );
    this.drawActionButton(
      resetX,
      topBar.y + 20,
      98,
      38,
      palette.warning,
      this.copy.reset,
      (this.session.pendingSelection.length > 0 || !!this.session.pendingFlip) && this.session.stateMachine.state !== 'end_game',
      () => {
        resetPendingSelection(this.session);
        this.persistFairSession();
        this.playerAreaFlipMode = false;
        this.renderDynamicUi();
      },
      '16px'
    );
    this.drawActionButton(
      helpX,
      topBar.y + 24,
      34,
      30,
      0x3b4350,
      '?',
      true,
      () => {
        this.playSound(SOUND_KEYS.buttonClick);
        this.openRulesHelp();
      },
      '18px',
      {
        borderColor: 0x56606d,
        textColor: palette.textPrimary
      }
    );
    this.drawLocaleToggle(localeX, topBar.y + 27, 54, 22, false);
  }
  drawMobileMarket() {
    const { palette } = layoutConfig;
    const { content } = this.getMobileUiRegions();
    const cardWidth = 210;
    const cardHeight = 292;
    const fruitOverlap = 118;
    const sideInset = 18;
    const labelY = content.y + 12;
    const deckY = content.y + 34;
    const columnWidth = Math.floor((content.width - sideInset * 2) / 3);
    this.session.decks.forEach((deck, index) => {
      const columnX = content.x + sideInset + index * columnWidth + Math.floor((columnWidth - cardWidth) / 2);
      const topSalad = deck.cards[0] ?? null;
      const deckSelected = topSalad ? this.isDeckSelected(deck.id, topSalad.runtimeId) : false;
      const deckFlipQueued = topSalad ? this.isPendingDeckFlip(deck.id, topSalad.runtimeId) : false;
      const deckEnabled = topSalad && this.canInteractWithDeck(deck.id);
      this.track(this.add.text(columnX, labelY, this.copy.deckLabel(index + 1), {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '17px',
        color: palette.textPrimary,
        fontStyle: 'bold'
      }));
      this.track(this.add.text(columnX + cardWidth + 16, labelY + 6, `(${deck.cards.length})`, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '13px',
        color: palette.textMuted,
        fontStyle: 'bold'
      }).setOrigin(0, 0));
      const deckVisual = topSalad
        ? drawSaladCard(this, columnX, deckY, cardWidth, cardHeight, topSalad)
        : drawCardPlaceholder(this, columnX, deckY, cardWidth, cardHeight, palette.deckBack, this.copy.deckEmpty);
      this.track(deckVisual);
      if (!deckEnabled && topSalad) {
        deckVisual.setAlpha(0.72);
      }
      if (deckSelected) {
        this.drawSelectionOutline(columnX, deckY, cardWidth, cardHeight, deckFlipQueued ? 0xf5c451 : 0x7ed957);
      }
      if (deckEnabled) {
        this.addClickZone(columnX, deckY, cardWidth, cardHeight, () => {
          if (selectDeckCard(this.session, deck.id)) {
            this.persistFairSession();
            this.playSound(SOUND_KEYS.cardSelect);
            this.renderDynamicUi();
          }
        });
      }
      const flipButtonX = columnX + cardWidth + 12;
      const flipButtonY = deckY + 126;
      if (deckSelected) {
        this.drawActionButton(
          flipButtonX,
          flipButtonY,
          92,
          28,
          deckFlipQueued ? 0xc7b672 : 0xf5c451,
          'Flip',
          this.canToggleSelectedDeckFlip(deck.id),
          () => {
            if (toggleSelectedDeckFlip(this.session, deck.id)) {
              this.persistFairSession();
              this.playerAreaFlipMode = false;
              this.renderDynamicUi();
            }
          },
          '20px'
        );
      }
      const marketStartY = deckY + cardHeight + 12;
      deck.market.forEach((marketCard, marketIndex) => {
        const slotY = marketStartY + marketIndex * fruitOverlap;
        const selected = this.isMarketSelected(deck.id, marketCard.id);
        const marketEnabled = this.canInteractWithMarketCard(deck.id, marketCard.id);
        const fruitCard = drawFruitCard(this, columnX, slotY, cardWidth, cardHeight, marketCard.fruit, {
          hideFrame: true
        });
        this.track(fruitCard);
        if (!marketEnabled) {
          fruitCard.setAlpha(0.72);
        }
        if (selected) {
          this.drawSelectionOutline(columnX, slotY, cardWidth, cardHeight, 0x7ed957);
        }
        if (marketEnabled) {
          this.addClickZone(columnX, slotY, cardWidth, cardHeight, () => {
            if (selectMarketCard(this.session, deck.id, marketCard.id)) {
              this.persistFairSession();
              this.playSound(SOUND_KEYS.cardSelect);
              this.renderDynamicUi();
            }
          });
        }
      });
    });
  }
  drawMobilePlayerArea() {
    const { palette } = layoutConfig;
    const { content } = this.getMobileUiRegions();
    const activePlayer = this.session.players[this.session.activePlayerIndex];
    const viewedPlayer = this.session.players[this.session.viewedPlayerIndex];
    const fruits = Object.entries(viewedPlayer.fruitCounts);
    const canFlipViewedSalads = this.canInteractWithOwnedSalads() && viewedPlayer.id === activePlayer.id;
    const hasPendingPlayerFlip = this.session.pendingFlip?.type === 'player-salad';
    const showPlayerFlipMode = canFlipViewedSalads && this.playerAreaFlipMode && !hasPendingPlayerFlip;
    const counterGapX = 12;
    const counterBlockWidth = 92;
    const counterRowWidth = fruits.length * counterBlockWidth + Math.max(0, fruits.length - 1) * counterGapX;
    const counterStartX = content.x + Math.max(24, Math.floor((content.width - counterRowWidth) / 2));
    const counterStartY = content.y + 62;
    const cardWidth = 210;
    const cardHeight = 292;
    const saladColumns = 3;
    const saladGapX = Math.floor((content.width - 40 - cardWidth * saladColumns) / (saladColumns - 1));
    const saladGapY = 16;
    const saladViewport = {
      x: content.x + 20,
      y: content.y + 232,
      width: content.width - 40,
      height: content.height - 252
    };
    if (!canFlipViewedSalads) {
      this.playerAreaFlipMode = false;
    }
    this.track(this.add.text(content.x + 20, content.y + 18, this.copy.playerArea(viewedPlayer.name), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '26px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
    this.track(this.add.text(content.x + content.width - 20, content.y + 22, this.copy.activePlayer(activePlayer.name), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '16px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }).setOrigin(1, 0));
    fruits.forEach(([fruit, count], index) => {
      const x = counterStartX + index * (counterBlockWidth + counterGapX);
      const y = counterStartY;
      this.track(drawFruitCounter(this, x, y, fruit, count));
    });
    this.track(this.add.text(content.x + 20, content.y + 188, this.copy.saladCards(viewedPlayer.salads.length), {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }));
    if (canFlipViewedSalads) {
      const flipModeActive = hasPendingPlayerFlip || this.playerAreaFlipMode;
      this.drawActionButton(
        content.x + content.width - 220,
        content.y + 180,
        196,
        30,
        flipModeActive ? palette.warning : 0x3b4350,
        this.copy.flipMode,
        true,
        () => {
          if (hasPendingPlayerFlip) {
            togglePlayerSaladFlip(this.session, this.session.pendingFlip.runtimeId);
            this.persistFairSession();
            this.playerAreaFlipMode = false;
          } else {
            this.playerAreaFlipMode = !this.playerAreaFlipMode;
          }
          this.renderDynamicUi();
        },
        '14px',
        {
          borderColor: flipModeActive ? 0xf6f1c7 : 0x56606d,
          textColor: flipModeActive ? '#111315' : palette.textPrimary
        }
      );
    }
    const saladRows = Math.max(1, Math.ceil(viewedPlayer.salads.length / saladColumns));
    const saladContentHeight = saladRows * cardHeight + Math.max(0, saladRows - 1) * saladGapY;
    const saladOffset = this.registerScrollRegion('salads', saladViewport, saladContentHeight);
    const saladContent = this.track(this.add.container(0, -saladOffset));
    saladContent.setMask(this.createViewportMask(saladViewport));
    viewedPlayer.salads.forEach((cardData, index) => {
      const column = index % saladColumns;
      const row = Math.floor(index / saladColumns);
      const x = saladViewport.x + column * (cardWidth + saladGapX);
      const y = saladViewport.y + row * (cardHeight + saladGapY);
      const renderedY = y - saladOffset;
      const card = drawSaladCard(this, x, y, cardWidth, cardHeight, cardData);
      saladContent.add(card);
      this.track(card);
      if (this.isPendingPlayerSaladFlip(cardData.runtimeId)) {
        const outline = this.drawSelectionOutline(x, y, cardWidth, cardHeight, 0xf5c451);
        saladContent.add(outline);
      }
      if (showPlayerFlipMode && this.isVisibleInViewport(renderedY, cardHeight, saladViewport)) {
        this.addClickZone(x, renderedY, cardWidth, cardHeight, () => {
          if (togglePlayerSaladFlip(this.session, cardData.runtimeId)) {
            this.persistFairSession();
            this.playSound(SOUND_KEYS.cardSelect);
            this.playerAreaFlipMode = false;
            this.renderDynamicUi();
          }
        });
      }
    });
    this.drawScrollBar('salads');
  }
  drawMobileDebugPanel() {
    const { palette } = layoutConfig;
    const { content } = this.getMobileUiRegions();
    const debugLines = buildDebugSnapshot(this.session, this.locale);
    const debugViewport = {
      x: content.x + 24,
      y: content.y + 58,
      width: content.width - 42,
      height: content.height - 82
    };
    const lineHeight = 18;
    const debugContentHeight = debugLines.length * lineHeight;
    const debugOffset = this.registerScrollRegion('debug', debugViewport, debugContentHeight);
    const debugContent = this.track(this.add.container(0, -debugOffset));
    debugContent.setMask(this.createViewportMask(debugViewport));
    this.track(this.add.text(content.x + 24, content.y + 18, this.copy.debugOverlay, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
    debugLines.forEach((line, index) => {
      const text = this.add.text(debugViewport.x, debugViewport.y + index * lineHeight, line, {
        fontFamily: 'Consolas, monospace',
        fontSize: '14px',
        color: palette.textMuted,
        wordWrap: { width: debugViewport.width - 10 }
      });
      debugContent.add(text);
      this.track(text);
    });
    this.drawScrollBar('debug');
  }

  drawControls() {
    if (this.isMobileLandscapeLayout()) {
      this.drawMobileControls();
      return;
    }

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
          this.persistFairSession();
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
        this.persistFairSession();
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
      hitArea.on('pointerup', () => {
        const soundKey = Object.prototype.hasOwnProperty.call(options, 'soundKey')
          ? options.soundKey
          : SOUND_KEYS.buttonClick;
        if (soundKey) {
          this.playSound(soundKey);
        }
        onClick();
      });
      this.track(hitArea);
    }
  }

  drawMarket() {
    if (this.isMobileLandscapeLayout()) {
      if (this.resolveMobileSection() !== 'market') {
        return;
      }
      this.drawMobileMarket();
      return;
    }

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
            this.persistFairSession();
            this.playSound(SOUND_KEYS.cardSelect);
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
              this.persistFairSession();
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
              this.persistFairSession();
              this.playSound(SOUND_KEYS.cardSelect);
              this.renderDynamicUi();
            }
          });
        }
      });
    });
  }

  drawPlayerArea() {
    if (this.isMobileLandscapeLayout()) {
      if (!this.resolveMobileSection().startsWith('player-')) {
        return;
      }
      this.drawMobilePlayerArea();
      return;
    }

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
            this.persistFairSession();
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
            this.persistFairSession();
            this.playSound(SOUND_KEYS.cardSelect);
            this.playerAreaFlipMode = false;
            this.renderDynamicUi();
          }
        });
      }
    });

    this.drawScrollBar('salads');
  }

  drawScoreTabs() {
    if (this.isMobileLandscapeLayout()) {
      return;
    }

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
    if (this.isMobileLandscapeLayout()) {
      this.mobileSection = `player-${nextIndex}`;
    }
    this.persistFairSession();
    this.playSound(SOUND_KEYS.tabSelect);
    this.playerAreaFlipMode = false;
    this.scrollState.salads = 0;
    this.renderDynamicUi();
  }

  drawDebugPanel() {
    if (this.isMobileLandscapeLayout()) {
      if (this.resolveMobileSection() !== 'debug') {
        return;
      }
      this.drawMobileDebugPanel();
      return;
    }

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

    this.drawActionButton(
      popup.x + popup.width - 214,
      popup.y + 28,
      172,
      42,
      palette.accent,
      this.copy.backToSettings,
      true,
      () => this.returnToSettings(),
      '18px'
    );

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

