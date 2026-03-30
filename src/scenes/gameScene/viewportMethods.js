import * as Phaser from '../../../node_modules/phaser/dist/phaser.esm.js';
import { layoutConfig } from '../../config/layoutConfig.js';
import { drawPanel } from '../../ui/boardLayout.js';
import { SOUND_KEYS } from './constants.js';

export const viewportMethods = {
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
  },

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
  },

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
  },

  getViewportMetrics() {
    const canvas = this.game?.canvas ?? null;
    const rect = canvas?.getBoundingClientRect?.();
    return {
      width: rect?.width ?? globalThis.innerWidth ?? layoutConfig.width,
      height: rect?.height ?? globalThis.innerHeight ?? layoutConfig.height
    };
  },

  isMobileViewport() {
    return this.getViewportMetrics().width <= 960;
  },

  isMobileLandscapeLayout() {
    const viewport = this.getViewportMetrics();
    return viewport.width <= 960 && viewport.width > viewport.height;
  },

  isMobilePortraitBlocked() {
    const viewport = this.getViewportMetrics();
    return viewport.width <= 960 && viewport.width <= viewport.height;
  },

  getMobileUiRegions() {
    return {
      topBar: { x: 20, y: 16, width: 1560, height: 82 },
      nav: { x: 20, y: 110, width: 88, height: 770 },
      content: { x: 122, y: 110, width: 1458, height: 770 }
    };
  },

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
  },

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
  },

  syncMobileSectionWithSession() {
    if (!this.session) {
      return;
    }
    this.mobileSection = this.resolveMobileSection();
    if (this.mobileSection.startsWith('player-')) {
      const playerIndex = Number(this.mobileSection.slice('player-'.length));
      this.session.viewedPlayerIndex = playerIndex;
    }
  },

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
  },

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
};
