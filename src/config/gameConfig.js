import * as Phaser from '../../node_modules/phaser/dist/phaser.esm.js';
import { GameScene } from '../scenes/GameScene.js';

export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: 1600,
  height: 900,
  backgroundColor: '#111315',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};