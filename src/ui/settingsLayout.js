import { MAX_PLAYER_COUNT, MIN_PLAYER_COUNT } from '../config/sessionDefaults.js';

const SETTINGS_STYLE_ID = 'fruit-salad-settings-style';
export const SETTINGS_RULES_PDF_PATH = 'assets/rules/fruit-salad-rules.pdf';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderLocaleButton(localeKey, isSelected) {
  return `
    <button
      type="button"
      class="fs-segmented-button${isSelected ? ' is-selected' : ''}"
      data-action="set-locale"
      data-locale="${localeKey}">
      ${localeKey.toUpperCase()}
    </button>
  `;
}

function renderModeCard({ action, label, hint, isSelected = false, variant = 'default', mode = '' }) {
  return `
    <button
      type="button"
      class="fs-mode-card${isSelected ? ' is-selected' : ''}${variant === 'demo' ? ' is-demo' : ''}"
      data-action="${action}"${mode ? ` data-mode="${mode}"` : ''}>
      <span class="fs-mode-card__title">${escapeHtml(label)}</span>
      <span class="fs-mode-card__hint">${escapeHtml(hint)}</span>
    </button>
  `;
}

function renderPlayerCountButton(playerCount, isSelected) {
  return `
    <button
      type="button"
      class="fs-count-chip${isSelected ? ' is-selected' : ''}"
      data-action="set-player-count"
      data-player-count="${playerCount}">
      ${playerCount}
    </button>
  `;
}

function renderPlayerOption(playerCount, isSelected) {
  return `
    <option value="${playerCount}"${isSelected ? ' selected' : ''}>${playerCount}</option>
  `;
}

function renderPlayerNameField(copy, value, index) {
  return `
    <label class="fs-field" for="fs-player-name-${index}">
      <span class="fs-field__label">${escapeHtml(copy.playerLabel(index + 1))}</span>
      <input
        id="fs-player-name-${index}"
        class="fs-field__input"
        type="text"
        maxlength="18"
        autocomplete="off"
        autocapitalize="words"
        spellcheck="false"
        data-role="player-name"
        data-player-index="${index}"
        value="${escapeHtml(value ?? '')}"
        placeholder="${escapeHtml(copy.typeName)}" />
    </label>
  `;
}

