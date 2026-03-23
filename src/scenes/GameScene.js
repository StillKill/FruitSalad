import Phaser from '../../node_modules/phaser/dist/phaser.esm.js';
import { layoutConfig } from '../config/layoutConfig.js';
import { defaultSessionOptions } from '../config/sessionDefaults.js';
import { buildSession } from '../core/sessionSetup.js';
import { drawPanel, drawCardPlaceholder } from '../ui/boardLayout.js';
import { buildDebugSnapshot } from '../ui/debugOverlay.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.session = null;
  }

  preload() {
    this.load.json('sessionRules', 'data/sessions/session-rules.json');
    this.load.json('scoringCards', 'data/cards/scoring-cards.json');
    this.load.json('debugFields', 'data/debug/debug-overlay-fields.json');
    this.load.image('layoutReference', 'assets/layout/fruit-salad-layout.png');
  }

  create() {
    const sessionRules = this.cache.json.get('sessionRules');
    const scoringCards = this.cache.json.get('scoringCards');

    this.session = buildSession(defaultSessionOptions, sessionRules, scoringCards);

    this.drawBackground();
    this.drawShell();
    this.drawControls();
    this.drawMarket();
    this.drawPlayerArea();
    this.drawScoreTabs();
    this.drawDebugPanel();
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

    this.add.text(regions.controls.x + 24, buttonY, 'Session setup complete', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    });

    this.drawButton(regions.controls.x + 458, buttonY - 4, 136, 44, palette.accent, 'Confirm');
    this.drawButton(regions.controls.x + 620, buttonY - 4, 136, 44, palette.warning, 'Reset');

    this.add.text(regions.controls.x + 24, regions.controls.y + 74, 'Tip: choose 2 market cards or 1 deck card, then confirm the turn.', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted
    });
  }

  drawButton(x, y, width, height, fillColor, label) {
    const graphics = this.add.graphics();
    graphics.fillStyle(fillColor, 1);
    graphics.fillRoundedRect(x, y, width, height, 10);

    this.add.text(x + width / 2, y + height / 2, label, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '20px',
      color: '#111315',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  drawMarket() {
    const { card, palette, regions } = layoutConfig;
    const deckX = regions.market.x + 24;
    const deckY = regions.market.y + 30;

    this.add.text(deckX, deckY - 8, 'Decks & Market', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    });

    this.session.decks.forEach((deck, index) => {
      const columnX = deckX + index * 220;
      const titleY = deckY + 32;

      this.add.text(columnX, titleY, `${deck.id} (${deck.cards.length} left)`, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '18px',
        color: palette.textMuted
      });

      drawCardPlaceholder(this, columnX, titleY + 26, card.width, card.height, palette.deckBack, 'Scoring deck');

      deck.market.forEach((marketCard, marketIndex) => {
        const slotY = titleY + 226 + marketIndex * (card.height + 16);
        drawCardPlaceholder(
          this,
          columnX,
          slotY,
          card.width,
          card.height,
          palette.marketCard,
          `#${marketCard.id} ${marketCard.ruleType}\nback: ${marketCard.backFruit}`
        );
      });
    });
  }

  drawPlayerArea() {
    const { palette, regions } = layoutConfig;
    const activePlayer = this.session.players[this.session.activePlayerIndex];
    const fruits = Object.entries(activePlayer.fruitCounts);

    this.add.text(regions.player.x + 24, regions.player.y + 18, `${activePlayer.name} area`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    });

    fruits.forEach(([fruit, count], index) => {
      const x = regions.player.x + 24 + index * 124;
      const y = regions.player.y + 72;
      const icon = this.add.graphics();

      icon.fillStyle(0x2a3038, 1);
      icon.fillCircle(x + 30, y + 30, 28);

      this.add.text(x, y + 70, fruit.toUpperCase(), {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '14px',
        color: palette.textMuted
      });

      this.add.text(x + 28, y + 30, String(count), {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '22px',
        color: palette.textPrimary,
        fontStyle: 'bold'
      }).setOrigin(0.5);
    });

    this.add.text(regions.player.x + 24, regions.player.y + 196, 'Salad cards', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textMuted
    });

    const sampleCards = this.session.decks.flatMap((deck) => deck.market).slice(0, 4);
    sampleCards.forEach((cardData, index) => {
      drawCardPlaceholder(
        this,
        regions.player.x + 24 + index * 150,
        regions.player.y + 226,
        132,
        182,
        palette.saladCard,
        `#${cardData.id}\n${cardData.ruleType}`
      );
    });
  }

  drawScoreTabs() {
    const { palette, regions } = layoutConfig;

    this.session.players.forEach((player, index) => {
      const x = regions.scoreTabs.x + 18 + index * 132;
      const y = regions.scoreTabs.y + 12;
      const isActive = index === this.session.activePlayerIndex;
      const fill = isActive ? palette.accent : 0x343a44;
      const pill = this.add.graphics();

      pill.fillStyle(fill, 1);
      pill.fillRoundedRect(x, y, 118, 44, 12);

      this.add.text(x + 12, y + 8, player.name, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '16px',
        color: isActive ? '#111315' : palette.textPrimary,
        fontStyle: 'bold'
      });

      this.add.text(x + 12, y + 52, `Score: ${player.score}`, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '14px',
        color: palette.textMuted
      });
    });
  }

  drawDebugPanel() {
    const { palette, regions } = layoutConfig;
    const debugLines = buildDebugSnapshot(this.session);
    const configuredFields = this.cache.json.get('debugFields').fields;

    this.add.text(regions.debug.x + 18, regions.debug.y + 12, 'Debug overlay', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '18px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    });

    this.add.text(regions.debug.x + 18, regions.debug.y + 40, debugLines.join('   |   '), {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: palette.textMuted
    });

    this.add.text(regions.debug.x + 18, regions.debug.y + 60, `Useful fields: ${configuredFields.join(', ')}`, {
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
      color: palette.textMuted
    });
  }
}