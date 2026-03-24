export const FRUIT_TYPES = ['kiwi', 'orange', 'apple', 'banana', 'lime', 'mango'];

function getFruitCardTexture(fruit) {
  return `card_fruit_${fruit}`;
}

function getFruitIconTexture(fruit) {
  return `icon_fruit_${fruit}`;
}

function getSaladCardTexture(card) {
  return `card_salad_${card.backFruit}`;
}

function addCardFrame(scene, container, width, height) {
  const frame = scene.add.graphics();
  frame.lineStyle(2, 0x171b20, 0.95);
  frame.strokeRoundedRect(0, 0, width, height, 12);
  container.add(frame);
}

function scoreLabel(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function getSaladDescriptor(card) {
  const distinctFruits = [...new Set(card.saladFruits ?? [])];

  switch (card.ruleType) {
    case 'compare-majority':
      return {
        title: 'Most wins',
        subtitle: `${scoreLabel(card.scoring.points)}`,
        icons: distinctFruits.map((fruit) => ({ fruit }))
      };
    case 'compare-minority':
      return {
        title: 'Least wins',
        subtitle: `${scoreLabel(card.scoring.points)}`,
        icons: distinctFruits.map((fruit) => ({ fruit }))
      };
    case 'compare-wealth':
      return {
        title: 'Most fruit',
        subtitle: `${scoreLabel(card.scoring.points)}`,
        icons: []
      };
    case 'compare-poverty':
      return {
        title: 'Least fruit',
        subtitle: `${scoreLabel(card.scoring.points)}`,
        icons: []
      };
    case 'parity-fruit':
      return {
        title: 'Even / Odd',
        subtitle: `${card.scoring.evenPoints} / ${card.scoring.oddPoints}`,
        icons: distinctFruits.map((fruit) => ({ fruit }))
      };
    case 'threshold-per-kind':
      return {
        title: `${card.scoring.threshold}+ each kind`,
        subtitle: `${scoreLabel(card.scoring.pointsPerQualifiedKind)} each`,
        icons: FRUIT_TYPES.map((fruit) => ({ fruit }))
      };
    case 'missing-kind':
      return {
        title: 'Missing kind',
        subtitle: `${scoreLabel(card.scoring.pointsPerMissingKind)} each`,
        icons: FRUIT_TYPES.map((fruit) => ({ fruit }))
      };
    case 'set-same-kind':
      return {
        title: `Set of ${card.scoring.setSize}`,
        subtitle: `${scoreLabel(card.scoring.pointsPerSet)}`,
        icons: distinctFruits.map((fruit) => ({ fruit }))
      };
    case 'set-distinct-kind':
      return {
        title: `${card.scoring.setSize} kinds`,
        subtitle: `${scoreLabel(card.scoring.pointsPerSet)}`,
        icons: distinctFruits.slice(0, card.scoring.setSize).map((fruit) => ({ fruit }))
      };
    case 'per-fruit-flat':
      return {
        title: 'Per fruit',
        subtitle: `${scoreLabel(card.scoring.pointsPerFruit)} each`,
        icons: distinctFruits.map((fruit) => ({ fruit, label: scoreLabel(card.scoring.pointsPerFruit) }))
      };
    case 'per-fruit-multi':
      return {
        title: 'Per fruit',
        subtitle: 'Match icons',
        icons: (card.saladFruits ?? []).map((fruit, index) => ({
          fruit,
          label: scoreLabel(card.scoring.points[index] ?? 0)
        }))
      };
    default:
      return {
        title: card.ruleType,
        subtitle: `#${card.id}`,
        icons: distinctFruits.map((fruit) => ({ fruit }))
      };
  }
}

function addDescriptorIcons(scene, container, descriptor, width, height) {
  if (!descriptor.icons.length) {
    return;
  }

  const iconsPerRow = descriptor.icons.length > 4 ? 3 : descriptor.icons.length;
  const rows = Math.ceil(descriptor.icons.length / iconsPerRow);
  const iconSize = descriptor.icons.length > 4 ? Math.max(20, Math.floor(width * 0.16)) : Math.max(24, Math.floor(width * 0.18));
  const rowGap = iconSize + 18;
  const startY = height * 0.56 - ((rows - 1) * rowGap) / 2;

  descriptor.icons.forEach((iconData, index) => {
    const row = Math.floor(index / iconsPerRow);
    const column = index % iconsPerRow;
    const rowCount = Math.min(iconsPerRow, descriptor.icons.length - row * iconsPerRow);
    const cellWidth = Math.min(width * 0.22, 42);
    const totalWidth = (rowCount - 1) * cellWidth;
    const iconX = width / 2 - totalWidth / 2 + column * cellWidth;
    const iconY = startY + row * rowGap;

    const icon = scene.add.image(iconX, iconY, getFruitIconTexture(iconData.fruit));
    icon.setDisplaySize(iconSize, iconSize);
    container.add(icon);

    if (iconData.label) {
      const label = scene.add.text(iconX, iconY + iconSize / 2 + 4, iconData.label, {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: `${Math.max(11, Math.round(width * 0.08))}px`,
        color: '#111315',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0);
      container.add(label);
    }
  });
}

export function preloadCardTextures(scene) {
  FRUIT_TYPES.forEach((fruit) => {
    scene.load.image(getFruitCardTexture(fruit), `assets/cards/fruits/card_fruit_${fruit}.png`);
    scene.load.image(getFruitIconTexture(fruit), `assets/ui/icon_fruit_${fruit}.png`);
    scene.load.image(`card_salad_${fruit}`, `assets/cards/salads/card_salad_${fruit}.png`);
  });
}

export function drawFruitCard(scene, x, y, width, height, fruit) {
  const container = scene.add.container(x, y);
  const image = scene.add.image(0, 0, getFruitCardTexture(fruit)).setOrigin(0, 0);
  image.setDisplaySize(width, height);
  container.add(image);
  addCardFrame(scene, container, width, height);
  return container;
}

export function drawSaladCard(scene, x, y, width, height, card) {
  const container = scene.add.container(x, y);
  const image = scene.add.image(0, 0, getSaladCardTexture(card)).setOrigin(0, 0);
  const descriptor = getSaladDescriptor(card);

  image.setDisplaySize(width, height);
  container.add(image);
  addCardFrame(scene, container, width, height);

  const title = scene.add.text(width / 2, height * 0.34, descriptor.title, {
    fontFamily: '"Trebuchet MS", sans-serif',
    fontSize: `${Math.max(13, Math.round(width * 0.1))}px`,
    color: '#111315',
    fontStyle: 'bold',
    align: 'center',
    wordWrap: { width: width * 0.5 }
  }).setOrigin(0.5);
  container.add(title);

  const subtitle = scene.add.text(width / 2, height * 0.43, descriptor.subtitle, {
    fontFamily: '"Trebuchet MS", sans-serif',
    fontSize: `${Math.max(11, Math.round(width * 0.085))}px`,
    color: '#2a3038',
    fontStyle: 'bold',
    align: 'center',
    wordWrap: { width: width * 0.52 }
  }).setOrigin(0.5);
  container.add(subtitle);

  addDescriptorIcons(scene, container, descriptor, width, height);
  return container;
}

export function drawFruitCounter(scene, x, y, fruit, count) {
  const container = scene.add.container(x, y);
  const background = scene.add.graphics();
  background.fillStyle(0x2a3038, 1);
  background.lineStyle(2, 0x171b20, 1);
  background.fillRoundedRect(0, 0, 92, 102, 18);
  background.strokeRoundedRect(0, 0, 92, 102, 18);
  container.add(background);

  const icon = scene.add.image(46, 34, getFruitIconTexture(fruit));
  icon.setDisplaySize(44, 44);
  container.add(icon);

  const fruitLabel = scene.add.text(46, 69, fruit.toUpperCase(), {
    fontFamily: '"Trebuchet MS", sans-serif',
    fontSize: '13px',
    color: '#c7c2b8',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  container.add(fruitLabel);

  const countLabel = scene.add.text(46, 87, String(count), {
    fontFamily: '"Trebuchet MS", sans-serif',
    fontSize: '22px',
    color: '#f8f4ea',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  container.add(countLabel);

  return container;
}