export function ensureSettingsOverlayStyles(document) {
  if (!document || document.getElementById(SETTINGS_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = SETTINGS_STYLE_ID;
  style.textContent = `
    .fs-settings-overlay {
      position: fixed;
      inset: 0;
      z-index: 5000;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 16px;
      pointer-events: none;
      overflow: auto;
    }

    .fs-settings-overlay[hidden] {
      display: none;
    }

    .fs-settings-shell {
      width: min(100%, 1120px);
      pointer-events: auto;
      padding: clamp(18px, 2.8vw, 34px);
      border: 2px solid rgba(92, 103, 120, 0.88);
      border-radius: 28px;
      background:
        radial-gradient(circle at top right, rgba(126, 217, 87, 0.10), transparent 28%),
        linear-gradient(180deg, rgba(40, 46, 54, 0.96), rgba(26, 30, 36, 0.98));
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
      color: #f8f4ea;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
    }

    .fs-settings-header {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18px;
    }

    .fs-settings-title {
      margin: 0;
      font-size: clamp(32px, 4vw, 52px);
      line-height: 1;
    }

    .fs-settings-lead {
      margin: 10px 0 0;
      max-width: 780px;
      color: #c7c2b8;
      font-size: clamp(15px, 1.7vw, 19px);
      line-height: 1.45;
    }

    .fs-toolbar {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
      min-width: min(100%, 260px);
    }

    .fs-toolbar-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      width: 100%;
    }

    .fs-segmented {
      display: inline-flex;
      gap: 8px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(19, 23, 28, 0.72);
      border: 1px solid rgba(92, 103, 120, 0.65);
    }

    .fs-segmented-button,
    .fs-icon-button,
    .fs-count-chip,
    .fs-action-button,
    .fs-mode-card,
    .fs-inline-button {
      appearance: none;
      border: 0;
      cursor: pointer;
      font: inherit;
      transition: transform 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;
    }

    .fs-segmented-button {
      min-width: 60px;
      padding: 10px 16px;
      border-radius: 999px;
      color: #f8f4ea;
      background: transparent;
      font-weight: 700;
    }

    .fs-segmented-button.is-selected {
      background: #7ed957;
      color: #111315;
      box-shadow: inset 0 0 0 2px #f6f1c7;
    }

    .fs-icon-stack {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .fs-icon-button {
      width: 46px;
      height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      background: rgba(59, 67, 80, 0.95);
      color: #f8f4ea;
      border: 1px solid rgba(92, 103, 120, 0.7);
      padding: 0;
    }

    .fs-icon-button:hover,
    .fs-segmented-button:hover,
    .fs-count-chip:hover,
    .fs-action-button:hover,
    .fs-mode-card:hover,
    .fs-inline-button:hover {
      transform: translateY(-1px);
    }

    .fs-icon-button svg {
      width: 20px;
      height: 20px;
      display: block;
      fill: currentColor;
    }

    .fs-icon-button.is-active,
    .fs-inline-button.is-active {
      background: #7ed957;
      color: #111315;
      border-color: #f6f1c7;
    }

    .fs-toolbar-panel {
      width: min(360px, 100%);
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(19, 23, 28, 0.92);
      border: 1px solid rgba(92, 103, 120, 0.7);
      display: none;
      gap: 12px;
    }

    .fs-toolbar-panel.is-open {
      display: grid;
    }

    .fs-toolbar-panel__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      color: #c7c2b8;
      font-size: 14px;
    }

    .fs-toolbar-panel input[type="range"] {
      width: 100%;
      accent-color: #7ed957;
    }

    .fs-inline-button {
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(59, 67, 80, 0.92);
      color: #f8f4ea;
      border: 1px solid rgba(92, 103, 120, 0.7);
      font-size: 14px;
      font-weight: 700;
    }

    .fs-settings-section {
      margin-top: 22px;
      padding-top: 22px;
      border-top: 1px solid rgba(92, 103, 120, 0.35);
    }

    .fs-section-title {
      margin: 0 0 14px;
      font-size: 22px;
      line-height: 1.1;
    }

    .fs-saved-banner {
      margin-top: 16px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(17, 21, 26, 0.8);
      border: 1px solid rgba(126, 217, 87, 0.35);
      color: #dbe6ef;
      font-size: 14px;
      line-height: 1.45;
    }

    .fs-mode-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .fs-mode-card {
      width: 100%;
      padding: 18px;
      border-radius: 20px;
      text-align: left;
      background: rgba(52, 58, 68, 0.9);
      color: #f8f4ea;
      border: 2px solid rgba(23, 27, 32, 1);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .fs-mode-card.is-selected {
      background: #7ed957;
      color: #111315;
      border-color: #f6f1c7;
    }

    .fs-mode-card.is-demo {
      background: rgba(127, 138, 152, 0.32);
    }

    .fs-mode-card__title {
      font-size: 19px;
      font-weight: 700;
    }

    .fs-mode-card__hint {
      font-size: 13px;
      line-height: 1.45;
      color: inherit;
      opacity: 0.86;
    }

    .fs-players-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .fs-count-chip {
      min-width: 58px;
      padding: 12px 16px;
      border-radius: 16px;
      background: rgba(52, 58, 68, 0.95);
      color: #f8f4ea;
      border: 2px solid rgba(23, 27, 32, 1);
      font-weight: 700;
      font-size: 18px;
    }

    .fs-count-chip.is-selected {
      background: #7ed957;
      color: #111315;
      border-color: #f6f1c7;
    }

    .fs-player-select {
      display: none;
      width: 100%;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid rgba(92, 103, 120, 0.7);
      background: rgba(19, 23, 28, 0.92);
      color: #f8f4ea;
      font: inherit;
      font-size: 17px;
    }

    .fs-fields-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 18px;
    }

    .fs-field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .fs-field__label {
      color: #c7c2b8;
      font-size: 15px;
      font-weight: 700;
    }

    .fs-field__input {
      width: 100%;
      box-sizing: border-box;
      padding: 15px 16px;
      border-radius: 16px;
      border: 2px solid rgba(92, 103, 120, 0.88);
      background: rgba(17, 21, 26, 0.96);
      color: #f8f4ea;
      font: inherit;
      font-size: 20px;
      outline: none;
    }

    .fs-field__input:focus {
      border-color: #7ed957;
      box-shadow: 0 0 0 3px rgba(126, 217, 87, 0.16);
    }

    .fs-settings-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }

    .fs-action-button {
      min-height: 52px;
      padding: 14px 22px;
      border-radius: 18px;
      font-size: 18px;
      font-weight: 700;
      border: 2px solid rgba(23, 27, 32, 1);
      background: rgba(127, 138, 152, 0.92);
      color: #f8f4ea;
      flex: 1 1 220px;
    }

    .fs-action-button.is-primary {
      background: #7ed957;
      color: #111315;
      border-color: #f6f1c7;
    }

    .fs-action-button.is-secondary {
      background: rgba(59, 67, 80, 0.95);
      color: #f8f4ea;
      border-color: rgba(92, 103, 120, 0.7);
    }

    @media (max-width: 900px) {
      .fs-settings-overlay {
        padding: 12px;
      }

      .fs-settings-shell {
        width: 100%;
        min-height: calc(100vh - 24px);
        border-radius: 24px;
      }

      .fs-mode-grid,
      .fs-fields-grid {
        grid-template-columns: 1fr;
      }

      .fs-toolbar {
        align-items: stretch;
      }

      .fs-toolbar-row {
        justify-content: space-between;
      }
    }

    @media (max-width: 640px) {
      .fs-settings-overlay {
        padding: 0;
      }

      .fs-settings-shell {
        min-height: 100vh;
        border-radius: 0;
        border-left: 0;
        border-right: 0;
      }

      .fs-players-row {
        display: none;
      }

      .fs-player-select {
        display: block;
      }

      .fs-settings-actions {
        flex-direction: column;
      }

      .fs-action-button {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
}

export function buildSettingsOverlayMarkup({
  copy,
  locale,
  settingsDraft,
  hasSavedFairSession,
  audioSettings,
  audioExpanded,
  volumePercent
}) {
  const modeCards = [
    renderModeCard({
      action: 'set-mode',
      mode: 'standard',
      label: copy.modeGame,
      hint: copy.modeGameHint,
      isSelected: settingsDraft.mode === 'standard'
    }),
    renderModeCard({
      action: 'set-mode',
      mode: 'freestyle',
      label: copy.modeFreestyle,
      hint: copy.modeFreestyleHint,
      isSelected: settingsDraft.mode === 'freestyle'
    }),
    renderModeCard({
      action: 'start-demo',
      label: copy.demoMode,
      hint: copy.setupDemo,
      variant: 'demo'
    })
  ].join('');

  const playerOptions = Array.from(
    { length: MAX_PLAYER_COUNT - MIN_PLAYER_COUNT + 1 },
    (_, offset) => MIN_PLAYER_COUNT + offset
  );

  const playerCountChips = playerOptions
    .map((playerCount) => renderPlayerCountButton(playerCount, settingsDraft.playerCount === playerCount))
    .join('');

  const playerCountSelectOptions = playerOptions
    .map((playerCount) => renderPlayerOption(playerCount, settingsDraft.playerCount === playerCount))
    .join('');

  const nameFields = settingsDraft.playerNames
    .slice(0, settingsDraft.playerCount)
    .map((value, index) => renderPlayerNameField(copy, value, index))
    .join('');

  const speakerButtonClass = audioExpanded ? 'fs-icon-button is-active' : 'fs-icon-button';
  const muteButtonClass = audioSettings.muted ? 'fs-inline-button is-active' : 'fs-inline-button';
  const soundStatus = audioSettings.muted ? copy.soundMuted : copy.soundVolume(volumePercent);

  return `
    <div class="fs-settings-shell" data-locale="${locale}">
      <header class="fs-settings-header">
        <div>
          <h1 class="fs-settings-title">${escapeHtml(copy.setupTitle)}</h1>
          <p class="fs-settings-lead">${escapeHtml(copy.setupLead)}</p>
        </div>
        <div class="fs-toolbar">
          <div class="fs-toolbar-row">
            <div class="fs-segmented" role="group" aria-label="Language">
              ${renderLocaleButton('ru', locale === 'ru')}
              ${renderLocaleButton('en', locale === 'en')}
            </div>
            <div class="fs-icon-stack">
              <button
                type="button"
                class="${speakerButtonClass}"
                data-action="toggle-audio-panel"
                aria-label="${escapeHtml(copy.soundSettings)}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 9v6h4l5 4V5L7 9H3zm12.5 3a4.5 4.5 0 0 0-2.18-3.84v7.67A4.5 4.5 0 0 0 15.5 12zm0-8.5v2.18a7 7 0 0 1 0 12.64v2.18a9 9 0 0 0 0-16.99z"/>
                </svg>
              </button>
              <button
                type="button"
                class="fs-icon-button"
                data-action="open-rules-help"
                aria-label="Rules">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm.1 15.2a1.35 1.35 0 1 1-.001 2.701A1.35 1.35 0 0 1 12.1 17.2zm1.91-6.35-.84.57c-.68.46-.97.86-.97 1.78v.35H10.3v-.48c0-1.34.49-2.15 1.55-2.87l1.16-.79c.56-.39.88-.87.88-1.52 0-1.03-.78-1.72-1.98-1.72-1.27 0-2.06.74-2.14 1.97H7.83c.1-2.27 1.71-3.78 4.2-3.78 2.42 0 4.01 1.43 4.01 3.53 0 1.18-.54 2.06-2.03 3.08z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="fs-toolbar-panel${audioExpanded ? ' is-open' : ''}">
            <div class="fs-toolbar-panel__row">
              <span>${escapeHtml(copy.soundSettings)}</span>
              <span>${escapeHtml(soundStatus)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value="${volumePercent}"
              data-role="volume-range"
              aria-label="${escapeHtml(copy.soundSettings)}" />
            <div class="fs-toolbar-panel__row">
              <button type="button" class="${muteButtonClass}" data-action="toggle-mute">
                ${escapeHtml(audioSettings.muted ? copy.unmuteSound : copy.muteSound)}
              </button>
            </div>
          </div>
        </div>
      </header>

      ${hasSavedFairSession ? `<div class="fs-saved-banner">${escapeHtml(copy.savedFairSessionReady)}</div>` : ''}

      <section class="fs-settings-section">
        <h2 class="fs-section-title">${escapeHtml(copy.mode)}</h2>
        <div class="fs-mode-grid">
          ${modeCards}
        </div>
      </section>

      <section class="fs-settings-section">
        <h2 class="fs-section-title">${escapeHtml(copy.players)}</h2>
        <div class="fs-players-row">
          ${playerCountChips}
        </div>
        <select class="fs-player-select" data-role="player-count-select" aria-label="${escapeHtml(copy.players)}">
          ${playerCountSelectOptions}
        </select>
      </section>

      <section class="fs-settings-section">
        <h2 class="fs-section-title">${escapeHtml(copy.names)}</h2>
        <div class="fs-fields-grid">
          ${nameFields}
        </div>
      </section>

      <div class="fs-settings-actions">
        ${hasSavedFairSession ? `
          <button type="button" class="fs-action-button is-secondary" data-action="continue-game">
            ${escapeHtml(copy.continueGame)}
          </button>
        ` : ''}
        <button type="button" class="fs-action-button is-primary" data-action="new-game">
          ${escapeHtml(copy.newGame)}
        </button>
      </div>
    </div>
  `;
}