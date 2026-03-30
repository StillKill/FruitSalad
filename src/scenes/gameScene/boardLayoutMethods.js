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

export const boardLayoutMethods = {
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
  },

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
  },

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
  },

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
  },

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
  },

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
};
