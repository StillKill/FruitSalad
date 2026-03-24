import * as Phaser from '../../node_modules/phaser/dist/phaser.esm.js';
import { layoutConfig } from '../config/layoutConfig.js';
import { defaultSessionOptions } from '../config/sessionDefaults.js';
import { buildSession } from '../core/sessionSetup.js';
import {
  canConfirmSelection,
  confirmSelection,
  getTurnHint,
  resetPendingSelection,
  selectDeckCard,
  selectMarketCard
} from '../core/sessionActions.js';
import { drawPanel, drawCardPlaceholder } from '../ui/boardLayout.js';
import { preloadCardTextures, drawFruitCard, drawFruitCounter, drawSaladCard } from '../ui/cardRenderer.js';
import { buildDebugSnapshot } from '../ui/debugOverlay.js';
import { scoreTable } from '../core/scoring/scoringEngine.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.session = null;
    this.dynamicObjects = [];
  }

  preload() {
    this.load.json('sessionRules', 'data/sessions/session-rules.json');
    this.load.json('scoringCards', 'data/cards/scoring-cards.json');
    this.load.json('debugFields', 'data/debug/debug-overlay-fields.json');
    this.load.image('layoutReference', 'assets/layout/fruit-salad-layout.png');
    preloadCardTextures(this);
  }

  create() {
    const sessionRules = this.cache.json.get('sessionRules');
    const scoringCards = this.cache.json.get('scoringCards');

    this.session = buildSession(defaultSessionOptions, sessionRules, scoringCards);
    this.applyScoringPreview();

    this.drawBackground();
    this.drawShell();
    this.renderDynamicUi();
  }

  applyScoringPreview() {
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

  renderDynamicUi() {
    this.dynamicObjects.forEach((object) => object.destroy());
    this.dynamicObjects = [];

    this.applyScoringPreview();
    this.drawControls();
    this.drawMarket();
    this.drawPlayerArea();
    this.drawScoreTabs();
    this.drawDebugPanel();
  }

  track(object) {
    this.dynamicObjects.push(object);
    return object;
  }

  drawBackground() {
    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x14181d, 0x14181d, 0x0c0e10, 0x0c0e10, 1);
    gradient.fillRect(0, 0, layoutConfig.width, layoutConfig.height);

    const ref = this.add.image(1410, 120, 'layoutReference');
    ref.setDisplaySize(170, 120);
    ref.setAlpha(0.28);
  }

  drawShell() {
    const { regions, palette } = layoutConfig;
    drawPanel(this, regions.market, palette.panel);
    drawPanel(this, regions.controls, palette.panelAlt);
    drawPanel(this, regions.player, palette.panel);
    drawPanel(this, regions.scoreTabs, palette.panelAlt);
    drawPanel(this, regions.debug, palette.panelAlt);

    this.add.text(48, 18, 'Fruit Salad Prototype', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '26px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    });
  }

  drawControls() {
    const { palette, regions } = layoutConfig;
    const buttonY = regions.controls.y + 18;
    const activePlayer = this.session.players[this.session.activePlayerIndex];
    const leader = this.session.scorePreview?.[0] ?? null;
    const title = this.session.stateMachine.state === 'end_game'
      ? 'End game reached'
      : `${activePlayer.name} turn`;
    const leaderText = leader ? `${leader.playerName} (${leader.totalPoints})` : 'n/a';

    this.track(this.add.text(regions.controls.x + 24, buttonY, title, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.drawActionButton(
      regions.controls.x + 458,
      buttonY - 4,
      136,
      44,
      palette.accent,
      'Confirm',
      canConfirmSelection(this.session),
      () => {
        if (confirmSelection(this.session)) {
          this.renderDynamicUi();
        }
      }
    );

    this.drawActionButton(
      regions.controls.x + 620,
      buttonY - 4,
      136,
      44,
      palette.warning,
      'Reset',
      this.session.pendingSelection.length > 0 && this.session.stateMachine.state !== 'end_game',
      () => {
        resetPendingSelection(this.session);
        this.renderDynamicUi();
      }
    );

    this.track(this.add.text(
      regions.controls.x + 24,
      regions.controls.y + 74,
      `${getTurnHint(this.session)} Leader: ${leaderText}`,
      {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '18px',
        color: palette.textMuted,
        wordWrap: { width: 730 }
      }
    ));
  }

  drawActionButton(x, y, width, height, fillColor, label, enabled, onClick) {
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
      fontSize: '20px',
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
    const deckY = regions.market.y + 30;

    this.track(this.add.text(deckX, deckY - 8, 'Decks & Market', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.session.decks.forEach((deck, index) => {
      const columnX = deckX + index * 220;
      const titleY = deckY + 32;
      const topSalad = deck.cards[0] ?? null;
      const deckSelected = topSalad ? this.isDeckSelected(deck.id, topSalad.runtimeId) : false;
      const deckEnabled = topSalad && this.canInteractWithDeck(deck.id);

      this.track(this.add.text(columnX, titleY, `${deck.id} (${deck.cards.length} salads left)`, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '18px',
        color: palette.textMuted
      }));

      const deckVisual = topSalad
        ? drawSaladCard(this, columnX, titleY + 26, card.width, card.height, topSalad)
        : drawCardPlaceholder(this, columnX, titleY + 26, card.width, card.height, palette.deckBack, 'Deck empty');
      this.track(deckVisual);

      if (!deckEnabled && topSalad) {
        deckVisual.setAlpha(0.72);
      }

      if (deckSelected) {
        this.drawSelectionOutline(columnX, titleY + 26, card.width, card.height, 0x7ed957);
      }

      if (deckEnabled) {
        this.addClickZone(columnX, titleY + 26, card.width, card.height, () => {
          if (selectDeckCard(this.session, deck.id)) {
            this.renderDynamicUi();
          }
        });
      }

      deck.market.forEach((marketCard, marketIndex) => {
        const slotY = titleY + 226 + marketIndex * (card.height + 16);
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
    const fruits = Object.entries(activePlayer.fruitCounts);

    this.track(this.add.text(regions.player.x + 24, regions.player.y + 18, `${activePlayer.name} area`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    fruits.forEach(([fruit, count], index) => {
      const x = regions.player.x + 24 + index * 124;
      const y = regions.player.y + 72;
      this.track(drawFruitCounter(this, x, y, fruit, count));
    });

    this.track(this.add.text(regions.player.x + 24, regions.player.y + 196, 'Salad cards', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted
    }));

    activePlayer.salads.slice(0, 4).forEach((cardData, index) => {
      this.track(drawSaladCard(
        this,
        regions.player.x + 24 + index * 150,
        regions.player.y + 226,
        132,
        182,
        cardData
      ));
    });
  }

  drawScoreTabs() {
    const { palette, regions } = layoutConfig;

    this.session.players.forEach((player, index) => {
      const x = regions.scoreTabs.x + 18 + index * 132;
      const y = regions.scoreTabs.y + 12;
      const isActive = index === this.session.activePlayerIndex;
      const fill = isActive ? palette.accent : 0x343a44;
      const pill = this.track(this.add.graphics());

      pill.fillStyle(fill, 1);
      pill.fillRoundedRect(x, y, 118, 44, 12);

      this.track(this.add.text(x + 12, y + 8, player.name, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '16px',
        color: isActive ? '#111315' : palette.textPrimary,
        fontStyle: 'bold'
      }));

      this.track(this.add.text(x + 12, y + 52, `Preview: ${player.score}`, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '14px',
        color: palette.textMuted
      }));
    });
  }

  drawDebugPanel() {
    const { palette, regions } = layoutConfig;
    const debugLines = buildDebugSnapshot(this.session);
    const configuredFields = this.cache.json.get('debugFields').fields;

    this.track(this.add.text(regions.debug.x + 18, regions.debug.y + 12, 'Debug overlay', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(regions.debug.x + 18, regions.debug.y + 40, debugLines.join('   |   '), {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: palette.textMuted,
      wordWrap: { width: 770 }
    }));

    this.track(this.add.text(regions.debug.x + 18, regions.debug.y + 60, `Useful fields: ${configuredFields.join(', ')}`, {
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
      color: palette.textMuted
    }));
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

  isDeckSelected(deckId, runtimeId) {
    return this.session.pendingSelection.some((selection) => selection.type === 'deck' && selection.deckId === deckId && selection.runtimeId === runtimeId);
  }

  isMarketSelected(deckId, cardId) {
    return this.session.pendingSelection.some((selection) => selection.type === 'market' && selection.deckId === deckId && selection.cardId === cardId);
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


