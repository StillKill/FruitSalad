import Phaser from './node_modules/phaser/dist/phaser.esm.js';
import { gameConfig } from './src/config/gameConfig.js';

window.addEventListener('load', () => {
  window.__FRUIT_SALAD_GAME__ = new Phaser.Game(gameConfig);
});
