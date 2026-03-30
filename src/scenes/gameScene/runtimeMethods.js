import * as Phaser from '../../../node_modules/phaser/dist/phaser.esm.js';
import { layoutConfig } from '../../config/layoutConfig.js';
import { drawSaladCard } from '../../ui/cardRenderer.js';
import { scoreTable } from '../../core/scoring/scoringEngine.js';
import { buildEndGameResults } from '../../core/endGameResults.js';
import { getCardCopy, getFruitName, getParityLabel } from '../../i18n/locale.js';
import { buildDeckDebugSnapshot, SOUND_KEYS } from './constants.js';

export const runtimeMethods = {
  preloadAudioAssets() {
    this.load.audio(SOUND_KEYS.gameStart, 'assets/audio/snd_game_start.wav');
    this.load.audio(SOUND_KEYS.tabSelect, 'assets/audio/snd_tab_select.wav');
    this.load.audio(SOUND_KEYS.buttonClick, 'assets/audio/snd_button_click.wav');
    this.load.audio(SOUND_KEYS.cardSelect, 'assets/audio/snd_card_select.WAV');
    this.load.audio(SOUND_KEYS.roundStart, 'assets/audio/snd_round_start.wav');
    this.load.audio(SOUND_KEYS.timerEnds, 'assets/audio/snd_timer_ends.wav');
    this.load.audio(SOUND_KEYS.endGame, 'assets/audio/snd_end_game.wav');
  },

  playSound(key, config = {}) {
    if (!key || !this.cache.audio.exists(key) || this.audioSettings.muted) {
      return;
    }

    const resolvedVolume = Phaser.Math.Clamp((config.volume ?? 1) * this.audioSettings.volume, 0, 1);
    if (resolvedVolume <= 0) {
      return;
    }

    this.sound.play(key, {
      ...config,
      volume: resolvedVolume
    });
  },

  getAudioVolumePercent() {
    return Math.round(this.audioSettings.volume * 100);
  },

  setAudioVolume(volume, { preview = true } = {}) {
    const nextVolume = Phaser.Math.Clamp(volume, 0, 1);
    if (nextVolume === this.audioSettings.volume) {
      return;
    }

    this.audioSettings.volume = nextVolume;
    if (preview && !this.audioSettings.muted) {
      this.playSound(SOUND_KEYS.buttonClick);
    }
    this.renderDynamicUi();
  },

  toggleAudioMuted({ preview = true } = {}) {
    this.audioSettings.muted = !this.audioSettings.muted;
    if (!this.audioSettings.muted && preview) {
      this.playSound(SOUND_KEYS.buttonClick);
    }
    this.renderDynamicUi();
  },

  syncTurnAudio() {
    if (!this.session) {
      this.audioState.session = null;
      this.audioState.turnNumber = null;
      this.audioState.state = null;
      this.audioState.nextTurnSound = null;
      return;
    }

    if (this.audioState.session !== this.session) {
      this.audioState.session = this.session;
      this.audioState.turnNumber = this.session.turnNumber;
      this.audioState.state = this.session.stateMachine.state;
      this.audioState.nextTurnSound = null;
      return;
    }

    const currentState = this.session.stateMachine.state;
    if (this.audioState.state !== currentState) {
      this.audioState.state = currentState;
      if (currentState === 'end_game') {
        this.playSound(SOUND_KEYS.endGame);
        this.audioState.nextTurnSound = null;
        return;
      }
    }

    if (this.audioState.turnNumber === this.session.turnNumber) {
      return;
    }

    this.audioState.turnNumber = this.session.turnNumber;
    if (this.session.turnNumber > 1 && currentState !== 'end_game') {
      const nextTurnSound = this.audioState.nextTurnSound ?? SOUND_KEYS.roundStart;
      this.audioState.nextTurnSound = null;
      this.playSound(nextTurnSound);
    }
  },

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
  },

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
  },

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
  },

  getEndGameViewedEntry() {
    const results = this.getEndGameResults();
    if (!results) {
      return null;
    }

    return results.standings.find((entry) => entry.playerId === this.session.players[this.session.viewedPlayerIndex]?.id) ?? results.standings[0] ?? null;
  },

  formatPlacement(placement) {
    return this.copy.placementShort(placement);
  },

  formatTurnTimer(remainingMs) {
    const totalSeconds = Math.max(0, Math.ceil((remainingMs ?? 0) / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  },

  getTurnTimerVisualState(remainingMs) {
    if (remainingMs <= 10000) {
      return {
        color: '#ff6b6b',
        labelColor: '#ffb3b3',
        alpha: 0.45 + Math.abs(Math.sin(Date.now() / 140)) * 0.55
      };
    }

    if (remainingMs <= 30000) {
      return {
        color: '#ff8f6b',
        labelColor: '#ffd2c7',
        alpha: 1
      };
    }

    return {
      color: '#f8f4ea',
      labelColor: '#c7c2b8',
      alpha: 1
    };
  },

  formatFruitSummary(fruitCounts) {
    return Object.entries(fruitCounts)
      .map(([fruit, count]) => `${getFruitName(fruit, this.locale)}:${count}`)
      .join('  ');
  },

  formatRuleType(ruleType) {
    const cardCopy = getCardCopy(this.locale);

    switch (ruleType) {
      case 'compare-majority':
        return cardCopy.compareMajority;
      case 'compare-minority':
        return cardCopy.compareMinority;
      case 'compare-wealth':
        return cardCopy.compareWealth;
      case 'compare-poverty':
        return cardCopy.comparePoverty;
      case 'parity-fruit':
        return cardCopy.parity;
      case 'threshold-per-kind':
        return this.locale === 'ru' ? '\u041f\u043e\u0440\u043e\u0433 \u043f\u043e \u0432\u0438\u0434\u0430\u043c' : 'Threshold per kind';
      case 'missing-kind':
        return this.locale === 'ru' ? '\u041e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044e\u0449\u0438\u0435 \u0432\u0438\u0434\u044b' : 'Missing kind';
      case 'set-same-kind':
        return this.locale === 'ru' ? '\u041d\u0430\u0431\u043e\u0440 \u043e\u0434\u0438\u043d\u0430\u043a\u043e\u0432\u044b\u0445' : 'Same-kind set';
      case 'set-distinct-kind':
        return this.locale === 'ru' ? '\u041d\u0430\u0431\u043e\u0440 \u0440\u0430\u0437\u043d\u044b\u0445' : 'Distinct-kind set';
      case 'per-fruit-flat':
        return this.locale === 'ru' ? '\u041e\u0447\u043a\u0438 \u0437\u0430 \u0444\u0440\u0443\u043a\u0442' : 'Per-fruit flat';
      case 'per-fruit-multi':
        return this.locale === 'ru' ? '\u041e\u0447\u043a\u0438 \u0437\u0430 \u0444\u0440\u0443\u043a\u0442\u044b' : 'Per-fruit multi';
      default:
        return ruleType;
    }
  },

  formatBreakdownLine(cardScore) {
    const { breakdown } = cardScore;

    switch (breakdown.kind) {
      case 'compare':
        return this.copy.breakdownCompare(this.formatRuleType(cardScore.ruleType), breakdown.metric, cardScore.points);
      case 'parity':
        return this.copy.breakdownParity(getFruitName(breakdown.targetFruit, this.locale), getParityLabel(breakdown.parity, this.locale), breakdown.count, cardScore.points);
      case 'threshold':
        return this.copy.breakdownThreshold(breakdown.qualifiedKinds, breakdown.threshold, cardScore.points);
      case 'missing':
        return this.copy.breakdownMissing(breakdown.missingKinds, cardScore.points);
      case 'same-kind-set':
        return this.copy.breakdownSameKind(getFruitName(breakdown.targetFruit, this.locale), breakdown.count, breakdown.completedSets, cardScore.points);
      case 'distinct-kind-set':
        return this.copy.breakdownDistinct(breakdown.completedSets, breakdown.setSize, cardScore.points);
      case 'per-fruit-flat':
        return this.copy.breakdownPerFruitFlat(getFruitName(breakdown.targetFruit, this.locale), breakdown.count, breakdown.pointsPerFruit, cardScore.points);
      case 'per-fruit-multi':
        return breakdown.contributions
          .map((item) => `${getFruitName(item.fruit, this.locale)} ${item.count}x${item.pointsPerFruit}=${item.subtotal}`)
          .join('  ');
      default:
        return `${this.formatRuleType(cardScore.ruleType)} -> ${cardScore.points}`;
    }
  },

  drawSummaryMetricPill(x, y, width, label, value, accentColor = 0x343a44) {
    const { palette } = layoutConfig;
    const pill = this.track(this.add.graphics());
    pill.fillStyle(accentColor, 0.96);
    pill.lineStyle(2, 0x171b20, 1);
    pill.fillRoundedRect(x, y, width, 66, 14);
    pill.strokeRoundedRect(x, y, width, 66, 14);

    this.track(this.add.text(x + 14, y + 12, label, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '13px',
      color: palette.textMuted,
      fontStyle: 'bold'
    }));

    this.track(this.add.text(x + 14, y + 35, value, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '24px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }));
  },

  drawEndGameBreakdownEntry(container, viewport, y, cardScore, rowWidth) {
    const { palette } = layoutConfig;
    const row = this.add.graphics();
    row.fillStyle(0x20262d, 0.98);
    row.lineStyle(2, 0x171b20, 1);
    row.fillRoundedRect(viewport.x, y, rowWidth, 134, 16);
    row.strokeRoundedRect(viewport.x, y, rowWidth, 134, 16);
    container.add(row);
    this.track(row);

    const card = drawSaladCard(this, viewport.x + 18, y + 14, 86, 106, {
      ...cardScore.cardSnapshot,
      runtimeId: cardScore.cardSnapshot.runtimeId ?? `endgame-${cardScore.cardId}`
    });
    container.add(card);
    this.track(card);

    const pointsPill = this.add.graphics();
    pointsPill.fillStyle(cardScore.points >= 0 ? 0x37553a : 0x6c3a3a, 1);
    pointsPill.lineStyle(2, 0x171b20, 1);
    pointsPill.fillRoundedRect(viewport.x + rowWidth - 112, y + 16, 92, 34, 12);
    pointsPill.strokeRoundedRect(viewport.x + rowWidth - 112, y + 16, 92, 34, 12);
    container.add(pointsPill);
    this.track(pointsPill);

    const pointsLabel = this.add.text(viewport.x + rowWidth - 66, y + 33, `${cardScore.points >= 0 ? '+' : ''}${cardScore.points}`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '20px',
      color: palette.textPrimary,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(pointsLabel);
    this.track(pointsLabel);

    const title = this.add.text(viewport.x + 122, y + 18, `#${cardScore.cardId}  ${this.formatRuleType(cardScore.ruleType)}`, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: '17px',
      color: palette.textPrimary,
      fontStyle: 'bold',
      wordWrap: { width: rowWidth - 258 }
    });
    container.add(title);
    this.track(title);

    const subtitle = this.add.text(viewport.x + 122, y + 50, this.formatBreakdownLine(cardScore), {
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      color: palette.textMuted,
      wordWrap: { width: rowWidth - 160 }
    });
    container.add(subtitle);
    this.track(subtitle);
  },

  renderDynamicUi() {
    this.dynamicObjects.forEach((object) => object.destroy());
    this.dynamicObjects = [];
    this.scrollMeta = {};
    this.settingsFieldBounds = new Map();
    this.turnTimerText = null;
    this.turnTimerLabel = null;

    if (!this.session) {
      this.renderSettingsOverlay();
      return;
    }

    this.hideSettingsOverlay();

    this.applyScoringPreview();
    this.syncMobileSectionWithSession();

    if (this.isMobilePortraitBlocked()) {
      this.drawRotatePrompt();
      this.syncTurnAudio();
      return;
    }

    this.drawShell();
    this.drawControls();
    this.drawMarket();
    this.drawPlayerArea();
    this.drawScoreTabs();
    this.drawDebugPanel();

    if (this.session.stateMachine.state === 'end_game') {
      this.drawEndGameOverlay();
    }

    this.syncTurnAudio();
  },

  track(object) {
    this.dynamicObjects.push(object);
    return object;
  },

  drawBackground() {
    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x14181d, 0x14181d, 0x0c0e10, 0x0c0e10, 1);
    gradient.fillRect(0, 0, layoutConfig.width, layoutConfig.height);
  }
};
