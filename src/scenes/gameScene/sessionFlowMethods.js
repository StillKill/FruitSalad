import * as Phaser from '../../../node_modules/phaser/dist/phaser.esm.js';
import {
  buildDefaultPlayerNames,
  createSettingsDraft,
  createMenuSettingsDraft,
  normalizeSessionOptions
} from '../../config/sessionDefaults.js';
import { buildSession } from '../../core/sessionSetup.js';
import { getLocaleCopy, normalizeLocale } from '../../i18n/locale.js';
import { SOUND_KEYS } from './constants.js';

export const sessionFlowMethods = {
  updateSettingsMode(mode) {
    if (this.settingsDraft.mode === mode) {
      return;
    }

    this.settingsDraft.mode = mode;
    this.renderDynamicUi();
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  returnToSettings() {
    if (this.session?.options?.seedDemoProgress !== true) {
      this.clearSavedFairSession();
    }

    this.session = null;
    this.resetSessionViewState(0);
    this.settingsDraft = createMenuSettingsDraft(this.lastFairSessionOptions, this.locale);
    this.renderDynamicUi();
  }
};
