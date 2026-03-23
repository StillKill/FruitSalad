import * as Phaser from './node_modules/phaser/dist/phaser.esm.js';
import { gameConfig } from './src/config/gameConfig.js';

function ensureBootStatus() {
  let panel = document.getElementById('boot-status');

  if (!panel) {
    panel = document.createElement('pre');
    panel.id = 'boot-status';
    panel.style.position = 'fixed';
    panel.style.left = '12px';
    panel.style.top = '12px';
    panel.style.zIndex = '9999';
    panel.style.maxWidth = 'min(720px, calc(100vw - 24px))';
    panel.style.padding = '10px 12px';
    panel.style.whiteSpace = 'pre-wrap';
    panel.style.borderRadius = '8px';
    panel.style.background = 'rgba(18, 20, 24, 0.9)';
    panel.style.color = '#f8f4ea';
    panel.style.font = '12px Consolas, monospace';
    panel.style.pointerEvents = 'none';
    document.body.appendChild(panel);
  }

  return panel;
}

function setBootStatus(message, isError = false) {
  const panel = ensureBootStatus();
  panel.textContent = message;
  panel.style.display = 'block';
  panel.style.background = isError ? 'rgba(96, 18, 18, 0.92)' : 'rgba(18, 20, 24, 0.9)';
}

function hideBootStatus() {
  const panel = document.getElementById('boot-status');
  if (panel) {
    panel.style.display = 'none';
  }
}

window.addEventListener('error', (event) => {
  const details = event.error?.stack || `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`;
  setBootStatus(`Boot error:\n${details}`, true);
});

window.addEventListener('unhandledrejection', (event) => {
  const details = event.reason?.stack || String(event.reason);
  setBootStatus(`Unhandled rejection:\n${details}`, true);
});

window.addEventListener('load', () => {
  try {
    window.__FRUIT_SALAD_GAME__ = new Phaser.Game(gameConfig);
    hideBootStatus();
  } catch (error) {
    setBootStatus(`Bootstrap failure:\n${error.stack || error.message}`, true);
  }
});