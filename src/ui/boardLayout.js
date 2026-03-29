import { layoutConfig } from '../config/layoutConfig.js';

export function drawPanel(scene, region, fillColor, strokeColor = layoutConfig.palette.border) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(fillColor, 1);
  graphics.lineStyle(2, strokeColor, 1);
  graphics.fillRoundedRect(region.x, region.y, region.width, region.height, 18);
  graphics.strokeRoundedRect(region.x, region.y, region.width, region.height, 18);

  if (typeof scene.track === 'function') {
    scene.track(graphics);
  }

  return graphics;
}

export function drawCardPlaceholder(scene, x, y, width, height, fillColor, label) {
  const container = scene.add.container(x, y);
  const card = scene.add.graphics();

  card.fillStyle(fillColor, 1);
  card.lineStyle(2, 0x171b20, 1);
  card.fillRoundedRect(0, 0, width, height, 12);
  card.strokeRoundedRect(0, 0, width, height, 12);
  container.add(card);

  const text = scene.add.text(10, 10, label, {
    fontFamily: '"Trebuchet MS", sans-serif',
    fontSize: '14px',
    color: '#111315',
    fontStyle: 'bold',
    wordWrap: { width: width - 20 }
  });
  container.add(text);

  return container;
}
