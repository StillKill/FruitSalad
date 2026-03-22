import { layoutConfig } from '../config/layoutConfig.js';

export function drawPanel(scene, region, fillColor, strokeColor = layoutConfig.palette.border) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(fillColor, 1);
  graphics.lineStyle(2, strokeColor, 1);
  graphics.fillRoundedRect(region.x, region.y, region.width, region.height, 18);
  graphics.strokeRoundedRect(region.x, region.y, region.width, region.height, 18);

  return graphics;
}

export function drawCardPlaceholder(scene, x, y, width, height, fillColor, label) {
  const card = scene.add.graphics();

  card.fillStyle(fillColor, 1);
  card.lineStyle(2, 0x171b20, 1);
  card.fillRoundedRect(x, y, width, height, 12);
  card.strokeRoundedRect(x, y, width, height, 12);

  scene.add.text(x + 10, y + 10, label, {
    fontFamily: '"Trebuchet MS", sans-serif',
    fontSize: '14px',
    color: '#111315',
    fontStyle: 'bold',
    wordWrap: { width: width - 20 }
  });

  return card;
}