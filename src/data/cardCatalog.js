function resolveBackFruit(card, copyIndex, fruits) {
  if (card.backFruit) {
    return card.backFruit;
  }

  return fruits[copyIndex % fruits.length];
}

export function createSeededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleCards(cards, randomFn) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function expandCardTemplates(catalog, requiredCards) {
  const cards = catalog.cards ?? [];
  const fruits = catalog.fruits ?? [];

  if (!cards.length) {
    return [];
  }

  const expanded = [];
  let copyIndex = 0;

  while (expanded.length < requiredCards) {
    const card = cards[expanded.length % cards.length];
    const instance = structuredClone(card);

    instance.runtimeId = `${card.id}__${copyIndex + 1}`;
    instance.sourceId = card.id;
    instance.backFruit = resolveBackFruit(card, copyIndex, fruits);

    expanded.push(instance);
    copyIndex += 1;
  }

  return expanded;
}
