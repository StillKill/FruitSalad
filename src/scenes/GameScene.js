import * as Phaser from '../../node_modules/phaser/dist/phaser.esm.js';
import { layoutConfig } from '../config/layoutConfig.js';
import {
  buildDefaultPlayerNames,
  defaultSessionOptions,
  normalizeSessionOptions,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT
} from '../config/sessionDefaults.js';
import { buildSession } from '../core/sessionSetup.js';
import {
  canConfirmSelection,
  confirmSelection,
  getPendingFlipSummary,
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

const SETTINGS_NAME_MAX_LENGTH = 18;

function createSettingsDraft(options = defaultSessionOptions) {
  const normalized = normalizeSessionOptions(options);
  return {
    playerCount: normalized.playerCount,
    playerNames: [...normalized.playerNames]
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
    this.session = null;
    this.sessionRules = null;
    this.scoringCards = null;
    this.dynamicObjects = [];
    this.settingsDraft = createSettingsDraft();
    this.activeSettingsField = 0;
    this.scrollState = {
      salads: 0,
      debug: 0,
      results: 0
    };
    this.scrollMeta = {};
    this.playerAreaFlipMode = false;
  }

  preload() {
    this.load.json('sessionRules', 'data/sessions/session-rules.json');
    this.load.json('scoringCards', 'data/cards/scoring-cards.json');
    preloadCardTextures(this);
  }

  create() {
    this.sessionRules = this.cache.json.get('sessionRules');
    this.scoringCards = this.cache.json.get('scoringCards');
    this.settingsDraft = createSettingsDraft(defaultSessionOptions);

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
    const suffix = placement === 1 ? 'st' : placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th';
    return `${placement}${suffix}`;
  }

  formatFruitSummary(fruitCounts) {
    return Object.entries(fruitCounts)
      .map(([fruit, count]) => `${fruit}:${count}`)
      .join('  ');
  }

  formatBreakdownLine(cardScore) {
    const { breakdown } = cardScore;

    switch (breakdown.kind) {
      case 'compare':
        return `${cardScore.ruleType} -> metric ${breakdown.metric}, card ${cardScore.points}`;
      case 'parity':
        return `${breakdown.targetFruit} ${breakdown.parity} (${breakdown.count}) -> ${cardScore.points}`;
      case 'threshold':
        return `${breakdown.qualifiedKinds} kinds at ${breakdown.threshold}+ -> ${cardScore.points}`;
      case 'missing':
        return `${breakdown.missingKinds} missing kinds -> ${cardScore.points}`;
      case 'same-kind-set':
        return `${breakdown.targetFruit} x${breakdown.count}, ${breakdown.completedSets} sets -> ${cardScore.points}`;
      case 'distinct-kind-set':
        return `${breakdown.completedSets} distinct sets of ${breakdown.setSize} -> ${cardScore.points}`;
      case 'per-fruit-flat':
        return `${breakdown.targetFruit} x${breakdown.count} @ ${breakdown.pointsPerFruit} -> ${cardScore.points}`;
      case 'per-fruit-multi':
        return breakdown.contributions
          .map((item) => `${item.fruit} ${item.count}x${item.pointsPerFruit}=${item.subtotal}`)
          .join('  ');
      default:
        return `${cardScore.ruleType} -> ${cardScore.points}`;
    }
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

    this.track(this.add.text(30, 10, 'Fruit Salad Prototype', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
  }

  drawSettingsScreen() {
    const { palette } = layoutConfig;
    const panelX = 360;
    const panelY = 92;
    const panelWidth = 880;
    const panelHeight = 716;
    const countY = panelY + 178;
    const nameStartY = panelY + 286;

    drawPanel(this, { x: panelX, y: panelY, width: panelWidth, height: panelHeight }, palette.panelAlt);

    this.track(this.add.text(panelX + 42, panelY + 28, 'Fruit Salad Setup', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '34px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(panelX + 42, panelY + 78, 'Choose the player count, then click a name field to type. Press Enter to start a fair session.', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted,
      wordWrap: { width: panelWidth - 84 }
    }));

    this.track(this.add.text(panelX + 42, panelY + 108, 'Need a fast UI/scoring preview instead? Launch the demo session with seeded progress.', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '16px',
      color: palette.textMuted,
      wordWrap: { width: panelWidth - 84 }
    }));

    this.track(this.add.text(panelX + 42, panelY + 142, 'Players', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    for (let playerCount = MIN_PLAYER_COUNT; playerCount <= MAX_PLAYER_COUNT; playerCount += 1) {
      const index = playerCount - MIN_PLAYER_COUNT;
      const buttonX = panelX + 42 + index * 92;
      const isSelected = this.settingsDraft.playerCount === playerCount;
      this.drawSettingsCountButton(buttonX, countY, 72, 48, playerCount, isSelected);
    }

    this.track(this.add.text(panelX + 42, panelY + 246, 'Names', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    for (let index = 0; index < this.settingsDraft.playerCount; index += 1) {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const fieldX = panelX + 42 + column * 392;
      const fieldY = nameStartY + row * 100;
      this.drawSettingsNameField(fieldX, fieldY, 348, 62, index);
    }

    this.drawActionButton(
      panelX + panelWidth - 406,
      panelY + panelHeight - 86,
      172,
      48,
      0x7f8a98,
      'Open Demo',
      true,
      () => this.startDemoSession()
    );

    this.drawActionButton(
      panelX + panelWidth - 214,
      panelY + panelHeight - 86,
      172,
      48,
      palette.accent,
      'Start Fair Game',
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
    const label = `Player ${index + 1}`;
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

    const displayValue = value || 'Type a name';
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
    const defaultNames = buildDefaultPlayerNames(playerCount);

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
      liveScoring: false,
      seedDemoProgress: false
    });

    this.settingsDraft = createSettingsDraft(options);
    this.launchSession(options);
  }

  startDemoSession() {
    const options = normalizeSessionOptions({
      playerCount: 2,
      playerNames: ['Demo 1', 'Demo 2'],
      liveScoring: false,
      seedDemoProgress: true
    });

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
    const buttonY = regions.controls.y + 14;
    const activePlayer = this.session.players[this.session.activePlayerIndex];
    const leader = this.session.scorePreview?.[0] ?? null;
    const title = this.session.stateMachine.state === 'end_game'
      ? 'End game reached'
      : `${activePlayer.name} turn`;
    const leaderText = leader ? `${leader.playerName} (${leader.totalPoints})` : 'n/a';
    const flipText = this.session.pendingFlip ? getPendingFlipSummary(this.session) : 'none';

    this.track(this.add.text(regions.controls.x + 24, buttonY, title, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.drawActionButton(
      regions.controls.x + 458,
      buttonY - 2,
      136,
      42,
      palette.accent,
      'Confirm',
      canConfirmSelection(this.session),
      () => {
        if (confirmSelection(this.session)) {
          this.playerAreaFlipMode = false;
          this.renderDynamicUi();
        }
      }
    );

    this.drawActionButton(
      regions.controls.x + 620,
      buttonY - 2,
      136,
      42,
      palette.warning,
      'Reset',
      (this.session.pendingSelection.length > 0 || !!this.session.pendingFlip) && this.session.stateMachine.state !== 'end_game',
      () => {
        resetPendingSelection(this.session);
        this.playerAreaFlipMode = false;
        this.renderDynamicUi();
      }
    );

    this.track(this.add.text(
      regions.controls.x + 24,
      regions.controls.y + 56,
      getTurnHint(this.session),
      {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '13px',
        color: palette.textMuted,
        wordWrap: { width: 720 }
      }
    ));

    this.track(this.add.text(
      regions.controls.x + 24,
      regions.controls.y + 92,
      `Leader: ${leaderText}   Flip: ${flipText}`,
      {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '13px',
        color: palette.textMuted,
        fontStyle: 'bold'
      }
    ));
  }

  drawActionButton(x, y, width, height, fillColor, label, enabled, onClick, fontSize = '20px') {
    const container = this.track(this.add.container(x, y));
    const graphics = this.add.graphics();
    const alpha = enabled ? 1 : 0.32;

    graphics.fillStyle(fillColor, alpha);
    graphics.lineStyle(2, 0x171b20, enabled ? 1 : 0.45);
    graphics.fillRoundedRect(0, 0, width, height, 10);
    graphics.strokeRoundedRect(0, 0, width, height, 10);
    container.add(graphics);

    const text = this.add.text(width / 2, height / 2, label, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize,
      color: enabled ? '#111315' : '#43474d',
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

    this.track(this.add.text(deckX, deckY - 6, 'Decks & Market', {
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

      this.track(this.add.text(columnX, titleY, `${deck.id} (${deck.cards.length} salads left)`, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '17px',
        color: palette.textMuted
      }));

      const deckVisual = topSalad
        ? drawSaladCard(this, columnX, titleY + 24, card.width, card.height, topSalad)
        : drawCardPlaceholder(this, columnX, titleY + 24, card.width, card.height, palette.deckBack, 'Deck empty');
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
          deckFlipQueued ? 'Keep as Salad' : 'Flip to Fruit',
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

    this.track(this.add.text(regions.player.x + 24, regions.player.y + 18, `${viewedPlayer.name} area`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(regions.player.x + regions.player.width - 24, regions.player.y + 24, `Active: ${activePlayer.name}`, {
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

    this.track(this.add.text(regions.player.x + 24, regions.player.y + 196, `Salad cards (${viewedPlayer.salads.length})`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted
    }));

    if (canFlipViewedSalads) {
      const playerFlipLabel = 'Flip Mode';
      const playerFlipColor = hasPendingPlayerFlip || this.playerAreaFlipMode ? palette.warning : 0xf5c451;

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
        '13px'
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

      this.track(this.add.text(x + 12, y + 44, `Preview: ${player.score}`, {
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
    const debugLines = buildDebugSnapshot(this.session);
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

    this.track(this.add.text(regions.debug.x + 18, regions.debug.y + 10, 'Debug overlay', {
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
    const rightX = popup.x + 530;
    const topY = popup.y + 28;
    const standingsRowHeight = 54;
    const breakdownViewport = {
      x: rightX,
      y: popup.y + 146,
      width: popup.width - 560,
      height: popup.height - 178
    };

    this.track(this.add.text(leftX, topY, 'Final Results', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '34px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(leftX, topY + 46, winner ? `${winner.playerName} wins with ${winner.totalPoints} points` : 'Game finished', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(leftX, popup.y + 108, 'Standings', {
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
      row.fillRoundedRect(leftX, rowY, 360, 42, 12);
      row.strokeRoundedRect(leftX, rowY, 360, 42, 12);

      this.track(this.add.text(leftX + 14, rowY + 8, `${this.formatPlacement(entry.placement)}  ${entry.playerName}`, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '18px',
        color: isViewed ? palette.accent : palette.textPrimary,
        fontStyle: 'bold'
      }));

      this.track(this.add.text(leftX + 286, rowY + 10, String(entry.totalPoints), {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '20px',
        color: palette.textPrimary,
        fontStyle: 'bold'
      }).setOrigin(1, 0));

      this.addClickZone(leftX, rowY, 360, 42, () => {
        this.setViewedPlayerIndex(results.playerStates.findIndex((player) => player.playerId === entry.playerId));
      });
    });

    this.track(this.add.text(rightX, popup.y + 108, `${viewedEntry.playerName} Breakdown`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '22px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    if (viewedState) {
      this.track(this.add.text(rightX, popup.y + 138, `Fruits: ${this.formatFruitSummary(viewedState.fruitCounts)}`, {
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
        color: palette.textMuted
      }));
    }

    const breakdownLines = viewedEntry.cardScores.length > 0
      ? viewedEntry.cardScores.flatMap((cardScore) => [
        `#${cardScore.cardId} ${cardScore.ruleType}  =>  ${cardScore.points}`,
        this.formatBreakdownLine(cardScore)
      ])
      : ['No salad cards scored in this game.'];

    const lineHeight = 24;
    const breakdownContentHeight = breakdownLines.length * lineHeight;
    const breakdownOffset = this.registerScrollRegion('results', breakdownViewport, breakdownContentHeight);
    const breakdownContent = this.track(this.add.container(0, -breakdownOffset));
    breakdownContent.setMask(this.createViewportMask(breakdownViewport));

    breakdownLines.forEach((line, index) => {
      const isHeader = index % 2 === 0 || viewedEntry.cardScores.length === 0;
      const text = this.add.text(breakdownViewport.x, breakdownViewport.y + index * lineHeight, line, {
        fontFamily: isHeader ? '"Trebuchet MS", sans-serif' : 'Consolas, monospace',
        fontSize: isHeader ? '16px' : '13px',
        color: isHeader ? palette.textPrimary : palette.textMuted,
        fontStyle: isHeader ? 'bold' : 'normal',
        wordWrap: { width: breakdownViewport.width - 18 }
      });
      breakdownContent.add(text);
      this.track(text);
    });

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


