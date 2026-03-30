import { layoutConfig } from '../../config/layoutConfig.js';
import {
  canConfirmSelection,
  confirmSelection,
  getTurnHint,
  resetPendingSelection,
  selectDeckCard,
  selectMarketCard,
  togglePlayerSaladFlip,
  toggleSelectedDeckFlip
} from '../../core/sessionActions.js';
import { drawPanel, drawCardPlaceholder } from '../../ui/boardLayout.js';
import { buildDebugSnapshot } from '../../ui/debugOverlay.js';
import { drawFruitCard, drawFruitCounter, drawSaladCard } from '../../ui/cardRenderer.js';
import { SOUND_KEYS } from './constants.js';

export const mobileLayoutMethods = {
  drawMobileShell() {
    const { palette } = layoutConfig;
    const regions = this.getMobileUiRegions();
    drawPanel(this, regions.topBar, palette.panelAlt);
    drawPanel(this, regions.nav, palette.panelAlt);
    drawPanel(this, regions.content, palette.panel);
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
};
