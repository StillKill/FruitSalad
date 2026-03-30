import * as Phaser from '../../../node_modules/phaser/dist/phaser.esm.js';
import { layoutConfig } from '../../config/layoutConfig.js';
import { SOUND_KEYS } from './constants.js';

export const sharedUiMethods = {
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
  },

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
  },

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
  },

  registerScrollRegion(key, viewport, contentHeight) {
    const maxScroll = Math.max(0, contentHeight - viewport.height);
    this.scrollState[key] = Phaser.Math.Clamp(this.scrollState[key] ?? 0, 0, maxScroll);
    this.scrollMeta[key] = { viewport, contentHeight, maxScroll };
    return this.scrollState[key];
  },

  createViewportMask(viewport) {
    const graphics = this.track(this.add.graphics());
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
    graphics.visible = false;
    return graphics.createGeometryMask();
  },

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
  },

  drawSelectionOutline(x, y, width, height, color) {
    const graphics = this.track(this.add.graphics());
    graphics.lineStyle(4, color, 1);
    graphics.strokeRoundedRect(x - 4, y - 4, width + 8, height + 8, 16);
    return graphics;
  },

  addClickZone(x, y, width, height, onClick) {
    const zone = this.track(this.add.zone(x + width / 2, y + height / 2, width, height).setInteractive({ useHandCursor: true }));
    zone.on('pointerup', onClick);
    return zone;
  },

  isVisibleInViewport(y, height, viewport) {
    return y < viewport.y + viewport.height && y + height > viewport.y;
  },

  isDeckSelected(deckId, runtimeId) {
    return this.session.pendingSelection.some((selection) => selection.type === 'deck' && selection.deckId === deckId && selection.runtimeId === runtimeId);
  },

  isMarketSelected(deckId, cardId) {
    return this.session.pendingSelection.some((selection) => selection.type === 'market' && selection.deckId === deckId && selection.cardId === cardId);
  },

  isPendingDeckFlip(deckId, runtimeId) {
    return this.session.pendingFlip?.type === 'selected-deck'
      && this.session.pendingFlip.deckId === deckId
      && this.session.pendingFlip.runtimeId === runtimeId;
  },

  isPendingPlayerSaladFlip(runtimeId) {
    return this.session.pendingFlip?.type === 'player-salad' && this.session.pendingFlip.runtimeId === runtimeId;
  },

  canToggleSelectedDeckFlip(deckId) {
    if (!['turn', 'end_turn'].includes(this.session.stateMachine.state)) {
      return false;
    }

    const selection = this.session.pendingSelection.find((item) => item.type === 'deck');
    return selection?.deckId === deckId;
  },

  canInteractWithOwnedSalads() {
    return ['turn', 'end_turn'].includes(this.session.stateMachine.state);
  },

  canInteractWithDeck(deckId) {
    if (!['turn', 'end_turn'].includes(this.session.stateMachine.state)) {
      return false;
    }

    if (this.session.pendingSelection.some((selection) => selection.type === 'market')) {
      return false;
    }

    return !!this.session.decks.find((deck) => deck.id === deckId)?.cards[0];
  },

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
};
