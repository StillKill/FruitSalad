function resolveBackFruit(card, copyIndex, fruits) {
  if (card.backFruit) {
    return card.backFruit;
  }

  return fruits[copyIndex % fruits.length];
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