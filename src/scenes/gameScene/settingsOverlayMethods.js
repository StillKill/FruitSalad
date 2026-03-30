import { layoutConfig } from '../../config/layoutConfig.js';
import {
  defaultSessionOptions,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT,
  relocalizePlayerNames
} from '../../config/sessionDefaults.js';
import {
  clearFairSessionState,
  loadFairSessionState,
  saveFairSessionState
} from '../../core/sessionPersistence.js';
import { drawPanel } from '../../ui/boardLayout.js';
import { buildSettingsOverlayMarkup, ensureSettingsOverlayStyles, SETTINGS_RULES_PDF_PATHS } from '../../ui/settingsLayout.js';
import { getLocaleCopy, normalizeLocale } from '../../i18n/locale.js';
import { SETTINGS_NAME_MAX_LENGTH, SOUND_KEYS } from './constants.js';

export const settingsOverlayMethods = {
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
  },

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
  },

  destroySettingsDomInput() {
    this.scale?.off('resize', this.syncSettingsDomInput, this);
    if (this.settingsInput?.parentNode) {
      this.settingsInput.parentNode.removeChild(this.settingsInput);
    }
    this.settingsInput = null;
    this.settingsOverlay = null;
    this.settingsAudioExpanded = false;
  },

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
  },

  getLanguageLabel() {
    return this.locale === 'ru' ? '\u042f\u0437\u044b\u043a' : 'Language';
  },

  syncSettingsDraftLocale(previousLocale, nextLocale) {
    const playerCount = this.settingsDraft.playerCount ?? defaultSessionOptions.playerCount;
    this.settingsDraft = {
      mode: this.settingsDraft.mode ?? defaultSessionOptions.mode,
      playerCount,
      playerNames: relocalizePlayerNames(this.settingsDraft.playerNames ?? [], playerCount, previousLocale, nextLocale),
      locale: nextLocale
    };
  },

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
  },

  refreshSavedFairSessionState() {
    this.savedFairSessionState = loadFairSessionState(this.sessionRules, this.scoringCards);
    if (this.savedFairSessionState && !this.lastFairSessionOptions) {
      this.lastFairSessionOptions = this.savedFairSessionState.lastFairSessionOptions;
    }
    return this.savedFairSessionState;
  },

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
  },

  clearSavedFairSession() {
    clearFairSessionState();
    this.savedFairSessionState = null;
  },

  resetSessionViewState(activeSettingsField = null) {
    this.activeSettingsField = activeSettingsField;
    this.scrollState = {
      salads: 0,
      debug: 0,
      results: 0
    };
    this.playerAreaFlipMode = false;
    this.mobileSection = 'market';
  },

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
  },

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
  },

  destroySettingsOverlay() {
    this.scale?.off('resize', this.syncSettingsOverlay, this);
    if (this.settingsOverlay?.parentNode) {
      this.settingsOverlay.parentNode.removeChild(this.settingsOverlay);
    }
    this.settingsOverlay = null;
  },

  syncSettingsOverlay() {
    if (this.session) {
      this.hideSettingsOverlay();
      return;
    }
    this.renderSettingsOverlay();
  },

  hideSettingsOverlay() {
    if (!this.settingsOverlay) {
      return;
    }
    this.settingsOverlay.hidden = true;
    this.settingsOverlay.innerHTML = '';
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
};
