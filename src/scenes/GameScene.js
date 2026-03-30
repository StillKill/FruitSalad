import * as Phaser from '../../node_modules/phaser/dist/phaser.esm.js';
import { createMenuSettingsDraft } from '../config/sessionDefaults.js';
import { canConfirmSelection, expireTurn } from '../core/sessionActions.js';
import { preloadCardTextures } from '../ui/cardRenderer.js';
import { detectGameLocale, getLocaleCopy } from '../i18n/locale.js';
import { DEFAULT_SOUND_VOLUME, SOUND_KEYS } from './gameScene/constants.js';
import { runtimeMethods } from './gameScene/runtimeMethods.js';
import { settingsOverlayMethods } from './gameScene/settingsOverlayMethods.js';
import { sessionFlowMethods } from './gameScene/sessionFlowMethods.js';
import { viewportMethods } from './gameScene/viewportMethods.js';
import { mobileLayoutMethods } from './gameScene/mobileLayoutMethods.js';
import { boardLayoutMethods } from './gameScene/boardLayoutMethods.js';
import { sharedUiMethods } from './gameScene/sharedUiMethods.js';

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
}

Object.assign(
  GameScene.prototype,
  runtimeMethods,
  settingsOverlayMethods,
  sessionFlowMethods,
  viewportMethods,
  mobileLayoutMethods,
  boardLayoutMethods,
  sharedUiMethods
);
