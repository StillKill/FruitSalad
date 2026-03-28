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

function usesAllFruitKinds(distinctFruits) {
  return distinctFruits.length === FRUIT_TYPES.length;
}

function makeBasketIcon() {
  return [{ special: 'basket' }];
}

export function getPerFruitMultiDisplayIcons(card) {
  return (card.saladFruits ?? [])
    .map((fruit, index) => ({
      fruit,
      points: card.scoring.points[index] ?? 0,
      index
    }))
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      return left.index - right.index;
    })
    .map(({ fruit, points }) => ({
      fruit,
      label: scoreLabel(points)
    }));
}

function getSaladDescriptor(card) {
  const distinctFruits = [...new Set(card.saladFruits ?? [])];
  const allKinds = usesAllFruitKinds(distinctFruits);

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
        icons: makeBasketIcon()
      };
    case 'compare-poverty':
      return {
        title: 'Least fruit',
        subtitle: `${scoreLabel(card.scoring.points)}`,
        icons: makeBasketIcon()
      };
    case 'parity-fruit':
      return {
        title: 'Even / Odd',
        subtitle: `${card.scoring.evenPoints} / ${card.scoring.oddPoints}`,
        icons: distinctFruits.map((fruit) => ({ fruit }))
      };
    case 'threshold-per-kind':
      return {
        title: allKinds ? `${card.scoring.threshold}+ kinds` : `${card.scoring.threshold}+ each kind`,
        subtitle: `${scoreLabel(card.scoring.pointsPerQualifiedKind)} each`,
        icons: allKinds ? makeBasketIcon() : distinctFruits.map((fruit) => ({ fruit }))
      };
    case 'missing-kind':
      return {
        title: allKinds ? 'Missing kinds' : 'Missing kind',
        subtitle: `${scoreLabel(card.scoring.pointsPerMissingKind)} each`,
        icons: allKinds ? makeBasketIcon() : distinctFruits.map((fruit) => ({ fruit }))
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
        icons: allKinds ? makeBasketIcon() : distinctFruits.slice(0, card.scoring.setSize).map((fruit) => ({ fruit }))
      };
    case 'per-fruit-flat':
      return {
        title: '',
        subtitle: '',
        hideTitle: true,
        hideSubtitle: true,
        layout: 'vertical-list',
        icons: distinctFruits.map((fruit) => ({ fruit, label: `/ ${scoreLabel(card.scoring.pointsPerFruit)}` }))
      };
    case 'per-fruit-multi':
      return {
        title: '',
        subtitle: '',
        hideTitle: true,
        hideSubtitle: true,
        layout: 'vertical-list',
        icons: getPerFruitMultiDisplayIcons(card)
      };
    default:
      return {
        title: card.ruleType,
        subtitle: `#${card.id}`,
        icons: distinctFruits.map((fruit) => ({ fruit }))
      };
  }
}

function getDescriptorIconTexture(iconData) {
  if (iconData.special === 'basket') {
    return 'icon_fruit_basket';
  }

  return getFruitIconTexture(iconData.fruit);
}

function addVerticalList(scene, container, descriptor, width, height) {
  const iconCount = descriptor.icons.length;
  const iconSize = Math.max(22, Math.floor(width * 0.16));
  const rowHeight = iconSize + 8;
  const totalHeight = iconCount * rowHeight;
  const centerY = iconCount <= 3 ? height * 0.5 : height * 0.42;
  const startY = centerY - totalHeight / 2 + rowHeight / 2;
  const iconX = width * 0.36;
  const labelX = width * 0.56;

  descriptor.icons.forEach((iconData, index) => {
    const y = startY + index * rowHeight;
    const icon = scene.add.image(iconX, y, getDescriptorIconTexture(iconData));
    icon.setDisplaySize(iconSize, iconSize);
    container.add(icon);

    const label = scene.add.text(labelX, y, iconData.label ?? '', {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: `${Math.max(13, Math.round(width * 0.085))}px`,
      color: '#111315',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    container.add(label);
  });
}

function addDescriptorIcons(scene, container, descriptor, width, height) {
  if (!descriptor.icons.length) {
    return;
  }

  if (descriptor.layout === 'vertical-list') {
    addVerticalList(scene, container, descriptor, width, height);
    return;
  }

  const hasSingleBasket = descriptor.icons.length === 1 && descriptor.icons[0].special === 'basket';
  if (hasSingleBasket) {
    const basket = scene.add.image(width / 2, height * 0.58, getDescriptorIconTexture(descriptor.icons[0]));
    const basketSize = Math.max(36, Math.floor(width * 0.26));
    basket.setDisplaySize(basketSize, basketSize);
    container.add(basket);
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

    const icon = scene.add.image(iconX, iconY, getDescriptorIconTexture(iconData));
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

  scene.load.image('icon_fruit_basket', 'assets/ui/icon_fruit_basket.png');
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

  if (!descriptor.hideTitle) {
    const title = scene.add.text(width / 2, height * 0.325, descriptor.title, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: `${Math.max(13, Math.round(width * 0.094))}px`,
      color: '#111315',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width * 0.56 }
    }).setOrigin(0.5);
    container.add(title);
  }

  if (!descriptor.hideSubtitle) {
    const subtitleY = descriptor.hideTitle ? height * 0.38 : height * 0.425;
    const subtitle = scene.add.text(width / 2, subtitleY, descriptor.subtitle, {
      fontFamily: '"Trebuchet MS", sans-serif',
      fontSize: `${Math.max(11, Math.round(width * 0.08))}px`,
      color: '#2a3038',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width * 0.58 }
    }).setOrigin(0.5);
    container.add(subtitle);
  }

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
